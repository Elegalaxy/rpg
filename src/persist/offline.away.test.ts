import { describe, expect, it } from 'vitest'

import { itemBase } from '../content/items.ts'
import { gameDefs } from '../content/scenarios.ts'
import { EQUIPMENT_SLOT_IDS } from '../sim/economy.ts'
import { stepExpedition } from '../sim/expedition.ts'

import {
  advanceOffline,
  awayBanner,
  createOffline,
  finishOffline,
  offlineDone,
  runOffline,
  withView,
  type HeroAwaySummary,
} from './offline.ts'
import { createHero } from './roster.ts'
import { newSave, serializeSave, type SaveData } from './save.ts'
import { beginExpedition } from './world.ts'

// Away rules follow Auto run (Step 13.15, GAME_DESIGN §11 "Away rules for a run").

const defs = gameDefs()
const MINUTE = 60_000

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

/** A level 40 Warrior who wins every Road fight. */
function strongHero(): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  return {
    ...made.save,
    heroes: made.save.heroes.map((entry) => ({ ...entry, progress: { ...entry.progress, level: 40, attributes } })),
  }
}

function running(save: SaveData = strongHero()): SaveData {
  return ok(beginExpedition(save, 'splintered-road', 5))
}

function withHero(save: SaveData, change: Record<string, unknown>): SaveData {
  return { ...save, heroes: save.heroes.map((hero) => ({ ...hero, ...change })) }
}

/** The run steps until it waits at its first hold: one fight won, walking has not started. */
function atFirstHold(save: SaveData): SaveData {
  const run = save.expedition!
  while (!(run.encounterIndex > 0 && run.phase === 'travel' && run.travelMs === 0 && !run.returning)) stepExpedition(run, defs)
  run.hero.hp = run.hero.maxHp
  return save
}

const manual = (change: Record<string, unknown> = {}) => running(withHero(strongHero(), { repeatRoute: false, ...change }))

function inChunks(save: SaveData, ms: number, chunks: number[]) {
  const state = createOffline(save, ms, true)
  let at = 0
  while (!offlineDone(state)) {
    advanceOffline(state, chunks[at % chunks.length] ?? 1)
    at += 1
  }
  return finishOffline(state)
}

describe('Auto run off', () => {
  it('leaves a run waiting at Push on exactly as it was, and settles and starts nothing', () => {
    const save = atFirstHold(manual())
    const before = structuredClone(save.expedition)
    const away = runOffline(save, 30 * MINUTE, true)
    expect(away.save.expedition).toEqual(before)
    const hero = away.summary.heroes[0]!
    expect(hero.stopped).toBe('held')
    expect(hero.runs).toBe(0)
    expect(hero.fightsWon).toBe(0)
    expect(hero.pushedOn).toBeUndefined()
    expect(away.save.heroes[0]!.routeReturns['splintered-road'] ?? 0).toBe(0)
    expect(awayBanner(hero)).toContain('Paused at Push on')
  })

  it('lets the fight in progress finish, then holds at the next hold', () => {
    const save = manual()
    const run = save.expedition!
    while (run.phase !== 'combat') stepExpedition(run, defs)
    const away = runOffline(save, 30 * MINUTE, true)
    const after = away.save.expedition!
    expect(after.history).toHaveLength(1)
    expect(after.outcome).toBe('ongoing')
    expect(after.phase).toBe('travel')
    expect(after.travelMs).toBe(0)
    expect(away.summary.heroes[0]!.fightsWon).toBe(1)
    expect(away.summary.heroes[0]!.stopped).toBe('held')
  })

  it('still walks home when the per-run fight limit is reached, and leaves the run on the outcome card', () => {
    const away = runOffline(atFirstHold(manual({ stopAfterFights: 1 })), 30 * MINUTE, true)
    expect(away.save.expedition?.outcome).toBe('returned')
    expect(away.save.expedition?.history).toHaveLength(1)
    expect(away.summary.heroes[0]!.walkedHomeFights).toBe(1)
    expect(away.summary.heroes[0]!.stopped).toBe('returned')
    expect(away.save.heroes[0]!.routeReturns['splintered-road'] ?? 0).toBe(0)
  })

  it('does not start a new run over a safe return waiting on the outcome card, even with Repeat on', () => {
    const save = atFirstHold(manual({ awayRouteId: 'splintered-road', clearedNodeIds: ['splintered-road'], repeatRoute: true }))
    save.expedition!.outcome = 'returned'
    const away = runOffline(save, 30 * MINUTE, true)
    expect(away.save.expedition?.outcome).toBe('returned')
    expect(away.save.expedition?.seed).toBe(5)
    expect(away.summary.heroes[0]!.runs).toBe(0)
  })

  it('gives the same result in one call or in uneven chunks', () => {
    const save = manual()
    const whole = runOffline(save, 15 * MINUTE, true)
    const chunked = inChunks(save, 15 * MINUTE, [1, 7, 250, 3_000, 41])
    expect(serializeSave(chunked.save)).toBe(serializeSave(whole.save))
    expect(chunked.summary).toEqual(whole.summary)
  })
})

