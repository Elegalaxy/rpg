import { SMOKE_BOMB_ID } from '../sim/expedition.ts'
import type { PriorityRow } from '../sim/types.ts'

/** One supply Greyhaven sells. A rule supply is also a skill with `supply: true`. */
export type SupplyDef = {
  id: string
  name: string
  /** Gold for one, paid from the hero's purse. */
  price: number
  /** Short text for the shop and the packing screen. */
  effect: string
  /** True when a priority rule uses it. False when the expedition uses it by itself. */
  ruleUsed: boolean
}

/** The first-playable supplies (GAME_DESIGN §9 Inventory, decided 2026-11-03), in shop order. */
export const SUPPLIES: readonly SupplyDef[] = [
  { id: 'healing-draught', name: 'Healing Draught', price: 15, effect: 'Restores 30% of maximum HP.', ruleUsed: true },
  { id: 'antidote', name: 'Antidote', price: 10, effect: 'Removes all Poison and Bleed from the hero.', ruleUsed: true },
  {
    id: SMOKE_BOMB_ID,
    name: 'Smoke Bomb',
    price: 20,
    effect: '+15 points on the next escape roll, then used up.',
    ruleUsed: false,
  },
]

export const supplyTable: { readonly [id: string]: SupplyDef } = Object.fromEntries(SUPPLIES.map((supply) => [supply.id, supply]))

export function supplyName(id: string): string {
  return supplyTable[id]?.name ?? id
}

/** Supplies a priority rule can name. */
export const RULE_SUPPLY_IDS: readonly string[] = SUPPLIES.filter((supply) => supply.ruleUsed).map((supply) => supply.id)

/** The supply rules a new hero starts with, above the class rules. Without a supply in the slots they skip. */
export const DEFAULT_SUPPLY_ROWS: readonly PriorityRow[] = [
  { skillId: 'healing-draught', conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }] },
  {
    skillId: 'antidote',
    conditions: [{ kind: 'status', who: 'hero', statusId: 'poison', measure: 'stacks', operator: 'atLeast', value: 3 }],
  },
]

/** A hero's starting rules: the supply rules, then the class rules. */
export function startingRules(classRows: readonly PriorityRow[]): PriorityRow[] {
  return [...DEFAULT_SUPPLY_ROWS, ...classRows].map((row) => ({
    ...row,
    ...(row.conditions === undefined ? {} : { conditions: row.conditions.map((condition) => ({ ...condition })) }),
  }))
}
