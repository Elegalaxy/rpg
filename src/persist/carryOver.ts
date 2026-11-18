import type { Purse, SavedHero } from './save.ts'

/** The share of gold, materials and supplies a reincarnating hero keeps (Step 13.31), in whole percent. */
export const CARRY_PERCENT_BASE = 20
/** Stockpile I, II and III: the carried share, and the Legacy each tier costs. */
export const STOCKPILE_PERCENTS: readonly number[] = [30, 40, 50]
export const STOCKPILE_COSTS: readonly number[] = [20, 35, 50]

/** The carried percent for a hero's purchases: the base, or the Stockpile tier bought. */
export function carryPercent(purchases: { stockpile?: number }): number {
  const tier = purchases.stockpile ?? 0
  return STOCKPILE_PERCENTS[tier - 1] ?? CARRY_PERCENT_BASE
}

export type CarryLine = { id: string; now: number; kept: number }

export type CarryOver = {
  percent: number
  /** Debt paid from gold before the share is taken. */
  debtPaid: number
  gold: { now: number; kept: number }
  debt: { now: number; kept: number }
  materials: CarryLine[]
  supplies: CarryLine[]
}

function share(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100)
}

function lines(stacks: { [id: string]: number }, percent: number): CarryLine[] {
  return Object.keys(stacks)
    .sort()
    .map((id) => ({ id, now: stacks[id] ?? 0, kept: share(stacks[id] ?? 0, percent) }))
    .filter((line) => line.now > 0)
}

/** What a reincarnation would keep of this hero's gold, debt, materials and supplies. */
export function carryOver(hero: SavedHero): CarryOver {
  const percent = carryPercent(hero.purchases)
  const { gold, debt } = hero.purse
  const debtPaid = Math.min(gold, debt)
  const owedAfter = debt - debtPaid
  return {
    percent,
    debtPaid,
    gold: { now: gold, kept: share(gold - debtPaid, percent) },
    debt: { now: debt, kept: Math.ceil((owedAfter * percent) / 100) },
    materials: lines(hero.purse.materials, percent),
    supplies: lines(hero.purse.supplies, percent),
  }
}

/** The purse after reincarnation: gold, debt, materials and supplies cut to the share, everything else as it was. */
export function carriedPurse(purse: Purse, carry: CarryOver): Purse {
  const keep = (rows: CarryLine[]): { [id: string]: number } => {
    const out: { [id: string]: number } = {}
    for (const row of rows) if (row.kept > 0) out[row.id] = row.kept
    return out
  }
  return { ...purse, gold: carry.gold.kept, debt: carry.debt.kept, materials: keep(carry.materials), supplies: keep(carry.supplies) }
}

/** The line the reincarnation confirmation shows: what is kept and what is lost. */
export function carrySummary(carry: CarryOver): string {
  const gold = (value: number): string => value.toLocaleString('en-US')
  return `Keeps ${gold(carry.gold.kept)} of ${gold(carry.gold.now)} gold and ${carry.percent}% of each material and supply. The rest is lost.`
}
