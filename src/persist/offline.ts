import { bagIsFull, returnToTown } from '../sim/expedition.ts'
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
export type OfflineStop = 'defeat' | 'returned' | 'uncleared' | 'supplies' | 'blocked' | 'bagFull' | 'runLimit' | null

/** What one hero did while the player was away. */
export type HeroAwaySummary = {
  heroId: string
  heroName: string
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
  contractsFinished: number
  /** Why this hero stopped running. A reason the player may need to act on. */
  stopped: OfflineStop
  /** The reason a repeat could not start, in words, when `stopped` is blocked. */
  note: string | null
  /** What the standing orders did at the holds between fights. Absent counts as 0. */
  pushedOn?: number
  walkedHomeHp?: number
  walkedHomeBag?: number
}

/** The "while you were away" report: shared facts, and one row per hero that ran. The selected hero is first. */
export type AwayReport = {
  /** Time away, before the cap. */
  awayMs: number
  /** Time actually replayed. */
  replayedMs: number
  /** What every hero's crafts finished, as the notices say. */
  crafts: string[]
  /** The base item of each finished craft, in the same order as `crafts`, so the shops can badge themselves. */
  craftBaseIds: string[]
  /** Places discovered, sorted. Several heroes can reach them in any order. */
  discovered: string[]
  heroes: HeroAwaySummary[]
}

/** What the standing orders did between fights, or an empty string when there was no hold. */
export function ordersLine(hero: HeroAwaySummary): string {
  const pushed = hero.pushedOn ?? 0
  const hp = hero.walkedHomeHp ?? 0
  const bag = hero.walkedHomeBag ?? 0
  if (pushed + hp + bag === 0) return ''
  const parts: string[] = []
  if (pushed > 0) parts.push(`pushed on ${pushed} ${pushed === 1 ? 'time' : 'times'}`)
  if (hp > 0) parts.push(`walked home ${hp} ${hp === 1 ? 'time' : 'times'} because HP was under the push-on limit`)
  if (bag > 0) parts.push(`walked home ${bag} ${bag === 1 ? 'time' : 'times'} because the bag was nearly full`)
  return `Standing orders for ${hero.heroName}: ${parts.join(', ')}.`
}

/** One hero's replay: the selected hero's live run, or another hero's away run. */
export type Lane = {
  heroId: string
  /** The fight count the run was pushed on from, as the live screen keeps it. */
  pushedAt: number | null
  /** Gold and loot the run held when the last fight ended, so a won fight's gain can be told apart and reduced. */
  baseline: { gold: number; unsecured: { [materialId: string]: number } }
  stopped: OfflineStop
  summary: HeroAwaySummary
  /** Before-values for the summary, taken from the starting save. */
  start: { level: number; gold: number; materials: { [materialId: string]: number }; contractsDone: number }
}

export type OfflineState = {
  save: SaveData
  /** Simulation steps still to replay. */
  stepsLeft: number
  crafting: boolean
  awayMs: number
  replayedMs: number
  crafts: string[]
  craftBaseIds: string[]
  /** Discoveries in the starting save. */
  discoveries: string[]
  /** Lane 0 is the selected hero. The others are the heroes with an away route, in roster order. */
  lanes: Lane[]
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
 * Run `change` on a view of the save in which `heroId` is the selected hero and that hero's away run is the
 * expedition. Everything the persist helpers do for "the selected hero" then applies to that hero. The
 * result goes back with the real selected hero and expedition restored and the run stored on the hero.
 */
export function withView(save: SaveData, heroId: string, change: (view: SaveData) => SaveData): SaveData {
  if (save.selectedHeroId === heroId) return change(save)
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return save
  const view: SaveData = {
    ...save,
    selectedHeroId: heroId,
    expedition: hero.awayRun,
    heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, awayRun: null } : entry)),
  }
  const out = change(view)
  return {
    ...out,
    selectedHeroId: save.selectedHeroId,
    expedition: save.expedition,
    heroes: out.heroes.map((entry) => (entry.id === heroId ? { ...entry, awayRun: out.expedition } : entry)),
  }
}

/**
 * The player left with no run and chose an away route: start it first (GAME_DESIGN §11). It is refused, with the
 * reason, when the hero has not cleared the route, the packed supplies are not in the stash, or the run cannot begin.
 */
