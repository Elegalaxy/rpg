import { skillAffordable, skillOffCooldown } from '../skills.ts'
import { pushActorTiming, tryApplyStatus } from '../statuses.ts'
import type {
  ApplyStatusEffect,
  ClassAction,
  ClassModule,
  CombatActor,
  CombatHero,
  CombatState,
  DamageNotice,
  FallbackDecision,
  GameDefs,
  OutgoingModifierQuery,
} from '../types.ts'
import {
  AEGIS_SKILL_ID,
  ARCANE_BOLT_NODE_COEFFICIENT,
  ARCANE_BOLT_SKILL_ID,
  NODE_ARCANE_BOLT,
  ARCANE_RECOVERY_NODE_COOLDOWN_SECONDS,
  ARCANE_RECOVERY_SKILL_ID,
  CONVERGENCE_RECIPES,
  NODE_ARCANE_RECOVERY,
  NODE_ELEMENTAL_CONVERGENCE,
  NODE_GRAND_GRIMOIRE,
  NODE_REHEARSED_CASTING,
  OVERCAST_DAMAGE_CAP,
  OVERCAST_DAMAGE_PER_MANA,
  REHEARSAL_COOLDOWN_MS,
  REHEARSAL_DAMAGE,
  REHEARSAL_LENGTH,
  STATE_AEGIS_EXPIRES,
  STATE_INVOKED,
  STATE_OVERCAST_BONUS,
  STATE_RECOVERY_CHARGE,
  STATE_REHEARSAL,
  STATE_REHEARSAL_ACTIVE,
  STATE_SEQUENCE,
  THERMAL_BONUS_COEFFICIENT,
  THERMAL_DELAY_MS,
  THERMAL_RUPTURE_SKILL_ID,
  chargeMaxima,
  chargeMaxOf,
  chargesOf,
  choosePreparedSpells,
  elementOf,
  hasNode,
  isConvergenceSkill,
  manaRegenFactor,
  parseChargeMap,
  planPayment,
  preparedSpellsOf,
  restoreChargeText,
  setClassState,
  stateNumber,
  stateString,
  writeCharges,
  STATE_CHARGES,
  STATE_CHARGE_MAX,
  STATE_PREPARED,
} from './mageAdjust.ts'
import { defineClassResource } from './resources.ts'

export const MANA_RESOURCE_ID = 'mana'
export const MANA_MAXIMUM = 100
export const MANA_SCOPE = 'expedition' as const
export const MANA_REGEN_PER_SECOND = 2
/** Travel and other time outside combat. Spirit applies. Combat keeps the slower rate. */
export const MANA_TRAVEL_REGEN_PER_SECOND = 5
export const ARCANE_BOLT_ID = 'arcane-bolt'
export const MAGE_WAIT_REASON = 'nothing is affordable'

function startCharges(hero: CombatHero): void {
  const prepared = choosePreparedSpells(hero)
  const maxima = chargeMaxima(hero, prepared)
  setClassState(hero, STATE_PREPARED, JSON.stringify(prepared))
  setClassState(hero, STATE_CHARGE_MAX, JSON.stringify(maxima))
  const supplied = parseChargeMap(hero.suppliedMageCharges)
  const charges: { [key: string]: number } = {}
  for (const key of Object.keys(maxima)) {
    const max = maxima[key] ?? 0
    const carried = supplied[key]
    charges[key] = carried === undefined ? max : carried > max ? max : carried
  }
  if (Object.keys(maxima).length > 0) writeCharges(hero, charges)
}

function encounterStart(state: CombatState, timeMs: number): void {
  const hero = state.hero
  const amount = hero.carryResource && hero.suppliedResource !== null ? hero.suppliedResource : MANA_MAXIMUM
  defineClassResource(state, timeMs, {
    id: MANA_RESOURCE_ID,
    maximum: MANA_MAXIMUM,
    scope: MANA_SCOPE,
    amount,
    regenPerSecond: MANA_REGEN_PER_SECOND * manaRegenFactor(hero.allocatedNodeIds),
  })
  startCharges(hero)
}

function encounterEnd(state: CombatState): void {
  const hero = state.hero
  setClassState(hero, STATE_SEQUENCE, null)
  setClassState(hero, STATE_INVOKED, null)
  setClassState(hero, STATE_OVERCAST_BONUS, null)
  setClassState(hero, STATE_REHEARSAL_ACTIVE, null)
  setClassState(hero, STATE_RECOVERY_CHARGE, null)
  hero.pendingCoefficient = null
}

/** Arcane Bolt is innate. It is not equipped and does not take a loadout slot. */
function fallbackAction(state: CombatState, defs: GameDefs, timeMs: number): FallbackDecision {
  const skill = defs.skills[ARCANE_BOLT_ID]
  if (skill === undefined) {
    throw new Error(`mage fallback skill '${ARCANE_BOLT_ID}' is not defined`)
  }
  if (skillAffordable(state.hero, skill) && skillOffCooldown(state.hero, skill, timeMs)) {
    return { kind: 'skill', skillId: skill.id }
  }
  return { kind: 'wait', reason: MAGE_WAIT_REASON }
}

