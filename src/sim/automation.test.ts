import { describe, expect, it } from 'vitest'

import { chooseHeroAction, setPriorityRules } from './automation.ts'
import { createCombat, stepCombat } from './combat.ts'
import { formatEvent } from './log.ts'
import { nextFloat } from './rng.ts'
import type { HeroStatInput } from './stats.ts'
import type {
  AutomationCondition,
  CombatActor,
  CombatSetup,
  CombatState,
  EnemyDef,
  GameDefs,
  PriorityRow,
  SkillDef,
  TargetPriority,
} from './types.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return {
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  }
}

function warriorSetup(loadout?: {
  equipped?: readonly string[]
  rows?: readonly PriorityRow[]
  targetPriority?: TargetPriority
  enemies?: readonly { defId: string; slot: number; revealed?: boolean }[]
}): CombatSetup {
  const hero: HeroStatInput & { id: string; name: string } = {
    id: 'ref-human-warrior',
    name: 'Warrior',
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
    hero: {
      ...hero,
      equippedSkillIds: loadout?.equipped,
      priorityRows: loadout?.rows,
      targetPriority: loadout?.targetPriority,
    },
    enemies: loadout?.enemies ?? [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(): EnemyDef {
  return {
    id: 'dummy',
    name: 'Dummy',
    level: 20,
    archetype: 'standard',
    school: 'physical',
    overrides: { maxHp: 1_000_000 },
  }
}

function makeSkill(overrides: Partial<SkillDef> & Pick<SkillDef, 'id' | 'effects'>): SkillDef {
  return {
    name: overrides.name ?? overrides.id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 1,
    tags: ['test'],
    target: 'single',
    ...overrides,
  }
}

function defsFor(skillList: readonly SkillDef[]): GameDefs {
  const skills: GameDefs['skills'] = {}
  for (const skill of skillList) skills[skill.id] = skill
  const enemy = dummy()
  return { enemies: { [enemy.id]: enemy }, skills, statuses: {} }
}

function untilAction(state: CombatState, defs: GameDefs): void {
  while (state.outcome === 'ongoing' && state.log.every((event) => event.type !== 'action')) {
    stepCombat(state, defs)
  }
}

describe('unconditional priority rows', () => {
  const paid = makeSkill({
    id: 'paid',
    name: 'Paid Strike',
    cost: 25,
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })
  const twoHanded = makeSkill({
    id: 'heavy',
    name: 'Heavy Blow',
    requires: { mainHand: 'twoHanded' },
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })
  const stored = makeSkill({
    id: 'stored',
    name: 'Stored Cut',
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })
  const ready = makeSkill({
    id: 'ready',
    name: 'Ready Cut',
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1.1 }],
  })

  it('uses the first eligible row and names every skipped row', () => {
    const defs = defsFor([paid, twoHanded, stored, ready])
    const state = createCombat(
      warriorSetup({
        equipped: [paid.id, twoHanded.id, ready.id],
        rows: [
          { skillId: paid.id },
          { skillId: twoHanded.id },
          { skillId: stored.id },
          { skillId: ready.id },
        ],
      }),
      defs,
      1,
    )
    untilAction(state, defs)
    const lines = state.log.map(formatEvent)
    console.log('[skills] priority choice', lines)
    expect(lines.some((line) => line.includes('skips row 1 Paid Strike (paid): unaffordable'))).toBe(true)
    expect(lines.some((line) => line.includes('skips row 2 Heavy Blow (heavy): requires twoHanded'))).toBe(true)
    expect(lines.some((line) => line.includes('skips row 3 Stored Cut (stored): not equipped'))).toBe(true)
    expect(lines.some((line) => line.includes('selects row 4 Ready Cut (ready)'))).toBe(true)
    const action = state.log.find((event) => event.type === 'action')
    expect(action).toMatchObject({ action: 'skill', skillId: 'ready' })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === state.hero.id)).toBe(false)
  })

  it('reports only the first failure when a row fails more than one check', () => {
    const blocked = makeSkill({
      id: 'blocked',
      name: 'Blocked',
      cost: 40,
      cooldownSeconds: 8,
      requires: { offHand: 'focus' },
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const defs = defsFor([blocked])
    const state = createCombat(warriorSetup({ equipped: [], rows: [{ skillId: blocked.id }] }), defs, 1)
    state.hero.cooldowns[blocked.id] = 99_999
    untilAction(state, defs)
    const skips = state.log.filter((event) => event.type === 'priority' && event.decision === 'skip')
    console.log('[skills] first failure only', skips)
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({ skillId: 'blocked', reason: 'not equipped' })
  })

  it('falls back to a basic attack that still rolls to hit', () => {
    const defs = defsFor([paid])
    const state = createCombat(
      warriorSetup({ equipped: [paid.id], rows: [{ skillId: paid.id }] }),
      defs,
      1,
    )
    untilAction(state, defs)
    const lines = state.log.map(formatEvent)
    console.log('[skills] fallback', lines)
    expect(lines.some((line) => line.includes('skips row 1 Paid Strike (paid): unaffordable'))).toBe(true)
    expect(lines.some((line) => line.includes('uses a basic attack because no priority row was eligible'))).toBe(
      true,
    )
    expect(state.log.some((event) => event.type === 'action' && event.action === 'basicAttack')).toBe(true)
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === state.hero.id)).toBe(true)
  })

  it('rejects an unknown skill reference and an unknown row field', () => {
    const defs = defsFor([ready])
    console.log('[skills] invalid references', { missing: 'missing', ready: ready.id })
    expect(() =>
      createCombat(warriorSetup({ equipped: ['missing'], rows: [] }), defs, 1),
    ).toThrow(/unknown skill 'missing'/)
    expect(() =>
      createCombat(warriorSetup({ equipped: [], rows: [{ skillId: 'missing' }] }), defs, 1),
    ).toThrow(/priority row 1 references unknown skill 'missing'/)
    expect(() =>
      createCombat(
        warriorSetup({
          equipped: [ready.id],
          rows: [{ skillId: ready.id, condition: 'hp' } as { skillId: string }],
        }),
        defs,
        1,
      ),
    ).toThrow(/priority row 1 has unknown field 'condition'/)

    const poison = makeSkill({
      id: 'poisoned',
      effects: [{ kind: 'poison' } as unknown as SkillDef['effects'][number]],
    })
    expect(() =>
      createCombat(warriorSetup(), defsFor([poison]), 1),
    ).toThrow(/skill 'poisoned' has unknown effect kind 'poison'/)
  })
})

