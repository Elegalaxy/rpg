import { racialStartingAttributes } from '../content/heroes.ts'
import { itemBase, starterEquipment } from '../content/items.ts'
import { nodes } from '../content/world.ts'
import { classWebs } from '../content/webs/index.ts'
import { EQUIPMENT_SLOT_IDS, equipItem, slotsFor, type EquipmentSlotId, type ItemInstance } from '../sim/economy.ts'
import { awardXp, createProgress, legacyFromProgress, type HeroProgress } from '../sim/progression.ts'
import { cumulativeXpToReachLevel, type Attributes } from '../sim/stats.ts'

import { DEEP_POCKETS_COST } from './bag.ts'
import { wearerOf } from './equipment.ts'
import { STOCKPILE_COSTS, carriedPurse, carryOver, type CarryOver } from './carryOver.ts'
import { carriedSetup, type SetupStats } from './pastSetup.ts'
import { quiverLimit } from './preparation.ts'
import { unionElites } from './remembered.ts'
import { reachMilestone, type HeroPurchases, type SaveData, type SavedHero } from './save.ts'
import type { RosterResult } from './roster.ts'

export const MASTERY_MAX = 10
export const MASTERY_XP_PER_RANK = 0.02

export const ELITE_BONUS = 3
export const BOSS_BONUS = 20
export const RANK_BONUS = 5
/** Legacy for the first clear of each of the three late zones (Step 13.24). */
export const ZONE_CLEAR_BONUS = 2
/** The zones that pay `ZONE_CLEAR_BONUS`, each read from `firstClearIds`. */
export const LEGACY_ZONES: readonly string[] = ['drowned-causeway', 'rift-hollows', 'cinder-scar']

export const ATTRIBUTE_SEED_COST = 3
export const ATTRIBUTE_SEED_MAX = 10
export const SKILL_SEED_COSTS: readonly number[] = [8, 12, 16]
export const SECOND_HEIRLOOM_COST = 25
/** Head Start tiers (Step 13.18): the level each new life starts at, and the Legacy each tier costs. */
export const HEAD_START_LEVELS: readonly number[] = [5, 10, 15]
export const HEAD_START_COSTS: readonly number[] = [20, 35, 55]
/** Third Heirloom (Step 13.31): keep a third heirloom. Needs the Second Heirloom. */
export const THIRD_HEIRLOOM_COST = 50
/** Fifth Skill Slot (Step 13.34): equip five skills instead of four. */
export const FIFTH_SLOT_COST = 90
/** Artisan's Favor tiers: free upgrade tokens each new life starts with, and the Legacy each tier costs. */
export const ARTISAN_TOKENS: readonly number[] = [1, 2]
export const ARTISAN_COSTS: readonly number[] = [30, 45]
/** Long Memory tiers: the levels above the peak that Recall reaches, and the Legacy each tier costs. */
export const LONG_MEMORY_LEVELS: readonly number[] = [3, 6]
export const LONG_MEMORY_COSTS: readonly number[] = [25, 40]

export type Bonus = { id: string; text: string; amount: number }

/** Mastery rank: lives completed, up to 10. It adds 2% ordinary XP per rank and nothing else. */
export function masteryRank(hero: SavedHero): number {
  return hero.lives > MASTERY_MAX ? MASTERY_MAX : hero.lives
}

export function masteryXpFactor(rank: number): number {
  return 1 + MASTERY_XP_PER_RANK * rank
}

/** The level Recall doubles run XP up to: the peak plus the Long Memory levels, or null without a peak. */
export function recallTarget(hero: SavedHero): number | null {
  const peak = hero.peakLevel
  if (peak === undefined) return null
  return peak + (LONG_MEMORY_LEVELS[(hero.purchases.longMemory ?? 0) - 1] ?? 0)
}

/** XP the hero still needs to reach their recall target from where they stand. 0 without a peak or at or above it. */
export function recallNeed(hero: SavedHero): number {
  const target = recallTarget(hero)
  if (target === null) return 0
  const need = cumulativeXpToReachLevel(target) - (cumulativeXpToReachLevel(hero.progress.level) + hero.progress.xp)
  return need > 0 ? need : 0
}

