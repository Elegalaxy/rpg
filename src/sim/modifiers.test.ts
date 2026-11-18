import { describe, expect, it } from 'vitest'

import {
  ITEM_MODIFIERS,
  MODIFIER_STACK_CAP,
  appliesToText,
  emptyEquipment,
  equipBlock,
  modifierCapNotes,
  modifierCounts,
  modifierFits,
  modifierTextAt,
  rankName,
  TEMPER_PER_POINT,
  rankable,
  bonusFactor,
  scaledBonus,
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
    expect(Object.keys(ITEM_MODIFIERS)).toHaveLength(18)
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

describe('the Cinder Scar modifiers', () => {
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

  it('have the decided levels, numbers, fits, prices and unlocks', () => {
    expect(ITEM_MODIFIERS.emberward).toMatchObject({
      minLevel: 28,
      bonus: { magicalStatusResistanceBonus: 10 },
      recipeGold: 700,
      requires: { discoveryId: 'node:cinder-scar' },
    })
    expect(ITEM_MODIFIERS.tempered).toMatchObject({
      minLevel: 28,
      bonus: { armorPenetrationBonus: 0.04, magicalPenetrationBonus: 0.04, critChanceBonus: 0.02 },
      recipeGold: 700,
      requires: { discoveryId: 'node:cinder-scar' },
    })
    expect(ITEM_MODIFIERS.kindled).toMatchObject({
      minLevel: 30,
      bonus: { maxHpBonus: 0.05, equipmentHealingPower: 8 },
      recipeGold: 800,
      requires: { enemyId: 'emberwrought-tyrant' },
    })
    const emberward = ITEM_MODIFIERS.emberward!
    const tempered = ITEM_MODIFIERS.tempered!
    const kindled = ITEM_MODIFIERS.kindled!
    expect([chest, head, ring, sword, shield].map((base) => modifierFits(emberward, base))).toEqual([true, true, true, false, false])
    expect([sword, ring, shield, chest].map((base) => modifierFits(tempered, base))).toEqual([true, false, false, false])
    expect([shield, ring, sword, chest].map((base) => modifierFits(kindled, base))).toEqual([true, true, false, false])
    expect(appliesToText(emberward)).toBe('armor and accessories')
  })

  it('add their bonuses to the derived stats', () => {
    const plain = deriveHeroStats(input)
    expect(plain.magicalStatusResistance).toBe(0)
    const ward = deriveHeroStats({ ...input, ...statBonusesFor(worn({ head: ['emberward'] })) })
    expect(ward.magicalStatusResistance).toBe(10)
    const temper = deriveHeroStats({ ...input, ...statBonusesFor(worn({ mainHand: ['tempered'] })) })
    expect(temper.armorPenetration).toBeCloseTo(plain.armorPenetration + 0.04, 10)
    expect(temper.magicalPenetration).toBeCloseTo(plain.magicalPenetration + 0.04, 10)
    expect(temper.critChance).toBeCloseTo(plain.critChance + 0.02, 10)
    const kindle = deriveHeroStats({ ...input, ...statBonusesFor(worn({ offHand: ['kindled'] })) })
    expect(kindle.healingPower).toBeCloseTo(plain.healingPower + 8, 10)
    expect(kindle.maxHp / plain.maxHp).toBeCloseTo(1.05, 10)
  })

  it('respect the two-piece stack cap for Emberward', () => {
    const gear = worn({ head: ['emberward'], chest: ['emberward'], accessory0: ['emberward'] })
    expect(statBonusesFor(gear).magicalStatusResistanceBonus).toBe(20)
    expect(modifierCapNotes(gear)).toEqual(['Emberward is on 3 pieces, but only 2 count.'])
  })
})

describe('two modifiers on one item (the second socket)', () => {
  function pair(slots: Partial<{ [slot in EquipmentSlotId]: string[] }>): Equipment {
    const equipment = worn({})
    for (const slot of Object.keys(slots) as EquipmentSlotId[]) equipment[slot] = { ...item(slot, slots[slot] ?? []), socketed: true }
    return equipment
  }

  it('applies both modifiers of one item', () => {
    const bonus = statBonusesFor(pair({ mainHand: ['keen', 'precise'] }))
    expect(bonus.critChanceBonus).toBeCloseTo(0.02, 10)
    expect(bonus.accuracyBonus).toBe(3)
    expect(modifierCounts(pair({ mainHand: ['keen', 'precise'] }))).toEqual([
      { id: 'keen', worn: 1, counted: 1 },
      { id: 'precise', worn: 1, counted: 1 },
    ])
  })

  it('still counts a modifier at most twice across pieces, whichever socket it sits in', () => {
    const equipment = pair({ mainHand: ['keen', 'precise'], accessory0: ['precise', 'keen'], accessory1: ['keen'], offHand: ['precise'] })
    const bonus = statBonusesFor(equipment)
    expect(bonus.critChanceBonus).toBeCloseTo(0.04, 10)
    expect(bonus.accuracyBonus).toBe(6)
    expect(modifierCapNotes(equipment)).toEqual(['Keen is on 3 pieces, but only 2 count.', 'Precise is on 3 pieces, but only 2 count.'])
  })

  it('blocks wearing an item whose second modifier needs a higher level', () => {
    const base = (id: string) => (id === 'x' ? sword : undefined)
    const socketed: ItemInstance = { ...item('i', ['keen', 'sturdy']), baseId: 'x', socketed: true }
    expect(equipBlock(emptyEquipment(), socketed, 'mainHand', 5, base)).toBe('Sturdy needs level 6. This hero is level 5.')
  })
})

describe('modifier ranks', () => {
  function ranked(slots: Partial<{ [slot in EquipmentSlotId]: { modifiers: string[]; ranks?: number[] } }>): Equipment {
    const equipment = worn({})
    for (const slot of Object.keys(slots) as EquipmentSlotId[]) {
      const entry = slots[slot]
      if (entry === undefined) continue
      equipment[slot] = { ...item(slot, entry.modifiers), socketed: true, ...(entry.ranks === undefined ? {} : { modifierRanks: entry.ranks }) }
    }
    return equipment
  }

  it('leaves rank I untouched: an absent list and a list of ones give exactly the old numbers', () => {
    const plain = statBonusesFor(worn({ mainHand: ['keen'], chest: ['sturdy'], accessory0: ['bloodbound'] }))
    expect(statBonusesFor(ranked({ mainHand: { modifiers: ['keen'] }, chest: { modifiers: ['sturdy'], ranks: [1] }, accessory0: { modifiers: ['bloodbound'], ranks: [1] } }))).toEqual(plain)
  })

  it('scales the numbers by 1.5 and 2.0 with the decided rounding', () => {
    expect(scaledBonus('critChanceBonus', 0.02, 2)).toBe(0.03)
    expect(scaledBonus('critChanceBonus', 0.02, 3)).toBe(0.04)
    expect(scaledBonus('accuracyBonus', 3, 2)).toBe(4.5)
    expect(scaledBonus('accuracyBonus', 3, 3)).toBe(6)
    expect(scaledBonus('equipmentHealingPower', 12, 3)).toBe(24)
    expect(scaledBonus('lifestealFraction', 0.05, 2)).toBe(0.075)
    expect(scaledBonus('lifestealFraction', 0.05, 3)).toBe(0.1)
    expect(scaledBonus('maxHpBonus', 0.04, 1)).toBe(0.04)
    const bonus = statBonusesFor(ranked({ mainHand: { modifiers: ['keen', 'precise'], ranks: [2, 3] } }))
    expect(bonus.critChanceBonus).toBe(0.03)
    expect(bonus.accuracyBonus).toBe(6)
  })

  it('counts the stack cap in modifiers, not ranks, in slot order', () => {
    const equipment = ranked({
      mainHand: { modifiers: ['keen'], ranks: [3] },
      accessory0: { modifiers: ['keen'], ranks: [1] },
      accessory1: { modifiers: ['keen'], ranks: [3] },
    })
    // Slot order is mainHand, accessory0, accessory1: the third piece is over the cap whatever its rank.
    expect(statBonusesFor(equipment).critChanceBonus).toBeCloseTo(0.04 + 0.02, 10)
    expect(modifierCapNotes(equipment)).toEqual(['Keen is on 3 pieces, but only 2 count.'])
  })

  it('writes the effect text at a rank and knows that Hauler cannot be ranked', () => {
    expect(modifierTextAt(ITEM_MODIFIERS.keen!, 1)).toBe('+2 points critical chance')
    expect(modifierTextAt(ITEM_MODIFIERS.keen!, 2)).toBe('+3 points critical chance')
    expect(modifierTextAt(ITEM_MODIFIERS.kindled!, 3)).toBe('+10% maximum HP, +16 Healing Power')
    expect(rankable(ITEM_MODIFIERS.hauler!)).toBe(false)
    expect(rankable(ITEM_MODIFIERS.keen!)).toBe(true)
    expect(rankName(3)).toBe('III')
  })
describe('modifier temper', () => {
  function tempered(modifiers: string[], ranks: number[] | undefined, tempers: number[] | undefined): Equipment {
    const equipment = worn({})
    equipment.mainHand = {
      ...item('mainHand', modifiers),
      socketed: true,
      ...(ranks === undefined ? {} : { modifierRanks: ranks }),
      ...(tempers === undefined ? {} : { modifierTempers: tempers }),
    }
    return equipment
  }

  it('leaves rank I with no temper untouched: absent, empty and zero lists give the old numbers', () => {
    expect(TEMPER_PER_POINT).toBe(0.15)
    const plain = statBonusesFor(tempered(['keen', 'precise'], undefined, undefined))
    expect(statBonusesFor(tempered(['keen', 'precise'], undefined, [0, 0]))).toEqual(plain)
    expect(statBonusesFor(tempered(['keen', 'precise'], [1, 1], []))).toEqual(plain)
    expect(scaledBonus('critChanceBonus', 0.02, 1, 0)).toBe(0.02)
    expect(scaledBonus('accuracyBonus', 3, 1)).toBe(3)
  })

  it('adds 15 points of multiplier per temper point to the rank multiplier', () => {
    expect(scaledBonus('critChanceBonus', 0.02, 1, 5)).toBe(0.035)
    expect(scaledBonus('critChanceBonus', 0.02, 1, 3)).toBe(0.029)
    expect(scaledBonus('critChanceBonus', 0.02, 3, 5)).toBe(0.055)
    expect(scaledBonus('critChanceBonus', 0.02, 2, 2)).toBe(0.036)
    expect(scaledBonus('accuracyBonus', 10, 3, 5)).toBe(27.5)
    expect(scaledBonus('maxHpBonus', 0.04, 3, 5)).toBe(0.11)
    expect(scaledBonus('critChanceBonus', 0.02, 9, 5)).toBe(0.02)
  })

  it('rounds the factor to two decimals and caps it at 2.75', () => {
    expect(bonusFactor(1, 5)).toBe(1.75)
    expect(bonusFactor(3, 5)).toBe(2.75)
    expect(bonusFactor(3, 3)).toBe(2.45)
    expect(bonusFactor(2, 0)).toBe(1.5)
    expect(bonusFactor(9, 2)).toBeUndefined()
  })

  it('applies a temper per slot through statBonusesFor and the cap still counts pieces', () => {
    const bonus = statBonusesFor(tempered(['keen', 'precise'], [3, 1], [5, 0]))
    expect(bonus.critChanceBonus).toBe(0.055)
    expect(bonus.accuracyBonus).toBe(3)
    const only = statBonusesFor(tempered(['keen'], undefined, [5]))
    expect(only.critChanceBonus).toBe(0.035)
  })

  it('writes the effect text with the temper', () => {
    expect(modifierTextAt(ITEM_MODIFIERS.keen!, 1, 5)).toBe('+3.5 points critical chance')
    expect(modifierTextAt(ITEM_MODIFIERS.keen!, 3, 5)).toBe('+5.5 points critical chance')
    expect(modifierTextAt(ITEM_MODIFIERS.keen!, 1, 0)).toBe('+2 points critical chance')
  })
})
})

describe('an heirloom wears early (Step 13.29)', () => {
  const base = (id: string) => (id === 'x' ? sword : undefined)
  const heirloom: ItemInstance = { ...item('a', ['siphoning']), heirloom: { heroId: 'h', cap: 30 } }

  it('equips at level 1 with its level-20 modifier, where a plain item is blocked', () => {
    expect(equipBlock(emptyEquipment(), heirloom, 'mainHand', 1, base)).toBeNull()
    expect(equipBlock(emptyEquipment(), item('b', ['siphoning']), 'mainHand', 1, base)).toBe('Siphoning needs level 20. This hero is level 1.')
    expect(equipBlock(emptyEquipment(), { ...heirloom, itemLevel: 5 }, 'mainHand', 1, base)).toBe('Sword needs level 5. This hero is level 1.')
  })

  it('gives its full bonus and counts toward the stack cap', () => {
    const equipment = emptyEquipment()
    equipment.mainHand = heirloom
    expect(statBonusesFor(equipment).lifestealFraction).toBeCloseTo(0.03)
    equipment.accessory0 = item('b', ['siphoning'])
    equipment.accessory1 = item('c', ['siphoning'])
    expect(modifierCounts(equipment).find((entry) => entry.id === 'siphoning')).toEqual({ id: 'siphoning', worn: 3, counted: 2 })
  })
})
