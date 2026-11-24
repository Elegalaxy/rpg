import { describe, expect, it } from 'vitest'

import { ITEM_MODIFIERS, MODIFIER_STACK_CAP, emptyEquipment, gearBonusesFor, modifierFits, slotsFor, statBonusesFor, type BaseLookup, type ItemBase, type ItemInstance } from './economy.ts'
import { UNIQUE_ITEMS, uniqueDef, uniqueScale, uniqueSignature, uniqueSignatureText } from './uniques.ts'

const bases: { [id: string]: ItemBase } = {
  boots: { id: 'boots', name: 'Boots', type: 'armor', slot: 'feet', category: 'light' },
  helm: { id: 'helm', name: 'Helm', type: 'armor', slot: 'head', category: 'light' },
  sword: { id: 'sword', name: 'Sword', type: 'weapon', weaponKind: 'oneHanded' },
  shield: { id: 'shield', name: 'Shield', type: 'offHand', offHandKind: 'shield' },
  chest: { id: 'chest', name: 'Chest', type: 'armor', slot: 'chest', category: 'light' },
  talisman: { id: 'talisman', name: 'Talisman', type: 'accessory' },
}
const lookup: BaseLookup = (id) => bases[id]

function unique(id: string, itemLevel: number, baseId = 'boots', extra: Partial<ItemInstance> = {}): ItemInstance {
  const def = uniqueDef(id)!
  return { id: `u-${id}`, baseId, itemLevel, quality: 1.1, durability: 100, maxDurability: 100, modifiers: [def.modifier], uniqueId: id, ...extra }
}

describe('unique table', () => {
  it('has six rows with distinct slots, ids, enemies and a fixed modifier that fits and is unlocked at the item level', () => {
    expect(UNIQUE_ITEMS).toHaveLength(6)
    expect(new Set(UNIQUE_ITEMS.map((def) => def.slot)).size).toBe(6)
    expect(new Set(UNIQUE_ITEMS.map((def) => def.id)).size).toBe(6)
    expect(new Set(UNIQUE_ITEMS.map((def) => def.enemyId)).size).toBe(6)
    for (const def of UNIQUE_ITEMS) {
      const modifier = ITEM_MODIFIERS[def.modifier]!
      expect(modifier.minLevel).toBeLessThanOrEqual(def.itemLevel)
      expect(Object.keys(def.signature).length).toBeGreaterThan(0)
      expect(def.signatureText.length).toBeGreaterThan(0)
    }
  })
})

describe('uniqueSignature', () => {
  it('is the full signature at the table level and above, whatever the quality, rank or temper', () => {
    const treads = unique('rootmaw-treads', 14)
    expect(uniqueSignature(treads)).toEqual({ evasionBonus: 3, accuracyBonus: 3 })
    expect(uniqueSignature({ ...treads, itemLevel: 30, quality: 0.9, modifierRanks: [3], modifierTempers: [5] })).toEqual({ evasionBonus: 3, accuracyBonus: 3 })
    expect(uniqueScale({ ...treads, itemLevel: 30 })).toBe(1)
  })

  it('scales by item level over table level and rounds flat keys to one decimal and fractions to four', () => {
    const treads = unique('rootmaw-treads', 7)
    expect(uniqueSignature(treads)).toEqual({ evasionBonus: 1.5, accuracyBonus: 1.5 })
    const fang = unique('hollowmaw-fang', 20, 'sword')
    expect(uniqueSignature(fang)).toEqual({ critChanceBonus: 0.0154, critDamageBonus: 0.1154 })
    expect(uniqueSignatureText(fang)).toBe('+1.5 points critical chance, +11.5 points critical damage')
    expect(uniqueSignatureText(treads)).toBe('+1.5 Evasion, +1.5 Accuracy')
  })

  it('is empty for a plain item or an unknown id', () => {
    const plain: ItemInstance = { id: 'p', baseId: 'boots', itemLevel: 14, quality: 1, durability: 100, maxDurability: 100, modifiers: [] }
    expect(uniqueSignature(plain)).toEqual({})
    expect(uniqueSignature({ ...plain, uniqueId: 'not-a-unique' })).toEqual({})
    expect(uniqueSignatureText({ ...plain, uniqueId: 'not-a-unique' })).toBe('')
    expect(uniqueScale({ ...plain, uniqueId: 'not-a-unique' })).toBe(0)
  })
})

describe('gearBonusesFor with uniques', () => {
  it('adds the signature of a worn unique on top of its modifier', () => {
    const equipment = emptyEquipment()
    equipment.feet = unique('rootmaw-treads', 14)
    expect(gearBonusesFor(equipment, lookup)).toEqual({ evasionBonus: 6, accuracyBonus: 3 })
  })

  it('is unchanged without a uniqueId and ignores an unknown one', () => {
    const equipment = emptyEquipment()
    equipment.feet = unique('rootmaw-treads', 14, 'boots', { uniqueId: undefined })
    delete equipment.feet.uniqueId
    expect(gearBonusesFor(equipment, lookup)).toEqual(statBonusesFor(equipment))
    equipment.feet = { ...equipment.feet, uniqueId: 'nope' }
    expect(gearBonusesFor(equipment, lookup)).toEqual(statBonusesFor(equipment))
  })

  it('has no stack cap on the signature, while the fixed modifier counts to the cap', () => {
    const equipment = emptyEquipment()
    equipment.feet = unique('rootmaw-treads', 14)
    // Two more Nimble pieces: the modifier stops counting after the cap, the signature still adds.
    equipment.hands = { id: 'h', baseId: 'boots', itemLevel: 10, quality: 1, durability: 100, maxDurability: 100, modifiers: ['nimble'] }
    equipment.head = { id: 'h2', baseId: 'helm', itemLevel: 10, quality: 1, durability: 100, maxDurability: 100, modifiers: ['nimble'] }
    expect(MODIFIER_STACK_CAP).toBe(2)
    expect(statBonusesFor(equipment).evasionBonus).toBe(6)
    expect(gearBonusesFor(equipment, lookup).evasionBonus).toBe(9)
  })

  it('counts a signature at its scaled strength for an item below the table level', () => {
    const equipment = emptyEquipment()
    equipment.chest = unique('tidebound-carapace', 11, 'chest')
    expect(gearBonusesFor(equipment, lookup).lifestealFraction).toBe(0.01)
  })

  it('works in the accessory slot', () => {
    const equipment = emptyEquipment()
    equipment.accessory1 = unique('briarheart-talisman', 38, 'talisman')
    const total = gearBonusesFor(equipment, lookup)
    expect(total.physicalStatusResistanceBonus).toBe(20)
    expect(total.maxHpBonus).toBe(0.03)
    expect(slotsFor(bases.talisman!)).toContain('accessory1')
    expect(modifierFits(ITEM_MODIFIERS.staunch!, bases.talisman!)).toBe(true)
  })
})
