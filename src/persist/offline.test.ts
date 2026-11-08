import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { STEP_MS } from '../sim/constants.ts'
import { stepExpedition } from '../sim/expedition.ts'

import { CRAFT_MS, queueCraft } from './crafting.ts'
import {
  OFFLINE_CAP_MS,
  OFFLINE_LOOT_RATE,
  OFFLINE_MIN_MS,
  advanceBackground,
  advanceOffline,
  createOffline,
  finishOffline,
  offlineDone,
  replayMs,
  runOffline,
  withView,
} from './offline.ts'
import { createHero, deleteHero, selectHero } from './roster.ts'
import { newSave, parseSave, purseOf, serializeSave, updatePurse, type SaveData } from './save.ts'
import { beginExpedition } from './world.ts'

const defs = gameDefs()
const MINUTE = 60_000

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

/** A level 40 Warrior who wins every Road fight, so a replay runs the road again and again. */
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

describe('how much time is replayed', () => {
  it('ignores short absences and a clock that went backwards, and stops at eight hours', () => {
    expect(replayMs(OFFLINE_MIN_MS - 1)).toBe(0)
    expect(replayMs(-5 * MINUTE)).toBe(0)
    expect(replayMs(Number.NaN)).toBe(0)
    expect(replayMs(10 * MINUTE)).toBe(10 * MINUTE)
    expect(replayMs(20 * 60 * MINUTE)).toBe(OFFLINE_CAP_MS)
    const save = running()
    const same = runOffline(save, -MINUTE, true)
    expect(same.save).toEqual(save)
    expect(same.summary.replayedMs).toBe(0)
  })
})

describe('crafting while away', () => {
  it('finishes every hero\'s queue and reports it', () => {
    let save = strongHero()
    const second = createHero(save, { name: 'Brin', race: 'elf', classId: 'mage' })
    if (!second.ok) throw new Error(second.reason)
    save = second.save
    for (const id of ['hero-1', 'hero-2']) save = updatePurse(save, { gold: 100, materials: { scrap: 10 } }, id)
    const request = { baseId: 'weapon-one-handed', itemLevel: 1, materialId: 'scrap', modifierId: null }
    save = ok(queueCraft(save, 'hero-1', request))
    save = ok(queueCraft(save, 'hero-2', { ...request, baseId: 'weapon-caster' }))
    const away = runOffline(save, 2 * CRAFT_MS, true)
    expect(away.summary.crafts).toHaveLength(2)
    expect(purseOf(away.save, 'hero-1').craftQueue).toEqual([])
    expect(purseOf(away.save, 'hero-2').archive).toHaveLength(1)
    expect(away.save.expedition).toBeNull()
    const skipped = runOffline(save, 2 * CRAFT_MS, false)
    expect(skipped.summary.crafts).toEqual([])
    expect(purseOf(skipped.save, 'hero-1').craftQueue).toHaveLength(1)
  })
})

