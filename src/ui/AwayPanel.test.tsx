import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { HeroAwaySummary } from '../persist/offline.ts'

import { AwayReportView } from './AwayPanel.tsx'

const hero: HeroAwaySummary = {
  heroId: 'hero-1',
  heroName: 'Ash',
  routeId: 'splintered-road',
  runs: 2,
  fightsWon: 5,
  retreats: 0,
  defeated: false,
  xp: 10,
  levelsGained: 0,
  gold: 3,
  materials: {},
  contractsFinished: 0,
  stopped: null,
  note: null,
}

function html(...heroes: HeroAwaySummary[]): string {
  return renderToStaticMarkup(
    <AwayReportView report={{ awayMs: 600_000, replayedMs: 600_000, crafts: [], craftBaseIds: [], discovered: [], heroes }} />,
  )
}

describe('the away banner (Step 13.15)', () => {
  it('says Auto run kept going, with fights and runs', () => {
    const out = html({ ...hero, autoRan: true, autoFights: 9 })
    expect(out).toContain('data-testid="away-banner-hero-1"')
    expect(out).toContain('Auto run kept going while Ash was away: 9 fights, 2 runs.')
  })

  it('says why Auto run stopped, once', () => {
    const out = html({ ...hero, autoRan: true, autoFights: 4, runs: 1, stopped: 'blocked', note: 'Warhelm is at 0 durability. Repair it.' })
    expect(out).toContain('Stopped: Warhelm is at 0 durability. Repair it.')
    expect(out.split('Warhelm is at 0 durability').length - 1).toBe(1)
  })

  it('says the run paused at Push on when Auto run is off', () => {
    const out = html({ ...hero, runs: 0, fightsWon: 1, stopped: 'held' })
    expect(out).toContain('Paused at Push on while Ash was away (Auto run is off).')
    expect(out).toContain('Paused at Push on</span>')
  })

  it('says an away route started', () => {
    expect(html({ ...hero, awayStarted: true })).toContain('Away route started: Splintered Road.')
  })

  it('has no banner when nothing worth a line happened', () => {
    expect(html(hero)).not.toContain('away-banners')
  })
})
