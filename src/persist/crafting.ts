import { itemBase } from '../content/items.ts'
import { EQUIPMENT_SLOT_IDS, ITEM_MODIFIERS, appliesToText, classBlock, modifierFits, type EquipmentSlotId, type ItemInstance } from '../sim/economy.ts'
import { createRng, deriveSeed, nextFloat } from '../sim/rng.ts'

import { wearerOf } from './equipment.ts'
import type { RosterResult } from './roster.ts'
import { purseOf, updatePurse, withPurse, type CraftJob, type Purse, type SaveData, type SavedHero } from './save.ts'

export const CRAFT_MATERIAL_COST = 6
export const UPGRADE_MATERIAL_COST = 4
export const CRAFT_MS = 30_000
export const QUEUE_MAX = 3
export const MAX_RANK = 10
/** Seeds the crafting rolls. Each job adds its own index, so a saved game rolls the same way. */
export const CRAFT_SEED = 0x5eed

/** The quality a material can roll before proficiency, as a fraction (1 is 100%). */
export const MATERIAL_QUALITY: { readonly [materialId: string]: { low: number; high: number } } = {
  scrap: { low: 0.9, high: 1.0 },
  hide: { low: 0.95, high: 1.05 },
  shard: { low: 1.0, high: 1.1 },
}

export function proficiencyRank(xp: number): number {
  const rank = Math.floor(Math.sqrt(xp))
  return rank > MAX_RANK ? MAX_RANK : rank
}

/** The visible quality range for a material at a proficiency rank: each rank raises the minimum 1 point. */
export function qualityRange(materialId: string, rank: number): { low: number; high: number } | null {
  const range = MATERIAL_QUALITY[materialId]
  if (range === undefined) return null
  const raised = range.low + 0.01 * rank
  return { low: raised > range.high ? range.high : raised, high: range.high }
}

export function craftGold(itemLevel: number): number {
  return itemLevel * 5
}

/** Chance an upgrade from this item level works: `85% − 5 × item level`, never below 0. */
export function upgradeChance(itemLevel: number): number {
  const chance = 0.85 - 0.05 * itemLevel
  return chance > 0 ? Math.round(chance * 1000) / 1000 : 0
}

function rngFor(seedIndex: number) {
  return createRng(deriveSeed(CRAFT_SEED, seedIndex))
}

/** The average of two uniform rolls across the range, so values near the middle are common. */
function averagedRoll(seedIndex: number, range: { low: number; high: number }): number {
  const rng = rngFor(seedIndex)
  const mean = (nextFloat(rng) + nextFloat(rng)) / 2
  return Math.round((range.low + (range.high - range.low) * mean) * 1000) / 1000
}

function closed(save: SaveData): string | null {
  return save.expedition === null ? null : 'Crafting is closed while an expedition is running.'
}

function nextJobId(purse: Purse): string {
  return `job-${purse.craftCounter + 1}`
}

function spend(purse: Purse, materialId: string, quantity: number, gold: number): string | null {
  const owned = purse.materials[materialId] ?? 0
  if (owned < quantity) return `That needs ${quantity} ${materialId}. You have ${owned}.`
  if (purse.gold < gold) return `That costs ${gold} gold. You have ${purse.gold}.`
  return null
}

function charge(purse: Purse, materialId: string, quantity: number, gold: number): Purse {
  const materials = { ...purse.materials }
  const left = (materials[materialId] ?? 0) - quantity
  if (left > 0) materials[materialId] = left
  else delete materials[materialId]
  return { ...purse, materials, gold: purse.gold - gold }
}

export type CraftRequest = {
  baseId: string
  itemLevel: number
  materialId: string
  /** Null for no modifier. */
  modifierId: string | null
}

/** What a craft would cost and roll, or the reason it is refused. The hero pays from its own purse. */
export function craftCheck(save: SaveData, hero: SavedHero, request: CraftRequest): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (hero.purse.craftQueue.length >= QUEUE_MAX) return `The queue is full (${QUEUE_MAX} jobs).`
  const base = itemBase(request.baseId)
  if (base === undefined) return 'Pick something to craft.'
  const classProblem = classBlock(wearerOf(hero), base)
  if (classProblem !== null) return classProblem
  if (!Number.isInteger(request.itemLevel) || request.itemLevel < 1) return 'Item level must be a whole number of at least 1.'
  if (request.itemLevel > hero.progress.level) {
    return `Item level ${request.itemLevel} needs hero level ${request.itemLevel}. This hero is level ${hero.progress.level}.`
  }
  if (MATERIAL_QUALITY[request.materialId] === undefined) return 'Pick scrap, hide, or shard.'
  if (request.modifierId !== null) {
    const modifier = ITEM_MODIFIERS[request.modifierId]
    if (modifier === undefined) return 'Unknown modifier.'
    if (!save.account.recipes.includes(request.modifierId)) return `You have not learned the ${modifier.name} recipe.`
    if (hero.progress.level < modifier.minLevel) return `${modifier.name} needs level ${modifier.minLevel}. This hero is level ${hero.progress.level}.`
    if (!modifierFits(modifier, base)) return `${modifier.name} can only go on ${appliesToText(modifier)}.`
  }
  return spend(hero.purse, request.materialId, CRAFT_MATERIAL_COST, craftGold(request.itemLevel))
}

