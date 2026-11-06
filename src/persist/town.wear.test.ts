import { describe, expect, it } from 'vitest'

import { createHero } from './roster.ts'
import { newSave, purseOf, updatePurse, type SaveData } from './save.ts'
import { buyAndWear, previewBuy } from './town.ts'

function heroSave(gold: number): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return updatePurse(made.save, { gold }, 'hero-1')
}

describe('buying and wearing in one step', () => {
  it('puts the new piece on and sends the old one to the archive', () => {
    const save = heroSave(100)
    const before = save.heroes[0]!.equipment.mainHand!
    const result = buyAndWear(save, 'hero-1', 'weapon-two-handed')
    if (!result.ok) throw new Error(result.reason)
    expect(result.worn).toBe(true)
    const hero = result.save.heroes[0]!
    expect(hero.equipment.mainHand?.baseId).toBe('weapon-two-handed')
    expect(purseOf(result.save).archive.map((item) => item.id)).toContain(before.id)
    expect(purseOf(result.save).gold).toBe(90)
  })

  it('refuses without gold and leaves the save alone', () => {
    const result = buyAndWear(heroSave(1), 'hero-1', 'weapon-two-handed')
    expect(result.ok).toBe(false)
  })

  it('previews the change without buying anything', () => {
    const save = heroSave(100)
    const preview = previewBuy(save, 'hero-1', 'weapon-two-handed')
    expect(preview.block).toBeNull()
    expect(preview.changes.length).toBeGreaterThan(0)
    expect(purseOf(save).archive).toEqual(purseOf(heroSave(100)).archive)
  })
})
