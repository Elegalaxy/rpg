import { itemBase } from '../content/items.ts'
import { ITEM_MODIFIERS, type ItemInstance } from '../sim/economy.ts'
import { createRng, deriveSeed, nextFloat } from '../sim/rng.ts'

import type { RosterResult } from './roster.ts'
import type { CraftJob, SaveData, SavedHero } from './save.ts'

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

function nextJobId(save: SaveData): string {
  return `job-${save.account.craftCounter + 1}`
}

function spend(save: SaveData, materialId: string, quantity: number, gold: number): string | null {
  const owned = save.account.materials[materialId] ?? 0
  if (owned < quantity) return `That needs ${quantity} ${materialId}. You have ${owned}.`
  if (save.account.gold < gold) return `That costs ${gold} gold. You have ${save.account.gold}.`
  return null
}

function charge(save: SaveData, materialId: string, quantity: number, gold: number): SaveData['account'] {
  const materials = { ...save.account.materials }
  const left = (materials[materialId] ?? 0) - quantity
  if (left > 0) materials[materialId] = left
  else delete materials[materialId]
  return { ...save.account, materials, gold: save.account.gold - gold }
}

export type CraftRequest = {
  baseId: string
  itemLevel: number
  materialId: string
  /** Null for no modifier. */
  modifierId: string | null
}

/** What a craft would cost and roll, or the reason it is refused. */
export function craftCheck(save: SaveData, hero: SavedHero, request: CraftRequest): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (save.account.craftQueue.length >= QUEUE_MAX) return `The queue is full (${QUEUE_MAX} jobs).`
  if (itemBase(request.baseId) === undefined) return 'Pick something to craft.'
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
  }
  return spend(save, request.materialId, CRAFT_MATERIAL_COST, craftGold(request.itemLevel))
}

/** Pay for a craft and queue it. The quality is rolled when the job ends, from a seed fixed now. */
export function queueCraft(save: SaveData, heroId: string, request: CraftRequest): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const problem = craftCheck(save, hero, request)
  if (problem !== null) return { ok: false, reason: problem }
  const job: CraftJob = {
    id: nextJobId(save),
    kind: 'craft',
    heroId,
    baseId: request.baseId,
    itemLevel: request.itemLevel,
    materialId: request.materialId,
    modifierId: request.modifierId,
    remainingMs: CRAFT_MS,
    seedIndex: save.account.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  const account = charge(save, request.materialId, CRAFT_MATERIAL_COST, craftGold(request.itemLevel))
  return {
    ok: true,
    save: { ...save, account: { ...account, craftCounter: account.craftCounter + 1, craftQueue: [...account.craftQueue, job] } },
  }
}

/** Why an archive item cannot be upgraded, or null. */
export function upgradeCheck(save: SaveData, hero: SavedHero, item: ItemInstance | undefined, materialId: string): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (save.account.craftQueue.length >= QUEUE_MAX) return `The queue is full (${QUEUE_MAX} jobs).`
  if (item === undefined) return 'Only archive items can be upgraded.'
  if (item.itemLevel >= hero.progress.level) return `This hero is level ${hero.progress.level}. An item cannot go above the hero's level.`
  if (upgradeChance(item.itemLevel) <= 0) return 'That item cannot be upgraded further.'
  if (MATERIAL_QUALITY[materialId] === undefined) return 'Pick scrap, hide, or shard.'
  return spend(save, materialId, UPGRADE_MATERIAL_COST, craftGold(item.itemLevel))
}

