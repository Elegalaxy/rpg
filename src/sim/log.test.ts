import { describe, expect, it, vi } from 'vitest'

import { createCombat, runCombat } from './combat.ts'
import { formatEvent, summarizeDefeat } from './log.ts'
import type { CombatSetup, DamageEvent, EnemyDef, GameDefs, HpLossEvent, LogEvent, StatusTickEvent } from './types.ts'

function damageEvent(overrides: Partial<DamageEvent> = {}): DamageEvent {
  return {
    type: 'damage',
    timeMs: 1724,
    actorId: 'hero',
    actorName: 'Warrior',
    targetId: 'dummy',
    targetName: 'Standard Dummy',
    targetHpBefore: 480,
    targetHpAfter: 419,
    hitChance: 0.71,
    hit: true,
    crit: false,
    school: 'physical',
    power: 96,
    coefficient: 1,
    outgoingModifier: 1,
    consistency: 0,
    damageFloor: 0.6,
    damageCeiling: 1,
    consistencyRoll: 0.8,
    critChance: 0.114,
    critRoll: 0.5,
    critDamage: 1.62,
    barrier: 0,
    barrierAbsorbed: 0,
    overflow: 76.8,
    penetration: 0.12972972972972974,
    defense: 45,
    attackerLevel: 20,
    reduction: 0.2,
    incomingModifier: 1,
    raw: 96,
    afterOutgoing: 96,
    afterConsistency: 76.8,
    afterCrit: 76.8,
    afterDefense: 61.44,
    afterIncoming: 61.44,
    hpDamage: 61,
    ...overrides,
  }
}

describe('formatEvent', () => {
  it('writes each combat event in plain English', () => {
    const events: LogEvent[] = [
      {
        type: 'encounterStart',
        timeMs: 0,
        seed: 42,
        heroId: 'ref-human-warrior',
        heroName: 'Warrior',
        enemies: [{ id: 'dummy-standard-20#0', name: 'Standard Dummy', slot: 0 }],
      },
      {
        type: 'action',
        timeMs: 1724,
        actorId: 'ref-human-warrior',
        actorName: 'Warrior',
        targetId: 'dummy-standard-20#0',
        targetName: 'Standard Dummy',
        action: 'basicAttack',
        skillId: null,
        skillName: null,
        scheduledMs: 1724,
        nextReadyMs: 3448,
        cooldownReadyMs: null,
      },
      {
        type: 'hitRoll',
        timeMs: 1724,
        actorId: 'ref-human-warrior',
        actorName: 'Warrior',
        targetId: 'dummy-standard-20#0',
        targetName: 'Standard Dummy',
        roll: 0.42,
        hitChance: 0.71,
        accuracy: 16,
        evasion: 20,
        hit: true,
      },
      damageEvent(),
      {
        type: 'hitRoll',
        timeMs: 2200,
        actorId: 'dummy-standard-20#0',
        actorName: 'Standard Dummy',
        targetId: 'ref-human-warrior',
        targetName: 'Warrior',
        roll: 0.99,
        hitChance: 0.89,
        accuracy: 30,
        evasion: 16,
        hit: false,
      },
      {
        type: 'death',
        timeMs: 25860,
        actorId: 'dummy-standard-20#0',
        actorName: 'Standard Dummy',
        killerId: 'ref-human-warrior',
        killerName: 'Warrior',
      },
      { type: 'encounterEnd', timeMs: 25860, outcome: 'victory' },
    ]
    const lines = events.map(formatEvent)
    console.log('[combat] formatted events', lines)
    expect(lines[0]).toBe('At 0.000s, encounter started with seed 42. Warrior faces Standard Dummy.')
    expect(lines[1]).toBe('At 1.724s, Warrior basic attacks Standard Dummy. Next ready at 3.448s.')
    expect(lines[2]).toBe(
      'At 1.724s, Warrior hit roll 0.42 against 0.71 (Accuracy 16, Evasion 20): hit.',
    )
    expect(lines[3]).toContain('Warrior deals 61 physical damage to Standard Dummy')
    expect(lines[3]).toContain('Power 96 × 1 = 96')
    expect(lines[3]).toContain('consistency 0 roll 0.8')
    expect(lines[3]).toContain('floor 0.6 ceiling 1')
    expect(lines[3]).toContain('critical no')
    expect(lines[3]).toContain('barrier absorbed 0 of 0')
    expect(lines[3]).toContain('attacker level 20')
    expect(lines[3]).toContain('rounded 61.')
    expect(lines[4]).toContain(': miss.')
    expect(lines[5]).toBe('At 25.860s, Standard Dummy dies, killed by Warrior.')
    expect(lines[6]).toBe('At 25.860s, encounter ended: victory.')
  })
})

