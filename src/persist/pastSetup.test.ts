import { describe, expect, it } from 'vitest'

import { referenceLoadoutFor } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'
import { CONVERGENCE_SKILL_IDS, NODE_ELEMENTAL_CONVERGENCE } from '../sim/classes/mageAdjust.ts'
import type { PriorityRow, RuleStack } from '../sim/types.ts'

import { grantPoints, selectedHero, takeNode } from './character.ts'
import { blueprintForHero } from './expeditionSetup.ts'
import {
  draftsFromRows,
  draftsFromStacks,
  pruneRows,
  rowWaits,
  saveLoadout,
  saveRuleStacks,
  saveRules,
  validateRules,
  waitingSkillIds,
} from './loadout.ts'
import { activeRowIndexes, carriedSetup, combatRules, pastSetups, restoreNotice, returnToLoadout } from './pastSetup.ts'
import { nextLifePreview, reincarnate } from './reincarnation.ts'
import { createHero } from './roster.ts'
import { newSave, parseSave, serializeSave, type SaveData, type SavedHero } from './save.ts'

const STARTING = [...classWebs.warrior.startingSkillIds]
const OLD_LOADOUT = ['driving-blow', 'sundering-blow', 'shield-brace', 'cleave']
const CLEAVE_NODES = ['warrior-driving-blow', 'warrior-rising-heat', 'warrior-cleave']

type Result = { ok: true; save: SaveData } | { ok: false; reason: string }

function ok(result: Result): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