/** Pay for an upgrade and queue it. The item leaves the archive until the job ends. */
export function queueUpgrade(save: SaveData, heroId: string, itemId: string, materialId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const item = save.account.archive.find((entry) => entry.id === itemId)
  const problem = upgradeCheck(save, hero, item, materialId)
  if (problem !== null || item === undefined) return { ok: false, reason: problem ?? 'Only archive items can be upgraded.' }
  const job: CraftJob = {
    id: nextJobId(save),
    kind: 'upgrade',
    heroId,
    item,
    materialId,
    remainingMs: CRAFT_MS,
    seedIndex: save.account.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  const account = charge(save, materialId, UPGRADE_MATERIAL_COST, craftGold(item.itemLevel))
  return {
    ok: true,
    save: {
      ...save,
      account: {
        ...account,
        craftCounter: account.craftCounter + 1,
        archive: account.archive.filter((entry) => entry.id !== itemId),
        craftQueue: [...account.craftQueue, job],
      },
    },
  }
}

export type CraftNotice = { jobId: string; text: string }

function finishJob(job: CraftJob, save: SaveData): { save: SaveData; notice: CraftNotice } {
  const account = save.account
  const heroes = save.heroes.map((hero) => (hero.id === job.heroId ? { ...hero, craftXp: hero.craftXp + 1 } : hero))
  if (job.kind === 'craft') {
    const range = qualityRange(job.materialId, job.rank) ?? { low: 1, high: 1 }
    const quality = averagedRoll(job.seedIndex, range)
    const item: ItemInstance = {
      id: `craft-${job.seedIndex + 1}`,
      baseId: job.baseId,
      itemLevel: job.itemLevel,
      quality,
      durability: 100,
      maxDurability: 100,
      modifiers: job.modifierId === null ? [] : [job.modifierId],
    }
    const name = itemBase(job.baseId)?.name ?? job.baseId
    return {
      save: { ...save, heroes, account: { ...account, archive: [...account.archive, item] } },
      notice: { jobId: job.id, text: `Crafted ${name}, item level ${job.itemLevel}, quality ${Math.round(quality * 1000) / 10}%.` },
    }
  }
  const rng = rngFor(job.seedIndex)
  const chance = upgradeChance(job.item.itemLevel)
  const worked = nextFloat(rng) < chance
  const returned: ItemInstance = worked ? { ...job.item, itemLevel: job.item.itemLevel + 1 } : job.item
  const name = itemBase(job.item.baseId)?.name ?? job.item.baseId
  return {
    save: { ...save, heroes, account: { ...account, archive: [...account.archive, returned] } },
    notice: {
      jobId: job.id,
      text: worked
        ? `${name} was upgraded to item level ${returned.itemLevel}.`
        : `The upgrade of ${name} failed. The materials are gone and the item is unchanged.`,
    },
  }
}

/**
 * Let town time pass. Only the first job advances, and nothing moves while an expedition runs.
 * Time left over when a job ends goes to the next one.
 */
export function advanceCrafting(save: SaveData, elapsedMs: number): { save: SaveData; finished: CraftNotice[] } {
  if (save.expedition !== null || save.account.craftQueue.length === 0 || !(elapsedMs > 0)) return { save, finished: [] }
  let current = save
  let left = elapsedMs
  const finished: CraftNotice[] = []
  while (left > 0 && current.account.craftQueue.length > 0) {
    const [job, ...rest] = current.account.craftQueue
    if (job === undefined) break
    if (job.remainingMs > left) {
      current = { ...current, account: { ...current.account, craftQueue: [{ ...job, remainingMs: job.remainingMs - left }, ...rest] } }
      left = 0
      break
    }
    left -= job.remainingMs
    const done = finishJob(job, { ...current, account: { ...current.account, craftQueue: rest } })
    current = done.save
    finished.push(done.notice)
  }
  return { save: current, finished }
}

/** Development builds only: learn every modifier recipe and get materials to try crafting. */
export function grantCraftingKit(save: SaveData): SaveData {
  const recipes = Object.keys(ITEM_MODIFIERS)
  const materials = { ...save.account.materials }
  for (const id of Object.keys(MATERIAL_QUALITY)) materials[id] = (materials[id] ?? 0) + 30
  return { ...save, account: { ...save.account, recipes, materials, gold: save.account.gold + 300 } }
}
