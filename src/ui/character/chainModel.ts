import {
  TARGET_LABELS,
  skillName,
  summarizeRule,
  summarizeTrigger,
  type ConditionDraft,
  type RowDraft,
  type StackDraft,
} from '../../persist/loadout.ts'
import type { SavedHero } from '../../persist/save.ts'
import { DEFAULT_STACK_ID, type LogEvent } from '../../sim/types.ts'

import { hasTrigger } from './stackEdit.ts'

/** Pure view model for the rule chain editor. Nothing here is saved or changes a rule. */

export type RouterEntry = {
  id: string
  name: string
  /** The trigger sentence, or "Picked by hand only". */
  trigger: string
  auto: boolean
  /** The waiting skill that leaves this stack out of every fight, or null when it is in use (Step 13.37). */
  waitingFor: string | null
}

export type ChainRule = {
  index: number
  skillId: string
  /** The skill name, or "No skill yet" for a blank slot. */
  title: string
  blank: boolean
  /** The rule sentence from `summarizeRule`. */
  sentence: string
  /** The target override, or null when the row keeps the global priority. */
  target: string | null
  /** No conditions at all: the row fires whenever its skill is ready. */
  alwaysReady: boolean
  /** The 1-based number of an earlier unconditional row that always wins over this one, or null. */
  shadowedBy: number | null
  /** The name of the skill this rule waits for, or null when it works (Step 13.37). */
  waitingFor: string | null
}

export type ChainModel = {
  router: RouterEntry[]
  rules: ChainRule[]
  /** What the hero does when no row passes. */
  fallback: string
}

/** Fire counts by stack id, then by row index. */
export type FireCounts = { [stackId: string]: number[] }

export function fallbackText(classId: SavedHero['classId']): string {
  if (classId === 'mage') return 'Arcane Bolt when it is ready and affordable, otherwise wait for Mana'
  return 'Weapon basic attack'
}

/** The first waiting skill a "skill is ready" condition names, or null. */
function conditionWaitsFor(conditions: readonly ConditionDraft[], waiting: readonly string[]): string | null {
  for (const condition of conditions) {
    if (condition.type === 'skillReady' && condition.skillId !== undefined && waiting.includes(condition.skillId)) return condition.skillId
  }
  return null
}

/** The waiting skill a rule draft needs: its own skill, else one a "skill is ready" condition names. Null when it works. */
export function draftWaitingFor(row: RowDraft, waiting: readonly string[]): string | null {
  if (waiting.length === 0) return null
  if (waiting.includes(row.skillId)) return row.skillId
  return conditionWaitsFor(row.conditions, waiting)
}

/** A stack is left out of fights when its trigger names a waiting skill, or it has rules and all of them wait. */
function stackWaitsFor(stack: StackDraft, waiting: readonly string[]): string | null {
  if (waiting.length === 0) return null
  const trigger = conditionWaitsFor(stack.when, waiting)
  if (trigger !== null) return trigger
  if (stack.rows.length === 0) return null
  const reasons = stack.rows.map((row) => draftWaitingFor(row, waiting))
  return reasons.every((reason) => reason !== null) ? reasons[0]! : null
}

export function buildRouter(hero: SavedHero, stacks: readonly StackDraft[], waiting: readonly string[] = []): RouterEntry[] {
  return stacks.map((stack) => {
    const reason = stackWaitsFor(stack, waiting)
    return {
      id: stack.id,
      name: stack.name,
      trigger: hasTrigger(stack) ? summarizeTrigger(stack, hero.classId) : 'Picked by hand only',
      auto: hasTrigger(stack),
      waitingFor: reason === null ? null : skillName(reason),
    }
  })
}

/** The skills a rule's skill menu offers: the usable ones, then the waiting ones, marked as not relearned. */
export function skillOptions(skillIds: readonly string[], waiting: readonly string[] = []): { id: string; label: string }[] {
  return [
    ...skillIds.map((id) => ({ id, label: skillName(id) })),
    ...waiting.filter((id) => !skillIds.includes(id)).map((id) => ({ id, label: `${skillName(id)} (not relearned)` })),
  ]
}

