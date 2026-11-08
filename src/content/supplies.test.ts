import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../sim/combat.ts'
import { formatEvent } from '../sim/log.ts'
import type { CombatSetup, LogEvent, PriorityRow } from '../sim/types.ts'

import { DUEL_BASIC_ID, ROOTMAW_ID, gameDefs, scenarios, setupForScenario } from './scenarios.ts'
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
  it('lists the decided supplies with their brew costs, and the ones a rule uses are supply skills', () => {
    expect(SUPPLIES.map((supply) => [supply.id, supply.price, supply.ruleUsed, supply.brew])).toEqual([
      ['healing-draught', 15, true, { materialId: 'hide', quantity: 3, gold: 5 }],
      ['antidote', 10, true, { materialId: 'shard', quantity: 2, gold: 3 }],
      ['smoke-bomb', 20, false, { materialId: 'scrap', quantity: 3, gold: 8 }],
      ['ward-charm', 20, true, { materialId: 'shard', quantity: 3, gold: 8 }],
      ['warming-tonic', 12, true, { materialId: 'hide', quantity: 2, gold: 4 }],
      ['greater-draught', null, true, { materialId: 'riftglass', quantity: 2, gold: 10 }],
      ['riftglass-ward', null, true, { materialId: 'riftglass', quantity: 2, gold: 12 }],
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

describe('the Warming Tonic', () => {
  it('clears Chill and Burn and heals 10% of maximum HP in one action, then is used up', () => {
    const defs = gameDefs()
    const row: PriorityRow = { skillId: 'warming-tonic', conditions: [{ kind: 'status', who: 'hero', statusId: 'chill', measure: 'stacks', operator: 'atLeast', value: 1 }] }
    const setup = withSupplies(ROOTMAW_ID, ['warming-tonic'], [row])
    const state = createCombat({ ...setup, enemies: [{ defId: 'fracture-wisp', slot: 0, level: 12 }] }, defs, 3)
    runCombat(state, defs, 120_000)
    const used = firstOf(state.log, 'supplyUse', (event) => event.supplyId === 'warming-tonic')
    if (used === undefined) throw new Error('the tonic was never used')
    const cleared = state.log.filter((event) => event.type === 'statusCleared' && event.timeMs === used.timeMs && event.actorId === state.hero.id)
    expect(cleared.map((event) => (event.type === 'statusCleared' ? event.statusId : ''))).toContain('chill')
    const heal = state.log.find((event) => event.type === 'heal' && event.timeMs === used.timeMs)
    expect(heal).toMatchObject({ amount: Math.round(state.hero.maxHp * 0.1) })
    expect(state.hero.supplies).toEqual([])
  })

  it('is a half-time supply with no cost or cooldown', () => {
    expect(skills['warming-tonic']).toMatchObject({ tags: ['supply'], cooldownSeconds: 0, actionTimeCoefficient: 0.5, supply: true })
  })
})

describe('crafted supplies', () => {
  it('heals 50% with the Greater Draught and raises a 30% barrier with the Riftglass Ward', () => {
    const defs = gameDefs()
    const draught = createCombat(withSupplies(DUEL_BASIC_ID, ['greater-draught'], [{ skillId: 'greater-draught', conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 30 }] }], 10), defs, 42)
    const maxHp = draught.hero.maxHp
    while (!draught.log.some((event) => event.type === 'supplyUse')) stepCombat(draught, defs)
    expect(firstOf(draught.log, 'heal', () => true)?.amount).toBe(Math.round(maxHp * 0.5))
    const row: PriorityRow = { skillId: 'riftglass-ward', conditions: [{ kind: 'telegraph', operator: 'present' }] }
    const ward = runCombat(createCombat(withSupplies(ROOTMAW_ID, ['riftglass-ward'], [row]), defs, 4), defs, 300_000)
    const used = firstOf(ward.log, 'supplyUse', (event) => event.supplyId === 'riftglass-ward')
    const barrier = ward.log.find((event) => event.type === 'barrier' && event.timeMs === used!.timeMs)
    expect(barrier).toMatchObject({ amount: ward.hero.maxHp * 0.3 })
  })
})

describe('Mend cleanses', () => {
  it('removes one Poison or Bleed each time it heals, never two', () => {
    const defs = gameDefs()
    scenarios['test-cleric-rootmaw'] = { ...scenarios['ref-cleric-rootmaw']!, id: 'test-cleric-rootmaw', heroLevel: 20 }
    const state = runCombat(createCombat(setupForScenario('test-cleric-rootmaw'), defs, 1), defs, 300_000)
    const mends = state.log.filter((event) => event.type === 'action' && event.skillId === 'mend')
    expect(mends.length).toBeGreaterThan(0)
    let cleansed = 0
    for (const mend of mends) {
      const cleared = state.log.filter((event) => event.type === 'statusCleared' && event.timeMs === mend.timeMs && event.actorId === state.hero.id)
      expect(cleared.length).toBeLessThanOrEqual(1)
      for (const event of cleared) {
        expect(['poison', 'bleed']).toContain(event.type === 'statusCleared' ? event.statusId : '')
        cleansed += 1
      }
    }
    expect(cleansed).toBeGreaterThan(0)
  })
})

describe('the Ward Charm', () => {
  it('raises a barrier of 20% of maximum HP when the rule sees a telegraph', () => {
    const defs = gameDefs()
    const row: PriorityRow = { skillId: 'ward-charm', conditions: [{ kind: 'telegraph', operator: 'present' }] }
    const state = runCombat(createCombat(withSupplies(ROOTMAW_ID, ['ward-charm'], [row]), defs, 4), defs, 300_000)
    const used = firstOf(state.log, 'supplyUse', (event) => event.supplyId === 'ward-charm')
    expect(used?.left).toBe(0)
    const barrier = state.log.find((event) => event.type === 'barrier' && event.timeMs === used!.timeMs)
    expect(barrier).toMatchObject({ amount: state.hero.maxHp * 0.2 })
    expect(state.hero.supplies).toEqual([])
  })
})

describe('Deserters snatch supplies', () => {
  /** A Deserter whose Rusted Cut always steals, so the test does not depend on the 20% roll. */
  function sureThief() {
    const defs = gameDefs()
    const deserter = defs.enemies['deserter']!
    const skills = (deserter.skills ?? []).map((skill) =>
      skill.id === 'rusted-cut' ? { ...skill, effects: skill.effects.map((effect) => (effect.kind === 'stealSupply' ? { ...effect, chance: 1 } : effect)) } : skill,
    )
    return { ...defs, enemies: { ...defs.enemies, deserter: { ...deserter, skills } } }
  }

  it('is a 20% chance on the real Rusted Cut', () => {
    const effects = gameDefs().enemies['deserter']!.skills!.find((skill) => skill.id === 'rusted-cut')!.effects
    expect(effects).toContainEqual({ kind: 'stealSupply', chance: 0.2 })
  })

  it('takes the last supply once per Deserter, and the win gives it back', () => {
    const defs = sureThief()
    const setup = withSupplies('ref-warrior-deserter', ['healing-draught', 'antidote'], [])
    const state = runCombat(createCombat(setup, defs, 3), defs, 300_000)
    const thefts = state.log.filter((event) => event.type === 'supplyTheft')
    expect(thefts.map((event) => (event.type === 'supplyTheft' ? [event.supplyId, event.returned] : null))).toEqual([
      ['antidote', false],
      ['antidote', true],
    ])
    expect(formatEvent(thefts[0]!)).toContain("snatches")
    expect(state.outcome).toBe('victory')
    expect([...state.hero.supplies].sort()).toEqual(['antidote', 'healing-draught'])
  })

  it('rolls nothing, and so changes nothing, when the hero carries no supplies', () => {
    const defs = sureThief()
    const plain = runCombat(createCombat(setupForScenario('ref-warrior-deserter'), defs, 3), defs, 300_000)
    const normal = gameDefs()
    const same = runCombat(createCombat(setupForScenario('ref-warrior-deserter'), normal, 3), normal, 300_000)
    expect(plain.log.some((event) => event.type === 'supplyTheft')).toBe(false)
    expect(plain.log).toEqual(same.log)
  })

  it('is avoided by the Fade Back dodge on the first Rusted Cut', () => {
    const defs = sureThief()
    const setup = withSupplies('ref-warrior-deserter', ['healing-draught'], [])
    const state = createCombat(setup, defs, 3)
    state.hero.skillDodgeUntilMs = 60_000
    runCombat(state, defs, 300_000)
    const dodged = state.log.find((event) => event.type === 'skillDodge')
    const stolen = state.log.find((event) => event.type === 'supplyTheft' && !event.returned)
    expect(dodged).toBeDefined()
    expect(stolen === undefined || stolen.timeMs > dodged!.timeMs).toBe(true)
  })
})
