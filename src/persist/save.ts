import { itemBase, starterEquipment } from '../content/items.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { contracts as contractTable } from '../content/contracts.ts'
import { EQUIPMENT_SLOT_IDS, ITEM_MODIFIERS, STARTING_MODIFIER_RECIPES, type Equipment, type ItemInstance } from '../sim/economy.ts'
import { assertExpedition, type ExpeditionState } from '../sim/expedition.ts'
import { assertProgress, type HeroProgress } from '../sim/progression.ts'
import type { PriorityRow } from '../sim/types.ts'

export const SAVE_VERSION = 1
export const SAVE_KEY = 'rpg.save.v1'
export const CORRUPT_KEY_PREFIX = 'rpg.save.corrupt.'

/** Character slots, decided in G6: 2 at the start, up to 5 through the milestones below. */
export const STARTING_SLOTS = 2
export const MAX_SLOTS = 5
/** The usual gold to carry: the rescue fee. */
export const DEFAULT_CARRY_GOLD = 25
/** The usual retreat threshold: 40% of maximum HP. */
export const DEFAULT_RETREAT = 0.4
/** A new game knows the town and the road out of it. */
export const STARTING_DISCOVERIES = ['node:greyhaven', 'node:splintered-road'] as const
/** Slot 3, 4, and 5 unlock once each, the first time any hero reaches the milestone. */
export const SLOT_MILESTONES = ['first-return', 'first-reincarnation', 'first-warden-defeat'] as const

/** One crafting job. Costs were paid when it was queued, and only the first job advances. */
export type CraftJob =
  | {
      id: string
      kind: 'craft'
      heroId: string
      baseId: string
      itemLevel: number
      materialId: string
      modifierId: string | null
      remainingMs: number
      /** Index into the account's craft seed. Fixes the quality roll. */
      seedIndex: number
      /** The hero's proficiency rank when the job was queued. It sets the quality range. */
      rank: number
    }
  | {
      id: string
      kind: 'upgrade'
      heroId: string
      /** The item is held here while the upgrade runs, and returned to the archive when it ends. */
      item: ItemInstance
      materialId: string
      remainingMs: number
      seedIndex: number
      rank: number
    }

/** A contract the player has taken. Progress counts toward the contract's target. */
export type ActiveContract = {
  contractId: string
  progress: number
}

export type AccountData = {
  gold: number
  /** Material id to quantity. */
  materials: { [materialId: string]: number }
  recipes: string[]
  /** Shared world discoveries: node ids from the world content, such as `node:splintered-road`. */
  discoveries: string[]
  slots: number
  /** One-time account milestones reached so far. Each one opens a character slot. */
  milestones: string[]
  /** Contracts taken from the board, at most three. */
  contracts: ActiveContract[]
  /** Queued crafting jobs, at most three. */
  craftQueue: CraftJob[]
  /** How many crafting rolls have been used. The next job takes this index. */
  craftCounter: number
  /** Gold owed from defeats. It is paid off at the town and blocks nothing. */
  debt: number
  /** Items the player owns that no hero has equipped. Shared across heroes. */
  archive: ItemInstance[]
}

/** One hero's saved record. Combat state is rebuilt from this and the content tables. */
export type SavedHero = {
  id: string
  name: string
  classId: HeroClass
  progress: HeroProgress
  priorityRows: PriorityRow[]
  /** The vow a Cleric takes into an expedition. Null for other classes. */
  vow: string | null
  /** The Undead curse chosen for an expedition. Null when none. */
  curse: string | null
  /** The spells a Mage prepared. Empty takes the loadout order. */
  preparedSpells: string[]
  /** Personal world record: enemies this hero has defeated, and the nodes this hero has cleared. */
  defeatedEnemyIds: string[]
  clearedNodeIds: string[]
  /** Retreat when HP falls to this fraction of maximum. Null never retreats. */
  retreatAtMost: number | null
  /** Special arrows a Ranger packs for an expedition. 0 for other classes. */
  specialAmmo: number
  /** Gold to carry into an expedition. The rest of the account's gold stays deposited and safe. */
  carryGold: number
  /** The highest Fractured Warden Echo rank this hero can fight. Each victory unlocks the next. Personal to the hero. */
  echoRank: number
  /** The Echo rank to fight on the next run to the Fracture Gate. At most `echoRank`. */
  fightRank: number
  /** A boss defeated this hero this life. Reincarnation needs it, and reincarnation clears it. */
  bossLossThisLife: boolean
  /** Crafting experience. Rank is `floor(√XP)` up to 10. Personal to the hero and kept through reincarnation. */
  craftXp: number
  /** Equipped items. Gear is bound to its hero. */
  equipment: Equipment
}

