import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { builtSetup } from './builds.ts'

/** The fights that probe the telegraphed heavy attacks. Slugs name reference scenarios. */
export const TELEGRAPH_FIGHTS = ['wolf', 'road-mixed', 'thornbeast', 'sentry', 'arbalist', 'grove-mixed', 'bastion-mixed'] as const
export const TELEGRAPH_MODES = ['rules', 'blind'] as const
export type TelegraphMode = (typeof TELEGRAPH_MODES)[number]

export type TelegraphRow = {
  classId: HeroClass
  fight: string
  mode: TelegraphMode
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
  /** Median fight time of the wins in ms, or null with no win. */
  medianMs: number | null
}

/** The setup with every row that reads a telegraph or an interruptible target removed. */
export function blindSetup(setup: CombatSetup): CombatSetup {
  const rows = (setup.hero.priorityRows ?? []).filter(
    (row) => !(row.conditions ?? []).some((condition) => condition.kind === 'telegraph' || condition.kind === 'interruptible'),
  )
  return { ...setup, hero: { ...setup.hero, priorityRows: rows } }
}

/** Floor builds of every class against the wolf, the mixed groups, and the heavy-attack regulars, with and without telegraph rules. */
export function runTelegraphMatrix(seed: number, runs: number): TelegraphRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: TelegraphRow[] = []
  for (const classId of HERO_CLASSES) {
    for (const fight of TELEGRAPH_FIGHTS) {
      for (const mode of TELEGRAPH_MODES) {
        const built = builtSetup(`ref-${classId}-${fight}`, classId, 0)
        const setup = mode === 'blind' ? blindSetup(built) : built
        let wins = 0
        let lost = 0
        const times: number[] = []
        for (let index = 0; index < runs; index += 1) {
          const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
          if (state.outcome === 'victory') {
            wins += 1
            times.push(state.timeMs)
          }
          lost += 1 - Math.max(0, state.hero.hp) / state.hero.maxHp
        }
        times.sort((a, b) => a - b)
        rows.push({
          classId,
          fight,
          mode,
          winRate: wins / runs,
          hpLost: lost / runs,
          medianMs: times.length === 0 ? null : (times[Math.floor(times.length / 2)] ?? null),
        })
      }
    }
  }
  return rows
}

/** One line per class and mode, with a cell per fight: wins, mean HP lost, median win time. */
export function formatTelegraphTable(rows: readonly TelegraphRow[]): string {
  const lines: string[] = []
  for (const classId of HERO_CLASSES) {
    for (const mode of TELEGRAPH_MODES) {
      const cells = TELEGRAPH_FIGHTS.map((fight) => {
        const row = rows.find((entry) => entry.classId === classId && entry.mode === mode && entry.fight === fight)
        if (row === undefined) return `${fight} n/a`
        const time = row.medianMs === null ? '-' : `${(row.medianMs / 1000).toFixed(0)}s`
        return `${fight} ${Math.round(row.winRate * 100)}% (lost ${Math.round(row.hpLost * 100)}%, ${time})`
      })
      lines.push(`${classId} ${mode}: ${cells.join(' | ')}`)
    }
  }
  return `${lines.join('\n')}\n`
}
