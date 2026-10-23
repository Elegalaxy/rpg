import type { ClassAction, ClassModule, CombatActor, CombatState, DamageNotice } from '../types.ts'
import { defineClassResource, spiritResourceFactor } from './resources.ts'

export const ADVANTAGE_RESOURCE_ID = 'advantage'
export const ADVANTAGE_MAXIMUM = 5
export const ADVANTAGE_SCOPE = 'encounter' as const
/** One qualifying action. Spirit applies. Weapon time does not. */
export const ADVANTAGE_GAIN_BASE = 1
export const EXECUTE_STACK_BONUS = 0.4
export const EXECUTE_MISSING_HEALTH_BONUS = 0.5
export const MARK_REFRESH_FLOOR_MS = 8000
export const MARK_REMAINING_CAP_MS = 12000
/** Skill text that references Mark. In this step only Shadow Cut uses it. */
export const MARK_EXPLOIT_TAG = 'markExploit'
export const EXECUTE_TAG = 'execute'

/** `(1 + 0.4 × stacks) × (1 + 0.5 × missing-health fraction)`. That product is the hit coefficient. */
export function executeCoefficient(stacks: number, missingHealthFraction: number): number {
  return (1 + EXECUTE_STACK_BONUS * stacks) * (1 + EXECUTE_MISSING_HEALTH_BONUS * missingHealthFraction)
}

function actorById(state: CombatState, id: string): CombatActor | null {
  if (state.hero.id === id) return state.hero
  for (const enemy of state.enemies) {
    if (enemy.id === id) return enemy
  }
  return null
}

function logAdvantage(
  state: CombatState,
  timeMs: number,
  reason: string,
  base: number,
  multiplier: number,
  generated: number,
  before: number,
  after: number,
  fractionBefore: number,
  fractionAfter: number,
): void {
  const hero = state.hero
  state.log.push({
    type: 'resource',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    resourceId: hero.classResourceId,
    scope: hero.classResourceScope,
    reason,
    base,
    multiplier,
    generated,
    gainCap: null,
    before,
    after,
    maximum: hero.classResourceMax,
    fractionBefore,
    fractionAfter,
  })
}

/**
 * Add one Advantage credit, then convert at most one whole stack.
 * At 5 stacks, discard further whole stacks and keep only the fraction below 1.
 */
function grantAdvantage(state: CombatState, timeMs: number, reason: string): void {
  const hero = state.hero
  const multiplier = spiritResourceFactor(hero.spirit)
  const credit = ADVANTAGE_GAIN_BASE * multiplier
  const before = hero.classResource
  const fractionBefore = hero.resourceFraction
  let stacks = before
  let fraction = fractionBefore + credit
  if (stacks < ADVANTAGE_MAXIMUM && fraction >= 1) {
    stacks += 1
    fraction -= 1
  }
  if (stacks >= ADVANTAGE_MAXIMUM) fraction -= Math.floor(fraction)
  hero.classResource = stacks
  hero.resourceFraction = fraction
  logAdvantage(state, timeMs, reason, ADVANTAGE_GAIN_BASE, multiplier, credit, before, stacks, fractionBefore, fraction)
}

function refreshMarkedTarget(state: CombatState, target: CombatActor, timeMs: number): void {
  const mark = target.statuses.mark
  if (mark === null || mark.expiresMs === null) return
  const remaining = mark.expiresMs - timeMs
  let next = remaining
  if (next < MARK_REFRESH_FLOOR_MS) next = MARK_REFRESH_FLOOR_MS
  if (next > MARK_REMAINING_CAP_MS) next = MARK_REMAINING_CAP_MS
  mark.expiresMs = timeMs + next
  state.log.push({
    type: 'markRefresh',
    timeMs,
    actorId: state.hero.id,
    actorName: state.hero.name,
    targetId: target.id,
    targetName: target.name,
    remainingMs: remaining,
    nextRemainingMs: next,
    expiresMs: mark.expiresMs,
  })
}

function missingHealthFraction(target: CombatActor): number {
  if (target.maxHp <= 0) {
    throw new Error(`${target.name} has no maximum HP for Execute`)
  }
  return (target.maxHp - target.hp) / target.maxHp
}

function encounterStart(state: CombatState, timeMs: number): void {
  state.hero.resourceFraction = 0
  state.hero.pendingCoefficient = null
  defineClassResource(state, timeMs, {
    id: ADVANTAGE_RESOURCE_ID,
    maximum: ADVANTAGE_MAXIMUM,
    scope: ADVANTAGE_SCOPE,
    amount: 0,
    regenPerSecond: 0,
  })
}

function encounterEnd(state: CombatState, timeMs: number): void {
  const hero = state.hero
  const before = hero.classResource
  const fractionBefore = hero.resourceFraction
  hero.classResource = 0
  hero.resourceFraction = 0
  hero.pendingCoefficient = null
  if (before === 0 && fractionBefore === 0) return
  logAdvantage(state, timeMs, 'encounterEnd', 0, 1, -before, before, 0, fractionBefore, 0)
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  if (action.kind !== 'skill' || !action.skill.tags.includes(EXECUTE_TAG)) {
    hero.pendingCoefficient = null
    return
  }
  if (action.targetId === undefined) throw new Error('Execute requires a target')
  const target = actorById(state, action.targetId)
  if (target === null) throw new Error(`Execute target '${action.targetId}' is not in the encounter`)
  const stacks = hero.classResource
  const fraction = hero.resourceFraction
  const missing = missingHealthFraction(target)
  hero.pendingCoefficient = executeCoefficient(stacks, missing)
  hero.classResource = 0
  logAdvantage(state, timeMs, 'execute', stacks, 1, -stacks, stacks, 0, fraction, fraction)
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  let crit = false
  let exploited = false
  const refreshTargets: CombatActor[] = []
  if (action.kind === 'basicAttack') {
    crit = action.hit && action.crit === true
    if (action.hit && action.targetId !== undefined) {
      const target = actorById(state, action.targetId)
      if (target !== null) refreshTargets.push(target)
    }
  } else {
    const marked: CombatActor[] = []
    for (const strike of action.strikes ?? []) {
      if (!strike.hit) continue
      if (strike.crit) crit = true
      const target = actorById(state, strike.targetId)
      if (target === null) continue
      refreshTargets.push(target)
      if (target.statuses.mark !== null) marked.push(target)
    }
    if (action.skill.tags.includes(MARK_EXPLOIT_TAG) && marked.length > 0) exploited = true
  }
  for (const target of refreshTargets) refreshMarkedTarget(state, target, timeMs)
  if (crit || exploited) {
    const reason = crit && exploited ? 'criticalAndMark' : crit ? 'critical' : 'mark'
    grantAdvantage(state, timeMs, reason)
  }
  state.hero.pendingCoefficient = null
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  if (notice.kind !== 'miss') return
  grantAdvantage(state, notice.timeMs, 'evasion')
}

export const assassinClass: ClassModule = {
  encounterStart,
  encounterEnd,
  actionChosen,
  actionResolved,
  damageTaken,
}
