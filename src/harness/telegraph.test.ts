import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'

import { builtSetup } from './builds.ts'
import { TELEGRAPH_FIGHTS, TELEGRAPH_MODES, blindSetup, formatTelegraphTable, runTelegraphMatrix } from './telegraph.ts'

describe('telegraph matrix', () => {
  it('blind drops every row that reads a telegraph or an interruptible target', () => {
    let dropped = 0
    for (const classId of HERO_CLASSES) {
      const setup = builtSetup(`ref-${classId}-thornbeast`, classId, 0)
      const blind = blindSetup(setup)
      const before = setup.hero.priorityRows?.length ?? 0
      dropped += before - (blind.hero.priorityRows?.length ?? 0)
      for (const row of blind.hero.priorityRows ?? []) {
        expect((row.conditions ?? []).some((c) => c.kind === 'telegraph' || c.kind === 'interruptible')).toBe(false)
      }
    }
    expect(dropped).toBeGreaterThan(0)
  })

  it('runs every class, fight and mode', () => {
    const rows = runTelegraphMatrix(1, 1)
    expect(rows).toHaveLength(HERO_CLASSES.length * TELEGRAPH_FIGHTS.length * TELEGRAPH_MODES.length)
    const table = formatTelegraphTable(rows)
    expect(table.split('\n').filter((line) => line.length > 0)).toHaveLength(HERO_CLASSES.length * TELEGRAPH_MODES.length)
    expect(table).toContain('warrior blind')
  }, 120_000)
})
