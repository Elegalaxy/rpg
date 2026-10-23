import { beforeEach, describe, expect, it } from 'vitest'

import { DUEL_BASIC_ID, gameDefs, setupForScenario } from '../content/scenarios.ts'
import { createCombat, runCombat, STEP_MS, stepCombat } from '../sim/combat.ts'

import { CATCH_UP_MS } from './loop.ts'
import { getSnapshot, onFrame, restart, selectScenario, setSeedText, setSpeed, subscribe } from './store.ts'

const DELTAS = [1, 3, 7, 16, 17, 9, 2, 8, 40, 11, 5, 24, 200, 13, 6, 15, 33, 4, 19, 48]

beforeEach(() => {
  setSpeed(1)
  setSeedText('42')
  selectScenario(DUEL_BASIC_ID)
})

describe('combat playback loop', () => {
  it('irregular frame times match runCombat for duel-basic seed 42', () => {
    const maxMs = 60_000
    const defs = gameDefs()
    const expected = runCombat(createCombat(setupForScenario(DUEL_BASIC_ID), defs, 42), defs, maxMs)

    let clock = 0
    let frames = 0
    let notifications = 0
    let maxAdvance = 0
    const unsubscribe = subscribe(() => {
      notifications += 1
    })

    const stepFrame = (nextClock: number): void => {
      const before = getSnapshot().combat.timeMs
      onFrame(nextClock)
      frames += 1
      const advance = getSnapshot().combat.timeMs - before
      if (advance > maxAdvance) maxAdvance = advance
      clock = nextClock
    }

    try {
      stepFrame(0)
      expect(getSnapshot().combat.timeMs).toBe(0)
      let guard = 0
      while (getSnapshot().combat.outcome === 'ongoing') {
        const delta = DELTAS[guard % DELTAS.length]
        if (delta === undefined) throw new Error('[loop] missing frame delta')
        guard += 1
        if (guard > 100_000) {
          throw new Error(
            `[loop] duel-basic seed 42 did not finish after ${guard} frames at ${getSnapshot().combat.timeMs} ms`,
          )
        }
        stepFrame(clock + delta)
      }

      const finishedAt = getSnapshot().combat.timeMs
      const finishedEvents = getSnapshot().combat.log.length
      stepFrame(clock + 1)
      stepFrame(clock + CATCH_UP_MS)

      const actual = getSnapshot().combat
      const end = actual.log[actual.log.length - 1]
      console.log('[loop]', {
        scenarioId: DUEL_BASIC_ID,
        seed: 42,
        frames,
        notifications,
        maxAdvanceMs: maxAdvance,
        outcome: actual.outcome,
        timeMs: actual.timeMs,
        durationMs: end !== undefined && end.type === 'encounterEnd' ? end.timeMs : null,
        events: actual.log.length,
        expectedOutcome: expected.outcome,
        expectedTimeMs: expected.timeMs,
        expectedEvents: expected.log.length,
      })

      expect(notifications).toBe(frames)
      expect(maxAdvance).toBeGreaterThan(STEP_MS)
      expect(frames).toBeLessThan(finishedAt / STEP_MS)
      expect(actual.timeMs).toBe(finishedAt)
      expect(actual.log.length).toBe(finishedEvents)
      expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 20_688 })
      expect(actual.outcome).toBe(expected.outcome)
      expect(actual.timeMs).toBe(expected.timeMs)
      expect(actual.seed).toBe(expected.seed)
      expect(actual.log).toEqual(expected.log)
      expect(actual.rng).toEqual(expected.rng)
      expect(actual.hero).toEqual(expected.hero)
      expect(actual.enemies).toEqual(expected.enemies)
      expect(actual).toEqual(expected)
    } finally {
      unsubscribe()
    }
  })

  it('caps catch-up at 250 ms of simulated time per frame', () => {
    expect(CATCH_UP_MS).toBe(250)
    expect(STEP_MS).toBe(10)

    onFrame(0)
    onFrame(250)
    expect(getSnapshot().combat.timeMs).toBe(250)

    selectScenario(DUEL_BASIC_ID)
    let notifications = 0
    const unsubscribe = subscribe(() => {
      notifications += 1
    })
    try {
      onFrame(0)
      onFrame(1_000)
      expect(notifications).toBe(2)
    } finally {
      unsubscribe()
    }
    expect(getSnapshot().combat.timeMs).toBe(250)
    expect(getSnapshot().combat.outcome).toBe('ongoing')

    const defs = gameDefs()
    const stepped = createCombat(setupForScenario(DUEL_BASIC_ID), defs, 42)
    for (let index = 0; index < CATCH_UP_MS / STEP_MS; index += 1) stepCombat(stepped, defs)
    expect(getSnapshot().combat).toEqual(stepped)

    setSpeed(4)
    selectScenario(DUEL_BASIC_ID)
    onFrame(0)
    onFrame(100)
    expect(getSnapshot().combat.timeMs).toBe(250)
    console.log('[loop]', { capMs: CATCH_UP_MS, speed: 4, wallMs: 100, timeMs: getSnapshot().combat.timeMs })
  })

  it('multiplies irregular elapsed time by speed', () => {
    setSpeed(2)
    let clock = 500
    onFrame(clock)
    for (const delta of [7, 13, 40]) {
      clock += delta
      onFrame(clock)
    }
    expect(getSnapshot().combat.timeMs).toBe(120)
    console.log('[loop]', { speed: 2, wallMs: 60, timeMs: getSnapshot().combat.timeMs })
  })

  it('rejects a non-integer seed and does not restart', () => {
    const combat = getSnapshot().combat
    const rejected = ['', '  ', '42.5', '4e1', 'nope', '42abc', '1.0', '+42', '2147483648', '-2147483649']
    for (const text of rejected) {
      setSeedText(text)
      expect(getSnapshot().seedError, text).not.toBeNull()
      expect(getSnapshot().seed, text).toBe(42)
      expect(getSnapshot().combat, text).toBe(combat)
    }
    restart()
    expect(getSnapshot().combat).toBe(combat)
    expect(getSnapshot().seedError).not.toBeNull()

    setSeedText(' 42 ')
    expect(getSnapshot().seedError).toBeNull()
    expect(getSnapshot().seed).toBe(42)
    expect(getSnapshot().combat).toBe(combat)
    restart()
    expect(getSnapshot().combat).not.toBe(combat)
    expect(getSnapshot().combat.seed).toBe(42)
    expect(getSnapshot().combat.timeMs).toBe(0)
    console.log('[ui]', { rejected: rejected.length, restartedSeed: getSnapshot().combat.seed })
  })
})
