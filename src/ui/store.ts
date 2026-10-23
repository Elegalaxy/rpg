import { useSyncExternalStore } from 'react'

import { DUEL_BASIC_ID, gameDefs, scenarios, setupForScenario } from '../content/scenarios.ts'
import { createCombat, stepCombat } from '../sim/combat.ts'
import type { CombatState } from '../sim/types.ts'

import { debugLog } from './debug.ts'
import { createGameLoop } from './loop.ts'

export const PLAYBACK_SPEEDS = [1, 2, 4] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

const SEED_MIN = -2147483648
const SEED_MAX = 2147483647
const SEED_ERROR = `Seed must be an integer from ${SEED_MIN} through ${SEED_MAX}.`

export type CombatSnapshot = {
  combat: CombatState
  scenarioId: string
  seed: number
  seedText: string
  seedError: string | null
  queueError: string | null
  paused: boolean
  speed: PlaybackSpeed
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

function parseSeed(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed.length === 0 || trimmed.length > 11 || !/^-?\d+$/.test(trimmed)) return null
  const value = BigInt(trimmed)
  if (value < BigInt(SEED_MIN) || value > BigInt(SEED_MAX)) return null
  return Number(value)
}

function assertSpeed(speed: number): asserts speed is PlaybackSpeed {
  if (speed !== 1 && speed !== 2 && speed !== 4) {
    throw new Error(`speed must be 1, 2, or 4, received ${describeValue(speed)}`)
  }
}

function assertScenarioId(scenarioId: string): void {
  if (typeof scenarioId !== 'string' || scenarios[scenarioId] === undefined) {
    throw new Error(`unknown scenario ${describeValue(scenarioId)}`)
  }
}

const defs = gameDefs()
const listeners = new Set<() => void>()

const initialCombat = createCombat(setupForScenario(DUEL_BASIC_ID), defs, 1)

let snapshot: CombatSnapshot = {
  combat: initialCombat,
  scenarioId: DUEL_BASIC_ID,
  seed: 1,
  seedText: '1',
  seedError: null,
  queueError: null,
  paused: false,
  speed: 1,
}

debugLog('[ui]', 'scenario start', {
  scenarioId: snapshot.scenarioId,
  seed: snapshot.seed,
  timeMs: snapshot.combat.timeMs,
  outcome: snapshot.combat.outcome,
})

function emit(): void {
  for (const listener of [...listeners]) listener()
}

function details() {
  return {
    scenarioId: snapshot.scenarioId,
    seed: snapshot.seed,
    speed: snapshot.speed,
    paused: snapshot.paused,
  }
}

function applySteps(count: number): void {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error(`step count must be a non-negative integer, received ${describeValue(count)}`)
  }
  const combat = snapshot.combat
  if (combat.outcome !== 'ongoing' || count === 0) return
  for (let index = 0; index < count; index += 1) {
    stepCombat(combat, defs)
    if (combat.outcome !== 'ongoing') {
      const end = combat.log[combat.log.length - 1]
      debugLog('[loop]', 'encounter end', {
        scenarioId: snapshot.scenarioId,
        seed: combat.seed,
        outcome: combat.outcome,
        timeMs: combat.timeMs,
        durationMs: end !== undefined && end.type === 'encounterEnd' ? end.timeMs : combat.timeMs,
        events: combat.log.length,
      })
      return
    }
  }
}

const loop = createGameLoop({
  getSpeed: () => snapshot.speed,
  isPaused: () => snapshot.paused,
  applySteps,
  notify: () => {
    snapshot = { ...snapshot }
    emit()
  },
  details,
})

function startScenario(scenarioId: string, seed: number, seedText: string): void {
  assertScenarioId(scenarioId)
  const combat = createCombat(setupForScenario(scenarioId), defs, seed)
  loop.resetClock()
  snapshot = {
    combat,
    scenarioId,
    seed,
    seedText,
    seedError: null,
    queueError: null,
    paused: snapshot.paused,
    speed: snapshot.speed,
  }
  debugLog('[ui]', 'scenario start', {
    scenarioId,
    seed,
    timeMs: combat.timeMs,
    outcome: combat.outcome,
    enemies: combat.enemies.length,
  })
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): CombatSnapshot {
  return snapshot
}

export function useCombatStore(): CombatSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function onFrame(timeMs: number): void {
  loop.frame(timeMs)
}

export function startCombatLoop(): () => void {
  if (!snapshot.paused) loop.start()
  return () => {
    loop.stop()
  }
}

export function noteHeroQueue(error: string | null): void {
  if (error !== null && (typeof error !== 'string' || error.length === 0)) {
    throw new Error(`queue error must be a non-empty string or null, received ${describeValue(error)}`)
  }
  snapshot = { ...snapshot, queueError: error }
  emit()
}

export function selectScenario(scenarioId: string): void {
  assertScenarioId(scenarioId)
  debugLog('[ui]', 'scenario', { scenarioId })
  const parsed = parseSeed(snapshot.seedText)
  if (parsed === null) {
    debugLog('[ui]', 'scenario rejected', { scenarioId, seedText: snapshot.seedText })
    snapshot = { ...snapshot, seedError: SEED_ERROR }
    emit()
    return
  }
  startScenario(scenarioId, parsed, snapshot.seedText)
}

export function setSeedText(text: string): void {
  if (typeof text !== 'string') {
    throw new Error(`seed text must be a string, received ${describeValue(text)}`)
  }
  const parsed = parseSeed(text)
  if (parsed === null) {
    debugLog('[ui]', 'seed rejected', { seedText: text })
    snapshot = { ...snapshot, seedText: text, seedError: SEED_ERROR }
    emit()
    return
  }
  debugLog('[ui]', 'seed', { seed: parsed })
  snapshot = { ...snapshot, seedText: text, seed: parsed, seedError: null }
  emit()
}

export function restart(): void {
  const parsed = parseSeed(snapshot.seedText)
  if (parsed === null) {
    debugLog('[ui]', 'restart rejected', { seedText: snapshot.seedText })
    snapshot = { ...snapshot, seedError: SEED_ERROR }
    emit()
    return
  }
  debugLog('[ui]', 'restart', { scenarioId: snapshot.scenarioId, seed: parsed })
  startScenario(snapshot.scenarioId, parsed, snapshot.seedText)
}

export function randomSeed(): void {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  const raw = buffer[0]
  if (raw === undefined) throw new Error('crypto.getRandomValues returned no seed')
  const seed = raw | 0
  debugLog('[ui]', 'random seed', { seed })
  startScenario(snapshot.scenarioId, seed, String(seed))
}

export function togglePause(): void {
  const paused = !snapshot.paused
  snapshot = { ...snapshot, paused }
  if (paused) {
    debugLog('[ui]', 'pause', details())
    loop.pause()
  } else {
    debugLog('[ui]', 'resume', details())
    loop.start()
  }
  emit()
}

export function setSpeed(speed: PlaybackSpeed): void {
  assertSpeed(speed)
  const previous = snapshot.speed
  debugLog('[ui]', 'speed', { speed, previous })
  snapshot = { ...snapshot, speed }
  if (previous !== speed) debugLog('[loop]', 'speed', { speed, previous })
  emit()
}
