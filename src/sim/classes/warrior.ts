import { consistencyBounds } from '../damage.ts'
import type {
  ClassAction,
  ClassModule,
  CombatActor,
  CombatHero,
  CombatState,
  DamageNotice,
  GameDefs,
  OutgoingModifierQuery,
  SkillDef,
} from '../types.ts'
import { tryApplyStatus } from '../statuses.ts'
import {
  BLEED_BASE_CHANCE,
  BLEED_POWER_COEFFICIENT,
  BLEEDING_TARGET_FURY,
  BERSERKER_INCOMING,
  BERSERKER_PHYSICAL_BONUS,
  CLEAVE_ID,
  DRIVING_BLOW_FURY_BONUS,
  DRIVING_BLOW_ID,
  HEAVY_SPEED_FACTOR,
  HEAVY_TIME_COEFFICIENT,
  NODE_BERSERKER,
  NODE_BLOODLETTING,
  NODE_DRIVING_BLOW,
  NODE_HEAVY_FOLLOW_THROUGH,
  NODE_SHIELD_IMPACT,
  NODE_UNBROKEN,
  NODE_WEAPON_MASTER,
  PERFECT_FORM_LENGTH,
  PERFECT_FORM_ROLL_FLOOR,
  SHIELD_IMPACT_STUN_CHANCE,
  SHIELD_IMPACT_WINDOW_MS,
  STATE_DAMAGE_ROLL_FLOOR,
  STATE_FOLLOW_THROUGH,
  STATE_PERFECT_FORM,
  STATE_PERFECT_FORM_SKILLS,
  STATE_SHIELD_IMPACT_UNTIL,
  STATE_UNBROKEN_USED,
  STATE_WEAPON_CHAIN,
  SUNDERING_BLOW_ID,
  UNBROKEN_LETHAL_FURY,
  UNBROKEN_REDUCTION_AT_FULL,
  adjustedCooldownSeconds,
  hasNode,
  isWeaponSkill,
  perfectFormReady,
  resolvedSkillCost,
} from './warriorAdjust.ts'
import {
  BASIC_ATTACK_RESOURCE_BASELINE_SECONDS,
  defineClassResource,
  grantClassResource,
  normalizeBasicAttackResource,
  setClassResource,
} from './resources.ts'

export const FURY_RESOURCE_ID = 'fury'
export const FURY_MAXIMUM = 100
export const FURY_SCOPE = 'encounter' as const
/** Outside combat, Fury does not drain during this many whole seconds. */
export const FURY_DRAIN_WAIT_SECONDS = 3
/** Lost each whole second after the wait. A full meter needs 10 seconds of drain. */
export const FURY_DRAIN_PER_SECOND = 10
export const FURY_GENERATOR_BASE = 5
export const FURY_PHYSICAL_BONUS_AT_FULL = 0.25
export const FURY_HIT_GAIN_CAP = 20
export const FURY_HP_PERCENT_BASE = 1
export const FURY_BRACE_HIT_BASE = 5
export const FURY_GENERATOR_TAG = 'generator'
export const FURY_SPENDER_TAG = 'spender'
export const FURY_SNAPSHOT_KEY = 'furySnapshotAmount'

export { BASIC_ATTACK_RESOURCE_BASELINE_SECONDS }

/** `1 + 0.25 × (Fury / 100)`. Magical damage does not use this. Nodes do not change this helper. */
export function furyPhysicalMultiplier(fury: number): number {
  return 1 + FURY_PHYSICAL_BONUS_AT_FULL * (fury / FURY_MAXIMUM)
}

function heldFuryDamageBonus(hero: CombatHero): number {
  let bonus = hasNode(hero, NODE_BERSERKER) ? BERSERKER_PHYSICAL_BONUS : FURY_PHYSICAL_BONUS_AT_FULL
  if (hasNode(hero, NODE_UNBROKEN)) bonus *= 0.5
  return bonus
}

function heroFuryMultiplier(hero: CombatHero, fury: number): number {
  return 1 + heldFuryDamageBonus(hero) * (fury / FURY_MAXIMUM)
}

function snapshotAmount(hero: CombatHero): number | null {
  const amount = hero.classState[FURY_SNAPSHOT_KEY]
  if (typeof amount !== 'number') return null
  return amount
}

