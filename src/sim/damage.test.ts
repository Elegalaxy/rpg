import { describe, expect, it } from 'vitest'

import { DEFENSE_REDUCTION_CAP } from './constants.ts'
import { basicHitChance, consistencyBounds, resolveDamage } from './damage.ts'
import type { DamageInput, DamageRolls } from './types.ts'

function damageInput(
  overrides: Partial<Omit<DamageInput, 'rolls'>> & { rolls?: Partial<DamageRolls> } = {},
): DamageInput {
  const { rolls, ...rest } = overrides
  return {
    accuracy: 0,
    evasion: 0,
    power: 100,
    coefficient: 1,
    outgoingModifier: 1,
    consistency: 0,
    critChance: 0,
    critDamage: 1.5,
    barrier: 0,
    penetration: 0,
    defense: 0,
    attackerLevel: 1,
    incomingModifier: 1,
    school: 'physical',
    ...rest,
    rolls: { hitRoll: 0, consistencyRoll: 0.8, critRoll: 1, ...rolls },
  }
}

describe('basic hit chance', () => {
  it('uses 75% when Accuracy and Evasion are equal', () => {
    const chance = basicHitChance(0, 0)
    console.log('[combat] hit chance equal ratings', { chance })
    expect(chance).toBe(0.75)
    expect(basicHitChance(16, 16)).toBe(0.75)
  })

  it('adds Accuracy and Evasion as percentage points', () => {
    // 75 + 16 − 20 = 71 percentage points.
    const chance = basicHitChance(16, 20)
    console.log('[combat] hit chance 16 vs 20', { chance })
    expect(chance).toBe(0.71)
  })

  it('clamps a low rating gap to 5%', () => {
    // 75 + 0 − 100 = −25, clamped to 5.
    const chance = basicHitChance(0, 100)
    const hit = resolveDamage(damageInput({ accuracy: 0, evasion: 100, rolls: { hitRoll: 0 } }))
    const miss = resolveDamage(
      damageInput({ accuracy: 0, evasion: 100, critChance: 1, rolls: { hitRoll: 0.05, critRoll: 0 } }),
    )
    console.log('[combat] hit chance low clamp', { chance, hit: hit.hit, miss: miss.hit, missCrit: miss.crit })
    expect(chance).toBe(0.05)
    expect(hit.hitChance).toBe(0.05)
    expect(hit.hit).toBe(true)
    expect(miss.hit).toBe(false)
    expect(miss.crit).toBe(false)
    expect(miss.hpDamage).toBe(0)
  })

  it('clamps a high rating gap to 95%', () => {
    // 75 + 100 − 0 = 175, clamped to 95.
    const chance = basicHitChance(100, 0)
    const hit = resolveDamage(damageInput({ accuracy: 100, evasion: 0, rolls: { hitRoll: 0.949 } }))
    const miss = resolveDamage(damageInput({ accuracy: 100, evasion: 0, rolls: { hitRoll: 0.95 } }))
    console.log('[combat] hit chance high clamp', { chance, hit: hit.hit, miss: miss.hit })
    expect(chance).toBe(0.95)
    expect(hit.hitChance).toBe(0.95)
    expect(hit.hit).toBe(true)
    expect(miss.hit).toBe(false)
    expect(miss.hpDamage).toBe(0)
  })
})

describe('consistency bounds', () => {
  it('is 60%–100% at Consistency 0 and 85%–100% at Consistency 100', () => {
    const zero = consistencyBounds(0)
    const full = consistencyBounds(100)
    console.log('[combat] consistency bounds', { zero, full })
    expect(zero).toEqual({ floor: 0.6, ceiling: 1 })
    expect(full).toEqual({ floor: 0.85, ceiling: 1 })
  })
})

