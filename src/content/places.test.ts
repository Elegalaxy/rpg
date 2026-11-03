import { describe, expect, it } from 'vitest'

import { itemBases } from './items.ts'
import { PLACES, dealsIn } from './places.ts'

describe('Greyhaven places', () => {
  it('puts every base item in exactly one gear shop', () => {
    for (const base of Object.values(itemBases)) {
      const shops = PLACES.filter((place) => dealsIn(place, base.id)).map((place) => place.id)
      expect(shops, base.id).toHaveLength(1)
    }
    expect(dealsIn(PLACES[0]!, 'weapon-bow')).toBe(true)
    expect(dealsIn(PLACES[0]!, 'offhand-shield')).toBe(true)
    expect(dealsIn(PLACES[1]!, 'weapon-bow')).toBe(false)
    expect(dealsIn(PLACES[0]!, 'not-an-item')).toBe(false)
  })

  it('has unique ids and only gear shops deal in gear', () => {
    expect(new Set(PLACES.map((place) => place.id)).size).toBe(PLACES.length)
    expect(PLACES.filter((place) => place.gear !== undefined).map((place) => place.id)).toEqual(['weaponsmith', 'armorer', 'jeweler'])
  })
})
