import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { commitSave } from '../store.ts'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'
import { MapView } from './MapView.tsx'

vi.mock('../useNarrow.ts', () => ({ useNarrow: () => true }))

function freshHero(): void {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  commitSave(made.save, 'test', false)
}

describe('the map on a phone', () => {
  afterEach(() => {
    commitSave(newSave(), 'test', false)
  })

  it('folds the world map, hides locked routes behind a button, and pins Start', () => {
    freshHero()
    const html = renderToStaticMarkup(<MapView />)
    console.log('[ui]', 'phone map', { locked: html.match(/Show \d+ locked routes?/)?.[0] })
    expect(html).toContain('<details class="map-fold"><summary>World map</summary>')
    expect(html).toContain('Splintered Road')
    expect(html).not.toContain('Road to the Cinder Scar')
    expect(html).toMatch(/Show \d+ locked routes/)
    expect(html).toContain('class="start-dock"')
  })

  it('folds every preparation group but Every run, each with a summary', () => {
    freshHero()
    const html = renderToStaticMarkup(<ExpeditionPanel />)
    expect(html).toMatch(/class="away-box prep-group" data-testid="every-run-box"/)
    expect(html).toMatch(/class="supply-pack prep-group is-folded"/)
    expect(html).toMatch(/class="away-box prep-group is-folded" data-testid="auto-run-box"/)
    expect(html).toContain('0/4 packed')
    expect(html).toContain('Push on at 50%')
    expect(html).toContain('Nothing starts')
  })
})
