import { consistencyBounds } from '../damage.ts'
import type {
  ClassAction,
  ClassModule,
  CombatActor,
  CombatHero,
  CombatState,
  GameDefs,
  OutgoingModifierQuery,
  SkillDef,
} from '../types.ts'
import { defineClassResource, grantClassResource, normalizeBasicAttackResource, payClassResource } from './resources.ts'

export const READINESS_RESOURCE_ID = 'readiness'
export const READINESS_MAXIMUM = 100
export const READINESS_SCOPE = 'expedition' as const
/** Successful basic attacks. Weapon-normalized, then Spirit. Misses gain nothing. */
export const READINESS_BASIC_BASE = 10
/** Harness default when the encounter setup does not supply a start. Travel gain is later. */
export const READINESS_HARNESS_START = 100
/** Travel and other time outside combat. Spirit applies. Readiness does not regen in combat. */
export const READINESS_TRAVEL_PER_SECOND = 5
/** One quiver slot holds one special arrow. */
export const QUIVER_CAPACITY = 6
export const EFFICIENT_QUIVER_CAPACITY = 8
export const MISSING_SPECIAL_ARROW_REASON = 'missing special arrow'

export const NODE_AIMED_SHOT = 'ranger-aimed-shot'
export const NODE_STEADY_HANDS = 'ranger-steady-hands'
export const NODE_PIERCING_ARROW = 'ranger-piercing-arrow'
export const NODE_PATIENT_SHOT = 'ranger-patient-shot'
export const NODE_DEADEYE = 'ranger-deadeye'
export const NODE_SNARE_TRAP = 'ranger-snare-trap'
export const NODE_REINFORCED_SNARE = 'ranger-reinforced-snare'
export const NODE_FLAME_ARROW = 'ranger-flame-arrow'
export const NODE_EFFICIENT_QUIVER = 'ranger-efficient-quiver'
export const NODE_TRAPPER = 'ranger-trapper'
export const NODE_HUNTERS_MARK = 'ranger-hunters-mark'
export const NODE_TRAIL_SENSE = 'ranger-trail-sense'
export const NODE_VOLLEY = 'ranger-volley'
export const NODE_PRESS_THE_TRAIL = 'ranger-press-the-trail'
export const NODE_TRAILBLAZER = 'ranger-trailblazer'

export const AIMED_SHOT_ID = 'aimed-shot'
export const PIERCING_ARROW_ID = 'piercing-arrow'
export const SNARE_TRAP_ID = 'snare-trap'

/** Aimed Shot's coefficient at 80 or more Readiness, checked before the cost is paid. */
export const AIMED_SHOT_READINESS = 80
export const AIMED_SHOT_COEFFICIENT = 2
export const STEADY_HANDS_READINESS = 75
export const STEADY_HANDS_FLOOR = 0.1
export const STEADY_HANDS_CRIT = 0.1
export const PATIENT_QUIET_MS = 4000
export const PATIENT_DAMAGE = 1.2
export const DEADEYE_READINESS = 100
export const DEADEYE_ROLL_FLOOR = 0.95
export const DEADEYE_CRIT = 0.25
export const REINFORCED_POTENCY = 15
export const REINFORCED_DELAY_MS = 750
export const TRAIL_SENSE_FACTOR = 1.25
export const PRESS_READINESS_PER_STACK = 5
export const PRESS_ESCAPE_PER_STACK = 2
export const TRAILBLAZER_DAMAGE_PER_STACK = 0.03
export const TRAILBLAZER_TRAVEL_PER_STACK = 0.05
export const TRAPPER_RECHARGE_ENCOUNTERS = 3
/** Shots 3, 6, 9… do not spend a special arrow. */
export const FREE_ARROW_INTERVAL = 3

const STATE_PATIENT_SINCE = 'patientSinceMs'
const STATE_PATIENT_BONUS = 'patientBonus'
const STATE_CRIT_BONUS = 'critChanceBonus'
const STATE_ARROWS = 'specialArrowCount'
const STATE_TRAPPER_DEPLOYED = 'trapperDeployed'
const STATE_FLOOR = 'damageRollFloorBonus'

