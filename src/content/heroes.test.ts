import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'
import { deriveHeroStats } from '../sim/stats.ts'

import { referenceGear } from './gear.ts'
import {
  racialStartingAttributes,
  referenceHeroAtLevel,
  referenceHeroes,
  splitReferenceAttributes,
} from './heroes.ts'

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
    expect(warrior.accuracy).toBe(16)
    expect(warrior.evasion).toBe(16)
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
    expect(assassin.accuracy).toBe(30)
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
    expect(ranger.accuracy).toBe(28)
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
    expect(mage.accuracy).toBe(16)
    expect(mage.evasion).toBe(16)
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
    expect(cleric.accuracy).toBe(14)
    expect(cleric.evasion).toBe(14)
    expect(percent(cleric.critChance)).toBeCloseTo(10.6, 1)
    expect(percent(cleric.critDamage)).toBeCloseTo(155, 0)
    expect(percent(cleric.magicalPenetration)).toBeCloseTo(11.43, 2)
    expect(percent(cleric.cooldownReduction)).toBeCloseTo(8.57, 2)
    expect(percent(cleric.resourceGenerationBonus)).toBeCloseTo(15.28, 2)
    expect(cleric.actionTime).toBeCloseTo(1.75, 2)
  })

  it('reproduces the published level-20 heroes from the level-L generator', () => {
    for (const classId of HERO_CLASSES) {
      const published = referenceHeroes[classId]
      const generated = referenceHeroAtLevel(classId, 20)
      const derived = deriveHeroStats(generated)
      console.log('[hero] level-20 comparison', {
        classId,
        attributes: generated.attributes,
        maxHp: derived.maxHp,
        physicalPower: derived.physicalPower,
        magicalPower: derived.magicalPower,
        healingPower: derived.healingPower,
        armor: derived.armor,
        resistance: derived.resistance,
        accuracy: derived.accuracy,
        evasion: derived.evasion,
        critChance: derived.critChance,
        critDamage: derived.critDamage,
        armorPenetration: derived.armorPenetration,
        magicalPenetration: derived.magicalPenetration,
        cooldownReduction: derived.cooldownReduction,
        resourceGenerationBonus: derived.resourceGenerationBonus,
        actionTime: derived.actionTime,
      })
      expect(generated).toEqual(published)
      expect(derived).toEqual(deriveHeroStats(published))
      expect(generated.gear).toBe(published.gear)
      for (const piece of [
        generated.gear.mainHand,
        generated.gear.offHand,
        generated.gear.head,
        generated.gear.chest,
        generated.gear.hands,
        generated.gear.feet,
        ...generated.gear.accessories,
      ]) {
        expect(piece).not.toBeNull()
        if (piece === null) continue
        expect(piece.itemLevel).toBe(20)
        expect(piece.quality).toBe(1)
        expect('modifiers' in piece).toBe(false)
      }
    }
  })

  it('floors proportional shares and breaks remainder ties STR, VIT, AGI, INT, SPI', () => {
    const tied = splitReferenceAttributes(
      { strength: 2, vitality: 2, agility: 1, intellect: 1, spirit: 1 },
      1,
    )
    console.log('[hero] remainder tie', tied)
    expect(tied).toEqual({ strength: 15, vitality: 14, agility: 7, intellect: 7, spirit: 7 })

    const warrior = referenceHeroAtLevel('warrior', 1)
    const points =
      warrior.attributes.strength +
      warrior.attributes.vitality +
      warrior.attributes.agility +
      warrior.attributes.intellect +
      warrior.attributes.spirit
    console.log('[hero] level-1 warrior', { points, attributes: warrior.attributes, gear: warrior.gear.mainHand })
    expect(points).toBe(50)
    expect(warrior.attributes).toEqual({
      strength: 14,
      vitality: 12,
      agility: 9,
      intellect: 6,
      spirit: 9,
    })
    expect(warrior.level).toBe(1)
    expect(warrior.gear.mainHand.kind).toBe('oneHanded')
    expect(warrior.gear.mainHand.itemLevel).toBe(1)
    expect(warrior.gear.mainHand.quality).toBe(1)
    expect(warrior.gear.offHand?.kind).toBe('shield')
    expect(warrior.gear.chest.category).toBe('heavy')
    expect(warrior.gear).not.toBe(referenceHeroes.warrior.gear)
    expect(() => referenceHeroAtLevel('warrior', 0)).toThrow(/positive integer/)
    expect(() => referenceHeroAtLevel('warrior', 1.5)).toThrow(/positive integer/)
  })

  it('gives leftover points to the largest remainder, with STR before VIT before AGI before INT before SPI', () => {
    const cases = [
      {
        classId: 'assassin' as const,
        level: 3,
        attributes: { strength: 11, vitality: 10, agility: 18, intellect: 9, spirit: 6 },
      },
      {
        classId: 'ranger' as const,
        level: 11,
        attributes: { strength: 18, vitality: 14, agility: 22, intellect: 8, spirit: 8 },
      },
      {
        classId: 'mage' as const,
        level: 12,
        attributes: { strength: 8, vitality: 13, agility: 13, intellect: 28, spirit: 10 },
      },
      {
        classId: 'cleric' as const,
        level: 15,
        attributes: { strength: 9, vitality: 20, agility: 12, intellect: 18, spirit: 19 },
      },
      {
        classId: 'warrior' as const,
        level: 19,
        attributes: { strength: 23, vitality: 21, agility: 16, intellect: 10, spirit: 16 },
      },
    ]
    for (const entry of cases) {
      const split = splitReferenceAttributes(referenceHeroes[entry.classId].attributes, entry.level)
      const hero = referenceHeroAtLevel(entry.classId, entry.level)
      const points =
        split.strength + split.vitality + split.agility + split.intellect + split.spirit
      console.log('[hero] largest remainder', {
        classId: entry.classId,
        level: entry.level,
        budget: 50 + 2 * (entry.level - 1),
        split,
      })
      expect(points).toBe(50 + 2 * (entry.level - 1))
      expect(split).toEqual(entry.attributes)
      expect(hero.attributes).toEqual(entry.attributes)
      expect(hero.level).toBe(entry.level)
    }
  })

  it('keeps the level-20 slot layout and scales every piece to item level L at 100% quality', () => {
    for (const classId of HERO_CLASSES) {
      const published = referenceHeroes[classId]
      const scaled = referenceHeroAtLevel(classId, 8)
      const publishedPieces = gearPieces(published.gear)
      const scaledPieces = gearPieces(scaled.gear)
      console.log('[hero] scaled gear', {
        classId,
        level: scaled.level,
        pieces: scaledPieces.map((piece) =>
          piece === null
            ? null
            : { id: piece.id, itemLevel: piece.itemLevel, quality: piece.quality },
        ),
      })
      expect(scaled.gear).not.toBe(published.gear)
      expect(scaledPieces).toHaveLength(publishedPieces.length)
      for (let index = 0; index < publishedPieces.length; index += 1) {
        const source = publishedPieces[index]
        const piece = scaledPieces[index]
        expect(source).not.toBeNull()
        expect(piece).not.toBeNull()
        if (source === null || piece === null) continue
        expect(piece).not.toBe(source)
        expect(piece.id).toBe(source.id)
        expect(piece.itemLevel).toBe(8)
        expect(piece.quality).toBe(1)
        expect('modifiers' in piece).toBe(false)
        if ('kind' in source && 'kind' in piece) expect(piece.kind).toBe(source.kind)
        if ('slot' in source && 'slot' in piece) expect(piece.slot).toBe(source.slot)
        if ('category' in source && 'category' in piece) expect(piece.category).toBe(source.category)
      }
    }
  })

  it('locks the four racial starting attribute lines', () => {
    const order = ['strength', 'vitality', 'agility', 'intellect', 'spirit']
    console.log('[hero] racial bases', racialStartingAttributes)
    expect(racialStartingAttributes.human).toEqual({
      strength: 10,
      vitality: 10,
      agility: 10,
      intellect: 10,
      spirit: 10,
    })
    expect(racialStartingAttributes.elf).toEqual({
      strength: 8,
      vitality: 9,
      agility: 12,
      intellect: 12,
      spirit: 9,
    })
    expect(racialStartingAttributes.beastfolk).toEqual({
      strength: 13,
      vitality: 13,
      agility: 9,
      intellect: 7,
      spirit: 8,
    })
    expect(racialStartingAttributes.undead).toEqual({
      strength: 8,
      vitality: 9,
      agility: 13,
      intellect: 11,
      spirit: 9,
    })
    for (const attributes of Object.values(racialStartingAttributes)) {
      expect(Object.keys(attributes)).toEqual(order)
    }
    expect(referenceHeroes.warrior.attributes).toEqual({
      strength: 24,
      vitality: 22,
      agility: 16,
      intellect: 10,
      spirit: 16,
    })
  })
})

function gearPieces(
  gear: (typeof referenceHeroes)['warrior']['gear'],
): readonly ({ id: string; itemLevel: number; quality: number } | null)[] {
  return [
    gear.mainHand,
    gear.offHand,
    gear.head,
    gear.chest,
    gear.hands,
    gear.feet,
    gear.accessories[0],
    gear.accessories[1],
  ]
}
