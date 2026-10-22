import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../combat.ts'
import { formatEvent } from '../log.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../types.ts'
import type { HeroStatInput } from '../stats.ts'
import { ARCANE_BOLT_ID, MANA_MAXIMUM, MANA_REGEN_PER_SECOND, MAGE_WAIT_REASON } from './mage.ts'
import { spiritResourceFactor } from './resources.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function mageSetup(options?: {
  spirit?: number
  equipped?: readonly string[]
  rows?: CombatSetup['hero']['priorityRows']
  enemies?: CombatSetup['enemies']
}): CombatSetup {
  const armor = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `ref-cloth-${slot}`,
    slot,
    category: 'cloth' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  })
  const hero: HeroStatInput & { id: string; name: string } = {
    id: 'ref-human-mage',
    name: 'Mage',
    level: 20,
    classId: 'mage',
    attributes: { strength: 10, vitality: 16, agility: 16, intellect: 34, spirit: options?.spirit ?? 12 },
    gear: {
      mainHand: { id: 'ref-caster', kind: 'caster', itemLevel: ITEM_LEVEL, quality: QUALITY },
      offHand: { id: 'ref-focus', kind: 'focus', itemLevel: ITEM_LEVEL, quality: QUALITY },
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
    hero: { ...hero, equippedSkillIds: options?.equipped, priorityRows: options?.rows },
    enemies: options?.enemies ?? [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}, id = 'dummy', name = 'Dummy'): EnemyDef {
  return { id, name, level: 20, archetype: 'standard', school: 'physical', overrides }
}

function skill(overrides: Partial<SkillDef> & Pick<SkillDef, 'id' | 'effects'>): SkillDef {
  return {
    name: overrides.name ?? overrides.id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 1,
    tags: ['magical', 'attack'],
    target: 'single',
    ...overrides,
  }
}

const bolt = skill({
  id: ARCANE_BOLT_ID,
  name: 'Arcane Bolt',
  cost: 5,
  actionTimeCoefficient: 0.8,
  tags: ['magical', 'arcane', 'attack'],
  effects: [{ kind: 'damage', school: 'magical', coefficient: 0.9 }],
})

const fireball = skill({
  id: 'fireball',
  name: 'Fireball',
  cost: 30,
  tags: ['magical', 'fire', 'attack'],
  target: 'all',
  effects: [{ kind: 'damage', school: 'magical', coefficient: 1 }],
})

const frost = skill({
  id: 'frost-lance',
  name: 'Frost Lance',
  cost: 20,
  tags: ['magical', 'frost', 'attack'],
  effects: [{ kind: 'damage', school: 'magical', coefficient: 1.1 }],
})

const ward = skill({
  id: 'mana-ward',
  name: 'Mana Ward',
  cost: 30,
  tags: ['defense', 'magical', 'arcane'],
  effects: [{ kind: 'barrier', source: 'magical', coefficient: 1, durationSeconds: 8 }],
})

const recovery = skill({
  id: 'arcane-recovery',
  name: 'Arcane Recovery',
  cooldownSeconds: 10,
  tags: ['arcane', 'recovery'],
  effects: [{ kind: 'resource', base: 30 }],
})

const chain = skill({
  id: 'chain-lightning',
  name: 'Chain Lightning',
  cost: 25,
  tags: ['magical', 'lightning', 'attack'],
  effects: [{ kind: 'chain', school: 'magical', coefficient: 1.2, decay: 0.75, maxTargets: 4, delaySeconds: 0.25 }],
})

function defsFor(skillList: readonly SkillDef[], enemies: readonly EnemyDef[]): GameDefs {
  const skills: GameDefs['skills'] = {}
  for (const entry of skillList) skills[entry.id] = entry
  const book: GameDefs['enemies'] = {}
  for (const enemy of enemies) book[enemy.id] = enemy
  return { enemies: book, skills, statuses: {} }
}

function until(state: CombatState, defs: GameDefs, seen: (state: CombatState) => boolean): void {
  let steps = 0
  while (state.outcome === 'ongoing' && !seen(state)) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 20_000) throw new Error('combat did not reach the expected event')
  }
}

function regenEvents(state: CombatState) {
  return state.log.filter((event) => event.type === 'resource' && event.reason === 'regen')
}

