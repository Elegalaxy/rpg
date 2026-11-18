import { enemies } from '../content/enemies.ts'
import { itemBase, itemName } from '../content/items.ts'
import { supplyTable } from '../content/supplies.ts'
import { nodes } from '../content/world.ts'
import { EQUIPMENT_SLOT_IDS, ITEM_MODIFIERS, MAX_ITEM_MODIFIERS, MODIFIER_RANK_MAX, appliesToText, modifierRankAt, modifierTemperAt, rankName, rankable, classBlock, modifierFits, type EquipmentSlotId, type ItemInstance, type ModifierRequirement } from '../sim/economy.ts'
import { createRng, deriveSeed, nextFloat } from '../sim/rng.ts'

import { selectedHero } from './character.ts'
import { PACKS, type PackId } from './pack.ts'
import { wearerOf } from './equipment.ts'
import type { RosterResult } from './roster.ts'
import { purseOf, updatePurse, withPurse, type CraftJob, type Purse, type SaveData, type SavedHero } from './save.ts'

export const CRAFT_MATERIAL_COST = 6
export const UPGRADE_MATERIAL_COST = 3
/** Materials whose upgrade costs a different number of units than `UPGRADE_MATERIAL_COST`. */
export const UPGRADE_MATERIAL_COST_BY_MATERIAL: { readonly [materialId: string]: number } = { witherbark: 2 }

/** Units of this material one upgrade costs. */
export function upgradeMaterialCost(materialId: string): number {
  return UPGRADE_MATERIAL_COST_BY_MATERIAL[materialId] ?? UPGRADE_MATERIAL_COST
}
export const CRAFT_MS = 30_000
/** The hero level that unlocks sockets (GAME_DESIGN section 9, "Gold sinks"). */
export const SOCKET_MIN_HERO_LEVEL = 10
/** Gold per item level to open a socket. */
export const SOCKET_GOLD_PER_LEVEL = 40
/** Units of a rare material an open-socket job costs. */
export const SOCKET_MATERIAL_COST = 8
/** The materials a socket can be paid with. */
export const SOCKET_MATERIALS: readonly string[] = ['riftglass', 'duskiron', 'cinderite']
/** Gold per level the modifier needs, to reach rank II and rank III (GAME_DESIGN section 9). */
export const RANK_GOLD_PER_LEVEL: { readonly [toRank: number]: number } = { 2: 30, 3: 60 }
/** Units of material a rank-up costs: any material for II, a rare one (`SOCKET_MATERIALS`) for III. */
export const RANK_MATERIAL_COST: { readonly [toRank: number]: number } = { 2: 6, 3: 10 }
/** Gold per item level to infuse a second modifier. */
export const INFUSE_GOLD_PER_LEVEL = 10
/** Units of any material an infuse job costs. */
export const INFUSE_MATERIAL_COST = 6
type UpgradeJob = Extract<CraftJob, { kind: 'upgrade' }>
export const MAX_RANK = 10
/** Percentage points of quality an upgrade adds, by the material spent (GAME_DESIGN crafting). */
export const UPGRADE_QUALITY_POINTS: { readonly [materialId: string]: number } = { scrap: 0, hide: 1, shard: 2, witherbark: 2, oathsteel: 2, riftglass: 3, duskiron: 4, cinderite: 5 }
/** An upgrade never lifts quality above this, except with a material that has its own cap. */
export const UPGRADE_QUALITY_CAP = 1.1
/** Materials whose upgrades may go higher than `UPGRADE_QUALITY_CAP`. */
export const UPGRADE_QUALITY_CAP_BY_MATERIAL: { readonly [materialId: string]: number } = { witherbark: 1.1, oathsteel: 1.11, riftglass: 1.12, duskiron: 1.16, cinderite: 1.2 }

/** The highest quality an upgrade with this material can reach. */
export function upgradeCapFor(materialId: string): number {
  return UPGRADE_QUALITY_CAP_BY_MATERIAL[materialId] ?? UPGRADE_QUALITY_CAP
}

/** The quality an item has after an upgrade with this material. An item already above the cap keeps its quality. */
export function upgradedQuality(quality: number, materialId: string): number {
  const raised = quality + (UPGRADE_QUALITY_POINTS[materialId] ?? 0) / 100
  const cap = upgradeCapFor(materialId)
  return raised > cap ? Math.max(quality, cap) : raised
}

/** The material ids a craft or upgrade accepts, in table order. */
export function materialIds(): string[] {
  return Object.keys(MATERIAL_QUALITY)
}

