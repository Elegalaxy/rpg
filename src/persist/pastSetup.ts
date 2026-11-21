import { referenceLoadoutFor } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'
import { setLoadout, type HeroProgress } from '../sim/progression.ts'
import { DEFAULT_STACK_ID, type PriorityRow, type RuleStack } from '../sim/types.ts'

import { conditionSkillIds, pruneRows, rowWaits, ruleSkillIds, skillName, waitingSkillIds } from './loadout.ts'
import type { SavedHero } from './save.ts'
import { MAX_PAST_SETUPS, loadoutSlots } from './skillSlots.ts'

/** Combat setup across lives (Step 13.37). Pure: nothing here reads or writes a save by itself. */

export type SetupStats = {
  /** Rules in the Default list and in every stack. */
  rules: number
  stacks: number
  /** Rules that wait for a skill that is not relearned yet. */
  waitingRules: number
}

/**
 * The loadouts of the last lives, newest first. A save from before Step 13.42 has only the single `pastLoadout`; it reads as the
 * first entry, and the next reincarnation writes `pastLoadouts` and drops the old field.
 */
export function pastSetups(hero: SavedHero): string[][] {
  if (hero.pastLoadouts !== undefined) return hero.pastLoadouts
  return hero.pastLoadout !== undefined && hero.pastLoadout.length > 0 ? [hero.pastLoadout] : []
}

export type CarriedSetup = {
  priorityRows: PriorityRow[]
  ruleStacks: RuleStack[]
  waitingSkillIds: string[]
  pastLoadouts: string[][]
  stats: SetupStats
}

function addAll(into: string[], ids: readonly string[]): void {
  for (const id of ids) if (id.length > 0 && !into.includes(id)) into.push(id)
}

function namedSkills(rows: readonly PriorityRow[], stacks: readonly RuleStack[]): string[] {
  const ids: string[] = []
  const fromRows = (list: readonly PriorityRow[]): void => {
    for (const row of list) addAll(ids, [row.skillId, ...conditionSkillIds(row.conditions)])
  }
  fromRows(rows)
  for (const stack of stacks) {
    addAll(ids, conditionSkillIds(stack.when))
    fromRows(stack.rows)
  }
  return ids
}

function countWaiting(rows: readonly PriorityRow[], stacks: readonly RuleStack[], waiting: readonly string[]): number {
  let count = rows.filter((row) => rowWaits(row, waiting)).length
  for (const stack of stacks) count += stack.rows.filter((row) => rowWaits(row, waiting)).length
  return count
}

/**
 * What a hero keeps into a new life whose progress is `progress`: the rules and stacks as they are, the list of skills those
 * rules name that the new life cannot use yet, and the old loadout. Starting skills the old loadout did not have get their
 * class reference rows appended to the Default rules while there is room.
 */
export function carriedSetup(hero: SavedHero, progress: HeroProgress): CarriedSetup {
  const next: SavedHero = { ...hero, progress }
  const available = ruleSkillIds(next)
  const pastLoadout = [...hero.progress.loadout]
  const pastLoadouts = [pastLoadout, ...pastSetups(hero).map((setup) => [...setup])].slice(0, MAX_PAST_SETUPS)
  const priorityRows: PriorityRow[] = structuredClone(hero.priorityRows)
  const ruleStacks: RuleStack[] = structuredClone(hero.ruleStacks)
  for (const id of progress.loadout) {
    if (pastLoadout.includes(id)) continue
    for (const row of referenceLoadoutFor(hero.classId).priorityRows) {
      if (priorityRows.length >= MAX_PRIORITY_ROWS) break
      if (row.skillId !== id) continue
      if (!conditionSkillIds(row.conditions).every((ready) => available.includes(ready))) continue
      if (priorityRows.some((existing) => JSON.stringify(existing) === JSON.stringify(row))) continue
      priorityRows.push(structuredClone(row))
    }
  }
  const waiting = namedSkills(priorityRows, ruleStacks).filter((id) => !available.includes(id))
  return {
    priorityRows,
    ruleStacks,
    waitingSkillIds: waiting,
    pastLoadouts,
    stats: {
      rules: priorityRows.length + ruleStacks.reduce((sum, stack) => sum + stack.rows.length, 0),
      stacks: ruleStacks.length,
      waitingRules: countWaiting(priorityRows, ruleStacks, waiting),
    },
  }
}

function stackWaits(stack: RuleStack, waiting: readonly string[]): boolean {
  if (conditionSkillIds(stack.when).some((id) => waiting.includes(id))) return true
  return stack.rows.length > 0 && stack.rows.every((row) => rowWaits(row, waiting))
}

/**
 * The rules a fight uses: the saved rules without the waiting ones. A stack whose trigger names a waiting skill, or whose
 * rules all wait, is left out (an empty stack stays). With nothing waiting this is the saved content, unchanged.
 */