const ITEM_LEVEL = 20
const QUALITY = 1

function defeatSetup(): CombatSetup {
  const armor = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  })
  return {
    hero: {
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
    },
    enemies: [{ defId: 'dummy', slot: 0 }],
  }
}

function defeatDefs(): GameDefs {
  const enemy: EnemyDef = {
    id: 'dummy',
    name: 'Dummy',
    level: 20,
    archetype: 'standard',
    school: 'physical',
    overrides: { actionTime: 1, power: 5_000, maxHp: 1_000_000 },
  }
  return { enemies: { dummy: enemy }, skills: {}, statuses: {} }
}

describe('summarizeDefeat', () => {
  it('returns the hero HP losses that led to the defeat and the statuses active at death', () => {
    const defs = defeatDefs()
    const state = createCombat(defeatSetup(), defs, 42)
    state.hero.statuses.chill = {
      name: 'Chill',
      stacks: 2,
      expiresMs: 60_000,
      slowByStack: [0.1, 0.07, 0.05],
    }
    runCombat(state, defs, 30_000)
    const deathIndex = state.log.findIndex((event) => event.type === 'death' && event.actorId === state.hero.id)
    const tick: StatusTickEvent = {
      type: 'statusTick',
      timeMs: 1000,
      sourceId: 'dummy',
      sourceName: 'Dummy',
      targetId: state.hero.id,
      targetName: state.hero.name,
      statusId: 'bleed',
      statusName: 'Bleed',
      school: 'physical',
      stacks: 1,
      intensity: 1,
      power: 1,
      coefficient: 0.1,
      raw: 1,
      penetration: 0,
      defense: 0,
      attackerLevel: 20,
      reduction: 0,
      afterDefense: 1,
      hpDamage: 1,
      targetHpBefore: 2,
      targetHpAfter: 1,
      barrierBypassed: true,
      crit: false,
      varianceRoll: false,
    }
    const loss: HpLossEvent = {
      type: 'hpLoss',
      timeMs: 1000,
      actorId: state.hero.id,
      actorName: state.hero.name,
      skillId: 'reckless',
      amount: 1,
      hpBefore: 3,
      hpAfter: 2,
      barrierBypassed: true,
      defenseBypassed: true,
    }
    state.log.splice(deathIndex, 0, tick, loss)
    const sample = state.log.find((event) => event.type === 'damage' && event.targetId === state.hero.id)
    if (sample === undefined || sample.type !== 'damage') throw new Error('defeat log has no hero damage')
    const ignored = [
      { ...sample, targetHpBefore: 10, targetHpAfter: 10, hpDamage: 0 },
      { ...sample, targetId: 'dummy', targetName: 'Dummy', targetHpBefore: 5, targetHpAfter: 4 },
      { ...sample, timeMs: 99_999, targetHpBefore: 4, targetHpAfter: 0 },
    ]
    state.log.splice(deathIndex, 0, ignored[0]!, ignored[1]!)
    state.log.push(ignored[2]!)

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    let summary: ReturnType<typeof summarizeDefeat>
    let printed = 0
    try {
      summary = summarizeDefeat(state)
      printed = logSpy.mock.calls.length
    } finally {
      logSpy.mockRestore()
    }
    console.log('[sim] summarizeDefeat', {
      outcome: state.outcome,
      losses: summary.hpLoss.map((event) => event.type),
      chill: summary.statuses.chill,
      printed,
    })

    expect(printed).toBe(0)
    expect(state.outcome).toBe('defeat')
    expect(summary.statuses).not.toBe(state.hero.statuses)
    expect(summary.statuses).toEqual(state.hero.statuses)
    expect(summary.statuses.chill?.stacks).toBe(2)
    expect(summary.hpLoss.map((event) => event.type)).toEqual(['damage', 'statusTick', 'hpLoss'])
    expect(summary.hpLoss[0]).toMatchObject({ type: 'damage', targetId: state.hero.id, actorName: 'Dummy' })
    const killing = summary.hpLoss[0]
    if (killing?.type === 'damage') expect(killing.targetHpAfter).toBeLessThan(killing.targetHpBefore)
    expect(summary.hpLoss[1]).toBe(tick)
    expect(summary.hpLoss[2]).toBe(loss)
    expect(summary.hpLoss.some((event) => event.type === 'damage' && event.targetId !== state.hero.id)).toBe(false)
    expect(summary.hpLoss.includes(ignored[2]!)).toBe(false)

    expect(() => summarizeDefeat({ ...state, outcome: 'victory' })).toThrow(/defeat/)
    expect(() => summarizeDefeat({ ...state, outcome: 'timeout' })).toThrow(/defeat/)
  })
})
