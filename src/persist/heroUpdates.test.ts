import { describe, expect, it } from 'vitest'

import { DEFAULT_SUPPLY_ROWS, GREATER_DRAUGHT_ROW, RIFTGLASS_WARD_ROW, WARD_CHARM_ROW, WARMING_TONIC_BURN_ROW, WARMING_TONIC_ROW } from '../content/supplies.ts'
import { classWebs } from '../content/webs/index.ts'
import type { PriorityRow } from '../sim/types.ts'

import { HERO_UPDATES, applyHeroUpdates } from './heroUpdates.ts'
import { createHero } from './roster.ts'
import { newSave, parseSave, serializeSave, type SaveData, type SavedHero } from './save.ts'

const OLD_RANGER_ROWS: PriorityRow[] = [
  { skillId: 'snare-trap', conditions: [{ kind: 'telegraph', operator: 'present' }] },
  { skillId: 'volley', conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 3 }] },
  { skillId: 'aimed-shot', conditions: [{ kind: 'classResource', operator: 'atLeast', value: 80 }] },
  { skillId: 'piercing-arrow' },
]

function fresh(classId: 'warrior' | 'ranger' | 'assassin'): SaveData {
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
    expect(rows.map((row) => row.skillId)).toEqual(['greater-draught', 'healing-draught', 'antidote', 'riftglass-ward', 'ward-charm', 'warming-tonic', 'warming-tonic', 'driving-blow'])
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
    expect(loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: own })).heroes[0]!.priorityRows).toEqual([own[0], RIFTGLASS_WARD_ROW, WARD_CHARM_ROW, WARMING_TONIC_ROW, WARMING_TONIC_BURN_ROW, GREATER_DRAUGHT_ROW, own[1]])
    const eleven = Array.from({ length: 11 }, () => ({ skillId: 'driving-blow' }))
    const rows = loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: eleven })).heroes[0]!.priorityRows
    expect(rows.map((row) => row.skillId)).toEqual(['greater-draught', ...eleven.map((row) => row.skillId)])
  })

  it('adds the Burn Tonic row right after an existing Tonic row, once, and not when a Burn row exists', () => {
    const own: PriorityRow[] = [{ skillId: 'healing-draught' }, WARMING_TONIC_ROW, { skillId: 'driving-blow' }]
    const rows = loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: own })).heroes[0]!.priorityRows
    const at = rows.findIndex((row) => row.skillId === 'warming-tonic')
    expect(rows[at + 1]).toEqual(WARMING_TONIC_BURN_ROW)
    expect(rows.filter((row) => row.skillId === 'warming-tonic')).toHaveLength(2)
    const named = loadOld(fresh('warrior'), (hero) => ({ ...hero, priorityRows: [WARMING_TONIC_BURN_ROW, ...own] })).heroes[0]!.priorityRows
    expect(named.filter((row) => row.skillId === 'warming-tonic' && (row.conditions ?? []).some((c) => c.kind === 'status' && c.statusId === 'burn'))).toHaveLength(1)
  })

  it('swaps an old starting Volley for Fade Back and its starting rule', () => {
    const hero = loadOld(fresh('ranger'), (entry) => oldRanger(entry)).heroes[0]!
    expect(hero.progress.learnedSkillIds).toEqual(['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap', 'fade-back'])
    expect(hero.progress.loadout).toEqual(['aimed-shot', 'piercing-arrow', 'fade-back', 'snare-trap'])
    expect(hero.priorityRows.map((row) => row.skillId)).toEqual(['greater-draught', 'healing-draught', 'antidote', 'riftglass-ward', 'ward-charm', 'warming-tonic', 'warming-tonic', 'fade-back', 'snare-trap', 'aimed-shot', 'piercing-arrow'])
    expect(hero.priorityRows[7]).toEqual({ skillId: 'fade-back', conditions: [{ kind: 'telegraph', operator: 'present' }] })
  })

  it('only teaches Fade Back to a Ranger whose Volley came from the node', () => {
    const volleyNode = classWebs.ranger.nodes.find((node) => node.unlocksSkillId === 'volley')!.id
    const hero = loadOld(fresh('ranger'), (entry) => oldRanger(entry, [volleyNode])).heroes[0]!
    expect(hero.progress.learnedSkillIds).toContain('fade-back')
    expect(hero.progress.loadout).toEqual(['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap'])
    expect(hero.priorityRows.map((row) => row.skillId)).toEqual(['greater-draught', 'healing-draught', 'antidote', 'riftglass-ward', 'ward-charm', 'warming-tonic', 'warming-tonic', 'snare-trap', 'volley', 'aimed-shot', 'piercing-arrow'])
  })

  it('changes nothing for a new hero', () => {
    const save = fresh('ranger')
    const parsed = parseSave(serializeSave(save))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.data).toEqual(save)
  })
})

