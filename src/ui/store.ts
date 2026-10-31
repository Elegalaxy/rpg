import { useSyncExternalStore } from 'react'

import { DUEL_BASIC_ID, gameDefs, scenarios, setupForScenario } from '../content/scenarios.ts'
import { grantPoints, selectedHero, spendAttributes, takeNode, type AttributePlan } from '../persist/character.ts'
import { saveLoadout, saveRules, type RowDraft } from '../persist/loadout.ts'
import { setPriorityRules } from '../sim/automation.ts'
import { createHero, selectHero, unlockAllSlots, type NewHero } from '../persist/roster.ts'
import {
  clearSave,
  loadSave,
  newSave,
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
export function commitSave(next: SaveData, reason: string, notify = true): void {
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
