import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../sim/combat.ts'
import { formatEvent } from '../sim/log.ts'
import type { CombatSetup, LogEvent, PriorityRow } from '../sim/types.ts'

import { DUEL_BASIC_ID, ROOTMAW_ID, gameDefs, setupForScenario } from './scenarios.ts'
import { SUPPLIES, supplyTable } from './supplies.ts'
import { skills } from './skills.ts'

const DRAUGHT_ROW: PriorityRow = {
  skillId: 'healing-draught',
  conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }],
}
const ANTIDOTE_ROW: PriorityRow = {
  skillId: 'antidote',
  conditions: [{ kind: 'status', who: 'hero', statusId: 'poison', measure: 'stacks', operator: 'atLeast', value: 3 }],
}

function withSupplies(scenarioId: string, supplies: string[], rows: PriorityRow[], startingHp?: number): CombatSetup {
  const setup = setupForScenario(scenarioId)
  return {
    ...setup,
    hero: {
      ...setup.hero,
      supplies,
      priorityRows: [...rows, ...(setup.hero.priorityRows ?? [])],
      ...(startingHp === undefined ? {} : { startingHp }),
    },
  }
}

function firstOf<T extends LogEvent['type']>(log: readonly LogEvent[], type: T, test: (event: Extract<LogEvent, { type: T }>) => boolean) {
  return log.find((event): event is Extract<LogEvent, { type: T }> => event.type === type && test(event as Extract<LogEvent, { type: T }>))
}

describe('supplies', () => {
  it('lists the three decided supplies, and the two a rule uses are supply skills', () => {
    expect(SUPPLIES.map((supply) => [supply.id, supply.price, supply.ruleUsed])).toEqual([
      ['healing-draught', 15, true],
      ['antidote', 10, true],
      ['smoke-bomb', 20, false],
    ])
    for (const supply of SUPPLIES) expect(skills[supply.id]?.supply === true).toBe(supply.ruleUsed)
    expect(supplyTable['antidote']?.name).toBe('Antidote')
  })

  it('drinks a Healing Draught for 30% of maximum HP at half action time, once per carried draught', () => {
    const defs = gameDefs()
    const state = createCombat(withSupplies(DUEL_BASIC_ID, ['healing-draught'], [DRAUGHT_ROW], 10), defs, 42)
    const maxHp = state.hero.maxHp
    while (!state.log.some((event) => event.type === 'supplyUse')) stepCombat(state, defs)
    const used = firstOf(state.log, 'supplyUse', () => true)
    expect(used?.supplyId).toBe('healing-draught')
    expect(used?.left).toBe(0)
    expect(used?.nextReadyMs).toBeGreaterThan(used!.timeMs)
    expect(formatEvent(used!)).toContain('uses a Healing Draught (0 left).')
    expect(state.log.some((event) => event.type === 'action' && event.skillId === 'healing-draught')).toBe(false)
    const heal = firstOf(state.log, 'heal', () => true)
    expect(heal?.amount).toBe(Math.round(maxHp * 0.3))
    expect(heal?.targetHpBefore).toBe(10)
    expect(heal?.targetHpAfter).toBe(10 + Math.round(maxHp * 0.3))
    expect(state.hero.supplies).toEqual([])
  })

  it('skips a supply row with none left and falls through to the next row', () => {
    const defs = gameDefs()
    const state = createCombat(withSupplies(DUEL_BASIC_ID, [], [DRAUGHT_ROW], 10), defs, 42)
    while (!state.log.some((event) => event.type === 'action' && event.actorId === state.hero.id)) stepCombat(state, defs)
    const skip = firstOf(state.log, 'priority', (event) => event.skillId === 'healing-draught')
    expect(skip?.decision).toBe('skip')
    expect(skip?.reason).toBe('none left')
    expect(firstOf(state.log, 'heal', () => true)).toBeUndefined()
  })

  it('uses an Antidote to clear Poison when the rule says so', () => {
    const defs = gameDefs()
    const state = createCombat(withSupplies(ROOTMAW_ID, ['antidote'], [ANTIDOTE_ROW]), defs, 6)
    runCombat(state, defs, 120_000)
    const used = firstOf(state.log, 'supplyUse', (event) => event.supplyId === 'antidote')
    if (used === undefined) throw new Error('the antidote was never used')
    const cleared = state.log.filter((event) => event.type === 'statusCleared' && event.timeMs === used.timeMs)
    expect(cleared.map((event) => (event.type === 'statusCleared' ? event.statusId : ''))).toContain('poison')
    expect(state.hero.supplies).toEqual([])
  })

  it('is a half-time action with no cost or cooldown, tagged as a supply', () => {
    expect(skills['healing-draught']?.tags).toEqual(['supply'])
    expect(skills['antidote']?.cooldownSeconds).toBe(0)
    expect(skills['antidote']?.actionTimeCoefficient).toBe(0.5)
  })
})