describe('Venom Edge becomes a passive (Step 13.39)', () => {
  const OLD_FOUR = ['mark-for-death', 'shadow-cut', 'venom-edge', 'execute']
  const readyVenom = { kind: 'skillReady' as const, skillId: 'venom-edge', operator: 'present' as const }
  const oldAssassin = (hero: SavedHero, extra: Partial<SavedHero> = {}): SavedHero => ({
    ...hero,
    progress: { ...hero.progress, learnedSkillIds: [...OLD_FOUR], loadout: [...OLD_FOUR], allocatedNodeIds: ['assassin-venom-edge', 'assassin-potent-toxins'] },
    priorityRows: [
      { skillId: 'mark-for-death', conditions: [{ kind: 'mark', operator: 'absent' }] },
      { skillId: 'venom-edge', conditions: [{ kind: 'status', who: 'target', statusId: 'poison', measure: 'stacks', operator: 'atMost', value: 2 }] },
      { skillId: 'execute', conditions: [readyVenom, { kind: 'hpPercent', who: 'target', operator: 'atMost', value: 30 }] },
      { skillId: 'shadow-cut' },
    ],
    ruleStacks: [
      { id: 'burst', name: 'Burst', when: [{ kind: 'hpPercent', who: 'target', operator: 'atMost', value: 50 }], rows: [{ skillId: 'venom-edge' }, { skillId: 'shadow-cut' }] },
    ],
    ...extra,
  })

  it('strips Venom Edge from the loadout, learned list, rules and stacks, and keeps the node', () => {
    const hero = loadOld(fresh('assassin'), (entry) => oldAssassin(entry)).heroes[0]!
    expect(hero.progress.loadout).toEqual(['mark-for-death', 'shadow-cut', 'execute'])
    expect(hero.progress.learnedSkillIds).toEqual(['mark-for-death', 'shadow-cut', 'execute'])
    expect(hero.progress.allocatedNodeIds).toContain('assassin-venom-edge')
    const mine = hero.priorityRows.filter((row) => !['greater-draught', 'healing-draught', 'antidote', 'riftglass-ward', 'ward-charm', 'warming-tonic'].includes(row.skillId))
    expect(mine.map((row) => row.skillId)).toEqual(['mark-for-death', 'execute', 'shadow-cut'])
    expect(mine[1]!.conditions).toEqual([{ kind: 'hpPercent', who: 'target', operator: 'atMost', value: 30 }])
    expect(hero.ruleStacks[0]!.rows.map((row) => row.skillId)).toEqual(['shadow-cut'])
    expect(hero.updates).toContain('assassin-venom-passive')
  })

  it('drops a stack whose only trigger named Venom Edge, and cleans 13.37 past loadout and waiting data', () => {
    const hero = loadOld(fresh('assassin'), (entry) =>
      oldAssassin(entry, {
        ruleStacks: [{ id: 'only', name: 'Only', when: [readyVenom], rows: [{ skillId: 'shadow-cut' }] }],
        pastLoadout: ['mark-for-death', 'venom-edge', 'shadow-cut'],
        waitingSkillIds: ['venom-edge'],
      }),
    ).heroes[0]!
    expect(hero.ruleStacks).toEqual([])
    expect(hero.pastLoadout).toEqual(['mark-for-death', 'shadow-cut'])
    expect(hero.waitingSkillIds).toBeUndefined()
    const some = loadOld(fresh('assassin'), (entry) => oldAssassin(entry, { waitingSkillIds: ['venom-edge', 'fan-of-knives'] })).heroes[0]!
    expect(some.waitingSkillIds).toEqual(['fan-of-knives'])
  })

  it('is idempotent, and leaves a new hero and other classes alone', () => {
    const migrated = loadOld(fresh('assassin'), (entry) => oldAssassin(entry))
    const again = applyHeroUpdates(migrated)
    expect(again).toBe(migrated)
    const reparsed = parseSave(serializeSave(migrated))
    if (!reparsed.ok) throw new Error(reparsed.reason)
    expect(reparsed.data).toEqual(migrated)
    const made = fresh('assassin').heroes[0]!
    expect(made.progress.loadout).toEqual(['mark-for-death', 'shadow-cut', 'execute'])
    expect(made.updates).toContain('assassin-venom-passive')
    const warrior = loadOld(fresh('warrior'), (entry) => entry).heroes[0]!
    expect(warrior.progress.loadout).toEqual(fresh('warrior').heroes[0]!.progress.loadout)
  })
})