export type SaveData = {
  version: typeof SAVE_VERSION
  account: AccountData
  heroes: SavedHero[]
  /** Id of the selected hero, or null while the roster is empty. */
  selectedHeroId: string | null
  /** The road run in progress. Null in town. */
  expedition: ExpeditionState | null
}

export type SaveLogger = (message: string, details?: unknown) => void

/** The slice of `localStorage` the save layer uses, so tests can pass a fake. */
export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type ParseResult = { ok: true; data: SaveData } | { ok: false; reason: string }

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; data: SaveData; bytes: number }
  | { kind: 'corrupt'; reason: string; backupKey: string | null }

export type WriteResult = { ok: true; bytes: number } | { ok: false; reason: string }

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

export function newSave(): SaveData {
  return {
    version: SAVE_VERSION,
    account: {
      gold: 0,
      materials: {},
      recipes: [...STARTING_MODIFIER_RECIPES],
      discoveries: [...STARTING_DISCOVERIES],
      slots: STARTING_SLOTS,
      milestones: [],
      archive: [],
      contracts: [],
      craftQueue: [],
      craftCounter: 0,
      debt: 0,
    },
    heroes: [],
    selectedHeroId: null,
    expedition: null,
  }
}

export function byteSize(text: string): number {
  return new TextEncoder().encode(text).length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function whole(value: unknown, label: string): asserts value is number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 0, `${label} must be a whole number of at least 0, received ${describeValue(value)}`)
}

function stringList(value: unknown, label: string): asserts value is string[] {
  check(Array.isArray(value), `${label} must be a list`)
  for (const entry of value) check(typeof entry === 'string' && entry.length > 0, `${label} has a bad entry ${describeValue(entry)}`)
}

function assertItem(value: unknown, label: string): asserts value is ItemInstance {
  check(isRecord(value), `${label} must be an object`)
  check(typeof value.id === 'string' && value.id.length > 0, `${label} is missing an id`)
  check(typeof value.baseId === 'string' && itemBase(value.baseId) !== undefined, `${label} has an unknown base ${describeValue(value.baseId)}`)
  check(typeof value.itemLevel === 'number' && Number.isInteger(value.itemLevel) && value.itemLevel >= 1, `${label} item level must be a whole number of at least 1`)
  check(typeof value.quality === 'number' && value.quality > 0 && value.quality <= 2, `${label} quality must be above 0 and at most 2`)
  whole(value.maxDurability, `${label} maximum durability`)
  whole(value.durability, `${label} durability`)
  check(value.durability <= value.maxDurability, `${label} durability is above its maximum`)
  stringList(value.modifiers, `${label} modifiers`)
  for (const id of value.modifiers) check(ITEM_MODIFIERS[id] !== undefined, `${label} has an unknown modifier ${describeValue(id)}`)
}

function assertJob(value: unknown): asserts value is CraftJob {
  check(isRecord(value), 'craft job must be an object')
  check(typeof value.id === 'string' && value.id.length > 0, 'craft job is missing an id')
  check(value.kind === 'craft' || value.kind === 'upgrade', 'craft job kind must be craft or upgrade')
  check(typeof value.heroId === 'string', 'craft job is missing a hero')
  check(typeof value.materialId === 'string', 'craft job is missing a material')
  whole(value.remainingMs, 'craft job time')
  whole(value.seedIndex, 'craft job seed index')
  whole(value.rank, 'craft job rank')
  if (value.kind === 'craft') {
    check(typeof value.baseId === 'string' && itemBase(value.baseId) !== undefined, 'craft job has an unknown base')
    whole(value.itemLevel, 'craft job item level')
    check(value.modifierId === null || (typeof value.modifierId === 'string' && ITEM_MODIFIERS[value.modifierId] !== undefined), 'craft job has an unknown modifier')
  } else {
    assertItem(value.item, 'craft job item')
  }
}