describe('resolveDamage', () => {
  it('applies a fixed consistency roll with no crit and no defense', () => {
    // 100 × 1 × 1 × 0.8 = 80.
    const result = resolveDamage(damageInput({ power: 100, rolls: { consistencyRoll: 0.8 } }))
    console.log('[combat] fixed roll plain', { hpDamage: result.hpDamage, afterConsistency: result.afterConsistency })
    expect(result.hit).toBe(true)
    expect(result.crit).toBe(false)
    expect(result.raw).toBe(100)
    expect(result.afterOutgoing).toBe(100)
    expect(result.afterConsistency).toBe(80)
    expect(result.afterCrit).toBe(80)
    expect(result.hpDamage).toBe(80)
    expect(result.damageFloor).toBe(0.6)
    expect(result.damageCeiling).toBe(1)
  })

  it('uses the 60% floor and the 100% ceiling as fixed rolls', () => {
    const floor = resolveDamage(damageInput({ power: 100, rolls: { consistencyRoll: 0.6 } }))
    const ceiling = resolveDamage(damageInput({ power: 50, rolls: { consistencyRoll: 1 } }))
    console.log('[combat] consistency endpoints', { floor: floor.hpDamage, ceiling: ceiling.hpDamage })
    expect(floor.hpDamage).toBe(60)
    expect(ceiling.hpDamage).toBe(50)
  })

  it('applies outgoing, consistency, crit, barrier, defense, then incoming', () => {
    // Power 100 × 1 = 100
    // outgoing ×2 = 200
    // consistency ×0.8 = 160
    // crit ×1.5 = 240
    // barrier 20 leaves overflow 220
    // Armor 100 at level 10: reduction = 100 / (100 + 50 + 50) = 0.5, so 110
    // incoming ×3 = 330
    const result = resolveDamage(
      damageInput({
        power: 100,
        outgoingModifier: 2,
        critChance: 1,
        critDamage: 1.5,
        barrier: 20,
        defense: 100,
        attackerLevel: 10,
        incomingModifier: 3,
        rolls: { consistencyRoll: 0.8, critRoll: 0 },
      }),
    )
    console.log('[combat] full pipeline', {
      afterOutgoing: result.afterOutgoing,
      afterConsistency: result.afterConsistency,
      afterCrit: result.afterCrit,
      overflow: result.overflow,
      reduction: result.reduction,
      afterDefense: result.afterDefense,
      hpDamage: result.hpDamage,
    })
    expect(result.crit).toBe(true)
    expect(result.raw).toBe(100)
    expect(result.afterOutgoing).toBe(200)
    expect(result.afterConsistency).toBe(160)
    expect(result.afterCrit).toBe(240)
    expect(result.barrierAbsorbed).toBe(20)
    expect(result.overflow).toBe(220)
    expect(result.reduction).toBe(0.5)
    expect(result.afterDefense).toBe(110)
    expect(result.afterIncoming).toBe(330)
    expect(result.hpDamage).toBe(330)
  })

  it('matches the level-20 Warrior basic attack against 45 Armor', () => {
    // Penetration = 0.4 × 24 / 74 = 24/185.
    // Effective Armor = 45 × (1 − 24/185) = 1449/37.
    // Reduction = (1449/37) / (1449/37 + 150) = 483/2333.
    // Kept = 1850/2333.
    // 96 × 0.8 × 1850/2333 = 142080/2333 ≈ 60.900, which rounds to 61.
    const penetration = (0.4 * 24) / (24 + 50)
    const result = resolveDamage(
      damageInput({
        power: 96,
        accuracy: 16,
        evasion: 20,
        penetration,
        defense: 45,
        attackerLevel: 20,
        critChance: 0.114,
        critDamage: 1.62,
        rolls: { hitRoll: 0, consistencyRoll: 0.8, critRoll: 0.5 },
      }),
    )
    console.log('[combat] warrior vs 45 armor', {
      hitChance: result.hitChance,
      reduction: result.reduction,
      afterIncoming: result.afterIncoming,
      hpDamage: result.hpDamage,
    })
    expect(result.hitChance).toBe(0.71)
    expect(result.crit).toBe(false)
    expect(result.reduction).toBeCloseTo(483 / 2333, 12)
    expect(result.afterIncoming).toBeCloseTo(142080 / 2333, 8)
    expect(result.hpDamage).toBe(61)
  })

  it('applies the Warrior crit multiplier before Armor', () => {
    // 96 × 0.8 × 1.62 = 124.416, then × 1850/2333 ≈ 98.658, which rounds to 99.
    const penetration = (0.4 * 24) / (24 + 50)
    const result = resolveDamage(
      damageInput({
        power: 96,
        penetration,
        defense: 45,
        attackerLevel: 20,
        critChance: 0.114,
        critDamage: 1.62,
        rolls: { consistencyRoll: 0.8, critRoll: 0 },
      }),
    )
    const expected = ((96 * 0.8 * 1.62 * 1850) / 2333)
    console.log('[combat] warrior crit', { afterIncoming: result.afterIncoming, expected, hpDamage: result.hpDamage })
    expect(result.crit).toBe(true)
    expect(result.afterCrit).toBeCloseTo(124.416, 6)
    expect(result.afterIncoming).toBeCloseTo(expected, 6)
    expect(result.hpDamage).toBe(Math.round(expected))
  })

  it('rounds half up to the nearest integer', () => {
    // 2.5 and 3.5 are the halfway cases. Math.round sends both away from zero.
    const twoPointFive = resolveDamage(damageInput({ power: 2.5, rolls: { consistencyRoll: 1 } }))
    const threePointFive = resolveDamage(damageInput({ power: 3.5, rolls: { consistencyRoll: 1 } }))
    console.log('[combat] nearest integer', {
      twoPointFive: twoPointFive.afterIncoming,
      twoRounded: twoPointFive.hpDamage,
      threePointFive: threePointFive.afterIncoming,
      threeRounded: threePointFive.hpDamage,
    })
    expect(twoPointFive.afterIncoming).toBe(2.5)
    expect(twoPointFive.hpDamage).toBe(3)
    expect(threePointFive.afterIncoming).toBe(3.5)
    expect(threePointFive.hpDamage).toBe(4)
  })

  it('deals at least 1 HP on a successful unshielded hit', () => {
    // 1 × 0.6 × (1 − 0.8) = 0.12, which rounds to 0, then the unshielded minimum raises it to 1.
    const result = resolveDamage(
      damageInput({
        power: 1,
        defense: 1000,
        attackerLevel: 1,
        rolls: { consistencyRoll: 0.6 },
      }),
    )
    console.log('[combat] unshielded minimum', {
      reduction: result.reduction,
      afterIncoming: result.afterIncoming,
      hpDamage: result.hpDamage,
    })
    expect(result.reduction).toBe(DEFENSE_REDUCTION_CAP)
    expect(result.afterIncoming).toBeCloseTo(0.12, 8)
    expect(result.afterIncoming).toBeLessThan(0.5)
    expect(result.hpDamage).toBe(1)
  })

  it('lets a barrier reduce HP damage to 0', () => {
    const absorbed = resolveDamage(
      damageInput({
        power: 1,
        defense: 1000,
        attackerLevel: 1,
        barrier: 1,
        rolls: { consistencyRoll: 0.6 },
      }),
    )
    const overflow = resolveDamage(
      damageInput({
        power: 10,
        barrier: 9.75,
        defense: 0,
        attackerLevel: 1,
        rolls: { consistencyRoll: 1 },
      }),
    )
    console.log('[combat] barrier zeros damage', {
      absorbed: absorbed.hpDamage,
      overflow: overflow.overflow,
      overflowDamage: overflow.hpDamage,
    })
    expect(absorbed.barrierAbsorbed).toBeCloseTo(0.6, 8)
    expect(absorbed.overflow).toBe(0)
    expect(absorbed.hpDamage).toBe(0)
    expect(overflow.overflow).toBe(0.25)
    expect(overflow.afterIncoming).toBe(0.25)
    expect(overflow.hpDamage).toBe(0)
  })

  it('deals no damage and does not crit on a miss', () => {
    const result = resolveDamage(
      damageInput({
        power: 100,
        critChance: 1,
        critDamage: 2,
        rolls: { hitRoll: 0.99, critRoll: 0, consistencyRoll: 1 },
      }),
    )
    console.log('[combat] miss', { hit: result.hit, crit: result.crit, hpDamage: result.hpDamage })
    expect(result.hit).toBe(false)
    expect(result.crit).toBe(false)
    expect(result.hpDamage).toBe(0)
    expect(result.afterCrit).toBe(0)
  })
})
