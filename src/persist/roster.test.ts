import { describe, expect, it } from 'vitest'

import { classIdentity, raceIdentity, racialStartingAttributes } from '../content/heroes.ts'
import { classWebs } from '../content/webs/index.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import { HERO_RACES } from '../sim/progression.ts'

import {
  NAME_MAX,
  createHero,
  freeSlots,
  nameProblem,
  selectHero,
  unlockAllSlots,
  type NewHero,
} from './roster.ts'
import { MAX_SLOTS, STARTING_SLOTS, assertSaveData, newSave, parseSave, serializeSave, type SaveData } from './save.ts'

function must(result: ReturnType<typeof createHero>): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

describe('hero creation', () => {
  it('creates every one of the 20 race and class pairs', () => {
    let count = 0
    for (const race of HERO_RACES) {
      for (const classId of HERO_CLASSES) {
        const save = must(createHero(newSave(), { name: `${race} ${classId}`, race, classId }))
        const hero = save.heroes[0]
        if (hero === undefined) throw new Error('no hero')
        expect(hero.classId).toBe(classId)
        expect(hero.progress.race).toBe(race)
        expect(hero.progress.level).toBe(1)
        expect(hero.progress.attributes).toEqual(racialStartingAttributes[race])
        expect(hero.progress.learnedSkillIds).toEqual([...classWebs[classId].startingSkillIds])
        expect(hero.progress.loadout).toEqual([...classWebs[classId].startingSkillIds])
        expect(hero.progress.allocatedNodeIds).toEqual([])
        expect(hero.priorityRows.length).toBeGreaterThan(0)
        expect(hero.vow).toBe(classId === 'cleric' ? 'zeal' : null)
        expect(save.selectedHeroId).toBe(hero.id)
        expect(() => assertSaveData(save)).not.toThrow()
        expect(parseSave(serializeSave(save)).ok).toBe(true)
        count += 1
      }
    }
    expect(count).toBe(20)
  })

  it('shows different identity text for every race and every class', () => {
    expect(new Set(HERO_RACES.map((race) => raceIdentity[race].summary)).size).toBe(4)
    expect(new Set(HERO_RACES.map((race) => raceIdentity[race].core)).size).toBe(4)
    expect(new Set(HERO_CLASSES.map((id) => classIdentity[id].summary)).size).toBe(5)
    expect(new Set(HERO_CLASSES.map((id) => classIdentity[id].core)).size).toBe(5)
    for (const race of HERO_RACES) expect(raceIdentity[race].name.length).toBeGreaterThan(0)
  })

  it('trims the name and rejects bad names with a message', () => {
    const save = must(createHero(newSave(), { name: '  Ash  ', race: 'human', classId: 'warrior' }))
    expect(save.heroes[0]?.name).toBe('Ash')
    expect(nameProblem('', newSave())).toBe('Enter a name.')
    expect(nameProblem('   ', newSave())).toBe('Enter a name.')
    expect(nameProblem('x'.repeat(NAME_MAX), newSave())).toBeNull()
    expect(nameProblem('x'.repeat(NAME_MAX + 1), newSave())).toMatch(/at most 24/)
    expect(nameProblem('  x  ', newSave())).toBeNull()
    expect(nameProblem('ASH', save)).toMatch(/already on the roster/)
    expect(nameProblem(' ash ', save)).toMatch(/already on the roster/)
    expect(nameProblem('Cinder', save)).toBeNull()
    const refused = createHero(save, { name: 'ash', race: 'elf', classId: 'mage' })
    expect(refused).toEqual({ ok: false, reason: 'A hero named "ash" is already on the roster.' })
    expect(createHero(newSave(), { name: '', race: 'elf', classId: 'mage' })).toEqual({ ok: false, reason: 'Enter a name.' })
    const bad = createHero(newSave(), { name: 'Ok', race: 'orc' as never, classId: 'mage' })
    expect(bad).toEqual({ ok: false, reason: 'Pick a race.' })
    expect(createHero(newSave(), { name: 'Ok', race: 'elf', classId: 'bard' as never })).toEqual({
      ok: false,
      reason: 'Pick a class.',
    })
    expect(Array.from('🙂'.repeat(24))).toHaveLength(24)
    expect(nameProblem('🙂'.repeat(24), newSave())).toBeNull()
  })

  it('allows duplicate race and class heroes with separate ids', () => {
    const first: NewHero = { name: 'Ash', race: 'human', classId: 'warrior' }
    let save = must(createHero(newSave(), first))
    save = must(createHero(save, { ...first, name: 'Cinder' }))
    expect(save.heroes.map((hero) => hero.id)).toEqual(['hero-1', 'hero-2'])
    expect(save.heroes[0]?.progress).toEqual(save.heroes[1]?.progress)
    expect(save.heroes[0]?.progress).not.toBe(save.heroes[1]?.progress)
    save.heroes[1]?.progress.allocatedNodeIds.push('x')
    expect(save.heroes[0]?.progress.allocatedNodeIds).toEqual([])
  })

  it('limits the roster to the account slots: 2 at the start, up to 5', () => {
    let save = newSave()
    expect(save.account.slots).toBe(STARTING_SLOTS)
    expect(freeSlots(save)).toBe(2)
    save = must(createHero(save, { name: 'One', race: 'human', classId: 'warrior' }))
    save = must(createHero(save, { name: 'Two', race: 'elf', classId: 'mage' }))
    expect(freeSlots(save)).toBe(0)
    expect(createHero(save, { name: 'Three', race: 'undead', classId: 'cleric' })).toEqual({
      ok: false,
      reason: 'The roster is full (2 of 5 slots in use).',
    })
    save = unlockAllSlots(save)
    expect(save.account.slots).toBe(MAX_SLOTS)
    for (const name of ['Three', 'Four', 'Five']) {
      save = must(createHero(save, { name, race: 'beastfolk', classId: 'ranger' }))
    }
    expect(save.heroes).toHaveLength(5)
    expect(createHero(save, { name: 'Six', race: 'human', classId: 'warrior' }).ok).toBe(false)
    expect(parseSave(serializeSave(save)).ok).toBe(true)
  })

  it('selects a hero, and keeps the selection while an expedition runs', () => {
    let save = must(createHero(newSave(), { name: 'One', race: 'human', classId: 'warrior' }))
    save = must(createHero(save, { name: 'Two', race: 'elf', classId: 'mage' }))
    expect(save.selectedHeroId).toBe('hero-2')
    expect(selectHero(save, 'nobody')).toEqual({ ok: false, reason: 'That hero is not on the roster.' })
    const chosen = selectHero(save, 'hero-1')
    expect(chosen.ok && chosen.save.selectedHeroId).toBe('hero-1')
    const running = { ...save, expedition: {} as never }
    expect(selectHero(running, 'hero-1')).toEqual({ ok: false, reason: 'Finish the expedition before switching heroes.' })
    expect(selectHero(running, 'hero-2').ok).toBe(true)
    const created = createHero(unlockAllSlots(running), { name: 'Three', race: 'undead', classId: 'cleric' })
    expect(created.ok && created.save.selectedHeroId).toBe('hero-2')
  })
})
