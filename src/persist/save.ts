import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { assertExpedition, type ExpeditionState } from '../sim/expedition.ts'
import { assertProgress, type HeroProgress } from '../sim/progression.ts'
import type { PriorityRow } from '../sim/types.ts'

export const SAVE_VERSION = 1
export const SAVE_KEY = 'rpg.save.v1'
export const CORRUPT_KEY_PREFIX = 'rpg.save.corrupt.'

/** Character slots, decided in G6: 2 at the start, up to 5 through the milestones below. */
export const STARTING_SLOTS = 2
export const MAX_SLOTS = 5
/** Slot 3, 4, and 5 unlock once each, the first time any hero reaches the milestone. */
export const SLOT_MILESTONES = ['first-return', 'first-reincarnation', 'first-warden-defeat'] as const

export type AccountData = {
  gold: number
  /** Material id to quantity. */
  materials: { [materialId: string]: number }
  recipes: string[]
  discoveries: string[]
  slots: number
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
    account: { gold: 0, materials: {}, recipes: [], discoveries: [], slots: STARTING_SLOTS },
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

function assertAccount(value: unknown): asserts value is AccountData {
  check(isRecord(value), 'account is missing')
  whole(value.gold, 'gold')
  whole(value.slots, 'slots')
  check(value.slots >= STARTING_SLOTS && value.slots <= MAX_SLOTS, `slots must be from ${STARTING_SLOTS} through ${MAX_SLOTS}, received ${value.slots}`)
  check(isRecord(value.materials), 'materials must be an object')
  for (const id of Object.keys(value.materials)) whole(value.materials[id], `material ${id}`)
  stringList(value.recipes, 'recipes')
  stringList(value.discoveries, 'discoveries')
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

export function parseSave(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'the save is not valid JSON' }
  }
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
