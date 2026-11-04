import { useSyncExternalStore } from 'react'

import { DUEL_BASIC_ID, gameDefs, scenarios, setupForScenario } from '../content/scenarios.ts'
import { grantPoints, selectedHero, spendAttributes, takeNode, type AttributePlan } from '../persist/character.ts'
import { addDevelopmentItems, equipFromArchive, unequipToArchive } from '../persist/equipment.ts'
import { buyPurchase, reincarnate, type PurchaseKind } from '../persist/reincarnation.ts'
import type { HeroPurchases } from '../persist/save.ts'
import { abandonContract, acceptContract, collectContract } from '../persist/contracts.ts'
import { advanceCrafting, anyCrafting, buyRecipe, grantCraftingKit, queueCraft, queueUpgrade, type CraftRequest } from '../persist/crafting.ts'
import { buyItem, buySupply, grantGold, payDebt, repairAll, repairOne, sellItem, sellMaterial, wearGear } from '../persist/town.ts'
import type { RosterResult } from '../persist/roster.ts'
import type { EquipmentSlotId, ItemInstance } from '../sim/economy.ts'
import { savePreparation, type PreparationDraft } from '../persist/preparation.ts'
import { beginExpedition, canStartRoute, newlyDiscovered, recordProgress, settleExpedition, shouldHold } from '../persist/world.ts'
import { returnToTown, stepExpedition } from '../sim/expedition.ts'
import { saveLoadout, saveRules, type RowDraft } from '../persist/loadout.ts'
import { OFFLINE_MIN_MS, OFFLINE_SUMMARY_MIN_MS, advanceOffline, createOffline, finishOffline, offlineDone, type OfflineState, type OfflineSummary } from '../persist/offline.ts'
import { setPriorityRules } from '../sim/automation.ts'
import { createHero, selectHero, unlockAllSlots, type NewHero } from '../persist/roster.ts'
import {
  clearSave,
  loadSave,
  newSave,
  parseSave,
  serializeSave,
  writeSave,
  type SaveData,
  type StorageLike,
} from '../persist/save.ts'
import { createCombat, stepCombat } from '../sim/combat.ts'
import type { CombatState } from '../sim/types.ts'

import { debugLog } from './debug.ts'
import { createGameLoop } from './loop.ts'

export const PLAYBACK_SPEEDS = [1, 2, 4] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

const SEED_MIN = -2147483648
const SEED_MAX = 2147483647
const SEED_ERROR = `Seed must be an integer from ${SEED_MIN} through ${SEED_MAX}.`

export type CombatSnapshot = {
  combat: CombatState
  scenarioId: string
  seed: number
  seedText: string
  seedError: string | null
  queueError: string | null
  paused: boolean
  speed: PlaybackSpeed
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

function parseSeed(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed.length === 0 || trimmed.length > 11 || !/^-?\d+$/.test(trimmed)) return null
  const value = BigInt(trimmed)
  if (value < BigInt(SEED_MIN) || value > BigInt(SEED_MAX)) return null
  return Number(value)
}

function assertSpeed(speed: number): asserts speed is PlaybackSpeed {
  if (speed !== 1 && speed !== 2 && speed !== 4) {
    throw new Error(`speed must be 1, 2, or 4, received ${describeValue(speed)}`)
  }
}

function assertScenarioId(scenarioId: string): void {
  if (typeof scenarioId !== 'string' || scenarios[scenarioId] === undefined) {
    throw new Error(`unknown scenario ${describeValue(scenarioId)}`)
  }
}

export type SaveStatus = {
  save: SaveData
  /** Set when the stored save was corrupt or from an unknown version. The player can start a new game. */
  loadError: string | null
  /** Where the unreadable save was copied, when the copy worked. */
  backupKey: string | null
  /** Set when the last write failed. The previous save is still stored. */
  writeError: string | null
  bytes: number | null
  /** False when this browser gives no storage. Nothing is saved then. */
  storageAvailable: boolean
}

function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage
    return storage ?? null
  } catch {
    return null
  }
}

function saveLogger(message: string, details?: unknown): void {
  debugLog('[save]', message, details)
}