function hero(save: SaveData): SavedHero {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function fresh(classId: 'warrior' | 'ranger' | 'mage' = 'warrior'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  return grantPoints(made.save, 'hero-1', 6, 12)
}

function take(save: SaveData, ids: readonly string[]): SaveData {
  let next = save
  for (const id of ids) next = ok(takeNode(next, 'hero-1', id))
  return next
}

function change(save: SaveData, patch: (hero: SavedHero) => Partial<SavedHero>): SaveData {
  return { ...save, heroes: save.heroes.map((entry) => ({ ...entry, ...patch(entry) })) }
}

const CLEAVE_STACK: RuleStack = { id: 'stack-1', name: 'Crowd', when: [{ kind: 'skillReady', skillId: 'cleave', operator: 'present' }], rows: [{ skillId: 'cleave' }] }
const MIXED_STACK: RuleStack = { id: 'stack-2', name: 'Mixed', when: [], rows: [{ skillId: 'cleave' }, { skillId: 'driving-blow' }] }

/** A warrior at the end of a life: cleave learned and equipped in place of Second Wind, rules and stacks set, a boss faced. */
function endOfLife(extra: (hero: SavedHero) => Partial<SavedHero> = () => ({})): SaveData {
  const learned = take(fresh(), CLEAVE_NODES)
  const equipped = ok(saveLoadout(learned, 'hero-1', OLD_LOADOUT))
  return change(equipped, (entry) => ({
    priorityRows: [{ skillId: 'cleave' }, { skillId: 'driving-blow' }],
    ruleStacks: [CLEAVE_STACK, MIXED_STACK],
    bossLossThisLife: true,
    ...extra(entry),
  }))
}

function saveLoadoutOk(save: SaveData, ids: readonly string[]) {
  const result = saveLoadout(save, 'hero-1', ids)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('carriedSetup', () => {
  it('deep-copies the rows and stacks and remembers the old loadout', () => {
    const old = hero(endOfLife())
    const next = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    expect(next.pastLoadouts).toEqual([OLD_LOADOUT])
    expect(next.ruleStacks).toEqual(old.ruleStacks)
    expect(next.ruleStacks[0]).not.toBe(old.ruleStacks[0])
    expect(next.priorityRows.slice(0, 2)).toEqual(old.priorityRows)
    expect(next.priorityRows[0]).not.toBe(old.priorityRows[0])
  })

  it('lists the skills the rules name that the new life cannot use, and counts them', () => {
    const next = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    expect(next.waitingSkillIds).toEqual(['cleave'])
    // Default 3 rules (cleave, driving blow, the Second Wind stand-in) and 3 stack rules; 4 name Cleave or wait for it.
    expect(nextLifePreview(hero(endOfLife()), []).setup).toEqual({ rules: 6, stacks: 2, waitingRules: 3 })
  })

  it('appends reference rows only for starting skills the old loadout did not have', () => {
    const next = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    const secondWind = referenceLoadoutFor('warrior').priorityRows.filter((row) => row.skillId === 'second-wind')
    expect(secondWind).toHaveLength(1)
    expect(next.priorityRows).toEqual([{ skillId: 'cleave' }, { skillId: 'driving-blow' }, ...secondWind])
    const same = hero(ok(reincarnate(change(fresh(), () => ({ bossLossThisLife: true, priorityRows: [{ skillId: 'driving-blow' }] })), 'hero-1', null)))
    expect(same.priorityRows).toEqual([{ skillId: 'driving-blow' }])
  })

  it('stops at the row cap and adds nothing to a full Default list', () => {
    const full: PriorityRow[] = Array.from({ length: MAX_PRIORITY_ROWS }, () => ({ skillId: 'driving-blow' }))
    const next = hero(ok(reincarnate(endOfLife(() => ({ priorityRows: full })), 'hero-1', null)))
    expect(next.priorityRows).toHaveLength(MAX_PRIORITY_ROWS)
    expect(next.priorityRows.some((row) => row.skillId === 'second-wind')).toBe(false)
    const eleven = hero(ok(reincarnate(endOfLife(() => ({ priorityRows: full.slice(0, 11) })), 'hero-1', null)))
    expect(eleven.priorityRows).toHaveLength(MAX_PRIORITY_ROWS)
    expect(eleven.priorityRows[11]!.skillId).toBe('second-wind')
  })

  it('has no waiting skills for a hero whose rules all use available skills', () => {
    const base = hero(fresh())
    const setup = carriedSetup(base, base.progress)
    expect(setup.waitingSkillIds).toEqual([])
    expect(setup.priorityRows).toEqual(base.priorityRows)
    expect(setup.stats.waitingRules).toBe(0)
  })

  it('keeps preparation and prepared spells, and cuts special arrows to the quiver limit', () => {
    const ranger = take(fresh('ranger'), ['ranger-snare-trap', 'ranger-reinforced-snare', 'ranger-flame-arrow', 'ranger-efficient-quiver'])
    const lived = change(ranger, () => ({ bossLossThisLife: true, specialAmmo: 8, carryGold: 12, retreatAtMost: 0.3, preparedSpells: ['fireball'] }))
    expect(hero(lived).progress.allocatedNodeIds).toContain('ranger-efficient-quiver')
    const next = hero(ok(reincarnate(lived, 'hero-1', null)))
    expect(next.specialAmmo).toBe(6)
    expect([next.carryGold, next.retreatAtMost, next.preparedSpells]).toEqual([12, 0.3, ['fireball']])
  })

  it('keeps packed supplies as they were (a supply the stash cannot cover is skipped at run start)', () => {
    const next = hero(ok(reincarnate(endOfLife(() => ({ packedSupplies: ['healing-draught'] })), 'hero-1', null)))
    expect(next.packedSupplies).toEqual(['healing-draught'])
  })
})

describe('combatRules and the blueprint', () => {
  it('is the saved content when nothing waits, and the blueprint is unchanged', () => {
    const base = hero(fresh())
    const rules = combatRules(base)
    expect(rules.priorityRows).toEqual(base.priorityRows)
    expect(rules.ruleStacks).toEqual(base.ruleStacks)
    const withStack = hero(change(fresh(), () => ({ ruleStacks: [MIXED_STACK], priorityRows: [{ skillId: 'driving-blow' }] })))
    expect(combatRules(withStack).ruleStacks).toEqual([MIXED_STACK])
    const blueprint = blueprintForHero(base, 'splintered-road').hero
    expect(blueprint.priorityRows).toEqual(base.priorityRows)
    expect(blueprint.ruleStacks).toBeUndefined()
    expect(blueprintForHero(withStack, 'splintered-road').hero.ruleStacks).toEqual([MIXED_STACK])
  })

  it('leaves waiting rows out and drops stacks whose trigger waits', () => {
    const next = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    const rules = combatRules(next)
    expect(rules.priorityRows.some((row) => row.skillId === 'cleave')).toBe(false)
    expect(rules.ruleStacks).toEqual([{ ...MIXED_STACK, rows: [{ skillId: 'driving-blow' }] }])
    const blueprint = blueprintForHero(next, 'splintered-road').hero
    expect(blueprint.priorityRows).toEqual(rules.priorityRows)
    expect(blueprint.ruleStacks).toEqual(rules.ruleStacks)
  })

  it('drops a stack whose rules all wait, keeps an empty one, and leaves rows that wait on a ready check out', () => {
    const allWait: RuleStack = { id: 'stack-3', name: 'Cleaving', when: [], rows: [{ skillId: 'cleave' }] }
    const empty: RuleStack = { id: 'stack-4', name: 'Empty', when: [], rows: [] }
    const ready: PriorityRow = { skillId: 'driving-blow', conditions: [{ kind: 'skillReady', skillId: 'cleave', operator: 'absent' }] }
    const next = hero(ok(reincarnate(endOfLife(() => ({ ruleStacks: [allWait, empty], priorityRows: [ready, { skillId: 'driving-blow' }] })), 'hero-1', null)))
    expect(rowWaits(ready, waitingSkillIds(next))).toBe(true)
    const rules = combatRules(next)
    expect(rules.ruleStacks).toEqual([empty])
    expect(rules.priorityRows[0]).toEqual({ skillId: 'driving-blow' })
  })

  it('maps the sim row index back to the editor row for each stack in the fight', () => {
    const next = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    expect(activeRowIndexes(next)).toEqual({ default: [1, 2], 'stack-2': [1] })
  })
})

describe('rules that wait', () => {
  it('validateRules accepts a waiting row but not an arbitrary unequipped skill', () => {
    const next = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    expect(validateRules(next, draftsFromRows([{ skillId: 'cleave' }])).ok).toBe(true)
    expect(validateRules(next, draftsFromRows([{ skillId: 'reckless-strike' }])).ok).toBe(false)
    const withoutList: SavedHero = { ...next }
    delete withoutList.waitingSkillIds
    expect(validateRules(withoutList, draftsFromRows([{ skillId: 'cleave' }])).ok).toBe(false)
    const ready = validateRules(next, draftsFromRows([{ skillId: 'driving-blow', conditions: [{ kind: 'skillReady', skillId: 'cleave', operator: 'present' }] }]))
    expect(ready.ok).toBe(true)
  })

  it('saves the kept rows and stacks as they are, including a trigger that names a waiting skill', () => {
    const save = ok(reincarnate(endOfLife(), 'hero-1', null))
    const next = hero(save)
    const rows = ok(saveRules(save, 'hero-1', draftsFromRows(next.priorityRows)))
    expect(hero(rows).priorityRows).toEqual(next.priorityRows)
    const stacks = ok(saveRuleStacks(rows, 'hero-1', draftsFromStacks(next.ruleStacks)))
    expect(hero(stacks).ruleStacks).toEqual(next.ruleStacks)
  })

  it('saveLoadout keeps waiting rows and does not count them as removed', () => {
    const save = ok(reincarnate(endOfLife(), 'hero-1', null))
    const result = saveLoadoutOk(save, ['driving-blow', 'sundering-blow'])
    const after = hero(result.save)
    expect(after.priorityRows.filter((row) => row.skillId === 'cleave')).toHaveLength(1)
    expect(after.ruleStacks[0]!.rows).toHaveLength(1)
    // only the Second Wind stand-in went
    expect(result.removedRules).toBe(1)
    expect(after.waitingSkillIds).toEqual(['cleave'])
  })

  it('pruneRows drops the waiting list once the skills are usable', () => {
    const next = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    const usable = pruneRows({
      ...next,
      progress: { ...next.progress, learnedSkillIds: [...next.progress.learnedSkillIds, 'cleave'], loadout: [...next.progress.loadout.slice(0, 3), 'cleave'] },
    })
    expect(usable.hero.waitingSkillIds).toBeUndefined()
  })
})

describe('skills return to the loadout', () => {
  it('puts the skill in place of a starting skill the old loadout did not have, prunes its stand-in rows and wakes the rules', () => {
    let save = ok(reincarnate(endOfLife(), 'hero-1', null))
    save = grantPoints(save, 'hero-1', 0, 5)
    save = take(save, ['warrior-driving-blow', 'warrior-rising-heat'])
    expect(hero(save).progress.loadout).toEqual(STARTING)
    const result = takeNode(save, 'hero-1', 'warrior-cleave')
    if (!result.ok) throw new Error(result.reason)
    expect(result.restored).toEqual({ returned: ['cleave'], replaced: [{ out: 'second-wind', in: 'cleave' }], woke: 3 })
    const next = hero(result.save)
    expect(next.progress.loadout).toEqual(OLD_LOADOUT)
    expect(next.priorityRows).toEqual([{ skillId: 'cleave' }, { skillId: 'driving-blow' }])
    expect(next.waitingSkillIds).toBeUndefined()
    expect(restoreNotice(result.restored!)).toBe('Cleave is back in the loadout (in place of Second Wind). 3 waiting rules work again.')
    expect(combatRules(next).ruleStacks).toHaveLength(2)
  })

  it('uses a free slot first when the hero has the fifth slot', () => {
    const lived = endOfLife((entry) => ({ purchases: { ...entry.purchases, fifthSlot: true } }))
    let save = ok(reincarnate(lived, 'hero-1', null))
    save = take(grantPoints(save, 'hero-1', 0, 5), ['warrior-driving-blow', 'warrior-rising-heat'])
    const result = takeNode(save, 'hero-1', 'warrior-cleave')
    if (!result.ok) throw new Error(result.reason)
    expect(result.restored?.replaced).toEqual([])
    expect(hero(result.save).progress.loadout).toEqual([...STARTING, 'cleave'])
  })

  it('replaces a skill added this life when no placeholder is left', () => {
    const base = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    const held: SavedHero = {
      ...base,
      pastLoadout: ['driving-blow', 'sundering-blow', 'shield-brace', 'cleave'],
      progress: {
        ...base.progress,
        learnedSkillIds: [...base.progress.learnedSkillIds, 'reckless-strike', 'cleave'],
        loadout: ['driving-blow', 'sundering-blow', 'shield-brace', 'reckless-strike'],
      },
    }
    const back = returnToLoadout(held, ['cleave'])
    expect(back.replaced).toEqual([{ out: 'reckless-strike', in: 'cleave' }])
    expect(back.hero.progress.loadout).toEqual(OLD_LOADOUT)
  })

  it('does nothing for a skill learned earlier, one not in the old loadout, or a hero with no past setup', () => {
    const base = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    expect(returnToLoadout(base, []).returned).toEqual([])
    expect(returnToLoadout(base, ['reckless-strike']).returned).toEqual([])
    const plain = hero(fresh())
    expect(returnToLoadout(plain, ['cleave']).hero).toBe(plain)
    const taken = takeNode(fresh(), 'hero-1', 'warrior-driving-blow')
    expect(taken.ok && taken.restored).toBeFalsy()
  })

  it('does not put back a skill the player unequipped by hand', () => {
    let save = ok(reincarnate(endOfLife(), 'hero-1', null))
    save = take(grantPoints(save, 'hero-1', 0, 5), CLEAVE_NODES)
    save = ok(saveLoadout(save, 'hero-1', STARTING))
    expect(returnToLoadout(hero(save), []).hero.progress.loadout).toEqual(STARTING)
  })

  it('a Convergence node wakes rules for its temporary skills without a loadout change', () => {
    const base = hero(fresh('mage'))
    const id = CONVERGENCE_SKILL_IDS[0]!
    const waiting: SavedHero = { ...base, waitingSkillIds: [id], priorityRows: [{ skillId: id }, ...base.priorityRows] }
    const stay = returnToLoadout(waiting, [])
    expect(stay.woke).toBe(0)
    expect(stay.hero.waitingSkillIds).toEqual([id])
    const taken = { ...waiting, progress: { ...waiting.progress, allocatedNodeIds: [...waiting.progress.allocatedNodeIds, NODE_ELEMENTAL_CONVERGENCE] } }
    const woke = returnToLoadout(taken, [])
    expect(woke.woke).toBe(1)
    expect(woke.hero.waitingSkillIds).toBeUndefined()
    expect(woke.hero.priorityRows[0]).toEqual({ skillId: id })
  })
})

describe('saves with the setup fields', () => {
  it('survive a round trip', () => {
    const save = ok(reincarnate(endOfLife(), 'hero-1', null))
    const parsed = parseSave(serializeSave(save))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(hero(parsed.data).waitingSkillIds).toEqual(['cleave'])
  })
})

describe('several past loadouts (Step 13.42)', () => {
  function again(save: SaveData): SaveData {
    return ok(reincarnate(change(save, () => ({ bossLossThisLife: true })), 'hero-1', null))
  }

  it('keeps both setups after two quick reincarnations, newest first', () => {
    const second = again(ok(reincarnate(endOfLife(), 'hero-1', null)))
    expect(hero(second).pastLoadouts).toEqual([STARTING, OLD_LOADOUT])
    expect(hero(second).pastLoadout).toBeUndefined()
  })

  it('returns a skill that only the older setup had, and says so', () => {
    const second = again(ok(reincarnate(endOfLife(), 'hero-1', null)))
    let save = grantPoints(second, 'hero-1', 0, 5)
    save = take(save, CLEAVE_NODES.slice(0, 2))
    const result = takeNode(save, 'hero-1', 'warrior-cleave')
    if (!result.ok) throw new Error(result.reason)
    expect(result.restored?.returned).toEqual(['cleave'])
    expect(hero(result.save).progress.loadout).toContain('cleave')
    expect(restoreNotice(result.restored!)).toContain('Cleave is back in the loadout')
  })

  it('uses the newest kept setup that held the skill', () => {
    const base = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    const held: SavedHero = {
      ...base,
      pastLoadouts: [['driving-blow', 'cleave'], ['driving-blow', 'sundering-blow', 'shield-brace', 'cleave']],
      progress: { ...base.progress, learnedSkillIds: [...base.progress.learnedSkillIds, 'cleave'] },
    }
    const back = returnToLoadout(held, ['cleave'])
    expect(back.returned).toEqual(['cleave'])
    // The newest setup did not hold Sundering Blow, so that starting skill makes room.
    expect(back.replaced).toEqual([{ out: 'sundering-blow', in: 'cleave' }])
  })

  it('reads an old single pastLoadout as the first slot and writes the new field at the next reincarnation', () => {
    const base = hero(ok(reincarnate(endOfLife(), 'hero-1', null)))
    const { pastLoadouts: _drop, ...rest } = base
    const old: SavedHero = { ...rest, pastLoadout: OLD_LOADOUT, bossLossThisLife: true }
    expect(pastSetups(old)).toEqual([OLD_LOADOUT])
    const saved = change(ok(reincarnate(endOfLife(), 'hero-1', null)), () => old)
    const parsed = parseSave(serializeSave(saved))
    expect(parsed.ok).toBe(true)
    const next = hero(again(saved))
    expect(next.pastLoadouts).toEqual([STARTING, OLD_LOADOUT])
    expect(next.pastLoadout).toBeUndefined()
  })

  it('keeps at most three and drops the oldest', () => {
    let save = ok(reincarnate(endOfLife(), 'hero-1', null))
    for (let life = 0; life < 3; life += 1) save = again(save)
    expect(hero(save).pastLoadouts).toEqual([STARTING, STARTING, STARTING])
  })

  it('keeps waiting rules working from any kept setup', () => {
    const second = again(ok(reincarnate(endOfLife(), 'hero-1', null)))
    expect(waitingSkillIds(hero(second))).toEqual(['cleave'])
    expect(combatRules(hero(second)).priorityRows.every((row) => row.skillId !== 'cleave')).toBe(true)
  })
})
