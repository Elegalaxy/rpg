import { describe, expect, it } from 'vitest'

import { enemies } from '../content/enemies.ts'
import { ruleTemplates } from '../content/ruleTemplates.ts'
import { skills } from '../content/skills.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'

import { selectedHero } from './character.ts'
import { ruleSkillIds, validateRules, validateStacks } from './loadout.ts'
import { applyTemplate, templatesFor, templateUnlocked } from './ruleTemplates.ts'
import { createHero } from './roster.ts'
import { newSave, type SaveData, type SavedHero } from './save.ts'

function heroOf(classId: HeroClass): { save: SaveData; hero: SavedHero } {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)
  if (hero === null) throw new Error('no hero')
  return { save: made.save, hero }
}

function withDefeated(save: SaveData, enemyId: string): SaveData {
  return { ...save, heroes: save.heroes.map((hero) => ({ ...hero, defeatedEnemyIds: [...hero.defeatedEnemyIds, enemyId] })) }
}

describe('rule template data', () => {
  it('keeps every template small, with a trade-off and a blank for the player', () => {
    for (const template of ruleTemplates) {
      expect(template.tradeOff.length, template.id).toBeGreaterThan(0)
      expect(template.rows.length, template.id).toBeLessThanOrEqual(4)
      const conditions = [...template.rows.map((row) => row.condition), template.trigger]
      for (const row of template.rows) {
        expect(row.condition === undefined ? 0 : 1, template.id).toBeLessThanOrEqual(1)
      }
      const blank = template.rows.some((row) => row.skillId === null || row.condition?.value === '') || template.trigger?.value === ''
      expect(blank, `${template.id} has a blank`).toBe(true)
      expect(conditions.length).toBeGreaterThan(0)
    }
  })

  it('names no skill in any hint, so a hint never points at a better one', () => {
    const names = Object.values(skills).map((skill) => skill.name.toLowerCase())
    for (const template of ruleTemplates) {
      const texts = [...template.rows.flatMap((row) => [row.hint, row.condition?.hint ?? '']), template.trigger?.hint ?? '', template.unlockHint]
      for (const text of texts) {
        for (const name of names) expect(text.toLowerCase().includes(name), `${template.id}: "${text}" names ${name}`).toBe(false)
      }
    }
  })

  it('gives every class one or two templates that are open from the start', () => {
    for (const classId of HERO_CLASSES) {
      const { save, hero } = heroOf(classId)
      const open = templatesFor(hero, save).filter((option) => option.unlocked && option.template.classId === classId)
      expect(open.length, classId).toBeGreaterThanOrEqual(1)
      expect(open.length, classId).toBeLessThanOrEqual(2)
    }
  })

  it('uses only skills that exist', () => {
    for (const template of ruleTemplates) {
      for (const row of template.rows) if (row.skillId !== null) expect(skills[row.skillId], row.skillId).toBeDefined()
    }
  })
})

describe('applying a template', () => {
  it('builds a draft that validation refuses to save until it is filled, for every template and class', () => {
    for (const classId of HERO_CLASSES) {
      const { save, hero } = heroOf(classId)
      for (const option of templatesFor(hero, save)) {
        const applied = applyTemplate(hero, option.template, [])
        const result = applied.stack === null ? validateRules(hero, applied.rows) : validateStacks(hero, [applied.stack])
        expect(result.ok, `${classId} ${option.template.id}`).toBe(false)
        expect(applied.notes.length, option.template.id).toBeGreaterThan(0)
        expect(applied.rows.length).toBeLessThanOrEqual(4)
      }
    }
  })

  it('never names a skill the hero lacks: it becomes a blank slot with the generic hint', () => {
    const { hero } = heroOf('warrior')
    const stripped: SavedHero = { ...hero, progress: { ...hero.progress, loadout: ['driving-blow'] } }
    const template = ruleTemplates.find((entry) => entry.id === 'warrior-hold-the-line')!
    const applied = applyTemplate(stripped, template, [])
    const available = ruleSkillIds(stripped)
    for (const row of applied.rows) expect(row.skillId === '' || available.includes(row.skillId)).toBe(true)
    expect(applied.rows.map((row) => row.skillId)).toEqual(['', ''].map((blank, index) => (available.includes(template.rows[index]!.skillId!) ? template.rows[index]!.skillId! : blank)))
    expect(applied.notes.join(' ')).toContain('Pick one of your equipped skills here.')
  })

  it('fills the trigger and gives a stack template a fresh id and a short name', () => {
    const { hero } = heroOf('assassin')
    const template = ruleTemplates.find((entry) => entry.id === 'assassin-many-blades')!
    const applied = applyTemplate(hero, template, [{ id: 'stack-1', name: 'Old', when: [], rows: [] }])
    expect(applied.stack).toMatchObject({ id: 'stack-2', name: 'Many blades' })
    expect(applied.stack!.when[0]).toMatchObject({ type: 'enemyCount', operator: 'atLeast', value: '' })
    expect(applied.stack!.name.length).toBeLessThanOrEqual(20)
  })

  it('a filled template passes validation and can be saved by the existing rules', () => {
    const { hero } = heroOf('cleric')
    const template = ruleTemplates.find((entry) => entry.id === 'cleric-patient-vow')!
    const applied = applyTemplate(hero, template, [])
    const filled = applied.rows.map((row) => ({ ...row, conditions: row.conditions.map((c) => (c.value === '' && c.type === 'heroHp' ? { ...c, value: '50' } : c)) }))
    expect(validateRules(hero, filled).ok).toBe(true)
  })
})

