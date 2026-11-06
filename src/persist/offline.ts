import { LOOT_CAPACITY, returnToTown } from '../sim/expedition.ts'
import { stepExpedition } from '../sim/expedition.ts'
import { STEP_MS } from '../sim/constants.ts'
import { deriveSeed } from '../sim/rng.ts'
import { gameDefs } from '../content/scenarios.ts'
import { routes } from '../content/world.ts'

import { selectedHero } from './character.ts'
import { isComplete } from './contracts.ts'
import { advanceCrafting } from './crafting.ts'
import { packFromStash } from './preparation.ts'
import { contractFor, purseOf, type SaveData, type SavedHero } from './save.ts'
import { beginExpedition, newlyDiscovered, recordProgress, settleExpedition, shouldHold } from './world.ts'

/** The most time a catch-up replays: eight hours (GAME_DESIGN §11). */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
/** Less time away than this is not worth a catch-up. */
export const OFFLINE_MIN_MS = 5_000
/** Loot and gold from a fight won while away, as a share of a live fight's (GAME_DESIGN §11). */
export const OFFLINE_LOOT_RATE = 0.5
/** Less time than this is applied quietly, with no "while you were away" summary (a reload, a short tab switch). */
export const OFFLINE_SUMMARY_MIN_MS = 30_000

/** Why the replay stopped running expeditions, or null when it ran to the end of the time. */
export type OfflineStop = 'defeat' | 'returned' | 'uncleared' | 'supplies' | 'blocked' | null

export type OfflineSummary = {
  /** Time away, before the cap. */
  awayMs: number
  /** Time actually replayed. */
  replayedMs: number
  /** Runs that ended: returned safely, or defeated. */
  runs: number
  fightsWon: number
  retreats: number
  defeated: boolean
  /** Experience banked from settled runs. */
  xp: number
  levelsGained: number
  gold: number
  materials: { [materialId: string]: number }
  /** What every hero's crafts finished, as the notices say. */
  crafts: string[]
  /** The base item of each finished craft, in the same order as `crafts`, so the shops can badge themselves. */
  craftBaseIds: string[]
  contractsFinished: number
  discovered: string[]
  /** Why running stopped. A reason the player may need to act on. */
  stopped: OfflineStop
  /** The reason a repeat could not start, in words, when `stopped` is blocked. */
  note: string | null
}

export type OfflineState = {
  save: SaveData
  /** Simulation steps still to replay. */
  stepsLeft: number
  /** The fight count the run was pushed on from, as the live screen keeps it. */
  pushedAt: number | null
  crafting: boolean
  /** Gold and loot the run held when the last fight ended, so a won fight's gain can be told apart and reduced. */
  baseline: { gold: number; unsecured: { [materialId: string]: number } }
  summary: OfflineSummary
  /** Before-values for the summary, taken from the starting save. */
  start: { level: number; gold: number; materials: { [materialId: string]: number }; discoveries: string[]; contractsDone: number }
  stopped: OfflineStop
}

const defs = gameDefs()

function contractsDone(save: SaveData): number {
  const purse = purseOf(save)
  return purse.contracts.filter((entry) => isComplete(entry, contractFor(purse, entry.contractId))).length
}

/** Gold the hero has safe: in the purse, or deposited while a run is out. Carried gold is still at risk. */
function safeGold(save: SaveData): number {
  return purseOf(save).gold + (save.expedition?.depositedGold ?? 0)
}

function heroLevel(save: SaveData): number {
  return selectedHero(save)?.progress.level ?? 0
}

/** The seconds to replay: the time away, capped, or 0 for a clock that went backwards or a short absence. */
export function replayMs(awayMs: number): number {
  if (!Number.isFinite(awayMs) || awayMs < OFFLINE_MIN_MS) return 0
  return Math.min(awayMs, OFFLINE_CAP_MS)
}

/**
 * Start a catch-up. The given save is copied, so nothing about it changes. Time is replayed in whole
 * simulation steps by `advanceOffline`. `crafting` is false when something else already counted the
 * crafting time, such as the wall-clock craft timer of a tab that was only hidden.
 */