/** "Pick scrap, hide, shard, witherbark, oathsteel, riftglass, duskiron, or cinderite.", built from the table. */
export function pickMaterialText(): string {
  const ids = materialIds()
  return `Pick ${ids.slice(0, -1).join(', ')}, or ${ids[ids.length - 1]}.`
}
/** Seeds the crafting rolls. Each job adds its own index, so a saved game rolls the same way. */
export const CRAFT_SEED = 0x5eed

/** The quality a material can roll before proficiency, as a fraction (1 is 100%). */
export const MATERIAL_QUALITY: { readonly [materialId: string]: { low: number; high: number } } = {
  scrap: { low: 0.9, high: 1.0 },
  hide: { low: 0.95, high: 1.05 },
  shard: { low: 1.0, high: 1.1 },
  witherbark: { low: 0.99, high: 1.09 },
  oathsteel: { low: 1.01, high: 1.11 },
  riftglass: { low: 1.02, high: 1.12 },
  duskiron: { low: 1.06, high: 1.16 },
  cinderite: { low: 1.1, high: 1.2 },
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

/** Gold for an upgrade from this item level: `item level × 3`. An upgrade always succeeds. */
export function upgradeGold(itemLevel: number): number {
  return itemLevel * 3
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
  const base = itemBase(request.baseId)
  if (base === undefined) return 'Pick something to craft.'
  const classProblem = classBlock(wearerOf(hero), base)
  if (classProblem !== null) return classProblem
  if (!Number.isInteger(request.itemLevel) || request.itemLevel < 1) return 'Item level must be a whole number of at least 1.'
  if (request.itemLevel > hero.progress.level) {
    return `Item level ${request.itemLevel} needs hero level ${request.itemLevel}. This hero is level ${hero.progress.level}.`
  }
  if (MATERIAL_QUALITY[request.materialId] === undefined) return pickMaterialText()
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

/** Gold a modifier recipe costs in Greyhaven: 25 per level the modifier needs, unless the modifier sets its own price. */
export function recipePrice(modifierId: string): number {
  const modifier = ITEM_MODIFIERS[modifierId]
  return modifier?.recipeGold ?? (modifier?.minLevel ?? 1) * 25
}

/** The account-wide record of a defeated enemy, kept in `discoveries` so it survives a hero's reincarnation. */
export function defeatRecordId(enemyId: string): string {
  return `defeated:${enemyId}`
}

/** Whether any hero on the account has defeated this enemy, now or in a record that was kept. */
export function enemyDefeatedByAnyHero(save: SaveData, enemyId: string): boolean {
  return save.account.discoveries.includes(defeatRecordId(enemyId)) || save.heroes.some((hero) => hero.defeatedEnemyIds.includes(enemyId))
}

/** Why an unlock requirement is not met yet, in the words the screen shows, or null when it is met. */
export function requirementLock(save: SaveData, requires: ModifierRequirement | undefined): string | null {
  if (requires === undefined) return null
  if ('discoveryId' in requires) {
    if (save.account.discoveries.includes(requires.discoveryId)) return null
    const place = Object.values(nodes).find((node) => node.discoveryId === requires.discoveryId)
    return `Discover ${place?.name ?? requires.discoveryId} first.`
  }
  if (enemyDefeatedByAnyHero(save, requires.enemyId)) return null
  return `Defeat ${enemies[requires.enemyId]?.name ?? requires.enemyId} with any hero first.`
}

/** Why a recipe cannot be learned yet, in the words the screen shows, or null when it is open. */
export function recipeLock(save: SaveData, modifierId: string): string | null {
  return requirementLock(save, ITEM_MODIFIERS[modifierId]?.requires)
}

/** Why a supply cannot be brewed yet, or null when it is open. */
export function supplyLock(save: SaveData, supplyId: string): string | null {
  return requirementLock(save, supplyTable[supplyId]?.requires)
}

/** The recipes the account has not learned yet, with their prices and the reason one is still locked. */
export function recipesForSale(save: SaveData): { modifierId: string; price: number; locked: string | null }[] {
  return Object.keys(ITEM_MODIFIERS)
    .filter((id) => !save.account.recipes.includes(id))
    .map((id) => ({ modifierId: id, price: recipePrice(id), locked: recipeLock(save, id) }))
}

/** Learn a modifier recipe for the whole account, paid with the selected hero's gold. */
export function buyRecipe(save: SaveData, modifierId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const modifier = ITEM_MODIFIERS[modifierId]
  if (modifier === undefined) return { ok: false, reason: 'Unknown recipe.' }
  if (save.account.recipes.includes(modifierId)) return { ok: false, reason: `You already know the ${modifier.name} recipe.` }
  const locked = recipeLock(save, modifierId)
  if (locked !== null) return { ok: false, reason: `The ${modifier.name} recipe is locked. ${locked}` }
  if (save.selectedHeroId === null) return { ok: false, reason: 'Select a hero to pay for the recipe.' }
  const hero = selectedHero(save)
  if (hero !== null && hero.progress.level < modifier.minLevel) {
    return { ok: false, reason: `The ${modifier.name} recipe needs level ${modifier.minLevel}. This hero is level ${hero.progress.level}.` }
  }
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

/** The last upgrade job queued for this item: the one that will hand it on or return it. */
function lastUpgradeJob(hero: SavedHero, itemId: string): UpgradeJob | undefined {
  let found: UpgradeJob | undefined
  for (const job of hero.purse.craftQueue) if (job.kind === 'upgrade' && job.item.id === itemId) found = job
  return found
}

/** What an upgrade job hands on or returns when it ends. Deterministic: no roll is involved. */
function afterUpgrade(job: UpgradeJob): ItemInstance {
  return { ...job.item, itemLevel: job.item.itemLevel + 1, quality: upgradedQuality(job.item.quality, job.materialId) }
}

export type UpgradeCandidate = {
  /** The item as it will be when the next job for it starts. For a queued item, the result of the jobs already queued. */
  item: ItemInstance
  /** The slot it is worn in (or was worn in when queued), or null for an archive item. */
  slot: EquipmentSlotId | null
  /** How many upgrade jobs are already queued for it. */
  queued: number
}

function queuedCount(hero: SavedHero, itemId: string): number {
  return hero.purse.craftQueue.filter((job) => job.kind === 'upgrade' && job.item.id === itemId).length
}

/** Everything the hero can upgrade: worn items and queued items from a slot in slot order, then queued archive items, then the archive. */
export function upgradeCandidates(hero: SavedHero): UpgradeCandidate[] {
  const bySlot: UpgradeCandidate[] = []
  const queuedOnly: UpgradeCandidate[] = []
  const seen = new Set<string>()
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const worn = hero.equipment[slot]
    if (worn !== null) {
      bySlot.push({ item: worn, slot, queued: 0 })
      continue
    }
    const held = hero.purse.craftQueue.find((job) => job.kind === 'upgrade' && job.slot === slot)
    if (held === undefined || held.kind !== 'upgrade' || seen.has(held.item.id)) continue
    const tail = lastUpgradeJob(hero, held.item.id)
    if (tail === undefined) continue
    seen.add(held.item.id)
    bySlot.push({ item: afterUpgrade(tail), slot, queued: queuedCount(hero, held.item.id) })
  }
  for (const job of hero.purse.craftQueue) {
    if (job.kind !== 'upgrade' || seen.has(job.item.id)) continue
    seen.add(job.item.id)
    const tail = lastUpgradeJob(hero, job.item.id)
    if (tail !== undefined) queuedOnly.push({ item: afterUpgrade(tail), slot: null, queued: queuedCount(hero, job.item.id) })
  }
  return [...bySlot, ...queuedOnly, ...hero.purse.archive.map((item) => ({ item, slot: null, queued: 0 }))]
}

/** Why an item from the hero's archive, one the hero wears, or one already queued for an upgrade cannot be upgraded (again), or null. */
export function upgradeCheck(save: SaveData, hero: SavedHero, item: ItemInstance | undefined, materialId: string): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (item === undefined) return 'That item is not in the archive or worn by this hero.'
  if (item.itemLevel >= hero.progress.level) return `This hero is level ${hero.progress.level}. An item cannot go above the hero's level.`
  if (MATERIAL_QUALITY[materialId] === undefined) return pickMaterialText()
  return spend(hero.purse, materialId, upgradeMaterialCost(materialId), upgradeGold(item.itemLevel))
}

/**
 * Pay for an upgrade and queue it. The item leaves the archive or its slot until the jobs end. An item that already
 * has an upgrade queued gets a chained job: the job before it hands the item on, and each job is checked against
 * the level the item will have when its turn comes.
 */
export function queueUpgrade(save: SaveData, heroId: string, itemId: string, materialId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const archived = hero.purse.archive.find((entry) => entry.id === itemId)
  const wornIn = archived === undefined ? wornSlot(hero, itemId) : null
  const tail = archived === undefined && wornIn === null ? lastUpgradeJob(hero, itemId) : undefined
  const slot = wornIn ?? tail?.slot ?? null
  const item = archived ?? (wornIn === null ? (tail === undefined ? undefined : afterUpgrade(tail)) : (hero.equipment[wornIn] ?? undefined))
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
  const paid = charge(hero.purse, materialId, upgradeMaterialCost(materialId), upgradeGold(item.itemLevel))
  const purse: Purse = {
    ...paid,
    craftCounter: paid.craftCounter + 1,
    archive: paid.archive.filter((entry) => entry.id !== itemId),
    craftQueue: [...paid.craftQueue.map((entry) => (entry === tail ? { ...entry, chained: true as const } : entry)), job],
  }
  const equipment = wornIn === null ? hero.equipment : { ...hero.equipment, [wornIn]: null }
  return {
    ok: true,
    save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment, purse } : entry)) },
  }
}

