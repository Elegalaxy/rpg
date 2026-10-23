import { gameDefs, referenceScenarioIds, setupForScenario } from '../content/scenarios.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { summarizeDefeat, type HeroHpLossEvent } from '../sim/log.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatState } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'

/** Inclusive victory duration for an equal-level Standard solo (Deserter). */
export const STANDARD_DURATION_MIN_MS = 8_000
export const STANDARD_DURATION_MAX_MS = 12_000
/** Inclusive victory HP attrition, in percent, for a Deserter row. */
export const STANDARD_ATTRITION_MIN_PERCENT = 10
export const STANDARD_ATTRITION_MAX_PERCENT = 20
/** Inclusive victory duration for a Warden row. */
export const WARDEN_DURATION_MIN_MS = 60_000
export const WARDEN_DURATION_MAX_MS = 90_000

const MS_PER_SIMULATED_HOUR = 3_600_000

const CSV_HEADER = [
  'class',
  'encounter',
  'winPercent',
  'victoryDurationP10Ms',
  'victoryDurationP50Ms',
  'victoryDurationP90Ms',
  'victoryMeanHpAttritionPercent',
  'timeouts',
  'topDefeatCause',
  'xpPerSimulatedHour',
  'flag',
].join(',')

export type MatrixFlag = 'pass' | 'fail' | 'n/a'

export type MatrixRow = {
  classId: string
  encounter: string
  scenarioId: string
  runs: number
  wins: number
  winPercent: number
  victoryDurationP10Ms: number | null
  victoryDurationP50Ms: number | null
  victoryDurationP90Ms: number | null
  victoryMeanHpAttritionPercent: number | null
  timeouts: number
  topDefeatCause: string
  xpPerSimulatedHour: number
  flag: MatrixFlag
}

export type MatrixReport = {
  matrixId: string
  baseSeed: number
  runs: number
  rows: MatrixRow[]
}

type FightOutcome = 'victory' | 'defeat' | 'timeout'

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertRuns(runs: unknown): asserts runs is number {
  if (typeof runs !== 'number' || !Number.isInteger(runs) || runs < 1) {
    throw new Error(`runs must be an integer of at least 1, received ${describeValue(runs)}`)
  }
  if (runs > MAX_BATCH_RUNS) {
    throw new Error(`runs must be an integer of at most ${MAX_BATCH_RUNS}, received ${runs}`)
  }
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('cannot average an empty sample')
  let sum = 0
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`sample value must be a finite number, received ${describeValue(value)}`)
    }
    sum += value
  }
  return sum / values.length
}

/** Inclusive linear percentile. `sorted` must be ascending and non-empty. */
function percentile(sorted: readonly number[], p: number): number {
  const count = sorted.length
  const first = sorted[0]
  if (count === 0 || first === undefined) throw new Error('duration sample is empty')
  if (count === 1) return first
  const rank = (p / 100) * (count - 1)
  const lowIndex = Math.floor(rank)
  const highIndex = Math.ceil(rank)
  const low = sorted[lowIndex]
  const high = sorted[highIndex]
  if (low === undefined || high === undefined) {
    throw new Error(`percentile ${p} is outside the duration sample`)
  }
  if (lowIndex === highIndex) return low
  return low + (high - low) * (rank - lowIndex)
}

function encounterDurationMs(state: CombatState): number {
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event !== undefined && event.type === 'encounterEnd') return event.timeMs
  }
  throw new Error(`combat ended without an encounter log, outcome ${describeValue(state.outcome)}`)
}

function heroHpLostPercent(state: CombatState): number {
  const maxHp = state.hero.maxHp
  const hp = state.hero.hp
  if (typeof maxHp !== 'number' || !Number.isFinite(maxHp) || maxHp <= 0) {
    throw new Error(`hero max HP must be greater than 0, received ${describeValue(maxHp)}`)
  }
  if (typeof hp !== 'number' || !Number.isFinite(hp)) {
    throw new Error(`hero HP must be a finite number, received ${describeValue(hp)}`)
  }
  return ((maxHp - hp) / maxHp) * 100
}

