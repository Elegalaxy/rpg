import { describe, expect, it } from 'vitest'

import { ELITE_CELLS } from './elites.ts'
import { TOXIC_BUILDS, formatToxicTable, runToxicMatrix } from './toxic.ts'
import { parseVariant, venomSetup } from './venom.ts'

describe('toxic matrix (Step 13.48)', () => {
  it('allocates the Toxic nodes only in their own builds', () => {
    const cell = ELITE_CELLS.find((entry) => entry.elite === 'warden' && entry.tier === 'prepared')!
    const nodes = (variant: string) => venomSetup(parseVariant(variant), cell).hero.allocatedNodeIds ?? []
    expect(nodes('live')).not.toContain('assassin-toxic-opportunity')
    expect(nodes('live+to')).toContain('assassin-toxic-opportunity')
    expect(nodes('live+to')).not.toContain('assassin-toxic-sovereign')
    expect(nodes('live+ts')).toContain('assassin-toxic-opportunity')
    expect(nodes('live+ts')).toContain('assassin-toxic-sovereign')
  })

  it('runs every elite cell with every build and prints a line each', () => {
    const rows = runToxicMatrix(1, 1)
    expect(rows).toHaveLength(ELITE_CELLS.length * TOXIC_BUILDS.length)
    const table = formatToxicTable(rows)
    expect(table).toContain('assassin warden prepared plain: wins')
    expect(table).toContain('assassin tyrant prepared-crafted toxic-sovereign: wins')
    expect(table.trim().split('\n')).toHaveLength(rows.length)
  })

  it('is deterministic for a seed', () => {
    const filter = { elites: ['warden'], tiers: ['prepared'] }
    expect(runToxicMatrix(1, 2, filter)).toEqual(runToxicMatrix(1, 2, filter))
  }, 120_000)

  it('lets a Toxic Opportunity Assassin stack Poison higher on the Warden than one without', () => {
    const rows = runToxicMatrix(1, 5, { elites: ['warden'], tiers: ['prepared'] })
    const peak = (build: string) => rows.find((row) => row.build === build)!.peakStacks
    expect(peak('toxic-opportunity')).toBeGreaterThan(peak('plain'))
    expect(peak('toxic-sovereign')).toBeGreaterThan(peak('plain'))
  }, 120_000)
})
