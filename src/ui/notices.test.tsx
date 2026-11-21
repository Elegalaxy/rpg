import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { selectedHero } from '../persist/character.ts'
import { startExpedition } from '../persist/expeditionSetup.ts'
import { createHero } from '../persist/roster.ts'
import { newSave, type SaveData, type SavedHero } from '../persist/save.ts'
import { Notices } from './Notices.tsx'
import { CARD_LEAVE_MS, MAX_TOASTS, TOAST_LEAVE_MS, TOAST_MS, dismissCard, getNotices, reportMoments, resetNotices } from './notices.ts'
import { commitSave, settleExpeditionFromUi } from './store.ts'

function heroSave(patch: (hero: SavedHero) => Partial<SavedHero> = () => ({})): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, ...patch(hero) })) }
}

describe('pop-up notices', () => {
  beforeEach(() => {
    resetNotices()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    commitSave(newSave(), 'test', false)
  })

  it('collects big moments on one card in order, and closes it', () => {
    reportMoments([{ kind: 'discovery', text: 'Withered Grove' }], 'hand')
    reportMoments([{ kind: 'level', level: 3, points: 2 }], 'hand')
    expect(getNotices().card.map((moment) => moment.kind)).toEqual(['level', 'discovery'])
    commitSave(heroSave(), 'test', false)
    const html = renderToStaticMarkup(<Notices onGo={() => undefined} />)
    console.log('[ui]', 'notice card', { html })
    expect(html).toContain('data-testid="notice-card"')
    expect(html).toContain('News from the road')
    expect(html).toContain('Level 3. 2 points to spend.')
    expect(html).toContain('Spend points')
    expect(html).toContain('Open the map')
    dismissCard()
    expect(getNotices().cardLeaving).toBe(true)
    expect(getNotices().card).toHaveLength(2)
    vi.advanceTimersByTime(CARD_LEAVE_MS)
    expect(getNotices().card).toEqual([])
  })

  it('turns every moment into a toast under Auto run, keeps three, and lets each fade', () => {
    reportMoments(
      [
        { kind: 'level', level: 3, points: 0 },
        { kind: 'contract', text: 'Bounty: Deserters' },
        { kind: 'discovery', text: 'Withered Grove' },
        { kind: 'firstClear', text: 'Withered Grove: 300 g' },
      ],
      'auto',
    )
    const { card, toasts } = getNotices()
    expect(card).toEqual([])
    expect(toasts).toHaveLength(MAX_TOASTS)
    expect(toasts[0]?.text).toBe('Contract complete: Bounty: Deserters. Collect it at the Contract Board.')
    vi.advanceTimersByTime(TOAST_MS)
    expect(getNotices().toasts.map((toast) => toast.leaving)).toEqual([true, true, true])
    vi.advanceTimersByTime(TOAST_LEAVE_MS)
    expect(getNotices().toasts).toEqual([])
  })

  it('a settle by hand pops up the level up but not the first clear the outcome card already shows', () => {
    const save = heroSave(() => ({ clearedNodeIds: ['splintered-road'] }))
    const expedition = startExpedition(selectedHero(save)!, 'splintered-road', 1)
    expedition.outcome = 'returned'
    expedition.history = []
    expedition.xpEarned = 100_000
    commitSave({ ...save, expedition }, 'test', false)
    settleExpeditionFromUi()
    const kinds = getNotices().card.map((moment) => moment.kind)
    console.log('[ui]', 'hand settle moments', { kinds })
    expect(kinds).toEqual(['level'])
  })
})