describe('mage mana', () => {
  const one = dummy()

  it('starts a new combat full and regenerates once per second with Spirit', () => {
    const defs = defsFor([bolt], [one])
    const state = createCombat(mageSetup({ equipped: [bolt.id], rows: [{ skillId: bolt.id }] }), defs, 1)
    console.log('[mage] start', {
      resource: state.hero.classResource,
      max: state.hero.classResourceMax,
      scope: state.hero.classResourceScope,
      regen: state.hero.resourceRegenPerSecond,
    })
    expect(state.hero.classResource).toBe(MANA_MAXIMUM)
    expect(state.hero.classResourceId).toBe('mana')
    expect(state.hero.classResourceMax).toBe(MANA_MAXIMUM)
    expect(state.hero.classResourceScope).toBe('expedition')
    expect(state.hero.resourceRegenPerSecond).toBe(MANA_REGEN_PER_SECOND)
    while (state.outcome === 'ongoing' && state.timeMs < 3_000) stepCombat(state, defs)
    const regen = regenEvents(state)
    const factor = spiritResourceFactor(12)
    console.log('[mage] regen', regen.map((event) => (event.type === 'resource' ? { timeMs: event.timeMs, generated: event.generated } : null)))
    expect(regen.map((event) => (event.type === 'resource' ? event.timeMs : 0))).toEqual([1_000, 2_000, 3_000])
    for (const event of regen) {
      if (event.type !== 'resource') continue
      expect(event.base).toBe(MANA_REGEN_PER_SECOND)
      expect(event.multiplier).toBeCloseTo(factor, 10)
      expect(event.generated).toBeCloseTo(MANA_REGEN_PER_SECOND * factor, 10)
    }
    expect(state.log.filter((event) => event.type === 'resource' && event.reason === 'regen' && event.timeMs % 1000 !== 0)).toHaveLength(0)
  })

  it('gives Spirit 0 exactly 2 Mana per second and keeps Mana after the encounter', () => {
    const defs = defsFor([bolt], [dummy({ maxHp: 1 })])
    const calm = createCombat(mageSetup({ spirit: 0, equipped: [bolt.id], rows: [{ skillId: bolt.id }] }), defs, 1)
    while (calm.outcome === 'ongoing' && calm.timeMs < 1_000) stepCombat(calm, defs)
    const first = regenEvents(calm)[0]
    console.log('[mage] zero spirit regen', first)
    expect(first).toMatchObject({ base: 2, multiplier: 1, generated: 2 })
    runCombat(calm, defs, 30_000)
    console.log('[mage] after victory', { outcome: calm.outcome, resource: calm.hero.classResource, scope: calm.hero.classResourceScope })
    expect(calm.outcome).toBe('victory')
    expect(calm.hero.classResource).toBeGreaterThan(0)
    expect(calm.hero.classResourceScope).toBe('expedition')
    expect(calm.log.some((event) => event.type === 'resource' && event.reason === 'encounterEnd')).toBe(false)
  })

  it('restores 30 base Mana from Arcane Recovery before Spirit', () => {
    const defs = defsFor([recovery], [one])
    const state = createCombat(mageSetup({ equipped: [recovery.id], rows: [{ skillId: recovery.id }] }), defs, 1)
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'resource' && event.reason === recovery.id))
    const gain = state.log.find((event) => event.type === 'resource' && event.reason === recovery.id)
    const factor = spiritResourceFactor(12)
    console.log('[mage] recovery', gain)
    expect(gain).toMatchObject({ type: 'resource', base: 30 })
    if (gain?.type !== 'resource') return
    expect(gain.multiplier).toBeCloseTo(factor, 10)
    expect(gain.generated).toBeCloseTo(30 * factor, 10)
  })

  it('waits once when nothing is affordable, then casts from the later time', () => {
    const defs = defsFor([bolt, fireball], [one])
    const state = createCombat(
      mageSetup({ equipped: [fireball.id], rows: [{ skillId: fireball.id }] }),
      defs,
      1,
    )
    state.hero.classResource = 0
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'wait'))
    const waits = state.log.filter((event) => event.type === 'wait')
    console.log('[mage] first wait', { waits, ready: state.hero.nextReadyMs, lines: state.log.map(formatEvent).slice(-4) })
    expect(waits).toHaveLength(1)
    expect(waits[0]).toMatchObject({ reason: MAGE_WAIT_REASON })
    expect(state.hero.waiting).toBe(true)
    expect(state.hero.nextReadyMs).toBe(1724)
    const readyDuringWait = state.hero.nextReadyMs
    stepCombat(state, defs)
    expect(state.hero.nextReadyMs).toBe(readyDuringWait)
    expect(state.log.filter((event) => event.type === 'wait')).toHaveLength(1)
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'action' && event.skillId === bolt.id))
    const boltAction = state.log.find((event) => event.type === 'action' && event.skillId === bolt.id)
    const enemyAction = state.log.find((event) => event.type === 'action' && event.actorId !== state.hero.id)
    console.log('[mage] bolt after wait', { boltAction, enemyAction, waits: state.log.filter((event) => event.type === 'wait').length })
    expect(state.log.filter((event) => event.type === 'wait')).toHaveLength(1)
    expect(boltAction).toMatchObject({ skillId: bolt.id, timeMs: 3_000 })
    expect(enemyAction?.type).toBe('action')
    if (enemyAction?.type !== 'action' || boltAction?.type !== 'action' || waits[0]?.type !== 'wait') return
    expect(enemyAction.timeMs).toBeGreaterThan(waits[0].timeMs)
    expect(enemyAction.timeMs).toBeLessThan(boltAction.timeMs)
    expect(state.hero.equippedSkillIds).not.toContain(bolt.id)
  })

  it('casts Arcane Bolt without spending one of the four loadout slots', () => {
    const equipped = [fireball.id, frost.id, ward.id, recovery.id]
    const defs = defsFor([bolt, fireball, frost, ward, recovery], [one])
    const state = createCombat(
      mageSetup({
        equipped,
        rows: equipped.map((skillId) => ({
          skillId,
          conditions: [{ kind: 'hpPercent' as const, who: 'hero' as const, operator: 'atMost' as const, value: 0 }],
        })),
      }),
      defs,
      1,
    )
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'action' && event.actorId === combat.hero.id))
    const action = state.log.find((event) => event.type === 'action' && event.actorId === state.hero.id)
    console.log('[mage] innate bolt', {
      equipped: state.hero.equippedSkillIds,
      action,
    })
    expect(state.hero.equippedSkillIds).toEqual(equipped)
    expect(state.hero.equippedSkillIds).toHaveLength(4)
    expect(state.hero.equippedSkillIds).not.toContain(ARCANE_BOLT_ID)
    expect(action).toMatchObject({ action: 'skill', skillId: ARCANE_BOLT_ID })
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === state.hero.id)
    expect(hit).toMatchObject({ school: 'magical', coefficient: 0.9, outgoingModifier: 1 })
  })

  it('jumps Chain Lightning across four targets at 75% and pushes each by 250 ms', () => {
    const enemies = [0, 1, 2, 3].map((slot) => dummy({}, `dummy-${slot}`, `Dummy ${slot}`))
    const defs = defsFor([chain, bolt], enemies)
    const state = createCombat(
      mageSetup({
        equipped: [chain.id],
        rows: [{ skillId: chain.id }],
        enemies: enemies.map((enemy, slot) => ({ defId: enemy.id, slot })),
      }),
      defs,
      1,
    )
    const before = state.enemies.map((enemy) => enemy.nextReadyMs)
    until(state, defs, (combat) => combat.log.filter((event) => event.type === 'damage').length >= 4)
    const hits = state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id)
    const delays = state.log.filter((event) => event.type === 'actionDelay')
    let coefficient = 1.2
    const expected: number[] = []
    for (let index = 0; index < 4; index += 1) {
      expected.push(coefficient)
      coefficient *= 0.75
    }
    console.log('[mage] chain', {
      coefficients: hits.map((event) => (event.type === 'damage' ? event.coefficient : 0)),
      expected,
      targets: hits.map((event) => (event.type === 'damage' ? event.targetId : '')),
      delays: delays.map((event) => (event.type === 'actionDelay' ? event.delayMs : 0)),
      ready: state.enemies.map((enemy) => enemy.nextReadyMs),
      before,
    })
    expect(hits).toHaveLength(4)
    expect(hits.map((event) => (event.type === 'damage' ? event.targetId : ''))).toEqual([
      'dummy-0#0',
      'dummy-1#1',
      'dummy-2#2',
      'dummy-3#3',
    ])
    hits.forEach((event, index) => {
      if (event.type !== 'damage') return
      expect(event.school).toBe('magical')
      expect(event.coefficient).toBeCloseTo(expected[index] ?? 0, 10)
      expect(event.outgoingModifier).toBe(1)
    })
    expect(delays).toHaveLength(4)
    for (const event of delays) {
      if (event.type !== 'actionDelay') continue
      expect(event.delayMs).toBe(250)
    }
    state.enemies.forEach((enemy, index) => {
      expect(enemy.nextReadyMs).toBe((before[index] ?? 0) + 250)
    })
    const rolls = hits.map((event) => (event.type === 'damage' ? event.consistencyRoll : 0))
    expect(new Set(rolls).size).toBeGreaterThan(1)
  })

  it('stops Chain Lightning at four targets when a fifth is present', () => {
    const enemies = [0, 1, 2, 3, 4].map((slot) => dummy({}, `dummy-${slot}`, `Dummy ${slot}`))
    const defs = defsFor([chain], enemies)
    const state = createCombat(
      mageSetup({
        equipped: [chain.id],
        rows: [{ skillId: chain.id }],
        enemies: enemies.map((enemy, slot) => ({ defId: enemy.id, slot })),
      }),
      defs,
      1,
    )
    const untouched = state.enemies[4]?.nextReadyMs
    until(state, defs, (combat) => combat.log.filter((event) => event.type === 'damage').length >= 4)
    const hits = state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id)
    console.log('[mage] chain cap', {
      targets: hits.map((event) => (event.type === 'damage' ? event.targetId : '')),
      fifthReady: state.enemies[4]?.nextReadyMs,
      untouched,
    })
    expect(hits).toHaveLength(4)
    expect(hits.some((event) => event.type === 'damage' && event.targetId === 'dummy-4#4')).toBe(false)
    expect(state.enemies[4]?.nextReadyMs).toBe(untouched)
  })
})
