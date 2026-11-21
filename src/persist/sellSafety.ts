import type { ItemInstance } from '../sim/economy.ts'

/**
 * Safe selling (Step 13.44, GAME_DESIGN "Safe selling"). Pure: which group a piece of gear belongs to in the Sell list and
 * the archive, and whether selling it needs a second click. Selling itself is unchanged (`sellItem`).
 */

/** Quality at or above this was improved on purpose: starter and shop gear is exactly 1, a craft or upgrade can go to 1.2. */
export const RISKY_QUALITY = 1.05

export type SellGroup = 'worn' | 'heirloom' | 'earlier' | 'current'

/** Display order: Worn, then the groups most likely to be regretted, then the rest. */
export const SELL_GROUP_ORDER: readonly SellGroup[] = ['worn', 'heirloom', 'earlier', 'current']

export const SELL_GROUP_LABELS: { [group in SellGroup]: string } = {
  worn: 'Worn',
  heirloom: 'Heirlooms and kept gear',
  earlier: 'Earlier lives',
  current: 'Current life',
}

/** The reason an heirloom cannot be sold, shared with `sellItem`'s refusal. */
export const HEIRLOOM_SELL_REASON = 'An heirloom cannot be sold.'

export function isHeirloom(item: ItemInstance): boolean {
  return item.heirloom !== undefined
}

/** Which group a piece is shown in. Worn pieces are always in Worn; their badge still says heirloom or earlier life. */
export function sellGroup(item: ItemInstance, worn: boolean, earlierIds: ReadonlySet<string>): SellGroup {
  if (worn) return 'worn'
  if (isHeirloom(item)) return 'heirloom'
  if (earlierIds.has(item.id)) return 'earlier'
  return 'current'
}

/** The group a piece belongs to ignoring whether it is worn, for its badge. */
export function badgeGroup(item: ItemInstance, earlierIds: ReadonlySet<string>): SellGroup {
  return sellGroup(item, false, earlierIds)
}

/**
 * Whether selling needs a second click: an heirloom (also blocked), gear from an earlier life, or a piece with a modifier,
 * a socket or quality at or above `RISKY_QUALITY`. Plain current-life gear sells with one click.
 */
export function needsSellConfirm(item: ItemInstance, earlierIds: ReadonlySet<string>): boolean {
  if (isHeirloom(item)) return true
  if (earlierIds.has(item.id)) return true
  return item.modifiers.length > 0 || item.socketed === true || item.quality >= RISKY_QUALITY
}
