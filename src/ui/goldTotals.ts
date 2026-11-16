import { purseOf, type SaveData } from '../persist/save.ts'

/** What the hero owns in gold. On a run the purse is empty: the run carries some and the rest is banked until it settles. */
export function goldTotals(save: SaveData): { total: number; carried: number; banked: number; onRun: boolean } {
  const purse = purseOf(save).gold
  const run = save.expedition
  if (run === null) return { total: purse, carried: 0, banked: 0, onRun: false }
  return { total: run.carriedGold + run.depositedGold + purse, carried: run.carriedGold, banked: run.depositedGold, onRun: true }
}
