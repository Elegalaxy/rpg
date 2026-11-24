import { describe, expect, it } from 'vitest'

import { enemies } from '../content/enemies.ts'
import { HERO_CLASSES } from '../sim/constants.ts'

import { BARRENS_FIGHTS, BARRENS_TIERS, BARRENS_VARIANTS, barrensSetup, formatBarrensTable, runBarrensMatrix } from './barrens.ts'

describe('barrens matrix', () => {
  it('uses the planned tiers and the two variants', () => {
    expect(BARRENS_TIERS.map((tier) => [tier.id, tier.level, tier.nodes, tier.quality, tier.supplies.length])).toEqual([
      ['arrived', 34, 11, 1.2, 3],
      ['prepared', 36, 12, 1.24, 4],
      ['over', 39, 12, 1.24, 4],
    ])
    expect(BARRENS_TIERS[1]?.supplies).toEqual(['healing-draught', 'healing-draught', 'antidote', 'ward-charm'])
    expect(BARRENS_VARIANTS.map((tier) => tier.id)).toEqual(['prepared-nostaunch', 'prepared-noantidote'])
    expect(BARRENS_VARIANTS[0]?.modifiers).toMatchObject({ hands: 'nimble', feet: 'nimble', mainHand: 'bloodbound', head: 'stalwart' })
    expect(BARRENS_VARIANTS[1]?.supplies).toEqual(['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'])
    expect(BARRENS_TIERS[0]?.modifiers).toMatchObject({ hands: 'emberward', feet: 'emberward' })
    expect(BARRENS_TIERS[1]?.modifiers).toMatchObject({ hands: 'staunch', feet: 'staunch' })
  })

  it('names only defined enemies and keeps levels inside each band', () => {
    for (const fight of BARRENS_FIGHTS) {
      for (const member of fight.enemies) {
        const def = enemies[member.defId]
        expect(def, `${fight.id} ${member.defId}`).toBeDefined()
        expect(member.level ?? def?.level).toBeGreaterThanOrEqual(def?.levelMin ?? def?.level ?? 0)
        expect(member.level ?? def?.level).toBeLessThanOrEqual(def?.levelMax ?? def?.level ?? 99)
      }
    }
    expect(BARRENS_FIGHTS.map((fight) => fight.id)).toEqual(['stalker', 'crawler', 'thornwitch', 'stalker-pair', 'barrens-mixed', 'barrens-deep', 'matriarch'])
  })

  it('builds every class, tier and fight, strips telegraph rows in blind mode and stays inside 12 rows', () => {
    for (const classId of HERO_CLASSES) {
      for (const tier of [...BARRENS_TIERS, ...BARRENS_VARIANTS]) {
        for (const fight of BARRENS_FIGHTS) {
          const rules = barrensSetup(classId, tier, fight)
          expect(rules.hero.level).toBe(tier.level)
          expect(rules.enemies).toEqual(fight.enemies)
          expect(rules.hero.priorityRows?.length ?? 0, `${classId} ${tier.id}`).toBeLessThanOrEqual(12)
          const blind = barrensSetup(classId, tier, fight, 'blind')
          const telegraphRows = (blind.hero.priorityRows ?? []).filter((row) =>
            (row.conditions ?? []).some((condition) => condition.kind === 'telegraph' || condition.kind === 'interruptible'),
          )
          expect(telegraphRows).toHaveLength(0)
        }
      }
    }
  })

  it('gives Staunch tiers physical status resistance and the Cleric Kindled', () => {
    const fight = BARRENS_FIGHTS[0]!
    const arrived = barrensSetup('warrior', BARRENS_TIERS[0]!, fight).hero.statBonuses
    const prepared = barrensSetup('warrior', BARRENS_TIERS[1]!, fight).hero.statBonuses
    const nostaunch = barrensSetup('warrior', BARRENS_VARIANTS[0]!, fight).hero.statBonuses
    expect(arrived?.physicalStatusResistanceBonus ?? 0).toBe(0)
    expect(nostaunch?.physicalStatusResistanceBonus ?? 0).toBe(0)
    expect(prepared?.physicalStatusResistanceBonus).toBeGreaterThan(0)
    const cleric = barrensSetup('cleric', BARRENS_TIERS[1]!, fight).hero.statBonuses
    expect(cleric?.equipmentHealingPower).toBeGreaterThanOrEqual(8)
  })

  it('runs every class, tier and fight', () => {
    const rows = runBarrensMatrix(1, 1)
    const blindFights = BARRENS_FIGHTS.filter((fight) => fight.blind).length
    expect(rows).toHaveLength(HERO_CLASSES.length * (BARRENS_TIERS.length + BARRENS_VARIANTS.length) * (BARRENS_FIGHTS.length + blindFights))
    const table = formatBarrensTable(rows)
    expect(table).toContain('warrior arrived rules:')
    expect(table).toContain('warrior arrived blind:')
    expect(table).toContain('warrior prepared-nostaunch rules:')
    expect(table).toContain('matriarch')
  }, 300_000)

  it('filters by class, tier and fight', () => {
    const rows = runBarrensMatrix(1, 1, { classes: ['mage'], tiers: ['prepared'], fights: ['matriarch'] })
    expect(rows.map((row) => [row.classId, row.tier, row.fight, row.mode])).toEqual([
      ['mage', 'prepared', 'matriarch', 'rules'],
      ['mage', 'prepared', 'matriarch', 'blind'],
    ])
  })
})
