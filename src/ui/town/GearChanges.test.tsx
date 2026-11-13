import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { EquipPreview } from '../../persist/equipment.ts'

import { GearChanges } from './GearChanges.tsx'

const preview: EquipPreview = {
  block: null,
  slot: 'chest',
  changes: [
    { label: 'Armor', before: 22.456, after: 25.049, unit: '' },
    { label: 'Armor', before: 27.24, after: 34.64, unit: '' },
    { label: 'Power', before: 20, after: 11, unit: '' },
    { label: 'Base action time', before: 2.5, after: 2.2, unit: ' s' },
  ],
  replaces: { name: "Hauler's Medium Chest", itemLevel: 8, quality: 0.98, durability: 100, maxDurability: 100 },
  extras: [{ label: 'Bag room', before: 23, after: 20, unit: '' }],
  notes: ["Loses Hauler's: +3 bag room"],
}

describe('GearChanges', () => {
  it('names the replaced piece, rounds stats to one decimal, signs the change and shows bag room', () => {
    const html = renderToStaticMarkup(<GearChanges preview={preview} empty="none" />)
    expect(html).toContain("Replaces: Hauler&#x27;s Medium Chest · L8 · 98%")
    expect(html).toContain('Armor 22.5 → 25 (+2.5)')
    expect(html).toContain('Armor 27.2 → 34.6 (+7.4)')
    expect(html).toContain('Power 20 → 11 (−9.0)')
    expect(html).toContain('2.5 s → 2.2 s (−0.3 s)')
    expect(html).toContain('Bag room 23 → 20 (−3)')
    expect(html).toContain('change-worse')
    expect(html).toContain('change-better')
  })
})
