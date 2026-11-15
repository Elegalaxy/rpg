import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { advanceExpedition, commitSave, expeditionWaiting, getSaveStatus, startExpeditionFromUi } from '../store.ts'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'

/** A level 40 Warrior who wins every Road fight, with the given fight limit. */
function strongRun(stopAfterFights: number | null) {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  const heroes = made.save.heroes.map((hero) => ({ ...hero, stopAfterFights, progress: { ...hero.progress, level: 40, attributes } }))
  commitSave({ ...made.save, heroes }, 'test', false)
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
    array[0] = 5
    return array
  }) as never)
  expect(startExpeditionFromUi('splintered-road')).toBeNull()
  const run = getSaveStatus().save.expedition
  if (run === null) throw new Error('no run')
  return run
}

function play(done: () => boolean): void {
  for (let steps = 0; steps < 400_000 && !done(); steps += 50) advanceExpedition(50)
}

describe('stop after N fights in a live run', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('walks home on its own after the limit and shows the progress in the run bar', () => {
    const run = strongRun(1)
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Fight 1 / 1')
    play(() => run.returning || run.outcome !== 'ongoing')
    expect(run.history).toHaveLength(1)
    expect(run.returning).toBe(true)
    expect(expeditionWaiting()).toBe(false)
    play(() => run.outcome !== 'ongoing')
    expect(run.outcome).toBe('returned')
  }, 120_000)

  it('still waits for the player at the hold when no limit is set', () => {
    const run = strongRun(null)
    expect(renderToStaticMarkup(<ExpeditionPanel />)).not.toContain('data-testid="fight-limit"')
    play(() => expeditionWaiting() || run.outcome !== 'ongoing')
    expect(expeditionWaiting()).toBe(true)
    expect(run.returning).toBe(false)
  }, 120_000)
})