function awardedXp(state: CombatState): number {
  if (state.outcome !== 'victory') return 0
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event !== undefined && event.type === 'encounterXp') {
      if (typeof event.amount !== 'number' || !Number.isFinite(event.amount) || event.amount < 0) {
        throw new Error(`awarded XP must be at least 0, received ${describeValue(event.amount)}`)
      }
      return event.amount
    }
  }
  throw new Error('victory ended without an XP award')
}

/** XP per simulated hour for one fight. A defeat or timeout is 0. */
export function xpRateForRun(outcome: FightOutcome, awarded: number, durationMs: number): number {
  if (outcome !== 'victory') return 0
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`fight duration must be greater than 0, received ${describeValue(durationMs)}`)
  }
  if (typeof awarded !== 'number' || !Number.isFinite(awarded) || awarded < 0) {
    throw new Error(`awarded XP must be at least 0, received ${describeValue(awarded)}`)
  }
  return (awarded * MS_PER_SIMULATED_HOUR) / durationMs
}

export function averageXpPerSimulatedHour(
  runs: readonly { outcome: FightOutcome; xp: number; durationMs: number }[],
): number {
  return mean(runs.map((run) => xpRateForRun(run.outcome, run.xp, run.durationMs)))
}

/**
 * Deserter rows use the victory duration and victory attrition targets.
 * Warden rows use the victory duration target, and fail when nobody wins.
 * Every other encounter is `n/a`.
 */
export function referenceRowFlag(
  encounter: string,
  victoryCount: number,
  victoryDurationP50Ms: number | null,
  victoryMeanHpAttritionPercent: number | null,
): MatrixFlag {
  if (encounter === 'deserter') {
    if (
      victoryCount < 1 ||
      victoryDurationP50Ms === null ||
      victoryMeanHpAttritionPercent === null ||
      victoryDurationP50Ms < STANDARD_DURATION_MIN_MS ||
      victoryDurationP50Ms > STANDARD_DURATION_MAX_MS ||
      victoryMeanHpAttritionPercent < STANDARD_ATTRITION_MIN_PERCENT ||
      victoryMeanHpAttritionPercent > STANDARD_ATTRITION_MAX_PERCENT
    ) {
      return 'fail'
    }
    return 'pass'
  }
  if (encounter === 'warden') {
    if (
      victoryCount < 1 ||
      victoryDurationP50Ms === null ||
      victoryDurationP50Ms < WARDEN_DURATION_MIN_MS ||
      victoryDurationP50Ms > WARDEN_DURATION_MAX_MS
    ) {
      return 'fail'
    }
    return 'pass'
  }
  return 'n/a'
}

function defeatCause(event: HeroHpLossEvent): string {
  if (event.type === 'damage') return event.actorName
  if (event.type === 'statusTick') return event.statusName
  if (event.type === 'fieldTick') return `${event.actorName} field`
  return event.skillId
}

function topDefeatCause(causes: readonly string[]): string {
  if (causes.length === 0) return 'n/a'
  const counts = new Map<string, number>()
  for (const cause of causes) counts.set(cause, (counts.get(cause) ?? 0) + 1)
  let best = ''
  let bestCount = -1
  for (const [cause, count] of counts) {
    if (count > bestCount || (count === bestCount && cause.localeCompare(best) < 0)) {
      best = cause
      bestCount = count
    }
  }
  return best
}

function parseReferenceId(scenarioId: string): { classId: string; encounter: string } {
  const match = /^ref-(warrior|assassin|ranger|mage|cleric)-(.+)$/.exec(scenarioId)
  if (match === null) throw new Error(`reference scenario id '${scenarioId}' is not ref-<class>-<encounter>`)
  const classId = match[1]
  const encounter = match[2]
  if (classId === undefined || encounter === undefined || encounter.length === 0) {
    throw new Error(`reference scenario id '${scenarioId}' is not ref-<class>-<encounter>`)
  }
  return { classId, encounter }
}