export type UpgradePlan = {
  jobs: { itemId: string; fromLevel: number; toLevel: number }[]
  gold: number
  material: number
}

/**
 * What "Queue all" would do with this material: +1 jobs for worn items, the lowest item level first, then slot order,
 * one level at a time, until the gold or the material runs out or every item is at the hero's level.
 */
export function planUpgradeAll(save: SaveData, hero: SavedHero, materialId: string, accepts: (baseId: string) => boolean = () => true): UpgradePlan {
  const plan: UpgradePlan = { jobs: [], gold: 0, material: 0 }
  if (closed(save) !== null || MATERIAL_QUALITY[materialId] === undefined) return plan
  const levels = upgradeCandidates(hero)
    .filter((entry) => entry.slot !== null && accepts(entry.item.baseId))
    .map((entry) => ({ itemId: entry.item.id, level: entry.item.itemLevel }))
  const unit = upgradeMaterialCost(materialId)
  for (;;) {
    let next: (typeof levels)[number] | undefined
    for (const entry of levels) if (entry.level < hero.progress.level && (next === undefined || entry.level < next.level)) next = entry
    if (next === undefined) break
    const gold = upgradeGold(next.level)
    if (plan.gold + gold > hero.purse.gold || plan.material + unit > (hero.purse.materials[materialId] ?? 0)) break
    plan.jobs.push({ itemId: next.itemId, fromLevel: next.level, toLevel: next.level + 1 })
    plan.gold += gold
    plan.material += unit
    next.level += 1
  }
  return plan
}

