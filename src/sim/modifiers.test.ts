import { describe, expect, it } from 'vitest'

import {
  ITEM_MODIFIERS,
  MODIFIER_STACK_CAP,
  appliesToText,
  emptyEquipment,
  modifierCapNotes,
  modifierCounts,
  modifierFits,
  statBonusesFor,
  type Equipment,
  type EquipmentSlotId,
  type ItemBase,
  type ItemInstance,
} from './economy.ts'
import { deriveHeroStats, type HeroStatInput } from './stats.ts'

function item(id: string, modifiers: string[]): ItemInstance {
  return { id, baseId: 'x', itemLevel: 1, quality: 1, durability: 10, maxDurability: 10, modifiers }
}

function worn(slots: Partial<{ [slot in EquipmentSlotId]: string[] }>): Equipment {
  const equipment = emptyEquipment()
  for (const slot of Object.keys(slots) as EquipmentSlotId[]) equipment[slot] = item(slot, slots[slot] ?? [])
  return equipment
}

const chest: ItemBase = { id: 'c', name: 'Chest', type: 'armor', slot: 'chest', category: 'heavy' }
const head: ItemBase = { id: 'h', name: 'Head', type: 'armor', slot: 'head', category: 'heavy' }
const sword: ItemBase = { id: 's', name: 'Sword', type: 'weapon', weaponKind: 'oneHanded' }
const shield: ItemBase = { id: 'sh', name: 'Shield', type: 'offHand', offHandKind: 'shield' }
const ring: ItemBase = { id: 'r', name: 'Ring', type: 'accessory' }

describe('the Batch C modifiers', () => {
  it('have the decided levels, numbers and item kinds', () => {
    expect(ITEM_MODIFIERS.vicious).toMatchObject({ minLevel: 3, bonus: { critDamageBonus: 0.1 } })
    expect(ITEM_MODIFIERS.sturdy).toMatchObject({ minLevel: 6, bonus: { maxHpBonus: 0.04 } })
    expect(ITEM_MODIFIERS.hauler).toMatchObject({ minLevel: 4, bagRoom: 3 })
    const v = ITEM_MODIFIERS.vicious!
    const st = ITEM_MODIFIERS.sturdy!
    const h = ITEM_MODIFIERS.hauler!
    expect([sword, ring, shield, chest].map((base) => modifierFits(v, base))).toEqual([true, true, false, false])
    expect([chest, head, ring, sword].map((base) => modifierFits(st, base))).toEqual([true, true, false, false])
    expect([chest, head, ring, sword].map((base) => modifierFits(h, base))).toEqual([true, false, true, false])
    expect(appliesToText(h)).toBe('chest armor and accessories')
    expect(appliesToText(st)).toBe('armor')
  })

  it('add their bonuses to the derived stats', () => {
    const input = {
      level: 1,
      classId: 'warrior',
      attributes: { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 },
      gear: {
        mainHand: { id: 'w', kind: 'oneHanded', itemLevel: 1, quality: 1 },
        offHand: { id: 'o', kind: 'shield', itemLevel: 1, quality: 1 },
        head: { id: 'a', slot: 'head', category: 'heavy', itemLevel: 1, quality: 1 },
        chest: { id: 'b', slot: 'chest', category: 'heavy', itemLevel: 1, quality: 1 },
        hands: { id: 'c', slot: 'hands', category: 'heavy', itemLevel: 1, quality: 1 },
        feet: { id: 'd', slot: 'feet', category: 'heavy', itemLevel: 1, quality: 1 },
        accessories: [
          { id: 'e', itemLevel: 1, quality: 1 },
          { id: 'f', itemLevel: 1, quality: 1 },
        ],
      },
    } as HeroStatInput
    const plain = deriveHeroStats(input)
    const bonus = statBonusesFor(worn({ mainHand: ['vicious'], chest: ['sturdy'] }))
    const boosted = deriveHeroStats({ ...input, ...bonus })
    expect(boosted.critDamage).toBeCloseTo(plain.critDamage + 0.1, 10)
    expect(boosted.maxHp).toBeCloseTo(plain.maxHp * 1.04, 8)
    expect(deriveHeroStats({ ...input, ...statBonusesFor(worn({})) })).toEqual(plain)
  })
})

