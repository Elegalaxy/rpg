import { describe, expect, it, vi } from 'vitest'

import { referenceScenarioIds } from '../content/scenarios.ts'
import { deriveSeed } from '../sim/rng.ts'

import { runScenario } from './batch.ts'
import {
  averageXpPerSimulatedHour,
  formatMatrixCsv,
  referenceRowFlag,
  runReferenceMatrix,
  xpRateForRun,
  type MatrixReport,
} from './report.ts'

describe('reference report flags and XP', () => {
  it('flags only Deserter and Warden rows, using victory figures', () => {
    console.log('[sim] flag boundaries', {
      deserterPass: referenceRowFlag('deserter', 1, 8_000, 10),
      wardenPass: referenceRowFlag('warden', 1, 60_000, 100),
      other: referenceRowFlag('shardling', 1, 1_000, 100),
    })
    expect(referenceRowFlag('deserter', 1, 8_000, 10)).toBe('pass')
    expect(referenceRowFlag('deserter', 1, 12_000, 20)).toBe('pass')
    expect(referenceRowFlag('deserter', 1, 10_000, 15)).toBe('pass')
    expect(referenceRowFlag('deserter', 1, 7_999, 15)).toBe('fail')
    expect(referenceRowFlag('deserter', 1, 12_001, 15)).toBe('fail')
    expect(referenceRowFlag('deserter', 1, 10_000, 9.999)).toBe('fail')
    expect(referenceRowFlag('deserter', 1, 10_000, 20.001)).toBe('fail')
    expect(referenceRowFlag('deserter', 0, null, null)).toBe('fail')

    expect(referenceRowFlag('warden', 1, 60_000, 100)).toBe('pass')
    expect(referenceRowFlag('warden', 1, 90_000, 0)).toBe('pass')
    expect(referenceRowFlag('warden', 1, 59_999, 15)).toBe('fail')
    expect(referenceRowFlag('warden', 1, 90_001, 15)).toBe('fail')
    expect(referenceRowFlag('warden', 0, null, null)).toBe('fail')

    expect(referenceRowFlag('shardling', 0, null, null)).toBe('n/a')
    expect(referenceRowFlag('road-mixed', 1, 1_000, 100)).toBe('n/a')
    expect(referenceRowFlag('wolf', 1, 100_000, 90)).toBe('n/a')
  })

  it('averages XP per simulated hour and awards 0 on a defeat or timeout', () => {
    const victoryHour = xpRateForRun('victory', 3_600, 3_600_000)
    const halfHour = xpRateForRun('victory', 45, 1_800_000)
    const defeat = xpRateForRun('defeat', 45, 1_800_000)
    const timeout = xpRateForRun('timeout', 45, 600_000)
    const average = averageXpPerSimulatedHour([
      { outcome: 'victory', xp: 45, durationMs: 1_800_000 },
      { outcome: 'defeat', xp: 45, durationMs: 1_800_000 },
    ])
    console.log('[sim] xp rates', { victoryHour, halfHour, defeat, timeout, average })
    expect(victoryHour).toBe(3_600)
    expect(halfHour).toBe(90)
    expect(defeat).toBe(0)
    expect(timeout).toBe(0)
    expect(average).toBe(45)
  })

  it('writes n/a victory cells and quotes a cause that contains a comma', () => {
    const report: MatrixReport = {
      matrixId: 'reference',
      baseSeed: 1,
      runs: 1,
      rows: [
        {
          classId: 'warrior',
          encounter: 'warden',
          scenarioId: 'ref-warrior-warden',
          runs: 1,
          wins: 0,
          winPercent: 0,
          victoryDurationP10Ms: null,
          victoryDurationP50Ms: null,
          victoryDurationP90Ms: null,
          victoryMeanHpAttritionPercent: null,
          timeouts: 1,
          topDefeatCause: 'n/a',
          xpPerSimulatedHour: 0,
          flag: 'fail',
        },
        {
          classId: 'mage',
          encounter: 'deserter',
          scenarioId: 'ref-mage-deserter',
          runs: 2,
          wins: 1,
          winPercent: 50,
          victoryDurationP10Ms: 9_000,
          victoryDurationP50Ms: 9_000,
          victoryDurationP90Ms: 9_000,
          victoryMeanHpAttritionPercent: 12.5,
          timeouts: 0,
          topDefeatCause: 'Bleed, Poison',
          xpPerSimulatedHour: 10,
          flag: 'pass',
        },
      ],
    }
    const csv = formatMatrixCsv(report)
    console.log('[sim] csv sample', csv)
    expect(csv).toBe(
      [
        'class,encounter,winPercent,victoryDurationP10Ms,victoryDurationP50Ms,victoryDurationP90Ms,victoryMeanHpAttritionPercent,timeouts,topDefeatCause,xpPerSimulatedHour,flag',
        'warrior,warden,0,n/a,n/a,n/a,n/a,1,n/a,0,fail',
        'mage,deserter,50,9000,9000,9000,12.5,0,"Bleed, Poison",10,pass',
        '',
      ].join('\n'),
    )
  })
})

