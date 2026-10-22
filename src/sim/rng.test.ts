import { describe, expect, it } from 'vitest'

import {
  type RngState,
  centeredRoll,
  chance,
  createRng,
  deriveSeed,
  nextFloat,
  uniform,
} from './rng.ts'

const SAMPLE = 1_000
const DISTRIBUTION = 100_000
const SEEDS = [0, 1, 2, 42, -1, -2147483648, 2147483647] as const

function take(state: RngState, count: number): number[] {
  const values: number[] = []
  for (let i = 0; i < count; i += 1) values.push(nextFloat(state))
  return values
}

function sampleStats(
  values: readonly number[],
  inRange: (value: number) => boolean,
): { mean: number; low: number; high: number; outside: number } {
  if (values.length === 0) throw new Error('[rng] empty sample')
  let sum = 0
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  let outside = 0
  for (const value of values) {
    sum += value
    if (value < low) low = value
    if (value > high) high = value
    if (!inRange(value)) outside += 1
  }
  return { mean: sum / values.length, low, high, outside }
}

function expectUint32State(state: RngState): void {
  for (const key of ['a', 'b', 'c', 'd'] as const) {
    const value = state[key]
    expect(Number.isInteger(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(0xffffffff)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function roundTrip(state: RngState): RngState {
  const json = JSON.stringify(state)
  const parsed: unknown = JSON.parse(json)
  console.log('[rng] json round-trip', { json, parsed })
  if (!isRecord(parsed)) throw new Error('[rng] round-trip did not produce an object')
  const keys = Object.keys(parsed).sort()
  if (keys.join(',') !== 'a,b,c,d') {
    throw new Error(`[rng] round-trip keys were ${keys.join(',')}`)
  }
  const { a, b, c, d } = parsed
  if (typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number' || typeof d !== 'number') {
    throw new Error('[rng] round-trip fields were not numbers')
  }
  return { a, b, c, d }
}

function expectRejected(label: string, received: string, run: () => void): void {
  const expected = `${label} must be an integer from -2147483648 through 2147483647, received ${received}`
  let thrown: unknown
  try {
    run()
  } catch (error) {
    thrown = error
  }
  console.log('[rng] invalid seed', {
    label,
    received,
    message: thrown instanceof Error ? thrown.message : thrown,
  })
  if (!(thrown instanceof Error)) throw new Error('[rng] invalid seed did not throw an Error')
  expect(thrown.message).toBe(expected)
}

describe('seeded rng', () => {
  it('repeats the first 1000 nextFloat values for the same seed', () => {
    for (const seed of SEEDS) {
      const state = createRng(seed)
      console.log('[rng] createRng', { seed, state: { ...state } })
      expectUint32State(state)

      const left = createRng(seed)
      const right = createRng(seed)
      const leftFirst = nextFloat(left)
      const rightFirst = nextFloat(right)
      console.log('[rng] interleaved draws', { seed, leftFirst, rightFirst })
      expect(leftFirst).toBe(rightFirst)

      const first = take(createRng(seed), SAMPLE)
      const second = take(createRng(seed), SAMPLE)
      const stats = sampleStats(first, (value) => value >= 0 && value < 1)
      console.log('[rng] same seed', {
        seed,
        count: SAMPLE,
        samples: first.slice(0, 5),
        mean: stats.mean,
      })
      expect(second).toEqual(first)
    }
  })

  it('continues the identical sequence after a JSON round-trip', () => {
    const seed = 42
    const prefixCount = 100
    const live = createRng(seed)
    const prefix = take(live, prefixCount)
    const resumed = roundTrip(live)
    const continued = take(live, SAMPLE)
    const restored = take(resumed, SAMPLE)
    const uninterrupted = take(createRng(seed), prefixCount + SAMPLE)
    console.log('[rng] resumed sequence', {
      seed,
      prefixCount,
      prefixSamples: prefix.slice(0, 3),
      continued: continued[0],
      restored: restored[0],
      mean: sampleStats(restored, () => true).mean,
    })
    expect(restored).toEqual(continued)
    expect(uninterrupted.slice(0, prefixCount)).toEqual(prefix)
    expect(uninterrupted.slice(prefixCount)).toEqual(restored)
  })

  it('produces different sequences for different seeds', () => {
    const sequences = SEEDS.map((seed) => {
      const values = take(createRng(seed), SAMPLE)
      console.log('[rng] seed differs', { seed, first: values[0], second: values[1] })
      return values
    })
    for (let i = 0; i < sequences.length; i += 1) {
      for (let j = i + 1; j < sequences.length; j += 1) {
        expect(sequences[i]).not.toEqual(sequences[j])
      }
    }
  })

  it('keeps 100000 nextFloat values in [0, 1) with a mean from 0.49 to 0.51', () => {
    const seed = 42
    const values = take(createRng(seed), DISTRIBUTION)
    const stats = sampleStats(values, (value) => value >= 0 && value < 1)
    console.log('[rng] nextFloat distribution', {
      seed,
      count: values.length,
      samples: values.slice(0, 5),
      mean: stats.mean,
      low: stats.low,
      high: stats.high,
      outside: stats.outside,
    })
    expect(stats.outside).toBe(0)
    expect(stats.low).toBeGreaterThanOrEqual(0)
    expect(stats.high).toBeLessThan(1)
    expect(stats.mean).toBeGreaterThanOrEqual(0.49)
    expect(stats.mean).toBeLessThanOrEqual(0.51)
  })

  it('keeps centeredRoll(0.6, 1) in range with a mean near 0.8', () => {
    const seed = 42
    const min = 0.6
    const max = 1
    const composed = createRng(seed)
    const direct = createRng(seed)
    const rolled = centeredRoll(composed, min, max)
    const average = (uniform(direct, min, max) + uniform(direct, min, max)) / 2
    console.log('[rng] centeredRoll composition', { seed, min, max, rolled, average })
    expect(rolled).toBe(average)
    expect(composed).toEqual(direct)

    const state = createRng(seed)
    const values: number[] = []
    for (let i = 0; i < DISTRIBUTION; i += 1) values.push(centeredRoll(state, min, max))
    const stats = sampleStats(values, (value) => value >= min && value <= max)
    console.log('[rng] centeredRoll distribution', {
      seed,
      min,
      max,
      count: values.length,
      samples: values.slice(0, 5),
      mean: stats.mean,
      low: stats.low,
      high: stats.high,
      outside: stats.outside,
    })
    expect(stats.outside).toBe(0)
    expect(stats.mean).toBeGreaterThanOrEqual(0.79)
    expect(stats.mean).toBeLessThanOrEqual(0.81)
  })

  it('rejects seeds that are not signed 32-bit integers', () => {
    const invalid: { seed: unknown; received: string }[] = [
      { seed: 1.5, received: '1.5' },
      { seed: Number.NaN, received: 'NaN' },
      { seed: Number.POSITIVE_INFINITY, received: 'Infinity' },
      { seed: Number.NEGATIVE_INFINITY, received: '-Infinity' },
      { seed: 2147483648, received: '2147483648' },
      { seed: -2147483649, received: '-2147483649' },
      { seed: '42', received: '"42"' },
      { seed: null, received: 'null' },
      { seed: undefined, received: 'undefined' },
      { seed: true, received: 'true' },
    ]
    for (const entry of invalid) {
      expectRejected('seed', entry.received, () => {
        createRng(entry.seed as number)
      })
    }
    expectRejected('base seed', '1.5', () => {
      deriveSeed(1.5, 0)
    })
    expectRejected('seed index', 'NaN', () => {
      deriveSeed(1, Number.NaN)
    })
    expectRejected('seed index', '"3"', () => {
      deriveSeed(1, '3' as never)
    })
  })

  it('maps chance and uniform onto nextFloat without hidden state', () => {
    const seed = 11
    const floats = createRng(seed)
    const chances = createRng(seed)
    const p = 0.25
    const roll = nextFloat(floats)
    const hit = chance(chances, p)
    console.log('[rng] chance', { seed, p, roll, hit })
    expect(hit).toBe(roll < p)
    expect(chances).toEqual(floats)

    const bounds = createRng(4)
    const mirror = createRng(4)
    const roll0 = nextFloat(mirror)
    const roll1 = nextFloat(mirror)
    const hit0 = chance(bounds, 0)
    const hit1 = chance(bounds, 1)
    console.log('[rng] chance bounds', { seed: 4, roll0, hit0, roll1, hit1 })
    expect(hit0).toBe(false)
    expect(hit1).toBe(true)
    expect(bounds).toEqual(mirror)

    const uniformFloats = createRng(seed)
    const uniformRolls = createRng(seed)
    const min = -2
    const max = 5
    const span = nextFloat(uniformFloats)
    const sample = uniform(uniformRolls, min, max)
    console.log('[rng] uniform', { seed, min, max, span, sample })
    expect(sample).toBeGreaterThanOrEqual(min)
    expect(sample).toBeLessThan(max)
    expect(sample).toBe(min + span * (max - min))
    expect(uniformRolls).toEqual(uniformFloats)

    const state = createRng(8)
    const before = { ...state }
    console.log('[rng] reject roll args', { seed: 8, state: before })
    expect(() => chance(state, Number.NaN)).toThrow('chance p must be a finite number, received NaN')
    expect(() => chance(state, 1.1)).toThrow('chance p must be from 0 through 1, received 1.1')
    expect(() => uniform(state, 1, 0)).toThrow(
      'uniform min must be less than or equal to max, received min=1 max=0',
    )
    expect(() => centeredRoll(state, Number.NaN, 1)).toThrow(
      'uniform min must be a finite number, received NaN',
    )
    expect(state).toEqual(before)
  })

  it('derives a signed 32-bit seed from a base and an index', () => {
    const base = 123456
    const indexes = [0, 1, 2, 99, -4] as const
    const derivedSeeds = indexes.map((index) => {
      const derived = deriveSeed(base, index)
      console.log('[rng] deriveSeed', { base, index, derived })
      expect(Number.isInteger(derived)).toBe(true)
      expect(derived).toBeGreaterThanOrEqual(-2147483648)
      expect(derived).toBeLessThanOrEqual(2147483647)
      expect(deriveSeed(base, index)).toBe(derived)
      const state = createRng(derived)
      console.log('[rng] derived state', { derived, state })
      expectUint32State(state)
      return derived
    })
    expect(new Set(derivedSeeds).size).toBe(derivedSeeds.length)

    const negative = deriveSeed(-2147483648, 1)
    console.log('[rng] deriveSeed boundary', { base: -2147483648, index: 1, derived: negative })
    expect(deriveSeed(-2147483648, 1)).toBe(negative)
    expectUint32State(createRng(negative))
  })
})
