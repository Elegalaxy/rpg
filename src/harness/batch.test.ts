import { describe, expect, it, vi } from 'vitest'

import { gameDefs, setupForScenario } from '../content/scenarios.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatState } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, runBatch, scenarioIds, type BatchSummary } from './batch.ts'

function encounterDurationMs(state: CombatState): number {
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event !== undefined && event.type === 'encounterEnd') return event.timeMs
  }
  throw new Error(`combat ended without an encounter log, outcome ${state.outcome}`)
}

function heroHpLostPercent(state: CombatState): number {
  return ((state.hero.maxHp - state.hero.hp) / state.hero.maxHp) * 100
}

/** Inclusive linear percentile, matching a non-empty ascending sample. */
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
  if (low === undefined || high === undefined) throw new Error(`percentile ${p} is outside the sample`)
  if (lowIndex === highIndex) return low
  return low + (high - low) * (rank - lowIndex)
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function summaryFromDerivedSeeds(scenarioId: string, baseSeed: number, runs: number): BatchSummary {
  const setup = setupForScenario(scenarioId)
  const defs = gameDefs()
  const durations: number[] = []
  const hpLost: number[] = []
  let wins = 0
  let timeouts = 0
  const seeds: number[] = []
  for (let index = 0; index < runs; index += 1) {
    const seed = deriveSeed(baseSeed, index)
    seeds.push(seed)
    const state = runCombat(createCombat(setup, defs, seed), defs, HARNESS_LIMIT_MS)
    if (state.outcome === 'victory') wins += 1
    if (state.outcome === 'timeout') timeouts += 1
    durations.push(encounterDurationMs(state))
    hpLost.push(heroHpLostPercent(state))
  }
  console.log('[sim] derived seeds', { baseSeed, runs, seeds })
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

describe('runBatch', () => {
  it('returns the same summary for two identical 20-run batches', () => {
    const input = { scenarioId: 'duel-basic', baseSeed: 42, runs: 20 }
    console.log('[sim] batch input', input)
    const first = runBatch(input.scenarioId, input.baseSeed, input.runs)
    const second = runBatch(input.scenarioId, input.baseSeed, input.runs)
    console.log('[sim] batch output', first)
    console.log('[sim] batch repeat equal', JSON.stringify(first) === JSON.stringify(second))
    expect(second).toEqual(first)
    expect(first.scenarioId).toBe('duel-basic')
    expect(first.baseSeed).toBe(42)
    expect(first.runs).toBe(20)
    expect(first.timeouts).toBeGreaterThanOrEqual(0)
    expect(first.timeouts).toBeLessThanOrEqual(20)
    expect(first.winRate).toBeGreaterThanOrEqual(0)
    expect(first.winRate).toBeLessThanOrEqual(1)
    expect(Number.isFinite(first.durationMeanMs)).toBe(true)
    expect(Number.isFinite(first.durationP10Ms)).toBe(true)
    expect(Number.isFinite(first.durationP50Ms)).toBe(true)
    expect(Number.isFinite(first.durationP90Ms)).toBe(true)
    expect(Number.isFinite(first.meanHeroHpLostPercent)).toBe(true)
    expect(first.durationP10Ms).toBeLessThanOrEqual(first.durationP50Ms)
    expect(first.durationP50Ms).toBeLessThanOrEqual(first.durationP90Ms)
  })

  it('uses deriveSeed(base, i) from 0 and does not print', () => {
    const input = { scenarioId: 'duel-basic', baseSeed: 42, runs: 20 }
    const prints: string[] = []
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const
    const spies = methods.map((name) =>
      vi.spyOn(console, name).mockImplementation((...args: unknown[]) => {
        prints.push(`${name}:${args.map((arg) => String(arg)).join(' ')}`)
      }),
    )
    let summary: BatchSummary | undefined
    try {
      summary = runBatch(input.scenarioId, input.baseSeed, input.runs)
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
    console.log('[sim] runBatch prints', prints)
    console.log('[sim] deriveSeed summary', summary)
    expect(prints).toEqual([])
    expect(summary).toEqual(summaryFromDerivedSeeds(input.scenarioId, input.baseSeed, input.runs))

    const seed0 = deriveSeed(input.baseSeed, 0)
    const seed1 = deriveSeed(input.baseSeed, 1)
    const firstOnly = runBatch(input.scenarioId, input.baseSeed, 1)
    const index0 = summaryFromDerivedSeeds(input.scenarioId, input.baseSeed, 1)
    const index1Fight = runCombat(
      createCombat(setupForScenario(input.scenarioId), gameDefs(), seed1),
      gameDefs(),
      HARNESS_LIMIT_MS,
    )
    console.log('[sim] first index', {
      seed0,
      seed1,
      firstOnly,
      index0,
      index1DurationMs: encounterDurationMs(index1Fight),
      index1HpLost: heroHpLostPercent(index1Fight),
    })
    expect(seed0).not.toBe(seed1)
    expect(firstOnly).toEqual(index0)
    expect(firstOnly.durationMeanMs).toBe(encounterDurationMs(
      runCombat(
        createCombat(setupForScenario(input.scenarioId), gameDefs(), seed0),
        gameDefs(),
        HARNESS_LIMIT_MS,
      ),
    ))
    const index1Same =
      firstOnly.durationMeanMs === encounterDurationMs(index1Fight) &&
      firstOnly.meanHeroHpLostPercent === heroHpLostPercent(index1Fight) &&
      firstOnly.winRate === (index1Fight.outcome === 'victory' ? 1 : 0) &&
      firstOnly.timeouts === (index1Fight.outcome === 'timeout' ? 1 : 0)
    expect(index1Same).toBe(false)
  })

  it('rejects an unknown scenario, a non-integer seed, and runs below 1', () => {
    const cases: { label: string; run: () => void; pattern: RegExp }[] = [
      {
        label: 'unknown scenario',
        run: () => runBatch('nope', 1, 1),
        pattern: new RegExp(
          `unknown scenario 'nope'; valid scenarios: ${scenarioIds().join(', ')}`,
        ),
      },
      {
        label: 'non-integer seed',
        run: () => runBatch('duel-basic', 1.5, 1),
        pattern: /seed must be an integer from -2147483648 through 2147483647, received 1\.5/,
      },
      {
        label: 'runs below 1',
        run: () => runBatch('duel-basic', 42, 0),
        pattern: /runs must be an integer of at least 1, received 0/,
      },
      {
        label: 'negative runs',
        run: () => runBatch('duel-basic', 42, -3),
        pattern: /runs must be an integer of at least 1, received -3/,
      },
      {
        label: 'non-integer runs',
        run: () => runBatch('duel-basic', 42, 1.5),
        pattern: /runs must be an integer of at least 1, received 1\.5/,
      },
    ]
    for (const entry of cases) {
      let message = ''
      try {
        entry.run()
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      console.log('[sim] rejected', { label: entry.label, message })
      expect(message).toMatch(entry.pattern)
    }
  })
})
