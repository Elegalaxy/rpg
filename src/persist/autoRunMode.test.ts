import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { stepExpedition } from '../sim/expedition.ts'

import { advanceOffline, awayBanner, createOffline, finishOffline, offlineDone, runOffline } from './offline.ts'
import { createHero } from './roster.ts'
import { newSave, parseSave, serializeSave, type SaveData } from './save.ts'
import { beginExpedition, decideHold, isEndlessAutoRun } from './world.ts'

// Auto run modes (Step 13.26, GAME_DESIGN §11 "Auto run modes").

const defs = gameDefs()
const MINUTE = 60_000

function strongSave(change: Record<string, unknown>): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  const save: SaveData = {
    ...made.save,
    heroes: made.save.heroes.map((entry) => ({ ...entry, progress: { ...entry.progress, level: 40, attributes }, repeatRoute: false, autoRun: true, ...change })),
  }
  const begun = beginExpedition(save, 'splintered-road', 5)
  if (!begun.ok) throw new Error(begun.reason)
  return begun.save
}

function atFirstHold(save: SaveData): SaveData {
  const run = save.expedition!
  while (!(run.encounterIndex > 0 && run.phase === 'travel' && run.travelMs === 0 && !run.returning)) stepExpedition(run, defs)
  return save
}

describe('decideHold with the Auto run mode', () => {
  const lowHp = { history: [{}, {}, {}], hero: { hp: 10, maxHp: 100 }, unsecured: [{ materialId: 'hide', quantity: 26 }], lootCapacity: 26 } as never
  const orders = { stopAfterFights: 2, pushOnHpPercent: 100, bagFullOrder: 'home' as const }

  it('repeat (and an absent mode) keeps every standing order', () => {
    expect(decideHold(lowHp, { ...orders, autoRun: true })).toBe('fights')
    expect(decideHold(lowHp, { ...orders, autoRun: true, autoRunMode: 'repeat' })).toBe('fights')
    expect(decideHold(lowHp, { ...orders, stopAfterFights: null, autoRun: true, autoRunMode: 'repeat' })).toBe('hp')
  })

  it('endless pushes on past the fight order, the HP floor and a full bag', () => {
    expect(decideHold(lowHp, { ...orders, autoRun: true, autoRunMode: 'endless' })).toBe('push')
    expect(decideHold(lowHp, { ...orders, bagFullOrder: 'ask', autoRun: true, autoRunMode: 'endless' })).toBe('push')
  })

  it('endless only counts while Auto run is on', () => {
    expect(isEndlessAutoRun({ autoRun: false, autoRunMode: 'endless' })).toBe(false)
    expect(isEndlessAutoRun({ autoRunMode: 'endless' })).toBe(false)
    expect(decideHold(lowHp, { ...orders, autoRun: false, autoRunMode: 'endless' })).toBe('fights')
  })
})

describe('the save', () => {
  it('loads a save without the mode, keeps it, and refuses a bad value', () => {
    const save = strongSave({})
    expect(parseSave(serializeSave(save)).ok).toBe(true)
    const endless = parseSave(serializeSave({ ...save, heroes: save.heroes.map((entry) => ({ ...entry, autoRunMode: 'endless' as const })) }))
    expect(endless.ok && endless.data.heroes[0]?.autoRunMode).toBe('endless')
    expect(parseSave(JSON.stringify({ ...save, heroes: save.heroes.map((entry) => ({ ...entry, autoRunMode: 'loop' })) })).ok).toBe(false)
  })
})

describe('away replay in the endless mode', () => {
  const settings = { pushOnHpPercent: 100, stopAfterFights: 1 }

  it('repeat walks home after every fight, endless does not, and the report says so', () => {
    const repeat = runOffline(atFirstHold(strongSave(settings)), 20 * MINUTE, true).summary.heroes[0]!
    expect(repeat.walkedHomeFights).toBeGreaterThan(0)
    const endless = runOffline(atFirstHold(strongSave({ ...settings, autoRunMode: 'endless', autoRunMaxFights: 12 })), 20 * MINUTE, true)
    const hero = endless.summary.heroes[0]!
    expect(hero.walkedHomeFights ?? 0).toBe(0)
    expect(hero.walkedHomeHp ?? 0).toBe(0)
    expect(hero.pushedOn).toBeGreaterThan(5)
    expect(hero.stopped).toBe('autoLimit')
    expect(endless.save.heroes[0]!.autoRun).toBe(false)
    expect(awayBanner(hero)).toMatch(/^Endless Auto run kept going while Ash was away: \d+ fights, 0 retreats \(\d+ runs?\)\. Stopped: the total fight limit/)
  })

  it('counts a retreat that ends an endless run, then reruns the route', () => {
    const save = atFirstHold(strongSave({ autoRunMode: 'endless', pushOnHpPercent: 100 }))
    const run = save.expedition!
    run.retreatThresholds = [{ kind: 'hpFraction', atMost: 0.5 }]
    run.hero.hp = Math.floor(run.hero.maxHp * 0.3)
    const away = runOffline(save, 10 * MINUTE, true).summary.heroes[0]!
    expect(away.endlessRetreats).toBeGreaterThanOrEqual(1)
    expect(away.runs).toBe(away.endlessRetreats)
    expect(away.stopped).toBeNull()
    expect(away.autoFights).toBeGreaterThan(3)
  })

  it('says an endless run ended by a defeat', () => {
    const save = strongSave({ autoRunMode: 'endless' })
    const run = save.expedition!
    run.retreatThresholds = []
    run.heroTemplate.attributes = { strength: 1, vitality: 1, agility: 1, intellect: 1, spirit: 1 }
    run.hero.maxHp = 20
    run.hero.hp = 1
    const away = runOffline(save, 60 * MINUTE, true)
    expect(away.summary.heroes[0]!.stopped).toBe('defeat')
    expect(away.save.heroes[0]!.autoRun).toBe(false)
    expect(awayBanner(away.summary.heroes[0]!)).toContain('Stopped: the hero was defeated before any retreat condition ended the run.')
  })

  it('gives the same result in one call or in uneven chunks', () => {
    const save = atFirstHold(strongSave({ ...settings, autoRunMode: 'endless', autoRunMaxFights: 9 }))
    const whole = runOffline(save, 20 * MINUTE, true)
    const state = createOffline(save, 20 * MINUTE, true)
    let at = 0
    const chunks = [5, 600, 31, 4_000]
    while (!offlineDone(state)) {
      advanceOffline(state, chunks[at % chunks.length] ?? 1)
      at += 1
    }
    const chunked = finishOffline(state)
    expect(serializeSave(chunked.save)).toBe(serializeSave(whole.save))
    expect(chunked.summary).toEqual(whole.summary)
  })
})
