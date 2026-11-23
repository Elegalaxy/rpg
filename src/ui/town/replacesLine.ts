import { ITEM_MODIFIERS, modifierRankAt, rankName, type ItemInstance } from '../../sim/economy.ts'

/** What a re-infuse throws away: the second modifier with its rank, and what replaces it. */
export function replacesLine(item: ItemInstance, newId: string): string | null {
  const oldId = item.modifiers[1]
  if (oldId === undefined) return null
  const rank = modifierRankAt(item, 1)
  const old = `${ITEM_MODIFIERS[oldId]?.name ?? oldId}${rank > 1 ? ` ${rankName(rank)}` : ''}`
  return `${old} → ${ITEM_MODIFIERS[newId]?.name ?? newId}`
}