export type CraftNotice = { jobId: string; text: string; baseId: string }

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
    const tempered = job.modifierId === null ? item : withTempers(item, [temperGrade(job.modifierId, job.materialId)])
    const name = itemBase(job.baseId)?.name ?? job.baseId
    return {
      save: { ...save, heroes: keep(tempered) },
      notice: { jobId: job.id, baseId: job.baseId, text: `Crafted ${name}, item level ${job.itemLevel}, quality ${Math.round(quality * 1000) / 10}%.` },
    }
  }
  if (job.kind === 'pack') {
    const withPack = heroes.map((hero) => (hero.id === job.heroId ? { ...hero, pack: job.packId } : hero))
    return {
      save: { ...save, heroes: withPack },
      notice: { jobId: job.id, baseId: '', text: `Crafted a ${PACKS[job.packId].name}: ${PACKS[job.packId].slots} supply slots.` },
    }
  }
  if (job.kind === 'socket' || job.kind === 'infuse' || job.kind === 'rank') {
    const result = afterItemJob(job)
    const owner = heroes.find((entry) => entry.id === job.heroId)
    const slot = job.slot
    const back = slot !== undefined && owner !== undefined && owner.equipment[slot] === null
    const placed =
      back && slot !== undefined
        ? heroes.map((entry) => (entry.id === job.heroId ? { ...entry, equipment: { ...entry.equipment, [slot]: result } } : entry))
        : keep(result)
    const text =
      job.kind === 'socket'
        ? `${itemName(job.item)} now has a socket.`
        : job.kind === 'infuse'
          ? `${itemName(job.item)} was infused: ${itemName(result)}.`
          : `${itemName(job.item)} was ranked up: ${itemName(result)}.`
    return { save: { ...save, heroes: placed }, notice: { jobId: job.id, baseId: job.item.baseId, text } }
  }
  const returned = afterUpgrade(job)
  const name = itemBase(job.item.baseId)?.name ?? job.item.baseId
  if (job.chained === true) {
    // The next job for this item holds the upgraded copy, so nothing goes back to the slot or archive yet.
    return {
      save: { ...save, heroes },
      notice: { jobId: job.id, baseId: job.item.baseId, text: `${name} was upgraded to item level ${returned.itemLevel}.` },
    }
  }
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
      baseId: job.item.baseId,
      text: `${name} was upgraded to item level ${returned.itemLevel}.`,
    },
  }
}