/**
 * Recall (Step 13.18): run XP counts double while the hero is below their peak level. The part that
 * reaches the peak is doubled and the rest counts once. Drills and other XP are not passed through here.
 */
export function recallXp(hero: SavedHero, xp: number): number {
  const need = recallNeed(hero)
  if (need <= 0 || xp <= 0) return xp
  if (2 * xp <= need) return 2 * xp
  return need + (xp - Math.ceil(need / 2))
}

/** One-time bonuses this hero has earned and not yet been paid, from what they have reached this life. */
export function bonusesDue(hero: SavedHero): Bonus[] {
  const due: Bonus[] = []
  const reached = (id: string): boolean => hero.defeatedEnemyIds.includes(id)
  const add = (id: string, text: string, amount: number): void => {
    if (!hero.claimedBonuses.includes(id)) due.push({ id, text, amount })
  }
  if (reached('rootmaw-stalker')) add('elite:rootmaw-stalker', 'First defeat of the Rootmaw Stalker', ELITE_BONUS)
  if (reached('echo-knight')) add('elite:echo-knight', 'First defeat of the Echo Knight', ELITE_BONUS)
  if (reached('tidebound-colossus')) add('elite:tidebound-colossus', 'First defeat of the Tidebound Colossus', ELITE_BONUS)
  if (reached('hollowmaw-reaver')) add('elite:hollowmaw-reaver', 'First defeat of the Hollowmaw Reaver', ELITE_BONUS)
  if (reached('emberwrought-tyrant')) add('elite:emberwrought-tyrant', 'First defeat of the Emberwrought Tyrant', ELITE_BONUS)
  if (reached('fractured-warden')) add('boss:fractured-warden', 'First defeat of the Fractured Warden', BOSS_BONUS)
  for (const nodeId of LEGACY_ZONES) {
    // Reads firstClearIds (paid on a safe return), not clearedNodeIds, so a defeated run cannot bank it early.
    if ((hero.firstClearIds ?? []).includes(nodeId)) add(`zone:${nodeId}`, `First clear of the ${nodes[nodeId]?.name ?? nodeId}`, ZONE_CLEAR_BONUS)
  }
  for (let rank = 1; rank <= hero.echoRank; rank += 1) add(`rank:${rank}`, `Echo rank ${rank} first unlocked`, RANK_BONUS)
  return due
}

export type LegacyPreview = {
  fromLevel: number
  bonuses: Bonus[]
  total: number
}

export function legacyPreview(hero: SavedHero): LegacyPreview {
  const fromLevel = legacyFromProgress(hero.progress)
  const bonuses = bonusesDue(hero)
  return { fromLevel, bonuses, total: fromLevel + bonuses.reduce((sum, bonus) => sum + bonus.amount, 0) }
}

export type BossFaced = 'lost' | 'won' | 'both' | null

/**
 * How the hero has faced a boss this life (Step 13.27). A loss sets `bossLossThisLife`. A Fractured Warden
 * victory raises `echoRank` above 0 (reincarnation resets both), so no extra saved field is needed.
 */
export function bossFaced(hero: Pick<SavedHero, 'bossLossThisLife' | 'echoRank'>): BossFaced {
  const lost = hero.bossLossThisLife
  const won = hero.echoRank > 0
  return lost && won ? 'both' : lost ? 'lost' : won ? 'won' : null
}

/** Null when the hero can reincarnate. A boss must have been faced this life: a loss, with its defeat costs paid, or a victory. */
export function reincarnationBlock(save: SaveData, hero: SavedHero): string | null {
  if (save.expedition !== null) return 'Finish the expedition first.'
  if ((hero.training?.queue.length ?? 0) > 0) return 'Wait for the Trainer: drills are queued or running. They finish first.'
  if (hero.purse.craftQueue.length > 0) return 'Wait for the crafters: jobs are queued or running. They finish first.'
  if (bossFaced(hero) === null) return 'Face a boss first. Reincarnation opens after you lose to or defeat the Fractured Warden this life.'
  return null
}

