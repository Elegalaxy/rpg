import { describe, expect, it } from 'vitest'

import { addStatBonuses, emptyEquipment, gearBonusesFor, implicitBonuses, statBonusesFor, type Equipment } from '../sim/economy.ts'

import { implicitText, itemBase, itemBases, newItem, starterEquipment } from './items.ts'
import { shopStock } from './shop.ts'

function wearing(a: string, b: string, level: number): Equipment {
  const equipment = emptyEquipment()
  equipment.accessory0 = newItem('a', a, level)
  equipment.accessory1 = newItem('b', b, level)
  return equipment
}

describe('accessory bases (Step 14.4)', () => {
  it('keeps the Ring and the Charm as plain starter accessories with no implicit', () => {
    for (const id of ['accessory-ring', 'accessory-charm']) {
      const base = itemBase(id)!
      expect(base.type === 'accessory' && base.starterOnly).toBe(true)
      for (const level of [1, 10, 40]) expect(implicitBonuses(base, level)).toEqual({})
      expect(implicitText(id, 30)).toBeNull()
    }
  })

  it('grows the Amulet max HP by 0.05% and the Talisman crit damage by 0.2 points per item level', () => {
    const amulet = itemBase('accessory-amulet')!
    const talisman = itemBase('accessory-talisman')!
    expect([10, 20, 30, 40].map((level) => implicitBonuses(amulet, level).maxHpBonus)).toEqual([0.0025, 0.005, 0.0075, 0.01])
    expect([10, 20, 30, 40].map((level) => implicitBonuses(talisman, level).critDamageBonus)).toEqual([0.01, 0.02, 0.03, 0.04])
    expect(implicitBonuses(amulet, 7).critDamageBonus).toBeUndefined()
    expect(implicitBonuses(talisman, 7).maxHpBonus).toBeUndefined()
  })

  it('rounds to 4 decimals of the fraction', () => {
    expect(implicitBonuses(itemBase('accessory-amulet'), 3)).toEqual({ maxHpBonus: 0.0008 })
    expect(implicitBonuses(itemBase('accessory-talisman'), 7)).toEqual({ critDamageBonus: 0.007 })
    expect(implicitBonuses(itemBase('accessory-amulet'), 33).maxHpBonus).toBe(0.0083)
  })

  it('prints the implicit as a line', () => {
    expect(implicitText('accessory-amulet', 30)).toBe('+0.75% maximum HP')
    expect(implicitText('accessory-amulet', 33)).toBe('+0.83% maximum HP')
    expect(implicitText('accessory-amulet', 40)).toBe('+1% maximum HP')
    expect(implicitText('accessory-talisman', 33)).toBe('+3.3 points critical damage')
    expect(implicitText('accessory-talisman', 30)).toBe('+3 points critical damage')
    expect(implicitText('weapon-bow', 30)).toBeNull()
  })

  it('leaves the gear bonuses equal to the modifier bonuses for starter accessories', () => {
    const equipment = starterEquipment('h', 'warrior')
    expect(gearBonusesFor(equipment, itemBase)).toEqual(statBonusesFor(equipment))
  })

  it('adds the implicits of both accessories to the modifier bonuses, with no cap, rank or quality scaling', () => {
    const equipment = wearing('accessory-amulet', 'accessory-amulet', 30)
    equipment.accessory1 = { ...equipment.accessory1!, quality: 1.1 }
    expect(statBonusesFor(equipment)).toEqual({})
    const sturdy = { ...equipment, head: { ...newItem('h', 'armor-heavy-head', 30), modifiers: ['sturdy'] } }
    expect(gearBonusesFor(sturdy, itemBase).maxHpBonus).toBeCloseTo(0.04 + 0.0075 + 0.0075, 10)
    const mixed = wearing('accessory-amulet', 'accessory-talisman', 30)
    expect(gearBonusesFor(mixed, itemBase)).toEqual({ maxHpBonus: 0.0075, critDamageBonus: 0.03 })
  })

  it('sums bonus sets key by key', () => {
    expect(addStatBonuses({ maxHpBonus: 0.01, critChanceBonus: 0.02 }, { maxHpBonus: 0.015, critDamageBonus: 0.06 })).toEqual({
      maxHpBonus: 0.025,
      critChanceBonus: 0.02,
      critDamageBonus: 0.06,
    })
  })

  it('sells the Amulet and the Talisman but not the starter Ring and Charm', () => {
    const ids = shopStock(30).map((entry) => entry.baseId)
    expect(ids).toContain('accessory-amulet')
    expect(ids).toContain('accessory-talisman')
    expect(ids).not.toContain('accessory-ring')
    expect(ids).not.toContain('accessory-charm')
    expect(shopStock(30).filter((entry) => entry.implicit !== null).map((entry) => [entry.baseId, entry.implicit, entry.price])).toEqual([
      ['accessory-amulet', '+0.75% maximum HP', 300],
      ['accessory-talisman', '+3 points critical damage', 300],
    ])
    expect(Object.keys(itemBases)).toHaveLength(Object.values(itemBases).length)
  })
})
