import {
  TARGET_LABELS,
  skillName,
  summarizeRule,
  summarizeTrigger,
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

export function buildRouter(hero: SavedHero, stacks: readonly StackDraft[]): RouterEntry[] {
  return stacks.map((stack) => ({
    id: stack.id,
    name: stack.name,
    trigger: hasTrigger(stack) ? summarizeTrigger(stack, hero.classId) : 'Picked by hand only',
    auto: hasTrigger(stack),
  }))
}

export function buildRules(hero: SavedHero, rows: readonly RowDraft[]): ChainRule[] {
  const unconditional = (row: RowDraft): boolean => row.conditions.length === 0 && (row.kept ?? []).length === 0
  return rows.map((row, index) => {
    const blank = row.skillId.length === 0
    let shadowedBy: number | null = null
    if (!blank) {
      for (let earlier = 0; earlier < index; earlier += 1) {
        const other = rows[earlier]!
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
    }
  })
}

export function buildChain(hero: SavedHero, rows: readonly RowDraft[], stacks: readonly StackDraft[]): ChainModel {
  return { router: buildRouter(hero, stacks), rules: buildRules(hero, rows), fallback: fallbackText(hero.classId) }
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
