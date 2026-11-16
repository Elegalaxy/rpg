import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { routes } from '../../content/world.ts'
import { selectedHero } from '../../persist/character.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave, parseSave, serializeSave, type SavedHero } from '../../persist/save.ts'
import { advanceExpedition, commitSave, expeditionWaiting, getSaveStatus, pushOnFromUi, setAutoRunFromUi, startExpeditionFromUi } from '../store.ts'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'

/** Start a Road run for a level 40 Warrior (wins every fight) with the given hero settings. */
function startRun(patch: Partial<SavedHero>) {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  const cleared = [...(routes['splintered-road']?.nodeIds ?? [])]
  const heroes = made.save.heroes.map((hero) => ({ ...hero, clearedNodeIds: cleared, progress: { ...hero.progress, level: 40, attributes }, ...patch }))
  commitSave({ ...made.save, heroes }, 'test', false)
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
    array[0] = 5
    return array
  }) as never)
  setAutoRunFromUi(patch.autoRun === true) // restarts the session count
  expect(startExpeditionFromUi('splintered-road')).toBeNull()
  const run = getSaveStatus().save.expedition
  if (run === null) throw new Error('no run')
  return run
}

function play(done: () => boolean): void {
  for (let steps = 0; steps < 400_000 && !done(); steps += 50) advanceExpedition(50)
}

const hero = () => selectedHero(getSaveStatus().save)

describe('Auto run in a live run', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('is off by default: the run waits for the player at the hold', () => {
    const run = startRun({ repeatRoute: false })
    expect(hero()?.autoRun).not.toBe(true)
    play(() => expeditionWaiting() || run.outcome !== 'ongoing')
    expect(expeditionWaiting()).toBe(true)
    const fights = run.history.length
    play(() => false)
    expect(run.history).toHaveLength(fights)
  }, 120_000)

  it('pushes on by itself while HP is high, and shows the run bar state', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1 })
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Auto run on')
    play(() => run.history.length >= 2 || run.outcome !== 'ongoing')
    expect(run.history.length).toBeGreaterThanOrEqual(2)
    expect(expeditionWaiting() && run.history.length < 2).toBe(false)
  }, 120_000)

  it('walks home when HP is below the push-on floor', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 100 })
    play(() => run.outcome !== 'ongoing')
    expect(run.outcome).toBe('returned')
    expect(run.history).toHaveLength(1)
    expect(hero()?.autoRun).toBe(true)
  }, 120_000)

  it('respects the per-run stop after fights', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1, stopAfterFights: 2 })
    play(() => run.outcome !== 'ongoing')
    expect(run.history).toHaveLength(2)
    expect(run.outcome).toBe('returned')
  }, 120_000)

  it('stops at the session limit, switches itself off and starts no repeat', () => {
    const run = startRun({ autoRun: true, repeatRoute: true, pushOnHpPercent: 1, autoRunMaxFights: 2 })
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Auto run: fight 0 / 2')
    play(() => run.outcome !== 'ongoing')
    expect(run.history).toHaveLength(2)
    expect(hero()?.autoRun).toBe(false)
    expect(getSaveStatus().save.expedition).toBe(run)
  }, 120_000)

  it('repeats a cleared route on its own and counts fights across runs', () => {
    const first = startRun({ autoRun: true, repeatRoute: true, pushOnHpPercent: 1, stopAfterFights: 1, autoRunMaxFights: 3 })
    play(() => getSaveStatus().save.expedition !== first)
    const second = getSaveStatus().save.expedition
    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    expect(second?.history).toHaveLength(0)
    expect(hero()?.autoRun).toBe(true)
    // Three fights in all: two more runs of one fight, then it stops.
    const runs = new Set([first, second])
    play(() => {
      const now = getSaveStatus().save.expedition
      if (now !== null) runs.add(now)
      return hero()?.autoRun === false
    })
    expect(hero()?.autoRun).toBe(false)
    expect(runs.size).toBe(3)
    expect(getSaveStatus().save.expedition?.history).toHaveLength(1)
  }, 240_000)

  it('can be switched off mid-run to take manual control, and Push on still works', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1 })
    setAutoRunFromUi(false)
    expect(hero()?.autoRun).toBe(false)
    play(() => expeditionWaiting() || run.outcome !== 'ongoing')
    expect(expeditionWaiting()).toBe(true)
    pushOnFromUi()
    expect(expeditionWaiting()).toBe(false)
  }, 120_000)
})

describe('Auto run in the save', () => {
  it('survives a save and reload', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const heroes = made.save.heroes.map((entry) => ({ ...entry, autoRun: true, autoRunMaxFights: 100 }))
    const parsed = parseSave(serializeSave({ ...made.save, heroes }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.heroes[0]).toMatchObject({ autoRun: true, autoRunMaxFights: 100 })
  })

  it('loads a save without the fields and refuses bad values', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    expect(parseSave(serializeSave(made.save)).ok).toBe(true)
    for (const bad of [{ autoRunMaxFights: 0 }, { autoRunMaxFights: 10000 }, { autoRunMaxFights: 1.5 }, { autoRun: 'yes' }]) {
      const heroes = made.save.heroes.map((entry) => ({ ...entry, ...bad }))
      expect(parseSave(JSON.stringify({ ...made.save, heroes })).ok).toBe(false)
    }
  })
})

describe('the shared hold decision', () => {
  it('gives the same verdict order live and away: fights, HP, bag, then push', async () => {
    const { decideHold } = await import('../../persist/world.ts')
    const run = { history: [{}, {}], hero: { hp: 50, maxHp: 100 }, unsecured: [], lootCapacity: 26 } as never
    const orders = { stopAfterFights: null, pushOnHpPercent: 50, bagFullOrder: 'home' as const }
    expect(decideHold(run, orders)).toBe('push')
    expect(decideHold(run, { ...orders, pushOnHpPercent: 51 })).toBe('hp')
    expect(decideHold(run, { ...orders, stopAfterFights: 2, pushOnHpPercent: 51 })).toBe('fights')
  })
})