describe('template unlocks', () => {
  const telegraphing = Object.values(enemies).find((def) => def.archetype !== 'swarm' && (def.skills ?? []).some((skill) => (skill.telegraphMs ?? 0) > 0))!
  const swarm = Object.values(enemies).find((def) => def.archetype === 'swarm')!
  const boss = Object.values(enemies).find((def) => def.boss === true && (def.phases?.length ?? 0) > 1)!

  it('starts locked and follows defeatedEnemyIds', () => {
    const { save } = heroOf('warrior')
    expect(templateUnlocked(save, 'open')).toBe(true)
    for (const unlock of ['telegraph', 'group', 'boss'] as const) expect(templateUnlocked(save, unlock)).toBe(false)
    expect(templateUnlocked(withDefeated(save, telegraphing.id), 'telegraph')).toBe(true)
    expect(templateUnlocked(withDefeated(save, telegraphing.id), 'group')).toBe(false)
    expect(templateUnlocked(withDefeated(save, swarm.id), 'group')).toBe(true)
    expect(templateUnlocked(withDefeated(save, boss.id), 'boss')).toBe(true)
  })

  it('also reads the account defeat record that survives reincarnation', () => {
    const { save } = heroOf('mage')
    const kept = { ...save, account: { ...save.account, discoveries: [...save.account.discoveries, `defeated:${swarm.id}`] } }
    expect(templateUnlocked(kept, 'group')).toBe(true)
  })

  it('lists locked templates with their reason', () => {
    const { save, hero } = heroOf('warrior')
    const options = templatesFor(hero, save)
    const locked = options.find((option) => option.template.id === 'warrior-hold-the-line')!
    expect(locked.unlocked).toBe(false)
    expect(locked.lockedReason).toBe('Defeat an enemy that telegraphs an attack.')
    expect(options.find((option) => option.template.id === 'any-boss-turn')).toBeDefined()
    expect(options.every((option) => option.template.classId === 'warrior' || option.template.classId === 'any')).toBe(true)
  })
})

describe('supply templates', () => {
  it('are open to every class and keep their supply rows', () => {
    for (const classId of HERO_CLASSES) {
      const { save, hero } = heroOf(classId)
      for (const id of ['any-drink-when-low', 'any-ward-with-supplies']) {
        const option = templatesFor(hero, save).find((entry) => entry.template.id === id)
        expect(option?.unlocked, `${classId} ${id}`).toBe(true)
        const applied = applyTemplate(hero, option!.template, [])
        expect(applied.rows.every((row) => row.skillId !== ''), `${classId} ${id} keeps its supplies`).toBe(true)
        expect(applied.notes.length, id).toBeGreaterThan(0)
      }
    }
  })
})

describe('Top up Readiness template (Step 13.41)', () => {
  const template = ruleTemplates.find((entry) => entry.id === 'ranger-top-up-readiness')!

  it('is offered only to a Ranger and is open from the start', () => {
    for (const classId of HERO_CLASSES) {
      const { save, hero } = heroOf(classId)
      const option = templatesFor(hero, save).find((entry) => entry.template.id === template.id)
      if (classId === 'ranger') expect(option?.unlocked).toBe(true)
      else expect(option).toBeUndefined()
    }
  })

  it('uses Hunter\'s Mark at Readiness at most 60 when the hero has it, with a blank second slot', () => {
    const { hero } = heroOf('ranger')
    const equipped: SavedHero = { ...hero, progress: { ...hero.progress, loadout: [...hero.progress.loadout, 'hunters-mark'] } }
    const applied = applyTemplate(equipped, template, [])
    expect(applied.rows[0]!.skillId).toBe('hunters-mark')
    expect(applied.rows[0]!.conditions[0]).toMatchObject({ type: 'resource', operator: 'atMost', value: '60' })
    expect(applied.rows[1]!.skillId).toBe('')
    expect(validateRules(equipped, applied.rows).ok).toBe(false)
  })

  it('leaves a blank slot with the generic hint when Hunter\'s Mark is not equipped', () => {
    const { hero } = heroOf('ranger')
    const applied = applyTemplate({ ...hero, progress: { ...hero.progress, loadout: hero.progress.loadout.filter((id) => id !== 'hunters-mark') } }, template, [])
    expect(applied.rows[0]!.skillId).toBe('')
    expect(applied.notes[0]).toContain('Pick one of your equipped skills here.')
  })
})
