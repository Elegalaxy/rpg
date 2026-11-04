import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { STEP_MS } from '../sim/constants.ts'
import { stepExpedition } from '../sim/expedition.ts'

import { CRAFT_MS, queueCraft } from './crafting.ts'
import {
  OFFLINE_CAP_MS,
  OFFLINE_MIN_MS,
  advanceOffline,
  createOffline,
  finishOffline,
  offlineDone,
  replayMs,
  runOffline,
} from './offline.ts'
import { createHero } from './roster.ts'
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

  it('matches stepping the same time live, before the first hold', () => {
    const save = running()
    const live = structuredClone(save)
    const steps = 2_500
    for (let step = 0; step < steps; step += 1) stepExpedition(live.expedition!, defs)
    const away = runOffline(save, steps * STEP_MS, true)
    expect(away.save.expedition).toEqual(live.expedition)
  })

  it('runs the cleared route again and again while the orders say repeat', () => {
    const away = runOffline(running(), 40 * MINUTE, true)
    expect(away.summary.runs).toBeGreaterThan(1)
    expect(away.summary.fightsWon).toBeGreaterThan(away.summary.runs)
    expect(away.summary.defeated).toBe(false)
    expect(away.summary.xp).toBeGreaterThan(0)
    expect(away.summary.gold + Object.values(away.summary.materials).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0)
    expect(away.save.heroes[0]!.clearedNodeIds).toContain('splintered-road')
  })

  it('stops after the first safe return when repeat is off, leaving the run to close on the Map', () => {
    const away = runOffline(running(withHero(strongHero(), { repeatRoute: false })), 40 * MINUTE, true)
    expect(away.summary.stopped).toBe('returned')
    expect(away.summary.runs).toBe(1)
    expect(away.save.expedition?.outcome).toBe('returned')
  })

  it('does not repeat a route the hero has not cleared, or without the packed supplies', () => {
    const cautious = runOffline(running(withHero(strongHero(), { pushOnHpPercent: 100 })), 40 * MINUTE, true)
    expect(cautious.summary.stopped).toBe('uncleared')
    expect(cautious.summary.runs).toBe(1)
    expect(cautious.save.heroes[0]!.clearedNodeIds).not.toContain('splintered-road')
    expect(cautious.save.expedition).toBeNull()

    const noStash = withHero(strongHero(), { packedSupplies: ['healing-draught'] })
    const away = runOffline(running(noStash), 40 * MINUTE, true)
    expect(away.summary.stopped).toBe('supplies')
    expect(away.summary.runs).toBe(1)
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

  it('stops running after a defeat and leaves the outcome for the player', () => {
    const save = running(withHero(strongHero(), { repeatRoute: true }))
    const run = save.expedition!
    run.retreatThresholds = []
    run.heroTemplate.attributes = { strength: 1, vitality: 1, agility: 1, intellect: 1, spirit: 1 }
    run.hero.maxHp = 20
    run.hero.hp = 1
    const away = runOffline(save, 60 * MINUTE, true)
    expect(away.summary.defeated).toBe(true)
    expect(away.summary.stopped).toBe('defeat')
    expect(away.save.expedition?.outcome).toBe('defeat')
  })
})
