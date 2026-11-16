import { useSyncExternalStore } from 'react'

import type { CombatState } from '../../sim/types.ts'
import { getSnapshot, subscribe } from '../store.ts'

import { ruleFireCounts, type FireCounts } from './chainModel.ts'

/** The counts for one hero in one combat, or null when there is nothing to count. Pure, so it is testable. */
export function countsFor(combat: CombatState, heroId: string): FireCounts | null {
  if (combat.hero.id !== heroId || combat.log.length === 0) return null
  return ruleFireCounts(combat.log, heroId)
}

let cached: { combat: CombatState; length: number; heroId: string; value: FireCounts | null } | null = null

function snapshotFor(heroId: string): FireCounts | null {
  const { combat } = getSnapshot()
  const length = combat.log.length
  if (cached !== null && cached.combat === combat && cached.length === length && cached.heroId === heroId) return cached.value
  cached = { combat, length, heroId, value: countsFor(combat, heroId) }
  return cached.value
}

/**
 * How often each rule fired in the fight now on screen, for the selected hero. Null when no fight with that hero is
 * logged. Recomputed only when the log grows, not on every frame. Counts follow the rows as they were when they
 * fired, so reordering rules mid-fight shifts them.
 */
export function useFireCounts(heroId: string): FireCounts | null {
  return useSyncExternalStore(subscribe, () => snapshotFor(heroId), () => null)
}
