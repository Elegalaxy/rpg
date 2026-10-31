import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'

import { selectedHero } from './character.ts'
import { blueprintForHero, startExpedition } from './expeditionSetup.ts'
import { checkPreparation, draftFor, quiverLimit, savePreparation } from './preparation.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, type SaveData } from './save.ts'

function heroSave(classId: (typeof HERO_CLASSES)[number], race: 'human' | 'undead' = 'human'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race, classId })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

describe('preparation', () => {
  it('starts from the usual defaults, per class', () => {
    expect(draftFor(hero(heroSave('warrior')))).toEqual({ retreatPercent: '40', vow: '', curse: '', specialAmmo: '0', carryGold: '25', fightRank: '0' })
    expect(draftFor(hero(heroSave('cleric'))).vow).toBe('zeal')
    expect(draftFor(hero(heroSave('ranger'))).specialAmmo).toBe('6')
  })

  it('checks the retreat threshold', () => {
    const warrior = hero(heroSave('warrior'))
    const base = draftFor(warrior)
    const result = (retreatPercent: string) => checkPreparation(warrior, { ...base, retreatPercent })
    expect(result('25')).toMatchObject({ ok: true, hero: { retreatAtMost: 0.25 } })
    expect(result('')).toMatchObject({ ok: true, hero: { retreatAtMost: null } })
    for (const bad of ['4', '91', 'abc', '12.5', '-3']) {
      expect(result(bad), bad).toMatchObject({ ok: false, errors: [expect.stringMatching(/whole percent from 5 to 90/)] })
    }
  })

  it('checks the vow, the curse, and the quiver for the classes that use them', () => {
    const cleric = hero(heroSave('cleric'))
    expect(checkPreparation(cleric, { ...draftFor(cleric), vow: 'temperance' })).toMatchObject({ ok: true, hero: { vow: 'temperance' } })
    expect(checkPreparation(cleric, { ...draftFor(cleric), vow: 'greed' })).toMatchObject({ ok: false })
    const ranger = hero(heroSave('ranger'))
    expect(quiverLimit(ranger)).toBe(6)
    expect(quiverLimit({ ...ranger, progress: { ...ranger.progress, allocatedNodeIds: ['ranger-efficient-quiver'] } })).toBe(8)
    expect(quiverLimit(hero(heroSave('mage')))).toBe(0)
    expect(checkPreparation(ranger, { ...draftFor(ranger), specialAmmo: '7' })).toMatchObject({
      ok: false,
      errors: ['Special arrows must be a whole number from 0 to 6.'],
    })
    expect(checkPreparation(ranger, { ...draftFor(ranger), specialAmmo: '3' })).toMatchObject({ ok: true, hero: { specialAmmo: 3 } })
    const human = hero(heroSave('warrior'))
    expect(checkPreparation(human, { ...draftFor(human), curse: 'soul-debt' })).toMatchObject({
      ok: false,
      errors: ['Only an Undead with Cursebound can carry a curse.'],
    })
    const undead = hero(heroSave('warrior', 'undead'))
    const bound = {
      ...undead,
      progress: { ...undead.progress, allocatedNodeIds: ['undead-patient-killer', 'undead-soul-harvest', 'undead-cursebound'] },
    }
    expect(checkPreparation(bound, { ...draftFor(bound), curse: 'grave-patience' })).toMatchObject({
      ok: true,
      hero: { curse: 'grave-patience' },
    })
    expect(checkPreparation(bound, { ...draftFor(bound), curse: 'bogus' })).toMatchObject({ ok: false })
  })

  it('saves per hero, keeps the save valid, and is locked during an expedition', () => {
    const save = heroSave('ranger')
    const draft = { ...draftFor(hero(save)), retreatPercent: '30', specialAmmo: '2' }
    const result = savePreparation(save, 'hero-1', draft)
    if (!result.ok) throw new Error(result.reason)
    expect(hero(result.save)).toMatchObject({ retreatAtMost: 0.3, specialAmmo: 2 })
    expect(() => assertSaveData(result.save)).not.toThrow()
    expect(savePreparation(save, 'nobody', draft).ok).toBe(false)
    const running = { ...result.save, expedition: startExpedition(hero(result.save), 'splintered-road', 1) }
    expect(savePreparation(running, 'hero-1', draft)).toEqual({
      ok: false,
      reason: 'Preparation is locked while an expedition is running.',
    })
  })

  it('reaches the run: threshold, arrows, vow, and curse', () => {
    const ranger = { ...hero(heroSave('ranger')), retreatAtMost: null, specialAmmo: 3 }
    const rangerRun = blueprintForHero(ranger, 'splintered-road')
    expect(rangerRun.retreatThresholds).toEqual([])
    expect(rangerRun.hero.specialAmmo).toBe(3)
    const cleric = { ...hero(heroSave('cleric')), vow: 'endurance', retreatAtMost: 0.25 }
    const clericRun = blueprintForHero(cleric, 'splintered-road')
    expect(clericRun.retreatThresholds).toEqual([{ kind: 'hpFraction', atMost: 0.25 }])
    expect(clericRun.hero.vow).toBe('endurance')
    expect(clericRun.hero.specialAmmo).toBeUndefined()
    const undead = { ...hero(heroSave('warrior', 'undead')), curse: 'soul-debt' }
    expect(blueprintForHero(undead, 'splintered-road').hero.curse).toBe('soul-debt')
    expect(blueprintForHero(undead, 'splintered-road').hero.race).toBe('undead')
  })
})