function initialSaveStatus(): SaveStatus {
  const storage = browserStorage()
  if (storage === null) {
    return { save: newSave(), loadError: null, backupKey: null, writeError: null, bytes: null, storageAvailable: false }
  }
  let result
  try {
    result = loadSave(storage, Date.now(), saveLogger)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { save: newSave(), loadError: message, backupKey: null, writeError: null, bytes: null, storageAvailable: true }
  }
  if (result.kind === 'loaded') {
    return { save: result.data, loadError: null, backupKey: null, writeError: null, bytes: result.bytes, storageAvailable: true }
  }
  if (result.kind === 'corrupt') {
    return { save: newSave(), loadError: result.reason, backupKey: result.backupKey, writeError: null, bytes: null, storageAvailable: true }
  }
  return { save: newSave(), loadError: null, backupKey: null, writeError: null, bytes: null, storageAvailable: true }
}

let saveStatus: SaveStatus = initialSaveStatus()

export function getSaveStatus(): SaveStatus {
  return saveStatus
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, getSaveStatus, getSaveStatus)
}

/**
 * Replace the account's save and write it. Hero creation, allocations, and town actions call this.
 * The combat loop passes `notify` false because it notifies once per frame itself.
 */
export function commitSave(saved: SaveData, reason: string, notify = true): void {
  const next: SaveData = { ...saved, lastSeenAt: Date.now() }
  const storage = browserStorage()
  if (storage === null) {
    saveStatus = { ...saveStatus, save: next }
    if (notify) emit()
    return
  }
  const result = writeSave(storage, next, saveLogger)
  saveLogger('commit', { reason })
  saveStatus = result.ok
    ? { ...saveStatus, save: next, writeError: null, bytes: result.bytes }
    : { ...saveStatus, save: next, writeError: result.reason }
  if (notify) emit()
}

/** Create a hero and save. Returns the message to show when it is refused, or null. */
export function createHeroFromUi(request: NewHero): string | null {
  const result = createHero(saveStatus.save, request)
  if (!result.ok) return result.reason
  commitSave(result.save, 'hero created')
  return null
}

/** Select a hero and save. Returns the message to show when it is refused, or null. */
export function chooseHero(heroId: string): string | null {
  const result = selectHero(saveStatus.save, heroId)
  if (!result.ok) return result.reason
  commitSave(result.save, 'hero selected')
  return null
}

/** Spend attribute points for the selected hero in one step. Returns the refusal message, or null. */
export function spendAttributesFromUi(plan: AttributePlan): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  const result = spendAttributes(saveStatus.save, hero.id, plan)
  if (!result.ok) return result.reason
  commitSave(result.save, 'attributes allocated')
  return null
}

/** Spend one skill point on a node for the selected hero. Returns the refusal message, or null. */
export function takeNodeFromUi(nodeId: string): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  const result = takeNode(saveStatus.save, hero.id, nodeId)
  if (!result.ok) return result.reason
  commitSave(result.save, 'node allocated')
  return null
}

/** Save a loadout for the selected hero. Returns the message to show and any refusal. */
export function saveLoadoutFromUi(skillIds: readonly string[]): { error: string | null; message: string | null } {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return { error: 'Select a hero first.', message: null }
  const result = saveLoadout(saveStatus.save, hero.id, skillIds)
  if (!result.ok) return { error: result.reason, message: null }
  commitSave(result.save, 'loadout saved')
  const removed =
    result.removedRules === 0
      ? ''
      : ` ${result.removedRules} ${result.removedRules === 1 ? 'rule' : 'rules'} that used a skill you unequipped ${result.removedRules === 1 ? 'was' : 'were'} removed.`
  return { error: null, message: `Loadout saved.${removed}` }
}

/**
 * Save the selected hero's rules. Returns the messages for a refused set, or an empty list.
 * When the combat on screen has the same class and is still running, the rules also go through
 * `setPriorityRules`, so the fight logs a `rulesChanged` line and uses them from the next action.
 */
export function saveRulesFromUi(drafts: readonly RowDraft[]): string[] {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return ['Select a hero first.']
  const result = saveRules(saveStatus.save, hero.id, drafts)
  if (!result.ok) return [result.reason]
  commitSave(result.save, 'rules saved', false)
  const saved = selectedHero(result.save)
  const combat = snapshot.combat
  if (saved !== null && combat.outcome === 'ongoing' && combat.hero.classId === saved.classId) {
    setPriorityRules(combat, { rows: saved.priorityRows }, defs)
    debugLog('[ui]', 'rules applied to the running fight', { rows: saved.priorityRows.length })
  }
  snapshot = { ...snapshot }
  emit()
  return []
}

