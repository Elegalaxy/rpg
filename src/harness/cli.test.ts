import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { STEP_MS } from '../sim/constants.ts'
import { formatEvent } from '../sim/log.ts'
import type { CombatState } from '../sim/types.ts'

import { runBatch, runScenario, type BatchSummary } from './batch.ts'

const RPG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TSX_CLI = resolve(RPG_ROOT, 'node_modules/tsx/dist/cli.mjs')

function normalize(text: string): string {
  return text.replaceAll('\r\n', '\n')
}

function runCli(args: readonly string[]) {
  console.log('[sim] cli input', args)
  const result = spawnSync(process.execPath, [TSX_CLI, 'src/harness/cli.ts', ...args], {
    cwd: RPG_ROOT,
    encoding: 'utf8',
  })
  const stdout = normalize(result.stdout ?? '')
  const stderr = normalize(result.stderr ?? '')
  const lines = stdout.split('\n')
  console.log('[sim] cli status', result.status)
  console.log('[sim] cli stderr', stderr)
  console.log('[sim] cli stdout head', lines.slice(0, 4))
  console.log('[sim] cli stdout tail', lines.slice(-4))
  return { status: result.status, stdout, stderr }
}

function outcomeLine(state: CombatState): string {
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event !== undefined && event.type === 'encounterEnd') {
      return `[sim] outcome ${state.outcome} durationMs ${event.timeMs}`
    }
  }
  throw new Error(`combat ended without an encounter log, outcome ${state.outcome}`)
}

function summaryLines(summary: BatchSummary): string[] {
  return [
    `[sim] scenario ${summary.scenarioId} seed ${summary.baseSeed} runs ${summary.runs} STEP_MS ${STEP_MS}`,
    `[sim] winRate ${summary.winRate}`,
    `[sim] durationMeanMs ${summary.durationMeanMs}`,
    `[sim] durationP10Ms ${summary.durationP10Ms}`,
    `[sim] durationP50Ms ${summary.durationP50Ms}`,
    `[sim] durationP90Ms ${summary.durationP90Ms}`,
    `[sim] meanHeroHpLostPercent ${summary.meanHeroHpLostPercent}`,
    `[sim] timeouts ${summary.timeouts}`,
  ]
}

function withoutTiming(stdout: string): string {
  const lines = stdout.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  const timing = lines.filter((line) => line.includes('runs/sec'))
  expect(timing).toHaveLength(1)
  expect(timing[0]).toMatch(/^\[sim\] (?:\d+\.\d{2}|Infinity) runs\/sec$/)
  expect(lines[lines.length - 1]).toBe(timing[0])
  return lines.slice(0, -1).join('\n')
}

describe('harness CLI', () => {
  it('prints one duel-basic seed 42 fight twice, with no timing line', () => {
    const state = runScenario('duel-basic', 42)
    const expected = [
      `[sim] scenario duel-basic seed 42 STEP_MS ${STEP_MS}`,
      ...state.log.map((event) => formatEvent(event)),
      outcomeLine(state),
    ].join('\n')
    console.log('[sim] single expected tail', expected.split('\n').slice(-3))
    const first = runCli(['--scenario', 'duel-basic', '--seed', '42'])
    const second = runCli(['--scenario', 'duel-basic', '--seed', '42'])
    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(first.stderr).toBe('')
    expect(second.stderr).toBe('')
    expect(first.stdout.trimEnd()).toBe(expected)
    expect(second.stdout).toBe(first.stdout)
    expect(first.stdout).not.toContain('runs/sec')
    expect(first.stdout).toContain('[sim] outcome victory durationMs 20688')
    expect(state.outcome).toBe('victory')
  })

  it('prints a 20-run summary and one runs/sec line, stable apart from timing', () => {
    const summary = runBatch('duel-basic', 42, 20)
    console.log('[sim] batch summary', summary)
    const expected = summaryLines(summary).join('\n')
    const first = runCli(['--scenario', 'duel-basic', '--seed', '42', '--runs', '20'])
    const second = runCli(['--scenario', 'duel-basic', '--seed', '42', '--runs', '20'])
    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(first.stderr).toBe('')
    expect(second.stderr).toBe('')
    expect(withoutTiming(first.stdout)).toBe(expected)
    expect(withoutTiming(second.stdout)).toBe(withoutTiming(first.stdout))
    expect(first.stdout).not.toContain('encounter started')
    expect(second.stdout).not.toContain('basic attacks')
  })

  it('lists scenarios and rejects unknown scenario, a non-integer seed, and runs below 1', () => {
    const list = runCli(['--list'])
    expect(list.status).toBe(0)
    expect(list.stderr).toBe('')
    expect(list.stdout).toBe('[sim] scenarios\ndriving-blow\nduel-basic\npriority-focus\nvenom-edge\n')

    const listValue = runCli(['--list=nope'])
    expect(listValue.status).toBe(1)
    expect(listValue.stderr).toContain('--list does not take a value')

    const unknown = runCli(['--scenario', 'nope', '--seed', '42'])
    expect(unknown.status).toBe(1)
    expect(unknown.stderr).toContain("unknown scenario 'nope'")
    expect(unknown.stderr).toContain('valid scenarios: driving-blow, duel-basic, priority-focus, venom-edge')

    const seed = runCli(['--scenario', 'duel-basic', '--seed', '1.5'])
    expect(seed.status).toBe(1)
    expect(seed.stderr).toContain('seed must be an integer, received "1.5"')

    const runs = runCli(['--scenario', 'duel-basic', '--seed', '42', '--runs', '0'])
    expect(runs.status).toBe(1)
    expect(runs.stderr).toContain('runs must be an integer of at least 1, received "0"')

    const negativeRuns = runCli(['--scenario', 'duel-basic', '--seed', '42', '--runs', '-1'])
    expect(negativeRuns.status).toBe(1)
    expect(negativeRuns.stderr).toContain('runs must be an integer of at least 1, received "-1"')
  })
})
