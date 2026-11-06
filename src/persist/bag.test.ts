import { describe, expect, it } from 'vitest'

import { MODIFIER_STACK_CAP, type EquipmentSlotId } from '../sim/economy.ts'
import { LOOT_CAPACITY, MAX_LOOT_CAPACITY } from '../sim/expedition.ts'

import { DEEP_POCKETS_ROOM, bagCapacity } from './bag.ts'
import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { newSave, type SavedHero } from './save.ts'

function hero(level: number, deepPockets = false): SavedHero {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const found = selectedHero(made.save)
  if (found === null) throw new Error('no hero')
  return { ...found, progress: { ...found.progress, level }, purchases: { ...found.purchases, deepPockets } }
}

describe('bag capacity', () => {
  it('is 20, plus 2 at levels 10, 20 and 30', () => {
    expect(LOOT_CAPACITY).toBe(20)
    expect([1, 9, 10, 19, 20, 29, 30, 60].map((level) => bagCapacity(hero(level)))).toEqual([20, 20, 22, 22, 24, 24, 26, 26])
  })

  it('adds 4 for Deep Pockets and never passes 36', () => {
    expect(DEEP_POCKETS_ROOM).toBe(4)
    expect(bagCapacity(hero(1, true))).toBe(24)
    expect(bagCapacity(hero(30, true))).toBe(30)
    expect(bagCapacity(hero(30, true))).toBeLessThanOrEqual(MAX_LOOT_CAPACITY)
  })

  it('is fixed into the expedition when a run starts', () => {
    const run = startExpedition(hero(20, true), 'splintered-road', 1)
    expect(run.lootCapacity).toBe(28)
  })
})

function withModifiers(base: SavedHero, worn: Partial<{ [slot in EquipmentSlotId]: string[] }>): SavedHero {
  const equipment = { ...base.equipment }
  for (const slot of Object.keys(worn) as EquipmentSlotId[]) {
    const item = equipment[slot]
    if (item === null) throw new Error(`no item in ${slot}`)
    equipment[slot] = { ...item, modifiers: worn[slot] ?? [] }
  }
  return { ...base, equipment }
}

describe("Hauler's bag room", () => {
  it('adds 3 per worn piece, at most 2 pieces', () => {
    expect(MODIFIER_STACK_CAP).toBe(2)
    const none = hero(1)
    expect(bagCapacity(none)).toBe(20)
    expect(bagCapacity(withModifiers(none, { chest: ['hauler'] }))).toBe(23)
    expect(bagCapacity(withModifiers(none, { chest: ['hauler'], accessory0: ['hauler'] }))).toBe(26)
    expect(bagCapacity(withModifiers(none, { chest: ['hauler'], accessory0: ['hauler'], accessory1: ['hauler'] }))).toBe(26)
  })

  it('reaches the 36 cap with everything and never passes it', () => {
    const full = withModifiers(hero(30, true), { chest: ['hauler'], accessory0: ['hauler'] })
    expect(bagCapacity(full)).toBe(36)
    expect(startExpedition(full, 'splintered-road', 1).lootCapacity).toBe(36)
  })
})
