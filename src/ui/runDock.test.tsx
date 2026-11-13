import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { selectedHero } from '../persist/character.ts'
import { MASTERY_RETURNS } from '../persist/world.ts'
import { RunDockView } from './RunDock.tsx'
import { DOCK_KEY, dockVisible, readCollapsed, writeCollapsed } from './runDockState.ts'
import { commitSave, createHeroFromUi, getSaveStatus, setRepeatRouteFromUi, startExpeditionFromUi } from './store.ts'

function stubStorage(): Map<string, string> {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  })
  return values
}

function running() {
  const expedition = getSaveStatus().save.expedition
  if (expedition === null) throw new Error('no expedition')
  return expedition
}

function render(collapsed: boolean): string {
  const { save } = getSaveStatus()
  return renderToStaticMarkup(
    <RunDockView expedition={running()} hero={selectedHero(save)} waiting={false} collapsed={collapsed} onToggle={() => undefined} onOpenMap={() => undefined} />,
  )
}

describe('the run dock', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows only with a live run and never on the map', () => {
    stubStorage()
    expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
    expect(dockVisible(getSaveStatus().save, 'town')).toBe(false)
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    const { save } = getSaveStatus()
    expect(dockVisible(save, 'town')).toBe(true)
    expect(dockVisible(save, 'heroes')).toBe(true)
    expect(dockVisible(save, 'map')).toBe(false)
    expect(dockVisible({ ...save, expedition: { ...running(), outcome: 'returned' } }, 'town')).toBe(false)
  })

  it('renders a folded and an unfolded dock with the same top row', () => {
    const folded = render(true)
    expect(folded).toContain('aria-expanded="false"')
    expect(folded).toContain('Push on')
    expect(folded).toContain('data-testid="dock-hp"')
    expect(folded).not.toContain('dock-loot')
    const open = render(false)
    expect(open).toContain('aria-expanded="true"')
    expect(open).toContain('Splintered Road')
    expect(open).toContain('dock-loot')
    expect(open).toContain('Escape now')
    expect(open).toContain('Open map')
  })

  it('remembers the fold, folded by default, and survives blocked storage', () => {
    const values = stubStorage()
    expect(readCollapsed()).toBe(true)
    writeCollapsed(false)
    expect(values.get(DOCK_KEY)).toBe('0')
    expect(readCollapsed()).toBe(false)
    writeCollapsed(true)
    expect(readCollapsed()).toBe(true)
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readCollapsed()).toBe(true)
    expect(() => writeCollapsed(false)).not.toThrow()
  })

  it('allows the repeat toggle only on a mastered route', () => {
    stubStorage()
    const hero = selectedHero(getSaveStatus().save)
    if (hero === null) throw new Error('no hero')
    const before = hero.repeatRoute
    const locked = render(false)
    expect(locked).toMatch(/data-testid="dock-repeat"[^>]*disabled/)
    expect(locked).toContain(`0/${MASTERY_RETURNS} safe returns`)
    expect(setRepeatRouteFromUi(!before)).toMatch(/mastered route/)
    expect(selectedHero(getSaveStatus().save)?.repeatRoute).toBe(before)

    const { save } = getSaveStatus()
    commitSave(
      { ...save, heroes: save.heroes.map((entry) => ({ ...entry, routeReturns: { ...entry.routeReturns, [running().id]: MASTERY_RETURNS } })) },
      'test mastery',
    )
    expect(render(false)).not.toMatch(/data-testid="dock-repeat"[^>]*disabled/)
    expect(setRepeatRouteFromUi(!before)).toBeNull()
    expect(selectedHero(getSaveStatus().save)?.repeatRoute).toBe(!before)
    expect(running().outcome).toBe('ongoing')
  })
})