function startAwayRun(save: SaveData, seed: number): { save: SaveData; stopped: OfflineStop; note: string | null } {
  const hero = selectedHero(save)
  if (save.expedition !== null || hero === null || hero.awayRouteId === null) return { save, stopped: null, note: null }
  if (!routeCleared(hero, hero.awayRouteId)) return { save, stopped: 'uncleared', note: null }
  if (packFromStash(hero).missing.length > 0) return { save, stopped: 'supplies', note: null }
  // The player left at `lastSeenAt`; a defeat's rest still pending then keeps the away run from starting.
  const begun = beginExpedition(save, hero.awayRouteId, seed, save.lastSeenAt)
  if (!begun.ok) return { save, stopped: 'blocked', note: begun.reason }
  return { save: begun.save, stopped: null, note: null }
}

/** The first run's seed for a lane. Lane 0 keeps the seed it always had; the others differ by lane. */
function laneSeed(lastSeenAt: number | null, laneIndex: number): number {
  // A wall-clock time is far above the 32-bit range `deriveSeed` takes, so fold it into that range first.
  const base = deriveSeed(Math.trunc(lastSeenAt ?? 1) | 0, 4242)
  return laneIndex === 0 ? base : deriveSeed(base, laneIndex)
}

/** The ids of the heroes that run: the selected hero first, then every other hero with an away route, in roster order. */
export function laneHeroIds(save: SaveData): string[] {
  const ids: string[] = save.selectedHeroId === null ? [] : [save.selectedHeroId]
  for (const hero of save.heroes) if (hero.id !== save.selectedHeroId && hero.awayRouteId !== null) ids.push(hero.id)
  return ids
}

function newLane(view: SaveData, heroId: string, note: string | null, stopped: OfflineStop): Lane {
  const purse = purseOf(view)
  return {
    heroId,
    pushedAt: null,
    baseline: baselineOf(view),
    stopped,
    start: { level: heroLevel(view), gold: safeGold(view), materials: { ...purse.materials }, contractsDone: contractsDone(view) },
    summary: {
      heroId,
      heroName: selectedHero(view)?.name ?? heroId,
      runs: 0,
      fightsWon: 0,
      retreats: 0,
      defeated: false,
      xp: 0,
      levelsGained: 0,
      gold: 0,
      materials: {},
      contractsFinished: 0,
      stopped: null,
      note,
    },
  }
}

/**
 * Start a catch-up. The given save is copied, so nothing about it changes. Time is replayed in whole
 * simulation steps by `advanceOffline`. `crafting` is false when something else already counted the
 * crafting time, such as the wall-clock craft timer of a tab that was only hidden.
 */
export function createOffline(save: SaveData, awayMs: number, crafting: boolean): OfflineState {
  let copy = structuredClone(save)
  const ms = replayMs(awayMs)
  const lanes: Lane[] = []
  laneHeroIds(copy).forEach((heroId, index) => {
    copy = withView(copy, heroId, (view) => {
      const away = startAwayRun(view, laneSeed(copy.lastSeenAt, index))
      lanes.push(newLane(away.save, heroId, away.note, away.stopped))
      return away.save
    })
  })
  return {
    save: copy,
    stepsLeft: Math.floor(ms / STEP_MS),
    crafting,
    awayMs,
    replayedMs: ms,
    crafts: [],
    craftBaseIds: [],
    discoveries: [...copy.account.discoveries],
    lanes,
  }
}