/** A worn or archive item an Open socket or Infuse job can take, and the slot it is worn in (null for the archive). */
export type SocketTarget = { item: ItemInstance; slot: EquipmentSlotId | null }

/** The items an Open socket or Infuse job can take: worn items first in slot order, then the archive. Items held by a queued job are left out. */
export function socketTargets(hero: SavedHero): SocketTarget[] {
  const worn = EQUIPMENT_SLOT_IDS.flatMap((slot) => {
    const item = hero.equipment[slot]
    return item === null ? [] : [{ item, slot }]
  })
  return [...worn, ...hero.purse.archive.map((item) => ({ item, slot: null }))]
}

export function socketGold(itemLevel: number): number {
  return itemLevel * SOCKET_GOLD_PER_LEVEL
}

export function infuseGold(itemLevel: number): number {
  return itemLevel * INFUSE_GOLD_PER_LEVEL
}

function levelBlock(hero: SavedHero): string | null {
  return hero.progress.level < SOCKET_MIN_HERO_LEVEL ? `Sockets need hero level ${SOCKET_MIN_HERO_LEVEL}. This hero is level ${hero.progress.level}.` : null
}

/** The highest rank a free upgrade token can reach (Step 13.24): I to II only. */
export const FREE_RANK_MAX = 2

const NO_FREE_UPGRADE = 'You have no free upgrades. Clear a zone for the first time to earn one.'

/**
 * Why a socket cannot be opened on this item with this material, or null. With `free` the check is for a free
 * upgrade token (Step 13.24): no material and no gold, but a token is needed.
 */
export function socketCheck(save: SaveData, hero: SavedHero, item: ItemInstance | undefined, materialId: string, free = false): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (item === undefined) return 'That item is not in the archive or worn by this hero.'
  const low = levelBlock(hero)
  if (low !== null) return low
  if (item.socketed === true) return `${itemName(item)} already has a socket.`
  if (free) return (hero.freeUpgrades ?? 0) > 0 ? null : NO_FREE_UPGRADE
  if (!SOCKET_MATERIALS.includes(materialId)) return 'A socket needs riftglass, duskiron or cinderite.'
  return spend(hero.purse, materialId, SOCKET_MATERIAL_COST, socketGold(item.itemLevel))
}

/** Why this modifier cannot be infused into the item with this material, or null. */
export function infuseCheck(save: SaveData, hero: SavedHero, item: ItemInstance | undefined, modifierId: string, materialId: string): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (item === undefined) return 'That item is not in the archive or worn by this hero.'
  const low = levelBlock(hero)
  if (low !== null) return low
  if (item.socketed !== true) return `${itemName(item)} has no socket yet. Open one first.`
  if (item.modifiers.length < 1) return `${itemName(item)} has no first modifier. Infuse adds a second one.`
  const modifier = ITEM_MODIFIERS[modifierId]
  if (modifier === undefined) return 'Pick a modifier to infuse.'
  if (!save.account.recipes.includes(modifierId)) return `You have not learned the ${modifier.name} recipe.`
  const locked = recipeLock(save, modifierId)
  if (locked !== null) return `The ${modifier.name} recipe is locked. ${locked}`
  if (hero.progress.level < modifier.minLevel) return `${modifier.name} needs level ${modifier.minLevel}. This hero is level ${hero.progress.level}.`
  const base = itemBase(item.baseId)
  if (base === undefined || !modifierFits(modifier, base)) return `${modifier.name} can only go on ${appliesToText(modifier)}.`
  if (item.modifiers[0] === modifierId) return `${modifier.name} is already the first modifier. Pick a different one.`
  if (item.modifiers[1] === modifierId) return `${itemName(item)} already has ${modifier.name} in its socket.`
  if (MATERIAL_QUALITY[materialId] === undefined) return pickMaterialText()
  return spend(hero.purse, materialId, INFUSE_MATERIAL_COST, infuseGold(item.itemLevel))
}

/** The gold a rank-up to this rank costs for this modifier: its minimum level times 30 (II) or 60 (III). */
export function rankGold(modifierId: string, toRank: number): number {
  return (ITEM_MODIFIERS[modifierId]?.minLevel ?? 1) * (RANK_GOLD_PER_LEVEL[toRank] ?? 0)
}

/** The materials a rank-up to this rank accepts. */
export function rankMaterials(toRank: number): string[] {
  return toRank >= 3 ? [...SOCKET_MATERIALS] : materialIds()
}

/**
 * Why the modifier in this slot of the item cannot be raised one rank with this material, or null. With `free`
 * the check is for a free upgrade token (Step 13.24): no material and no gold, rank II at most, a token needed.
 */
