import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { selectedHero } from '../../persist/character.ts'
import { startExpedition } from '../../persist/expeditionSetup.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave, type SaveData, type SavedHero } from '../../persist/save.ts'
import { AwayReportView } from '../AwayPanel.tsx'
import { commitSave } from '../store.ts'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'
import { MapView } from './MapView.tsx'

function heroSave(patch: Partial<SavedHero> = {}): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, ...patch })) }
}

function finished(save: SaveData, outcome: 'returned' | 'defeat'): SaveData {
  const expedition = startExpedition(selectedHero(save)!, 'splintered-road', 1)
  expedition.outcome = outcome
  expedition.history = []
  return { ...save, expedition }
}

describe('first-clear display', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('the outcome card names the zones due on a safe return, and nothing on a defeat', () => {
    commitSave(finished(heroSave({ clearedNodeIds: ['splintered-road'] }), 'returned'), 'test', false)
    const html = renderToStaticMarkup(<ExpeditionPanel />)
    expect(html).toContain('data-testid="first-clear"')
    expect(html).toContain('Splintered Road +180 g · 15 scrap · 1 free upgrade')
    commitSave(finished(heroSave({ clearedNodeIds: ['splintered-road'] }), 'defeat'), 'test', false)
    expect(renderToStaticMarkup(<ExpeditionPanel />)).not.toContain('data-testid="first-clear"')
    commitSave(finished(heroSave({ clearedNodeIds: ['splintered-road'], firstClearIds: ['splintered-road'] }), 'returned'), 'test', false)
    expect(renderToStaticMarkup(<ExpeditionPanel />)).not.toContain('data-testid="first-clear"')
  })

  it('the route card shows the reward and whether it is claimed', () => {
    commitSave(heroSave(), 'test', false)
    const open = renderToStaticMarkup(<MapView />)
    expect(open).toContain('data-testid="route-first-clear"')
    expect(open).toContain('180 g · 15 scrap · 1 free upgrade')
    expect(open).toContain('Not claimed yet')
    commitSave(heroSave({ firstClearIds: ['splintered-road'] }), 'test', false)
    expect(renderToStaticMarkup(<MapView />)).toContain('Claimed')
  })

  it('the away report lists the zones paid', () => {
    const report = {
      awayMs: 1000,
      replayedMs: 1000,
      crafts: [],
      craftBaseIds: [],
      discovered: [],
      heroes: [
        {
          heroId: 'hero-1', heroName: 'Ash', routeId: 'splintered-road', runs: 1, fightsWon: 3, retreats: 0, defeated: false, xp: 5, levelsGained: 0,
          gold: 10, materials: {}, contractsFinished: 0, stopped: 'returned' as const, note: null, firstClears: ['Splintered Road'],
        },
      ],
    }
    expect(renderToStaticMarkup(<AwayReportView report={report} />)).toContain('First clear: Splintered Road.')
  })
})