/** How many heirlooms this hero may keep: one, plus the Second and the Third Heirloom. */
export function heirloomAllowance(hero: SavedHero): number {
  return 1 + (hero.purchases.secondHeirloom ? 1 : 0) + (hero.purchases.thirdHeirloom === true ? 1 : 0)
}

export function heirloomLevel(item: ItemInstance, heroLevel: number): number {
  const cap = item.heirloom?.cap ?? item.itemLevel
  const level = heroLevel < cap ? heroLevel : cap
  return level < 1 ? 1 : level
}

function allItems(hero: SavedHero): ItemInstance[] {
  const equipped = EQUIPMENT_SLOT_IDS.flatMap((slot) => {
    const item = hero.equipment[slot]
    return item === null ? [] : [item]
  })
  return [...equipped, ...hero.purse.archive]
}

/** How many heirloom slots this hero has free right now (the allowance minus items already flagged for them). */
export function freeHeirloomSlots(hero: SavedHero): number {
  const used = allItems(hero).filter((item) => item.heirloom?.heroId === hero.id).length
  return Math.max(0, heirloomAllowance(hero) - used)
}

/** Heirloom slots the hero owns, how many hold an item and how many are free (Step 13.45). */
export function heirloomSlotUse(hero: SavedHero): { owned: number; used: number; free: number } {
  const owned = heirloomAllowance(hero)
  const used = allItems(hero).filter((item) => item.heirloom?.heroId === hero.id).length
  return { owned, used, free: Math.max(0, owned - used) }
}

/**
 * Why "Make heirloom now" cannot be used right now, or null when it can: an expedition is running, every slot holds an item,
 * or the hero owns nothing that could become one. Checked in that order, so the reason is the first thing to fix.
 */
export function heirloomClaimBlock(hero: SavedHero, running: boolean): string | null {
  if (running) return 'Finish the expedition first.'
  const { owned, used, free } = heirloomSlotUse(hero)
  if (free <= 0) {
    return `No heirloom slot is free: you own ${owned} ${owned === 1 ? 'slot' : 'slots'} and ${used} ${used === 1 ? 'is' : 'are'} used. Buy another slot, or choose at reincarnation.`
  }
  if (claimableItems(hero).length === 0) return 'You own nothing that could become an heirloom yet.'
  return null
}

/** Worn and archived items this hero could make an heirloom now: not already an heirloom of anyone. */
export function claimableItems(hero: SavedHero): ItemInstance[] {
  return allItems(hero).filter((item) => item.heirloom === undefined)
}

/** Step 13.46: the claimable items for the picker, best first (item level, then quality), with whether each is worn. */
export function claimOptions(hero: SavedHero): { item: ItemInstance; worn: boolean }[] {
  const wornIds = new Set<string>()
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const worn = hero.equipment[slot]
    if (worn !== null) wornIds.add(worn.id)
  }
  return claimableItems(hero)
    .map((item) => ({ item, worn: wornIds.has(item.id) }))
    .sort((a, b) => b.item.itemLevel - a.item.itemLevel || b.item.quality - a.item.quality || a.item.id.localeCompare(b.item.id))
}

/**
 * Step 13.32: use a free heirloom slot on an item right now, without reincarnating. The item keeps its level
 * as the cap and is scaled to the hero's level at once. No gold or materials. Earlier-life gear stays in
 * `pastLifeItemIds`, so the carried-share sell guard is unchanged (an heirloom cannot be sold at all).
 */
export function claimHeirloom(save: SaveData, heroId: string, itemId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Finish the expedition first.' }
  const item = allItems(hero).find((entry) => entry.id === itemId)
  if (item === undefined) return { ok: false, reason: 'That item is not yours to keep.' }
  if (item.heirloom !== undefined) {
    return { ok: false, reason: item.heirloom.heroId === heroId ? 'That item is already an heirloom.' : "That is another hero's heirloom." }
  }
  if (freeHeirloomSlots(hero) <= 0) return { ok: false, reason: 'No heirloom slot is free. Buy another slot, or choose at reincarnation.' }
  const mark = (entry: ItemInstance): ItemInstance => (entry.id === itemId ? { ...entry, heirloom: { heroId, cap: entry.itemLevel } } : entry)
  const equipment = { ...hero.equipment }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const worn = equipment[slot]
    if (worn !== null) equipment[slot] = mark(worn)
  }
  const claimed: SavedHero = { ...hero, equipment, purse: { ...hero.purse, archive: hero.purse.archive.map(mark) } }
  const next: SaveData = { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? claimed : entry)) }
  const scaled = scaleHeirlooms(next, heroId)
  return { ok: true, save: scaled, hero: scaled.heroes.find((entry) => entry.id === heroId) ?? claimed }
}

