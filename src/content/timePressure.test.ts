import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { assertEnemyDef } from '../sim/enemyAi.ts'
import type { CombatActor, CombatState, EnemyDef, GameDefs, TimePressureDef } from '../sim/types.ts'

import { referenceHeroes } from './heroes.ts'
import { gameDefs } from './scenarios.ts'

const PRESSURE: TimePressureDef = {
  startMs: 5000,
  intervalMs: 3000,
  maxStacks: 4,
  power: 1.1,
  defense: 0.95,
  actionSpeed: 1.05,
}

function open(enemyId: string, timePressure: TimePressureDef | undefined): { state: CombatState; defs: GameDefs; enemy: CombatActor } {
  const defs = gameDefs()
  const base = defs.enemies[enemyId] as EnemyDef
  defs.enemies[enemyId] = timePressure === undefined ? base : { ...base, timePressure }
  const hero = referenceHeroes.warrior
  const state = createCombat(
    {
      hero: {
        id: hero.id,
        name: 'Warrior',
        level: hero.level,
        classId: hero.classId,
        attributes: hero.attributes,
        gear: hero.gear,
      },
      enemies: [{ defId: enemyId, slot: 0 }],
    },
    defs,
    1,
  )
  const enemy = state.enemies[0]
  if (enemy === undefined) throw new Error('missing enemy')
  // Keep both sides passive so only the clock matters.
  state.hero.hp = 1_000_000
  state.hero.maxHp = 1_000_000
  state.hero.nextReadyMs = 10_000_000
  enemy.nextReadyMs = 10_000_000
  return { state, defs, enemy }
}

function stepTo(state: CombatState, defs: GameDefs, timeMs: number): void {
  while (state.outcome === 'ongoing' && state.timeMs < timeMs) stepCombat(state, defs)
}

describe('timePressure validation', () => {
  const base: EnemyDef = gameDefs().enemies['echo-knight'] as EnemyDef

  it('accepts a well-formed definition', () => {
    expect(() => assertEnemyDef({ ...base, timePressure: PRESSURE })).not.toThrow()
  })

  it('rejects non-integer or small start, interval and stacks', () => {
    for (const patch of [
      { startMs: 0 },
      { startMs: 1.5 },
      { intervalMs: 0 },
      { intervalMs: 2.5 },
      { maxStacks: 0 },
      { maxStacks: 1.5 },
    ]) {
      expect(() => assertEnemyDef({ ...base, timePressure: { ...PRESSURE, ...patch } })).toThrow()
    }
  })

  it('rejects non-positive factors', () => {
    for (const patch of [{ power: 0 }, { defense: -1 }, { actionSpeed: Number.NaN }]) {
      expect(() => assertEnemyDef({ ...base, timePressure: { ...PRESSURE, ...patch } })).toThrow()
    }
  })

  it('rejects timePressure on an enemy whose phases define pressure', () => {
    const warden = gameDefs().enemies['fractured-warden'] as EnemyDef
    expect(() => assertEnemyDef({ ...warden, timePressure: PRESSURE })).toThrow(/pressure/)
  })
})

describe('timePressure stacks', () => {
  it('lands the first stack at the start time, then every interval up to the cap', () => {
    const { state, defs, enemy } = open('echo-knight', PRESSURE)
    stepTo(state, defs, 4990)
    expect(enemy.pressureStacks).toBe(0)
    stepTo(state, defs, 5000)
    expect(enemy.pressureStacks).toBe(1)
    stepTo(state, defs, 7990)
    expect(enemy.pressureStacks).toBe(1)
    stepTo(state, defs, 8000)
    expect(enemy.pressureStacks).toBe(2)
    stepTo(state, defs, 30_000)
    expect(enemy.pressureStacks).toBe(4)
    const times = state.log.filter((event) => event.type === 'stack').map((event) => event.timeMs)
    expect(times).toEqual([5000, 8000, 11_000, 14_000])
  })

  it('keeps the stance: assault Power is base x 1.25 x 1.1^n across a stance switch', () => {
    const { state, defs, enemy } = open('echo-knight', PRESSURE)
    const base = enemy.stanceBasePower
    const armor = enemy.stanceBaseArmor
    stepTo(state, defs, 9000)
    expect(enemy.stance).toBe('guard')
    expect(enemy.pressureStacks).toBe(2)
    expect(enemy.power).toBeCloseTo(base * 1.1 ** 2, 8)
    expect(enemy.armor).toBeCloseTo(armor * 1.3 * 0.95 ** 2, 8)
    stepTo(state, defs, 10_000)
    expect(enemy.stance).toBe('assault')
    expect(enemy.power).toBeCloseTo(base * 1.25 * 1.1 ** 2, 8)
    expect(enemy.armor).toBeCloseTo(armor * 0.6 * 0.95 ** 2, 8)
    stepTo(state, defs, 11_000)
    expect(enemy.stance).toBe('assault')
    expect(enemy.pressureStacks).toBe(3)
    expect(enemy.power).toBeCloseTo(base * 1.25 * 1.1 ** 3, 8)
    stepTo(state, defs, 20_000)
    expect(enemy.stance).toBe('guard')
    expect(enemy.power).toBeCloseTo(base * 1.1 ** 4, 8)
  })

  it('stops stacking once the enemy is dead', () => {
    const { state, defs, enemy } = open('echo-knight', PRESSURE)
    stepTo(state, defs, 5000)
    expect(enemy.pressureStacks).toBe(1)
    enemy.alive = false
    enemy.hp = 0
    stepTo(state, defs, 20_000)
    expect(enemy.pressureStacks).toBe(1)
  })

  it('does nothing without a definition', () => {
    const { state, defs, enemy } = open('echo-knight', undefined)
    stepTo(state, defs, 20_000)
    expect(enemy.pressureStacks).toBe(0)
  })
})
