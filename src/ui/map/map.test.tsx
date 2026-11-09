import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MapView } from './MapView.tsx'

describe('world map without a hero', () => {
  it('shows every node with its state and the road route, and says why it cannot start', () => {
    const html = renderToStaticMarkup(<MapView />)
    for (const name of ['Greyhaven', 'Splintered Road', 'Withered Grove', 'Fallen Bastion', 'Fracture Gate']) {
      expect(html).toContain(name)
    }
    expect(html).toContain('aria-label="Withered Grove, locked. Not discovered yet."')
    expect(html).toContain('aria-label="Splintered Road, discovered"')
    expect(html).toContain('Level band')
    expect(html).toContain('1–6')
    expect(html).toContain('Select a hero first.')
    expect(html).toContain('Pounce · 1.5 s wind-up')
    expect(html).not.toContain('hero-marker')
  })
})

describe('world map with the Drowned Causeway', () => {
  it('shows the Causeway node as undiscovered', () => {
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('Drowned Causeway')
    expect(html).toContain('aria-label="Drowned Causeway, locked. Not discovered yet."')
  })
})

describe('world map with the Rift Hollows', () => {
  it('shows the Hollows node as undiscovered', () => {
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('Rift Hollows')
    expect(html).toContain('aria-label="Rift Hollows, locked. Not discovered yet."')
  })
})

describe('world map with the Cinder Scar', () => {
  it('shows the Cinder Scar node as undiscovered', () => {
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('Cinder Scar')
    expect(html).toContain('aria-label="Cinder Scar, locked. Not discovered yet."')
  })
})