/** Bring every one of this hero's heirlooms to the level their level allows. Run after any level change. */
export function scaleHeirlooms(save: SaveData, heroId: string): SaveData {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return save
  let changed = false
  const fix = (item: ItemInstance): ItemInstance => {
    if (item.heirloom === undefined || item.heirloom.heroId !== heroId) return item
    const level = heirloomLevel(item, hero.progress.level)
    if (level === item.itemLevel) return item
    changed = true
    return { ...item, itemLevel: level }
  }
  const equipment = { ...hero.equipment }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = equipment[slot]
    if (item !== null) equipment[slot] = fix(item)
  }
  const archive = hero.purse.archive.map(fix)
  if (!changed) return save
  return {
    ...save,
    heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment, purse: { ...entry.purse, archive } } : entry)),
  }
}

function startingAttributes(hero: SavedHero): Attributes {
  const base = racialStartingAttributes[hero.progress.race]
  const seeds = hero.purchases.attributeSeeds
  return {
    strength: base.strength + seeds.strength,
    vitality: base.vitality + seeds.vitality,
    agility: base.agility + seeds.agility,
    intellect: base.intellect + seeds.intellect,
    spirit: base.spirit + seeds.spirit,
  }
}

/** Free upgrade tokens a new life starts with from Artisan's Favor. */
export function artisanTokens(purchases: HeroPurchases): number {
  return ARTISAN_TOKENS[(purchases.artisan ?? 0) - 1] ?? 0
}

/** What a new life starts with: the racial base, the seeds, the Head Start level and the Skill Point Seeds. */
export function startingProgress(hero: SavedHero): HeroProgress {
  const web = classWebs[hero.classId]
  const fresh = createProgress(hero.progress.race, startingAttributes(hero), { startingSkillIds: web.startingSkillIds })
  // Head Start: the XP of that level. The attribute and skill points of those levels stay unspent.
  const startLevel = headStartLevel(hero.purchases)
  const progress = startLevel > 1 ? awardXp(fresh, cumulativeXpToReachLevel(startLevel)) : fresh
  progress.legacySkillPoints = hero.purchases.skillSeeds
  return progress
}

export type NextLife = {
  /** Names of the discovered zones whose elite gates stay open next life. */
  zones: string[]
  /** The level Recall doubles run XP up to, or null when the hero would have no peak above their start. */
  recallUntil: number | null
  /** What the reincarnation keeps of gold, debt, materials and supplies (Step 13.31). */
  carry: CarryOver
  /** Free upgrade tokens the hero will hold at the start of the next life. */
  tokens: number
  startLevel: number
  attributePoints: number
  skillPoints: number
  /** What the combat setup keeps (Step 13.37): rules (Default and stacks), stacks, and rules waiting for a skill. */
  setup: SetupStats
}

/** What the next life will start with, as the Legacy screen shows it. */
export function nextLifePreview(hero: SavedHero, discoveries: readonly string[]): NextLife {
  const remembered = unionElites(hero.rememberedEnemyIds, hero.defeatedEnemyIds)
  const zones = Object.values(nodes)
    .filter((node) => node.kind === 'zone' && node.gate !== undefined && discoveries.includes(node.discoveryId))
    .filter((node) => node.gate!.defeatedEnemyIds.every((id) => remembered.includes(id)))
    .map((node) => node.name)
  const start = startingProgress(hero)
  const peak = Math.max(hero.peakLevel ?? 0, hero.progress.level)
  const target = peak + (LONG_MEMORY_LEVELS[(hero.purchases.longMemory ?? 0) - 1] ?? 0)
  return {
    zones,
    recallUntil: target > start.level ? target : null,
    carry: carryOver(hero),
    tokens: (hero.freeUpgrades ?? 0) + artisanTokens(hero.purchases),
    startLevel: start.level,
    attributePoints: start.unspentAttributePoints,
    skillPoints: start.unspentSkillPoints,
    setup: carriedSetup(hero, start).stats,
  }
}