function assertAccount(value: unknown): asserts value is AccountData {
  check(isRecord(value), 'account is missing')
  whole(value.gold, 'gold')
  whole(value.slots, 'slots')
  check(value.slots >= STARTING_SLOTS && value.slots <= MAX_SLOTS, `slots must be from ${STARTING_SLOTS} through ${MAX_SLOTS}, received ${value.slots}`)
  check(isRecord(value.materials), 'materials must be an object')
  for (const id of Object.keys(value.materials)) whole(value.materials[id], `material ${id}`)
  stringList(value.recipes, 'recipes')
  stringList(value.discoveries, 'discoveries')
  stringList(value.milestones, 'milestones')
  check(value.milestones.length <= MAX_SLOTS - STARTING_SLOTS, 'too many milestones')
  whole(value.debt, 'debt')
  whole(value.craftCounter, 'craft counter')
  check(Array.isArray(value.contracts) && value.contracts.length <= 3, 'at most 3 contracts can be active')
  const taken: string[] = []
  for (const entry of value.contracts) {
    check(isRecord(entry) && typeof entry.contractId === 'string' && contractTable[entry.contractId] !== undefined, 'a contract id is unknown')
    whole(entry.progress, 'contract progress')
    check(entry.progress <= contractTable[entry.contractId]!.count, 'contract progress is past its target')
    check(!taken.includes(entry.contractId), `contract ${entry.contractId} is taken twice`)
    taken.push(entry.contractId)
  }
  check(Array.isArray(value.craftQueue) && value.craftQueue.length <= 3, 'the craft queue holds at most 3 jobs')
  for (const job of value.craftQueue) assertJob(job)
  check(Array.isArray(value.archive), 'archive must be a list')
  const archiveIds: string[] = []
  value.archive.forEach((item, index) => {
    assertItem(item, `archive item ${index + 1}`)
    check(!archiveIds.includes(item.id), `item id ${item.id} is duplicated`)
    archiveIds.push(item.id)
  })
}

function assertHero(value: unknown, index: number): asserts value is SavedHero {
  const label = `hero ${index + 1}`
  check(isRecord(value), `${label} must be an object`)
  check(typeof value.id === 'string' && value.id.length > 0, `${label} is missing an id`)
  check(typeof value.name === 'string' && value.name.length > 0, `${label} is missing a name`)
  check(
    typeof value.classId === 'string' && (HERO_CLASSES as readonly string[]).includes(value.classId),
    `${label} has an unknown class ${describeValue(value.classId)}`,
  )
  assertProgress(value.progress)
  check(Array.isArray(value.priorityRows), `${label} priority rows must be a list`)
  for (const row of value.priorityRows) {
    check(isRecord(row) && typeof row.skillId === 'string', `${label} has a bad priority row`)
  }
  check(value.vow === null || typeof value.vow === 'string', `${label} vow must be text or null`)
  check(value.curse === null || typeof value.curse === 'string', `${label} curse must be text or null`)
  stringList(value.preparedSpells, `${label} prepared spells`)
  stringList(value.defeatedEnemyIds, `${label} defeated enemies`)
  stringList(value.clearedNodeIds, `${label} cleared nodes`)
  check(
    value.retreatAtMost === null ||
      (typeof value.retreatAtMost === 'number' && value.retreatAtMost > 0 && value.retreatAtMost < 1),
    `${label} retreat threshold must be between 0 and 1, or null`,
  )
  whole(value.specialAmmo, `${label} special arrows`)
  whole(value.carryGold, `${label} carried gold`)
  whole(value.craftXp, `${label} crafting experience`)
  whole(value.echoRank, `${label} Echo rank`)
  whole(value.fightRank, `${label} fight rank`)
  check(value.fightRank <= value.echoRank, `${label} fight rank is above the Echo rank it has unlocked`)
  check(typeof value.bossLossThisLife === 'boolean', `${label} boss loss must be true or false`)
  check(isRecord(value.equipment), `${label} equipment must be an object`)
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = value.equipment[slot]
    check(item !== undefined, `${label} equipment is missing the ${slot} slot`)
    if (item !== null) assertItem(item, `${label} ${slot}`)
  }
}

/** Version 1 shape check. Throws a readable message on the first problem. */
export function assertSaveData(value: unknown): asserts value is SaveData {
  check(isRecord(value), 'save must be an object')
  check(value.version === SAVE_VERSION, `unknown save version ${describeValue(value.version)}`)
  assertAccount(value.account)
  check(Array.isArray(value.heroes), 'heroes must be a list')
  const ids: string[] = []
  value.heroes.forEach((hero, index) => {
    assertHero(hero, index)
    check(!ids.includes(hero.id), `hero id ${hero.id} is duplicated`)
    ids.push(hero.id)
  })
  check(
    value.selectedHeroId === null || (typeof value.selectedHeroId === 'string' && ids.includes(value.selectedHeroId)),
    `selected hero ${describeValue(value.selectedHeroId)} is not in the roster`,
  )
  if (value.expedition !== null) {
    check(isRecord(value.expedition), 'expedition must be an object or null')
    assertExpedition(value.expedition as unknown as ExpeditionState)
  }
}