/** Development builds only. Gives the selected hero points to try the allocation screens. */
export function devGrantPoints(): void {
  if (!import.meta.env.DEV) return
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return
  commitSave(grantPoints(saveStatus.save, hero.id, 6, 4), 'dev grant points')
}

/** Development builds only. Opens all five slots so every pair can be created by hand. */
export function devUnlockAllSlots(): void {
  if (!import.meta.env.DEV) return
  commitSave(unlockAllSlots(saveStatus.save), 'dev unlock slots')
}

/** Drop an unreadable save and start fresh. The corrupt copy stays in storage. */
export function startNewGame(): void {
  const storage = browserStorage()
  if (storage !== null) clearSave(storage)
  saveLogger('new game')
  saveStatus = { ...saveStatus, save: newSave(), loadError: null, backupKey: null, writeError: null, bytes: null }
  commitSave(saveStatus.save, 'new game')
}

/** The whole game as text, for a backup file. */
export function exportSaveText(): string {
  return serializeSave(saveStatus.save)
}

/**
 * Replace the game with a backup. A file that does not read as a valid save is refused and nothing
 * changes. Returns the reason, or null when the game was replaced.
 */
export function importSaveFromText(text: string): string | null {
  const parsed = parseSave(text)
  if (!parsed.ok) return `That file is not a usable save: ${parsed.reason}.`
  pushedAt = null
  finishedFights = []
  discoveryNotices = []
  awayView = { phase: 'idle', progress: 0, summary: null }
  saveStatus = { ...saveStatus, loadError: null, backupKey: null }
  commitSave(parsed.data, 'save imported')
  const running = saveStatus.save.expedition
  expeditionLoop.resetClock()
  if (running !== null && running.outcome === 'ongoing' && !snapshot.paused) expeditionLoop.start()
  return null
}

const defs = gameDefs()
const listeners = new Set<() => void>()

const initialCombat = createCombat(setupForScenario(DUEL_BASIC_ID), defs, 1)

let snapshot: CombatSnapshot = {
  combat: initialCombat,
  scenarioId: DUEL_BASIC_ID,
  seed: 1,
  seedText: '1',
  seedError: null,
  queueError: null,
  paused: false,
  speed: 1,
}

debugLog('[ui]', 'scenario start', {
  scenarioId: snapshot.scenarioId,
  seed: snapshot.seed,
  timeMs: snapshot.combat.timeMs,
  outcome: snapshot.combat.outcome,
})

function emit(): void {
  for (const listener of [...listeners]) listener()
}

function details() {
  return {
    scenarioId: snapshot.scenarioId,
    seed: snapshot.seed,
    speed: snapshot.speed,
    paused: snapshot.paused,
  }
}

function applySteps(count: number): void {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error(`step count must be a non-negative integer, received ${describeValue(count)}`)
  }
  const combat = snapshot.combat
  if (combat.outcome !== 'ongoing' || count === 0) return
  for (let index = 0; index < count; index += 1) {
    stepCombat(combat, defs)
    if (combat.outcome !== 'ongoing') {
      const end = combat.log[combat.log.length - 1]
      commitSave(saveStatus.save, 'encounter end', false)
      debugLog('[loop]', 'encounter end', {
        scenarioId: snapshot.scenarioId,
        seed: combat.seed,
        outcome: combat.outcome,
        timeMs: combat.timeMs,
        durationMs: end !== undefined && end.type === 'encounterEnd' ? end.timeMs : combat.timeMs,
        events: combat.log.length,
      })
      return
    }
  }
}

const loop = createGameLoop({
  getSpeed: () => snapshot.speed,
  isPaused: () => snapshot.paused,
  applySteps,
  notify: () => {
    snapshot = { ...snapshot }
    emit()
  },
  details,
})

/** The fight count the player already chose to push on from. Not saved: a reload asks again. */
let pushedAt: number | null = null

/** True while the run waits for the player to push on or return. */
export function expeditionWaiting(): boolean {
  const expedition = saveStatus.save.expedition
  return expedition !== null && shouldHold(expedition, pushedAt)
}

/** Places discovered during this run, for the run's panels. In memory only. */
let discoveryNotices: string[] = []
/** Places discovered since the player last opened the Map tab. In memory only. */
let unseenDiscoveries = 0