export function buildRules(hero: SavedHero, rows: readonly RowDraft[], waiting: readonly string[] = []): ChainRule[] {
  const unconditional = (row: RowDraft): boolean => row.conditions.length === 0 && (row.kept ?? []).length === 0
  return rows.map((row, index) => {
    const blank = row.skillId.length === 0
    let shadowedBy: number | null = null
    const waitingFor = draftWaitingFor(row, waiting)
    if (!blank && waitingFor === null) {
      for (let earlier = 0; earlier < index; earlier += 1) {
        const other = rows[earlier]!
        // A waiting rule is left out of the fight, so it never shadows a later one.
        if (draftWaitingFor(other, waiting) !== null) continue
        if (other.skillId === row.skillId && unconditional(other) && other.targetPriority === row.targetPriority) {
          shadowedBy = earlier + 1
          break
        }
      }
    }
    return {
      index,
      skillId: row.skillId,
      title: blank ? 'No skill yet' : skillName(row.skillId),
      blank,
      sentence: summarizeRule(row, hero.classId),
      target: row.targetPriority === '' ? null : TARGET_LABELS[row.targetPriority],
      alwaysReady: !blank && unconditional(row),
      shadowedBy,
      waitingFor: waitingFor === null ? null : skillName(waitingFor),
    }
  })
}

export function buildChain(hero: SavedHero, rows: readonly RowDraft[], stacks: readonly StackDraft[], waiting: readonly string[] = []): ChainModel {
  return { router: buildRouter(hero, stacks, waiting), rules: buildRules(hero, rows, waiting), fallback: fallbackText(hero.classId) }
}

/**
 * How often each row was used in a fight log: `priority` events with decision `use`, counted by row index and
 * attributed to the stack that was active, found by walking `stackChanged`. A fight starts on Default.
 * `actorId` limits the count to one hero.
 */
export function ruleFireCounts(log: readonly LogEvent[], actorId?: string): FireCounts {
  const counts: FireCounts = {}
  let active: string = DEFAULT_STACK_ID
  for (const event of log) {
    if (actorId !== undefined && 'actorId' in event && event.actorId !== actorId) continue
    if (event.type === 'stackChanged') {
      active = event.toId
    } else if (event.type === 'priority' && event.decision === 'use' && event.rowIndex !== null) {
      const list = (counts[active] ??= [])
      list[event.rowIndex] = (list[event.rowIndex] ?? 0) + 1
    }
  }
  return counts
}

/**
 * Fire counts are keyed by the row index the sim saw. Waiting rules are left out of a fight, so the sim's index is not the
 * editor's. `map` lists, per stack, the editor index of each sim row (see `activeRowIndexes`); a stack without an entry is kept as it is.
 */
export function remapFireCounts(counts: FireCounts | null, map: { readonly [stackId: string]: readonly number[] }): FireCounts | null {
  if (counts === null) return null
  const out: FireCounts = {}
  for (const [stackId, list] of Object.entries(counts)) {
    const indexes = map[stackId]
    if (indexes === undefined) {
      out[stackId] = list
      continue
    }
    const mapped: number[] = []
    list.forEach((value, simIndex) => {
      const at = indexes[simIndex]
      if (at !== undefined && value !== undefined) mapped[at] = value
    })
    out[stackId] = mapped
  }
  return out
}

/** The count for one row, or null when there is no data for it. */
export function fireCount(counts: FireCounts | null, stackId: string, index: number): number | null {
  if (counts === null) return null
  return counts[stackId]?.[index] ?? 0
}

/** All uses of a stack in the log, for the router. */
export function stackFireTotal(counts: FireCounts | null, stackId: string): number | null {
  if (counts === null) return null
  return (counts[stackId] ?? []).reduce<number>((sum, value) => sum + (value ?? 0), 0)
}
