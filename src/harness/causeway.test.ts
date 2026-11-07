import { describe, expect, it } from 'vitest'

import { enemies } from '../content/enemies.ts'
import { HERO_CLASSES } from '../sim/constants.ts'

import {
  CAUSEWAY_FIGHTS,
  CAUSEWAY_TIERS,
  causewaySetup,
  formatCausewayTable,
  runCausewayMatrix,
} from './causeway.ts'

describe('causeway matrix', () => {
  it('uses the planned tiers', () => {
    expect(CAUSEWAY_TIERS.map((tier) => [tier.id, tier.level, tier.nodes, tier.quality, tier.supplies.length])).toEqual([
      ['arrived', 17, 6, 1, 2],
      ['prepared', 19, 6, 1.05, 4],
      ['over', 22, 8, 1.1, 4],
    ])
  })

  it('names only defined enemies and keeps levels inside each band', () => {
    for (const fight of CAUSEWAY_FIGHTS) {
      for (const member of fight.enemies) {
        const def = enemies[member.defId]
        expect(def, `${fight.id} ${member.defId}`).toBeDefined()
        expect(member.level ?? def?.level).toBeGreaterThanOrEqual(def?.levelMin ?? def?.level ?? 0)
        expect(member.level ?? def?.level).toBeLessThanOrEqual(def?.levelMax ?? def?.level ?? 99)
      }
    }
    expect(CAUSEWAY_FIGHTS.map((fight) => fight.id)).toEqual([
      'leech',
      'raider',
      'bulwark',
      'leech-swarm',
      'causeway-mixed',
      'causeway-deep',
      'colossus',
    ])
  })

  it('builds every class, tier and fight, and strips telegraph rows in blind mode', () => {
    for (const classId of HERO_CLASSES) {
      for (const tier of CAUSEWAY_TIERS) {
        for (const fight of CAUSEWAY_FIGHTS) {
          const rules = causewaySetup(classId, tier, fight)
          expect(rules.hero.level).toBe(tier.level)
          expect(rules.enemies).toEqual(fight.enemies)
          const blind = causewaySetup(classId, tier, fight, 'blind')
          const telegraphRows = (blind.hero.priorityRows ?? []).filter((row) =>
            (row.conditions ?? []).some((condition) => condition.kind === 'telegraph' || condition.kind === 'interruptible'),
          )
          expect(telegraphRows).toHaveLength(0)
          expect((blind.hero.priorityRows ?? []).length).toBeLessThanOrEqual((rules.hero.priorityRows ?? []).length)
        }
      }
    }
  })

  it('runs every class, tier and fight', () => {
    const rows = runCausewayMatrix(1, 1)
    const blindFights = CAUSEWAY_FIGHTS.filter((fight) => fight.blind).length
    expect(rows).toHaveLength(HERO_CLASSES.length * CAUSEWAY_TIERS.length * (CAUSEWAY_FIGHTS.length + blindFights))
    const table = formatCausewayTable(rows)
    expect(table).toContain('warrior arrived rules:')
    expect(table).toContain('warrior arrived blind:')
    expect(table).toContain('colossus')
  }, 300_000)
})