export function rankCheck(save: SaveData, hero: SavedHero, item: ItemInstance | undefined, index: number, materialId: string, free = false): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  if (item === undefined) return 'That item is not in the archive or worn by this hero.'
  const id = item.modifiers[index]
  const modifier = id === undefined ? undefined : ITEM_MODIFIERS[id]
  if (id === undefined || modifier === undefined) return `${itemName(item)} has no modifier in that slot.`
  if (!rankable(modifier)) return `${modifier.name} has no number a rank could raise.`
  const current = modifierRankAt(item, index)
  if (current >= MODIFIER_RANK_MAX) return `${modifier.name} is already rank ${rankName(MODIFIER_RANK_MAX)}.`
  if (hero.progress.level < modifier.minLevel) return `${modifier.name} needs level ${modifier.minLevel}. This hero is level ${hero.progress.level}.`
  const toRank = current + 1
  if (free) {
    if (toRank > FREE_RANK_MAX) return 'A free upgrade ranks up to II only.'
    return (hero.freeUpgrades ?? 0) > 0 ? null : NO_FREE_UPGRADE
  }
  if (!rankMaterials(toRank).includes(materialId)) return toRank >= 3 ? 'Rank III needs riftglass, duskiron or cinderite.' : pickMaterialText()
  return spend(hero.purse, materialId, RANK_MATERIAL_COST[toRank] ?? 0, rankGold(id, toRank))
}

/** The item with its modifier ranks replaced. A list of only rank I is dropped, so unranked items stay as they were. */
function withRanks(item: ItemInstance, ranks: number[]): ItemInstance {
  const { modifierRanks: _old, ...rest } = item
  const filled = item.modifiers.map((_id, index) => ranks[index] ?? 1)
  return filled.every((rank) => rank === 1) ? rest : { ...rest, modifierRanks: filled }
}

/** The temper a material binds into a modifier: its grade, or 0 when the modifier has no numbers a temper could raise. */
export function temperGrade(modifierId: string, materialId: string): number {
  const modifier = ITEM_MODIFIERS[modifierId]
  return modifier !== undefined && rankable(modifier) ? (UPGRADE_QUALITY_POINTS[materialId] ?? 0) : 0
}

/** The item with its modifier tempers replaced. A list of only zeros is dropped, so untempered items stay as they were. */
function withTempers(item: ItemInstance, tempers: number[]): ItemInstance {
  const { modifierTempers: _old, ...rest } = item
  const filled = item.modifiers.map((_id, index) => tempers[index] ?? 0)
  return filled.every((temper) => temper === 0) ? rest : { ...rest, modifierTempers: filled }
}

type JobItem = { item: ItemInstance; slot: EquipmentSlotId | null }

/** The item a socket or infuse job works on: from the archive, or worn by the hero. Null when it is neither. */
function jobItem(hero: SavedHero, itemId: string): JobItem | null {
  const archived = hero.purse.archive.find((entry) => entry.id === itemId)
  if (archived !== undefined) return { item: archived, slot: null }
  const slot = wornSlot(hero, itemId)
  const worn = slot === null ? undefined : (hero.equipment[slot] ?? undefined)
  return slot === null || worn === undefined ? null : { item: worn, slot }
}

/** Take the item out of its slot or the archive, put the job last in the queue and pay for it. */
function queueItemJob(save: SaveData, hero: SavedHero, found: JobItem, job: CraftJob, materialId: string, quantity: number, gold: number): RosterResult {
  const paid = charge(hero.purse, materialId, quantity, gold)
  const purse: Purse = {
    ...paid,
    craftCounter: paid.craftCounter + 1,
    archive: paid.archive.filter((entry) => entry.id !== found.item.id),
    craftQueue: [...paid.craftQueue, job],
  }
  const equipment = found.slot === null ? hero.equipment : { ...hero.equipment, [found.slot]: null }
  return { ok: true, save: { ...save, heroes: save.heroes.map((entry) => (entry.id === hero.id ? { ...entry, equipment, purse } : entry)) } }
}

