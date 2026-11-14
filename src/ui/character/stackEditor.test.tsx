import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { selectedHero } from '../../persist/character.ts'
import { saveRuleStacks } from '../../persist/loadout.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { commitSave, getSaveStatus, saveRulesFromUi } from '../store.ts'

import { Rules, RulesForm } from './Rules.tsx'
import { addStack, deleteStack, duplicateStack, hasTrigger, moveStack, patchStack } from './stackEdit.ts'

function assassin() {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'assassin' })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

function heroOf(save: ReturnType<typeof assassin>) {
  const hero = selectedHero(save)
  if (hero === null) throw new Error('no hero')
  return hero
}

const groupTrigger = { type: 'enemyCount' as const, operator: 'atLeast', value: '2', statusId: '' }
const cut = { skillId: 'shadow-cut', conditions: [], targetPriority: '' as const }

function withStacks(drafts: Parameters<typeof saveRuleStacks>[2]) {
  const result = saveRuleStacks(assassin(), 'hero-1', drafts)
  if (!result.ok) throw new Error(result.reason)
  return heroOf(result.save)
}

describe('rule stack editor', () => {
  it('leaves a hero without stacks as it was: no tab row, a New stack button and the explanation', () => {
    const html = renderToStaticMarkup(<RulesForm hero={heroOf(assassin())} />)
    expect(html).not.toContain('role="tablist"')
    expect(html).toContain('New stack')
    expect(html).not.toContain('Stack name')
    expect(html).toContain('Rules: ')
    expect(html).toContain('Add rule')
    expect(html).toContain('Save rules')
  })

  it('creates, renames, triggers and reorders stacks as pure edits', () => {
    let stacks = addStack([])
    expect(stacks[0]).toMatchObject({ id: 'stack-1', name: 'Stack 1', when: [], rows: [] })
    stacks = patchStack(stacks, 'stack-1', { name: 'Group', when: [groupTrigger] })
    stacks = patchStack(addStack(stacks), 'stack-2', { name: 'Single' })
    expect(stacks.map((entry) => entry.name)).toEqual(['Group', 'Single'])
    expect(hasTrigger(stacks[0]!)).toBe(true)
    expect(hasTrigger(stacks[1]!)).toBe(false)
    expect(moveStack(stacks, 'stack-2', -1).map((entry) => entry.id)).toEqual(['stack-2', 'stack-1'])
    expect(moveStack(stacks, 'stack-1', -1).map((entry) => entry.id)).toEqual(['stack-1', 'stack-2'])
  })

  it('duplicates with a fresh id and a short name, deletes, and stops at the limit', () => {
    let stacks = patchStack(addStack([]), 'stack-1', { name: 'A very long stack name', when: [groupTrigger] })
    stacks = duplicateStack(stacks, 'stack-1')
    expect(stacks.map((entry) => entry.id)).toEqual(['stack-1', 'stack-2'])
    expect(stacks[1]!.name.length).toBeLessThanOrEqual(20)
    expect(stacks[1]!.when).toEqual(stacks[0]!.when)
    expect(stacks[1]!.when[0]).not.toBe(stacks[0]!.when[0])
    expect(deleteStack(stacks, 'stack-1').map((entry) => entry.id)).toEqual(['stack-2'])
    stacks = addStack(stacks)
    expect(stacks).toHaveLength(3)
    expect(addStack(stacks)).toHaveLength(3)
    expect(duplicateStack(stacks, 'stack-1')).toHaveLength(3)
  })

  it('shows tabs with Auto and Manual only tags, the trigger editor and the explanations', () => {
    const hero = withStacks([
      { id: 'stack-1', name: 'Group', when: [groupTrigger], rows: [cut] },
      { id: 'stack-2', name: 'Single', when: [], rows: [] },
    ])
    const html = renderToStaticMarkup(<RulesForm hero={hero} initialTab="stack-1" />)
    expect(html).toContain('role="tablist"')
    for (const text of ['Fallback', 'Group', 'Auto', 'Manual only', 'Switch to this stack when', 'Stack trigger condition 1 type']) {
      expect(html).toContain(text)
    }
    for (const label of ['Move stack Group up', 'Duplicate stack Group', 'Delete stack Group', 'Rules in Group']) {
      expect(html).toContain(label)
    }
    expect(html).not.toContain('A hero can have at most 4 stacks.')
  })

  it('says why New stack is off at four stacks', () => {
    const hero = withStacks([1, 2, 3].map((n) => ({ id: `stack-${n}`, name: `S${n}`, when: [], rows: [] })))
    const html = renderToStaticMarkup(<RulesForm hero={hero} />)
    expect(html).toContain('title="A hero can have at most 4 stacks."')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>New stack/)
  })

  it('names the stack and the rule in a problem, and keeps Save off', () => {
    const hero = withStacks([{ id: 'stack-1', name: 'Group', when: [groupTrigger], rows: [cut] }])
    const stack = hero.ruleStacks[0]!
    const broken = { ...hero, ruleStacks: [{ ...stack, rows: [{ skillId: '' }, ...stack.rows] }] }
    const html = renderToStaticMarkup(<RulesForm hero={broken} initialTab="stack-1" />)
    expect(html).toContain('Stack &quot;Group&quot;: Rule 1: pick a skill.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save rules/)
  })

  it('saves every stack with the rules and persists them in the save', () => {
    commitSave(assassin(), 'test', false)
    const problem = saveRulesFromUi(
      [cut],
      [
        { id: 'stack-1', name: 'Group', when: [groupTrigger], rows: [cut] },
        { id: 'stack-2', name: 'Single', when: [], rows: [] },
      ],
    )
    expect(problem).toEqual([])
    const hero = heroOf(getSaveStatus().save)
    expect(hero.ruleStacks.map((entry) => entry.name)).toEqual(['Group', 'Single'])
    expect(hero.ruleStacks[0]!.when).toHaveLength(1)
    const html = renderToStaticMarkup(<Rules />)
    expect(html).toContain('role="tablist"')
    expect(html).toContain('Single')
  })

  it('returns the validation message for a bad stack name instead of saving', () => {
    commitSave(assassin(), 'test', false)
    const problem = saveRulesFromUi([], [{ id: 'stack-1', name: '  ', when: [], rows: [] }])
    expect(problem.join(' ')).toContain('the name must be 1 to 20 characters')
    expect(heroOf(getSaveStatus().save).ruleStacks).toEqual([])
  })
})
