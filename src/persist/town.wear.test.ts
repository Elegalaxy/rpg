import { describe, expect, it } from 'vitest'

import { createHero } from './roster.ts'
import { newSave, purseOf, updatePurse, type SaveData } from './save.ts'
import { previewBuy } from './town.ts'

function heroSave(gold: number): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return updatePurse(made.save, { gold }, 'hero-1')
}

describe('previewing a shop item', () => {
  it('previews the change without buying anything', () => {
    const save = heroSave(100)
    const preview = previewBuy(save, 'hero-1', 'weapon-two-handed')
    expect(preview.block).toBeNull()
    expect(preview.changes.length).toBeGreaterThan(0)
    expect(purseOf(save).archive).toEqual(purseOf(heroSave(100)).archive)
  })
})
