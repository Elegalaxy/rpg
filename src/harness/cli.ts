import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

import { formatEvent } from '../sim/log.ts'
import { STEP_MS } from '../sim/constants.ts'
import type { CombatState } from '../sim/types.ts'

import { MAX_BATCH_RUNS, runBatch, runScenario, scenarioIds, type BatchSummary } from './batch.ts'
import { formatMatrixCsv, runReferenceMatrix } from './report.ts'

const RPG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const REFERENCE_CSV_PATH = resolve(RPG_ROOT, 'reports', '2026-10-23-reference.csv')

const SEED_MIN = -2147483648
const SEED_MAX = 2147483647

class CliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliError'
  }
}

type ParsedArgs = {
  list: boolean
  scenario?: string
  seed?: string
  runs?: string
  matrix?: string
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = { list: false }
  const seen = new Set<string>()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined || token.length === 0) {
      throw new CliError('missing argument')
    }
    if (!token.startsWith('--')) {
      throw new CliError(`unknown argument ${JSON.stringify(token)}`)
    }
    let name = token
    let inline: string | undefined
    const eq = token.indexOf('=')
    if (eq !== -1) {
      name = token.slice(0, eq)
      inline = token.slice(eq + 1)
    }
    if (seen.has(name)) throw new CliError(`duplicate flag ${name}`)
    seen.add(name)
    if (name === '--list') {
      if (inline !== undefined) throw new CliError('--list does not take a value')
      parsed.list = true
      continue
    }
    if (name !== '--scenario' && name !== '--seed' && name !== '--runs' && name !== '--matrix') {
      throw new CliError(`unknown argument ${JSON.stringify(token)}`)
    }
    let value = inline
    if (value === undefined) {
      const next = argv[index + 1]
      if (next === undefined || next.startsWith('--')) {
        throw new CliError(`${name} requires a value`)
      }
      value = next
      index += 1
    }
    if (value.length === 0) throw new CliError(`${name} requires a value`)
    if (name === '--scenario') parsed.scenario = value
    else if (name === '--seed') parsed.seed = value
    else if (name === '--runs') parsed.runs = value
    else parsed.matrix = value
  }
  return parsed
}

function parseSeed(token: string): number {
  if (!/^[+-]?\d+$/.test(token)) {
    throw new CliError(`seed must be an integer, received ${JSON.stringify(token)}`)
  }
  const seed = Number(token)
  if (!Number.isSafeInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    throw new CliError(
      `seed must be an integer from ${SEED_MIN} through ${SEED_MAX}, received ${JSON.stringify(token)}`,
    )
  }
  return seed
}

function parseRuns(token: string): number {
  if (!/^[+-]?\d+$/.test(token)) {
    throw new CliError(`runs must be an integer of at least 1, received ${JSON.stringify(token)}`)
  }
  const runs = Number(token)
  if (!Number.isSafeInteger(runs) || runs < 1) {
    throw new CliError(`runs must be an integer of at least 1, received ${JSON.stringify(token)}`)
  }
  if (runs > MAX_BATCH_RUNS) {
    throw new CliError(`runs must be an integer of at most ${MAX_BATCH_RUNS}, received ${runs}`)
  }
  return runs
}

function formatOutcome(state: CombatState): string {
  let durationMs: number | undefined
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event !== undefined && event.type === 'encounterEnd') {
      durationMs = event.timeMs
      break
    }
  }
  if (durationMs === undefined) {
    throw new Error(`combat ended without an encounter log, outcome ${state.outcome}`)
  }
  if (state.outcome === 'ongoing') throw new Error('combat is still ongoing')
  return `[sim] outcome ${state.outcome} durationMs ${durationMs}`
}

function printSingle(scenarioId: string, seed: number): void {
  console.log(`[sim] scenario ${scenarioId} seed ${seed} STEP_MS ${STEP_MS}`)
  const state = runScenario(scenarioId, seed)
  for (const event of state.log) console.log(formatEvent(event))
  console.log(formatOutcome(state))
}

function printSummary(summary: BatchSummary): void {
  console.log(
    `[sim] scenario ${summary.scenarioId} seed ${summary.baseSeed} runs ${summary.runs} STEP_MS ${STEP_MS}`,
  )
  console.log(`[sim] winRate ${summary.winRate}`)
  console.log(`[sim] durationMeanMs ${summary.durationMeanMs}`)
  console.log(`[sim] durationP10Ms ${summary.durationP10Ms}`)
  console.log(`[sim] durationP50Ms ${summary.durationP50Ms}`)
  console.log(`[sim] durationP90Ms ${summary.durationP90Ms}`)
  console.log(`[sim] meanHeroHpLostPercent ${summary.meanHeroHpLostPercent}`)
  console.log(`[sim] timeouts ${summary.timeouts}`)
}

function printTiming(runs: number, elapsedMs: number): void {
  const seconds = elapsedMs / 1000
  const rate = seconds === 0 ? Number.POSITIVE_INFINITY : runs / seconds
  console.log(`[sim] ${rate.toFixed(2)} runs/sec`)
}

function validScenarios(): string {
  return scenarioIds().join(', ')
}

function writeReferenceCsv(csv: string): void {
  mkdirSync(dirname(REFERENCE_CSV_PATH), { recursive: true })
  writeFileSync(REFERENCE_CSV_PATH, csv, 'utf8')
}

function printMatrix(args: ParsedArgs): void {
  if (args.matrix !== 'reference') {
    throw new CliError(`unknown matrix '${args.matrix ?? ''}'\nvalid matrices: reference`)
  }
  if (args.seed === undefined) throw new CliError('missing --seed')
  if (args.runs === undefined) throw new CliError('matrix requires --runs')
  const seed = parseSeed(args.seed)
  const runs = parseRuns(args.runs)
  console.log(
    `[sim] matrix ${args.matrix} seed ${seed} runs ${runs} report reports/2026-10-23-reference.csv`,
  )
  const started = performance.now()
  const report = runReferenceMatrix(seed, runs)
  const elapsedMs = performance.now() - started
  const csv = formatMatrixCsv(report)
  writeReferenceCsv(csv)
  process.stdout.write(csv)
  printTiming(report.rows.length * runs, elapsedMs)
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.list) {
    console.log('[sim] scenarios')
    for (const id of scenarioIds()) console.log(id)
    return
  }
  if (args.matrix !== undefined && args.scenario !== undefined) {
    throw new CliError('choose either --matrix or --scenario')
  }
  if (args.matrix !== undefined) {
    printMatrix(args)
    return
  }
  if (args.scenario === undefined) {
    throw new CliError(`missing --scenario\nvalid scenarios: ${validScenarios()}`)
  }
  if (!scenarioIds().includes(args.scenario)) {
    throw new CliError(`unknown scenario '${args.scenario}'\nvalid scenarios: ${validScenarios()}`)
  }
  if (args.seed === undefined) {
    throw new CliError('missing --seed')
  }
  const seed = parseSeed(args.seed)
  if (args.runs === undefined) {
    printSingle(args.scenario, seed)
    return
  }
  const runs = parseRuns(args.runs)
  const started = performance.now()
  const summary = runBatch(args.scenario, seed, runs)
  const elapsedMs = performance.now() - started
  printSummary(summary)
  printTiming(runs, elapsedMs)
}

try {
  main()
} catch (error) {
  if (error instanceof CliError) {
    console.error(error.message)
    process.exitCode = 1
  } else {
    throw error
  }
}
