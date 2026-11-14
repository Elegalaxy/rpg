import { describe, expect, it } from 'vitest'

import { parseRuleStacks, STACK_HOLD_MS } from './automation.ts'
import { createCombat, stepCombat } from './combat.ts'
import { formatEvent } from './log.ts'
import { activeRules, pickStack, setManualStack, setRuleStacks } from './stacks.ts'
import type {
  CombatSetup,
  CombatState,
  EnemyDef,
  GameDefs,
  RuleStack,
  SkillDef,
  StackChangedEvent,
} from './types.ts'

function setupWith(stacks: readonly RuleStack[] | undefined, enemyCount: number): CombatSetup {
  const piece = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `light-${slot}`,
    slot,
    category: 'light' as const,
    itemLevel: 5,
    quality: 1,
  })
  return {
    hero: {
      id: 'hero-assassin',
      name: 'Assassin',
      level: 5,
      classId: 'assassin',
      attributes: { strength: 10, vitality: 14, agility: 10, intellect: 10, spirit: 10 },
      gear: {
        mainHand: { id: 'dagger', kind: 'dagger', itemLevel: 5, quality: 1 },
        offHand: { id: 'off-dagger', kind: 'dagger', itemLevel: 5, quality: 1 },
        head: piece('head'),
        chest: piece('chest'),
        hands: piece('hands'),
        feet: piece('feet'),
        accessories: [
          { id: 'accessory-a', itemLevel: 5, quality: 1 },
          { id: 'accessory-b', itemLevel: 5, quality: 1 },
        ],
      },
      equippedSkillIds: ['sweep', 'stab'],
      priorityRows: [{ skillId: 'stab' }],
      ...(stacks === undefined ? {} : { ruleStacks: stacks }),
    },
    enemies: Array.from({ length: enemyCount }, (_, slot) => ({ defId: 'dummy', slot })),
  }
}

function skill(id: string, target: SkillDef['target']): SkillDef {
  return {
    id,
    name: id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 1,
    tags: ['test'],
    target,
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  }
}

const dummy: EnemyDef = {
  id: 'dummy',
  name: 'Dummy',
  level: 5,
  archetype: 'standard',
  school: 'physical',
  overrides: { maxHp: 1_000_000 },
}

const defs: GameDefs = {
  enemies: { dummy },
  skills: { sweep: skill('sweep', 'all'), stab: skill('stab', 'single') },
  statuses: {},
}

const GROUP: RuleStack = {
  id: 'group',
  name: 'Group',
  when: [{ kind: 'enemyCount', operator: 'atLeast', value: 2 }],
  rows: [{ skillId: 'sweep' }],
}
const SINGLE: RuleStack = {
  id: 'single',
  name: 'Single',
  when: [{ kind: 'enemyCount', operator: 'atMost', value: 1 }],
  rows: [{ skillId: 'stab' }],
}

function stackEvents(state: CombatState): StackChangedEvent[] {
  return state.log.filter((event): event is StackChangedEvent => event.type === 'stackChanged')
}

function heroActions(state: CombatState): number {
  return state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).length
}

/** Step until the hero has taken one more action. */
function nextAction(state: CombatState): void {
  const before = heroActions(state)
  for (let i = 0; i < 2000 && heroActions(state) === before; i += 1) stepCombat(state, defs)
  expect(heroActions(state)).toBeGreaterThan(before)
}

function kill(state: CombatState, count: number): void {
  for (const enemy of state.enemies.filter((entry) => entry.alive).slice(0, count)) {
    enemy.alive = false
    enemy.hp = 0
  }
}