function setState(hero: CombatHero, key: string, value: number | string | boolean | null): void {
  if (value === null) {
    if (hero.classState[key] === undefined) return
    const next: CombatHero['classState'] = {}
    const keys = Object.keys(hero.classState)
    for (const existing of keys) {
      if (existing === key) continue
      const kept = hero.classState[existing]
      if (kept !== undefined) next[existing] = kept
    }
    hero.classState = next
    return
  }
  hero.classState = { ...hero.classState, [key]: value }
}

function clearSnapshot(hero: CombatHero): void {
  setState(hero, FURY_SNAPSHOT_KEY, null)
}

function stateNumber(hero: CombatHero, key: string): number | null {
  const value = hero.classState[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function readChain(hero: CombatHero, key: string): string[] {
  const value = hero.classState[key]
  if (typeof value !== 'string' || value.length === 0) return []
  return value.split('|')
}

function writeChain(hero: CombatHero, key: string, ids: readonly string[]): void {
  setState(hero, key, ids.length === 0 ? null : ids.join('|'))
}

function clearWeaponMaster(hero: CombatHero): void {
  setState(hero, STATE_WEAPON_CHAIN, null)
  setState(hero, STATE_PERFECT_FORM, null)
  setState(hero, STATE_PERFECT_FORM_SKILLS, null)
}

function clearEncounterNodeState(hero: CombatHero): void {
  clearWeaponMaster(hero)
  setState(hero, STATE_FOLLOW_THROUGH, null)
  setState(hero, STATE_DAMAGE_ROLL_FLOOR, null)
  setState(hero, STATE_SHIELD_IMPACT_UNTIL, null)
}

function relevantSkillIds(hero: CombatHero): string[] {
  return [...readChain(hero, STATE_WEAPON_CHAIN), ...readChain(hero, STATE_PERFECT_FORM_SKILLS)]
}

function resetIfUnequipped(hero: CombatHero): void {
  const ids = relevantSkillIds(hero)
  for (const id of ids) {
    if (hero.equippedSkillIds.includes(id)) continue
    clearWeaponMaster(hero)
    return
  }
}

function hasResourceEffect(action: ClassAction): boolean {
  if (action.kind !== 'skill') return false
  for (const effect of action.skill.effects) {
    if (effect.kind === 'resource') return true
  }
  return false
}

function actorById(state: CombatState, id: string): CombatActor | null {
  if (state.hero.id === id) return state.hero
  for (const enemy of state.enemies) {
    if (enemy.id === id) return enemy
  }
  return null
}

function isBleeding(actor: CombatActor): boolean {
  return actor.statuses.bleed !== null && actor.statuses.bleed.stacks.length > 0
}

function followThroughCoefficient(hero: CombatHero, base: number, weaponAction: boolean): number {
  if (!weaponAction || !hasNode(hero, NODE_HEAVY_FOLLOW_THROUGH)) return base
  if (hero.classState[STATE_FOLLOW_THROUGH] !== true) return base
  setState(hero, STATE_FOLLOW_THROUGH, null)
  return base * HEAVY_SPEED_FACTOR
}

function consumePerfectForm(hero: CombatHero, skill: SkillDef): void {
  if (!isWeaponSkill(skill) || !perfectFormReady(hero) || !hasNode(hero, NODE_WEAPON_MASTER)) return
  setState(hero, STATE_PERFECT_FORM, null)
  setState(hero, STATE_PERFECT_FORM_SKILLS, null)
  const bounds = consistencyBounds(hero.consistency)
  const bonus = PERFECT_FORM_ROLL_FLOOR - bounds.floor
  if (bonus > 0) setState(hero, STATE_DAMAGE_ROLL_FLOOR, bonus)
}

function prepareSkill(hero: CombatHero, skill: SkillDef): void {
  const cost = resolvedSkillCost(hero, skill)
  if (cost !== skill.cost) hero.pendingSkillCost = cost
  consumePerfectForm(hero, skill)
  const cooldown = adjustedCooldownSeconds(hero, skill)
  if (cooldown !== skill.cooldownSeconds) hero.pendingCooldownSeconds = cooldown
  const coefficient = followThroughCoefficient(hero, skill.actionTimeCoefficient, isWeaponSkill(skill))
  if (coefficient !== skill.actionTimeCoefficient) hero.pendingActionCoefficient = coefficient
}

function noteWeaponSequence(state: CombatState, action: ClassAction): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_WEAPON_MASTER)) return
  resetIfUnequipped(hero)
  if (action.kind !== 'skill' || !isWeaponSkill(action.skill)) return
  const id = action.skill.id
  if (!hero.equippedSkillIds.includes(id)) {
    clearWeaponMaster(hero)
    return
  }
  const chain = readChain(hero, STATE_WEAPON_CHAIN)
  if (chain.includes(id)) {
    writeChain(hero, STATE_WEAPON_CHAIN, [id])
    return
  }
  const next = [...chain, id]
  if (next.length < PERFECT_FORM_LENGTH) {
    writeChain(hero, STATE_WEAPON_CHAIN, next)
    return
  }
  writeChain(hero, STATE_WEAPON_CHAIN, [])
  setState(hero, STATE_PERFECT_FORM, true)
  writeChain(hero, STATE_PERFECT_FORM_SKILLS, next.slice(0, PERFECT_FORM_LENGTH))
}