export function getDiscoveryNotices(): readonly string[] {
  return discoveryNotices
}

export function getUnseenDiscoveries(): number {
  return unseenDiscoveries
}

/** The player opened the Map tab and saw what was found. */
export function clearUnseenDiscoveries(): void {
  if (unseenDiscoveries === 0) return
  unseenDiscoveries = 0
  saveStatus = { ...saveStatus }
  emit()
}

/** A fight that has ended, kept so its log and final state can be read after the panel moves on. */
export type FinishedFight = { fight: number; encounterId: string; combat: CombatState }

const KEPT_FIGHTS = 10
let finishedFights: FinishedFight[] = []

/** The most recent finished fights of this run, oldest first. Kept in memory only: a reload clears them. */
export function getFinishedFights(): readonly FinishedFight[] {
  return finishedFights
}

/** Advance the running expedition by this many simulation steps. The clock calls this each frame. */
export function advanceExpedition(count: number): void {
  // While the tab is hidden the clock does not run; the catch-up counts that time when it returns.
  if (catchingUp || (typeof document !== 'undefined' && document.hidden)) return
  const expedition = saveStatus.save.expedition
  if (expedition === null || expedition.outcome !== 'ongoing') return
  const fights = expedition.history.length
  const phase = expedition.phase
  for (let index = 0; index < count; index += 1) {
    if (shouldHold(expedition, pushedAt)) break
    const inFight = expedition.combat
    const before = expedition.history.length
    stepExpedition(expedition, defs)
    if (inFight !== null && expedition.history.length > before) {
      const entry = expedition.history[expedition.history.length - 1]
      if (entry !== undefined) {
        finishedFights = [...finishedFights, { fight: entry.index + 1, encounterId: entry.encounterId, combat: inFight }].slice(-KEPT_FIGHTS)
      }
    }
    if (expedition.outcome !== 'ongoing') break
  }
  const moved = expedition.history.length !== fights || expedition.phase !== phase || expedition.outcome !== 'ongoing'
  if (!moved) return
  const discoveredBefore = saveStatus.save.account.discoveries
  saveStatus = { ...saveStatus, save: recordProgress(saveStatus.save) }
  const found = newlyDiscovered(discoveredBefore, saveStatus.save.account.discoveries)
  if (found.length > 0) {
    discoveryNotices = [...discoveryNotices, ...found]
    unseenDiscoveries += found.length
  }
  if (expedition.history.length !== fights || expedition.outcome !== 'ongoing') {
    commitSave(saveStatus.save, expedition.outcome === 'ongoing' ? 'encounter end' : 'expedition end', false)
  }
}

/**
 * The walk between fights plays this many times faster than the player's speed. The simulation still
 * spends the whole 20-second journey, so regeneration, Readiness and Fury drain keep their ratios.
 */
export const TRAVEL_SPEEDUP = 4

/** Playback speed for the expedition clock: faster on the road, the chosen speed in a fight. */
export function expeditionSpeed(): number {
  const expedition = saveStatus.save.expedition
  const walking = expedition !== null && expedition.phase === 'travel' && expedition.combat === null
  return walking ? snapshot.speed * TRAVEL_SPEEDUP : snapshot.speed
}

const expeditionLoop = createGameLoop({
  getSpeed: expeditionSpeed,
  isPaused: () => snapshot.paused,
  applySteps: advanceExpedition,
  notify: () => {
    saveStatus = { ...saveStatus }
    emit()
  },
  details: () => ({ scenarioId: 'expedition', seed: saveStatus.save.expedition?.seed ?? 0, speed: snapshot.speed, paused: snapshot.paused }),
})

/** Start the expedition clock when a run is on the save, such as after a reload. Returns the cleanup. */
export function startExpeditionLoop(): () => void {
  const running = saveStatus.save.expedition
  if (running !== null && running.outcome === 'ongoing') expeditionLoop.start()
  return () => {
    expeditionLoop.stop()
  }
}

/** Start a run on a route for the selected hero. Returns the reason it was refused, or null. */
export function startExpeditionFromUi(routeId: string): string | null {
  const check = canStartRoute(saveStatus.save, routeId)
  if (!check.ok) return check.reason
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  const seed = (buffer[0] ?? 1) | 0
  const begun = beginExpedition(saveStatus.save, routeId, seed)
  if (!begun.ok) return begun.reason
  pushedAt = null
  lastRouteId = routeId
  finishedFights = []
  discoveryNotices = []
  debugLog('[ui]', 'expedition start', { routeId, seed })
  commitSave(begun.save, 'expedition start')
  expeditionLoop.resetClock()
  if (!snapshot.paused) expeditionLoop.start()
  return null
}

