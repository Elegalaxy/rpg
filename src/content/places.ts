import type { ItemBase } from '../sim/economy.ts'

import { itemBase } from './items.ts'

/** Greyhaven's places. Each gear shop buys, sells, repairs, crafts, and upgrades only its own kind of item. */
export type PlaceId = 'weaponsmith' | 'armorer' | 'jeweler' | 'apothecary' | 'trading-post' | 'enchanter' | 'contract-board' | 'moneylender'

export type PlaceDef = {
  id: PlaceId
  name: string
  /** One line about what the place does. */
  blurb: string
  /** The item types a gear shop deals in. Omitted for places that handle no gear. */
  gear?: readonly ItemBase['type'][]
}

export const PLACES: readonly PlaceDef[] = [
  { id: 'weaponsmith', name: 'Weaponsmith', blurb: 'Weapons and off-hands: buy, sell, repair, craft, and upgrade.', gear: ['weapon', 'offHand'] },
  { id: 'armorer', name: 'Armorer', blurb: 'Helms, chestpieces, gloves, and boots: buy, sell, repair, craft, and upgrade.', gear: ['armor'] },
  { id: 'jeweler', name: 'Jeweler', blurb: 'Rings and charms: buy, sell, repair, craft, and upgrade.', gear: ['accessory'] },
  { id: 'apothecary', name: 'Apothecary', blurb: 'Supplies for the road.' },
  { id: 'trading-post', name: 'Trading Post', blurb: 'Sells your materials for gold.' },
  { id: 'enchanter', name: 'Enchanter', blurb: 'Teaches modifier recipes. A recipe is learned once for every hero.' },
  { id: 'contract-board', name: 'Contract Board', blurb: 'Work for the town, paid on completion.' },
  { id: 'moneylender', name: 'Moneylender', blurb: 'Pay off debt from defeats.' },
]

export const placeTable: { readonly [id in PlaceId]: PlaceDef } = Object.fromEntries(PLACES.map((place) => [place.id, place])) as {
  [id in PlaceId]: PlaceDef
}

/** Whether a gear shop deals in this base item. Unknown bases belong nowhere. */
export function dealsIn(place: PlaceDef, baseId: string): boolean {
  const base = itemBase(baseId)
  return base !== undefined && place.gear !== undefined && place.gear.includes(base.type)
}
