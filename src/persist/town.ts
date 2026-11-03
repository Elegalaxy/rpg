import { itemBase, newItem } from '../content/items.ts'
import { MATERIAL_SELL_PRICE, itemBuyPrice, itemSellPrice, repairCost } from '../content/shop.ts'
import { supplyTable } from '../content/supplies.ts'
import { EQUIPMENT_SLOT_IDS, classBlock, type Equipment, type ItemInstance } from '../sim/economy.ts'

import { selectedHero } from './character.ts'
import { wearerOf } from './equipment.ts'
import type { RosterResult } from './roster.ts'
import { purseOf, updatePurse, type SaveData, type SavedHero } from './save.ts'

function closed(save: SaveData): string | null {
  return save.expedition === null ? null : 'Town services are closed while an expedition is running.'
}

/** Sell some of a material. The selected hero must hold that many. */
export function sellMaterial(save: SaveData, materialId: string, quantity: number): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const price = MATERIAL_SELL_PRICE[materialId]
  if (price === undefined) return { ok: false, reason: 'Greyhaven does not buy that.' }
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'Sell at least 1.' }
  const purse = purseOf(save)
  const owned = purse.materials[materialId] ?? 0
  if (quantity > owned) return { ok: false, reason: `You only have ${owned} ${materialId}.` }
  const materials = { ...purse.materials }
  if (owned === quantity) delete materials[materialId]
  else materials[materialId] = owned - quantity
  return { ok: true, save: updatePurse(save, { materials, gold: purse.gold + price * quantity }) }
}

/**
 * Sell an item from the selected hero's archive, or one the hero is wearing (its slot is left empty, so the hero
 * cannot fight until it is filled). An heirloom cannot be sold.
 */
export function sellItem(save: SaveData, itemId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const purse = purseOf(save)
  const archived = purse.archive.find((entry) => entry.id === itemId)
  const hero = selectedHero(save)
  const slot = hero === null ? undefined : EQUIPMENT_SLOT_IDS.find((id) => hero.equipment[id]?.id === itemId)
  const worn = hero !== null && slot !== undefined ? hero.equipment[slot] : null
  const item = archived ?? worn
  if (item === null || item === undefined) return { ok: false, reason: 'That item is not in the archive or worn by the selected hero.' }
  if (item.heirloom !== undefined) return { ok: false, reason: 'An heirloom cannot be sold.' }
  const gold = purse.gold + itemSellPrice(item)
  if (archived !== undefined) {
    return { ok: true, save: updatePurse(save, { gold, archive: purse.archive.filter((entry) => entry.id !== itemId) }) }
  }
  const next = updatePurse(save, { gold })
  const heroes = next.heroes.map((entry) =>
    entry.id === hero?.id && slot !== undefined ? { ...entry, equipment: { ...entry.equipment, [slot]: null } } : entry,
  )
  return { ok: true, save: { ...next, heroes } }
}

function nextShopId(save: SaveData): string {
  let highest = 0
  const seen = save.heroes.flatMap((hero) => [...hero.purse.archive, ...Object.values(hero.equipment)])
  for (const item of seen) {
    const match = item === null ? null : /^shop-(\d+)$/.exec(item.id)
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]))
  }
  return `shop-${highest + 1}`
}

/** Buy a new base item at the hero's level and 100% quality with that hero's gold. It goes to the hero's archive. */
export function buyItem(save: SaveData, heroId: string, baseId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const base = itemBase(baseId)
  if (base === undefined) return { ok: false, reason: 'Greyhaven does not sell that.' }
  const blocked = classBlock(wearerOf(hero), base)
  if (blocked !== null) return { ok: false, reason: blocked }
  const price = itemBuyPrice(hero.progress.level)
  const purse = hero.purse
  if (purse.gold < price) return { ok: false, reason: `That costs ${price} gold. You have ${purse.gold}.` }
  const item = newItem(nextShopId(save), baseId, hero.progress.level)
  return { ok: true, save: updatePurse(save, { gold: purse.gold - price, archive: [...purse.archive, item] }, heroId) }
}