const PAIR = [
  { defId: 'dummy', slot: 0 },
  { defId: 'dummy', slot: 1 },
] as const

function enemyAt(state: CombatState, slot: number): CombatActor {
  for (const enemy of state.enemies) {
    if (enemy.slot === slot) return enemy
  }
  throw new Error(`[priority] missing enemy slot ${slot}`)
}

function skipReasons(state: CombatState): string[] {
  const reasons: string[] = []
  for (const event of state.log) {
    if (event.type === 'priority' && event.decision === 'skip' && event.reason !== null) reasons.push(event.reason)
  }
  return reasons
}

function heroAction(state: CombatState): { action: string; skillId: string | null; targetId: string } | undefined {
  for (const event of state.log) {
    if (event.type === 'action' && event.actorId === state.hero.id) {
      return { action: event.action, skillId: event.skillId, targetId: event.targetId }
    }
  }
  return undefined
}

function lastRules(state: CombatState): Extract<CombatState['log'][number], { type: 'rulesChanged' }> {
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event !== undefined && event.type === 'rulesChanged') return event
  }
  throw new Error('[priority] missing rulesChanged')
}

function openPriority(
  defs: GameDefs,
  loadout: {
    equipped?: readonly string[]
    rows?: readonly PriorityRow[]
    targetPriority?: TargetPriority
    enemies?: readonly { defId: string; slot: number; revealed?: boolean }[]
  },
  prepare?: (state: CombatState) => void,
): CombatState {
  const state = createCombat(warriorSetup(loadout), defs, 1)
  if (prepare !== undefined) prepare(state)
  untilAction(state, defs)
  return state
}