export function offlineDone(state: OfflineState): boolean {
  return state.stepsLeft <= 0
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

function baselineOf(save: SaveData): Lane['baseline'] {
  const expedition = save.expedition
  const unsecured: { [materialId: string]: number } = {}
  for (const stack of expedition?.unsecured ?? []) unsecured[stack.materialId] = stack.quantity
  return { gold: expedition?.carriedGold ?? 0, unsecured }
}

/** A lane being replayed on its view of the save. */
type Ctx = { save: SaveData; lane: Lane }

/**
 * A fight just ended. Reduce what it dropped to the offline rate, then take a new baseline. The drop is
 * what the run holds now minus what it held after the last fight.
 */
function applyLootRate(ctx: Ctx): void {
  const expedition = ctx.save.expedition
  if (expedition === null) return
  const baseline = ctx.lane.baseline
  const gold = expedition.carriedGold - baseline.gold
  if (gold > 0) expedition.carriedGold = baseline.gold + roundHalfUp(gold * OFFLINE_LOOT_RATE)
  expedition.unsecured = expedition.unsecured.flatMap((stack) => {
    const before = baseline.unsecured[stack.materialId] ?? 0
    const gain = stack.quantity - before
    const quantity = gain > 0 ? before + roundHalfUp(gain * OFFLINE_LOOT_RATE) : stack.quantity
    return quantity > 0 ? [{ ...stack, quantity }] : []
  })
  ctx.lane.baseline = baselineOf(ctx.save)
}

/** Every node of the route is in the hero's cleared list. */
function routeCleared(hero: SavedHero, routeId: string): boolean {
  const route = routes[routeId]
  if (route === undefined) return false
  return route.nodeIds.every((id) => id === 'greyhaven' || hero.clearedNodeIds.includes(id))
}

/** Count the fights an expedition has finished since `seen` of its history entries. */
function countNewFights(ctx: Ctx, seen: number): number {
  const expedition = ctx.save.expedition
  if (expedition === null) return seen
  for (let index = seen; index < expedition.history.length; index += 1) {
    const entry = expedition.history[index]
    if (entry === undefined) continue
    if (entry.outcome === 'victory') ctx.lane.summary.fightsWon += 1
    else if (entry.outcome === 'retreat') ctx.lane.summary.retreats += 1
  }
  return expedition.history.length
}

/** A run that came home safely. Settle it and start the next one when the standing orders say so. Returns false when running must stop. */
function afterReturn(ctx: Ctx): boolean {
  const expedition = ctx.save.expedition
  const hero = selectedHero(ctx.save)
  const lane = ctx.lane
  if (expedition === null || hero === null) return false
  lane.summary.runs += 1
  if (!hero.repeatRoute) {
    lane.stopped = 'returned'
    return false
  }
  if (hero.repeatLimit > 0 && lane.summary.runs >= hero.repeatLimit) {
    lane.stopped = 'runLimit'
    return false
  }
  const routeId = expedition.id
  const seed = deriveSeed(expedition.seed, 7919)
  lane.summary.xp += expedition.xpEarned ?? 0
  ctx.save = settleExpedition(ctx.save)
  const settled = selectedHero(ctx.save)
  if (settled === null) return false
  if (!routeCleared(settled, routeId)) {
    lane.stopped = 'uncleared'
    return false
  }
  if (packFromStash(settled).missing.length > 0) {
    lane.stopped = 'supplies'
    return false
  }
  const begun = beginExpedition(ctx.save, routeId, seed)
  if (!begun.ok) {
    lane.stopped = 'blocked'
    lane.summary.note = begun.reason
    return false
  }
  ctx.save = begun.save
  lane.pushedAt = null
  lane.baseline = baselineOf(ctx.save)
  return true
}

/** At the hold between fights: the standing orders choose to push on or to walk home. */
function decideAtHold(ctx: Ctx): void {
  const expedition = ctx.save.expedition
  const hero = selectedHero(ctx.save)
  if (expedition === null || hero === null) return
  const hpPercent = (expedition.hero.hp / expedition.hero.maxHp) * 100
  const summary = ctx.lane.summary
  if (hpPercent < hero.pushOnHpPercent) {
    summary.walkedHomeHp = (summary.walkedHomeHp ?? 0) + 1
    returnToTown(expedition)
    return
  }
  if (bagIsFull(expedition)) {
    // 'ask' holds the run for the player; replaying stops here and the run waits at this hold.
    if (hero.bagFullOrder === 'ask') ctx.lane.stopped = 'bagFull'
    else {
      summary.walkedHomeBag = (summary.walkedHomeBag ?? 0) + 1
      returnToTown(expedition)
    }
    return
  }
  summary.pushedOn = (summary.pushedOn ?? 0) + 1
  ctx.lane.pushedAt = expedition.encounterIndex
}

/** Replay up to `budget` steps of one lane's run. */
function runLane(ctx: Ctx, budget: number): void {
  const lane = ctx.lane
  let used = 0
  let seen = ctx.save.expedition?.history.length ?? 0
  while (used < budget && lane.stopped === null) {
    const expedition = ctx.save.expedition
    if (expedition === null) break
    if (expedition.outcome === 'defeat') {
      lane.summary.runs += 1
      lane.summary.defeated = true
      lane.stopped = 'defeat'
      break
    }
    if (expedition.outcome === 'returned') {
      seen = countNewFights(ctx, seen)
      if (!afterReturn(ctx)) break
      seen = ctx.save.expedition?.history.length ?? 0
      continue
    }
    if (shouldHold(expedition, lane.pushedAt)) {
      decideAtHold(ctx)
      continue
    }
    stepExpedition(expedition, defs)
    used += 1
    if (expedition.history.length !== seen) {
      applyLootRate(ctx)
      seen = countNewFights(ctx, seen)
    }
  }
}

/**
 * Replay up to `maxSteps` simulation steps. The result does not depend on how the time is split
 * into calls: crafting adds up (once for all heroes), and each hero's expedition only moves by single steps.
 */
export function advanceOffline(state: OfflineState, maxSteps: number): void {
  const budget = Math.min(Math.max(0, Math.floor(maxSteps)), state.stepsLeft)
  if (budget === 0) return
  if (state.crafting) {
    const crafted = advanceCrafting(state.save, budget * STEP_MS)
    state.save = crafted.save
    for (const notice of crafted.finished) {
      state.crafts.push(notice.text)
      state.craftBaseIds.push(notice.baseId)
    }
  }
  for (const lane of state.lanes) {
    state.save = withView(state.save, lane.heroId, (view) => {
      const ctx: Ctx = { save: view, lane }
      runLane(ctx, budget)
      return ctx.save
    })
  }
  state.stepsLeft -= budget
}

/** The finished save and report. A run that ended is left for the player to close on the Map. */
export function finishOffline(state: OfflineState): { save: SaveData; summary: AwayReport } {
  let save = state.save
  const heroes: HeroAwaySummary[] = []
  for (const lane of state.lanes) {
    save = withView(save, lane.heroId, (view) => {
      let current = view
      if (current.expedition !== null) current = recordProgress(current)
      const before = lane.start
      const purse = purseOf(current)
      const materials: { [materialId: string]: number } = {}
      for (const [id, amount] of Object.entries(purse.materials)) {
        const gained = amount - (before.materials[id] ?? 0)
        if (gained > 0) materials[id] = gained
      }
      // A defeat on the very last replayed step has not been looked at by the loop yet.
      const lost = current.expedition?.outcome === 'defeat'
      heroes.push({
        ...lane.summary,
        runs: lane.summary.runs + (lost && !lane.summary.defeated ? 1 : 0),
        defeated: lane.summary.defeated || lost,
        gold: Math.max(0, safeGold(current) - before.gold),
        materials,
        levelsGained: Math.max(0, heroLevel(current) - before.level),
        contractsFinished: Math.max(0, contractsDone(current) - before.contractsDone),
        stopped: lost ? 'defeat' : lane.stopped,
      })
      return current
    })
  }
  const summary: AwayReport = {
    awayMs: state.awayMs,
    replayedMs: state.replayedMs,
    crafts: [...state.crafts],
    craftBaseIds: [...state.craftBaseIds],
    discovered: newlyDiscovered(state.discoveries, save.account.discoveries).sort(),
    heroes,
  }
  return { save, summary }
}

/** Replay everything in one call. Tests and small catch-ups use this; the screen uses `advanceOffline` in chunks. */
export function runOffline(save: SaveData, awayMs: number, crafting: boolean): { save: SaveData; summary: AwayReport } {
  const state = createOffline(save, awayMs, crafting)
  advanceOffline(state, state.stepsLeft)
  return finishOffline(state)
}

/**
 * Background heroes while the page is open (GAME_DESIGN §11, "Offline extras"): run every hero that is not
 * selected and has an away route for `steps` simulation steps, with the same orders and rules as a catch-up
 * and no summary. `lanes` carries each hero's replay state from one call to the next and is returned
 * updated. Heroes that were selected, or lost their away route, drop out. The runs of the given save are
 * not changed; the returned save holds new ones.
 */
export function advanceBackground(save: SaveData, lanes: readonly Lane[], steps: number): { save: SaveData; lanes: Lane[] } {
  const ids = laneHeroIds(save)
  if (ids.length < 2 || !(steps > 0)) return { save, lanes: lanes.filter((lane) => ids.includes(lane.heroId) && lane.heroId !== save.selectedHeroId) }
  let current: SaveData = {
    ...save,
    heroes: save.heroes.map((hero) => (hero.awayRun !== null ? { ...hero, awayRun: structuredClone(hero.awayRun) } : hero)),
  }
  const next: Lane[] = []
  ids.forEach((heroId, index) => {
    if (heroId === current.selectedHeroId) return
    let lane = lanes.find((entry) => entry.heroId === heroId)
    current = withView(current, heroId, (view) => {
      let result = view
      if (lane === undefined) {
        const away = startAwayRun(view, laneSeed(current.lastSeenAt, index))
        lane = newLane(away.save, heroId, away.note, away.stopped)
        result = away.save
      }
      const ctx: Ctx = { save: result, lane }
      runLane(ctx, Math.floor(steps))
      return ctx.save
    })
    if (lane !== undefined) next.push(lane)
  })
  return { save: current, lanes: next }
}
