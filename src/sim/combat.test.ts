import { describe, expect, it } from 'vitest'

import { createCombat, roundDurationMs, runCombat, STEP_MS, stepCombat } from './combat.ts'
import { consistencyBounds } from './damage.ts'
import { formatEvent } from './log.ts'
import { centeredRoll, createRng, nextFloat } from './rng.ts'
import { deriveHeroStats, type HeroStatInput } from './stats.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs } from './types.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function warriorSetup(name = 'Warrior'): CombatSetup {
  const armor = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  })
  const hero: HeroStatInput & { id: string; name: string } = {
    id: 'ref-human-warrior',
    name,
    level: 20,
    classId: 'warrior',
    attributes: { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 },
    gear: {
      mainHand: { id: 'ref-one-handed', kind: 'oneHanded', itemLevel: ITEM_LEVEL, quality: QUALITY },
      offHand: { id: 'ref-shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: QUALITY },
      head: armor('head'),
      chest: armor('chest'),
      hands: armor('hands'),
      feet: armor('feet'),
      accessories: [
        { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
        { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
      ] as const,
    },
  }
  return {
    hero,
    enemies: [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}): EnemyDef {
  return {
    id: 'dummy',
    name: 'Dummy',
    level: 20,
    archetype: 'standard',
    school: 'physical',
    overrides,
  }
}

function defsFor(...enemies: EnemyDef[]): GameDefs {
  const record: GameDefs['enemies'] = {}
  for (const enemy of enemies) record[enemy.id] = enemy
  return { enemies: record, skills: {} }
}

function logRun(label: string, state: CombatState): void {
  const lines = state.log.slice(0, 3).map(formatEvent)
  console.log('[combat]', {
    label,
    seed: state.seed,
    outcome: state.outcome,
    durationMs: state.timeMs,
    sample: lines,
  })
}

describe('combat clock', () => {
  it('steps 10 ms, skips t=0, and schedules recovery from the ready time', () => {
    expect(STEP_MS).toBe(10)
    const setup = warriorSetup()
    const stats = deriveHeroStats(setup.hero)
    const defs = defsFor(dummy())
    const state = createCombat(setup, defs, 42)
    logRun('created', state)
    expect(state.timeMs).toBe(0)
    expect(state.outcome).toBe('ongoing')
    expect(state.log.map((event) => event.type)).toEqual(['encounterStart'])
    expect(state.hero.nextReadyMs).toBe(1724)
    expect(state.hero.nextReadyMs).toBe(roundDurationMs(stats.actionTime, 'hero action time'))
    expect(state.enemies[0]?.nextReadyMs).toBe(2200)
    expect(state.hero.consistency).toBe(0)
    expect(state.hero.critChance).toBe(stats.critChance)
    expect(state.hero.critDamage).toBe(stats.critDamage)
    expect(state.enemies[0]?.critChance).toBe(0)

    stepCombat(state, defs)
    expect(state.timeMs).toBe(10)
    expect(state.log).toHaveLength(1)

    while (state.log.every((event) => event.type !== 'action')) stepCombat(state, defs)
    const action = state.log.find((event) => event.type === 'action')
    expect(action?.type).toBe('action')
    if (action?.type !== 'action') return
    expect(action.timeMs).toBe(1724)
    expect(action.actorId).toBe(state.hero.id)
    expect(state.timeMs).toBe(1730)
    expect(state.hero.nextReadyMs).toBe(3448)
    logRun('first action', state)
  })

  it('orders equal ready times hero first, then enemies by slot', () => {
    const stats = deriveHeroStats(warriorSetup().hero)
    const shared = { actionTime: stats.actionTime, maxHp: 1_000_000 }
    const first: EnemyDef = { ...dummy(shared), id: 'slot-zero', name: 'Slot Zero' }
    const second: EnemyDef = { ...dummy(shared), id: 'slot-one', name: 'Slot One' }
    const defs = defsFor(first, second)
    const setup: CombatSetup = {
      hero: warriorSetup().hero,
      enemies: [
        { defId: 'slot-one', slot: 1 },
        { defId: 'slot-zero', slot: 0 },
      ],
    }
    const state = createCombat(setup, defs, 7)
    while (state.log.every((event) => event.type !== 'action')) stepCombat(state, defs)
    const actions = state.log.filter((event) => event.type === 'action')
    console.log('[combat] tie order', {
      seed: state.seed,
      timeMs: state.timeMs,
      actors: actions.map((event) => (event.type === 'action' ? event.actorId : '')),
    })
    expect(actions.map((event) => (event.type === 'action' ? event.timeMs : 0))).toEqual([
      1724, 1724, 1724,
    ])
    expect(actions.map((event) => (event.type === 'action' ? event.actorId : ''))).toEqual([
      'ref-human-warrior',
      'slot-zero#0',
      'slot-one#1',
    ])
    expect(state.timeMs).toBe(1730)
  })

  it('lets an earlier enemy act before the hero', () => {
    const setup = warriorSetup()
    const defs = defsFor(dummy({ actionTime: 1, maxHp: 1_000_000 }))
    const state = createCombat(setup, defs, 3)
    while (state.log.every((event) => event.type !== 'action')) stepCombat(state, defs)
    const action = state.log.find((event) => event.type === 'action')
    console.log('[combat] earlier enemy', {
      seed: state.seed,
      actor: action?.type === 'action' ? action.actorId : '',
      timeMs: action?.timeMs,
    })
    expect(action?.type).toBe('action')
    if (action?.type !== 'action') return
    expect(action.actorId).toBe('dummy#0')
    expect(action.timeMs).toBe(1000)
    expect(state.timeMs).toBe(1000)
  })
})

describe('runCombat', () => {
  it('times out at the step clock without inventing a winner', () => {
    const setup = warriorSetup()
    const defs = defsFor(dummy({ maxHp: 1_000_000 }))
    const state = createCombat(setup, defs, 42)
    runCombat(state, defs, 100)
    logRun('timeout', state)
    expect(state.outcome).toBe('timeout')
    expect(state.timeMs).toBe(100)
    expect(state.log.map((event) => event.type)).toEqual(['encounterStart', 'encounterEnd'])
    const end = state.log[1]
    expect(end?.type).toBe('encounterEnd')
    if (end?.type !== 'encounterEnd') return
    expect(end.timeMs).toBe(100)
    expect(end.outcome).toBe('timeout')
    const timeMs = state.timeMs
    stepCombat(state, defs)
    expect(state.timeMs).toBe(timeMs)
    expect(state.log).toHaveLength(2)
  })

  it('times out immediately when maxMs is 0', () => {
    const state = createCombat(warriorSetup(), defsFor(dummy()), 1)
    runCombat(state, defsFor(dummy()), 0)
    console.log('[combat] maxMs 0', { seed: state.seed, outcome: state.outcome, durationMs: state.timeMs })
    expect(state.outcome).toBe('timeout')
    expect(state.timeMs).toBe(0)
  })

  it('deep-equals two runs of the same seed', () => {
    const setup = warriorSetup()
    const defs = defsFor(dummy())
    const first = runCombat(createCombat(setup, defs, 42), defs, 30_000)
    const second = runCombat(createCombat(setup, defs, 42), defs, 30_000)
    logRun('seed 42 a', first)
    logRun('seed 42 b', second)
    expect(second).toEqual(first)
    expect(second.log).toEqual(first.log)
  })
})

function assertPlainData(value: unknown, path: string): void {
  if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return
  }
  if (typeof value === 'function') throw new Error(`${path} is a function`)
  if (typeof value !== 'object') throw new Error(`${path} is ${typeof value}`)
  if (value instanceof Map) throw new Error(`${path} is a Map`)
  if (value instanceof Set) throw new Error(`${path} is a Set`)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainData(item, `${path}[${index}]`))
    return
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${path} is a class instance`)
  }
  for (const [key, child] of Object.entries(value)) {
    assertPlainData(child, `${path}.${key}`)
  }
}

describe('combat state shape', () => {
  it('is plain JSON with time, rng, hero, enemies, log, and outcome', () => {
    const defs = defsFor(dummy())
    const state = createCombat(warriorSetup(), defs, 42)
    while (state.outcome === 'ongoing' && state.timeMs < 5_000) stepCombat(state, defs)
    assertPlainData(state, 'state')
    const restored = JSON.parse(JSON.stringify(state)) as CombatState
    console.log('[combat] json state', {
      seed: state.seed,
      timeMs: state.timeMs,
      outcome: state.outcome,
      rng: state.rng,
      enemies: state.enemies.length,
      events: state.log.length,
    })
    expect(restored).toEqual(state)
    expect(restored.timeMs).toBe(5000)
    expect(restored.rng).toEqual(state.rng)
    expect(restored.hero.id).toBe(state.hero.id)
    expect(restored.enemies).toEqual(state.enemies)
    expect(restored.log).toEqual(state.log)
    expect(restored.outcome).toBe('ongoing')
    expect(Object.keys(restored.rng).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('combat edge timing', () => {
  it('rounds durations to the nearest millisecond', () => {
    const nearest = roundDurationMs(1.0004, 'low')
    const half = roundDurationMs(1.0005, 'half')
    const warrior = roundDurationMs(2 / 1.16, 'warrior')
    console.log('[combat] duration rounding', { nearest, half, warrior })
    expect(nearest).toBe(1000)
    expect(half).toBe(1001)
    expect(warrior).toBe(1724)
  })

  it('resolves every ready time inside one 10 ms step from the scheduled time', () => {
    const setup = warriorSetup()
    const defs = defsFor(dummy({ actionTime: 0.001, maxHp: 1_000_000 }))
    const state = createCombat(setup, defs, 42)
    stepCombat(state, defs)
    const actions = state.log.filter((event) => event.type === 'action')
    console.log('[combat] sub-step actions', {
      seed: state.seed,
      timeMs: state.timeMs,
      times: actions.map((event) => (event.type === 'action' ? event.timeMs : 0)),
    })
    expect(state.timeMs).toBe(10)
    expect(actions.map((event) => (event.type === 'action' ? event.timeMs : 0))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(actions.map((event) => (event.type === 'action' ? event.nextReadyMs : 0))).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
    expect(state.hero.nextReadyMs).toBe(1724)
    expect(state.log.some((event) => event.type === 'action' && event.actorId === state.hero.id)).toBe(false)
  })

  it('lets the hero kill a same-time enemy before that enemy acts', () => {
    const stats = deriveHeroStats(warriorSetup().hero)
    const defs = defsFor(dummy({ actionTime: stats.actionTime, maxHp: 1, evasion: 0 }))
    const state = createCombat(warriorSetup(), defs, 42)
    runCombat(state, defs, 30_000)
    const actions = state.log.filter((event) => event.type === 'action')
    const end = state.log[state.log.length - 1]
    console.log('[combat] same-time kill', {
      seed: state.seed,
      outcome: state.outcome,
      timeMs: state.timeMs,
      actors: actions.map((event) => (event.type === 'action' ? event.actorId : '')),
    })
    expect(state.outcome).toBe('victory')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ actorId: 'ref-human-warrior', timeMs: 1724 })
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 1724 })
    expect(state.timeMs).toBe(1730)
  })

  it('ends in defeat when the enemy kills the hero', () => {
    const defs = defsFor(dummy({ actionTime: 1, power: 5_000, maxHp: 1_000_000 }))
    const state = createCombat(warriorSetup(), defs, 42)
    runCombat(state, defs, 30_000)
    const heroActions = state.log.filter(
      (event) => event.type === 'action' && event.actorId === state.hero.id,
    )
    const end = state.log[state.log.length - 1]
    console.log('[combat] defeat', {
      seed: state.seed,
      outcome: state.outcome,
      timeMs: state.timeMs,
      heroHp: state.hero.hp,
      events: state.log.map((event) => event.type),
    })
    expect(state.outcome).toBe('defeat')
    expect(state.hero.alive).toBe(false)
    expect(state.hero.hp).toBe(0)
    expect(heroActions).toHaveLength(0)
    expect(state.log.some((event) => event.type === 'death' && event.actorId === state.hero.id)).toBe(true)
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'defeat', timeMs: 1000 })
    expect(state.timeMs).toBe(1000)
    const frozen = state.timeMs
    stepCombat(state, defs)
    expect(state.timeMs).toBe(frozen)
    expect(state.outcome).toBe('defeat')
  })

  it('draws a hit roll, then a centered consistency roll and a separate crit roll only on a hit', () => {
    const defs = defsFor(dummy())
    const state = runCombat(createCombat(warriorSetup(), defs, 42), defs, 30_000)
    const rng = createRng(42)
    let hits = 0
    let misses = 0
    for (let index = 0; index < state.log.length; index += 1) {
      const event = state.log[index]
      if (event === undefined || event.type !== 'hitRoll') continue
      expect(event.roll).toBe(nextFloat(rng))
      if (!event.hit) {
        misses += 1
        continue
      }
      hits += 1
      const damage = state.log[index + 1]
      expect(damage?.type).toBe('damage')
      if (damage?.type !== 'damage') continue
      const bounds = consistencyBounds(damage.consistency)
      expect(bounds).toEqual({ floor: 0.6, ceiling: 1 })
      expect(damage.consistencyRoll).toBe(centeredRoll(rng, bounds.floor, bounds.ceiling))
      expect(damage.critRoll).toBe(nextFloat(rng))
    }
    console.log('[combat] roll sequence', { seed: state.seed, hits, misses, outcome: state.outcome })
    expect(hits).toBeGreaterThan(0)
    expect(misses).toBeGreaterThan(0)
    expect(state.outcome).toBe('victory')
  })
})

describe('combat input validation', () => {
  const defs = defsFor(dummy())

  it('throws when the hero is missing', () => {
    const setup = { enemies: [{ defId: 'dummy', slot: 0 }] } as unknown as CombatSetup
    expect(() => createCombat(setup, defs, 1)).toThrow('combat setup is missing a hero')
  })

  it('throws when there are no enemies', () => {
    const setup: CombatSetup = { hero: warriorSetup().hero, enemies: [] }
    expect(() => createCombat(setup, defs, 1)).toThrow('combat setup has no enemies')
  })

  it('throws when the seed is not a 32-bit integer', () => {
    expect(() => createCombat(warriorSetup(), defs, 1.5)).toThrow(
      'seed must be an integer from -2147483648 through 2147483647',
    )
  })

  it('throws when maxMs is negative and leaves the state ongoing', () => {
    const state = createCombat(warriorSetup(), defs, 1)
    expect(() => runCombat(state, defs, -1)).toThrow('maxMs must be an integer of at least 0')
    expect(state.outcome).toBe('ongoing')
    expect(state.timeMs).toBe(0)
  })

  it('throws when an enemy id is unknown', () => {
    const setup = warriorSetup()
    setup.enemies = [{ defId: 'missing', slot: 0 }]
    expect(() => createCombat(setup, defs, 1)).toThrow("unknown enemy 'missing'")
  })
})