function spendCharge(hero: CombatHero, key: string): void {
  const charges = chargesOf(hero)
  const have = charges[key] ?? 0
  if (have <= 0) throw new Error(`mage has no charge for '${key}'`)
  charges[key] = have - 1
  writeCharges(hero, charges)
}

function restoreOneCharge(hero: CombatHero): boolean {
  const before = stateString(hero, STATE_CHARGES)
  const after = restoreChargeText(before, stateString(hero, STATE_CHARGE_MAX), 1)
  if (after === null || after === before) return false
  setClassState(hero, STATE_CHARGES, after)
  return true
}

function hasExpendedCharge(hero: CombatHero): boolean {
  const charges = chargesOf(hero)
  const maxima = chargeMaxOf(hero)
  for (const key of Object.keys(maxima)) {
    if ((charges[key] ?? 0) < (maxima[key] ?? 0)) return true
  }
  return false
}

function targetOf(state: CombatState, action: ClassAction): CombatActor | null {
  if (action.kind !== 'skill' || action.targetId === undefined) return null
  return state.enemies.find((enemy) => enemy.id === action.targetId) ?? null
}

/** Thermal Rupture consumes one Burn intensity and one Chill stack for +50% and a 1 second delay. */
function primeThermalRupture(state: CombatState, target: CombatActor | null, timeMs: number): void {
  if (target === null) return
  const burn = target.statuses.burn
  const chill = target.statuses.chill
  if (burn === null || chill === null) return
  burn.intensity -= 1
  if (burn.intensity <= 0) target.statuses.burn = null
  chill.stacks -= 1
  if (chill.stacks <= 0) target.statuses.chill = null
  state.hero.pendingCoefficient = THERMAL_BONUS_COEFFICIENT
  pushActorTiming(target, THERMAL_DELAY_MS)
  state.log.push({
    type: 'actionDelay',
    timeMs,
    actorId: state.hero.id,
    actorName: state.hero.name,
    targetId: target.id,
    targetName: target.name,
    delayMs: THERMAL_DELAY_MS,
    nextReadyMs: target.nextReadyMs,
  })
}

function payForSkill(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind !== 'skill') return
  const hero = state.hero
  const skill = action.skill
  const plan = planPayment(hero, skill)
  if (plan.kind === 'blocked') {
    throw new Error(`${hero.name} cannot pay ${skill.name}: ${plan.reason}`)
  }
  if (plan.kind === 'charge') {
    spendCharge(hero, plan.key)
    hero.pendingSkillCost = 0
  } else if (plan.kind === 'mana') {
    if (plan.cost !== skill.cost) hero.pendingSkillCost = plan.cost
  } else if (plan.kind === 'overcast') {
    hero.pendingSkillCost = plan.cost
    const hpBefore = hero.hp
    hero.hp = hpBefore - plan.hpLoss
    state.log.push({
      type: 'hpLoss',
      timeMs,
      actorId: hero.id,
      actorName: hero.name,
      skillId: skill.id,
      amount: plan.hpLoss,
      hpBefore,
      hpAfter: hero.hp,
      barrierBypassed: true,
      defenseBypassed: true,
    })
    const bonus = plan.missing * OVERCAST_DAMAGE_PER_MANA
    setClassState(hero, STATE_OVERCAST_BONUS, bonus > OVERCAST_DAMAGE_CAP ? OVERCAST_DAMAGE_CAP : bonus)
  }
}

function noteRehearsal(hero: CombatHero, skillId: string): void {
  if (!hasNode(hero, NODE_REHEARSED_CASTING)) return
  if (!preparedSpellsOf(hero).includes(skillId)) return
  const stored = stateString(hero, STATE_REHEARSAL)
  let sequence = stored === null || stored.length === 0 ? [] : stored.split(',')
  const repeat = sequence.indexOf(skillId)
  if (repeat !== -1) sequence = sequence.slice(repeat + 1)
  sequence.push(skillId)
  if (sequence.length >= REHEARSAL_LENGTH) {
    setClassState(hero, STATE_REHEARSAL_ACTIVE, true)
    setClassState(hero, STATE_REHEARSAL, null)
    return
  }
  setClassState(hero, STATE_REHEARSAL, sequence.join(','))
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind !== 'skill') return
  const hero = state.hero
  const skill = action.skill
  if (skill.id === ARCANE_RECOVERY_SKILL_ID) {
    if (hasNode(hero, NODE_ARCANE_RECOVERY)) {
      hero.pendingCooldownSeconds = ARCANE_RECOVERY_NODE_COOLDOWN_SECONDS
    }
    if (hasNode(hero, NODE_GRAND_GRIMOIRE) && hasExpendedCharge(hero) && restoreOneCharge(hero)) {
      setClassState(hero, STATE_RECOVERY_CHARGE, true)
    }
  }
  if (skill.id === ARCANE_BOLT_SKILL_ID && hasNode(hero, NODE_ARCANE_BOLT)) {
    hero.pendingCoefficient = ARCANE_BOLT_NODE_COEFFICIENT
  }
  noteRehearsal(hero, skill.id)
  payForSkill(state, action, timeMs)
  if (skill.id === THERMAL_RUPTURE_SKILL_ID) primeThermalRupture(state, targetOf(state, action), timeMs)
}