describe('the modifier stack cap', () => {
  it('counts the same modifier at most twice across worn gear', () => {
    expect(MODIFIER_STACK_CAP).toBe(2)
    const two = statBonusesFor(worn({ mainHand: ['keen'], accessory0: ['keen'] }))
    const three = statBonusesFor(worn({ mainHand: ['keen'], accessory0: ['keen'], accessory1: ['keen'] }))
    expect(two.critChanceBonus).toBeCloseTo(0.04, 10)
    expect(three).toEqual(two)
  })

  it('caps each modifier on its own and leaves different ones alone', () => {
    const bonus = statBonusesFor(
      worn({ mainHand: ['keen'], offHand: ['precise'], head: ['sturdy'], chest: ['sturdy'], hands: ['sturdy'], accessory0: ['keen'], accessory1: ['keen'] }),
    )
    expect(bonus.critChanceBonus).toBeCloseTo(0.04, 10)
    expect(bonus.accuracyBonus).toBe(3)
    expect(bonus.maxHpBonus).toBeCloseTo(0.08, 10)
  })

  it('reports counts and a plain note for each modifier over the cap', () => {
    const equipment = worn({ mainHand: ['keen'], accessory0: ['keen'], accessory1: ['keen'], chest: ['sturdy'] })
    expect(modifierCounts(equipment)).toEqual([
      { id: 'keen', worn: 3, counted: 2 },
      { id: 'sturdy', worn: 1, counted: 1 },
    ])
    expect(modifierCapNotes(equipment)).toEqual(['Keen is on 3 pieces, but only 2 count.'])
    expect(modifierCapNotes(worn({ mainHand: ['keen'], accessory0: ['keen'] }))).toEqual([])
  })
})

describe('the Causeway modifiers', () => {
  const input = {
    level: 20,
    classId: 'warrior',
    attributes: { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 },
    gear: {
      mainHand: { id: 'w', kind: 'oneHanded', itemLevel: 1, quality: 1 },
      offHand: { id: 'o', kind: 'shield', itemLevel: 1, quality: 1 },
      head: { id: 'a', slot: 'head', category: 'heavy', itemLevel: 1, quality: 1 },
      chest: { id: 'b', slot: 'chest', category: 'heavy', itemLevel: 1, quality: 1 },
      hands: { id: 'c', slot: 'hands', category: 'heavy', itemLevel: 1, quality: 1 },
      feet: { id: 'd', slot: 'feet', category: 'heavy', itemLevel: 1, quality: 1 },
      accessories: [
        { id: 'e', itemLevel: 1, quality: 1 },
        { id: 'f', itemLevel: 1, quality: 1 },
      ],
    },
  } as HeroStatInput

  it('have the decided levels, numbers, fits and unlocks', () => {
    expect(ITEM_MODIFIERS.hallowed).toMatchObject({ minLevel: 16, bonus: { equipmentHealingPower: 10 }, requires: { discoveryId: 'node:drowned-causeway' } })
    expect(ITEM_MODIFIERS.rending).toMatchObject({ minLevel: 18, bonus: { armorPenetrationBonus: 0.06, magicalPenetrationBonus: 0.06 }, requires: { discoveryId: 'node:drowned-causeway' } })
    expect(ITEM_MODIFIERS.siphoning).toMatchObject({ minLevel: 20, bonus: { lifestealFraction: 0.03 }, requires: { enemyId: 'tidebound-colossus' } })
    expect(Object.keys(ITEM_MODIFIERS)).toHaveLength(15)
    const hallowed = ITEM_MODIFIERS.hallowed!
    const rending = ITEM_MODIFIERS.rending!
    const siphoning = ITEM_MODIFIERS.siphoning!
    expect([shield, ring, sword, chest].map((base) => modifierFits(hallowed, base))).toEqual([true, true, false, false])
    expect([sword, shield, ring, chest].map((base) => modifierFits(rending, base))).toEqual([true, false, false, false])
    expect([sword, shield, ring, chest].map((base) => modifierFits(siphoning, base))).toEqual([true, false, false, false])
  })

  it('add their bonuses to the derived stats', () => {
    const plain = deriveHeroStats(input)
    expect(plain.lifestealFraction).toBe(0)
    const boosted = deriveHeroStats({ ...input, ...statBonusesFor(worn({ mainHand: ['rending'], offHand: ['hallowed'] })) })
    expect(boosted.healingPower).toBeCloseTo(plain.healingPower + 10, 10)
    expect(boosted.armorPenetration).toBeGreaterThan(plain.armorPenetration)
    expect(boosted.magicalPenetration).toBeGreaterThan(plain.magicalPenetration)
    const siphon = deriveHeroStats({ ...input, ...statBonusesFor(worn({ mainHand: ['siphoning'] })) })
    expect(siphon.lifestealFraction).toBeCloseTo(0.03, 10)
  })

  it('respect the two-piece stack cap', () => {
    const bonus = statBonusesFor(worn({ offHand: ['hallowed'], accessory0: ['hallowed'], accessory1: ['hallowed'], mainHand: ['siphoning'] }))
    expect(bonus.equipmentHealingPower).toBe(20)
    expect(bonus.lifestealFraction).toBeCloseTo(0.03, 10)
    expect(modifierCapNotes(worn({ offHand: ['hallowed'], accessory0: ['hallowed'], accessory1: ['hallowed'] }))).toEqual(['Hallowed is on 3 pieces, but only 2 count.'])
  })
})

