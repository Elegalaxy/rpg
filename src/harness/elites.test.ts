import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'

import { ELITE_CELLS, ELITE_MODES, eliteSetup, formatElitesTable, runElitesMatrix } from './elites.ts'

describe('elites matrix', () => {
  it('measures the planned tiers per elite, with a crafted variant of each prepared tier', () => {
    expect(ELITE_CELLS.map((cell) => `${cell.elite}:${cell.tier}`)).toEqual([
      'warden:prepared',
      'warden:over',
      'warden:causeway',
      'warden:prepared-crafted',
      'colossus:arrived',
      'colossus:prepared',
      'colossus:over',
      'colossus:prepared-crafted',
      'reaver:prepared',
      'reaver:over',
      'reaver:prepared-crafted',
    ])
  })

  it('points each cell at its elite and strips telegraph rows in blind mode', () => {
    for (const classId of HERO_CLASSES) {
      for (const cell of ELITE_CELLS) {
        const setup = eliteSetup(classId, cell)
        const expected = { warden: 'fractured-warden', colossus: 'tidebound-colossus', reaver: 'hollowmaw-reaver' }[cell.elite]
        expect(setup.enemies[0]?.defId).toBe(expected)
        const blind = eliteSetup(classId, cell, 'blind')
        const telegraphRows = (blind.hero.priorityRows ?? []).filter((row) =>
          (row.conditions ?? []).some((condition) => condition.kind === 'telegraph' || condition.kind === 'interruptible'),
        )
        expect(telegraphRows).toHaveLength(0)
      }
    }
  })

  it('runs every class, cell and mode, plus the targeting diagnostic rows', () => {
    const rows = runElitesMatrix(1, 1)
    expect(rows).toHaveLength(HERO_CLASSES.length * ELITE_CELLS.length * ELITE_MODES.length + 2)
    expect(rows.filter((row) => row.targeting !== null).map((row) => row.classId)).toEqual(['warrior', 'cleric'])
    const table = formatElitesTable(rows)
    expect(table).toContain('warrior warden prepared rules:')
    expect(table).toContain('cleric reaver over blind:')
    expect(table).toContain('[target lowestHpPercent]')
  }, 300_000)

  it('filters by class, elite, tier and mode', () => {
    const rows = runElitesMatrix(1, 1, { classes: ['mage'], elites: ['colossus'], tiers: ['prepared', 'over'], modes: ['rules'], noDiagnostic: true })
    expect(rows.map((row) => `${row.classId}:${row.elite}:${row.tier}:${row.mode}`)).toEqual(['mage:colossus:prepared:rules', 'mage:colossus:over:rules'])
  }, 300_000)
})
