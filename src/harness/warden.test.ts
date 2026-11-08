import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'

import { WARDEN_TIERS, formatWardenTable, runWardenMatrix, wardenSetup } from './warden.ts'

describe('warden matrix', () => {
  it('builds a full-gear hero with supplies and supply rules for every class and tier', () => {
    for (const classId of HERO_CLASSES) {
      for (const tier of WARDEN_TIERS) {
        const setup = wardenSetup(classId, tier)
        expect(setup.hero.level).toBe(tier.level)
        expect(setup.hero.allocatedNodeIds).toHaveLength(tier.nodes)
        expect(setup.hero.supplies).toHaveLength(tier.supplies.length)
        expect(tier.supplies.length).toBeLessThanOrEqual(4)
        expect(setup.hero.priorityRows?.[0]?.skillId).toBe('greater-draught')
        expect(setup.hero.gear.mainHand.itemLevel).toBe(tier.level)
        expect(setup.hero.gear.mainHand.quality).toBe(tier.quality)
        expect(setup.enemies).toHaveLength(1)
      }
    }
  })

  it('applies modifier bonuses with the same-modifier cap', () => {
    const arrived = wardenSetup('warrior', WARDEN_TIERS[0]!)
    expect(arrived.hero.statBonuses?.critChanceBonus).toBeCloseTo(0.04)
    expect(arrived.hero.statBonuses?.accuracyBonus).toBe(6)
    const prepared = wardenSetup('warrior', WARDEN_TIERS[1]!)
    expect(prepared.hero.statBonuses?.maxHpBonus).toBeCloseTo(0.08)
    expect(prepared.hero.statBonuses?.critDamageBonus).toBeCloseTo(0.1)
  })

  it('adds a Causeway-geared tier after the original three', () => {
    expect(WARDEN_TIERS.map((tier) => tier.id)).toEqual(['arrived', 'prepared', 'over', 'causeway'])
    const tier = WARDEN_TIERS[3]!
    expect(tier.level).toBe(22)
    expect(tier.quality).toBe(1.12)
    expect(wardenSetup('warrior', tier).hero.statBonuses?.lifestealFraction).toBeCloseTo(0.03)
    expect(wardenSetup('warrior', tier).hero.statBonuses?.equipmentHealingPower ?? 0).toBe(0)
    expect(wardenSetup('cleric', tier).hero.statBonuses?.equipmentHealingPower).toBe(20)
  })

  it('runs every class and tier', () => {
    const rows = runWardenMatrix(1, 1)
    expect(rows).toHaveLength(HERO_CLASSES.length * WARDEN_TIERS.length)
    const table = formatWardenTable(rows)
    expect(table.split('\n').filter((line) => line.length > 0)).toHaveLength(rows.length)
    expect(table).toContain('warrior arrived')
  }, 120_000)
})