describe('the Rift Hollows modifiers', () => {
  const input = {
    level: 24,
    classId: 'warrior',
    attributes: { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 },
    gear: {
      mainHand: { id: 'w', kind: 'oneHanded', itemLevel: 1, quality: 1 },
      offHand: { id: 'o', kind: 'shield', itemLevel: 1, quality: 1 },
      head: { id: 'a', slot: 'head', category: 'heavy', itemLevel: 1, quality: 1 },
      chest: { id: 'b', slot: 'chest', category: 'heavy', itemLevel: 1, quality: 1 },
      hands: { id: 'c', slot: 'hands', category: 'heavy', itemLevel: 1, quality: 1 },
      feet: { id: 'd', slot: 'feet', category: 'heavy', itemLevel: 1, quality: 1 },
      accessories: [
        { id: 'e', itemLevel: 1, quality: 1 },
        { id: 'f', itemLevel: 1, quality: 1 },
      ],
    },
  } as HeroStatInput

  it('have the decided levels, numbers, fits and unlocks', () => {
    expect(ITEM_MODIFIERS.stalwart).toMatchObject({ minLevel: 22, bonus: { maxHpBonus: 0.06 }, requires: { discoveryId: 'node:rift-hollows' } })
    expect(ITEM_MODIFIERS.devout).toMatchObject({ minLevel: 22, bonus: { equipmentHealingPower: 12 }, requires: { discoveryId: 'node:rift-hollows' } })
    expect(ITEM_MODIFIERS.bloodbound).toMatchObject({ minLevel: 24, bonus: { lifestealFraction: 0.05 }, requires: { enemyId: 'hollowmaw-reaver' } })
    const stalwart = ITEM_MODIFIERS.stalwart!
    const devout = ITEM_MODIFIERS.devout!
    const bloodbound = ITEM_MODIFIERS.bloodbound!
    expect([chest, shield, ring, sword].map((base) => modifierFits(stalwart, base))).toEqual([true, false, false, false])
    expect([shield, ring, sword, chest].map((base) => modifierFits(devout, base))).toEqual([true, true, false, false])
    expect([sword, shield, ring, chest].map((base) => modifierFits(bloodbound, base))).toEqual([true, false, false, false])
  })

  it('add their bonuses to the derived stats', () => {
    const plain = deriveHeroStats(input)
    const stalwart = deriveHeroStats({ ...input, ...statBonusesFor(worn({ chest: ['stalwart'], head: ['stalwart'] })) })
    expect(stalwart.maxHp).toBeGreaterThan(plain.maxHp)
    expect(stalwart.maxHp / plain.maxHp).toBeGreaterThan(1.1)
    const devout = deriveHeroStats({ ...input, ...statBonusesFor(worn({ offHand: ['devout'] })) })
    expect(devout.healingPower).toBeCloseTo(plain.healingPower + 12, 10)
    const blood = deriveHeroStats({ ...input, ...statBonusesFor(worn({ mainHand: ['bloodbound'] })) })
    expect(blood.lifestealFraction).toBeCloseTo(0.05, 10)
  })

  it('respect the two-piece stack cap, one modifier per item', () => {
    const bonus = statBonusesFor(worn({ head: ['stalwart'], chest: ['stalwart'], hands: ['stalwart'], mainHand: ['bloodbound'] }))
    expect(bonus.maxHpBonus).toBeCloseTo(0.12, 10)
    expect(bonus.lifestealFraction).toBeCloseTo(0.05, 10)
    expect(modifierCapNotes(worn({ head: ['stalwart'], chest: ['stalwart'], hands: ['stalwart'] }))).toEqual(['Stalwart is on 3 pieces, but only 2 count.'])
  })
})
