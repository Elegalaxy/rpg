import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'
import { ITEM_MODIFIERS } from '../sim/economy.ts'
import { UNIQUE_ITEMS } from '../sim/uniques.ts'

import { UNIQUE_BASELINE_IDS, UNIQUE_MATRIX_IDS, UNIQUE_VARIANTS, formatUniquesTable, runUniquesMatrix, uniqueBonuses, uniqueSetup, uniqueTier } from './uniques.ts'

describe('the uniques matrix', () => {
  it('gates the early uniques and the later-zone signatures at the Warden, and the later tiers; the rest is record only', () => {
    const gated = UNIQUE_VARIANTS.filter((entry) => !entry.recordOnly).map((entry) => entry.id)
    expect(gated).toEqual([
      'warden-rootmaw',
      'warden-echo',
      'reaver-colossus',
      'tyrant-reaver',
      'warden-colossus-sig',
      'warden-reaver-sig',
      'warden-tyrant-sig',
      'warden-matriarch-sig',
    ])
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
    expect(colossus.maxHpBonus).toBeCloseTo(0.02 * (20 / 22), 4)
    expect(colossus.physicalStatusResistanceBonus).toBe(1.4)
    expect(uniqueBonuses(['tidebound-carapace'], 30).maxHpBonus).toBe(0.02)
    const matriarch = uniqueBonuses(['briarheart-talisman'], 38)
    expect(matriarch.physicalStatusResistanceBonus).toBe(5)
    expect(matriarch.critDamageBonus).toBeCloseTo(0.038, 4)
    expect(uniqueBonuses(['tidebound-carapace'], 20, 0.5).maxHpBonus).toBeCloseTo(0.01 * (20 / 22), 3)
  })

  it('leaves the Talisman built-in stat out of the signature-only cell', () => {
    const plain = uniqueSetup('warrior', 'warden', [], 'p')
    const signature = uniqueSetup('warrior', 'warden', ['briarheart-talisman'], 's', 1, 'signature')
    const worn = uniqueSetup('warrior', 'warden', ['briarheart-talisman'], 'w')
    expect(signature.hero.statBonuses?.critDamageBonus).toBe(plain.hero.statBonuses?.critDamageBonus)
    expect(signature.hero.statBonuses?.physicalStatusResistanceBonus ?? 0).toBeGreaterThan(plain.hero.statBonuses?.physicalStatusResistanceBonus ?? 0)
    expect(uniqueBonuses(['briarheart-talisman'], 20, 1, false).critDamageBonus).toBeUndefined()
    expect(uniqueBonuses(['briarheart-talisman'], 20).critDamageBonus).toBeCloseTo(0.02, 4)
    expect(worn.hero.statBonuses).toBeDefined()
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

  it('splits the cells into signature-only and modifier-only halves, with the modifier half always record only', () => {
    const mods = UNIQUE_VARIANTS.filter((entry) => entry.part === 'modifier')
    expect(mods.length).toBeGreaterThan(0)
    for (const mod of mods) {
      const cell = mod.id.replace(/-mod$/, '')
      expect(mod.recordOnly, cell).toBe(true)
      expect(UNIQUE_VARIANTS.find((entry) => entry.id === `${cell}-sig`)?.uniques, cell).toEqual(mod.uniques)
    }
    expect(UNIQUE_VARIANTS.find((entry) => entry.id === 'warden-u-all-sig')?.recordOnly).toBe(true)
  })

  it('applies only the signature, or only the modifiers, for the diagnostics', () => {
    const plain = uniqueSetup('warrior', 'warden', [], 'p')
    const signature = uniqueSetup('warrior', 'warden', ['tidebound-carapace'], 's', 1, 'signature')
    const modifier = uniqueSetup('warrior', 'warden', ['tidebound-carapace'], 'm', 1, 'modifier')
    const both = uniqueSetup('warrior', 'warden', ['tidebound-carapace'], 'b')
    expect(signature.hero.statBonuses?.physicalStatusResistanceBonus ?? 0).toBeGreaterThan(plain.hero.statBonuses?.physicalStatusResistanceBonus ?? 0)
    expect(modifier.hero.statBonuses?.physicalStatusResistanceBonus).toBe(plain.hero.statBonuses?.physicalStatusResistanceBonus)
    expect(modifier.hero.statBonuses?.maxHpBonus).toBeGreaterThan(plain.hero.statBonuses?.maxHpBonus ?? 0)
    expect(both.hero.statBonuses?.physicalStatusResistanceBonus).toBe(signature.hero.statBonuses?.physicalStatusResistanceBonus)
  })
})