/**
 * Reincarnate a hero. Level, XP, attributes, the skill web, personal gates and Echo ranks, and the
 * hero's contracts reset. Mastery, purchases, Legacy, discoveries, recipes, crafting experience,
 * the hero's deposited gold, materials, debt, and archive stay. All worn gear goes to the archive and the hero gets
 * fresh starter gear, and the chosen items become heirlooms. Each heirloom that fits is worn
 * in place of the starter piece. One that does not fit stays in the archive.
 * A single id, or null, still keeps older heirlooms in any slot that pick leaves free.
 * A list is the player's full choice: only those items stay heirlooms.
 */
export function reincarnate(
  save: SaveData,
  heroId: string,
  heirloomItemId: string | null | readonly string[],
  plan: readonly PlannedPurchase[] = [],
): RosterResult {
  const current = save.heroes.find((entry) => entry.id === heroId)
  if (current === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const block = reincarnationBlock(save, current)
  if (block !== null) return { ok: false, reason: block }
  // Step 13.36: this life's Legacy is banked and the plan is bought first; the rest reads the staged hero.
  const staged = stageNextLife(current, plan)
  if (!staged.ok) return { ok: false, reason: staged.reason }
  const hero = staged.hero
  const preview = staged.gained

  const owned = allItems(hero)
  const explicit = Array.isArray(heirloomItemId)
  const requested: string[] = []
  const seen = new Set<string>()
  const raw = explicit ? heirloomItemId : heirloomItemId === null || heirloomItemId === '' ? [] : [heirloomItemId]
  for (const id of raw) {
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    requested.push(id)
  }
  const allowance = heirloomAllowance(hero)
  if (requested.length > allowance) {
    return { ok: false, reason: `You can keep ${allowance} ${allowance === 1 ? 'heirloom' : 'heirlooms'}.` }
  }
  for (const id of requested) {
    const item = owned.find((entry) => entry.id === id)
    if (item === undefined) return { ok: false, reason: 'That item is not yours to keep.' }
    if (item.heirloom !== undefined && item.heirloom.heroId !== heroId) return { ok: false, reason: 'That is another hero\'s heirloom.' }
  }

  const lives = hero.lives + 1
  const progress = startingProgress(hero)
  const setup = carriedSetup(hero, progress)

  // Every worn item goes to the archive. Heirlooms already kept stay flagged up to the allowance.
  const preferred = new Map<string, EquipmentSlotId>()
  const archive: ItemInstance[] = [...hero.purse.archive]
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = hero.equipment[slot]
    if (item === null) continue
    preferred.set(item.id, slot)
    archive.push(item)
  }
  const chosen = new Set(requested)
  const previous = archive.filter((item) => item.heirloom?.heroId === heroId && !chosen.has(item.id))
  const room = explicit ? 0 : Math.max(0, allowance - chosen.size)
  const keepPrevious = new Set(previous.slice(0, room).map((item) => item.id))
  const nextArchive = archive.map((item): ItemInstance => {
    let next = item
    if (chosen.has(item.id) || keepPrevious.has(item.id)) {
      const cap = item.heirloom?.cap ?? item.itemLevel
      next = { ...item, heirloom: { heroId, cap } }
    } else if (item.heirloom?.heroId === heroId) {
      const { heirloom, ...plain } = item
      next = { ...plain, itemLevel: heirloom.cap }
    }
    // Wear belonged to the life that ended. A new life starts every kept piece at full durability.
    return next.durability === next.maxDurability ? next : { ...next, durability: next.maxDurability }
  })

  const renewed: SavedHero = {
    ...hero,
    progress,
    // Step 13.37: the combat setup carries; rules for skills not relearned yet wait.
    priorityRows: setup.priorityRows,
    ruleStacks: setup.ruleStacks,
    pastLoadouts: setup.pastLoadouts,
    specialAmmo: hero.classId === 'ranger' ? Math.min(hero.specialAmmo, quiverLimit({ ...hero, progress })) : hero.specialAmmo,
    defeatedEnemyIds: [],
    rememberedEnemyIds: unionElites(hero.rememberedEnemyIds, hero.defeatedEnemyIds),
    clearedNodeIds: [],
    echoRank: 0,
    fightRank: 0,
    bossLossThisLife: false,
    drillsThisLevel: 0,
    legacy: hero.legacy,
    lives,
    peakLevel: Math.max(hero.peakLevel ?? 0, hero.progress.level),
    claimedBonuses: [...hero.claimedBonuses, ...preview.bonuses.map((bonus) => bonus.id)],
    equipment: starterEquipment(hero.id, hero.classId, lives),
    // Step 13.31: only the carried share of gold, debt, materials and supplies stays; all gear stays.
    purse: carriedPurse({ ...hero.purse, archive: nextArchive, contracts: [] }, carryOver(hero)),
    pastLifeItemIds: nextArchive.map((item) => item.id),
    freeUpgrades: (hero.freeUpgrades ?? 0) + artisanTokens(hero.purchases),
  }
  delete renewed.pastLoadout
  // Step 13.43: the planner's saved plan was spent by this reincarnation.
  delete renewed.nextLifePlan
  if (setup.waitingSkillIds.length > 0) renewed.waitingSkillIds = setup.waitingSkillIds
  else delete renewed.waitingSkillIds
  const account = reachMilestone(save.account, 'first-reincarnation')
  const next: SaveData = { ...save, account, heroes: save.heroes.map((entry) => (entry.id === heroId ? renewed : entry)) }
  const equipped = equipOwnedHeirlooms(scaleHeirlooms(next, heroId), heroId, preferred)
  const heroNow = equipped.heroes.find((entry) => entry.id === heroId) ?? renewed
  return { ok: true, save: equipped, hero: heroNow }
}

