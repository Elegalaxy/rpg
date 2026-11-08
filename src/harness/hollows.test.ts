import { describe, expect, it } from 'vitest'

import { enemies } from '../content/enemies.ts'
import { HERO_CLASSES } from '../sim/constants.ts'

import { HOLLOWS_FIGHTS, HOLLOWS_TIERS, formatHollowsTable, hollowsSetup, runHollowsMatrix } from './hollows.ts'

describe('hollows matrix', () => {
  it('uses the planned tiers', () => {
    expect(HOLLOWS_TIERS.map((tier) => [tier.id, tier.level, tier.nodes, tier.quality, tier.supplies.length])).toEqual([
      ['arrived', 22, 8, 1.12, 3],
      ['prepared', 24, 8, 1.16, 4],
      ['over', 27, 9, 1.16, 4],
    ])
  })

  it('names only defined enemies and keeps levels inside each band', () => {
    for (const fight of HOLLOWS_FIGHTS) {
      for (const member of fight.enemies) {
        const def = enemies[member.defId]
        expect(def, `${fight.id} ${member.defId}`).toBeDefined()
        expect(member.level ?? def?.level).toBeGreaterThanOrEqual(def?.levelMin ?? def?.level ?? 0)
        expect(member.level ?? def?.level).toBeLessThanOrEqual(def?.levelMax ?? def?.level ?? 99)
      }
    }
    expect(HOLLOWS_FIGHTS.map((fight) => fight.id)).toEqual([
      'shade',
      'brute',
      'channeler',
      'shade-pair',
      'hollows-mixed',
      'hollows-deep',
      'reaver',
    ])
  })

  it('builds every class, tier and fight, and strips telegraph rows in blind mode', () => {
    for (const classId of HERO_CLASSES) {
      for (const tier of HOLLOWS_TIERS) {
        for (const fight of HOLLOWS_FIGHTS) {
          const rules = hollowsSetup(classId, tier, fight)
          expect(rules.hero.level).toBe(tier.level)
          expect(rules.enemies).toEqual(fight.enemies)
          const blind = hollowsSetup(classId, tier, fight, 'blind')
          const telegraphRows = (blind.hero.priorityRows ?? []).filter((row) =>
            (row.conditions ?? []).some((condition) => condition.kind === 'telegraph' || condition.kind === 'interruptible'),
          )
          expect(telegraphRows).toHaveLength(0)
        }
      }
    }
  })

  it('applies Stalwart max HP everywhere and Devout Healing Power to the Cleric only', () => {
    const fight = HOLLOWS_FIGHTS[0]!
    const prepared = HOLLOWS_TIERS[1]!
    const warrior = hollowsSetup('warrior', prepared, fight).hero.statBonuses
    const cleric = hollowsSetup('cleric', prepared, fight).hero.statBonuses
    expect(warrior?.maxHpBonus).toBeCloseTo(0.12, 8)
    expect(warrior?.equipmentHealingPower ?? 0).toBe(0)
    expect(cleric?.equipmentHealingPower).toBe(24)
    expect(hollowsSetup('warrior', HOLLOWS_TIERS[0]!, fight).hero.statBonuses?.maxHpBonus ?? 0).toBeCloseTo(0.08, 8)
  })

  it('runs every class, tier and fight', () => {
    const rows = runHollowsMatrix(1, 1)
    const blindFights = HOLLOWS_FIGHTS.filter((fight) => fight.blind).length
    expect(rows).toHaveLength(HERO_CLASSES.length * HOLLOWS_TIERS.length * (HOLLOWS_FIGHTS.length + blindFights))
    const table = formatHollowsTable(rows)
    expect(table).toContain('warrior arrived rules:')
    expect(table).toContain('warrior arrived blind:')
    expect(table).toContain('reaver')
  }, 300_000)
})
