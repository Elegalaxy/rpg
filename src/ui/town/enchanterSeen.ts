/** Which Enchanter recipes the player has already seen. Local UI state only; never part of the save. */

import { useSyncExternalStore } from 'react'

import { selectedHero } from '../../persist/character.ts'
import { recipesForSale } from '../../persist/crafting.ts'
import type { SaveData } from '../../persist/save.ts'
import { ITEM_MODIFIERS } from '../../sim/economy.ts'

const KEY = 'rpg.enchanterSeen'

export function readSeenRecipes(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw === null || raw === undefined) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function writeSeenRecipes(ids: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Storage can be blocked; the badge then simply shows again next visit.
  }
}

let seen: readonly string[] = readSeenRecipes()
const listeners = new Set<() => void>()

/** Mark recipes as seen and tell the screens that show the badge. */
export function markRecipesSeen(ids: readonly string[]): void {
  const fresh = ids.filter((id) => !seen.includes(id))
  if (fresh.length === 0) return
  seen = [...seen, ...fresh]
  writeSeenRecipes(seen)
  for (const listener of listeners) listener()
}

export function useSeenRecipes(): readonly string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => seen,
    () => seen,
  )
}

/** Recipes for sale that this hero can learn now (unlocked, level reached) and has not been shown yet. */
export function newRecipeIds(save: SaveData, seenIds: readonly string[]): string[] {
  const level = selectedHero(save)?.progress.level ?? 1
  return recipesForSale(save)
    .filter((entry) => entry.locked === null && (ITEM_MODIFIERS[entry.modifierId]?.minLevel ?? Infinity) <= level && !seenIds.includes(entry.modifierId))
    .map((entry) => entry.modifierId)
}
