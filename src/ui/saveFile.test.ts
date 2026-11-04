import { describe, expect, it } from 'vitest'

import { createHero } from '../persist/roster.ts'
import { newSave } from '../persist/save.ts'

import { commitSave, exportSaveText, getSaveStatus, importSaveFromText } from './store.ts'

describe('backup file', () => {
  it('exports the game and loads it back, and refuses a file that is not a save', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    commitSave(made.save, 'test')
    const backup = exportSaveText()

    const other = createHero(newSave(), { name: 'Brin', race: 'elf', classId: 'mage' })
    if (!other.ok) throw new Error(other.reason)
    commitSave(other.save, 'test')
    expect(getSaveStatus().save.heroes[0]?.name).toBe('Brin')

    expect(importSaveFromText(backup)).toBeNull()
    expect(getSaveStatus().save.heroes.map((hero) => hero.name)).toEqual(['Ash'])

    const before = getSaveStatus().save
    expect(importSaveFromText('not json')).toMatch(/not a usable save/)
    expect(importSaveFromText('{"version":1}')).toMatch(/not a usable save/)
    expect(getSaveStatus().save).toBe(before)
  })
})