function finishedOutcome(state: CombatState): FightOutcome {
  if (state.outcome === 'victory' || state.outcome === 'defeat' || state.outcome === 'timeout') {
    return state.outcome
  }
  throw new Error(`combat outcome is unknown, received ${describeValue(state.outcome)}`)
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function csvNumber(value: number | null): string {
  return value === null ? 'n/a' : String(value)
}

/**
 * Run every `ref-` scenario `runs` times.
 * Run `i` uses `deriveSeed(baseSeed, i)`, matching `runBatch`.
 * Duration percentiles and mean HP attrition are victories only.
 * Q12 stacking pressure is not applied. A fight still stops at 10 simulated minutes and counts as timeout.
 * This function does not print.
 */
export function runReferenceMatrix(baseSeed: number, runs: number): MatrixReport {
  assertRuns(runs)
  const scenarioIds = referenceScenarioIds()
  const defs = gameDefs()
  const rows: MatrixRow[] = []

  for (const scenarioId of scenarioIds) {
    const { classId, encounter } = parseReferenceId(scenarioId)
    const setup = setupForScenario(scenarioId)
    const victoryDurations: number[] = []
    const victoryHpLost: number[] = []
    const xpRates: number[] = []
    const causes: string[] = []
    let wins = 0
    let timeouts = 0

    for (let index = 0; index < runs; index += 1) {
      const seed = deriveSeed(baseSeed, index)
      const state = runCombat(createCombat(setup, defs, seed), defs, HARNESS_LIMIT_MS)
      const outcome = finishedOutcome(state)
      const durationMs = encounterDurationMs(state)
      if (outcome === 'victory') {
        wins += 1
        victoryDurations.push(durationMs)
        victoryHpLost.push(heroHpLostPercent(state))
      } else if (outcome === 'timeout') {
        timeouts += 1
      } else {
        const summary = summarizeDefeat(state)
        const last = summary.hpLoss[summary.hpLoss.length - 1]
        causes.push(last === undefined ? 'unknown' : defeatCause(last))
      }
      xpRates.push(xpRateForRun(outcome, awardedXp(state), durationMs))
    }

    const victoryCount = victoryDurations.length
    const sorted = victoryDurations.slice().sort((left, right) => left - right)
    const victoryDurationP10Ms = victoryCount === 0 ? null : percentile(sorted, 10)
    const victoryDurationP50Ms = victoryCount === 0 ? null : percentile(sorted, 50)
    const victoryDurationP90Ms = victoryCount === 0 ? null : percentile(sorted, 90)
    const victoryMeanHpAttritionPercent = victoryCount === 0 ? null : mean(victoryHpLost)
    rows.push({
      classId,
      encounter,
      scenarioId,
      runs,
      wins,
      winPercent: (wins / runs) * 100,
      victoryDurationP10Ms,
      victoryDurationP50Ms,
      victoryDurationP90Ms,
      victoryMeanHpAttritionPercent,
      timeouts,
      topDefeatCause: topDefeatCause(causes),
      xpPerSimulatedHour: mean(xpRates),
      flag: referenceRowFlag(encounter, victoryCount, victoryDurationP50Ms, victoryMeanHpAttritionPercent),
    })
  }

  return { matrixId: 'reference', baseSeed, runs, rows }
}

/** CSV text for the class × encounter table, including the trailing newline. */
export function formatMatrixCsv(report: MatrixReport): string {
  const lines = [CSV_HEADER]
  for (const row of report.rows) {
    lines.push(
      [
        csvCell(row.classId),
        csvCell(row.encounter),
        csvCell(row.winPercent),
        csvNumber(row.victoryDurationP10Ms),
        csvNumber(row.victoryDurationP50Ms),
        csvNumber(row.victoryDurationP90Ms),
        csvNumber(row.victoryMeanHpAttritionPercent),
        csvCell(row.timeouts),
        csvCell(row.topDefeatCause),
        csvCell(row.xpPerSimulatedHour),
        csvCell(row.flag),
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}
