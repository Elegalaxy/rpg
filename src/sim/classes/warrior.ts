import type { ClassAction, ClassModule, CombatHero, CombatState, DamageNotice, OutgoingModifierQuery } from '../types.ts'
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

/** `1 + 0.25 × (Fury / 100)`. Magical damage does not use this. */
export function furyPhysicalMultiplier(fury: number): number {
  return 1 + FURY_PHYSICAL_BONUS_AT_FULL * (fury / FURY_MAXIMUM)
}

function snapshotAmount(hero: CombatHero): number | null {
  const amount = hero.classState[FURY_SNAPSHOT_KEY]
  if (typeof amount !== 'number') return null
  return amount
}

function clearSnapshot(hero: CombatHero): void {
  if (hero.classState[FURY_SNAPSHOT_KEY] === undefined) return
  const next: CombatHero['classState'] = {}
  const keys = Object.keys(hero.classState)
  for (const key of keys) {
    if (key === FURY_SNAPSHOT_KEY) continue
    const value = hero.classState[key]
    if (value !== undefined) next[key] = value
  }
  hero.classState = next
}

function hasResourceEffect(action: ClassAction): boolean {
  if (action.kind !== 'skill') return false
  for (const effect of action.skill.effects) {
    if (effect.kind === 'resource') return true
  }
  return false
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
  if (state.hero.carryResource) return
  setClassResource(state, timeMs, 0, 'encounterEnd')
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind !== 'skill') return
  if (!action.skill.tags.includes(FURY_SPENDER_TAG)) return
  const hero = state.hero
  const amount = hero.classResource
  const multiplier = furyPhysicalMultiplier(amount)
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

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  if (action.kind === 'basicAttack') {
    if (action.hit) {
      const base = normalizeBasicAttackResource(FURY_GENERATOR_BASE, hero.baseActionSeconds)
      grantClassResource(state, timeMs, base, 'basicAttack')
    }
    clearSnapshot(hero)
    return
  }
  const generates = action.skill.tags.includes(FURY_GENERATOR_TAG) && !hasResourceEffect(action)
  if (generates) grantClassResource(state, timeMs, FURY_GENERATOR_BASE, action.skill.id)
  clearSnapshot(hero)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  const hero = state.hero
  if (notice.hpLost > 0 && hero.maxHp > 0) {
    const base = (notice.hpLost / hero.maxHp) * 100 * FURY_HP_PERCENT_BASE
    grantClassResource(state, notice.timeMs, base, 'hpLoss', FURY_HIT_GAIN_CAP)
  }
  if (notice.kind === 'hit' && hero.damageReduction > 0) {
    grantClassResource(state, notice.timeMs, FURY_BRACE_HIT_BASE, 'shieldBrace')
  }
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  if (query.school !== 'physical') return 1
  const snapped = snapshotAmount(state.hero)
  const fury = snapped === null ? state.hero.classResource : snapped
  return furyPhysicalMultiplier(fury)
}

export const warriorClass: ClassModule = {
  encounterStart,
  encounterEnd,
  actionChosen,
  actionResolved,
  damageTaken,
  outgoingModifiers,
}