/** Wear this hero's heirlooms over the starter set. A slot keeps the first heirloom that lands there. */
function equipOwnedHeirlooms(save: SaveData, heroId: string, preferred: ReadonlyMap<string, EquipmentSlotId>): SaveData {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return save
  const wearer = wearerOf(hero)
  let equipment = hero.equipment
  let archive = hero.purse.archive
  const ids = archive.filter((item) => item.heirloom?.heroId === heroId).map((item) => item.id)
  ids.sort((a, b) => {
    const left = preferred.get(a)
    const right = preferred.get(b)
    const rank = (slot: EquipmentSlotId | undefined) => (slot === undefined ? EQUIPMENT_SLOT_IDS.length : EQUIPMENT_SLOT_IDS.indexOf(slot))
    return rank(left) - rank(right)
  })
  for (const id of ids) {
    const item = archive.find((entry) => entry.id === id)
    const base = item === undefined ? undefined : itemBase(item.baseId)
    if (item === undefined || base === undefined) continue
    const first = preferred.get(id)
    const slots = first === undefined ? slotsFor(base) : [first, ...slotsFor(base).filter((slot) => slot !== first)]
    for (const slot of slots) {
      if (equipment[slot]?.heirloom?.heroId === heroId) continue
      const result = equipItem(equipment, archive, id, slot, hero.progress.level, itemBase, wearer)
      if (!result.ok) continue
      equipment = result.equipment
      archive = result.archive
      break
    }
  }
  if (equipment === hero.equipment) return save
  return {
    ...save,
    heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment, purse: { ...entry.purse, archive } } : entry)),
  }
}

export type PurchaseKind = 'attribute' | 'skill' | 'heirloom' | 'pockets' | 'headStart' | 'stockpile' | 'artisan' | 'memory' | 'fifthSlot'

/** The level each new life starts at: 1, or the level of the Head Start tier bought. */
export function headStartLevel(purchases: HeroPurchases): number {
  return HEAD_START_LEVELS[purchases.headStart - 1] ?? 1
}

