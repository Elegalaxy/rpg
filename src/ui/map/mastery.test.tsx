import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHero } from '../../persist/roster.ts'
import { newSave, type SaveData } from '../../persist/save.ts'
import { commitSave, getSnapshot, masteredSpeedAllowed, setSpeed, startExpeditionFromUi } from '../store.ts'

import { MapView } from './MapView.tsx'

function heroWithReturns(returns: number): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, routeReturns: { 'splintered-road': returns } })) }
}

describe('mastered routes', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows Mastery n/10 on the route and keeps 8x locked until the tenth safe return', () => {
    commitSave(heroWithReturns(3), 'test', false)
    expect(renderToStaticMarkup(<MapView />)).toContain('3/10')
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    expect(masteredSpeedAllowed()).toBe(false)
    setSpeed(8)
    expect(getSnapshot().speed).not.toBe(8)

    commitSave({ ...heroWithReturns(10), expedition: null }, 'test', false)
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('10/10')
    expect(html).toContain('8× speed unlocked')
    expect(masteredSpeedAllowed()).toBe(true)
    setSpeed(8)
    expect(getSnapshot().speed).toBe(8)
    setSpeed(1)
  })
})