describe('priority conditions and target priorities', () => {
  const ready = makeSkill({
    id: 'ready',
    name: 'Ready Cut',
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })
  const follow = makeSkill({
    id: 'follow',
    name: 'Follow Cut',
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })

  it('ORs one skill through a later row with a different condition', () => {
    const defs = defsFor([ready])
    const state = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [
          { skillId: ready.id, conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 10 }] },
          { skillId: ready.id, conditions: [{ kind: 'specialAmmo', operator: 'atLeast', value: 1 }] },
        ],
      },
      (combat) => {
        combat.hero.specialAmmo = 2
      },
    )
    const selected = state.log.find((event) => event.type === 'priority' && event.decision === 'use')
    console.log('[priority] or rows', { skips: skipReasons(state), selected, action: heroAction(state) })
    expect(skipReasons(state)).toEqual(['hero HP% 100 is above 10'])
    expect(selected).toMatchObject({ rowIndex: 1, skillId: ready.id })
    expect(heroAction(state)).toMatchObject({ action: 'skill', skillId: ready.id })
  })

  it('falls through a failing condition to the next row', () => {
    const defs = defsFor([ready, follow])
    const state = openPriority(
      defs,
      {
        equipped: [ready.id, follow.id],
        rows: [
          {
            skillId: ready.id,
            conditions: [
              { kind: 'hpPercent', who: 'hero', operator: 'atLeast', value: 0 },
              { kind: 'classResource', operator: 'atLeast', value: 5 },
            ],
          },
          { skillId: follow.id },
        ],
      },
      (combat) => {
        combat.hero.classResource = 1
      },
    )
    console.log('[priority] fallthrough', { skips: skipReasons(state), action: heroAction(state) })
    expect(skipReasons(state)).toEqual(['class resource 1 is below 5'])
    expect(heroAction(state)).toMatchObject({ action: 'skill', skillId: follow.id })
  })

  it('lets a row target priority beat the global priority', () => {
    const defs = defsFor([ready])
    const setHp = (combat: CombatState): void => {
      const low = enemyAt(combat, 0)
      const high = enemyAt(combat, 1)
      low.maxHp = 1000
      high.maxHp = 1000
      low.hp = 100
      high.hp = 900
    }
    const overridden = openPriority(
      defs,
      {
        equipped: [ready.id],
        targetPriority: 'lowestHpPercent',
        rows: [{ skillId: ready.id, targetPriority: 'highestHpPercent' }],
        enemies: PAIR,
      },
      setHp,
    )
    const global = openPriority(
      defs,
      {
        equipped: [ready.id],
        targetPriority: 'lowestHpPercent',
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      },
      setHp,
    )
    console.log('[priority] target override', {
      overridden: heroAction(overridden)?.targetId,
      global: heroAction(global)?.targetId,
    })
    expect(heroAction(overridden)?.targetId).toBe('dummy#1')
    expect(heroAction(global)?.targetId).toBe('dummy#0')
  })

  it('skips unrevealed enemies for armor and resistance priorities', () => {
    const defs = defsFor([ready])
    const hidden = openPriority(defs, {
      equipped: [ready.id],
      rows: [
        { skillId: ready.id, targetPriority: 'lowestArmor' },
        { skillId: ready.id, targetPriority: 'lowestResistance' },
      ],
      enemies: [
        { defId: 'dummy', slot: 0, revealed: false },
        { defId: 'dummy', slot: 1, revealed: false },
      ],
    })
    const hiddenReasons = skipReasons(hidden)
    console.log('[priority] unrevealed', hiddenReasons)
    expect(hiddenReasons).toContain('Dummy (dummy#0) is unrevealed for lowest armor')
    expect(hiddenReasons).toContain('Dummy (dummy#1) is unrevealed for lowest armor')
    expect(hiddenReasons).toContain('no revealed target for lowest armor')
    expect(hiddenReasons).toContain('Dummy (dummy#0) is unrevealed for lowest resistance')
    expect(hiddenReasons).toContain('Dummy (dummy#1) is unrevealed for lowest resistance')
    expect(hiddenReasons).toContain('no revealed target for lowest resistance')
    expect(heroAction(hidden)?.action).toBe('basicAttack')

    const armor = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [{ skillId: ready.id, targetPriority: 'lowestArmor' }],
        enemies: [
          { defId: 'dummy', slot: 0, revealed: false },
          { defId: 'dummy', slot: 1 },
        ],
      },
      (combat) => {
        enemyAt(combat, 0).armor = 1
        enemyAt(combat, 1).armor = 80
      },
    )
    const resistance = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [{ skillId: ready.id, targetPriority: 'lowestResistance' }],
        enemies: [
          { defId: 'dummy', slot: 0, revealed: false },
          { defId: 'dummy', slot: 1 },
        ],
      },
      (combat) => {
        enemyAt(combat, 0).resistance = 1
        enemyAt(combat, 1).resistance = 90
      },
    )
    console.log('[priority] partial reveal', {
      armor: { reasons: skipReasons(armor), target: heroAction(armor)?.targetId },
      resistance: { reasons: skipReasons(resistance), target: heroAction(resistance)?.targetId },
    })
    expect(skipReasons(armor)).toContain('Dummy (dummy#0) is unrevealed for lowest armor')
    expect(heroAction(armor)?.targetId).toBe('dummy#1')
    expect(skipReasons(resistance)).toContain('Dummy (dummy#0) is unrevealed for lowest resistance')
    expect(heroAction(resistance)?.targetId).toBe('dummy#1')

    const revealed = createCombat(warriorSetup({ enemies: [{ defId: 'dummy', slot: 0 }] }), defs, 1)
    console.log('[priority] default revealed', revealed.enemies[0]?.revealed)
    expect(revealed.enemies[0]?.revealed).toBe(true)
  })

  it('uses the other target priorities and breaks ties by slot', () => {
    const defs = defsFor([ready])
    const tied = openPriority(
      defs,
      {
        equipped: [ready.id],
        targetPriority: 'lowestHpPercent',
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      },
      (combat) => {
        for (const enemy of combat.enemies) {
          enemy.maxHp = 1000
          enemy.hp = 500
        }
      },
    )
    const soonest = openPriority(
      defs,
      {
        equipped: [ready.id],
        targetPriority: 'actingSoonest',
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      },
      (combat) => {
        enemyAt(combat, 0).nextReadyMs = 8000
        enemyAt(combat, 1).nextReadyMs = 4000
      },
    )
    const soonestTie = openPriority(
      defs,
      {
        equipped: [ready.id],
        targetPriority: 'actingSoonest',
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      },
      (combat) => {
        enemyAt(combat, 0).nextReadyMs = 5000
        enemyAt(combat, 1).nextReadyMs = 5000
      },
    )
    const current = openPriority(
      defs,
      {
        equipped: [ready.id],
        targetPriority: 'current',
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      },
      (combat) => {
        combat.hero.currentTargetId = 'dummy#1'
      },
    )
    const marked = openPriority(
      defs,
      {
        equipped: [ready.id],
        targetPriority: 'marked',
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      },
      (combat) => {
        enemyAt(combat, 1).statuses.mark = {
          name: 'Mark',
          expiresMs: 20_000,
          sourceId: 'hero',
          sourceName: 'Warrior',
        }
      },
    )
    const unmarked = openPriority(defs, {
      equipped: [ready.id],
      targetPriority: 'marked',
      rows: [{ skillId: ready.id }],
      enemies: PAIR,
    })
    const randomState = createCombat(
      warriorSetup({
        equipped: [ready.id],
        targetPriority: 'random',
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      }),
      defs,
      1,
    )
    const probe = { ...randomState.rng }
    const roll = nextFloat(probe)
    const index = Math.floor(roll * randomState.enemies.length)
    const choice = chooseHeroAction(randomState, defs, randomState.hero, randomState.hero.nextReadyMs)
    console.log('[priority] priorities', {
      tied: heroAction(tied)?.targetId,
      soonest: heroAction(soonest)?.targetId,
      soonestTie: heroAction(soonestTie)?.targetId,
      current: heroAction(current)?.targetId,
      marked: heroAction(marked)?.targetId,
      unmarked: skipReasons(unmarked),
      random: { roll, index, focus: choice.kind === 'skill' ? choice.focus?.id : null, rng: randomState.rng },
    })
    expect(heroAction(tied)?.targetId).toBe('dummy#0')
    expect(heroAction(soonest)?.targetId).toBe('dummy#1')
    expect(heroAction(soonestTie)?.targetId).toBe('dummy#0')
    expect(heroAction(current)?.targetId).toBe('dummy#1')
    expect(heroAction(marked)?.targetId).toBe('dummy#1')
    expect(skipReasons(unmarked)).toContain('no marked target')
    expect(heroAction(unmarked)?.action).toBe('basicAttack')
    expect(choice.kind).toBe('skill')
    if (choice.kind === 'skill') expect(choice.focus?.id).toBe(randomState.enemies[index]?.id)
    expect(randomState.rng).toEqual(probe)
  })

  it('reads hero and enemy conditions', () => {
    const defs = defsFor([ready])
    const cases: {
      name: string
      conditions: readonly AutomationCondition[]
      enemies?: readonly { defId: string; slot: number }[]
      prepare?: (state: CombatState) => void
      reason: string
    }[] = [
      {
        name: 'hero hp',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }],
        reason: 'hero HP% 100 is above 40',
      },
      {
        name: 'class resource',
        conditions: [{ kind: 'classResource', operator: 'atLeast', value: 5 }],
        prepare: (combat) => {
          combat.hero.classResource = 2
        },
        reason: 'class resource 2 is below 5',
      },
      {
        name: 'resource equal',
        conditions: [{ kind: 'classResource', operator: 'equal', value: 4 }],
        prepare: (combat) => {
          combat.hero.classResource = 3
        },
        reason: 'class resource 3 is not 4',
      },
      {
        name: 'resource not equal',
        conditions: [{ kind: 'classResource', operator: 'notEqual', value: 3 }],
        prepare: (combat) => {
          combat.hero.classResource = 3
        },
        reason: 'class resource 3 equals 3',
      },
      {
        name: 'barrier absent',
        conditions: [{ kind: 'barrier', operator: 'present' }],
        reason: 'hero barrier is absent',
      },
      {
        name: 'barrier amount',
        conditions: [{ kind: 'barrier', operator: 'atLeast', value: 25 }],
        prepare: (combat) => {
          combat.hero.barrier = 10
          combat.hero.barrierExpiresMs = combat.hero.nextReadyMs + 10_000
        },
        reason: 'hero barrier 10 is below 25',
      },
      {
        name: 'barrier active so absent fails',
        conditions: [{ kind: 'barrier', operator: 'absent' }],
        prepare: (combat) => {
          combat.hero.barrier = 10
          combat.hero.barrierExpiresMs = combat.hero.nextReadyMs + 10_000
        },
        reason: 'hero barrier is present',
      },
      {
        name: 'own status',
        conditions: [{ kind: 'status', who: 'hero', statusId: 'poison', measure: 'presence', operator: 'present' }],
        reason: 'hero poison is absent',
      },
      {
        name: 'own status absent',
        conditions: [{ kind: 'status', who: 'hero', statusId: 'poison', measure: 'presence', operator: 'absent' }],
        prepare: (combat) => {
          combat.hero.statuses.poison = {
            name: 'Poison',
            stacks: [
              {
                power: 1,
                penetration: 0,
                coefficient: 0.12,
                attackerLevel: 20,
                sourceId: 'hero',
                sourceName: 'Warrior',
              },
            ],
            expiresMs: combat.hero.nextReadyMs + 4000,
            tickMs: 2000,
            nextTickMs: combat.hero.nextReadyMs + 4000,
          }
        },
        reason: 'hero poison is present',
      },
      {
        name: 'own status stacks',
        conditions: [{ kind: 'status', who: 'hero', statusId: 'poison', measure: 'stacks', operator: 'atLeast', value: 2 }],
        prepare: (combat) => {
          combat.hero.statuses.poison = {
            name: 'Poison',
            stacks: [
              {
                power: 1,
                penetration: 0,
                coefficient: 0.12,
                attackerLevel: 20,
                sourceId: 'hero',
                sourceName: 'Warrior',
              },
            ],
            expiresMs: combat.hero.nextReadyMs + 4000,
            tickMs: 2000,
            nextTickMs: combat.hero.nextReadyMs + 4000,
          }
        },
        reason: 'hero poison stacks 1 is below 2',
      },
      {
        name: 'own status remaining',
        conditions: [
          { kind: 'status', who: 'hero', statusId: 'poison', measure: 'remaining', operator: 'atMost', value: 1000 },
        ],
        prepare: (combat) => {
          const expiresMs = combat.hero.nextReadyMs + 1500
          combat.hero.statuses.poison = {
            name: 'Poison',
            stacks: [
              {
                power: 1,
                penetration: 0,
                coefficient: 0.12,
                attackerLevel: 20,
                sourceId: 'hero',
                sourceName: 'Warrior',
              },
            ],
            expiresMs,
            tickMs: 2000,
            nextTickMs: expiresMs,
          }
        },
        reason: 'hero poison remaining 1500ms is above 1000ms',
      },
      {
        name: 'special ammo',
        conditions: [{ kind: 'specialAmmo', operator: 'atLeast', value: 1 }],
        reason: 'special ammo 0 is below 1',
      },
      {
        name: 'enemy count',
        conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 2 }],
        reason: 'enemy count 1 is below 2',
      },
      {
        name: 'target hp',
        conditions: [{ kind: 'hpPercent', who: 'target', operator: 'atMost', value: 5 }],
        prepare: (combat) => {
          const enemy = enemyAt(combat, 0)
          enemy.maxHp = 1000
          enemy.hp = 100
        },
        reason: 'target HP% 10 is above 5',
      },
      {
        name: 'enemy type',
        conditions: [{ kind: 'enemyType', operator: 'equal', value: 'tank' }],
        reason: 'enemy type standard is not tank',
      },
      {
        name: 'enemy type not equal',
        conditions: [{ kind: 'enemyType', operator: 'notEqual', value: 'standard' }],
        reason: 'enemy type standard equals standard',
      },
      {
        name: 'rank',
        conditions: [{ kind: 'rank', operator: 'equal', value: 2 }],
        reason: 'rank 0 is not 2',
      },
      {
        name: 'mark',
        conditions: [{ kind: 'mark', operator: 'present' }],
        reason: 'mark is absent',
      },
      {
        name: 'mark present',
        conditions: [{ kind: 'mark', operator: 'absent' }],
        prepare: (combat) => {
          enemyAt(combat, 0).statuses.mark = {
            name: 'Mark',
            expiresMs: null,
            sourceId: 'hero',
            sourceName: 'Warrior',
          }
        },
        reason: 'mark is present',
      },
      {
        name: 'boss phase',
        conditions: [{ kind: 'bossPhase', operator: 'equal', value: 2 }],
        reason: 'boss phase 0 is not 2',
      },
      {
        name: 'telegraph',
        conditions: [{ kind: 'telegraph', operator: 'present' }],
        reason: 'telegraph is absent',
      },
      {
        name: 'telegraph time',
        conditions: [{ kind: 'telegraph', tag: 'pounce', operator: 'atMost', value: 1000 }],
        prepare: (combat) => {
          const enemy = enemyAt(combat, 0)
          enemy.telegraph = { tag: 'pounce', resolvesAtMs: combat.hero.nextReadyMs + 5000 }
        },
        reason: 'telegraph pounce 5000ms is above 1000ms',
      },
      {
        name: 'enemy status absent',
        conditions: [{ kind: 'status', who: 'target', statusId: 'burn', measure: 'presence', operator: 'absent' }],
        prepare: (combat) => {
          enemyAt(combat, 0).statuses.burn = {
            name: 'Burn',
            intensity: 2,
            power: 1,
            penetration: 0,
            coefficient: 0.1,
            attackerLevel: 20,
            sourceId: 'hero',
            sourceName: 'Warrior',
            expiresMs: combat.hero.nextReadyMs + 5000,
            tickMs: 1000,
            nextTickMs: combat.hero.nextReadyMs + 1000,
          }
        },
        reason: 'target burn is present',
      },
      {
        name: 'wrong telegraph tag',
        conditions: [{ kind: 'telegraph', tag: 'swipe', operator: 'present' }],
        prepare: (combat) => {
          enemyAt(combat, 0).telegraph = { tag: 'pounce', resolvesAtMs: combat.hero.nextReadyMs + 500 }
        },
        reason: 'telegraph swipe is absent',
      },
      {
        name: 'poison stacks',
        conditions: [
          { kind: 'status', who: 'target', statusId: 'poison', measure: 'stacks', operator: 'atLeast', value: 1 },
        ],
        reason: 'target poison stacks 0 is below 1',
      },
      {
        name: 'bleed remaining',
        conditions: [
          { kind: 'status', who: 'target', statusId: 'bleed', measure: 'remaining', operator: 'atMost', value: 1 },
        ],
        prepare: (combat) => {
          enemyAt(combat, 0).statuses.bleed = {
            name: 'Bleed',
            stacks: [
              {
                power: 1,
                penetration: 0,
                coefficient: 0.1,
                attackerLevel: 20,
                sourceId: 'hero',
                sourceName: 'Warrior',
                actionsRemaining: 2,
              },
            ],
          }
        },
        reason: 'target bleed remaining 2 actions is above 1 actions',
      },
      {
        name: 'poison remaining',
        conditions: [
          { kind: 'status', who: 'target', statusId: 'poison', measure: 'remaining', operator: 'atMost', value: 1000 },
        ],
        prepare: (combat) => {
          const expiresMs = combat.hero.nextReadyMs + 1500
          enemyAt(combat, 0).statuses.poison = {
            name: 'Poison',
            stacks: [
              {
                power: 1,
                penetration: 0,
                coefficient: 0.12,
                attackerLevel: 20,
                sourceId: 'hero',
                sourceName: 'Warrior',
              },
            ],
            expiresMs,
            tickMs: 2000,
            nextTickMs: expiresMs,
          }
        },
        reason: 'target poison remaining 1500ms is above 1000ms',
      },
    ]
    for (const entry of cases) {
      const state = openPriority(
        defs,
        { equipped: [ready.id], rows: [{ skillId: ready.id, conditions: entry.conditions }], enemies: entry.enemies },
        entry.prepare,
      )
      const reasons = skipReasons(state)
      console.log('[priority] condition', { name: entry.name, reasons, action: heroAction(state)?.action })
      expect(reasons[0], entry.name).toBe(entry.reason)
    }

    const passed = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [
          {
            skillId: ready.id,
            conditions: [
              { kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 100 },
              { kind: 'classResource', operator: 'atLeast', value: 1 },
              { kind: 'barrier', operator: 'present' },
              { kind: 'specialAmmo', operator: 'atLeast', value: 1 },
              { kind: 'enemyCount', operator: 'atMost', value: 2 },
              { kind: 'hpPercent', who: 'target', operator: 'atLeast', value: 0 },
              { kind: 'enemyType', operator: 'equal', value: 'standard' },
              { kind: 'rank', operator: 'equal', value: 1 },
              { kind: 'mark', operator: 'present' },
              { kind: 'bossPhase', operator: 'equal', value: 2 },
              { kind: 'status', who: 'target', statusId: 'chill', measure: 'stacks', operator: 'atLeast', value: 1 },
              { kind: 'telegraph', tag: 'pounce', operator: 'present' },
            ],
          },
          { skillId: ready.id },
        ],
      },
      (combat) => {
        combat.hero.classResource = 4
        combat.hero.specialAmmo = 2
        combat.hero.barrier = 30
        combat.hero.barrierExpiresMs = combat.hero.nextReadyMs + 10_000
        const enemy = enemyAt(combat, 0)
        enemy.rank = 1
        enemy.bossPhase = 2
        enemy.statuses.mark = { name: 'Mark', expiresMs: 20_000, sourceId: 'hero', sourceName: 'Warrior' }
        enemy.statuses.chill = { name: 'Chill', stacks: 1, expiresMs: 20_000, slowByStack: [0.1, 0.07, 0.05] }
        enemy.telegraph = null
      },
    )
    console.log('[priority] and fallthrough', skipReasons(passed))
    expect(skipReasons(passed)[0]).toBe('telegraph pounce is absent')
    expect(heroAction(passed)).toMatchObject({ skillId: ready.id })

    const timed = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [{ skillId: ready.id, conditions: [{ kind: 'telegraph', tag: 'pounce', operator: 'atMost', value: 1000 }] }],
      },
      (combat) => {
        enemyAt(combat, 0).telegraph = { tag: 'pounce', resolvesAtMs: combat.hero.nextReadyMs + 400 }
      },
    )
    console.log('[priority] telegraph passed', heroAction(timed))
    expect(heroAction(timed)).toMatchObject({ action: 'skill', skillId: ready.id })

    const passedStatuses = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [
          {
            skillId: ready.id,
            conditions: [
              { kind: 'status', who: 'hero', statusId: 'poison', measure: 'presence', operator: 'present' },
              { kind: 'status', who: 'hero', statusId: 'poison', measure: 'stacks', operator: 'equal', value: 2 },
              { kind: 'status', who: 'hero', statusId: 'poison', measure: 'remaining', operator: 'atLeast', value: 1000 },
              { kind: 'status', who: 'target', statusId: 'burn', measure: 'presence', operator: 'absent' },
              { kind: 'barrier', operator: 'absent' },
            ],
          },
        ],
      },
      (combat) => {
        const expiresMs = combat.hero.nextReadyMs + 4000
        combat.hero.statuses.poison = {
          name: 'Poison',
          stacks: [
            {
              power: 1,
              penetration: 0,
              coefficient: 0.12,
              attackerLevel: 20,
              sourceId: 'hero',
              sourceName: 'Warrior',
            },
            {
              power: 1,
              penetration: 0,
              coefficient: 0.12,
              attackerLevel: 20,
              sourceId: 'hero',
              sourceName: 'Warrior',
            },
          ],
          expiresMs,
          tickMs: 2000,
          nextTickMs: expiresMs,
        }
      },
    )
    console.log('[priority] status pass', { skips: skipReasons(passedStatuses), action: heroAction(passedStatuses) })
    expect(skipReasons(passedStatuses)).toEqual([])
    expect(heroAction(passedStatuses)).toMatchObject({ action: 'skill', skillId: ready.id })
  })

  it('uses the first living enemy by slot when no priority is set', () => {
    const defs = defsFor([ready])
    const reversed = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [{ skillId: ready.id }],
        enemies: [
          { defId: 'dummy', slot: 1 },
          { defId: 'dummy', slot: 0 },
        ],
      },
      (combat) => {
        const higher = enemyAt(combat, 1)
        const lower = enemyAt(combat, 0)
        combat.enemies = [higher, lower]
      },
    )
    const skippedDead = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [{ skillId: ready.id }],
        enemies: PAIR,
      },
      (combat) => {
        const dead = enemyAt(combat, 0)
        dead.alive = false
        dead.hp = 0
      },
    )
    console.log('[priority] default target', {
      reversed: { order: reversed.enemies.map((enemy) => enemy.id), target: heroAction(reversed)?.targetId },
      skippedDead: heroAction(skippedDead)?.targetId,
    })
    expect(reversed.hero.targetPriority).toBeNull()
    expect(heroAction(reversed)?.targetId).toBe('dummy#0')
    expect(heroAction(skippedDead)?.targetId).toBe('dummy#1')
  })

  it('picks the lowest revealed armor and resistance, and can use the 12th row', () => {
    const defs = defsFor([ready])
    const armor = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [{ skillId: ready.id, targetPriority: 'lowestArmor' }],
        enemies: PAIR,
      },
      (combat) => {
        enemyAt(combat, 0).armor = 80
        enemyAt(combat, 1).armor = 15
      },
    )
    const resistance = openPriority(
      defs,
      {
        equipped: [ready.id],
        rows: [{ skillId: ready.id, targetPriority: 'lowestResistance' }],
        enemies: PAIR,
      },
      (combat) => {
        enemyAt(combat, 0).resistance = 90
        enemyAt(combat, 1).resistance = 12
      },
    )
    const rows: PriorityRow[] = []
    for (let index = 0; index < 11; index += 1) {
      rows.push({
        skillId: ready.id,
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 0 }],
      })
    }
    rows.push({ skillId: ready.id })
    const twelfth = openPriority(defs, { equipped: [ready.id], rows })
    const selected = twelfth.log.find((event) => event.type === 'priority' && event.decision === 'use')
    console.log('[priority] defense and twelfth row', {
      armor: heroAction(armor)?.targetId,
      resistance: heroAction(resistance)?.targetId,
      skips: skipReasons(twelfth).length,
      selected,
    })
    expect(heroAction(armor)?.targetId).toBe('dummy#1')
    expect(heroAction(resistance)?.targetId).toBe('dummy#1')
    expect(skipReasons(twelfth)).toHaveLength(11)
    expect(selected).toMatchObject({ rowIndex: 11, skillId: ready.id })
    expect(heroAction(twelfth)).toMatchObject({ action: 'skill', skillId: ready.id })
  })

  it('skips a row that has no living target', () => {
    const defs = defsFor([ready])
    const state = createCombat(
      warriorSetup({ equipped: [ready.id], rows: [{ skillId: ready.id }], enemies: PAIR }),
      defs,
      1,
    )
    for (const enemy of state.enemies) {
      enemy.alive = false
      enemy.hp = 0
    }
    const choice = chooseHeroAction(state, defs, state.hero, state.hero.nextReadyMs)
    const reasons = choice.events
      .filter((event) => event.decision === 'skip')
      .map((event) => event.reason)
    console.log('[priority] no living target', { kind: choice.kind, reasons })
    expect(reasons).toEqual(['no target'])
    expect(choice.kind).toBe('basicAttack')

    const expired = createCombat(
      warriorSetup({
        equipped: [ready.id],
        rows: [{ skillId: ready.id, conditions: [{ kind: 'barrier', operator: 'present' }] }],
      }),
      defs,
      1,
    )
    expired.hero.barrier = 40
    expired.hero.barrierExpiresMs = expired.hero.nextReadyMs
    const expiredChoice = chooseHeroAction(expired, defs, expired.hero, expired.hero.nextReadyMs)
    const expiredReason = expiredChoice.events.find((event) => event.decision === 'skip')?.reason
    console.log('[priority] expired barrier', { amount: expired.hero.barrier, reason: expiredReason })
    expect(expired.hero.barrier).toBe(40)
    expect(expiredReason).toBe('hero barrier is absent')
  })

  it('applies setPriorityRules on the next evaluation and leaves the chosen action', () => {
    const alpha = makeSkill({
      id: 'alpha',
      name: 'Alpha',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const beta = makeSkill({
      id: 'beta',
      name: 'Beta',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const defs = defsFor([alpha, beta])
    const direct = createCombat(
      warriorSetup({ equipped: [alpha.id, beta.id], rows: [{ skillId: alpha.id }] }),
      defs,
      1,
    )
    const picked = chooseHeroAction(direct, defs, direct.hero, direct.hero.nextReadyMs)
    setPriorityRules(direct, { rows: [{ skillId: beta.id }], targetPriority: 'lowestHpPercent' }, defs)
    const nextPick = chooseHeroAction(direct, defs, direct.hero, direct.hero.nextReadyMs)
    console.log('[priority] choice snapshot', {
      picked: picked.kind === 'skill' ? picked.skill.id : picked.kind,
      next: nextPick.kind === 'skill' ? nextPick.skill.id : nextPick.kind,
      rules: formatEvent(lastRules(direct)),
    })
    expect(picked.kind).toBe('skill')
    if (picked.kind === 'skill') expect(picked.skill.id).toBe(alpha.id)
    expect(nextPick.kind).toBe('skill')
    if (nextPick.kind === 'skill') expect(nextPick.skill.id).toBe(beta.id)
    expect(lastRules(direct)).toMatchObject({ applied: true, rowCount: 1, targetPriority: 'lowestHpPercent' })

    const state = createCombat(
      warriorSetup({ equipped: [alpha.id, beta.id], rows: [{ skillId: alpha.id }] }),
      defs,
      1,
    )
    untilAction(state, defs)
    const first = heroAction(state)
    const readyAt = state.hero.nextReadyMs
    const cooldowns = { ...state.hero.cooldowns }
    setPriorityRules(state, { rows: [{ skillId: beta.id }] }, defs)
    expect(state.hero.nextReadyMs).toBe(readyAt)
    expect(state.hero.cooldowns).toEqual(cooldowns)
    expect(heroAction(state)).toEqual(first)
    expect(first?.skillId).toBe(alpha.id)
    let heroActions = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).length
    while (state.outcome === 'ongoing' && heroActions < 2) {
      stepCombat(state, defs)
      heroActions = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).length
    }
    const skillIds: (string | null)[] = []
    for (const event of state.log) {
      if (event.type === 'action' && event.actorId === state.hero.id) skillIds.push(event.skillId)
    }
    console.log('[priority] next evaluation', { skillIds, rules: formatEvent(lastRules(state)) })
    expect(skillIds[0]).toBe(alpha.id)
    expect(skillIds[1]).toBe(beta.id)
  })

  it('rejects an unknown skill, a 13th row, and Most dangerous without replacing the rules', () => {
    const alpha = makeSkill({
      id: 'alpha',
      name: 'Alpha',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const beta = makeSkill({
      id: 'beta',
      name: 'Beta',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const defs = defsFor([alpha, beta, ready])
    const state = createCombat(warriorSetup({ equipped: [beta.id], rows: [{ skillId: beta.id }] }), defs, 1)
    const twelve: { skillId: string }[] = []
    for (let index = 0; index < 12; index += 1) twelve.push({ skillId: beta.id })
    setPriorityRules(state, { rows: twelve, targetPriority: 'current' }, defs)
    expect(state.hero.priorityRows).toHaveLength(12)
    expect(lastRules(state)).toMatchObject({ applied: true, rowCount: 12, targetPriority: 'current' })
    console.log('[priority] twelve rows', formatEvent(lastRules(state)))

    const kept = state.hero.priorityRows.map((row) => row.skillId)
    setPriorityRules(state, { rows: [{ skillId: 'nope' }], targetPriority: 'marked' }, defs)
    expect(state.hero.priorityRows.map((row) => row.skillId)).toEqual(kept)
    expect(state.hero.targetPriority).toBe('current')
    expect(lastRules(state).applied).toBe(false)
    expect(lastRules(state).reason).toContain("unknown skill 'nope'")
    console.log('[priority] unknown skill', formatEvent(lastRules(state)))

    const thirteen = [...twelve, { skillId: beta.id }]
    setPriorityRules(state, { rows: thirteen }, defs)
    expect(state.hero.priorityRows.map((row) => row.skillId)).toEqual(kept)
    expect(state.hero.targetPriority).toBe('current')
    expect(lastRules(state)).toMatchObject({
      applied: false,
      rowCount: 13,
      reason: 'priority rules have 13 rows and the maximum is 12',
    })
    console.log('[priority] thirteenth row', formatEvent(lastRules(state)))

    const spellings = ['Most dangerous', 'most dangerous', 'mostDangerous', 'most-dangerous']
    for (const spelling of spellings) {
      const rejected: unknown = { rows: [{ skillId: beta.id }], targetPriority: spelling }
      setPriorityRules(state, rejected, defs)
      expect(state.hero.priorityRows.map((row) => row.skillId)).toEqual(kept)
      expect(state.hero.targetPriority).toBe('current')
      expect(lastRules(state).applied).toBe(false)
      expect(lastRules(state).reason).toContain('Most dangerous')
      console.log('[priority] rejected priority', { spelling, line: formatEvent(lastRules(state)) })

      const rowRejected: unknown = { rows: [{ skillId: beta.id, targetPriority: spelling }] }
      setPriorityRules(state, rowRejected, defs)
      expect(state.hero.priorityRows.map((row) => row.skillId)).toEqual(kept)
      expect(lastRules(state).reason).toContain('Most dangerous')

      const setup = warriorSetup({ equipped: [ready.id], rows: [{ skillId: ready.id }] })
      ;(setup.hero as { targetPriority: string }).targetPriority = spelling
      expect(() => createCombat(setup, defs, 1)).toThrow(/Most dangerous/)
    }
    const rowSetup = warriorSetup({
      equipped: [ready.id],
      rows: [{ skillId: ready.id, targetPriority: 'Most dangerous' as TargetPriority }],
    })
    expect(() => createCombat(rowSetup, defs, 1)).toThrow(/Most dangerous/)
  })
})