function hasNode(hero: CombatHero, id: string): boolean {
  return hero.allocatedNodeIds.includes(id)
}

function hasAllocated(ids: readonly string[] | undefined, id: string): boolean {
  return ids !== undefined && ids.includes(id)
}

function setState(hero: CombatHero, key: string, value: number | string | boolean | null): void {
  if (value === null) {
    if (hero.classState[key] === undefined) return
    const next: CombatHero['classState'] = {}
    for (const existing of Object.keys(hero.classState)) {
      if (existing === key) continue
      const kept = hero.classState[existing]
      if (kept !== undefined) next[existing] = kept
    }
    hero.classState = next
    return
  }
  hero.classState = { ...hero.classState, [key]: value }
}

function stateNumber(hero: CombatHero, key: string): number | null {
  const value = hero.classState[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

/** Aimed Shot and Piercing Arrow. Volley, Flame Arrow, and traps are not aimed. */
export function isAimedSkill(skill: SkillDef): boolean {
  return skill.id === AIMED_SHOT_ID || skill.id === PIERCING_ARROW_ID
}

/**
 * An attack-tagged skill with a positive Readiness cost.
 * Basic attacks, Hunter's Mark, and Snare Trap do not reset Patient Shot.
 */
function spendsReadinessAttack(skill: SkillDef): boolean {
  return skill.cost > 0 && skill.tags.includes('attack')
}

export function quiverCapacity(hero: CombatHero): number {
  if (hero.classId === 'ranger' && hasNode(hero, NODE_EFFICIENT_QUIVER)) return EFFICIENT_QUIVER_CAPACITY
  return QUIVER_CAPACITY
}

function arrowCount(hero: CombatHero): number {
  const stored = stateNumber(hero, STATE_ARROWS)
  if (stored !== null && stored >= 0) return stored
  if (hero.suppliedArrowCount !== null && hero.suppliedArrowCount >= 0) return hero.suppliedArrowCount
  return 0
}

/** The authored ammo cost, or 0 when Efficient Quiver makes this the free shot. */
export function resolvedAmmoCost(hero: CombatHero, skill: SkillDef): number {
  const cost = skill.ammoCost ?? 0
  if (cost <= 0 || hero.classId !== 'ranger' || !hasNode(hero, NODE_EFFICIENT_QUIVER)) return cost
  if ((arrowCount(hero) + 1) % FREE_ARROW_INTERVAL === 0) return 0
  return cost
}

function supplyCostOf(skill: SkillDef): number {
  if (skill.supplyCost === undefined) return 0
  return skill.supplyCost
}

/**
 * Trail Sense is ×1.25. Trailblazer is `1 + 0.05 × stacks`, which is 1 at 0 stacks.
 * Both allocated multiplies the factors. No node returns 1.
 */
export function travelReadinessFactor(nodeIds: readonly string[] | undefined, momentum: number): number {
  let factor = 1
  if (hasAllocated(nodeIds, NODE_TRAIL_SENSE)) factor *= TRAIL_SENSE_FACTOR
  if (hasAllocated(nodeIds, NODE_TRAILBLAZER)) factor *= 1 + TRAILBLAZER_TRAVEL_PER_STACK * momentum
  return factor
}

/** Flat Readiness after a victory. 0 without the node or at 0 momentum. Spirit does not apply. */
export function pressTrailReadiness(nodeIds: readonly string[] | undefined, momentum: number): number {
  if (!hasAllocated(nodeIds, NODE_PRESS_THE_TRAIL) || momentum <= 0) return 0
  return PRESS_READINESS_PER_STACK * momentum
}

/** Extra escape percentage points. The Agility cap is unchanged. 0 without the node. */
export function pressTrailEscapePoints(nodeIds: readonly string[] | undefined, momentum: number): number {
  if (!hasAllocated(nodeIds, NODE_PRESS_THE_TRAIL) || momentum <= 0) return 0
  return PRESS_ESCAPE_PER_STACK * momentum
}

function livingEnemy(state: CombatState): CombatActor | null {
  let chosen: CombatActor | null = null
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    if (chosen === null || enemy.slot < chosen.slot) chosen = enemy
  }
  return chosen
}

function snareSkill(defs: GameDefs | undefined): SkillDef {
  const skill = defs?.skills[SNARE_TRAP_ID]
  if (skill === undefined) throw new Error('snare trap is not defined')
  return skill
}

function armTrapEffect(skill: SkillDef): { baseChance: number } {
  for (const effect of skill.effects) {
    if (effect.kind === 'armTrap') return effect
  }
  throw new Error(`${skill.name} does not arm a trap`)
}

function reinforceTrap(hero: CombatHero, trap: CombatActor['armedTrap']): void {
  if (trap === null || !hasNode(hero, NODE_REINFORCED_SNARE)) return
  trap.potencyBonus = REINFORCED_POTENCY
  trap.resistDelayMs = REINFORCED_DELAY_MS
}

function deploySnare(state: CombatState, defs: GameDefs | undefined, timeMs: number): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_TRAPPER)) return
  const cooldown = hero.suppliedTrapperCooldown ?? 0
  if (cooldown > 0) return
  const skill = snareSkill(defs)
  const supplyCost = supplyCostOf(skill)
  if (supplyCost > 0 && hero.carriedSupplyCount < supplyCost) return
  if (skill.cost > hero.classResource) return
  const target = livingEnemy(state)
  if (target === null) return
  const effect = armTrapEffect(skill)
  let replacedId: string | null = null
  let replacedName: string | null = null
  const actors: CombatActor[] = [hero, ...state.enemies]
  for (const actor of actors) {
    if (actor.armedTrap === null) continue
    replacedId = actor.id
    replacedName = actor.name
    actor.armedTrap = null
  }
  target.armedTrap = {
    baseChance: effect.baseChance,
    skillId: skill.id,
    sourceId: hero.id,
  }
  reinforceTrap(hero, target.armedTrap)
  if (supplyCost > 0) hero.carriedSupplyCount -= supplyCost
  payClassResource(state, timeMs, skill.cost, 'trapper')
  setState(hero, STATE_TRAPPER_DEPLOYED, true)
  state.log.push({
    type: 'trap',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    targetId: target.id,
    targetName: target.name,
    replacedId,
    replacedName,
  })
}