/** Pay for an Open socket job and queue it. The item leaves its slot or the archive until the job ends. */
export function queueSocket(save: SaveData, heroId: string, itemId: string, materialId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const found = jobItem(hero, itemId)
  const problem = socketCheck(save, hero, found?.item, materialId)
  if (problem !== null || found === null) return { ok: false, reason: problem ?? 'That item is not in the archive or worn by this hero.' }
  const job: CraftJob = {
    id: nextJobId(hero.purse),
    kind: 'socket',
    heroId,
    item: found.item,
    ...(found.slot === null ? {} : { slot: found.slot }),
    materialId,
    remainingMs: CRAFT_MS,
    seedIndex: hero.purse.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  return queueItemJob(save, hero, found, job, materialId, SOCKET_MATERIAL_COST, socketGold(found.item.itemLevel))
}

/** Pay for an Infuse job and queue it. Infusing an item that already has a second modifier replaces that one. */
export function queueInfuse(save: SaveData, heroId: string, itemId: string, modifierId: string, materialId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const found = jobItem(hero, itemId)
  const problem = infuseCheck(save, hero, found?.item, modifierId, materialId)
  if (problem !== null || found === null) return { ok: false, reason: problem ?? 'That item is not in the archive or worn by this hero.' }
  const job: CraftJob = {
    id: nextJobId(hero.purse),
    kind: 'infuse',
    heroId,
    item: found.item,
    ...(found.slot === null ? {} : { slot: found.slot }),
    modifierId,
    materialId,
    remainingMs: CRAFT_MS,
    seedIndex: hero.purse.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  return queueItemJob(save, hero, found, job, materialId, INFUSE_MATERIAL_COST, infuseGold(found.item.itemLevel))
}

/** Pay for a Rank up job (one modifier, one rank) and queue it. */
export function queueRankUp(save: SaveData, heroId: string, itemId: string, index: number, materialId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const found = jobItem(hero, itemId)
  const problem = rankCheck(save, hero, found?.item, index, materialId)
  if (problem !== null || found === null) return { ok: false, reason: problem ?? 'That item is not in the archive or worn by this hero.' }
  const toRank = modifierRankAt(found.item, index) + 1
  const job: CraftJob = {
    id: nextJobId(hero.purse),
    kind: 'rank',
    heroId,
    item: found.item,
    ...(found.slot === null ? {} : { slot: found.slot }),
    modifierIndex: index,
    toRank,
    materialId,
    remainingMs: CRAFT_MS,
    seedIndex: hero.purse.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  return queueItemJob(save, hero, found, job, materialId, RANK_MATERIAL_COST[toRank] ?? 0, rankGold(found.item.modifiers[index] ?? '', toRank))
}

/** What a free upgrade token does to one item. */
export type FreeUpgradeChoice = { kind: 'socket' } | { kind: 'rank'; index: number }

/**
 * Spend one free upgrade token (Step 13.24) on a worn or archive item, instantly (not a craft job): open its
 * socket, or raise one modifier from rank I to II. Quality, tempers, heirloom status and durability stay as they
 * were. The same refusals as the paid jobs (an expedition, a held item, hero level) apply.
 */
export function spendFreeUpgrade(save: SaveData, heroId: string, itemId: string, choice: FreeUpgradeChoice): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const found = jobItem(hero, itemId)
  const problem = choice.kind === 'socket' ? socketCheck(save, hero, found?.item, '', true) : rankCheck(save, hero, found?.item, choice.index, '', true)
  if (problem !== null || found === null) return { ok: false, reason: problem ?? 'That item is not in the archive or worn by this hero.' }
  let upgraded: ItemInstance
  if (choice.kind === 'socket') {
    upgraded = { ...found.item, socketed: true }
  } else {
    const ranks = found.item.modifiers.map((_id, index) => modifierRankAt(found.item, index))
    ranks[choice.index] = modifierRankAt(found.item, choice.index) + 1
    upgraded = withRanks(found.item, ranks)
  }
  const tokens = (hero.freeUpgrades ?? 0) - 1
  const purse: Purse =
    found.slot === null ? { ...hero.purse, archive: hero.purse.archive.map((entry) => (entry.id === upgraded.id ? upgraded : entry)) } : hero.purse
  const equipment = found.slot === null ? hero.equipment : { ...hero.equipment, [found.slot]: upgraded }
  return { ok: true, save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment, purse, freeUpgrades: tokens } : entry)) } }
}

