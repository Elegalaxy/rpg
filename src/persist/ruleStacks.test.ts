import { describe, expect, it } from 'vitest'

import { MAX_RULE_STACKS } from '../sim/automation.ts'
import type { RuleStack } from '../sim/types.ts'

import { selectedHero } from './character.ts'
import { blueprintForHero } from './expeditionSetup.ts'
import {
  draftsFromStacks,
  nextStackId,
  saveLoadout,
  saveRuleStacks,
  summarizeTrigger,
  validateStacks,
  type StackDraft,
} from './loadout.ts'
import { runOffline } from './offline.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData } from './save.ts'
import { beginExpedition } from './world.ts'

function heroSave(classId: 'assassin' | 'warrior' = 'assassin'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function stackDraft(partial: Partial<StackDraft> = {}): StackDraft {
  return {
    id: 'stack-1',
    name: 'Packs',
    when: [{ type: 'enemyCount', operator: 'atLeast', value: '2', statusId: '' }],
    rows: [{ skillId: 'shadow-cut', conditions: [], targetPriority: '' }],
    ...partial,
  }
}

function withStacks(save: SaveData, drafts: readonly StackDraft[]): SaveData {
  const result = saveRuleStacks(save, 'hero-1', drafts)
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

describe('rule stacks in the save', () => {
  it('gives new heroes no stacks, and loads an old save without the field as []', () => {
    const save = heroSave()
    expect(hero(save).ruleStacks).toEqual([])
    const raw = JSON.parse(serializeSave(save)) as { heroes: Record<string, unknown>[] }
    delete raw.heroes[0]!.ruleStacks
    const parsed = parseSave(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(hero(parsed.data).ruleStacks).toEqual([])
  })

  it('round-trips stacks through serialize and parse', () => {
    const save = withStacks(heroSave(), [stackDraft(), stackDraft({ id: 'stack-2', name: 'Manual', when: [] })])
    expect(hero(save).ruleStacks).toHaveLength(2)
    const parsed = parseSave(serializeSave(save))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(hero(parsed.data).ruleStacks).toEqual(hero(save).ruleStacks)
    const back = draftsFromStacks(hero(save).ruleStacks)
    expect(withStacks(save, back)).toEqual(save)
  })

  it('refuses a save whose stacks are invalid', () => {
    const save = withStacks(heroSave(), [stackDraft()])
    const raw = JSON.parse(serializeSave(save)) as { heroes: { ruleStacks: Record<string, unknown>[] }[] }
    raw.heroes[0]!.ruleStacks[0]!.name = ''
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
    raw.heroes[0]!.ruleStacks[0]!.name = 'Packs'
    raw.heroes[0]!.ruleStacks[0]!.id = 'default'
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
    expect(() => assertSaveData(save)).not.toThrow()
  })
})

describe('stack validation', () => {
  it('names the stack and the rule in each error', () => {
    const save = heroSave()
    const result = validateStacks(hero(save), [
      stackDraft({ rows: [{ skillId: 'shadow-cut', conditions: [], targetPriority: '' }, { skillId: '', conditions: [], targetPriority: '' }] }),
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toEqual(['Stack "Packs": Rule 2: pick a skill.'])
  })

  it('rejects a skill that is not equipped, a bad trigger, an empty name and too many stacks', () => {
    const h = hero(heroSave())
    const unequipped = validateStacks(h, [stackDraft({ rows: [{ skillId: 'smite', conditions: [], targetPriority: '' }] })])
    expect(unequipped.ok).toBe(false)
    const badTrigger = validateStacks(h, [stackDraft({ when: [{ type: 'enemyCount', operator: 'atLeast', value: 'x', statusId: '' }] })])
    expect(badTrigger.ok).toBe(false)
    if (!badTrigger.ok) expect(badTrigger.errors[0]).toMatch(/^Stack "Packs", trigger 1:/)
    const unnamed = validateStacks(h, [stackDraft({ name: '  ' })])
    expect(unnamed.ok).toBe(false)
    const many = Array.from({ length: MAX_RULE_STACKS + 1 }, (_, i) => stackDraft({ id: `stack-${i + 1}`, name: `S${i + 1}` }))
    expect(validateStacks(h, many).ok).toBe(false)
    expect(saveRuleStacks(heroSave(), 'hero-1', [stackDraft({ name: '' })]).ok).toBe(false)
  })

  it('summarises a trigger, and picks the next free id', () => {
    expect(summarizeTrigger(stackDraft(), 'assassin')).toMatch(/^Auto when /)
    expect(summarizeTrigger(stackDraft({ when: [] }), 'assassin')).toBe('Manual only')
    expect(nextStackId([])).toBe('stack-1')
    expect(nextStackId([{ id: 'stack-1' }, { id: 'stack-3' }])).toBe('stack-2')
  })
})

describe('loadout changes', () => {
  it('prunes stack rows for unequipped skills and counts them', () => {
    const save = withStacks(heroSave(), [
      stackDraft({
        rows: [
          { skillId: 'shadow-cut', conditions: [], targetPriority: '' },
          { skillId: 'execute', conditions: [], targetPriority: '' },
        ],
      }),
    ])
    const plain = saveLoadout(heroSave(), 'hero-1', ['mark-for-death', 'shadow-cut'])
    const result = saveLoadout(save, 'hero-1', ['mark-for-death', 'shadow-cut'])
    if (!result.ok || !plain.ok) throw new Error('loadout')
    expect(hero(result.save).ruleStacks[0]!.rows.map((row) => row.skillId)).toEqual(['shadow-cut'])
    expect(result.removedRules).toBe(plain.removedRules + 1)
  })
})

describe('expedition setup', () => {
  it('carries stacks only when the hero has some', () => {
    const none = blueprintForHero(hero(heroSave()), 'splintered-road')
    expect('ruleStacks' in none.hero).toBe(false)
    const stacked = withStacks(heroSave(), [stackDraft()])
    const stacks: RuleStack[] = hero(stacked).ruleStacks
    const some = blueprintForHero(hero(stacked), 'splintered-road')
    expect(some.hero.ruleStacks).toEqual(stacks)
  })
})

describe('away run with stacks', () => {
  it('is deterministic for a fixed seed', () => {
    const made = heroSave('warrior')
    const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
    const strong: SaveData = {
      ...made,
      heroes: made.heroes.map((entry) => ({ ...entry, progress: { ...entry.progress, level: 40, attributes } })),
    }
    const stacked = withStacks(strong, [
      stackDraft({ rows: [{ skillId: hero(strong).progress.loadout[0]!, conditions: [], targetPriority: '' }] }),
    ])
    const started = beginExpedition(stacked, 'splintered-road', 5)
    if (!started.ok) throw new Error(started.reason)
    const first = runOffline(started.save, 20 * 60_000, true)
    const second = runOffline(started.save, 20 * 60_000, true)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.summary.replayedMs).toBeGreaterThan(0)
  })
})