describe('Auto run on', () => {
  const auto = (change: Record<string, unknown> = {}) => manual({ autoRun: true, ...change })

  it('keeps going under the standing orders and says so', () => {
    const away = runOffline(atFirstHold(auto()), 40 * MINUTE, true)
    const hero = away.summary.heroes[0]!
    expect(hero.autoRan).toBe(true)
    expect(hero.pushedOn).toBeGreaterThan(0)
    expect(hero.runs).toBeGreaterThan(1)
    expect(hero.stopped).toBeNull()
    expect(awayBanner(hero)).toMatch(/^Auto run kept going while Ash was away: \d+ fights, \d+ runs\.$/)
  })

  it('reruns on a route the hero has not cleared, whatever Repeat says', () => {
    const away = runOffline(auto({ pushOnHpPercent: 100 }), 40 * MINUTE, true)
    expect(away.summary.heroes[0]!.runs).toBeGreaterThan(2)
    expect(away.summary.heroes[0]!.stopped).toBeNull()
    expect(away.save.heroes[0]!.clearedNodeIds).not.toContain('splintered-road')
    expect(away.save.heroes[0]!.autoRun).toBe(true)
  })

  it('gives the same result in one call or in uneven chunks', () => {
    const save = auto({ pushOnHpPercent: 100, autoRunMaxFights: 9 })
    const whole = runOffline(save, 40 * MINUTE, true)
    const chunked = inChunks(save, 40 * MINUTE, [5, 600, 31, 4_000])
    expect(serializeSave(chunked.save)).toBe(serializeSave(whole.save))
    expect(chunked.summary).toEqual(whole.summary)
  })

  it('stops at a defeat and switches itself off', () => {
    const save = auto()
    const run = save.expedition!
    run.retreatThresholds = []
    run.heroTemplate.attributes = { strength: 1, vitality: 1, agility: 1, intellect: 1, spirit: 1 }
    run.hero.maxHp = 20
    run.hero.hp = 1
    const away = runOffline(save, 60 * MINUTE, true)
    expect(away.summary.heroes[0]!.stopped).toBe('defeat')
    expect(away.save.expedition?.outcome).toBe('defeat')
    expect(away.save.heroes[0]!.autoRun).toBe(false)
    expect(awayBanner(away.summary.heroes[0]!)).toContain('Stopped: the hero was defeated.')
  })

  it('stops at the next start when a worn piece is at 0 durability, and names the piece', () => {
    const save = auto()
    // The run wears the piece down: wear is taken from the run's own gear when it settles.
    const piece = save.expedition!.equipment[0]!
    piece.durability = 0
    piece.disabled = true
    const worn = save.heroes[0]!.equipment[piece.slot as (typeof EQUIPMENT_SLOT_IDS)[number]]!
    const name = itemBase(worn.baseId)!.name
    const away = runOffline(save, 40 * MINUTE, true)
    const summary = away.summary.heroes[0]!
    expect(summary.stopped).toBe('blocked')
    expect(summary.note).toBe(`${name} is at 0 durability. Repair it.`)
    expect(summary.runs).toBe(1)
    expect(away.save.expedition).toBeNull()
    expect(away.save.heroes[0]!.autoRun).toBe(false)
    expect(awayBanner(summary)).toContain(`Stopped: ${name} is at 0 durability. Repair it.`)
  })

  it('stops at the session limit, walks home and switches itself off', () => {
    const away = runOffline(auto({ autoRunMaxFights: 4 }), 60 * MINUTE, true)
    const summary = away.summary.heroes[0]!
    expect(summary.autoFights).toBe(4)
    expect(summary.stopped).toBe('autoLimit')
    expect(away.save.heroes[0]!.autoRun).toBe(false)
    expect(away.save.expedition?.outcome).toBe('returned')
  })

  it('counts the fights played before leaving towards the session limit', () => {
    const state = createOffline(auto({ autoRunMaxFights: 4 }), 60 * MINUTE, true, 3)
    advanceOffline(state, state.stepsLeft)
    expect(finishOffline(state).summary.heroes[0]!.autoFights).toBe(1)
  })

  it('stops when the packed supplies are not in the stash', () => {
    const away = runOffline(auto({ packedSupplies: ['healing-draught'] }), 40 * MINUTE, true)
    const summary = away.summary.heroes[0]!
    expect(summary.stopped).toBe('supplies')
    expect(summary.note).toBe('The packed supplies are not in the stash.')
    expect(away.save.heroes[0]!.autoRun).toBe(false)
    expect(away.save.expedition).toBeNull()
  })

  it('settles a run that returned before the player left and runs the route again', () => {
    const save = auto()
    save.expedition!.outcome = 'returned'
    const away = runOffline(save, 5 * MINUTE, true)
    expect(away.save.expedition?.outcome).toBe('ongoing')
    expect(away.save.expedition?.seed).not.toBe(5)
  })
})

