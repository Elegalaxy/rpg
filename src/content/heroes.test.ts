import { describe, expect, it } from 'vitest'

import { deriveHeroStats } from '../sim/stats.ts'

import { referenceGear } from './gear.ts'
import { referenceHeroes } from './heroes.ts'

function percent(ratio: number): number {
  return ratio * 100
}

describe('reference hero content', () => {
  it('defines five Human level-20 heroes on 100% quality gear', () => {
    const heroes = [
      referenceHeroes.warrior,
      referenceHeroes.assassin,
      referenceHeroes.ranger,
      referenceHeroes.mage,
      referenceHeroes.cleric,
    ]
    expect(heroes.map((hero) => hero.classId)).toEqual([
      'warrior',
      'assassin',
      'ranger',
      'mage',
      'cleric',
    ])
    for (const hero of heroes) {
      expect(hero.race).toBe('human')
      expect(hero.level).toBe(20)
      const pieces = [
        hero.gear.mainHand,
        hero.gear.offHand,
        hero.gear.head,
        hero.gear.chest,
        hero.gear.hands,
        hero.gear.feet,
        ...hero.gear.accessories,
      ]
      for (const piece of pieces) {
        expect(piece).not.toBeNull()
        if (piece === null) continue
        expect(piece.itemLevel).toBe(20)
        expect(piece.quality).toBe(1)
      }
    }
    expect(referenceHeroes.warrior.gear.mainHand).toBe(referenceGear.oneHanded)
    expect(referenceHeroes.warrior.gear.offHand).toBe(referenceGear.shield)
    expect(referenceHeroes.warrior.gear.chest.category).toBe('heavy')
    expect(referenceHeroes.assassin.gear.mainHand.kind).toBe('dagger')
    expect(referenceHeroes.assassin.gear.offHand?.kind).toBe('dagger')
    expect(referenceHeroes.assassin.gear.chest.category).toBe('light')
    expect(referenceHeroes.ranger.gear.mainHand.kind).toBe('bow')
    expect(referenceHeroes.ranger.gear.offHand?.kind).toBe('quiver')
    expect(referenceHeroes.ranger.gear.chest.category).toBe('medium')
    expect(referenceHeroes.mage.gear.mainHand.kind).toBe('caster')
    expect(referenceHeroes.mage.gear.offHand?.kind).toBe('focus')
    expect(referenceHeroes.mage.gear.chest.category).toBe('cloth')
    expect(referenceHeroes.cleric.gear.mainHand.kind).toBe('caster')
    expect(referenceHeroes.cleric.gear.offHand?.kind).toBe('shield')
    expect(referenceHeroes.cleric.gear.chest.category).toBe('medium')
  })

  it('reproduces every published level-20 reference number from content', () => {
    const warrior = deriveHeroStats(referenceHeroes.warrior)
    expect(warrior.maxHp).toBe(370)
    expect(warrior.physicalPower).toBe(96)
    expect(warrior.armor).toBe(116)
    expect(warrior.resistance).toBe(60)
    expect(percent(warrior.critChance)).toBeCloseTo(11.4, 1)
    expect(percent(warrior.critDamage)).toBeCloseTo(162, 0)
    expect(percent(warrior.armorPenetration)).toBeCloseTo(12.97, 2)
    expect(percent(warrior.resourceGenerationBonus)).toBeCloseTo(12.12, 2)
    expect(warrior.actionTime).toBeCloseTo(1.72, 2)

    const assassin = deriveHeroStats(referenceHeroes.assassin)
    expect(assassin.maxHp).toBe(310)
    expect(assassin.physicalPower).toBeCloseTo(89.04, 2)
    expect(assassin.armor).toBe(49)
    expect(assassin.resistance).toBe(56)
    expect(assassin.evasion).toBe(36)
    expect(percent(assassin.critChance)).toBeCloseTo(17, 0)
    expect(percent(assassin.critDamage)).toBeCloseTo(159, 0)
    expect(percent(assassin.armorPenetration)).toBeCloseTo(10.59, 2)
    expect(percent(assassin.resourceGenerationBonus)).toBeCloseTo(8.33, 2)
    expect(assassin.actionTime).toBeCloseTo(1.15, 2)

    const ranger = deriveHeroStats(referenceHeroes.ranger)
    expect(ranger.maxHp).toBe(330)
    expect(ranger.physicalPower).toBeCloseTo(96.8, 1)
    expect(ranger.armor).toBe(70)
    expect(ranger.resistance).toBe(70)
    expect(ranger.evasion).toBe(28)
    expect(percent(ranger.critChance)).toBeCloseTo(16.2, 1)
    expect(percent(ranger.critDamage)).toBeCloseTo(161, 0)
    expect(percent(ranger.armorPenetration)).toBeCloseTo(12.22, 2)
    expect(percent(ranger.resourceGenerationBonus)).toBeCloseTo(8.33, 2)
    expect(ranger.actionTime).toBeCloseTo(1.72, 2)

    const mage = deriveHeroStats(referenceHeroes.mage)
    expect(mage.maxHp).toBe(310)
    expect(mage.magicalPower).toBeCloseTo(130.4, 1)
    expect(mage.armor).toBe(35)
    expect(mage.resistance).toBe(98)
    expect(percent(mage.critChance)).toBeCloseTo(11.4, 1)
    expect(percent(mage.critDamage)).toBeCloseTo(155, 0)
    expect(percent(mage.magicalPenetration)).toBeCloseTo(16.19, 2)
    expect(percent(mage.cooldownReduction)).toBeCloseTo(12.14, 2)
    expect(percent(mage.resourceGenerationBonus)).toBeCloseTo(9.68, 2)
    expect(mage.actionTime).toBeCloseTo(1.72, 2)

    const cleric = deriveHeroStats(referenceHeroes.cleric)
    expect(cleric.maxHp).toBe(370)
    expect(cleric.magicalPower).toBe(88)
    expect(cleric.healingPower).toBe(44)
    expect(cleric.armor).toBe(88)
    expect(cleric.resistance).toBe(88)
    expect(percent(cleric.critChance)).toBeCloseTo(10.6, 1)
    expect(percent(cleric.critDamage)).toBeCloseTo(155, 0)
    expect(percent(cleric.magicalPenetration)).toBeCloseTo(11.43, 2)
    expect(percent(cleric.cooldownReduction)).toBeCloseTo(8.57, 2)
    expect(percent(cleric.resourceGenerationBonus)).toBeCloseTo(15.28, 2)
    expect(cleric.actionTime).toBeCloseTo(1.75, 2)
  })
})
