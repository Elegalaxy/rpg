import { describe, expect, it } from 'vitest'

import { DEFAULT_SUPPLY_ROWS, GREATER_DRAUGHT_ROW, RIFTGLASS_WARD_ROW, WARD_CHARM_ROW, WARMING_TONIC_ROW } from '../content/supplies.ts'
import { classWebs } from '../content/webs/index.ts'
import type { PriorityRow } from '../sim/types.ts'

import { HERO_UPDATES } from './heroUpdates.ts'
import { createHero } from './roster.ts'
import { newSave, parseSave, serializeSave, type SaveData, type SavedHero } from './save.ts'

const OLD_RANGER_ROWS: PriorityRow[] = [
  { skillId: 'snare-trap', conditions: [{ kind: 'telegraph', operator: 'present' }] },
  { skillId: 'volley', conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 3 }] },
  { skillId: 'aimed-shot', conditions: [{ kind: 'classResource', operator: 'atLeast', value: 80 }] },
  { skillId: 'piercing-arrow' },
]

function fresh(classId: 'warrior' | 'ranger'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

/** Save the hero as a save from before the updates existed, then load it again. */
function loadOld(save: SaveData, change: (hero: SavedHero) => SavedHero): SaveData {
  const raw = JSON.parse(serializeSave({ ...save, heroes: save.heroes.map(change) })) as { heroes: Record<string, unknown>[] }
  for (const hero of raw.heroes) delete hero.updates
  const parsed = parseSave(JSON.stringify(raw))
  if (!parsed.ok) throw new Error(parsed.reason)
  return parsed.data
}

function oldRanger(hero: SavedHero, extraNodes: string[] = []): SavedHero {
  const learned = ['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap']
  return {
    ...hero,
    progress: { ...hero.progress, learnedSkillIds: learned, loadout: [...learned], allocatedNodeIds: [...hero.progress.allocatedNodeIds, ...extraNodes] },
    priorityRows: OLD_RANGER_ROWS,
  }
}

describe('one-time hero updates', () => {
  it('puts the crafted supply rules just above their basic counterparts, once', () => {
    const own: PriorityRow[] = [{ skillId: 'healing-draught' }, { skillId: 'antidote' }, { skillId: 'ward-charm' }, { skillId: 'driving-blow' }]
    const rows = loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: own })).heroes[0]!.priorityRows
    expect(rows.map((row) => row.skillId)).toEqual(['greater-draught', 'healing-draught', 'antidote', 'riftglass-ward', 'ward-charm', 'warming-tonic', 'driving-blow'])
    const named = loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: [{ skillId: 'greater-draught' }, ...own] })).heroes[0]!.priorityRows
    expect(named.filter((row) => row.skillId === 'greater-draught')).toHaveLength(1)
  })

  it('gives an existing hero the supply rules on top, once', () => {
    const plain = [{ skillId: 'driving-blow' }]
    const loaded = loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: plain }))
    const hero = loaded.heroes[0]!
    expect(hero.priorityRows).toEqual([...DEFAULT_SUPPLY_ROWS, ...plain])
    expect(hero.updates).toEqual([...HERO_UPDATES])

    const removed = { ...loaded, heroes: [{ ...hero, priorityRows: plain }] }
    const again = parseSave(serializeSave(removed))
    if (!again.ok) throw new Error(again.reason)
    expect(again.data.heroes[0]!.priorityRows).toEqual(plain)
  })

  it('leaves a hero that already names a supply alone, and fits the 12-rule limit', () => {
    const own: PriorityRow[] = [{ skillId: 'antidote' }, { skillId: 'driving-blow' }]
    expect(loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: own })).heroes[0]!.priorityRows).toEqual([own[0], RIFTGLASS_WARD_ROW, WARD_CHARM_ROW, WARMING_TONIC_ROW, GREATER_DRAUGHT_ROW, own[1]])
    const eleven = Array.from({ length: 11 }, () => ({ skillId: 'driving-blow' }))
    const rows = loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: eleven })).heroes[0]!.priorityRows
    expect(rows.map((row) => row.skillId)).toEqual(['greater-draught', ...eleven.map((row) => row.skillId)])
  })

  it('swaps an old starting Volley for Fade Back and its starting rule', () => {
    const hero = loadOld(fresh('ranger'), (entry) => oldRanger(entry)).heroes[0]!
    expect(hero.progress.learnedSkillIds).toEqual(['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap', 'fade-back'])
    expect(hero.progress.loadout).toEqual(['aimed-shot', 'piercing-arrow', 'fade-back', 'snare-trap'])
    expect(hero.priorityRows.map((row) => row.skillId)).toEqual(['greater-draught', 'healing-draught', 'antidote', 'riftglass-ward', 'ward-charm', 'warming-tonic', 'fade-back', 'snare-trap', 'aimed-shot', 'piercing-arrow'])
    expect(hero.priorityRows[6]).toEqual({ skillId: 'fade-back', conditions: [{ kind: 'telegraph', operator: 'present' }] })
  })

  it('only teaches Fade Back to a Ranger whose Volley came from the node', () => {
    const volleyNode = classWebs.ranger.nodes.find((node) => node.unlocksSkillId === 'volley')!.id
    const hero = loadOld(fresh('ranger'), (entry) => oldRanger(entry, [volleyNode])).heroes[0]!
    expect(hero.progress.learnedSkillIds).toContain('fade-back')
    expect(hero.progress.loadout).toEqual(['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap'])
    expect(hero.priorityRows.map((row) => row.skillId)).toEqual(['greater-draught', 'healing-draught', 'antidote', 'riftglass-ward', 'ward-charm', 'warming-tonic', 'snare-trap', 'volley', 'aimed-shot', 'piercing-arrow'])
  })

  it('changes nothing for a new hero', () => {
    const save = fresh('ranger')
    const parsed = parseSave(serializeSave(save))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.data).toEqual(save)
  })
})