export function combatRules(hero: SavedHero): { priorityRows: PriorityRow[]; ruleStacks: RuleStack[] } {
  const waiting = waitingSkillIds(hero)
  if (waiting.length === 0) return { priorityRows: hero.priorityRows, ruleStacks: hero.ruleStacks }
  const ruleStacks = hero.ruleStacks
    .filter((stack) => !stackWaits(stack, waiting))
    .map((stack) => ({ ...stack, rows: stack.rows.filter((row) => !rowWaits(row, waiting)) }))
  return { priorityRows: hero.priorityRows.filter((row) => !rowWaits(row, waiting)), ruleStacks }
}

/**
 * For the Default list and each stack that is still in a fight: the editor index of each row the sim sees, in order. A stack
 * left out has no entry. Used to put fire counts (keyed by the sim's index) back on the editor's rows.
 */
export function activeRowIndexes(hero: SavedHero): { [stackId: string]: number[] } {
  const waiting = waitingSkillIds(hero)
  const keep = (rows: readonly PriorityRow[]): number[] => {
    const indexes: number[] = []
    rows.forEach((row, index) => {
      if (!rowWaits(row, waiting)) indexes.push(index)
    })
    return indexes
  }
  const map: { [stackId: string]: number[] } = { [DEFAULT_STACK_ID]: keep(hero.priorityRows) }
  for (const stack of hero.ruleStacks) if (!stackWaits(stack, waiting)) map[stack.id] = keep(stack.rows)
  return map
}

export type ReturnedLoadout = {
  hero: SavedHero
  /** Skills that went back into the loadout, in order. */
  returned: string[]
  /** A skill that made room, and the skill that took its place. */
  replaced: { out: string; in: string }[]
  /** Rules that were waiting and work again. */
  woke: number
}

function waitingRuleCount(hero: SavedHero): number {
  return countWaiting(hero.priorityRows, hero.ruleStacks, waitingSkillIds(hero))
}

/**
 * After a skill web node was taken: skills the node taught that were in the old loadout go back in, into a free slot, else in
 * place of a starting skill the old loadout did not have, else in place of another skill it did not have. Then every
 * waiting skill that is usable now leaves the list. A hero with nothing to return and nothing waiting comes back unchanged.
 */
export function returnToLoadout(hero: SavedHero, newlyLearned: readonly string[]): ReturnedLoadout {
  const setups = pastSetups(hero)
  // Each skill comes back from the newest kept setup that held it.
  const sourceOf = (id: string): string[] | undefined => setups.find((setup) => setup.includes(id))
  // The saved list, not the filtered one: a Convergence or Release node may already have made a skill usable.
  const before = countWaiting(hero.priorityRows, hero.ruleStacks, hero.waitingSkillIds ?? [])
  const wanted = newlyLearned.filter((id) => sourceOf(id) !== undefined && !hero.progress.loadout.includes(id))
  if (wanted.length === 0 && (hero.waitingSkillIds ?? []).length === 0) return { hero, returned: [], replaced: [], woke: 0 }
  const slots = loadoutSlots(hero)
  const starting = classWebs[hero.classId].startingSkillIds
  const loadout = [...hero.progress.loadout]
  const returned: string[] = []
  const replaced: { out: string; in: string }[] = []
  for (const id of wanted) {
    const past = sourceOf(id) ?? []
    if (loadout.length < slots) {
      loadout.push(id)
    } else {
      let at = loadout.findIndex((held) => starting.includes(held) && !past.includes(held))
      if (at < 0) {
        for (let index = loadout.length - 1; index >= 0; index -= 1) {
          if (!past.includes(loadout[index]!)) {
            at = index
            break
          }
        }
      }
      if (at < 0) continue
      replaced.push({ out: loadout[at]!, in: id })
      loadout[at] = id
    }
    returned.push(id)
  }
  const progress = returned.length > 0 ? setLoadout(hero.progress, loadout, slots) : hero.progress
  const pruned = pruneRows({ ...hero, progress })
  return { hero: pruned.hero, returned, replaced, woke: Math.max(0, before - waitingRuleCount(pruned.hero)) }
}

function joinNames(ids: readonly string[]): string {
  const names = ids.map(skillName)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The sentence the skill web shows after a node brought something back, or null when it did not. */
export function restoreNotice(restored: { returned: readonly string[]; replaced: readonly { out: string; in: string }[]; woke: number }): string | null {
  const parts: string[] = []
  if (restored.returned.length > 0) {
    const place = restored.replaced.length > 0 ? ` (in place of ${joinNames(restored.replaced.map((entry) => entry.out))})` : ''
    parts.push(`${joinNames(restored.returned)} ${restored.returned.length === 1 ? 'is' : 'are'} back in the loadout${place}.`)
  }
  if (restored.woke > 0) parts.push(`${restored.woke} waiting ${restored.woke === 1 ? 'rule works' : 'rules work'} again.`)
  return parts.length === 0 ? null : parts.join(' ')
}