/** The player chose to push on from the fight the run is waiting after. */
export function pushOnFromUi(): void {
  const expedition = saveStatus.save.expedition
  if (expedition === null || !shouldHold(expedition, pushedAt)) return
  pushedAt = expedition.encounterIndex
  debugLog('[ui]', 'push on', { fight: expedition.encounterIndex })
  saveStatus = { ...saveStatus }
  emit()
}

/** The player chose to walk back to town. Only works while the run waits between fights. */
export function returnFromUi(): string | null {
  const expedition = saveStatus.save.expedition
  if (expedition === null) return 'No expedition is running.'
  try {
    returnToTown(expedition)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  debugLog('[ui]', 'return to town', { fight: expedition.encounterIndex })
  commitSave(saveStatus.save, 'return to town')
  return null
}

/** Save the preparation for the selected hero. Returns the messages for a refused draft. */
export function savePreparationFromUi(draft: PreparationDraft): string[] {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return ['Select a hero first.']
  const result = savePreparation(saveStatus.save, hero.id, draft)
  if (!result.ok) return [result.reason]
  commitSave(result.save, 'preparation saved')
  return []
}

/** Move a worn item of the selected hero into the archive. Returns the reason it was refused, or null. */
export function unequipFromUi(slot: EquipmentSlotId): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  const result = unequipToArchive(saveStatus.save, hero.id, slot)
  if (!result.ok) return result.reason
  commitSave(result.save, 'unequipped')
  return null
}

/** Equip an archive item for the selected hero. Returns the reason it was refused, or null. */
export function equipFromUi(itemId: string, slot: EquipmentSlotId | null): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  const result = equipFromArchive(saveStatus.save, hero.id, itemId, slot)
  if (!result.ok) return result.reason
  commitSave(result.save, 'equipped')
  return null
}

/** Development builds only. Adds a spread of weapons to the archive. */
export function devAddItems(): void {
  if (!import.meta.env.DEV) return
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return
  commitSave(addDevelopmentItems(saveStatus.save, hero.id), 'dev add items')
}

function applyTown(result: RosterResult, reason: string): string | null {
  if (!result.ok) return result.reason
  commitSave(result.save, reason)
  return null
}

/** Town services for the account and the selected hero. Each returns the refusal message, or null. */
export function sellMaterialFromUi(materialId: string, quantity: number): string | null {
  return applyTown(sellMaterial(saveStatus.save, materialId, quantity), 'sold material')
}

export function sellItemFromUi(itemId: string): string | null {
  return applyTown(sellItem(saveStatus.save, itemId), 'sold item')
}

export function buyItemFromUi(baseId: string): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  return applyTown(buyItem(saveStatus.save, hero.id, baseId), 'bought item')
}

export function buySupplyFromUi(supplyId: string, quantity = 1): string | null {
  return applyTown(buySupply(saveStatus.save, supplyId, quantity), 'bought supply')
}

export function repairOneFromUi(itemId: string): string | null {
  return applyTown(repairOne(saveStatus.save, itemId), 'repaired item')
}

export function repairAllFromUi(only?: (item: ItemInstance) => boolean): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  return applyTown(repairAll(saveStatus.save, hero.id, only), 'repaired all')
}

export function payDebtFromUi(amount: number): string | null {
  return applyTown(payDebt(saveStatus.save, amount), 'paid debt')
}

/** Development builds only. Adds gold and wears the hero's gear down to try the shop and repair. */
export function devTownTools(kind: 'gold' | 'wear'): void {
  if (!import.meta.env.DEV) return
  const hero = selectedHero(saveStatus.save)
  const next =
    kind === 'gold' ? grantGold(saveStatus.save, 500) : hero === null ? saveStatus.save : wearGear(saveStatus.save, hero.id)
  commitSave(next, `dev ${kind}`)
}

/** What the last crafting jobs produced. Not saved: it only fills the screen's notices. */
let craftNotices: string[] = []

export function getCraftNotices(): readonly string[] {
  return craftNotices
}