/** The Legacy cost of the next Head Start tier, or null when all are bought. */
export function headStartCost(purchases: HeroPurchases): number | null {
  return HEAD_START_COSTS[purchases.headStart] ?? null
}

export function skillSeedCost(purchases: HeroPurchases): number | null {
  return SKILL_SEED_COSTS[purchases.skillSeeds] ?? null
}

export function attributeSeedTotal(purchases: HeroPurchases): number {
  const seeds = purchases.attributeSeeds
  return seeds.strength + seeds.vitality + seeds.agility + seeds.intellect + seeds.spirit
}

export type PurchasePrice = { ok: true; cost: number; purchases: HeroPurchases } | { ok: false; reason: string }

/** The price and the purchases a buy would leave, or why it is refused. Reads only the hero's Legacy and purchases. */
function pricePurchase(hero: SavedHero, kind: PurchaseKind, attribute?: keyof HeroPurchases['attributeSeeds']): PurchasePrice {
  let cost: number
  let purchases: HeroPurchases = hero.purchases
  if (kind === 'attribute') {
    if (attribute === undefined || !(attribute in hero.purchases.attributeSeeds)) return { ok: false, reason: 'Pick an attribute.' }
    if (attributeSeedTotal(hero.purchases) >= ATTRIBUTE_SEED_MAX) return { ok: false, reason: `You already have ${ATTRIBUTE_SEED_MAX} attribute seeds.` }
    cost = ATTRIBUTE_SEED_COST
    purchases = { ...purchases, attributeSeeds: { ...purchases.attributeSeeds, [attribute]: purchases.attributeSeeds[attribute] + 1 } }
  } else if (kind === 'skill') {
    const price = skillSeedCost(hero.purchases)
    if (price === null) return { ok: false, reason: 'You already have all 3 skill point seeds.' }
    cost = price
    purchases = { ...purchases, skillSeeds: purchases.skillSeeds + 1 }
  } else if (kind === 'pockets') {
    if (hero.purchases.deepPockets) return { ok: false, reason: 'You already have Deep Pockets.' }
    cost = DEEP_POCKETS_COST
    purchases = { ...purchases, deepPockets: true }
  } else if (kind === 'headStart') {
    const price = headStartCost(hero.purchases)
    if (price === null) return { ok: false, reason: 'You already have every Head Start.' }
    cost = price
    purchases = { ...purchases, headStart: purchases.headStart + 1 }
  } else if (kind === 'stockpile') {
    const price = STOCKPILE_COSTS[hero.purchases.stockpile ?? 0]
    if (price === undefined) return { ok: false, reason: 'You already have every Stockpile.' }
    cost = price
    purchases = { ...purchases, stockpile: (hero.purchases.stockpile ?? 0) + 1 }
  } else if (kind === 'artisan') {
    const price = ARTISAN_COSTS[hero.purchases.artisan ?? 0]
    if (price === undefined) return { ok: false, reason: "You already have every Artisan's Favor." }
    cost = price
    purchases = { ...purchases, artisan: (hero.purchases.artisan ?? 0) + 1 }
  } else if (kind === 'memory') {
    const price = LONG_MEMORY_COSTS[hero.purchases.longMemory ?? 0]
    if (price === undefined) return { ok: false, reason: 'You already have every Long Memory.' }
    cost = price
    purchases = { ...purchases, longMemory: (hero.purchases.longMemory ?? 0) + 1 }
  } else if (kind === 'fifthSlot') {
    if (hero.purchases.fifthSlot === true) return { ok: false, reason: 'You already have the fifth skill slot.' }
    cost = FIFTH_SLOT_COST
    purchases = { ...purchases, fifthSlot: true }
  } else if (!hero.purchases.secondHeirloom) {
    cost = SECOND_HEIRLOOM_COST
    purchases = { ...purchases, secondHeirloom: true }
  } else if (hero.purchases.thirdHeirloom !== true) {
    cost = THIRD_HEIRLOOM_COST
    purchases = { ...purchases, thirdHeirloom: true }
  } else {
    return { ok: false, reason: 'You already have every heirloom slot.' }
  }
  if (hero.legacy < cost) return { ok: false, reason: `That costs ${cost} Legacy. ${hero.name} has ${hero.legacy}.` }
  return { ok: true, cost, purchases }
}