function prepareAimedSkill(state: CombatState, skill: SkillDef, timeMs: number): void {
  const hero = state.hero
  const readiness = hero.classResource
  const aimed = isAimedSkill(skill)
  if (skill.id === AIMED_SHOT_ID && hasNode(hero, NODE_AIMED_SHOT) && readiness >= AIMED_SHOT_READINESS) {
    hero.pendingCoefficient = AIMED_SHOT_COEFFICIENT
  }
  let floorBonus = 0
  let critBonus = 0
  if (aimed && hasNode(hero, NODE_STEADY_HANDS) && readiness >= STEADY_HANDS_READINESS) {
    floorBonus += STEADY_HANDS_FLOOR
    critBonus += STEADY_HANDS_CRIT
  }
  if (aimed && hasNode(hero, NODE_DEADEYE) && readiness >= DEADEYE_READINESS) {
    const bounds = consistencyBounds(hero.consistency)
    const need = DEADEYE_ROLL_FLOOR - bounds.floor
    if (need > floorBonus) floorBonus = need
    critBonus += DEADEYE_CRIT
    hero.pendingSkillCost = readiness
  }
  if (floorBonus > 0) setState(hero, STATE_FLOOR, floorBonus)
  if (critBonus > 0) {
    const room = 1 - hero.critChance
    const applied = room < critBonus ? (room > 0 ? room : 0) : critBonus
    if (applied > 0) {
      hero.critChance += applied
      setState(hero, STATE_CRIT_BONUS, applied)
    }
  }
  const since = stateNumber(hero, STATE_PATIENT_SINCE) ?? 0
  if (
    aimed &&
    hasNode(hero, NODE_PATIENT_SHOT) &&
    timeMs - since >= PATIENT_QUIET_MS
  ) {
    setState(hero, STATE_PATIENT_BONUS, true)
  }
  if (spendsReadinessAttack(skill)) setState(hero, STATE_PATIENT_SINCE, timeMs)
}

