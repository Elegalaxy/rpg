import { STEP_MS } from '../sim/constants.ts'

import { debugLog } from './debug.ts'

/** One frame simulates at most this much, after speed is applied. */
export const CATCH_UP_MS = 250

export type LoopDetails = {
  scenarioId: string
  seed: number
  speed: number
  paused: boolean
}

export type GameLoop = {
  frame: (timeMs: number) => void
  resetClock: () => void
  start: () => void
  stop: () => void
  pause: () => void
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

function requestFrame(callback: (timeMs: number) => void): number {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    throw new Error('requestAnimationFrame is not available')
  }
  return globalThis.requestAnimationFrame(callback)
}

function cancelFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    throw new Error('cancelAnimationFrame is not available')
  }
  globalThis.cancelAnimationFrame(handle)
}

/**
 * Playback clock. Callers pass each frame timestamp in, including tests.
 * Elapsed wall time is multiplied by speed, then spent in whole STEP_MS steps.
 */
export function createGameLoop(options: {
  getSpeed: () => number
  isPaused: () => boolean
  applySteps: (count: number) => void
  notify: () => void
  details: () => LoopDetails
}): GameLoop {
  let handle: number | null = null
  let lastTime: number | null = null
  let accumulator = 0

  function resetClock(): void {
    lastTime = null
    accumulator = 0
  }

  function frame(timeMs: number): void {
    if (typeof timeMs !== 'number' || !Number.isFinite(timeMs)) {
      throw new Error(`frame time must be a finite number, received ${describeValue(timeMs)}`)
    }
    if (options.isPaused()) {
      lastTime = timeMs
      accumulator = 0
      return
    }
    if (lastTime === null) {
      lastTime = timeMs
      options.notify()
      return
    }

    const elapsed = timeMs - lastTime
    lastTime = timeMs
    if (!(elapsed > 0)) {
      options.notify()
      return
    }

    const speed = options.getSpeed()
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) {
      throw new Error(`speed must be a positive finite number, received ${describeValue(speed)}`)
    }

    let simulated = elapsed * speed
    if (simulated > CATCH_UP_MS) {
      debugLog('[loop]', 'catch-up cap', {
        elapsedMs: elapsed,
        speed,
        uncappedMs: simulated,
        cappedMs: CATCH_UP_MS,
      })
      simulated = CATCH_UP_MS
    }

    accumulator += simulated
    let steps = 0
    while (accumulator >= STEP_MS) {
      accumulator -= STEP_MS
      steps += 1
    }
    if (steps > 0) options.applySteps(steps)
    options.notify()
  }

  function stop(): void {
    if (handle !== null) {
      const current = handle
      handle = null
      cancelFrame(current)
    }
    resetClock()
  }

  function start(): void {
    if (handle !== null) return
    const tick = (timeMs: number) => {
      if (handle === null) return
      frame(timeMs)
      if (handle === null) return
      handle = requestFrame(tick)
    }
    handle = requestFrame(tick)
    debugLog('[loop]', 'start', options.details())
  }

  function pause(): void {
    debugLog('[loop]', 'pause', options.details())
    stop()
  }

  return { frame, resetClock, start, stop, pause }
}