/** The item a finished socket, infuse or rank job hands back. */
function afterItemJob(job: Extract<CraftJob, { kind: 'socket' | 'infuse' | 'rank' }>): ItemInstance {
  // The socket's material also lifts quality as an upgrade would (riftglass +3 up to 112%, duskiron +4 up to 116%, cinderite +5 up to 120%).
  if (job.kind === 'socket') return { ...job.item, socketed: true, quality: upgradedQuality(job.item.quality, job.materialId) }
  const tempers = job.item.modifiers.map((_id, index) => modifierTemperAt(job.item, index))
  if (job.kind === 'rank') {
    const ranks = job.item.modifiers.map((_id, index) => modifierRankAt(job.item, index))
    ranks[job.modifierIndex] = job.toRank
    const grade = temperGrade(job.item.modifiers[job.modifierIndex] ?? '', job.materialId)
    tempers[job.modifierIndex] = Math.max(tempers[job.modifierIndex] ?? 0, grade)
    return withTempers(withRanks(job.item, ranks), tempers)
  }
  const infused: ItemInstance = { ...job.item, socketed: true, modifiers: [job.item.modifiers[0] ?? job.modifierId, job.modifierId].slice(0, MAX_ITEM_MODIFIERS) }
  // The new second modifier starts at rank I, with the temper of the infuse material.
  return withTempers(withRanks(infused, [modifierRankAt(job.item, 0), 1]), [tempers[0] ?? 0, temperGrade(job.modifierId, job.materialId)])
}

/** The materials a pack can be crafted from: grade (`UPGRADE_QUALITY_POINTS`) at or above the pack's minimum. */
export function packMaterials(packId: PackId): string[] {
  return materialIds().filter((id) => (UPGRADE_QUALITY_POINTS[id] ?? 0) >= PACKS[packId].minGrade)
}

/** Why this pack cannot be crafted now from this material, or null. A queued Satchel does not count for the Field Pack. */
export function packCheck(save: SaveData, hero: SavedHero, packId: PackId, materialId: string): string | null {
  const shut = closed(save)
  if (shut !== null) return shut
  const def = PACKS[packId]
  if (hero.pack === packId) return `${hero.name} already has a ${def.name}.`
  if (hero.pack === 'fieldPack') return `${hero.name} already has a better pack than the ${def.name}.`
  if (hero.purse.craftQueue.some((job) => job.kind === 'pack' && job.packId === packId)) return `A ${def.name} is already being made.`
  if (def.needs !== undefined && hero.pack !== def.needs) return `The ${def.name} needs the ${PACKS[def.needs].name} first.`
  if (hero.progress.level < def.minHeroLevel) return `The ${def.name} needs hero level ${def.minHeroLevel}. This hero is level ${hero.progress.level}.`
  if (MATERIAL_QUALITY[materialId] === undefined) return pickMaterialText()
  if (!packMaterials(packId).includes(materialId)) return `The ${def.name} needs ${packMaterials(packId).join(', ')} (grade ${def.minGrade} or better).`
  return spend(hero.purse, materialId, def.units, def.gold)
}

/** Pay for a pack and queue it (30 s, like every job). The slots change when the job ends. */
export function queuePack(save: SaveData, heroId: string, packId: PackId, materialId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const problem = packCheck(save, hero, packId, materialId)
  if (problem !== null) return { ok: false, reason: problem }
  const job: CraftJob = {
    id: nextJobId(hero.purse),
    kind: 'pack',
    heroId,
    packId,
    materialId,
    remainingMs: CRAFT_MS,
    seedIndex: hero.purse.craftCounter,
    rank: proficiencyRank(hero.craftXp),
  }
  const purse = charge(hero.purse, materialId, PACKS[packId].units, PACKS[packId].gold)
  return { ok: true, save: withPurse(save, { ...purse, craftCounter: purse.craftCounter + 1, craftQueue: [...purse.craftQueue, job] }, heroId) }
}

/** True when any hero has a job queued. */
export function anyCrafting(save: SaveData): boolean {
  return save.heroes.some((hero) => hero.purse.craftQueue.length > 0)
}

/**
 * Let time pass for every hero's queue, in town or out on an expedition (decided 2026-11-04). Only
 * the first job of a queue advances. Time left over when a job ends goes to that hero's next one.
 */
export function advanceCrafting(save: SaveData, elapsedMs: number): { save: SaveData; finished: CraftNotice[] } {
  if (!anyCrafting(save) || !(elapsedMs > 0)) return { save, finished: [] }
  let current = save
  const finished: CraftNotice[] = []
  for (const hero of save.heroes) {
    let left = elapsedMs
    while (left > 0 && purseOf(current, hero.id).craftQueue.length > 0) {
      const [job, ...rest] = purseOf(current, hero.id).craftQueue
      if (job === undefined) break
      if (job.remainingMs > left) {
        current = updatePurse(current, { craftQueue: [{ ...job, remainingMs: job.remainingMs - left }, ...rest] }, hero.id)
        left = 0
        break
      }
      left -= job.remainingMs
      const done = finishJob(job, updatePurse(current, { craftQueue: rest }, hero.id))
      current = done.save
      finished.push({ ...done.notice, text: `${hero.name}: ${done.notice.text}` })
    }
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
