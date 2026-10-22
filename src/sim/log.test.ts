import { describe, expect, it } from 'vitest'

import { formatEvent } from './log.ts'
import type { DamageEvent, LogEvent } from './types.ts'

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