/** Pay for a craft and queue it. The quality is rolled when the job ends, from a seed fixed now. */
export function queueCraft(save: SaveData, heroId: string, request: CraftRequest): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const problem = craftCheck(save, hero, request)
  if (problem !== null) return { ok: false, reason: problem }
  const job: CraftJob = {
    id: nextJobId(hero.purse),
    kind: 'craft',
    heroId,
    baseId: request.baseId,
    itemLevel: request.itemLevel,
    materialId: request.materialId,
    modifierId: request.modifierId,
    remainingMs: CRAFT_MS,
    seedIndex: hero.purse.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  const purse = charge(hero.purse, request.materialId, CRAFT_MATERIAL_COST, craftGold(request.itemLevel))
  return {
    ok: true,
    save: withPurse(save, { ...purse, craftCounter: purse.craftCounter + 1, craftQueue: [...purse.craftQueue, job] }, heroId),
  }
}

/** Gold a modifier recipe costs in Greyhaven: 25 per level the modifier needs. */
export function recipePrice(modifierId: string): number {
  return (ITEM_MODIFIERS[modifierId]?.minLevel ?? 1) * 25
}

/** The recipes the account has not learned yet, with their prices. */
export function recipesForSale(save: SaveData): { modifierId: string; price: number }[] {
  return Object.keys(ITEM_MODIFIERS)
    .filter((id) => !save.account.recipes.includes(id))
    .map((id) => ({ modifierId: id, price: recipePrice(id) }))
}

/** Learn a modifier recipe for the whole account, paid with the selected hero's gold. */
export function buyRecipe(save: SaveData, modifierId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const modifier = ITEM_MODIFIERS[modifierId]
  if (modifier === undefined) return { ok: false, reason: 'Unknown recipe.' }
  if (save.account.recipes.includes(modifierId)) return { ok: false, reason: `You already know the ${modifier.name} recipe.` }
  if (save.selectedHeroId === null) return { ok: false, reason: 'Select a hero to pay for the recipe.' }
  const price = recipePrice(modifierId)
  const gold = purseOf(save).gold
  if (gold < price) return { ok: false, reason: `The ${modifier.name} recipe costs ${price} gold. You have ${gold}.` }
  const paid = updatePurse(save, { gold: gold - price })
  return { ok: true, save: { ...paid, account: { ...paid.account, recipes: [...paid.account.recipes, modifierId] } } }
}

/** The slot a hero wears this item in, or null. */
export function wornSlot(hero: SavedHero, itemId: string): EquipmentSlotId | null {
  return EQUIPMENT_SLOT_IDS.find((slot) => hero.equipment[slot]?.id === itemId) ?? null
}

/** Why an item from the hero's archive, or one the hero wears, cannot be upgraded, or null. */
export function upgradeCheck(save: SaveData, hero: SavedHero, item: ItemInstance | undefined, materialId: string): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (hero.purse.craftQueue.length >= QUEUE_MAX) return `The queue is full (${QUEUE_MAX} jobs).`
  if (item === undefined) return 'That item is not in the archive or worn by this hero.'
  if (item.itemLevel >= hero.progress.level) return `This hero is level ${hero.progress.level}. An item cannot go above the hero's level.`
  if (upgradeChance(item.itemLevel) <= 0) return 'That item cannot be upgraded further.'
  if (MATERIAL_QUALITY[materialId] === undefined) return 'Pick scrap, hide, or shard.'
  return spend(hero.purse, materialId, UPGRADE_MATERIAL_COST, craftGold(item.itemLevel))
}

/** Pay for an upgrade and queue it. The item leaves the archive until the job ends. */
export function queueUpgrade(save: SaveData, heroId: string, itemId: string, materialId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const archived = hero.purse.archive.find((entry) => entry.id === itemId)
  const slot = archived === undefined ? wornSlot(hero, itemId) : null
  const item = archived ?? (slot === null ? undefined : (hero.equipment[slot] ?? undefined))
  const problem = upgradeCheck(save, hero, item, materialId)
  if (problem !== null || item === undefined) return { ok: false, reason: problem ?? 'That item is not in the archive or worn by this hero.' }
  const job: CraftJob = {
    id: nextJobId(hero.purse),
    kind: 'upgrade',
    heroId,
    item,
    ...(slot === null ? {} : { slot }),
    materialId,
    remainingMs: CRAFT_MS,
    seedIndex: hero.purse.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  const paid = charge(hero.purse, materialId, UPGRADE_MATERIAL_COST, craftGold(item.itemLevel))
  const purse: Purse = {
    ...paid,
    craftCounter: paid.craftCounter + 1,
    archive: paid.archive.filter((entry) => entry.id !== itemId),
    craftQueue: [...paid.craftQueue, job],
  }
  const equipment = slot === null ? hero.equipment : { ...hero.equipment, [slot]: null }
  return {
    ok: true,
    save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment, purse } : entry)) },
  }
}