describe('runReferenceMatrix', () => {
  it('matches a second one-run matrix and uses deriveSeed index 0', () => {
    const input = { baseSeed: 1, runs: 1 }
    console.log('[sim] matrix input', input)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    let first: MatrixReport | undefined
    let printed = 0
    try {
      first = runReferenceMatrix(input.baseSeed, input.runs)
      printed = logSpy.mock.calls.length
    } finally {
      logSpy.mockRestore()
    }
    if (first === undefined) throw new Error('reference matrix did not return')
    const second = runReferenceMatrix(input.baseSeed, input.runs)
    const ids = referenceScenarioIds()
    const opening = first.rows[0]
    if (opening === undefined) throw new Error('reference matrix has no rows')
    const seeded = runScenario(opening.scenarioId, deriveSeed(input.baseSeed, 0))
    const warden = first.rows.find((row) => row.scenarioId === 'ref-warrior-warden')
    console.log('[sim] matrix sample', {
      rows: first.rows.length,
      opening,
      warden,
      printed,
      equal: JSON.stringify(first) === JSON.stringify(second),
    })

    expect(printed).toBe(0)
    expect(second).toEqual(first)
    expect(first.matrixId).toBe('reference')
    expect(first.baseSeed).toBe(1)
    expect(first.runs).toBe(1)
    expect(first.rows.map((row) => row.scenarioId)).toEqual(ids)
    expect(ids).toHaveLength(75)
    expect(opening.wins).toBe(seeded.outcome === 'victory' ? 1 : 0)
    expect(opening.timeouts).toBe(seeded.outcome === 'timeout' ? 1 : 0)

    for (const row of first.rows) {
      const flagged = referenceRowFlag(
        row.encounter,
        row.wins,
        row.victoryDurationP50Ms,
        row.victoryMeanHpAttritionPercent,
      )
      expect(row.flag).toBe(flagged)
      if (row.encounter !== 'deserter' && row.encounter !== 'warden') expect(row.flag).toBe('n/a')
      if (row.wins === 0) {
        expect(row.xpPerSimulatedHour).toBe(0)
        expect(row.victoryDurationP50Ms).toBeNull()
        expect(row.victoryMeanHpAttritionPercent).toBeNull()
      } else {
        expect(row.xpPerSimulatedHour).toBeGreaterThan(0)
        expect(row.victoryDurationP50Ms).toEqual(expect.any(Number))
      }
      expect(row.winPercent).toBe((row.wins / row.runs) * 100)
    }

    expect(warden).toMatchObject({ wins: 0, winPercent: 0, xpPerSimulatedHour: 0, flag: 'fail', timeouts: 0 })
    expect(warden?.topDefeatCause).not.toBe('n/a')
  }, 180_000)
})