/** Crafts finished since the player last opened a gear shop. In memory only, so a reload clears it. */
let unseenCrafts = 0

export function getUnseenCrafts(): number {
  return unseenCrafts
}

/** The player opened a gear shop and saw the finished crafts. */
export function clearUnseenCrafts(): void {
  if (unseenCrafts === 0) return
  unseenCrafts = 0
  saveStatus = { ...saveStatus }
  emit()
}

/**
 * Let real time pass for every hero's crafting queue. Crafting runs on the wall clock, not on the
 * combat viewer's speed or pause, so a paused viewer or a tab in the background does not hold it up.
 */
export function advanceCraftingBy(elapsedMs: number): void {
  if (!anyCrafting(saveStatus.save) || !(elapsedMs > 0)) return
  const result = advanceCrafting(saveStatus.save, elapsedMs)
  saveStatus = { ...saveStatus, save: result.save }
  if (result.finished.length > 0) {
    craftNotices = [...craftNotices, ...result.finished.map((notice) => notice.text)].slice(-5)
    unseenCrafts += result.finished.length
    commitSave(saveStatus.save, 'craft finished', false)
  }
}

const CRAFT_TICK_MS = 500
let lastCraftTickAt = 0

function tickCrafting(): void {
  if (catchingUp) return
  const now = Date.now()
  const elapsed = now - lastCraftTickAt
  lastCraftTickAt = now
  const crafting = anyCrafting(saveStatus.save)
  advanceCraftingBy(elapsed)
  if (crafting || craftNotices.length > 0) {
    saveStatus = { ...saveStatus }
    emit()
  }
}

/** Start the crafting clock. It ticks twice a second and again when the tab comes back, counting the real time that passed. */
export function startTownLoop(): () => void {
  lastCraftTickAt = Date.now()
  const timer = setInterval(tickCrafting, CRAFT_TICK_MS)
  const onVisible = () => {
    if (document.visibilityState === 'visible') tickCrafting()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

// ---- Offline catch-up (GAME_DESIGN §11) ----

export type AwayView = {
  phase: 'idle' | 'running' | 'summary'
  /** 0 to 1 while a catch-up runs. */
  progress: number
  summary: OfflineSummary | null
}

let awayView: AwayView = { phase: 'idle', progress: 0, summary: null }
let catchingUp = false
let offlineState: OfflineState | null = null
let offlineTotalSteps = 1
/** When the tab was last hidden. Null while it is visible. */
let hiddenAt: number | null = null

export function getAwayView(): AwayView {
  return awayView
}

/** The player read the summary. */
export function dismissAway(): void {
  awayView = { phase: 'idle', progress: 0, summary: null }
  saveStatus = { ...saveStatus }
  emit()
}

function finishCatchUp(): void {
  const state = offlineState
  if (state === null) return
  const { save, summary } = finishOffline(state)
  offlineState = null
  catchingUp = false
  pushedAt = state.pushedAt
  saveStatus = { ...saveStatus, save }
  commitSave(save, 'offline catch-up', false)
  if (summary.discovered.length > 0) {
    discoveryNotices = [...discoveryNotices, ...summary.discovered]
    unseenDiscoveries += summary.discovered.length
  }
  unseenCrafts += summary.crafts.length
  lastCraftTickAt = Date.now()
  awayView = summary.replayedMs >= OFFLINE_SUMMARY_MIN_MS ? { phase: 'summary', progress: 1, summary } : { phase: 'idle', progress: 0, summary: null }
  const running = saveStatus.save.expedition
  if (running !== null && running.outcome === 'ongoing') {
    expeditionLoop.resetClock()
    if (!snapshot.paused) expeditionLoop.start()
  }
  saveStatus = { ...saveStatus }
  emit()
}

function runCatchUpChunk(): void {
  const state = offlineState
  if (state === null) return
  const started = performance.now()
  do {
    advanceOffline(state, 4000)
  } while (!offlineDone(state) && performance.now() - started < 12)
  if (offlineDone(state)) {
    finishCatchUp()
    return
  }
  awayView = { phase: 'running', progress: 1 - state.stepsLeft / offlineTotalSteps, summary: null }
  saveStatus = { ...saveStatus }
  emit()
  setTimeout(runCatchUpChunk, 0)
}

/** Replay time away in small chunks so the page stays responsive. `crafting` is false when the craft clock already counted it. */
function beginCatchUp(awayMs: number, crafting: boolean): void {
  if (catchingUp || saveStatus.save.heroes.length === 0 || !(awayMs >= OFFLINE_MIN_MS)) return
  const state = createOffline(saveStatus.save, awayMs, crafting)
  if (state.stepsLeft <= 0) return
  catchingUp = true
  offlineState = state
  offlineTotalSteps = state.stepsLeft
  debugLog('[ui]', 'offline catch-up', { awayMs, steps: state.stepsLeft })
  awayView = { phase: 'running', progress: 0, summary: null }
  saveStatus = { ...saveStatus }
  emit()
  setTimeout(runCatchUpChunk, 0)
}

const HEARTBEAT_MS = 10_000

/**
 * Watch for time away. On start it replays the time since the game last saw the player. While the
 * game runs it stamps the save every few seconds and when the tab hides, and replays the hidden time
 * when the tab returns. Returns the cleanup.
 */
export function startOfflineWatch(): () => void {
  const last = saveStatus.save.lastSeenAt
  if (last !== null) beginCatchUp(Date.now() - last, true)
  const stamp = () => {
    if (!catchingUp && saveStatus.save.heroes.length > 0) commitSave(saveStatus.save, 'seen', false)
  }
  const onVisibility = () => {
    if (document.hidden) {
      hiddenAt = Date.now()
      stamp()
    } else if (hiddenAt !== null) {
      const away = Date.now() - hiddenAt
      hiddenAt = null
      beginCatchUp(away, false)
    }
  }
  const timer = setInterval(() => {
    if (!document.hidden) stamp()
  }, HEARTBEAT_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', stamp)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', stamp)
  }
}

export function queueCraftFromUi(request: CraftRequest): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  return applyTown(queueCraft(saveStatus.save, hero.id, request), 'craft queued')
}

