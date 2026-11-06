import { describe, expect, it } from 'vitest'

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