/** One purchase staged in the next life planner (Step 13.36). */
export type PlannedPurchase = { kind: PurchaseKind; attribute?: keyof HeroPurchases['attributeSeeds'] }

export type StagedLife = { ok: true; hero: SavedHero; gained: LegacyPreview; spent: number } | { ok: false; reason: string }

/**
 * Step 13.36: the hero as the new life will see them. This life's Legacy is banked and every planned purchase is
 * bought in order, each affordable at its point. The current life is not touched: no seed or Head Start is applied
 * to `progress`, and Artisan's Favor hands over its one token as if bought just before reincarnating.
 */
export function stageNextLife(hero: SavedHero, plan: readonly PlannedPurchase[]): StagedLife {
  const gained = legacyPreview(hero)
  let staged: SavedHero = { ...hero, legacy: hero.legacy + gained.total }
  let spent = 0
  for (const item of plan) {
    const price = pricePurchase(staged, item.kind, item.attribute)
    if (!price.ok) return { ok: false, reason: price.reason }
    staged = {
      ...staged,
      legacy: staged.legacy - price.cost,
      purchases: price.purchases,
      ...(item.kind === 'artisan' ? { freeUpgrades: (staged.freeUpgrades ?? 0) + 1 } : {}),
    }
    spent += price.cost
  }
  return { ok: true, hero: staged, gained, spent }
}

/** Spend Legacy on a purchase. It is bound to the hero and survives every later life. */
export function buyPurchase(
  save: SaveData,
  heroId: string,
  kind: PurchaseKind,
  attribute?: keyof HeroPurchases['attributeSeeds'],
): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Finish the expedition first.' }
  const price = pricePurchase(hero, kind, attribute)
  if (!price.ok) return { ok: false, reason: price.reason }
  const { cost, purchases } = price
  const progress = applyToCurrentLife(hero.progress, kind, attribute, purchases)
  // Artisan's Favor also hands over one token now (Step 13.31); later lives add the tier total at reincarnation.
  const freeUpgrades = (hero.freeUpgrades ?? 0) + (kind === 'artisan' ? 1 : 0)
  const bought: SaveData = {
    ...save,
    heroes: save.heroes.map((entry) =>
      entry.id === heroId ? { ...entry, legacy: entry.legacy - cost, purchases, progress, ...(kind === 'artisan' ? { freeUpgrades } : {}) } : entry,
    ),
  }
  // A Head Start can raise the level, so heirlooms are brought to the new level.
  return { ok: true, save: progress.level === hero.progress.level ? bought : scaleHeirlooms(bought, heroId) }
}

/**
 * Step 13.30: a purchase also applies to the current life. Each later life still rebuilds from the racial base
 * plus every seed (`startingProgress`), so nothing is counted twice. Second Heirloom and Deep Pockets change nothing here,
 * and neither does the Fifth Skill Slot: the slot count is read from `purchases` (`loadoutSlots`).
 */
function applyToCurrentLife(
  progress: HeroProgress,
  kind: PurchaseKind,
  attribute: keyof HeroPurchases['attributeSeeds'] | undefined,
  purchases: HeroPurchases,
): HeroProgress {
  if (kind === 'attribute' && attribute !== undefined) {
    return { ...progress, attributes: { ...progress.attributes, [attribute]: progress.attributes[attribute] + 1 } }
  }
  if (kind === 'skill') return { ...progress, legacySkillPoints: progress.legacySkillPoints + 1 }
  if (kind === 'headStart') {
    const target = cumulativeXpToReachLevel(headStartLevel(purchases))
    const have = cumulativeXpToReachLevel(progress.level) + progress.xp
    // Only a hero below the tier's level moves; a higher one keeps their own XP.
    return progress.level < headStartLevel(purchases) ? awardXp(progress, target - have) : progress
  }
  return progress
}