describe('the away route', () => {
  const idle = (change: Record<string, unknown> = {}) => withHero(strongHero(), { awayRouteId: 'splintered-road', clearedNodeIds: ['splintered-road'], ...change })

  it('starts when the hero has no run, and says so', () => {
    const away = runOffline(idle(), 10 * MINUTE, true)
    expect(away.save.expedition).not.toBeNull()
    expect(awayBanner(away.summary.heroes[0]!)).toBe('Away route started: Splintered Road.')
  })

  it('does not start while a run is waiting at Push on', () => {
    const save = atFirstHold(running(idle()))
    const before = structuredClone(save.expedition)
    const away = runOffline(save, 30 * MINUTE, true)
    expect(away.save.expedition).toEqual(before)
    expect(away.summary.heroes[0]!.stopped).toBe('held')
    expect(away.summary.heroes[0]!.awayStarted).toBe(false)
  })

  it('does not start while an ended run waits on the outcome card', () => {
    const save = running(idle())
    save.expedition!.outcome = 'returned'
    const away = runOffline(save, 30 * MINUTE, true)
    expect(away.save.expedition?.outcome).toBe('returned')
    expect(away.save.expedition?.seed).toBe(5)
  })

  it('follows the repeat orders: repeat off stops after the first safe return', () => {
    const away = runOffline(idle({ repeatRoute: false }), 40 * MINUTE, true)
    expect(away.summary.heroes[0]!.stopped).toBe('returned')
    expect(away.summary.heroes[0]!.runs).toBe(1)
    expect(away.save.expedition?.outcome).toBe('returned')
  })

  it('repeats a cleared route while Repeat is on, and in chunks gives the same result', () => {
    const save = idle({ repeatRoute: true })
    const whole = runOffline(save, 40 * MINUTE, true)
    expect(whole.summary.heroes[0]!.runs).toBeGreaterThan(1)
    const chunked = inChunks(save, 40 * MINUTE, [3, 777, 12_000])
    expect(serializeSave(chunked.save)).toBe(serializeSave(whole.save))
  })
})

