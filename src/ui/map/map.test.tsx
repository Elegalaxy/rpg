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
    expect(html).toContain('Level band: 1 to 6')
    expect(html).toContain('Select a hero first.')
    expect(html).not.toContain('hero-marker')
  })
})