describe('rule stacks', () => {
  it('switches to Group at once, then to Single only after the hold when the group thins', () => {
    const state = createCombat(setupWith([GROUP, SINGLE], 3), defs, 7)
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('group')
    expect(stackEvents(state)).toHaveLength(1)
    expect(stackEvents(state)[0]).toMatchObject({ reason: 'trigger', toName: 'Group', detail: 'enemy count at least 2' })
    const switchedAt = state.hero.stackState?.sinceMs ?? -1
    kill(state, 2)
    // The next action is before the hold ends, so Group stays and nothing is logged.
    nextAction(state)
    expect(state.timeMs - 10).toBeLessThan(switchedAt + STACK_HOLD_MS)
    expect(state.hero.stackState?.activeId).toBe('group')
    expect(stackEvents(state)).toHaveLength(1)
    while (state.timeMs < switchedAt + STACK_HOLD_MS) stepCombat(state, defs)
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('single')
    const events = stackEvents(state)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({ reason: 'trigger', fromName: 'Group', toName: 'Single' })
    expect(formatEvent(events[1] as StackChangedEvent)).toContain('Single')
  })

  it('falls back to Default with the reason the stack no longer passes', () => {
    const state = createCombat(setupWith([GROUP], 3), defs, 7)
    nextAction(state)
    kill(state, 2)
    while (state.timeMs < (state.hero.stackState?.sinceMs ?? 0) + STACK_HOLD_MS) stepCombat(state, defs)
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('default')
    expect(stackEvents(state)[1]).toMatchObject({ reason: 'fallback', detail: expect.stringContaining('enemy count') })
  })

  it('holds blocks switching down but not up', () => {
    const state = createCombat(setupWith([GROUP, SINGLE], 1), defs, 7)
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('single')
    // Up (Single to Group) is immediate even inside the hold.
    state.enemies.push({ ...(state.enemies[0] as CombatState['enemies'][number]), id: 'extra', slot: 5 })
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('group')
  })

  it('a manual pick overrides and clearing restores the automatic pick', () => {
    const state = createCombat(setupWith([GROUP, SINGLE], 3), defs, 7)
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('group')
    setManualStack(state, defs, 'default')
    expect(state.hero.stackState?.activeId).toBe('group')
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('default')
    expect(stackEvents(state).at(-1)).toMatchObject({ reason: 'manual', toName: 'Default' })
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('default')
    setManualStack(state, defs, null)
    expect(state.hero.stackState).toMatchObject({ activeId: 'group', manualId: null, sinceMs: null })
    expect(stackEvents(state).at(-1)).toMatchObject({ reason: 'manualCleared', toName: 'Group' })
    expect(() => setManualStack(state, defs, 'nope')).toThrow()
  })

  it('a new combat starts without a manual pick', () => {
    const first = createCombat(setupWith([GROUP], 3), defs, 7)
    setManualStack(first, defs, 'default')
    const second = createCombat(setupWith([GROUP], 3), defs, 7)
    expect(second.hero.stackState).toEqual({ activeId: 'default', sinceMs: null, manualId: null })
  })

  it('pickStack leaves the RNG alone and commits nothing', () => {
    const state = createCombat(setupWith([GROUP, SINGLE], 3), defs, 7)
    const rng = { ...state.rng }
    const logLength = state.log.length
    const pick = pickStack(state, defs, state.hero, 0)
    expect(pick).toMatchObject({ id: 'group', reason: 'trigger' })
    expect(state.rng).toEqual(rng)
    expect(state.log).toHaveLength(logLength)
    expect(state.hero.stackState?.activeId).toBe('default')
  })

  it('logs no stack events and keeps the old path without stacks', () => {
    for (const stacks of [undefined, []]) {
      const state = createCombat(setupWith(stacks, 3), defs, 7)
      for (let i = 0; i < 300; i += 1) stepCombat(state, defs)
      expect(state.hero.ruleStacks).toBeUndefined()
      expect(state.hero.stackState).toBeUndefined()
      expect(stackEvents(state)).toHaveLength(0)
      expect(pickStack(state, defs, state.hero, state.timeMs)).toBeNull()
    }
  })

  it('deleting the active stack falls back to Default', () => {
    const state = createCombat(setupWith([GROUP, SINGLE], 3), defs, 7)
    nextAction(state)
    expect(state.hero.stackState?.activeId).toBe('group')
    setRuleStacks(state, [SINGLE], defs)
    expect(state.hero.stackState?.activeId).toBe('default')
    expect(stackEvents(state).at(-1)).toMatchObject({ reason: 'fallback', fromName: 'Group', toName: 'Default' })
    expect(state.log.some((event) => event.type === 'rulesChanged' && event.applied)).toBe(true)
    expect(activeRules(state.hero).rows).toBe(state.hero.priorityRows)
  })

  it('a deleted manual stack clears the manual pick', () => {
    const state = createCombat(setupWith([GROUP, SINGLE], 3), defs, 7)
    setManualStack(state, defs, 'single')
    setRuleStacks(state, [GROUP], defs)
    expect(state.hero.stackState?.manualId).toBeNull()
  })

  it('a parse error rejects the stacks and keeps the old ones', () => {
    const state = createCombat(setupWith([GROUP], 3), defs, 7)
    const bad = [{ id: 'default', name: 'Nope', when: [], rows: [] }]
    expect(parseRuleStacks(bad, defs).ok).toBe(false)
    setRuleStacks(state, bad, defs)
    expect(state.hero.ruleStacks).toEqual([GROUP])
    expect(state.log.at(-1)).toMatchObject({ type: 'rulesChanged', applied: false })
    const tooMany = [GROUP, SINGLE, { ...GROUP, id: 'c' }, { ...GROUP, id: 'd' }]
    expect(parseRuleStacks(tooMany, defs).ok).toBe(false)
    expect(parseRuleStacks([{ ...GROUP, name: 'x'.repeat(21) }], defs).ok).toBe(false)
    expect(parseRuleStacks([{ ...GROUP, rows: [{ skillId: 'missing' }] }], defs).ok).toBe(false)
    expect(parseRuleStacks([GROUP, GROUP], defs).ok).toBe(false)
  })
})
