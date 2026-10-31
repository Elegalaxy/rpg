import { describe, expect, it } from 'vitest'

import { gameDefs, setupForScenario } from '../content/scenarios.ts'
import { chooseHeroAction, setPriorityRules } from '../sim/automation.ts'
import { NODE_SACRED_BALANCE } from '../sim/classes/clericAdjust.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { HERO_CLASSES } from '../sim/constants.ts'

import { grantPoints, selectedHero } from './character.ts'
import {
  MAX_PRIORITY_ROWS,
  buildCondition,
  describeCondition,
  draftsFromRows,
  kindsFor,
  newCondition,
  ruleSkillIds,
  saveLoadout,
  saveRules,
  validateRules,
  type RowDraft,
} from './loadout.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, type SaveData } from './save.ts'

function heroSave(classId: (typeof HERO_CLASSES)[number] = 'assassin'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  return grantPoints(made.save, 'hero-1', 0, 0)
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function draft(skillId: string, partial: Partial<RowDraft> = {}): RowDraft {
  return { skillId, conditions: [], targetPriority: '', ...partial }
}

describe('condition drafts', () => {
  it('builds each kind into the sim shape', () => {
    const cases: [ReturnType<typeof newCondition>, object][] = [
      [{ ...newCondition('heroHp'), operator: 'atMost', value: '40' }, { kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }],
      [{ ...newCondition('targetHp'), operator: 'atLeast', value: '90' }, { kind: 'hpPercent', who: 'target', operator: 'atLeast', value: 90 }],
      [{ ...newCondition('resource'), operator: 'atLeast', value: '3' }, { kind: 'classResource', operator: 'atLeast', value: 3 }],
      [{ ...newCondition('wrath'), operator: 'atLeast', value: '25' }, { kind: 'balance', meter: 'wrath', operator: 'atLeast', value: 25 }],
      [{ ...newCondition('grace'), operator: 'atMost', value: '10' }, { kind: 'balance', meter: 'grace', operator: 'atMost', value: 10 }],
      [{ ...newCondition('enemyCount'), operator: 'atLeast', value: '2' }, { kind: 'enemyCount', operator: 'atLeast', value: 2 }],
      [{ ...newCondition('specialAmmo'), operator: 'atLeast', value: '1' }, { kind: 'specialAmmo', operator: 'atLeast', value: 1 }],
      [{ ...newCondition('barrier'), operator: 'absent' }, { kind: 'barrier', operator: 'absent' }],
      [{ ...newCondition('telegraph'), operator: 'present' }, { kind: 'telegraph', operator: 'present' }],
      [{ ...newCondition('mark'), operator: 'absent' }, { kind: 'mark', operator: 'absent' }],
      [
        { ...newCondition('targetStatus'), statusId: 'poison', operator: 'absent' },
        { kind: 'status', who: 'target', statusId: 'poison', measure: 'presence', operator: 'absent' },
      ],
      [
        { ...newCondition('heroStatus'), statusId: 'chill', operator: 'present' },
        { kind: 'status', who: 'hero', statusId: 'chill', measure: 'presence', operator: 'present' },
      ],
    ]
    for (const [input, expected] of cases) expect(buildCondition(input)).toEqual(expected)
  })

  it('names what is wrong with a bad condition', () => {
    expect(buildCondition({ ...newCondition('heroHp'), value: '' })).toBe('Hero HP % needs a number.')
    expect(buildCondition({ ...newCondition('heroHp'), value: 'abc' })).toBe('Hero HP % must be a number.')
    expect(buildCondition({ ...newCondition('heroHp'), value: '101' })).toBe('Hero HP % must be from 0 to 100.')
    expect(buildCondition({ ...newCondition('heroHp'), value: '-1' })).toBe('Hero HP % must be from 0 to 100.')
    expect(buildCondition({ ...newCondition('resource'), value: '-2' })).toBe('Class resource cannot be negative.')
    expect(buildCondition({ ...newCondition('barrier'), operator: 'atMost' })).toBe('Hero barrier: pick how to compare.')
  })

  it('offers only the kinds a class can use', () => {
    const types = (classId: (typeof HERO_CLASSES)[number]) => kindsFor(classId).map((kind) => kind.type)
    expect(types('assassin')).toContain('mark')
    expect(types('warrior')).not.toContain('mark')
    expect(types('ranger')).toContain('specialAmmo')
    expect(types('mage')).not.toContain('specialAmmo')
    expect(types('cleric')).toEqual(expect.arrayContaining(['grace', 'wrath']))
    expect(types('warrior')).not.toContain('wrath')
  })

  it('describes saved conditions in plain words', () => {
    expect(describeCondition({ kind: 'classResource', operator: 'atLeast', value: 3 }, 'assassin')).toBe('Advantage is at least 3')
    expect(describeCondition({ kind: 'balance', meter: 'wrath', operator: 'atLeast', value: 25 }, 'cleric')).toBe('Wrath is at least 25')
  })
})

describe('rule validation', () => {
  it('rejects bad sets and names the row', () => {
    const saved = hero(heroSave())
    const none = validateRules(saved, [draft('')])
    expect(none).toEqual({ ok: false, errors: ['Rule 1: pick a skill.'] })
    const unequipped = validateRules(saved, [draft('smite')])
    expect(unequipped).toEqual({ ok: false, errors: ['Rule 1: Smite is not in the equipped skills.'] })
    const badValue = validateRules(saved, [draft('execute', { conditions: [{ ...newCondition('heroHp'), value: '500' }] })])
    expect(badValue).toEqual({ ok: false, errors: ['Rule 1, condition 1: Hero HP % must be from 0 to 100.'] })
    const many = validateRules(saved, Array.from({ length: MAX_PRIORITY_ROWS + 1 }, () => draft('execute')))
    expect(many.ok).toBe(false)
    if (!many.ok) expect(many.errors[0]).toMatch(/at most 12 rules/)
    const ok = validateRules(saved, Array.from({ length: MAX_PRIORITY_ROWS }, () => draft('execute')))
    expect(ok.ok).toBe(true)
  })

  it('refuses to save an invalid set and leaves the hero unchanged', () => {
    const save = heroSave()
    const before = JSON.stringify(save)
    const refused = saveRules(save, 'hero-1', [draft('smite')])
    expect(refused).toEqual({ ok: false, reason: 'Rule 1: Smite is not in the equipped skills.' })
    expect(JSON.stringify(save)).toBe(before)
    expect(saveRules(save, 'nobody', []).ok).toBe(false)
  })

  it('round trips the starting rules of every class through the editor', () => {
    for (const classId of HERO_CLASSES) {
      const save = heroSave(classId)
      const rows = hero(save).priorityRows
      const result = validateRules(hero(save), draftsFromRows(rows))
      expect(result, classId).toEqual({ ok: true, rows })
    }
  })

  it('saves a valid set per hero and keeps the save valid', () => {
    const save = heroSave()
    const result = saveRules(save, 'hero-1', [
      draft('execute', { conditions: [{ ...newCondition('resource'), operator: 'atLeast', value: '3' }], targetPriority: 'lowestHpPercent' }),
      draft('shadow-cut'),
    ])
    if (!result.ok) throw new Error(result.reason)
    expect(hero(result.save).priorityRows).toEqual([
      { skillId: 'execute', conditions: [{ kind: 'classResource', operator: 'atLeast', value: 3 }], targetPriority: 'lowestHpPercent' },
      { skillId: 'shadow-cut' },
    ])
    expect(() => assertSaveData(result.save)).not.toThrow()
  })

  it('gives Mage and Cleric their slot skills only with the node', () => {
    const mage = hero(heroSave('mage'))
    expect(ruleSkillIds(mage)).not.toContain('thermal-rupture')
    const withNode = { ...mage, progress: { ...mage.progress, allocatedNodeIds: ['mage-elemental-convergence'] } }
    expect(ruleSkillIds(withNode)).toContain('thermal-rupture')
    const cleric = hero(heroSave('cleric'))
    expect(ruleSkillIds(cleric)).not.toContain('sanctuary-release-heal')
    const living = { ...cleric, progress: { ...cleric.progress, allocatedNodeIds: ['cleric-living-sanctuary'] } }
    expect(ruleSkillIds(living)).toContain('sanctuary-release-heal')
  })
})

describe('loadout', () => {
  it('chooses 1 to 4 learned skills and removes rules for skills it unequips', () => {
    const save = heroSave()
    const keep = ['mark-for-death', 'shadow-cut']
    const result = saveLoadout(save, 'hero-1', keep)
    if (!result.ok) throw new Error(result.reason)
    expect(hero(result.save).progress.loadout).toEqual(keep)
    const rowsBefore = hero(save).priorityRows
    const kept = rowsBefore.filter((row) => keep.includes(row.skillId))
    expect(hero(result.save).priorityRows).toEqual(kept)
    expect(result.removedRules).toBe(rowsBefore.length - kept.length)
    expect(result.removedRules).toBeGreaterThan(0)
    expect(() => assertSaveData(result.save)).not.toThrow()
  })

  it('refuses none, five, duplicates, and skills the hero has not learned', () => {
    const save = heroSave()
    expect(saveLoadout(save, 'hero-1', []).ok).toBe(false)
    expect(saveLoadout(save, 'hero-1', ['mark-for-death', 'shadow-cut', 'venom-edge', 'execute', 'smite']).ok).toBe(false)
    expect(saveLoadout(save, 'hero-1', ['execute', 'execute']).ok).toBe(false)
    expect(saveLoadout(save, 'hero-1', ['smite'])).toEqual({ ok: false, reason: expect.stringMatching(/unlearned/) })
    expect(saveLoadout(save, 'nobody', ['execute']).ok).toBe(false)
  })
})

describe('rules reach the fight', () => {
  it('logs a rulesChanged line when a valid set is applied mid-combat, and an unapplied one when it is not', () => {
    const defs = gameDefs()
    const state = createCombat(setupForScenario('assassin-vs-standard'), defs, 3)
    const checked = validateRules(hero(heroSave()), [
      draft('execute', { conditions: [{ ...newCondition('resource'), operator: 'atLeast', value: '3' }] }),
      draft('shadow-cut'),
    ])
    if (!checked.ok) throw new Error(checked.errors.join(' '))
    setPriorityRules(state, { rows: checked.rows }, defs)
    const changed = state.log.filter((event) => event.type === 'rulesChanged')
    expect(changed).toHaveLength(1)
    expect(changed[0]).toMatchObject({ applied: true, rowCount: 2, reason: null })
    expect(state.hero.priorityRows).toEqual(checked.rows)
    setPriorityRules(state, { rows: [{ skillId: 'nope' }] }, defs)
    expect(state.log.filter((event) => event.type === 'rulesChanged')[1]).toMatchObject({ applied: false })
    expect(state.hero.priorityRows).toEqual(checked.rows)
  })

  it('uses an Execute row at Advantage 3 or more', () => {
    const defs = gameDefs()
    const state = createCombat(setupForScenario('assassin-vs-standard'), defs, 5)
    const checked = validateRules(hero(heroSave()), [
      draft('execute', { conditions: [{ ...newCondition('resource'), operator: 'atLeast', value: '3' }] }),
      draft('shadow-cut'),
    ])
    if (!checked.ok) throw new Error(checked.errors.join(' '))
    setPriorityRules(state, { rows: checked.rows }, defs)
    runCombat(state, defs, 120_000)
    const uses = state.log.filter((event) => event.type === 'priority' && event.decision === 'use' && event.skillId === 'execute')
    expect(uses.length).toBeGreaterThan(0)
    for (const use of uses) {
      if (use.type !== 'priority') continue
      expect(use.rowIndex).toBe(0)
    }
  })

  it('reads Grace and Wrath for a Sacred Balance Cleric', () => {
    const defs = gameDefs()
    const setup = setupForScenario('cleric-vs-standard')
    const state = createCombat({ ...setup, hero: { ...setup.hero, allocatedNodeIds: [NODE_SACRED_BALANCE] } }, defs, 1)
    const rows = validateRules(hero(heroSave('cleric')), [
      draft('mend', { conditions: [{ ...newCondition('wrath'), operator: 'atLeast', value: '25' }] }),
    ])
    if (!rows.ok) throw new Error(rows.errors.join(' '))
    setPriorityRules(state, { rows: rows.rows }, defs)
    state.hero.classState = { ...state.hero.classState, wrath: 10 }
    expect(chooseHeroAction(state, defs, state.hero, state.timeMs).kind).toBe('basicAttack')
    state.hero.classState = { ...state.hero.classState, wrath: 30 }
    const choice = chooseHeroAction(state, defs, state.hero, state.timeMs)
    expect(choice.kind === 'skill' && choice.skill.id).toBe('mend')
    const plain = createCombat(setupForScenario('cleric-vs-standard'), defs, 1)
    setPriorityRules(plain, { rows: rows.rows }, defs)
    expect(chooseHeroAction(plain, defs, plain.hero, plain.timeMs).kind).toBe('basicAttack')
  })
})

describe('conditions the editor cannot change', () => {
  it('keeps them through an edit instead of dropping them', () => {
    const save = heroSave()
    const kept = [
      { kind: 'enemyType' as const, operator: 'equal' as const, value: 'dummy-standard-20' },
      { kind: 'status' as const, who: 'target' as const, statusId: 'poison', measure: 'remaining' as const, operator: 'atLeast' as const, value: 2000 },
    ]
    const rows = [{ skillId: 'execute', conditions: [{ kind: 'classResource' as const, operator: 'atLeast' as const, value: 3 }, ...kept] }]
    const drafts = draftsFromRows(rows)
    expect(drafts[0]?.conditions).toHaveLength(1)
    expect(drafts[0]?.kept).toEqual(kept)
    const result = validateRules(hero(save), drafts)
    expect(result).toEqual({ ok: true, rows })
    const editedFirst = validateRules(hero(save), [{ ...drafts[0]!, conditions: [] }])
    expect(editedFirst).toEqual({ ok: true, rows: [{ skillId: 'execute', conditions: kept }] })
  })
})
