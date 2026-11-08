import { SMOKE_BOMB_ID } from '../sim/expedition.ts'
import type { ModifierRequirement } from '../sim/economy.ts'
import type { PriorityRow } from '../sim/types.ts'

/** One supply Greyhaven sells. A rule supply is also a skill with `supply: true`. */
export type SupplyDef = {
  id: string
  name: string
  /** Gold for one, paid from the hero's purse. Null when Greyhaven does not sell it (brew only). */
  price: number | null
  /** Short text for the shop and the packing screen. */
  effect: string
  /** True when a priority rule uses it. False when the expedition uses it by itself. */
  ruleUsed: boolean
  /** Brewing one at the Potion Shop from the hero's own materials (decided 2026-11-04). */
  brew: { materialId: string; quantity: number; gold: number }
  /** What the account must have done before this can be brewed. Absent means open. */
  requires?: ModifierRequirement
}

/** The first-playable supplies (GAME_DESIGN §9 Inventory, decided 2026-11-03), in shop order. */
export const SUPPLIES: readonly SupplyDef[] = [
  {
    id: 'healing-draught',
    name: 'Healing Draught',
    price: 15,
    effect: 'Restores 30% of maximum HP.',
    ruleUsed: true,
    brew: { materialId: 'hide', quantity: 3, gold: 5 },
  },
  {
    id: 'antidote',
    name: 'Antidote',
    price: 10,
    effect: 'Removes all Poison and Bleed from the hero.',
    ruleUsed: true,
    brew: { materialId: 'shard', quantity: 2, gold: 3 },
  },
  {
    id: SMOKE_BOMB_ID,
    name: 'Smoke Bomb',
    price: 20,
    effect: '+15 points on the next escape roll, then used up.',
    ruleUsed: false,
    brew: { materialId: 'scrap', quantity: 3, gold: 8 },
  },
  {
    id: 'ward-charm',
    name: 'Ward Charm',
    price: 20,
    effect: 'A barrier of 20% of maximum HP for 8 seconds.',
    ruleUsed: true,
    brew: { materialId: 'shard', quantity: 3, gold: 8 },
  },
  {
    id: 'warming-tonic',
    name: 'Warming Tonic',
    price: 12,
    effect: 'Removes all Chill and Burn, and restores 10% of maximum HP.',
    ruleUsed: true,
    brew: { materialId: 'hide', quantity: 2, gold: 4 },
  },
  {
    id: 'greater-draught',
    name: 'Greater Draught',
    price: null,
    effect: 'Restores 50% of maximum HP.',
    ruleUsed: true,
    brew: { materialId: 'riftglass', quantity: 2, gold: 10 },
    requires: { discoveryId: 'node:drowned-causeway' },
  },
  {
    id: 'riftglass-ward',
    name: 'Riftglass Ward',
    price: null,
    effect: 'A barrier of 30% of maximum HP for 8 seconds.',
    ruleUsed: true,
    brew: { materialId: 'riftglass', quantity: 2, gold: 12 },
    requires: { enemyId: 'tidebound-colossus' },
  },
]

export const supplyTable: { readonly [id: string]: SupplyDef } = Object.fromEntries(SUPPLIES.map((supply) => [supply.id, supply]))

export function supplyName(id: string): string {
  return supplyTable[id]?.name ?? id
}

/** Supplies a priority rule can name. */
export const RULE_SUPPLY_IDS: readonly string[] = SUPPLIES.filter((supply) => supply.ruleUsed).map((supply) => supply.id)

/**
 * The Ward Charm's default rule: raise the barrier when an enemy telegraphs and the hero is at 70% HP
 * or less (decided 2026-11-08, GAME_DESIGN Supplies). Telegraph alone spent it on the first, weak hit.
 */
export const WARD_CHARM_ROW: PriorityRow = {
  skillId: 'ward-charm',
  conditions: [
    { kind: 'telegraph', operator: 'present' },
    { kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 70 },
  ],
}

/** The Warming Tonic's default rule: drink it at 2 Chill stacks (decided 2026-11-08, GAME_DESIGN Supplies). */
export const WARMING_TONIC_ROW: PriorityRow = {
  skillId: 'warming-tonic',
  conditions: [{ kind: 'status', who: 'hero', statusId: 'chill', measure: 'stacks', operator: 'atLeast', value: 2 }],
}

/** The Greater Draught's default rule: drink it at 30% HP or less, above the Healing Draught row (decided 2026-11-08). */
export const GREATER_DRAUGHT_ROW: PriorityRow = {
  skillId: 'greater-draught',
  conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 30 }],
}

/** The Riftglass Ward's default rule: the Ward Charm's conditions, above the Ward Charm row (decided 2026-11-08). */
export const RIFTGLASS_WARD_ROW: PriorityRow = {
  skillId: 'riftglass-ward',
  conditions: WARD_CHARM_ROW.conditions?.map((condition) => ({ ...condition })),
}

/** The supply rules a new hero starts with, above the class rules. Without a supply in the slots they skip. */
export const DEFAULT_SUPPLY_ROWS: readonly PriorityRow[] = [
  GREATER_DRAUGHT_ROW,
  { skillId: 'healing-draught', conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }] },
  {
    skillId: 'antidote',
    conditions: [{ kind: 'status', who: 'hero', statusId: 'poison', measure: 'stacks', operator: 'atLeast', value: 3 }],
  },
  RIFTGLASS_WARD_ROW,
  WARD_CHARM_ROW,
  WARMING_TONIC_ROW,
]

/** A hero's starting rules: the supply rules, then the class rules. */
export function startingRules(classRows: readonly PriorityRow[]): PriorityRow[] {
  return [...DEFAULT_SUPPLY_ROWS, ...classRows].map((row) => ({
    ...row,
    ...(row.conditions === undefined ? {} : { conditions: row.conditions.map((condition) => ({ ...condition })) }),
  }))
}