function noteSpecialArrow(state: CombatState, action: ClassAction): void {
  if (action.kind !== 'skill') return
  const authored = action.skill.ammoCost ?? 0
  if (authored <= 0 || !hasNode(state.hero, NODE_EFFICIENT_QUIVER)) return
  setState(state.hero, STATE_ARROWS, arrowCount(state.hero) + 1)
}

function reinforcePlacedTrap(state: CombatState, action: ClassAction): void {
  if (action.kind !== 'skill' || action.skill.id !== SNARE_TRAP_ID) return
  if (!hasNode(state.hero, NODE_REINFORCED_SNARE)) return
  for (const enemy of state.enemies) {
    const trap = enemy.armedTrap
    if (trap === null || trap.skillId !== SNARE_TRAP_ID || trap.sourceId !== state.hero.id) continue
    reinforceTrap(state.hero, trap)
  }
}

function finishSkillAdjustments(hero: CombatHero): void {
  const bonus = stateNumber(hero, STATE_CRIT_BONUS)
  if (bonus !== null && bonus !== 0) {
    hero.critChance -= bonus
    if (hero.critChance < 0) hero.critChance = 0
    if (hero.critChance > 1) hero.critChance = 1
  }
  setState(hero, STATE_CRIT_BONUS, null)
  setState(hero, STATE_FLOOR, null)
  setState(hero, STATE_PATIENT_BONUS, null)
  hero.pendingCoefficient = null
}

function encounterStart(state: CombatState, timeMs: number, defs?: GameDefs): void {
  const hero = state.hero
  const supplied = hero.suppliedResource
  const amount = supplied === null ? READINESS_HARNESS_START : supplied
  defineClassResource(state, timeMs, {
    id: READINESS_RESOURCE_ID,
    maximum: READINESS_MAXIMUM,
    scope: READINESS_SCOPE,
    amount,
    regenPerSecond: 0,
  })
  const capacity = quiverCapacity(hero)
  if (hero.suppliedAmmo === null) {
    hero.specialAmmo = capacity
  } else if (hero.specialAmmo > capacity) {
    hero.specialAmmo = capacity
  }
  if (hasNode(hero, NODE_EFFICIENT_QUIVER)) setState(hero, STATE_ARROWS, arrowCount(hero))
  deploySnare(state, defs, timeMs)
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind !== 'skill') return
  prepareAimedSkill(state, action.skill, timeMs)
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind === 'basicAttack') {
    if (!action.hit) return
    const base = normalizeBasicAttackResource(READINESS_BASIC_BASE, state.hero.baseActionSeconds)
    grantClassResource(state, timeMs, base, 'basicAttack')
    return
  }
  noteSpecialArrow(state, action)
  reinforcePlacedTrap(state, action)
  finishSkillAdjustments(state.hero)
}

function encounterEnd(state: CombatState, _timeMs: number): void {
  finishSkillAdjustments(state.hero)
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  if (query.school !== 'physical') return 1
  const hero = state.hero
  let factor = 1
  if (hasNode(hero, NODE_TRAILBLAZER) && hero.expeditionMomentum > 0) {
    factor *= 1 + TRAILBLAZER_DAMAGE_PER_STACK * hero.expeditionMomentum
  }
  if (hero.classState[STATE_PATIENT_BONUS] === true) factor *= PATIENT_DAMAGE
  return factor
}

export const rangerClass: ClassModule = {
  encounterStart,
  encounterEnd,
  actionChosen,
  actionResolved,
  outgoingModifiers,
}
