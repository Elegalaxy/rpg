import { gameDefs } from '../content/scenarios.ts'

import { MAX_BATCH_RUNS } from './batch.ts'
import { ELITE_CELLS, type EliteCell } from './elites.ts'
import { measureVenom, parseVariant, venomSetup } from './venom.ts'

/**
 * Guard matrix for the Assassin's Toxic nodes (Step 13.48). No other guard carries Toxic Opportunity or Toxic Sovereign,
 * so the boss Poison cap fix (`ENVENOM.toxicBossCapFactor`, Step 13.39) had none. Each Assassin build (the shipped
 * reference build, then with Toxic Opportunity, then with Toxic Opportunity and Toxic Sovereign allocated) fights every
 * elite cell in rules mode against the real `gameDefs()`. Measurements only; nothing here tunes.
 */
export const TOXIC_BUILDS = [
  { id: 'plain', variant: 'live' },
  { id: 'toxic-opportunity', variant: 'live+to' },
  { id: 'toxic-sovereign', variant: 'live+ts' },
] as const
export type ToxicBuildId = (typeof TOXIC_BUILDS)[number]['id']

export type ToxicRow = {
  build: ToxicBuildId
  elite: string
  tier: string
  winRate: number
  /** Median win time in ms, or null with no win. */
  medianWinMs: number | null
  /** Mean share of the fight time with Poison on at least one enemy. */
  uptime: number
  /** Mean over runs of the highest Poison stack count seen. */
  peakStacks: number
}

export type ToxicFilter = {
  elites?: readonly string[]
  tiers?: readonly string[]
  builds?: readonly ToxicBuildId[]
}

/** Every build against every elite cell. Deterministic for a seed and run count. */
export function runToxicMatrix(seed: number, runs: number, filter: ToxicFilter = {}): ToxicRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: ToxicRow[] = []
  const cells: readonly EliteCell[] = ELITE_CELLS.filter((cell) => (filter.elites === undefined || filter.elites.includes(cell.elite)) && (filter.tiers === undefined || filter.tiers.includes(cell.tier)))
  for (const cell of cells) {
    for (const build of TOXIC_BUILDS) {
      if (filter.builds !== undefined && !filter.builds.includes(build.id)) continue
      const setup = venomSetup(parseVariant(build.variant), cell)
      rows.push({ build: build.id, elite: cell.elite, tier: cell.tier, ...measureVenom(setup, defs, seed, runs) })
    }
  }
  return rows
}

/** One line per row: build, elite, tier, then wins, median win time, Poison uptime and mean peak stacks. */
export function formatToxicTable(rows: readonly ToxicRow[]): string {
  const lines = rows.map((row) => {
    const median = row.medianWinMs === null ? 'n/a' : `${(row.medianWinMs / 1000).toFixed(1)}s`
    return `assassin ${row.elite} ${row.tier} ${row.build}: wins ${Math.round(row.winRate * 100)}% | median ${median} | poison uptime ${Math.round(row.uptime * 100)}% | peak stacks ${row.peakStacks.toFixed(1)}`
  })
  return `${lines.join('\n')}\n`
}