/** Buy supplies with the selected hero's gold. They go to that hero's stash. */
export function buySupply(save: SaveData, supplyId: string, quantity = 1): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const supply = supplyTable[supplyId]
  if (supply === undefined) return { ok: false, reason: 'Greyhaven does not sell that.' }
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'Buy at least 1.' }
  if (save.selectedHeroId === null) return { ok: false, reason: 'Select a hero first.' }
  const purse = purseOf(save)
  const price = supply.price * quantity
  if (purse.gold < price) return { ok: false, reason: `That costs ${price} gold. You have ${purse.gold}.` }
  const supplies = { ...purse.supplies, [supplyId]: (purse.supplies[supplyId] ?? 0) + quantity }
  return { ok: true, save: updatePurse(save, { gold: purse.gold - price, supplies }) }
}

/** An item the selected hero wears or keeps in its archive. */
function itemById(save: SaveData, itemId: string): ItemInstance | null {
  const hero = selectedHero(save)
  if (hero === null) return null
  const owned = [...hero.purse.archive, ...Object.values(hero.equipment)]
  return owned.find((item): item is ItemInstance => item !== null && item.id === itemId) ?? null
}

function restoreItem(save: SaveData, itemId: string, gold: number): SaveData {
  const full = (item: ItemInstance): ItemInstance => (item.id === itemId ? { ...item, durability: item.maxDurability } : item)
  const heroes = save.heroes.map((hero): SavedHero => {
    if (hero.id !== save.selectedHeroId) return hero
    const equipment = { ...hero.equipment } as Equipment
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const item = equipment[slot]
      if (item !== null) equipment[slot] = full(item)
    }
    return { ...hero, equipment, purse: { ...hero.purse, gold, archive: hero.purse.archive.map(full) } }
  })
  return { ...save, heroes }
}

/** Repair one of the selected hero's items, worn or in its archive, to full durability. A disabled item is repaired the same way. */
export function repairOne(save: SaveData, itemId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const item = itemById(save, itemId)
  if (item === null) return { ok: false, reason: 'That item is not here.' }
  const cost = repairCost(item)
  if (cost === 0) return { ok: false, reason: 'That item is not damaged.' }
  const gold = purseOf(save).gold
  if (gold < cost) return { ok: false, reason: `Repair costs ${cost} gold. You have ${gold}.` }
  return { ok: true, save: restoreItem(save, itemId, gold - cost) }
}

/** What repairing everything the hero has equipped would cost. */
export function repairAllCost(hero: SavedHero): number {
  return Object.values(hero.equipment).reduce((sum, item) => sum + (item === null ? 0 : repairCost(item)), 0)
}

/** Repair every damaged item the hero has equipped, or none if the gold is short. */
export function repairAll(save: SaveData, heroId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const cost = repairAllCost(hero)
  if (cost === 0) return { ok: false, reason: 'Nothing equipped is damaged.' }
  if (hero.purse.gold < cost) return { ok: false, reason: `Repairing everything costs ${cost} gold. You have ${hero.purse.gold}.` }
  const equipment = { ...hero.equipment } as Equipment
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = equipment[slot]
    if (item !== null) equipment[slot] = { ...item, durability: item.maxDurability }
  }
  const purse = { ...hero.purse, gold: hero.purse.gold - cost }
  return { ok: true, save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment, purse } : entry)) } }
}

/** Pay off the selected hero's debt from its gold, in any whole amount up to what is owed and held. */
export function payDebt(save: SaveData, amount: number): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, reason: 'Pay at least 1 gold.' }
  const purse = purseOf(save)
  if (purse.debt === 0) return { ok: false, reason: 'You owe nothing.' }
  const paid = Math.min(amount, purse.debt)
  if (paid > purse.gold) return { ok: false, reason: `You have ${purse.gold} gold.` }
  return { ok: true, save: updatePurse(save, { gold: purse.gold - paid, debt: purse.debt - paid }) }
}

/** Development builds only: some gold for the selected hero to try the shop. */
export function grantGold(save: SaveData, amount: number): SaveData {
  if (save.selectedHeroId === null) return save
  return updatePurse(save, { gold: purseOf(save).gold + amount })
}

/** Development builds only: wear every item a hero has equipped down by 30 durability, to try repair. */
export function wearGear(save: SaveData, heroId: string): SaveData {
  const heroes = save.heroes.map((hero): SavedHero => {
    if (hero.id !== heroId) return hero
    const equipment = { ...hero.equipment } as Equipment
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const item = equipment[slot]
      if (item !== null) equipment[slot] = { ...item, durability: Math.max(0, item.durability - 30) }
    }
    return { ...hero, equipment }
  })
  return { ...save, heroes }
}