export function serializeSave(data: SaveData): string {
  assertSaveData(data)
  return JSON.stringify(data)
}

/** Saves from before the world record existed get empty lists. Nothing else is guessed. */
function fillWorldFields(parsed: unknown): void {
  if (!isRecord(parsed)) return
  if (isRecord(parsed.account) && parsed.account.milestones === undefined) parsed.account.milestones = []
  if (isRecord(parsed.account) && parsed.account.archive === undefined) parsed.account.archive = []
  if (isRecord(parsed.account) && parsed.account.debt === undefined) parsed.account.debt = 0
  if (isRecord(parsed.account) && parsed.account.craftQueue === undefined) parsed.account.craftQueue = []
  if (isRecord(parsed.account) && parsed.account.contracts === undefined) parsed.account.contracts = []
  if (isRecord(parsed.account) && parsed.account.craftCounter === undefined) parsed.account.craftCounter = 0
  if (!Array.isArray(parsed.heroes)) return
  for (const hero of parsed.heroes) {
    if (!isRecord(hero)) continue
    if (hero.defeatedEnemyIds === undefined) hero.defeatedEnemyIds = []
    if (hero.clearedNodeIds === undefined) hero.clearedNodeIds = []
    if (hero.retreatAtMost === undefined) hero.retreatAtMost = DEFAULT_RETREAT
    if (hero.specialAmmo === undefined) hero.specialAmmo = 0
    if (hero.carryGold === undefined) hero.carryGold = DEFAULT_CARRY_GOLD
    if (hero.craftXp === undefined) hero.craftXp = 0
    if (hero.echoRank === undefined) hero.echoRank = 0
    if (hero.fightRank === undefined) hero.fightRank = 0
    if (hero.bossLossThisLife === undefined) hero.bossLossThisLife = false
    if (hero.equipment === undefined && typeof hero.id === 'string' && (HERO_CLASSES as readonly string[]).includes(String(hero.classId))) {
      hero.equipment = starterEquipment(hero.id, hero.classId as HeroClass)
    }
  }
}

export function parseSave(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'the save is not valid JSON' }
  }
  fillWorldFields(parsed)
  try {
    assertSaveData(parsed)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true, data: parsed }
}

/**
 * Read the save. A missing entry is an empty start. A corrupt or unknown-version entry is copied
 * to `rpg.save.corrupt.<timestamp>` and left in place, so nothing is lost and the caller can
 * show an error and offer a new game.
 */
export function loadSave(storage: StorageLike, nowMs: number, log?: SaveLogger): LoadResult {
  const raw = storage.getItem(SAVE_KEY)
  if (raw === null) {
    log?.('no save found')
    return { kind: 'empty' }
  }
  const parsed = parseSave(raw)
  if (parsed.ok) {
    const bytes = byteSize(raw)
    log?.('loaded', { bytes, heroes: parsed.data.heroes.length, expedition: parsed.data.expedition !== null })
    return { kind: 'loaded', data: parsed.data, bytes }
  }
  const backupKey = `${CORRUPT_KEY_PREFIX}${nowMs}`
  let stored: string | null = backupKey
  try {
    storage.setItem(backupKey, raw)
  } catch {
    stored = null
  }
  log?.('corrupt save', { reason: parsed.reason, backupKey: stored, bytes: byteSize(raw) })
  return { kind: 'corrupt', reason: parsed.reason, backupKey: stored }
}

/** Write the save. A full or blocked store returns a reason and leaves the old entry alone. */
export function writeSave(storage: StorageLike, data: SaveData, log?: SaveLogger): WriteResult {
  let text: string
  try {
    text = serializeSave(data)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    log?.('save rejected', { reason })
    return { ok: false, reason }
  }
  try {
    storage.setItem(SAVE_KEY, text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    log?.('save failed', { reason })
    return { ok: false, reason }
  }
  const bytes = byteSize(text)
  log?.('saved', { bytes })
  return { ok: true, bytes }
}

/** Remove the live save for a new game. Corrupt backups stay. */
export function clearSave(storage: StorageLike): void {
  storage.removeItem(SAVE_KEY)
}

/**
 * Record a one-time milestone. The first time only, it opens the next character slot.
 * Returns the account unchanged when the milestone was already reached.
 */
export function reachMilestone(account: AccountData, milestone: (typeof SLOT_MILESTONES)[number]): AccountData {
  if (account.milestones.includes(milestone)) return account
  const milestones = [...account.milestones, milestone]
  return { ...account, milestones, slots: Math.min(MAX_SLOTS, STARTING_SLOTS + milestones.length) }
}
