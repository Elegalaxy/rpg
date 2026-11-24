import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'
import { ITEM_MODIFIERS } from '../sim/economy.ts'

import { LATE_BASELINES, LATE_VARIANTS, formatLateTable, lateSetup, runLateMatrix } from './late.ts'

describe('the late modifier matrix', () => {
  it('swaps one real modifier into a prepared tier and leaves the baseline alone', () => {
    for (const variant of LATE_VARIANTS) {
      const baseline = LATE_BASELINES[variant.zone]
      expect(variant.baseline).toBe(baseline.id)
      const changed = Object.entries(variant.tier.modifiers).filter(([slot, id]) => baseline.modifiers[slot as keyof typeof baseline.modifiers] !== id)
      if (variant.id === 'cinder-notonic') {
        expect(variant.tier.supplies).not.toEqual(baseline.supplies)
        continue
      }
      expect(changed.length).toBeGreaterThan(0)
      for (const [, id] of changed) expect(ITEM_MODIFIERS[id as string]).toBeDefined()
    }
  })

  it('builds a setup for every class and zone', () => {
    for (const classId of HERO_CLASSES) {
      for (const zone of ['tyrant', 'warden'] as const) {
        const setup = lateSetup(classId, zone, LATE_BASELINES[zone])
        expect(setup.enemies.length).toBeGreaterThan(0)
      }
    }
  })

  it('runs one seed and prints a difference line per variant', () => {
    const rows = runLateMatrix(1, 1, ['warrior'])
    expect(rows).toHaveLength(2 + LATE_VARIANTS.length)
    const table = formatLateTable(rows)
    for (const variant of LATE_VARIANTS) expect(table).toContain(`${variant.id} minus ${variant.baseline}:`)
    expect(table).toContain('(record only)')
  }, 60_000)
})