describe('other heroes', () => {
  function twoHeroes(second: Record<string, unknown>, runRoute: string | null): SaveData {
    const made = createHero(strongHero(), { name: 'Brin', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
    let save: SaveData = {
      ...made.save,
      selectedHeroId: 'hero-1',
      heroes: made.save.heroes.map((entry, index) => ({
        ...entry,
        clearedNodeIds: ['splintered-road'],
        repeatRoute: false,
        progress: { ...entry.progress, level: 40, attributes },
        ...(index === 1 ? second : {}),
      })),
    }
    if (runRoute !== null) save = withView(save, 'hero-2', (view) => ok(beginExpedition(view, runRoute, 9)))
    return save
  }

  it('holds a background run that is not on its away route and has no Auto run', () => {
    const away = runOffline(twoHeroes({ awayRouteId: 'withered-grove' }, 'splintered-road'), 10 * MINUTE, true)
    const second = away.summary.heroes[1]!
    expect(second.heroId).toBe('hero-2')
    expect(second.stopped).toBe('held')
    expect(away.save.heroes[1]!.awayRun!.history.length).toBeLessThanOrEqual(1)
  })

  it('continues a background run on its own away route', () => {
    const away = runOffline(twoHeroes({ awayRouteId: 'splintered-road' }, 'splintered-road'), 10 * MINUTE, true)
    expect(away.summary.heroes[1]!.fightsWon).toBeGreaterThan(1)
    expect(away.summary.heroes[1]!.stopped).not.toBe('held')
  })

  it('continues a background run with Auto run on, even without an away route', () => {
    const away = runOffline(twoHeroes({ awayRouteId: null, autoRun: true }, 'splintered-road'), 10 * MINUTE, true)
    expect(away.summary.heroes.map((entry) => entry.heroId)).toEqual(['hero-1', 'hero-2'])
    expect(away.summary.heroes[1]!.autoRan).toBe(true)
    expect(away.summary.heroes[1]!.fightsWon).toBeGreaterThan(1)
  })

  it('rests a background run without an away route and without Auto run', () => {
    const away = runOffline(twoHeroes({ awayRouteId: null }, 'splintered-road'), 10 * MINUTE, true)
    expect(away.summary.heroes.map((entry) => entry.heroId)).toEqual(['hero-1'])
  })
})

describe('the banner', () => {
  const base = (): HeroAwaySummary => ({
    heroId: 'hero-1',
    heroName: 'Ash',
    routeId: 'splintered-road',
    runs: 2,
    fightsWon: 5,
    retreats: 0,
    defeated: false,
    xp: 0,
    levelsGained: 0,
    gold: 0,
    materials: {},
    contractsFinished: 0,
    stopped: null,
    note: null,
  })

  it('says what happened for each case, and nothing when nothing did', () => {
    expect(awayBanner(base())).toBeNull()
    expect(awayBanner({ ...base(), autoRan: true, autoFights: 7 })).toBe('Auto run kept going while Ash was away: 7 fights, 2 runs.')
    expect(awayBanner({ ...base(), autoRan: true, autoFights: 1, runs: 1, stopped: 'autoLimit' })).toBe(
      'Auto run kept going while Ash was away: 1 fight, 1 run. Stopped: the total fight limit was reached, so Auto run is off.',
    )
    expect(awayBanner({ ...base(), stopped: 'held' })).toBe('Paused at Push on while Ash was away (Auto run is off).')
    expect(awayBanner({ ...base(), awayStarted: true })).toBe('Away route started: Splintered Road.')
  })
})