export function createOffline(save: SaveData, awayMs: number, crafting: boolean): OfflineState {
  const copy = structuredClone(save)
  const ms = replayMs(awayMs)
  const purse = purseOf(copy)
  return {
    save: copy,
    stepsLeft: Math.floor(ms / STEP_MS),
    pushedAt: null,
    crafting,
    baseline: baselineOf(copy),
    stopped: null,
    start: {
      level: heroLevel(copy),
      gold: safeGold(copy),
      materials: { ...purse.materials },
      discoveries: [...copy.account.discoveries],
      contractsDone: contractsDone(copy),
    },
    summary: {
      awayMs,
      replayedMs: ms,
      runs: 0,
      fightsWon: 0,
      retreats: 0,
      defeated: false,
      xp: 0,
      levelsGained: 0,
      gold: 0,
      materials: {},
      crafts: [],
      craftBaseIds: [],
      contractsFinished: 0,
      discovered: [],
      stopped: null,
      note: null,
    },
  }
}

export function offlineDone(state: OfflineState): boolean {
  return state.stepsLeft <= 0
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

function baselineOf(save: SaveData): OfflineState['baseline'] {
  const expedition = save.expedition
  const unsecured: { [materialId: string]: number } = {}
  for (const stack of expedition?.unsecured ?? []) unsecured[stack.materialId] = stack.quantity
  return { gold: expedition?.carriedGold ?? 0, unsecured }
}

/**
 * A fight just ended. Reduce what it dropped to the offline rate, then take a new baseline. The drop is
 * what the run holds now minus what it held after the last fight.
 */
function applyLootRate(state: OfflineState): void {
  const expedition = state.save.expedition
  if (expedition === null) return
  const gold = expedition.carriedGold - state.baseline.gold
  if (gold > 0) expedition.carriedGold = state.baseline.gold + roundHalfUp(gold * OFFLINE_LOOT_RATE)
  expedition.unsecured = expedition.unsecured.flatMap((stack) => {
    const before = state.baseline.unsecured[stack.materialId] ?? 0
    const gain = stack.quantity - before
    const quantity = gain > 0 ? before + roundHalfUp(gain * OFFLINE_LOOT_RATE) : stack.quantity
    return quantity > 0 ? [{ ...stack, quantity }] : []
  })
  state.baseline = baselineOf(state.save)
}

function lootCount(stacks: readonly { quantity: number }[]): number {
  return stacks.reduce((sum, stack) => sum + stack.quantity, 0)
}

/** Every node of the route is in the hero's cleared list. */
function routeCleared(hero: SavedHero, routeId: string): boolean {
  const route = routes[routeId]
  if (route === undefined) return false
  return route.nodeIds.every((id) => id === 'greyhaven' || hero.clearedNodeIds.includes(id))
}

/** Count the fights an expedition has finished since `seen` of its history entries. */
function countNewFights(state: OfflineState, seen: number): number {
  const expedition = state.save.expedition
  if (expedition === null) return seen
  for (let index = seen; index < expedition.history.length; index += 1) {
    const entry = expedition.history[index]
    if (entry === undefined) continue
    if (entry.outcome === 'victory') state.summary.fightsWon += 1
    else if (entry.outcome === 'retreat') state.summary.retreats += 1
  }
  return expedition.history.length
}

/** A run that came home safely. Settle it and start the next one when the standing orders say so. Returns false when running must stop. */
function afterReturn(state: OfflineState): boolean {
  const expedition = state.save.expedition
  const hero = selectedHero(state.save)
  if (expedition === null || hero === null) return false
  state.summary.runs += 1
  if (!hero.repeatRoute) {
    state.stopped = 'returned'
    return false
  }
  const routeId = expedition.id
  const seed = deriveSeed(expedition.seed, 7919)
  state.summary.xp += expedition.xpEarned ?? 0
  state.save = settleExpedition(state.save)
  const settled = selectedHero(state.save)
  if (settled === null) return false
  if (!routeCleared(settled, routeId)) {
    state.stopped = 'uncleared'
    return false
  }
  if (packFromStash(settled).missing.length > 0) {
    state.stopped = 'supplies'
    return false
  }
  const begun = beginExpedition(state.save, routeId, seed)
  if (!begun.ok) {
    state.stopped = 'blocked'
    state.summary.note = begun.reason
    return false
  }
  state.save = begun.save
  state.pushedAt = null
  state.baseline = baselineOf(state.save)
  return true
}

/** At the hold between fights: the standing orders choose to push on or to walk home. */
function decideAtHold(state: OfflineState): void {
  const expedition = state.save.expedition
  const hero = selectedHero(state.save)
  if (expedition === null || hero === null) return
  const hpPercent = (expedition.hero.hp / expedition.hero.maxHp) * 100
  const room = lootCount(expedition.unsecured) < LOOT_CAPACITY
  if (hpPercent >= hero.pushOnHpPercent && room) state.pushedAt = expedition.encounterIndex
  else returnToTown(expedition)
}

/**
 * Replay up to `maxSteps` simulation steps. The result does not depend on how the time is split
 * into calls: crafting adds up, and the expedition only moves by single steps.
 */
export function advanceOffline(state: OfflineState, maxSteps: number): void {
  const budget = Math.min(Math.max(0, Math.floor(maxSteps)), state.stepsLeft)
  if (budget === 0) return
  if (state.crafting) {
    const crafted = advanceCrafting(state.save, budget * STEP_MS)
    state.save = crafted.save
    for (const notice of crafted.finished) {
      state.summary.crafts.push(notice.text)
      state.summary.craftBaseIds.push(notice.baseId)
    }
  }
  let used = 0
  let seen = state.save.expedition?.history.length ?? 0
  while (used < budget && state.stopped === null) {
    const expedition = state.save.expedition
    if (expedition === null) break
    if (expedition.outcome === 'defeat') {
      state.summary.runs += 1
      state.summary.defeated = true
      state.stopped = 'defeat'
      break
    }
    if (expedition.outcome === 'returned') {
      seen = countNewFights(state, seen)
      if (!afterReturn(state)) break
      seen = state.save.expedition?.history.length ?? 0
      continue
    }
    if (shouldHold(expedition, state.pushedAt)) {
      decideAtHold(state)
      continue
    }
    stepExpedition(expedition, defs)
    used += 1
    if (expedition.history.length !== seen) {
      applyLootRate(state)
      seen = countNewFights(state, seen)
    }
  }
  state.stepsLeft -= budget
}

/** The finished save and summary. A run that ended is left for the player to close on the Map. */
export function finishOffline(state: OfflineState): { save: SaveData; summary: OfflineSummary } {
  let save = state.save
  if (save.expedition !== null) save = recordProgress(save)
  const before = state.start
  const purse = purseOf(save)
  const materials: { [materialId: string]: number } = {}
  for (const [id, amount] of Object.entries(purse.materials)) {
    const gained = amount - (before.materials[id] ?? 0)
    if (gained > 0) materials[id] = gained
  }
  // A defeat on the very last replayed step has not been looked at by the loop yet.
  const lost = save.expedition?.outcome === 'defeat'
  const summary: OfflineSummary = {
    ...state.summary,
    runs: state.summary.runs + (lost && !state.summary.defeated ? 1 : 0),
    defeated: state.summary.defeated || lost,
    gold: Math.max(0, safeGold(save) - before.gold),
    materials,
    levelsGained: Math.max(0, heroLevel(save) - before.level),
    contractsFinished: Math.max(0, contractsDone(save) - before.contractsDone),
    discovered: newlyDiscovered(before.discoveries, save.account.discoveries),
    stopped: lost ? 'defeat' : state.stopped,
  }
  return { save, summary }
}

/** Replay everything in one call. Tests and small catch-ups use this; the screen uses `advanceOffline` in chunks. */
export function runOffline(save: SaveData, awayMs: number, crafting: boolean): { save: SaveData; summary: OfflineSummary } {
  const state = createOffline(save, awayMs, crafting)
  advanceOffline(state, state.stepsLeft)
  return finishOffline(state)
}