export type CraftNotice = { jobId: string; text: string }

/** End a job: the item goes to the hero who queued it, who also gains crafting experience. */
function finishJob(job: CraftJob, save: SaveData): { save: SaveData; notice: CraftNotice } {
  const heroes = save.heroes.map((hero) => (hero.id === job.heroId ? { ...hero, craftXp: hero.craftXp + 1 } : hero))
  const keep = (item: ItemInstance) =>
    heroes.map((hero) => (hero.id === job.heroId ? { ...hero, purse: { ...hero.purse, archive: [...hero.purse.archive, item] } } : hero))
  if (job.kind === 'craft') {
    const range = qualityRange(job.materialId, job.rank) ?? { low: 1, high: 1 }
    const quality = averagedRoll(job.seedIndex, range)
    const item: ItemInstance = {
      id: `craft-${job.heroId}-${job.seedIndex + 1}`,
      baseId: job.baseId,
      itemLevel: job.itemLevel,
      quality,
      durability: 100,
      maxDurability: 100,
      modifiers: job.modifierId === null ? [] : [job.modifierId],
    }
    const name = itemBase(job.baseId)?.name ?? job.baseId
    return {
      save: { ...save, heroes: keep(item) },
      notice: { jobId: job.id, text: `Crafted ${name}, item level ${job.itemLevel}, quality ${Math.round(quality * 1000) / 10}%.` },
    }
  }
  const rng = rngFor(job.seedIndex)
  const chance = upgradeChance(job.item.itemLevel)
  const worked = nextFloat(rng) < chance
  const returned: ItemInstance = worked ? { ...job.item, itemLevel: job.item.itemLevel + 1 } : job.item
  const name = itemBase(job.item.baseId)?.name ?? job.item.baseId
  const owner = heroes.find((entry) => entry.id === job.heroId)
  const backInSlot = job.slot !== undefined && owner !== undefined && owner.equipment[job.slot] === null
  const slot = job.slot
  const worn =
    backInSlot && slot !== undefined
      ? heroes.map((entry) => (entry.id === job.heroId ? { ...entry, equipment: { ...entry.equipment, [slot]: returned } } : entry))
      : keep(returned)
  return {
    save: { ...save, heroes: worn },
    notice: {
      jobId: job.id,
      text: worked
        ? `${name} was upgraded to item level ${returned.itemLevel}.`
        : `The upgrade of ${name} failed. The materials are gone and the item is unchanged.`,
    },
  }
}

/**
 * Let town time pass for the selected hero's queue. Only the first job advances, and nothing moves
 * while an expedition runs. Time left over when a job ends goes to the next one.
 */
export function advanceCrafting(save: SaveData, elapsedMs: number): { save: SaveData; finished: CraftNotice[] } {
  if (save.expedition !== null || purseOf(save).craftQueue.length === 0 || !(elapsedMs > 0)) return { save, finished: [] }
  let current = save
  let left = elapsedMs
  const finished: CraftNotice[] = []
  while (left > 0 && purseOf(current).craftQueue.length > 0) {
    const [job, ...rest] = purseOf(current).craftQueue
    if (job === undefined) break
    if (job.remainingMs > left) {
      current = updatePurse(current, { craftQueue: [{ ...job, remainingMs: job.remainingMs - left }, ...rest] })
      left = 0
      break
    }
    left -= job.remainingMs
    const done = finishJob(job, updatePurse(current, { craftQueue: rest }))
    current = done.save
    finished.push(done.notice)
  }
  return { save: current, finished }
}

/** Development builds only: learn every modifier recipe and give the selected hero materials and gold to try crafting. */
export function grantCraftingKit(save: SaveData): SaveData {
  const recipes = Object.keys(ITEM_MODIFIERS)
  const learned = { ...save, account: { ...save.account, recipes } }
  if (save.selectedHeroId === null) return learned
  const purse = purseOf(save)
  const materials = { ...purse.materials }
  for (const id of Object.keys(MATERIAL_QUALITY)) materials[id] = (materials[id] ?? 0) + 30
  return updatePurse(learned, { materials, gold: purse.gold + 300 })
}