describe('an expedition while away', () => {
  it('does not change the save it is given, and runs the same way twice', () => {
    const save = running()
    const text = serializeSave(save)
    const first = runOffline(save, 20 * MINUTE, true)
    expect(serializeSave(save)).toBe(text)
    const second = runOffline(save, 20 * MINUTE, true)
    expect(second).toEqual(first)
  })

  it('gives the same result whether it is replayed in one call or in uneven chunks', () => {
    const save = running()
    const whole = runOffline(save, 15 * MINUTE, true)
    const state = createOffline(save, 15 * MINUTE, true)
    const chunks = [1, 7, 250, 3_000, 41, 12_345, 999]
    let at = 0
    while (!offlineDone(state)) {
      advanceOffline(state, chunks[at % chunks.length] ?? 1)
      at += 1
    }
    const chunked = finishOffline(state)
    expect(serializeSave(chunked.save)).toBe(serializeSave(whole.save))
    expect(chunked.summary).toEqual(whole.summary)
    expect(parseSave(serializeSave(whole.save)).ok).toBe(true)
  })

  it('matches stepping the same time live, apart from the loot rate', () => {
    const save = running()
    const live = structuredClone(save)
    const steps = 2_500
    for (let step = 0; step < steps; step += 1) stepExpedition(live.expedition!, defs)
    const away = runOffline(save, steps * STEP_MS, true)
    // Only the loot differs: a fight may end in this window, and the offline rate halves its drop.
    const awayRun = { ...away.save.expedition!, carriedGold: live.expedition!.carriedGold, unsecured: live.expedition!.unsecured }
    expect(awayRun).toEqual(live.expedition)
  })

  it('brings home half the loot and gold of a fight won while away, rounded half up', () => {
    const save = running()
    const live = structuredClone(save)
    const startGold = live.expedition!.carriedGold
    let steps = 0
    while (live.expedition!.history.length === 0) {
      stepExpedition(live.expedition!, defs)
      steps += 1
    }
    const liveGold = live.expedition!.carriedGold - startGold
    const liveLoot = Object.fromEntries(live.expedition!.unsecured.map((stack) => [stack.materialId, stack.quantity]))
    expect(liveGold).toBeGreaterThan(1)
    expect(Object.values(liveLoot).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(1)

    const away = runOffline(save, steps * STEP_MS, true).save.expedition!
    expect(away.history).toHaveLength(1)
    expect(away.carriedGold - startGold).toBe(Math.floor(liveGold * OFFLINE_LOOT_RATE + 0.5))
    const awayLoot = Object.fromEntries(away.unsecured.map((stack) => [stack.materialId, stack.quantity]))
    for (const [id, amount] of Object.entries(liveLoot)) expect(awayLoot[id]).toBe(Math.floor(amount * OFFLINE_LOOT_RATE + 0.5))
    expect(away.xpEarned).toBe(live.expedition!.xpEarned)
  })

  it('runs the cleared route again and again while the orders say repeat', () => {
    const away = runOffline(running(), 40 * MINUTE, true)
    expect(away.summary.heroes[0]!.runs).toBeGreaterThan(1)
    expect(away.summary.heroes[0]!.fightsWon).toBeGreaterThan(away.summary.heroes[0]!.runs)
    expect(away.summary.heroes[0]!.defeated).toBe(false)
    expect(away.summary.heroes[0]!.xp).toBeGreaterThan(0)
    expect(away.summary.heroes[0]!.gold).toBeGreaterThan(0)
    expect(Object.values(away.summary.heroes[0]!.materials).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0)
    expect(away.save.heroes[0]!.clearedNodeIds).toContain('splintered-road')
  })

  it('stops after the first safe return when repeat is off, leaving the run to close on the Map', () => {
    const away = runOffline(running(withHero(strongHero(), { repeatRoute: false })), 40 * MINUTE, true)
    expect(away.summary.heroes[0]!.stopped).toBe('returned')
    expect(away.summary.heroes[0]!.runs).toBe(1)
    expect(away.save.expedition?.outcome).toBe('returned')
  })

  it('does not repeat a route the hero has not cleared, or without the packed supplies', () => {
    const cautious = runOffline(running(withHero(strongHero(), { pushOnHpPercent: 100 })), 40 * MINUTE, true)
    expect(cautious.summary.heroes[0]!.stopped).toBe('uncleared')
    expect(cautious.summary.heroes[0]!.runs).toBe(1)
    expect(cautious.save.heroes[0]!.clearedNodeIds).not.toContain('splintered-road')
    expect(cautious.save.expedition).toBeNull()

    const noStash = withHero(strongHero(), { packedSupplies: ['healing-draught'] })
    const away = runOffline(running(noStash), 40 * MINUTE, true)
    expect(away.summary.heroes[0]!.stopped).toBe('supplies')
    expect(away.summary.heroes[0]!.runs).toBe(1)
    expect(away.save.expedition).toBeNull()
  })

  it('walks home at the push-on percent and keeps going above it', () => {
    function atFirstHold(percent: number): SaveData {
      const save = withHero(running(withHero(strongHero(), { repeatRoute: false })), { pushOnHpPercent: percent })
      const run = save.expedition!
      while (!(run.encounterIndex > 0 && run.phase === 'travel' && run.travelMs === 0 && !run.returning)) stepExpedition(run, defs)
      run.hero.hp = Math.floor(run.hero.maxHp * 0.6)
      return save
    }
    const cautious = runOffline(atFirstHold(80), 30 * MINUTE, true)
    expect(cautious.save.expedition?.history).toHaveLength(1)
    const bold = runOffline(atFirstHold(50), 30 * MINUTE, true)
    expect(bold.save.expedition?.history.length).toBeGreaterThan(1)
  })

  describe('a nearly full bag', () => {
    function atFirstHold(order: 'home' | 'ask', carried: number, capacity?: number): SaveData {
      const save = withHero(running(withHero(strongHero(), { repeatRoute: false })), { bagFullOrder: order })
      const run = save.expedition!
      run.lootCapacity = capacity ?? 20
      while (!(run.encounterIndex > 0 && run.phase === 'travel' && run.travelMs === 0 && !run.returning)) stepExpedition(run, defs)
      run.hero.hp = run.hero.maxHp
      run.unsecured = [{ materialId: 'shard', quantity: carried }]
      return save
    }

    it('walks home when fewer than 4 room is free and the order is home', () => {
      const away = runOffline(atFirstHold('home', 17), 30 * MINUTE, true)
      expect(away.save.expedition?.outcome).toBe('returned')
      expect(away.save.expedition?.history).toHaveLength(1)
    })

    it('keeps pushing on with 4 room free', () => {
      const away = runOffline(atFirstHold('home', 16), 30 * MINUTE, true)
      expect(away.save.expedition?.history.length).toBeGreaterThan(1)
    })

    it('holds the run and stops with the ask order, and the hold waits for the player', () => {
      const away = runOffline(atFirstHold('ask', 17), 30 * MINUTE, true)
      expect(away.summary.heroes[0]!.stopped).toBe('bagFull')
      const run = away.save.expedition!
      expect(run.outcome).toBe('ongoing')
      expect(run.history).toHaveLength(1)
      expect(run.encounterIndex).toBeGreaterThan(0)
      expect(run.travelMs).toBe(0)
    })

    it('counts the run bag room, so a bigger bag is not full yet', () => {
      const away = runOffline(atFirstHold('home', 17, 26), 30 * MINUTE, true)
      expect(away.save.expedition?.history.length).toBeGreaterThan(1)
    })

    it('low HP still walks home first', () => {
      const save = atFirstHold('ask', 17)
      save.expedition!.hero.hp = 1
      const away = runOffline(save, 30 * MINUTE, true)
      expect(away.summary.heroes[0]!.stopped).not.toBe('bagFull')
      expect(away.save.expedition?.outcome).toBe('returned')
    })
  })

  it('stops running after a defeat and leaves the outcome for the player', () => {
    const save = running(withHero(strongHero(), { repeatRoute: true }))
    const run = save.expedition!
    run.retreatThresholds = []
    run.heroTemplate.attributes = { strength: 1, vitality: 1, agility: 1, intellect: 1, spirit: 1 }
    run.hero.maxHp = 20
    run.hero.hp = 1
    const away = runOffline(save, 60 * MINUTE, true)
    expect(away.summary.heroes[0]!.defeated).toBe(true)
    expect(away.summary.heroes[0]!.stopped).toBe('defeat')
    expect(away.save.expedition?.outcome).toBe('defeat')
  })
})

describe('starting a run while away', () => {
  const idle = () => withHero(strongHero(), { awayRouteId: 'splintered-road', clearedNodeIds: ['splintered-road'] })

  it('starts the chosen route when the hero has no run, then follows the standing orders', () => {
    const result = runOffline(idle(), 10 * MINUTE, true)
    expect(result.summary.heroes[0]!.fightsWon).toBeGreaterThan(0)
    expect(result.save.expedition).not.toBeNull()
  })

  it('does nothing without an away route, with an uncleared route, or while a run exists', () => {
    expect(runOffline(withHero(idle(), { awayRouteId: null }), 10 * MINUTE, true).save.expedition).toBeNull()
    const uncleared = runOffline(withHero(idle(), { clearedNodeIds: [] }), 10 * MINUTE, true)
    expect(uncleared.save.expedition).toBeNull()
    expect(uncleared.summary.heroes[0]!.stopped).toBe('uncleared')
    const out = running(idle())
    expect(createOffline(out, 10 * MINUTE, true).save.expedition?.seed).toBe(5)
  })

  it('stops when the packed supplies are not in the stash', () => {
    const result = runOffline(withHero(idle(), { packedSupplies: ['healing-draught'] }), 10 * MINUTE, true)
    expect(result.summary.heroes[0]!.stopped).toBe('supplies')
    expect(result.save.expedition).toBeNull()
  })
})

describe('the run limit', () => {
  it('stops after exactly the limit and behaves as before at 0', () => {
    const limited = runOffline(running(withHero(strongHero(), { repeatLimit: 3 })), 2 * 60 * MINUTE, true)
    expect(limited.summary.heroes[0]!.runs).toBe(3)
    expect(limited.summary.heroes[0]!.stopped).toBe('runLimit')
    expect(limited.save.expedition?.outcome).toBe('returned')
    const free = runOffline(running(withHero(strongHero(), { repeatLimit: 0 })), 2 * 60 * MINUTE, true)
    expect(free.summary.heroes[0]!.runs).toBeGreaterThan(3)
    expect(free.summary.heroes[0]!.stopped).toBeNull()
  })
})

describe('other heroes while away', () => {
  /** Hero-1 (selected) and hero-2, both level 40 Warriors. Each has the given away route. */
  function twoHeroes(first: string | null, second: string | null): SaveData {
    const made = createHero(strongHero(), { name: 'Brin', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
    const routes = [first, second]
    return {
      ...made.save,
      selectedHeroId: 'hero-1',
      heroes: made.save.heroes.map((entry, index) => ({
        ...entry,
        awayRouteId: routes[index] ?? null,
        clearedNodeIds: ['splintered-road'],
        progress: { ...entry.progress, level: 40, attributes },
      })),
    }
  }
  const sorted = (report: { discovered: string[] }) => ({ ...report, discovered: [...report.discovered].sort() })

  it('runs every hero that has an away route, the selected hero first', () => {
    const save = twoHeroes('splintered-road', 'splintered-road')
    const away = runOffline(save, 10 * MINUTE, true)
    expect(away.summary.heroes.map((entry) => entry.heroId)).toEqual(['hero-1', 'hero-2'])
    for (const entry of away.summary.heroes) expect(entry.fightsWon).toBeGreaterThan(0)
    expect(away.save.selectedHeroId).toBe('hero-1')
    expect(away.save.expedition).not.toBeNull()
    expect(away.save.heroes[1]!.awayRun).not.toBeNull()
    expect(away.save.heroes[0]!.awayRun).toBeNull()
    expect(away.save.heroes[1]!.awayRun!.seed).not.toBe(away.save.expedition!.seed)
    expect(parseSave(serializeSave(away.save)).ok).toBe(true)
  })

  it('lets a hero without an away route rest', () => {
    const away = runOffline(twoHeroes('splintered-road', null), 10 * MINUTE, true)
    expect(away.summary.heroes).toHaveLength(1)
    expect(away.save.heroes[1]!.awayRun).toBeNull()
  })

  it('gives the same result in one call or in uneven chunks', () => {
    const save = twoHeroes('splintered-road', 'splintered-road')
    const whole = runOffline(save, 12 * MINUTE, true)
    const state = createOffline(save, 12 * MINUTE, true)
    const chunks = [3, 900, 17, 4_000, 250]
    let at = 0
    while (!offlineDone(state)) {
      advanceOffline(state, chunks[at % chunks.length] ?? 1)
      at += 1
    }
    const chunked = finishOffline(state)
    expect(serializeSave(chunked.save)).toBe(serializeSave(whole.save))
    expect(sorted(chunked.summary)).toEqual(sorted(whole.summary))
  })

  it('does not change the save it is given', () => {
    const save = twoHeroes('splintered-road', 'splintered-road')
    const text = serializeSave(save)
    runOffline(save, 10 * MINUTE, true)
    expect(serializeSave(save)).toBe(text)
  })

  it('brings a background run onto the live screen when the hero is selected, and blocks deleting that hero', () => {
    const away = runOffline(twoHeroes(null, 'splintered-road'), 10 * MINUTE, true).save
    expect(away.expedition).toBeNull()
    const run = away.heroes[1]!.awayRun!
    expect(deleteHero(away, 'hero-2')).toMatchObject({ ok: false })
    const picked = ok(selectHero(away, 'hero-2'))
    expect(picked.selectedHeroId).toBe('hero-2')
    expect(picked.expedition).toEqual(run)
    expect(picked.heroes[1]!.awayRun).toBeNull()
    expect(parseSave(serializeSave(picked)).ok).toBe(true)
  })

  it('lets a defeat stop only the hero who fell', () => {
    let save = twoHeroes('splintered-road', 'splintered-road')
    save = withView(save, 'hero-2', (view) => {
      const begun = ok(beginExpedition(view, 'splintered-road', 9))
      const run = begun.expedition!
      run.retreatThresholds = []
      run.heroTemplate.attributes = { strength: 1, vitality: 1, agility: 1, intellect: 10, spirit: 1 }
      run.hero.maxHp = 20
      run.hero.hp = 1
      return begun
    })
    const away = runOffline(save, 30 * MINUTE, true)
    const [first, second] = away.summary.heroes
    expect(second!.defeated).toBe(true)
    expect(second!.stopped).toBe('defeat')
    expect(away.save.heroes[1]!.awayRun?.outcome).toBe('defeat')
    expect(first!.defeated).toBe(false)
    expect(first!.runs).toBeGreaterThan(0)
  })
})

describe('background heroes while the page is open', () => {
  function awayOnly(): SaveData {
    const made = createHero(strongHero(), { name: 'Brin', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
    return {
      ...made.save,
      selectedHeroId: 'hero-1',
      lastSeenAt: 1_000,
      heroes: made.save.heroes.map((entry, index) => ({
        ...entry,
        awayRouteId: index === 1 ? 'splintered-road' : null,
        clearedNodeIds: ['splintered-road'],
        progress: { ...entry.progress, level: 40, attributes },
      })),
    }
  }

  it('advances only the hero who is not selected, and gives the same result in any split', () => {
    const save = awayOnly()
    const whole = advanceBackground(save, [], 6_000)
    expect(whole.save.expedition).toBeNull()
    expect(whole.save.heroes[0]!.awayRun).toBeNull()
    expect(whole.save.heroes[1]!.awayRun!.history.length).toBeGreaterThan(0)
    let split = { save, lanes: [] as ReturnType<typeof advanceBackground>['lanes'] }
    for (let index = 0; index < 6; index += 1) split = advanceBackground(split.save, split.lanes, 1_000)
    expect(serializeSave(split.save)).toBe(serializeSave(whole.save))
  })

  it('does not change the save it is given', () => {
    const save = awayOnly()
    const text = serializeSave(save)
    advanceBackground(save, [], 3_000)
    expect(serializeSave(save)).toBe(text)
  })

  it('does not count time twice when a catch-up follows the ticks', () => {
    const save = awayOnly()
    const half = 15 * MINUTE
    const ticked = advanceBackground(save, [], half / STEP_MS)
    const later = runOffline(ticked.save, half, true)
    const direct = runOffline(save, 2 * half, true)
    expect(serializeSave(later.save)).toBe(serializeSave(direct.save))
  })

  it('stops running a hero who is selected, and keeps a parked run parked', () => {
    const save = awayOnly()
    const first = advanceBackground(withHero(save, { repeatRoute: false }), [], 60 * MINUTE / STEP_MS)
    expect(first.lanes[0]!.stopped).toBe('returned')
    const again = advanceBackground(first.save, first.lanes, 60 * MINUTE / STEP_MS)
    expect(serializeSave(again.save)).toBe(serializeSave(first.save))
    const selected = advanceBackground({ ...first.save, selectedHeroId: 'hero-2' }, first.lanes, 1_000)
    expect(selected.lanes).toEqual([])
  })
})