function armFollowThrough(state: CombatState, action: ClassAction): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_HEAVY_FOLLOW_THROUGH)) return
  const coefficient = action.kind === 'skill' ? action.skill.actionTimeCoefficient : hero.fillerCoefficient
  if (coefficient < HEAVY_TIME_COEFFICIENT) return
  setState(hero, STATE_FOLLOW_THROUGH, true)
}

function grantBleedingFury(state: CombatState, action: ClassAction, timeMs: number): void {
  if (!hasNode(state.hero, NODE_BLOODLETTING)) return
  if (action.kind === 'basicAttack') {
    if (!action.hit || action.targetId === undefined) return
    const target = actorById(state, action.targetId)
    if (target === null || !isBleeding(target)) return
    grantClassResource(state, timeMs, BLEEDING_TARGET_FURY, 'bleedingTarget')
    return
  }
  for (const strike of action.strikes ?? []) {
    if (!strike.hit) continue
    const target = actorById(state, strike.targetId)
    if (target === null || !isBleeding(target)) continue
    grantClassResource(state, timeMs, BLEEDING_TARGET_FURY, 'bleedingTarget')
  }
}

function applyBloodletting(state: CombatState, action: ClassAction, timeMs: number, defs: GameDefs | undefined): void {
  if (action.kind !== 'skill' || !hasNode(state.hero, NODE_BLOODLETTING)) return
  if (action.skill.id !== DRIVING_BLOW_ID && action.skill.id !== CLEAVE_ID) return
  if (defs === undefined) throw new Error('bloodletting needs combat definitions')
  for (const strike of action.strikes ?? []) {
    if (!strike.hit) continue
    const target = actorById(state, strike.targetId)
    if (target === null) continue
    tryApplyStatus({
      state,
      defs,
      source: state.hero,
      target,
      skill: action.skill,
      effect: {
        kind: 'applyStatus',
        statusId: 'bleed',
        baseChance: BLEED_BASE_CHANCE,
        coefficient: BLEED_POWER_COEFFICIENT,
        power: 'physical',
      },
      timeMs,
      applyingHit: true,
      hpDamageDealt: strike.hpLost ?? 0,
    })
  }
}

function applyShieldImpact(state: CombatState, action: ClassAction, timeMs: number, defs: GameDefs | undefined): void {
  const hero = state.hero
  if (action.kind !== 'skill' || !hasNode(hero, NODE_SHIELD_IMPACT)) return
  if (action.skill.id !== DRIVING_BLOW_ID && action.skill.id !== SUNDERING_BLOW_ID) return
  const until = stateNumber(hero, STATE_SHIELD_IMPACT_UNTIL)
  setState(hero, STATE_SHIELD_IMPACT_UNTIL, null)
  if (until === null || timeMs > until) return
  if (defs === undefined) throw new Error('shield impact needs combat definitions')
  for (const strike of action.strikes ?? []) {
    if (!strike.hit) continue
    const target = actorById(state, strike.targetId)
    if (target === null) continue
    tryApplyStatus({
      state,
      defs,
      source: hero,
      target,
      skill: action.skill,
      effect: { kind: 'applyStatus', statusId: 'stun', baseChance: SHIELD_IMPACT_STUN_CHANCE },
      timeMs,
      applyingHit: true,
      hpDamageDealt: strike.hpLost ?? 0,
    })
  }
}

function encounterStart(state: CombatState, timeMs: number): void {
  const hero = state.hero
  const amount = hero.carryResource && hero.suppliedResource !== null ? hero.suppliedResource : 0
  defineClassResource(state, timeMs, {
    id: FURY_RESOURCE_ID,
    maximum: FURY_MAXIMUM,
    scope: FURY_SCOPE,
    amount,
    regenPerSecond: 0,
  })
}

