import { describe, expect, it } from 'vitest'

import { newItem } from '../content/items.ts'

import { selectedHero } from './character.ts'
import { createHero } from './roster.ts'
import { newSave, type SaveData } from './save.ts'
import { previewBuy } from './town.ts'

/** A level 8 warrior wearing a Hauler's chestpiece at 98% quality. */
function haulerHero(): { save: SaveData; heroId: string } {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)!
  const chest = { ...newItem('hauler-chest', 'armor-heavy-chest', 8), quality: 0.98, modifiers: ['hauler'] }
  const heroes = made.save.heroes.map((entry) => ({
    ...entry,
    progress: { ...entry.progress, level: 8 },
    equipment: { ...entry.equipment, chest },
  }))
  return { save: { ...made.save, heroes }, heroId: hero.id }
}

describe('previewBuy comparison', () => {
  it('names the replaced Hauler\'s chestpiece and shows the lost bag room', () => {
    const { save, heroId } = haulerHero()
    const preview = previewBuy(save, heroId, 'armor-heavy-chest')
    expect(preview.block).toBeNull()
    expect(preview.replaces).toMatchObject({ itemLevel: 8, quality: 0.98 })
    expect(preview.replaces?.name).toContain("Hauler's")
    expect(preview.extras).toEqual([{ label: 'Bag room', before: 23, after: 20, unit: '' }])
    expect(preview.notes.some((note) => note.startsWith("Loses Hauler's"))).toBe(true)
  })

  it('has no extras when nothing of the kind changes', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const preview = previewBuy(made.save, selectedHero(made.save)!.id, 'armor-heavy-chest')
    expect(preview.extras).toEqual([])
    expect(preview.notes).toEqual([])
    expect(preview.replaces).not.toBeNull()
  })
})
