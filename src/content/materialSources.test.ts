import { describe, expect, it } from 'vitest'

import { MATERIAL_SELL_PRICE } from './shop.ts'
import { materialSources } from './materialSources.ts'

describe('materialSources', () => {
  it('finds cinderite in the Cinder Scar', () => {
    const sources = materialSources('cinderite')
    expect(sources.routes.some((name) => name.includes('Cinder Scar'))).toBe(true)
    expect(sources.resources).toContain('Ember Seam')
  })

  it('knows a source for every sellable material', () => {
    for (const id of Object.keys(MATERIAL_SELL_PRICE)) {
      const sources = materialSources(id)
      expect(sources.routes.length + sources.enemies.length + sources.resources.length, id).toBeGreaterThan(0)
    }
  })

  it('returns nothing for an unknown material', () => {
    expect(materialSources('nonsense')).toEqual({ enemies: [], resources: [], routes: [] })
  })
})
