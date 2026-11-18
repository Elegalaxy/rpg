import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { selectedHero } from '../../persist/character.ts'
import { newSave } from '../../persist/save.ts'
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
  MASTERED_TRAVEL_SPEEDUP,
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
    expect(savePreparationFromUi({ retreatPercent: '999', vow: '', curse: '', specialAmmo: '0', carryGold: '25', fightRank: '0', supplies: ['', '', '', ''], pushOnPercent: '50', repeatRoute: true, repeatLimit: 0, bagFullOrder: 'home', awayRouteId: '' })).toEqual([
      'Retreat threshold must be a whole percent from 5 to 90, or empty to never retreat.',
    ])
    expect(savePreparationFromUi({ retreatPercent: '', vow: '', curse: '', specialAmmo: '0', carryGold: '25', fightRank: '0', supplies: ['', '', '', ''], pushOnPercent: '50', repeatRoute: true, repeatLimit: 0, bagFullOrder: 'home', awayRouteId: '' })).toEqual([])
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
    expect(markup).toContain('Carrying')
    expect(markup).toContain('Loot bag')

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

  it('plays the walk at x8, and x16 on a mastered route', () => {
    expect(TRAVEL_SPEEDUP).toBe(8)
    expect(MASTERED_TRAVEL_SPEEDUP).toBe(16)
    const save = getSaveStatus().save
    commitSave({ ...save, expedition: null, heroes: save.heroes.map((hero) => ({ ...hero, routeReturns: { 'splintered-road': 10 } })) }, 'test reset', false)
    seeds([5])
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expect(expedition().phase).toBe('travel')
    expect(expeditionSpeed()).toBe(MASTERED_TRAVEL_SPEEDUP)
    commitSave({ ...getSaveStatus().save, expedition: null, heroes: getSaveStatus().save.heroes.map((hero) => ({ ...hero, routeReturns: {} })) }, 'test reset', false)
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
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Fights of this run')
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

  it('groups the preparation by who uses each setting', () => {
    commitSave(newSave(), 'test', false) // an earlier test leaves a run out
    expect(createHeroFromUi({ name: 'Bo', race: 'human', classId: 'warrior' })).toBeNull()
    const html = renderToStaticMarkup(<ExpeditionPanel />)
    const order = ['Every run', 'Pack for the road', 'Auto run', 'Orders', 'AFK'].map((legend) => html.indexOf(`>${legend}`))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    const box = (id: string) => html.slice(html.indexOf(`data-testid="${id}"`))
    // The three standing orders sit in their own group, the away route and repeat in the away group.
    expect(box('standing-orders-box').indexOf('aria-label="Bag full order"')).toBeGreaterThan(0)
    expect(box('standing-orders-box').indexOf('aria-label="Push on percent"')).toBeGreaterThan(0)
    expect(box('away-box').indexOf('aria-label="Away route"')).toBeGreaterThan(0)
    expect(html.indexOf('aria-label="Away route"')).toBeGreaterThan(html.indexOf('data-testid="away-box"'))
    expect(html.indexOf('aria-label="Bag full order"')).toBeLessThan(html.indexOf('data-testid="away-box"'))
    expect(html.indexOf('aria-label="Gold to carry"')).toBeLessThan(html.indexOf('>Orders'))
  })

  it('shows the hero slot count and why a third copy of a supply is refused with a backpack', () => {
    commitSave(newSave(), 'test', false)
    expect(createHeroFromUi({ name: 'Di', race: 'human', classId: 'warrior' })).toBeNull()
    const base = getSaveStatus().save
    const stash = { 'healing-draught': 5 }
    const plain = { ...base, heroes: base.heroes.map((hero) => ({ ...hero, purse: { ...hero.purse, supplies: stash }, packedSupplies: ['healing-draught', 'healing-draught', 'healing-draught'] })) }
    commitSave(plain, 'test', false)
    const four = renderToStaticMarkup(<ExpeditionPanel />)
    expect(four).toContain('of 4 slots')
    expect(four).not.toContain('At most 3 of each supply with a backpack.')
    commitSave({ ...plain, heroes: plain.heroes.map((hero) => ({ ...hero, pack: 'satchel' as const })) }, 'test', false)
    const five = renderToStaticMarkup(<ExpeditionPanel />)
    expect(five).toContain('of 5 slots (Satchel)')
    expect(five).toContain('At most 3 of each supply with a backpack.')
    expect(five).toMatch(/disabled=""[^>]*title="At most 3 of each supply with a backpack\."[^>]*>\+/)
  })

  it('says that Auto run governs going away, and that Auto run off waits at Push on', () => {
    commitSave(newSave(), 'test', false)
    expect(createHeroFromUi({ name: 'Cy', race: 'human', classId: 'warrior' })).toBeNull()
    const html = renderToStaticMarkup(<ExpeditionPanel />)
    expect(html).toContain('Leave now: finishes the fight, then waits at Push on.')
    expect(html).toContain('No run: nothing starts.')
    expect(html).toContain('Play the run for me, then rerun the route')
    expect(html).toContain('aria-label="Auto run"')
    expect(html).toContain('data-testid="away-plan"')
  })

  it('shows the cleric vow in the run bar and hides it for other classes', () => {
    commitSave(newSave(), 'test', false)
    expect(createHeroFromUi({ name: 'Vi', race: 'human', classId: 'cleric' })).toBeNull()
    const made = getSaveStatus().save
    commitSave({ ...made, heroes: made.heroes.map((hero) => ({ ...hero, vow: 'endurance' })) }, 'test', false)
    seeds([1])
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Vow: Endurance')
    commitSave(newSave(), 'test', false)
    expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
    seeds([1])
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expect(renderToStaticMarkup(<ExpeditionPanel />)).not.toContain('Vow:')
  })
})