export function buyRecipeFromUi(modifierId: string): string | null {
  return applyTown(buyRecipe(saveStatus.save, modifierId), 'recipe learned')
}

export function queueUpgradeFromUi(itemId: string, materialId: string): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  return applyTown(queueUpgrade(saveStatus.save, hero.id, itemId, materialId), 'upgrade queued')
}

/** Development builds only. Learns every recipe and adds materials and gold. */
export function devCraftingKit(): void {
  if (!import.meta.env.DEV) return
  commitSave(grantCraftingKit(saveStatus.save), 'dev crafting kit')
}

export function acceptContractFromUi(contractId: string): string | null {
  return applyTown(acceptContract(saveStatus.save, contractId), 'contract accepted')
}

export function abandonContractFromUi(contractId: string): string | null {
  return applyTown(abandonContract(saveStatus.save, contractId), 'contract abandoned')
}

/** Collect a finished contract. The selected hero gets the experience. */
export function collectContractFromUi(contractId: string): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero to collect the experience.'
  return applyTown(collectContract(saveStatus.save, hero.id, contractId), 'contract collected')
}

/** Reincarnate the selected hero, keeping the chosen item as an heirloom. Returns the refusal, or null. */
export function reincarnateFromUi(heirloomItemId: string | null): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  return applyTown(reincarnate(saveStatus.save, hero.id, heirloomItemId), 'reincarnated')
}

/** Spend the selected hero's Legacy. Returns the refusal, or null. */
export function buyPurchaseFromUi(kind: PurchaseKind, attribute?: keyof HeroPurchases['attributeSeeds']): string | null {
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return 'Select a hero first.'
  return applyTown(buyPurchase(saveStatus.save, hero.id, kind, attribute), 'legacy purchase')
}

/** Development builds only. Marks a boss loss, or adds Legacy, so the reincarnation screen can be tried. */
export function devLegacyTools(kind: 'bossLoss' | 'legacy'): void {
  if (!import.meta.env.DEV) return
  const hero = selectedHero(saveStatus.save)
  if (hero === null) return
  const heroes = saveStatus.save.heroes.map((entry) =>
    entry.id !== hero.id ? entry : kind === 'bossLoss' ? { ...entry, bossLossThisLife: true } : { ...entry, legacy: entry.legacy + 40 },
  )
  commitSave({ ...saveStatus.save, heroes }, `dev ${kind}`)
}

