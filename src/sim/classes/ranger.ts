import type { ClassAction, ClassModule, CombatState } from '../types.ts'
import { defineClassResource, grantClassResource, normalizeBasicAttackResource } from './resources.ts'

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
export const MISSING_SPECIAL_ARROW_REASON = 'missing special arrow'

function encounterStart(state: CombatState, timeMs: number): void {
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
  if (hero.suppliedAmmo === null) {
    hero.specialAmmo = QUIVER_CAPACITY
  } else if (hero.specialAmmo > QUIVER_CAPACITY) {
    hero.specialAmmo = QUIVER_CAPACITY
  }
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind !== 'basicAttack' || !action.hit) return
  const base = normalizeBasicAttackResource(READINESS_BASIC_BASE, state.hero.baseActionSeconds)
  grantClassResource(state, timeMs, base, 'basicAttack')
}

export const rangerClass: ClassModule = {
  encounterStart,
  actionResolved,
}