function encounterEnd(state: CombatState, timeMs: number): void {
  clearEncounterNodeState(state.hero)
  if (state.hero.carryResource) return
  setClassResource(state, timeMs, 0, 'encounterEnd')
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  if (hasNode(hero, NODE_WEAPON_MASTER)) resetIfUnequipped(hero)
  if (action.kind === 'basicAttack') {
    const next = followThroughCoefficient(hero, hero.fillerCoefficient, true)
    if (next !== hero.fillerCoefficient) hero.pendingActionCoefficient = next
    return
  }
  prepareSkill(hero, action.skill)
  if (!action.skill.tags.includes(FURY_SPENDER_TAG)) return
  const amount = hero.classResource
  const multiplier = heroFuryMultiplier(hero, amount)
  hero.classState = { ...hero.classState, [FURY_SNAPSHOT_KEY]: amount }
  state.log.push({
    type: 'resourceSnapshot',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    resourceId: hero.classResourceId,
    amount,
    multiplier,
  })
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number, defs?: GameDefs): void {
  const hero = state.hero
  if (action.kind === 'basicAttack') {
    if (action.hit) {
      const base = normalizeBasicAttackResource(FURY_GENERATOR_BASE, hero.baseActionSeconds)
      grantClassResource(state, timeMs, base, 'basicAttack')
    }
    grantBleedingFury(state, action, timeMs)
    armFollowThrough(state, action)
    noteWeaponSequence(state, action)
    setState(hero, STATE_DAMAGE_ROLL_FLOOR, null)
    clearSnapshot(hero)
    return
  }
  const generates = action.skill.tags.includes(FURY_GENERATOR_TAG) && !hasResourceEffect(action)
  if (generates) grantClassResource(state, timeMs, FURY_GENERATOR_BASE, action.skill.id)
  if (action.skill.id === DRIVING_BLOW_ID && hasNode(hero, NODE_DRIVING_BLOW)) {
    grantClassResource(state, timeMs, DRIVING_BLOW_FURY_BONUS, action.skill.id)
  }
  grantBleedingFury(state, action, timeMs)
  applyBloodletting(state, action, timeMs, defs)
  applyShieldImpact(state, action, timeMs, defs)
  armFollowThrough(state, action)
  noteWeaponSequence(state, action)
  setState(hero, STATE_DAMAGE_ROLL_FLOOR, null)
  clearSnapshot(hero)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  const hero = state.hero
  const furyBefore = hero.classResource
  const lethal = notice.hpLost > 0 && notice.hpBefore - notice.hpLost <= 0
  if (notice.hpLost > 0 && hero.maxHp > 0) {
    const base = (notice.hpLost / hero.maxHp) * 100 * FURY_HP_PERCENT_BASE
    grantClassResource(state, notice.timeMs, base, 'hpLoss', FURY_HIT_GAIN_CAP)
  }
  if (notice.kind === 'hit' && hero.damageReduction > 0) {
    grantClassResource(state, notice.timeMs, FURY_BRACE_HIT_BASE, 'shieldBrace')
  }
  if (
    hasNode(hero, NODE_UNBROKEN) &&
    hero.classState[STATE_UNBROKEN_USED] !== true &&
    furyBefore >= UNBROKEN_LETHAL_FURY &&
    lethal
  ) {
    hero.hp = 1
    setState(hero, STATE_UNBROKEN_USED, true)
    setClassResource(state, notice.timeMs, 0, 'unbroken')
  }
  if (notice.kind === 'hit' && hero.damageReduction > 0 && hasNode(hero, NODE_SHIELD_IMPACT)) {
    setState(hero, STATE_SHIELD_IMPACT_UNTIL, notice.timeMs + SHIELD_IMPACT_WINDOW_MS)
  }
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  if (query.school !== 'physical') return 1
  const snapped = snapshotAmount(state.hero)
  const fury = snapped === null ? state.hero.classResource : snapped
  return heroFuryMultiplier(state.hero, fury)
}

function incomingModifiers(state: CombatState, _query: OutgoingModifierQuery): number {
  const hero = state.hero
  let factor = 1
  if (hasNode(hero, NODE_BERSERKER)) factor *= BERSERKER_INCOMING
  if (hasNode(hero, NODE_UNBROKEN)) {
    const reduction = UNBROKEN_REDUCTION_AT_FULL * (hero.classResource / FURY_MAXIMUM)
    factor *= 1 - reduction
  }
  return factor
}

export const warriorClass: ClassModule = {
  encounterStart,
  encounterEnd,
  actionChosen,
  actionResolved,
  damageTaken,
  outgoingModifiers,
  incomingModifiers,
}
