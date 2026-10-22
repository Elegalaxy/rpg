import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../sim/combat.ts'
import { formatEvent } from '../sim/log.ts'
import { deriveHeroStats } from '../sim/stats.ts'
import type { CombatState, DamageEvent } from '../sim/types.ts'

import { DUEL_BASIC_ID, gameDefs, setupForScenario } from './scenarios.ts'

const FIGHT_MS = 180_000

function logRun(label: string, state: CombatState): void {
  const lines = state.log.map(formatEvent)
  console.log('[combat]', {
    label,
    seed: state.seed,
    outcome: state.outcome,
    durationMs: state.timeMs,
    events: state.log.length,
    sample: [...lines.slice(0, 4), ...lines.slice(-2)],
  })
}

function heroDamage(state: CombatState): DamageEvent | undefined {
  for (const event of state.log) {
    if (event.type === 'damage' && event.actorId === state.hero.id) return event
  }
  return undefined
}

describe('duel-basic', () => {
  it('runs the level-20 Warrior against one level-20 Standard dummy', () => {
    const setup = setupForScenario(DUEL_BASIC_ID)
    const defs = gameDefs()
    const stats = deriveHeroStats(setup.hero)
    const state = createCombat(setup, defs, 42)
    expect(state.hero.maxHp).toBe(370)
    expect(state.hero.power).toBe(96)
    expect(state.hero.accuracy).toBe(16)
    expect(state.hero.evasion).toBe(16)
    expect(state.hero.armor).toBe(116)
    expect(state.hero.critChance).toBe(stats.critChance)
    expect(state.hero.critDamage).toBe(stats.critDamage)
    expect(state.hero.penetration).toBe(stats.armorPenetration)
    expect(state.hero.nextReadyMs).toBe(1724)
    const enemy = state.enemies[0]
    expect(enemy?.name).toBe('Standard Dummy')
    expect(enemy?.maxHp).toBe(480)
    expect(enemy?.power).toBe(28)
    expect(enemy?.armor).toBe(45)
    expect(enemy?.accuracy).toBe(30)
    expect(enemy?.evasion).toBe(20)
    expect(enemy?.nextReadyMs).toBe(2200)
    expect(enemy?.critChance).toBe(0)
    expect(enemy?.consistency).toBe(0)

    runCombat(state, defs, FIGHT_MS)
    logRun('duel-basic seed 42', state)
    expect(state.outcome).toBe('victory')
    const end = state.log[state.log.length - 1]
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 20_688 })
    expect(state.timeMs).toBe(20_690)
    const sample = heroDamage(state)
    expect(sample).toBeDefined()
    if (sample === undefined) return
    expect(sample.coefficient).toBe(1)
    expect(sample.outgoingModifier).toBe(1)
    expect(sample.incomingModifier).toBe(1)
    expect(sample.barrier).toBe(0)
    expect(sample.consistency).toBe(0)
    expect(sample.damageFloor).toBeCloseTo(0.6, 10)
    expect(sample.damageCeiling).toBe(1)
    expect(sample.consistencyRoll).toBeGreaterThanOrEqual(0.6)
    expect(sample.consistencyRoll).toBeLessThan(1)
    expect(sample.power).toBe(96)
    expect(sample.defense).toBe(45)
    expect(sample.attackerLevel).toBe(20)
    expect(sample.hpDamage).toBeGreaterThanOrEqual(1)
    expect(state.log.some((event) => event.type === 'damage' && event.actorId === enemy?.id && event.crit)).toBe(
      false,
    )

    const lines = state.log.map(formatEvent)
    expect(lines.join('\n')).toMatchSnapshot()
  })

  it('deep-equals two runs and a resume from t=5000', () => {
    const setup = setupForScenario(DUEL_BASIC_ID)
    const defs = gameDefs()
    const uninterrupted = runCombat(createCombat(setup, defs, 42), defs, FIGHT_MS)
    const repeated = runCombat(createCombat(setup, defs, 42), defs, FIGHT_MS)
    expect(repeated).toEqual(uninterrupted)
    expect(repeated.log).toEqual(uninterrupted.log)

    const paused = createCombat(setup, defs, 42)
    while (paused.outcome === 'ongoing' && paused.timeMs < 5000) stepCombat(paused, defs)
    expect(paused.timeMs).toBe(5000)
    expect(paused.outcome).toBe('ongoing')
    const serialized: unknown = JSON.parse(JSON.stringify(paused))
    const resumed = runCombat(serialized as CombatState, defs, FIGHT_MS)
    logRun('resumed from 5000', resumed)
    expect(resumed.log).toEqual(uninterrupted.log)
    expect(resumed).toEqual(uninterrupted)
  })
})
