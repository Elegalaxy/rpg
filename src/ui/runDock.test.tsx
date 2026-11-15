import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { selectedHero } from '../persist/character.ts'
import { MASTERY_RETURNS } from '../persist/world.ts'
import { gameDefs, setupForScenario, WARRIOR_VS_STANDARD_ID } from '../content/scenarios.ts'
import { createCombat } from '../sim/combat.ts'
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

  it('shows the fight number, its name and the enemies, with room kept between fights', () => {
    stubStorage()
    createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })
    startExpeditionFromUi('splintered-road')
    const { save } = getSaveStatus()
    const hero = selectedHero(save)
    const combat = createCombat(setupForScenario(WARRIOR_VS_STANDARD_ID), gameDefs(), 1)
    const base = running()
    const html = (expedition: typeof base) =>
      renderToStaticMarkup(
        <RunDockView expedition={expedition} hero={hero === null ? null : { ...hero, stopAfterFights: 5 }} waiting={false} collapsed={false} onToggle={() => undefined} onOpenMap={() => undefined} />,
      )
    const fighting = html({ ...base, combat, history: [{ index: 0, encounterId: 'old-one', seed: 1, outcome: 'victory', durationMs: 1000 }] })
    expect(fighting).toContain('Fight now')
    expect(fighting).toContain('#2 / 5')
    expect(fighting).toContain(combat.enemies[0]?.name ?? 'missing')
    const between = html({ ...base, combat: null, history: [{ index: 0, encounterId: 'old-one', seed: 1, outcome: 'retreat', durationMs: 1000 }] })
    expect(between).toContain('Last fight')
    expect(between).toContain('#1 / 5')
    expect(between).toContain('old one (escaped)')
    expect(between).toContain('data-testid="dock-foes"')
    expect(html({ ...base, combat: null, history: [] })).toContain('None yet')
  })

  describe('the rule stack chip and picker', () => {
    function withStacks(inCombat: boolean, stacked: boolean): string[] {
      stubStorage()
      createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })
      startExpeditionFromUi('splintered-road')
      const { save } = getSaveStatus()
      const hero = selectedHero(save)
      if (hero === null) throw new Error('no hero')
      const defs = gameDefs()
      const combat = createCombat(setupForScenario(WARRIOR_VS_STANDARD_ID), defs, 1)
      const skill = combat.hero.equippedSkillIds[0]
      if (skill === undefined) throw new Error('no skill')
      if (stacked) combat.hero.ruleStacks = [{ id: 'solo', name: 'Solo', when: [], rows: [{ skillId: skill }] }]
      combat.hero.stackState = { activeId: 'default', sinceMs: null, manualId: null }
      const savedHero = { ...hero, ruleStacks: stacked ? [{ id: 'solo', name: 'Solo', when: [], rows: [{ skillId: skill }] }] : [] }
      const expedition = { ...running(), combat: inCombat ? combat : null }
      const html = (collapsed: boolean) =>
        renderToStaticMarkup(
          <RunDockView expedition={expedition} hero={savedHero} waiting={false} collapsed={collapsed} onToggle={() => undefined} onOpenMap={() => undefined} />,
        )
      return [html(true), html(false)]
    }

    it('shows the active stack as a chip when folded, only in a fight and only with stacks', () => {
      const [folded] = withStacks(true, true)
      expect(folded).toContain('data-testid="dock-stack"')
      expect(folded).toContain('Stack: Default')
      expect(folded).not.toContain('rs-picker')
    })

    it('keeps an empty reserved slot between fights and draws nothing without stacks', () => {
      const [between] = withStacks(false, true)
      expect(between).toContain('data-testid="dock-stack-slot"')
      expect(between).not.toContain('data-testid="dock-stack"')
      const [none, noneOpen] = withStacks(true, false)
      expect(none).not.toContain('run-dock-stack')
      expect(noneOpen).not.toContain('rs-picker')
    })

    it('unfolds into the picker with Auto and every stack', () => {
      const [, open] = withStacks(true, true)
      expect(open).toContain('data-testid="stack-picker"')
      expect([...open.matchAll(/class="rs-pick"[^>]*>([^<]*)</g)].map((match) => match[1])).toEqual(['Auto', 'Default', 'Solo'])
    })
  })
})
