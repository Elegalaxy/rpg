// sfc32 PRNG seeded by splitmix32.
// State is a plain {a, b, c, d} object of unsigned 32-bit integers.
// Each draw advances the object it is given. There is no module-level generator.

export type RngState = {
  a: number
  b: number
  c: number
  d: number
}

const SEED_MIN = -2147483648
const SEED_MAX = 2147483647
const UINT32_MAX = 0xffffffff
const UINT32_MOD = 4294967296
const SPLITMIX_INCREMENT = 0x9e3779b9
const SPLITMIX_MUL_1 = 0x21f0aaad
const SPLITMIX_MUL_2 = 0x735a2d97

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertSeed(seed: unknown, label: string): asserts seed is number {
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    throw new Error(
      `${label} must be an integer from ${SEED_MIN} through ${SEED_MAX}, received ${describeValue(seed)}`,
    )
  }
}

function assertUint32(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new Error(`${label} must be an unsigned 32-bit integer, received ${describeValue(value)}`)
  }
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number, received ${describeValue(value)}`)
  }
}

function assertState(state: RngState): void {
  if (typeof state !== 'object' || state === null) {
    throw new Error(
      `rng state must be an object with a, b, c, and d, received ${describeValue(state)}`,
    )
  }
  assertUint32(state.a, 'rng state a')
  assertUint32(state.b, 'rng state b')
  assertUint32(state.c, 'rng state c')
  assertUint32(state.d, 'rng state d')
}

function splitmix32(state: number): { state: number; value: number } {
  const next = (state + SPLITMIX_INCREMENT) | 0
  let mixed = next ^ (next >>> 16)
  mixed = Math.imul(mixed, SPLITMIX_MUL_1)
  mixed = mixed ^ (mixed >>> 15)
  mixed = Math.imul(mixed, SPLITMIX_MUL_2)
  return { state: next, value: (mixed ^ (mixed >>> 15)) >>> 0 }
}

/** Build RNG state from a signed 32-bit integer seed. */
export function createRng(seed: number): RngState {
  assertSeed(seed, 'seed')
  const first = splitmix32(seed | 0)
  const second = splitmix32(first.state)
  const third = splitmix32(second.state)
  const fourth = splitmix32(third.state)
  return { a: first.value, b: second.value, c: third.value, d: fourth.value }
}

/** Next uniform value in [0, 1). Advances `state`. */
export function nextFloat(state: RngState): number {
  assertState(state)
  let a = state.a | 0
  let b = state.b | 0
  let c = state.c | 0
  let d = state.d | 0

  const t = (((a + b) | 0) + d) | 0
  d = (d + 1) | 0
  a = b ^ (b >>> 9)
  b = (c + (c << 3)) | 0
  c = (c << 21) | (c >>> 11)
  c = (c + t) | 0

  state.a = a >>> 0
  state.b = b >>> 0
  state.c = c >>> 0
  state.d = d >>> 0
  return (t >>> 0) / UINT32_MOD
}

/**
 * True when the next value in [0, 1) is strictly below `p`.
 * `p` must be finite and from 0 through 1. Always draws once for a valid `p`.
 */
export function chance(state: RngState, p: number): boolean {
  assertFiniteNumber(p, 'chance p')
  if (p < 0 || p > 1) {
    throw new Error(`chance p must be from 0 through 1, received ${describeValue(p)}`)
  }
  return nextFloat(state) < p
}

/** Uniform value in [min, max). Always draws once when the bounds are valid. */
export function uniform(state: RngState, min: number, max: number): number {
  assertFiniteNumber(min, 'uniform min')
  assertFiniteNumber(max, 'uniform max')
  if (min > max) {
    throw new Error(
      `uniform min must be less than or equal to max, received min=${describeValue(min)} max=${describeValue(max)}`,
    )
  }
  return min + nextFloat(state) * (max - min)
}

/** Average of two uniform draws in [min, max). Triangular, centered on the midpoint. */
export function centeredRoll(state: RngState, min: number, max: number): number {
  const first = uniform(state, min, max)
  const second = uniform(state, min, max)
  return (first + second) / 2
}

/** Signed 32-bit seed for batch run `index` or encounter `index`, derived from `base`. */
export function deriveSeed(base: number, index: number): number {
  assertSeed(base, 'base seed')
  assertSeed(index, 'seed index')
  const mixed = (Math.imul(base | 0, SPLITMIX_INCREMENT) + (index | 0)) | 0
  return splitmix32(mixed).value | 0
}