/** Close a finished expedition: loot to the account, the first return opens a slot. */
export function settleExpeditionFromUi(): void {
  const settled = settleExpedition(saveStatus.save)
  if (settled === saveStatus.save) return
  commitSave(settled, 'expedition settled')
}

/** The route of the last run the player started. Not saved: a reload goes back to the first route. */
let lastRouteId: string | null = null

export function getLastRouteId(): string | null {
  return lastRouteId
}

/** Close the finished run and start the same route again. Returns the reason the new run was refused, or null. */
export function settleAndRepeatFromUi(): string | null {
  const route = saveStatus.save.expedition?.id ?? lastRouteId
  settleExpeditionFromUi()
  return route === null ? null : startExpeditionFromUi(route)
}

function startScenario(scenarioId: string, seed: number, seedText: string): void {
  assertScenarioId(scenarioId)
  const combat = createCombat(setupForScenario(scenarioId), defs, seed)
  loop.resetClock()
  snapshot = {
    combat,
    scenarioId,
    seed,
    seedText,
    seedError: null,
    queueError: null,
    paused: snapshot.paused,
    speed: snapshot.speed,
  }
  debugLog('[ui]', 'scenario start', {
    scenarioId,
    seed,
    timeMs: combat.timeMs,
    outcome: combat.outcome,
    enemies: combat.enemies.length,
  })
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): CombatSnapshot {
  return snapshot
}

export function useCombatStore(): CombatSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function onFrame(timeMs: number): void {
  loop.frame(timeMs)
}

export function startCombatLoop(): () => void {
  if (!snapshot.paused) loop.start()
  return () => {
    loop.stop()
  }
}

export function noteHeroQueue(error: string | null): void {
  if (error !== null && (typeof error !== 'string' || error.length === 0)) {
    throw new Error(`queue error must be a non-empty string or null, received ${describeValue(error)}`)
  }
  snapshot = { ...snapshot, queueError: error }
  emit()
}

export function selectScenario(scenarioId: string): void {
  assertScenarioId(scenarioId)
  debugLog('[ui]', 'scenario', { scenarioId })
  const parsed = parseSeed(snapshot.seedText)
  if (parsed === null) {
    debugLog('[ui]', 'scenario rejected', { scenarioId, seedText: snapshot.seedText })
    snapshot = { ...snapshot, seedError: SEED_ERROR }
    emit()
    return
  }
  startScenario(scenarioId, parsed, snapshot.seedText)
}

export function setSeedText(text: string): void {
  if (typeof text !== 'string') {
    throw new Error(`seed text must be a string, received ${describeValue(text)}`)
  }
  const parsed = parseSeed(text)
  if (parsed === null) {
    debugLog('[ui]', 'seed rejected', { seedText: text })
    snapshot = { ...snapshot, seedText: text, seedError: SEED_ERROR }
    emit()
    return
  }
  debugLog('[ui]', 'seed', { seed: parsed })
  snapshot = { ...snapshot, seedText: text, seed: parsed, seedError: null }
  emit()
}

export function restart(): void {
  const parsed = parseSeed(snapshot.seedText)
  if (parsed === null) {
    debugLog('[ui]', 'restart rejected', { seedText: snapshot.seedText })
    snapshot = { ...snapshot, seedError: SEED_ERROR }
    emit()
    return
  }
  debugLog('[ui]', 'restart', { scenarioId: snapshot.scenarioId, seed: parsed })
  startScenario(snapshot.scenarioId, parsed, snapshot.seedText)
}

export function randomSeed(): void {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  const raw = buffer[0]
  if (raw === undefined) throw new Error('crypto.getRandomValues returned no seed')
  const seed = raw | 0
  debugLog('[ui]', 'random seed', { seed })
  startScenario(snapshot.scenarioId, seed, String(seed))
}

export function togglePause(): void {
  const paused = !snapshot.paused
  snapshot = { ...snapshot, paused }
  if (paused) {
    debugLog('[ui]', 'pause', details())
    loop.pause()
  } else {
    debugLog('[ui]', 'resume', details())
    loop.start()
  }
  emit()
}

export function setSpeed(speed: PlaybackSpeed): void {
  assertSpeed(speed)
  const previous = snapshot.speed
  debugLog('[ui]', 'speed', { speed, previous })
  snapshot = { ...snapshot, speed }
  if (previous !== speed) debugLog('[loop]', 'speed', { speed, previous })
  emit()
}
