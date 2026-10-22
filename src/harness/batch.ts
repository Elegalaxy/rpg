import { gameDefs, scenarios, setupForScenario } from '../content/scenarios.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatState } from '../sim/types.ts'

/** The harness stops a fight after 10 simulated minutes and reports timeout. */
export const HARNESS_LIMIT_MS = 10 * 60 * 1000

/** Largest run count whose 0-based index still fits in a signed 32-bit seed. */
export const MAX_BATCH_RUNS = 2147483648

const SEED_MIN = -2147483648
const SEED_MAX = 2147483647

export type BatchSummary = {
  scenarioId: string
  baseSeed: number
  runs: number
  winRate: number
  durationMeanMs: number
  durationP10Ms: number
  durationP50Ms: number
  durationP90Ms: number
  meanHeroHpLostPercent: number
  timeouts: number
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

export function scenarioIds(): string[] {
  return Object.keys(scenarios).sort()
}

function assertScenarioId(scenarioId: unknown): asserts scenarioId is string {
  const ids = scenarioIds()
  const known = typeof scenarioId === 'string' && ids.includes(scenarioId)
  if (known) return
  const label = typeof scenarioId === 'string' ? `'${scenarioId}'` : describeValue(scenarioId)
  throw new Error(`unknown scenario ${label}; valid scenarios: ${ids.join(', ')}`)
}

function assertBaseSeed(seed: unknown): asserts seed is number {
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    throw new Error(
      `seed must be an integer from ${SEED_MIN} through ${SEED_MAX}, received ${describeValue(seed)}`,
    )
  }
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

export function runScenario(scenarioId: string, seed: number): CombatState {
  assertScenarioId(scenarioId)
  assertBaseSeed(seed)
  const defs = gameDefs()
  const state = createCombat(setupForScenario(scenarioId), defs, seed)
  return runCombat(state, defs, HARNESS_LIMIT_MS)
}

/**
 * Run `runs` fights. Run `i` uses `deriveSeed(baseSeed, i)` for `i` from 0 through `runs - 1`.
 * This function does not print.
 */
export function runBatch(scenarioId: string, baseSeed: number, runs: number): BatchSummary {
  assertScenarioId(scenarioId)
  assertBaseSeed(baseSeed)
  assertRuns(runs)
  const setup = setupForScenario(scenarioId)
  const defs = gameDefs()
  const durations: number[] = []
  const hpLost: number[] = []
  let wins = 0
  let timeouts = 0

  for (let index = 0; index < runs; index += 1) {
    const seed = deriveSeed(baseSeed, index)
    const state = runCombat(createCombat(setup, defs, seed), defs, HARNESS_LIMIT_MS)
    if (state.outcome !== 'victory' && state.outcome !== 'defeat' && state.outcome !== 'timeout') {
      throw new Error(`combat outcome is unknown, received ${describeValue(state.outcome)}`)
    }
    if (state.outcome === 'victory') wins += 1
    if (state.outcome === 'timeout') timeouts += 1
    durations.push(encounterDurationMs(state))
    hpLost.push(heroHpLostPercent(state))
  }

  const sortedDurations = durations.slice().sort((left, right) => left - right)
  return {
    scenarioId,
    baseSeed,
    runs,
    winRate: wins / runs,
    durationMeanMs: mean(durations),
    durationP10Ms: percentile(sortedDurations, 10),
    durationP50Ms: percentile(sortedDurations, 50),
    durationP90Ms: percentile(sortedDurations, 90),
    meanHeroHpLostPercent: mean(hpLost),
    timeouts,
  }
}
