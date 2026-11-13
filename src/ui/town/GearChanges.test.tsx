import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { EquipPreview } from '../../persist/equipment.ts'

import { GearChanges } from './GearChanges.tsx'

const preview: EquipPreview = {
  block: null,
  slot: 'chest',
  changes: [{ label: 'Armor', before: 22.456, after: 25.049, unit: '' }],
  replaces: { name: "Hauler's Medium Chest", itemLevel: 8, quality: 0.98, durability: 100, maxDurability: 100 },
  extras: [{ label: 'Bag room', before: 23, after: 20, unit: '' }],
  notes: ["Loses Hauler's: +3 bag room"],
}

describe('GearChanges', () => {
  it('names the replaced piece, rounds stats to one decimal, signs the change and shows bag room', () => {
    const html = renderToStaticMarkup(<GearChanges preview={preview} empty="none" />)
    expect(html).toContain("Replaces: Hauler&#x27;s Medium Chest · L8 · 98%")
    expect(html).toContain('Armor 22.5 → 25 (+2.6)')
    expect(html).toContain('Bag room 23 → 20 (−3)')
    expect(html).toContain('change-worse')
    expect(html).toContain('change-better')
  })
})
