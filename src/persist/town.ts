import { itemBase, newItem } from '../content/items.ts'
import { MATERIAL_SELL_PRICE, itemBuyPrice, itemSellPrice, repairCost } from '../content/shop.ts'
import { EQUIPMENT_SLOT_IDS, type Equipment, type ItemInstance } from '../sim/economy.ts'

import type { RosterResult } from './roster.ts'
import type { SaveData, SavedHero } from './save.ts'

function closed(save: SaveData): string | null {
  return save.expedition === null ? null : 'Town services are closed while an expedition is running.'
}

function withGold(save: SaveData, gold: number): SaveData {
  return { ...save, account: { ...save.account, gold } }
}

/** Sell some of a material. The account must hold that many. */
export function sellMaterial(save: SaveData, materialId: string, quantity: number): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const price = MATERIAL_SELL_PRICE[materialId]
  if (price === undefined) return { ok: false, reason: 'Greyhaven does not buy that.' }
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'Sell at least 1.' }
  const owned = save.account.materials[materialId] ?? 0
  if (quantity > owned) return { ok: false, reason: `You only have ${owned} ${materialId}.` }
  const materials = { ...save.account.materials }
  if (owned === quantity) delete materials[materialId]
  else materials[materialId] = owned - quantity
  const next = withGold(save, save.account.gold + price * quantity)
  return { ok: true, save: { ...next, account: { ...next.account, materials } } }
}

/** Sell an archive item. Equipped items cannot be sold. */
export function sellItem(save: SaveData, itemId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const item = save.account.archive.find((entry) => entry.id === itemId)
  if (item === undefined) return { ok: false, reason: 'Only archive items can be sold.' }
  const next = withGold(save, save.account.gold + itemSellPrice(item))
  const archive = next.account.archive.filter((entry) => entry.id !== itemId)
  return { ok: true, save: { ...next, account: { ...next.account, archive } } }
}

function nextShopId(save: SaveData): string {
  let highest = 0
  const seen = [...save.account.archive, ...save.heroes.flatMap((hero) => Object.values(hero.equipment))]
  for (const item of seen) {
    const match = item === null ? null : /^shop-(\d+)$/.exec(item.id)
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]))
  }
  return `shop-${highest + 1}`
}

/** Buy a new base item at the hero's level and 100% quality. It goes to the archive. */
export function buyItem(save: SaveData, heroId: string, baseId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (itemBase(baseId) === undefined) return { ok: false, reason: 'Greyhaven does not sell that.' }
  const price = itemBuyPrice(hero.progress.level)
  if (save.account.gold < price) return { ok: false, reason: `That costs ${price} gold. You have ${save.account.gold}.` }
  const item = newItem(nextShopId(save), baseId, hero.progress.level)
  const next = withGold(save, save.account.gold - price)
  return { ok: true, save: { ...next, account: { ...next.account, archive: [...next.account.archive, item] } } }
}

function itemById(save: SaveData, itemId: string): ItemInstance | null {
  const owned = [...save.account.archive, ...save.heroes.flatMap((hero) => Object.values(hero.equipment))]
  return owned.find((item): item is ItemInstance => item !== null && item.id === itemId) ?? null
}

function restoreItem(save: SaveData, itemId: string): SaveData {
  const full = (item: ItemInstance): ItemInstance => (item.id === itemId ? { ...item, durability: item.maxDurability } : item)
  const heroes = save.heroes.map((hero): SavedHero => {
    const equipment = { ...hero.equipment } as Equipment
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const item = equipment[slot]
      if (item !== null) equipment[slot] = full(item)
    }
    return { ...hero, equipment }
  })
  return { ...save, account: { ...save.account, archive: save.account.archive.map(full) }, heroes }
}

/** Repair one item, equipped or in the archive, to full durability. A disabled item is repaired the same way. */
export function repairOne(save: SaveData, itemId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const item = itemById(save, itemId)
  if (item === null) return { ok: false, reason: 'That item is not here.' }
  const cost = repairCost(item)
  if (cost === 0) return { ok: false, reason: 'That item is not damaged.' }
  if (save.account.gold < cost) return { ok: false, reason: `Repair costs ${cost} gold. You have ${save.account.gold}.` }
  return { ok: true, save: withGold(restoreItem(save, itemId), save.account.gold - cost) }
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
  if (save.account.gold < cost) return { ok: false, reason: `Repairing everything costs ${cost} gold. You have ${save.account.gold}.` }
  const equipment = { ...hero.equipment } as Equipment
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = equipment[slot]
    if (item !== null) equipment[slot] = { ...item, durability: item.maxDurability }
  }
  const next = withGold(save, save.account.gold - cost)
  return { ok: true, save: { ...next, heroes: next.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment } : entry)) } }
}

/** Pay off debt from the account's gold, in any whole amount up to what is owed and held. */
export function payDebt(save: SaveData, amount: number): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, reason: 'Pay at least 1 gold.' }
  if (save.account.debt === 0) return { ok: false, reason: 'You owe nothing.' }
  if (amount > save.account.debt) return { ok: false, reason: `You only owe ${save.account.debt}.` }
  if (amount > save.account.gold) return { ok: false, reason: `You have ${save.account.gold} gold.` }
  return { ok: true, save: { ...save, account: { ...save.account, gold: save.account.gold - amount, debt: save.account.debt - amount } } }
}

/** Development builds only: some gold to try the shop. */
export function grantGold(save: SaveData, amount: number): SaveData {
  return withGold(save, save.account.gold + amount)
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
