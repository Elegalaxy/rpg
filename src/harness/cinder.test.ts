import { describe, expect, it } from 'vitest'

import { enemies } from '../content/enemies.ts'
import { WARMING_TONIC_BURN_ROW } from '../content/supplies.ts'
import { HERO_CLASSES } from '../sim/constants.ts'

import { CINDER_FIGHTS, CINDER_TIERS, CINDER_VARIANTS, cinderSetup, formatCinderTable, runCinderMatrix } from './cinder.ts'
import { WARDEN_TIERS, wardenSetup } from './warden.ts'

describe('cinder matrix', () => {
  it('uses the planned tiers and the no-Tonic variant', () => {
    expect(CINDER_TIERS.map((tier) => [tier.id, tier.level, tier.nodes, tier.quality, tier.supplies.length])).toEqual([
      ['arrived', 28, 9, 1.16, 3],
      ['prepared', 30, 10, 1.2, 4],
      ['over', 33, 11, 1.2, 4],
    ])
    expect(CINDER_TIERS[1]?.supplies).toEqual(['healing-draught', 'healing-draught', 'warming-tonic', 'ward-charm'])
    expect(CINDER_VARIANTS.map((tier) => tier.id)).toEqual(['prepared-notonic', 'prepared-noember'])
    expect(CINDER_VARIANTS[0]?.supplies).toEqual(['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'])
    expect(CINDER_VARIANTS[1]?.modifiers).toMatchObject({ hands: 'nimble', feet: 'nimble', mainHand: 'bloodbound', head: 'stalwart', chest: 'stalwart' })
  })

  it('names only defined enemies and keeps levels inside each band', () => {
    for (const fight of CINDER_FIGHTS) {
      for (const member of fight.enemies) {
        const def = enemies[member.defId]
        expect(def, `${fight.id} ${member.defId}`).toBeDefined()
        expect(member.level ?? def?.level).toBeGreaterThanOrEqual(def?.levelMin ?? def?.level ?? 0)
        expect(member.level ?? def?.level).toBeLessThanOrEqual(def?.levelMax ?? def?.level ?? 99)
      }
    }
    expect(CINDER_FIGHTS.map((fight) => fight.id)).toEqual(['imp', 'golem', 'acolyte', 'imp-swarm', 'cinder-mixed', 'cinder-deep', 'tyrant'])
  })

  it('builds every class, tier and fight, and strips telegraph rows in blind mode', () => {
    for (const classId of HERO_CLASSES) {
      for (const tier of [...CINDER_TIERS, ...CINDER_VARIANTS]) {
        for (const fight of CINDER_FIGHTS) {
          const rules = cinderSetup(classId, tier, fight)
          expect(rules.hero.level).toBe(tier.level)
          expect(rules.enemies).toEqual(fight.enemies)
          const blind = cinderSetup(classId, tier, fight, 'blind')
          const telegraphRows = (blind.hero.priorityRows ?? []).filter((row) =>
            (row.conditions ?? []).some((condition) => condition.kind === 'telegraph' || condition.kind === 'interruptible'),
          )
          expect(telegraphRows).toHaveLength(0)
        }
      }
    }
  })

  it('keeps Bloodbound and Stalwart in every tier, adds Emberward from prepared, and Kindled to the prepared Cleric only', () => {
    const fight = CINDER_FIGHTS[0]!
    const [arrived, prepared] = [CINDER_TIERS[0]!, CINDER_TIERS[1]!]
    expect(prepared.modifiers).toMatchObject({ mainHand: 'bloodbound', head: 'stalwart', chest: 'stalwart', hands: 'emberward', feet: 'emberward' })
    expect(arrived.modifiers).toMatchObject({ mainHand: 'bloodbound', head: 'stalwart', chest: 'stalwart' })
    expect(arrived.modifiers.hands).not.toBe('emberward')
    const arrivedWarrior = cinderSetup('warrior', arrived, fight).hero.statBonuses
    const warrior = cinderSetup('warrior', prepared, fight).hero.statBonuses
    const cleric = cinderSetup('cleric', prepared, fight).hero.statBonuses
    expect(arrivedWarrior?.magicalStatusResistanceBonus ?? 0).toBe(0)
    expect(warrior?.magicalStatusResistanceBonus).toBeGreaterThan(0)
    expect(warrior?.lifestealFraction).toBeCloseTo(0.05, 8)
    expect(warrior?.maxHpBonus).toBeGreaterThan(0)
    expect(warrior?.armorPenetrationBonus ?? 0).toBe(0)
    expect(cleric?.maxHpBonus).toBeCloseTo((warrior?.maxHpBonus ?? 0) + 0.05, 8)
    expect(cleric?.equipmentHealingPower).toBeGreaterThanOrEqual(8)
  })

  it('gives every Cinder tier the Burn Tonic row within the 12-row limit, and leaves the Warden tiers without it', () => {
    const burnRows = (rows: readonly { skillId: string; conditions?: unknown }[] | undefined): number =>
      (rows ?? []).filter((row) => row.skillId === 'warming-tonic' && JSON.stringify(row.conditions) === JSON.stringify(WARMING_TONIC_BURN_ROW.conditions)).length
    for (const classId of HERO_CLASSES) {
      for (const tier of [...CINDER_TIERS, ...CINDER_VARIANTS]) {
        const rows = cinderSetup(classId, tier, CINDER_FIGHTS[0]!).hero.priorityRows
        expect(rows?.length ?? 0, `${classId} ${tier.id}`).toBeLessThanOrEqual(12)
        expect(burnRows(rows), `${classId} ${tier.id}`).toBe(1)
      }
      expect(burnRows(wardenSetup(classId, WARDEN_TIERS[1]!).hero.priorityRows)).toBe(0)
    }
    // The Assassin gives up the Chill Tonic row (no Chill in the zone) to make room.
    const assassin = cinderSetup('assassin', CINDER_TIERS[1]!, CINDER_FIGHTS[0]!).hero.priorityRows ?? []
    expect(assassin.filter((row) => row.skillId === 'warming-tonic')).toHaveLength(1)
  })

  it('runs every class, tier and fight', () => {
    const rows = runCinderMatrix(1, 1)
    const blindFights = CINDER_FIGHTS.filter((fight) => fight.blind).length
    expect(rows).toHaveLength(HERO_CLASSES.length * (CINDER_TIERS.length + CINDER_VARIANTS.length) * (CINDER_FIGHTS.length + blindFights))
    const table = formatCinderTable(rows)
    expect(table).toContain('warrior arrived rules:')
    expect(table).toContain('warrior arrived blind:')
    expect(table).toContain('warrior prepared-notonic rules:')
    expect(table).toContain('warrior prepared-noember rules:')
    expect(table).toContain('tyrant')
  }, 300_000)
})