function updateSequence(hero: CombatHero, skillId: string, element: string): void {
  const stored = stateString(hero, STATE_SEQUENCE)
  let sequence = stored === null || stored.length === 0 ? [] : stored.split('>')
  const repeat = sequence.indexOf(element)
  if (repeat !== -1) sequence = []
  sequence.push(element)
  if (sequence.length === 3) {
    const invoked = CONVERGENCE_RECIPES[sequence.join('>')]
    if (invoked === undefined) throw new Error(`no Convergence recipe for ${sequence.join('>')} after ${skillId}`)
    setClassState(hero, STATE_INVOKED, invoked)
    setClassState(hero, STATE_SEQUENCE, null)
    return
  }
  setClassState(hero, STATE_SEQUENCE, sequence.join('>'))
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind !== 'skill') return
  const hero = state.hero
  const skill = action.skill
  if (isConvergenceSkill(skill.id)) {
    setClassState(hero, STATE_INVOKED, null)
    if (skill.id === AEGIS_SKILL_ID) setClassState(hero, STATE_AEGIS_EXPIRES, hero.barrierExpiresMs)
  } else if (hasNode(hero, NODE_ELEMENTAL_CONVERGENCE)) {
    const element = elementOf(skill)
    if (element !== null) updateSequence(hero, skill.id, element)
  }
  if (hero.classState[STATE_REHEARSAL_ACTIVE] === true) {
    const readyAt = hero.cooldowns[skill.id]
    if (readyAt !== undefined) {
      const reduced = readyAt - REHEARSAL_COOLDOWN_MS
      hero.cooldowns[skill.id] = reduced < timeMs ? timeMs : reduced
    }
  }
  setClassState(hero, STATE_OVERCAST_BONUS, null)
  setClassState(hero, STATE_REHEARSAL_ACTIVE, null)
  setClassState(hero, STATE_RECOVERY_CHARGE, null)
  hero.pendingCoefficient = null
}

function applyAegisStatus(state: CombatState, defs: GameDefs, enemy: CombatActor, statusId: string, timeMs: number): void {
  const skill = defs.skills[AEGIS_SKILL_ID]
  if (skill === undefined) throw new Error(`skill '${AEGIS_SKILL_ID}' is not defined`)
  const effect: ApplyStatusEffect =
    statusId === 'burn'
      ? { kind: 'applyStatus', statusId, baseChance: 1, coefficient: 0.12, power: 'magical' }
      : { kind: 'applyStatus', statusId, baseChance: 1 }
  tryApplyStatus({
    state,
    defs,
    source: state.hero,
    target: enemy,
    skill,
    effect,
    timeMs,
    applyingHit: false,
    hpDamageDealt: 0,
  })
}

/** Stormglass Aegis: the next enemy that breaks the barrier gains one Burn and one Chill. */
function damageTaken(state: CombatState, notice: DamageNotice, defs?: GameDefs): void {
  const hero = state.hero
  const expires = stateNumber(hero, STATE_AEGIS_EXPIRES)
  if (expires === null || defs === undefined) return
  if (notice.kind !== 'hit' || notice.sourceId === undefined) return
  if ((notice.barrierAbsorbed ?? 0) <= 0 || hero.barrier > 0) return
  if (hero.barrierExpiresMs !== expires || notice.timeMs >= expires) {
    setClassState(hero, STATE_AEGIS_EXPIRES, null)
    return
  }
  setClassState(hero, STATE_AEGIS_EXPIRES, null)
  const enemy = state.enemies.find((candidate) => candidate.id === notice.sourceId)
  if (enemy === undefined || !enemy.alive) return
  applyAegisStatus(state, defs, enemy, 'burn', notice.timeMs)
  applyAegisStatus(state, defs, enemy, 'chill', notice.timeMs)
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  if (query.skill === null || query.school === 'healing') return 1
  const hero = state.hero
  let factor = 1
  const overcast = stateNumber(hero, STATE_OVERCAST_BONUS)
  if (overcast !== null && overcast > 0) factor *= 1 + overcast
  if (hero.classState[STATE_REHEARSAL_ACTIVE] === true) factor *= REHEARSAL_DAMAGE
  return factor
}

export const mageClass: ClassModule = {
  encounterStart,
  encounterEnd,
  actionChosen,
  actionResolved,
  damageTaken,
  outgoingModifiers,
  fallbackAction,
}
