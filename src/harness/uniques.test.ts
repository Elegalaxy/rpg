import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'
import { ITEM_MODIFIERS } from '../sim/economy.ts'
import { UNIQUE_ITEMS } from '../sim/uniques.ts'

import { UNIQUE_BASELINE_IDS, UNIQUE_MATRIX_IDS, UNIQUE_VARIANTS, formatUniquesTable, runUniquesMatrix, uniqueBonuses, uniqueSetup, uniqueTier } from './uniques.ts'

describe('the uniques matrix', () => {
  it('has the cells of the plan: gated single uniques, all-six rows, and record-only cells', () => {
    const gated = UNIQUE_VARIANTS.filter((entry) => !entry.recordOnly).map((entry) => entry.id)
    expect(gated).toEqual(['warden-colossus', 'warden-reaver', 'warden-tyrant', 'warden-matriarch', 'warden-u-all', 'reaver-colossus', 'tyrant-reaver'])
    expect(UNIQUE_VARIANTS.filter((entry) => entry.recordOnly).map((entry) => entry.id)).toContain('matriarch-u-all')
    for (const entry of UNIQUE_VARIANTS) expect(UNIQUE_BASELINE_IDS[entry.zone]).toBe(entry.baseline)
  })

  it('swaps each unique modifier into its slot and keeps the other slots', () => {
    const baseline = uniqueTier('warden', [], 'x')
    const all = uniqueTier('warden', UNIQUE_ITEMS.map((def) => def.id), 'warden-u-all')
    expect(all.modifiers.chest).toBe('stalwart')
    expect(all.modifiers.mainHand).toBe('bloodbound')
    expect(all.modifiers.offHand).toBe('kindled')
    expect(all.modifiers.accessory1).toBe('staunch')
    expect(all.modifiers.accessory0).toBe(baseline.modifiers.accessory0)
    for (const id of Object.values(all.modifiers)) if (id !== null) expect(ITEM_MODIFIERS[id]).toBeDefined()
  })

  it('scales a signature down above the tier level and adds the Talisman implicit only for the Matriarch unique', () => {
    const colossus = uniqueBonuses(['tidebound-carapace'], 20)
    expect(colossus.lifestealFraction).toBeCloseTo(0.01 * (20 / 22), 4)
    expect(uniqueBonuses(['tidebound-carapace'], 30).lifestealFraction).toBe(0.01)
    const matriarch = uniqueBonuses(['briarheart-talisman'], 38)
    expect(matriarch.physicalStatusResistanceBonus).toBe(10)
    expect(matriarch.critDamageBonus).toBeCloseTo(0.038, 4)
    expect(uniqueBonuses(['tidebound-carapace'], 20, 0.5).lifestealFraction).toBeCloseTo(0.005 * (20 / 22), 3)
  })

  it('builds a setup for every class and zone, and the uniques raise the bonuses over the baseline', () => {
    for (const classId of HERO_CLASSES) {
      for (const zone of Object.keys(UNIQUE_BASELINE_IDS) as (keyof typeof UNIQUE_BASELINE_IDS)[]) {
        const plain = uniqueSetup(classId, zone, [], 'p')
        const worn = uniqueSetup(classId, zone, ['rootmaw-treads'], 'w')
        expect(plain.enemies.length).toBeGreaterThan(0)
        expect((worn.hero.statBonuses?.accuracyBonus ?? 0) - (plain.hero.statBonuses?.accuracyBonus ?? 0)).toBeGreaterThan(0)
      }
    }
  })

  it('runs a limited matrix and formats it', () => {
    const rows = runUniquesMatrix(1, 1, ['warrior'], ['warden-colossus'])
    expect(rows.map((row) => row.id)).toEqual(['warden-prepared', 'warden-colossus'])
    expect(formatUniquesTable(rows)).toContain('warden-colossus minus warden-prepared')
    expect(UNIQUE_MATRIX_IDS).toContain('matriarch-u-all')
  }, 60_000)

  it('has a signature-only and a modifier-only diagnostic for every gated cell, all record only', () => {
    const gated = UNIQUE_VARIANTS.filter((entry) => !entry.recordOnly)
    for (const cell of gated) {
      const sig = UNIQUE_VARIANTS.find((entry) => entry.id === `${cell.id}-sig`)
      const mod = UNIQUE_VARIANTS.find((entry) => entry.id === `${cell.id}-mod`)
      expect(sig?.recordOnly, cell.id).toBe(true)
      expect(mod?.recordOnly, cell.id).toBe(true)
      expect(sig?.uniques).toEqual(cell.uniques)
    }
  })

  it('applies only the signature, or only the modifiers, for the diagnostics', () => {
    const plain = uniqueSetup('warrior', 'warden', [], 'p')
    const signature = uniqueSetup('warrior', 'warden', ['tidebound-carapace'], 's', 1, 'signature')
    const modifier = uniqueSetup('warrior', 'warden', ['tidebound-carapace'], 'm', 1, 'modifier')
    const both = uniqueSetup('warrior', 'warden', ['tidebound-carapace'], 'b')
    expect(signature.hero.statBonuses?.lifestealFraction).toBeGreaterThan(0)
    expect(signature.hero.statBonuses?.maxHpBonus).toBe(plain.hero.statBonuses?.maxHpBonus)
    expect(modifier.hero.statBonuses?.lifestealFraction).toBe(plain.hero.statBonuses?.lifestealFraction)
    expect(modifier.hero.statBonuses?.maxHpBonus).toBeGreaterThan(plain.hero.statBonuses?.maxHpBonus ?? 0)
    expect(both.hero.statBonuses?.lifestealFraction).toBe(signature.hero.statBonuses?.lifestealFraction)
  })
})
