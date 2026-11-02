import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { selectedHero } from '../../persist/character.ts'
import {
  advanceExpedition,
  commitSave,
  createHeroFromUi,
  expeditionSpeed,
  expeditionWaiting,
  getFinishedFights,
  getSaveStatus,
  pushOnFromUi,
  returnFromUi,
  savePreparationFromUi,
  settleAndRepeatFromUi,
  settleExpeditionFromUi,
  startExpeditionFromUi,
  TRAVEL_SPEEDUP,
} from '../store.ts'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'

function seeds(values: number[]): void {
  let index = 0
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
    array[0] = values[index % values.length] ?? 1
    index += 1
    return array
  }) as never)
}

function advanceUntil(done: () => boolean, limit = 400_000): void {
  let steps = 0
  while (!done() && steps < limit) {
    advanceExpedition(50)
    steps += 50
  }
}

function expedition() {
  const running = getSaveStatus().save.expedition
  if (running === null) throw new Error('no expedition')
  return running
}

describe('the expedition panel', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('prepares, runs, waits between fights, pushes on, returns, and settles', () => {
    expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Preparation')
    expect(savePreparationFromUi({ retreatPercent: '999', vow: '', curse: '', specialAmmo: '0', carryGold: '25', fightRank: '0' })).toEqual([
      'Retreat threshold must be a whole percent from 5 to 90, or empty to never retreat.',
    ])
    expect(savePreparationFromUi({ retreatPercent: '', vow: '', curse: '', specialAmmo: '0', carryGold: '25', fightRank: '0' })).toEqual([])
    expect(selectedHero(getSaveStatus().save)?.retreatAtMost).toBeNull()

    // A level 1 hero often loses its first fight, so try seeds until one wins and reaches the wait.
    let waited = false
    for (let seed = 1; seed < 60 && !waited; seed += 1) {
      seeds([seed])
      expect(startExpeditionFromUi('splintered-road')).toBeNull()
      advanceUntil(() => expeditionWaiting() || expedition().outcome !== 'ongoing')
      if (expeditionWaiting()) {
        waited = true
        break
      }
      settleExpeditionFromUi()
    }
    expect(waited).toBe(true)

    const held = expedition()
    expect(held.history.length).toBeGreaterThan(0)
    expect(held.travelMs).toBe(0)
    expect(held.phase).toBe('travel')
    const markup = renderToStaticMarkup(<ExpeditionPanel />)
    expect(markup).toContain('Push on')
    expect(markup).toContain('Return to town')
    expect(markup).toContain('Momentum')
    expect(markup).toContain('Unsecured loot')

    advanceExpedition(500)
    expect(expedition().travelMs).toBe(0)
    expect(expeditionWaiting()).toBe(true)

    pushOnFromUi()
    expect(expeditionWaiting()).toBe(false)
    advanceExpedition(100)
    expect(expedition().travelMs).toBeGreaterThan(0)
    expect(expeditionWaiting()).toBe(false)

    advanceUntil(() => expeditionWaiting() || expedition().outcome !== 'ongoing')
    if (expeditionWaiting()) {
      expect(returnFromUi()).toBeNull()
      expect(expedition().returning).toBe(true)
      expect(returnFromUi()).toMatch(/between fights|already returning/)
      advanceUntil(() => expedition().outcome !== 'ongoing')
    }
    expect(expedition().outcome).not.toBe('ongoing')
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Return to town')
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Fights won')
    settleExpeditionFromUi()
    expect(getSaveStatus().save.expedition).toBeNull()
  }, 240_000)

  it('refuses to start a second run and a return with no run', () => {
    expect(returnFromUi()).toBe('No expedition is running.')
    commitSave(getSaveStatus().save, 'noop')
    seeds([3])
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expect(startExpeditionFromUi('splintered-road')).toBe('An expedition is already running.')
    expect(returnFromUi()).toBeNull()
    expect(expedition().returning).toBe(true)
    expect(returnFromUi()).toBe('already returning to town')
  })

  it('plays the walk faster than a fight', () => {
    commitSave({ ...getSaveStatus().save, expedition: null }, 'test reset')
    seeds([5])
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expect(expedition().phase).toBe('travel')
    expect(expeditionSpeed()).toBe(TRAVEL_SPEEDUP)
    advanceUntil(() => expedition().combat !== null)
    expect(expeditionSpeed()).toBe(1)
  })

  it('keeps each finished fight with its log after the fight panel closes', () => {
    commitSave({ ...getSaveStatus().save, expedition: null }, 'test reset')
    seeds([5])
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expect(getFinishedFights()).toEqual([])
    advanceUntil(() => expedition().history.length >= 1)
    const kept = getFinishedFights()
    expect(kept).toHaveLength(1)
    expect(kept[0]?.fight).toBe(1)
    expect(kept[0]?.combat.log.length).toBeGreaterThan(0)
    expect(kept[0]?.combat.outcome).not.toBe('ongoing')
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Past fights')
  })

  it('settles a finished run and starts the same route again', () => {
    commitSave({ ...getSaveStatus().save, expedition: null }, 'test reset')
    seeds([7])
    expect(startExpeditionFromUi('withered-grove')).not.toBeNull()
    seeds([7])
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expedition().outcome = 'returned'
    seeds([8])
    expect(settleAndRepeatFromUi()).toBeNull()
    expect(expedition().id).toBe('splintered-road')
    expect(expedition().outcome).toBe('ongoing')
    expect(expedition().history).toHaveLength(0)
  })
})
