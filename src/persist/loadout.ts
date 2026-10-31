import { skills } from '../content/skills.ts'
import { statuses } from '../content/statuses.ts'
import { enemies } from '../content/enemies.ts'
import { MAX_PRIORITY_ROWS, parsePriorityRules, STATUS_IDS } from '../sim/automation.ts'
import { CONVERGENCE_SKILL_IDS, NODE_ELEMENTAL_CONVERGENCE } from '../sim/classes/mageAdjust.ts'
import { NODE_LIVING_SANCTUARY, NODE_SACRED_BALANCE, RELEASE_IDS } from '../sim/classes/clericAdjust.ts'
import type { HeroClass } from '../sim/constants.ts'
import { setLoadout } from '../sim/progression.ts'
import {
  TARGET_PRIORITIES,
  type AutomationCondition,
  type GameDefs,
  type PriorityRow,
  type TargetPriority,
} from '../sim/types.ts'

import type { RosterResult } from './roster.ts'
import type { SaveData, SavedHero } from './save.ts'

export { MAX_PRIORITY_ROWS }

export type ConditionType =
  | 'heroHp'
  | 'targetHp'
  | 'resource'
  | 'grace'
  | 'wrath'
  | 'enemyCount'
  | 'barrier'
  | 'targetStatus'
  | 'targetStacks'
  | 'heroStatus'
  | 'telegraph'
  | 'telegraphWithin'
  | 'mark'
  | 'specialAmmo'

export type ConditionKind = {
  type: ConditionType
  label: string
  /** Operators the dropdown offers for this condition. Presence kinds take no number. */
  operators: readonly string[]
  /** Whether the condition reads a number. */
  numeric: boolean
  /** Classes that can use it. Omitted means every class. */
  classes?: readonly HeroClass[]
}

const COMPARE = ['atMost', 'atLeast', 'equal', 'notEqual'] as const
const PRESENCE = ['present', 'absent'] as const

export const COMPARE_LABELS: { [operator: string]: string } = {
  atMost: 'is at most',
  atLeast: 'is at least',
  equal: 'is exactly',
  notEqual: 'is not',
  present: 'is present',
  absent: 'is absent',
}

export const CONDITION_KINDS: readonly ConditionKind[] = [
  { type: 'heroHp', label: 'Hero HP %', operators: COMPARE, numeric: true },
  { type: 'targetHp', label: 'Target HP %', operators: COMPARE, numeric: true },
  { type: 'resource', label: 'Class resource', operators: COMPARE, numeric: true },
  { type: 'grace', label: 'Grace (Sacred Balance)', operators: COMPARE, numeric: true, classes: ['cleric'] },
  { type: 'wrath', label: 'Wrath (Sacred Balance)', operators: COMPARE, numeric: true, classes: ['cleric'] },
  { type: 'enemyCount', label: 'Enemies alive', operators: COMPARE, numeric: true },
  { type: 'barrier', label: 'Hero barrier', operators: PRESENCE, numeric: false },
  { type: 'targetStatus', label: 'Target status', operators: PRESENCE, numeric: false },
  { type: 'targetStacks', label: 'Target status stacks', operators: COMPARE, numeric: true },
  { type: 'heroStatus', label: 'Hero status', operators: PRESENCE, numeric: false },
  { type: 'telegraph', label: 'Enemy telegraph', operators: PRESENCE, numeric: false },
  { type: 'telegraphWithin', label: 'Telegraph resolves within (seconds)', operators: ['atMost'], numeric: true },
  { type: 'mark', label: 'Target is marked', operators: PRESENCE, numeric: false, classes: ['assassin'] },
  { type: 'specialAmmo', label: 'Special arrows', operators: COMPARE, numeric: true, classes: ['ranger'] },
]

export const RESOURCE_NAMES: { [classId in HeroClass]: string } = {
  warrior: 'Fury',
  assassin: 'Advantage',
  ranger: 'Readiness',
  mage: 'Mana',
  cleric: 'Faith',
}

export const TARGET_LABELS: { [priority in TargetPriority]: string } = {
  current: 'Current target',
  lowestHpPercent: 'Lowest HP %',
  highestHpPercent: 'Highest HP %',
  lowestArmor: 'Lowest Armor',
  lowestResistance: 'Lowest Resistance',
  marked: 'Marked target',
  actingSoonest: 'Acting soonest',
  random: 'Random',
}

/** What the player fills in for one condition. Text fields keep what was typed. */
export type ConditionDraft = {
  type: ConditionType
  operator: string
  value: string
  statusId: string
}

export type RowDraft = {
  skillId: string
  /** Saved conditions the editor has no control for. They are kept as they are. */
  kept?: AutomationCondition[]
  conditions: ConditionDraft[]
  /** Empty keeps the global target priority. */
  targetPriority: '' | TargetPriority
}

export const STATUS_CHOICES: readonly string[] = STATUS_IDS.filter((id) => statuses[id] !== undefined)

export function newCondition(type: ConditionType): ConditionDraft {
  const kind = CONDITION_KINDS.find((entry) => entry.type === type)
  if (kind === undefined) throw new Error(`unknown condition type ${type}`)
  return { type, operator: kind.operators[0] ?? 'atMost', value: '', statusId: STATUS_CHOICES[0] ?? 'burn' }
}

/** Kinds this hero's class can use. */
export function kindsFor(classId: HeroClass): readonly ConditionKind[] {
  return CONDITION_KINDS.filter((kind) => {
    if (kind.classes !== undefined && !kind.classes.includes(classId)) return false
    if ((kind.type === 'grace' || kind.type === 'wrath') && classId !== 'cleric') return false
    return true
  })
}

function readNumber(text: string, label: string): number | string {
  const trimmed = text.trim()
  if (trimmed.length === 0) return `${label} needs a number.`
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return `${label} must be a number.`
  return value
}

/** One draft to one condition, or the message to show. The sim parser still checks the result. */
export function buildCondition(draft: ConditionDraft): AutomationCondition | string {
  const kind = CONDITION_KINDS.find((entry) => entry.type === draft.type)
  if (kind === undefined) return 'Pick a condition.'
  if (!kind.operators.includes(draft.operator)) return `${kind.label}: pick how to compare.`
  const operator = draft.operator
  if (kind.numeric) {
    const amount = readNumber(draft.value, kind.label)
    if (typeof amount === 'string') return amount
    if ((draft.type === 'heroHp' || draft.type === 'targetHp') && (amount < 0 || amount > 100)) {
      return `${kind.label} must be from 0 to 100.`
    }
    if (amount < 0) return `${kind.label} cannot be negative.`
    const compare = operator as 'atMost' | 'atLeast' | 'equal' | 'notEqual'
    switch (draft.type) {
      case 'heroHp':
        return { kind: 'hpPercent', who: 'hero', operator: compare, value: amount }
      case 'targetHp':
        return { kind: 'hpPercent', who: 'target', operator: compare, value: amount }
      case 'resource':
        return { kind: 'classResource', operator: compare, value: amount }
      case 'grace':
        return { kind: 'balance', meter: 'grace', operator: compare, value: amount }
      case 'wrath':
        return { kind: 'balance', meter: 'wrath', operator: compare, value: amount }
      case 'enemyCount':
        return { kind: 'enemyCount', operator: compare, value: amount }
      case 'telegraphWithin':
        return { kind: 'telegraph', operator: 'atMost', value: Math.round(amount * 1000) }
      case 'targetStacks':
        return { kind: 'status', who: 'target', statusId: draft.statusId, measure: 'stacks', operator: compare, value: amount }
      default:
        return { kind: 'specialAmmo', operator: compare, value: amount }
    }
  }
  const presence = operator as 'present' | 'absent'
  switch (draft.type) {
    case 'barrier':
      return { kind: 'barrier', operator: presence }
    case 'telegraph':
      return { kind: 'telegraph', operator: presence }
    case 'mark':
      return { kind: 'mark', operator: presence }
    default:
      return {
        kind: 'status',
        who: draft.type === 'heroStatus' ? 'hero' : 'target',
        statusId: draft.statusId,
        measure: 'presence',
        operator: presence,
      }
  }
}

/** Text for a saved condition, for showing rules back to the player. */
export function describeCondition(condition: AutomationCondition, classId: HeroClass): string {
  const op = (operator: string) => COMPARE_LABELS[operator] ?? operator
  switch (condition.kind) {
    case 'hpPercent':
      return `${condition.who === 'hero' ? 'Hero' : 'Target'} HP % ${op(condition.operator)} ${condition.value}`
    case 'classResource':
      return `${RESOURCE_NAMES[classId]} ${op(condition.operator)} ${condition.value}`
    case 'balance':
      return `${condition.meter === 'grace' ? 'Grace' : 'Wrath'} ${op(condition.operator)} ${condition.value}`
    case 'enemyCount':
      return `Enemies alive ${op(condition.operator)} ${condition.value}`
    case 'specialAmmo':
      return `Special arrows ${op(condition.operator)} ${condition.value}`
    case 'barrier':
      return `Hero barrier ${op(condition.operator)}`
    case 'mark':
      return `Target mark ${op(condition.operator)}`
    case 'telegraph':
      return condition.value === undefined
        ? `Enemy telegraph ${op(condition.operator)}`
        : `Enemy telegraph resolves within ${condition.value / 1000} s`
    case 'status':
      return `${condition.who === 'hero' ? 'Hero' : 'Target'} ${condition.statusId} ${op(condition.operator)}`
    default:
      return condition.kind
  }
}

function editable(condition: AutomationCondition): boolean {
  if (condition.kind === 'status') return condition.measure !== 'remaining'
  if (condition.kind === 'telegraph') return condition.value === undefined || condition.operator === 'atMost'
  return condition.kind !== 'enemyType' && condition.kind !== 'rank' && condition.kind !== 'bossPhase'
}

/** Turn saved rows back into drafts, so the editor can show and change them. Unknown shapes are dropped. */
export function draftsFromRows(rows: readonly PriorityRow[]): RowDraft[] {
  return rows.map((row) => ({
    skillId: row.skillId,
    kept: (row.conditions ?? []).filter((condition) => !editable(condition)),
    targetPriority: row.targetPriority ?? '',
    conditions: (row.conditions ?? []).flatMap((condition): ConditionDraft[] => {
      const base = (type: ConditionType, operator: string, value = ''): ConditionDraft => ({
        ...newCondition(type),
        operator,
        value,
      })
      switch (condition.kind) {
        case 'hpPercent':
          return [base(condition.who === 'hero' ? 'heroHp' : 'targetHp', condition.operator, String(condition.value))]
        case 'classResource':
          return [base('resource', condition.operator, String(condition.value))]
        case 'balance':
          return [base(condition.meter, condition.operator, String(condition.value))]
        case 'enemyCount':
          return [base('enemyCount', condition.operator, String(condition.value))]
        case 'specialAmmo':
          return [base('specialAmmo', condition.operator, String(condition.value))]
        case 'barrier':
          return [base('barrier', condition.operator)]
        case 'telegraph':
          return condition.value === undefined
            ? [base('telegraph', condition.operator)]
            : condition.operator === 'atMost'
              ? [base('telegraphWithin', 'atMost', String(condition.value / 1000))]
              : []
        case 'mark':
          return [base('mark', condition.operator)]
        case 'status':
          if (condition.measure === 'presence') {
            return [{ ...base(condition.who === 'hero' ? 'heroStatus' : 'targetStatus', condition.operator), statusId: condition.statusId }]
          }
          return condition.measure === 'stacks' && condition.who === 'target'
            ? [{ ...base('targetStacks', condition.operator, String(condition.value)), statusId: condition.statusId }]
            : []
        default:
          return []
      }
    }),
  }))
}

/** Skills a rule row may name for this hero: the equipped four, plus the temporary slot skills. */
export function ruleSkillIds(hero: SavedHero): string[] {
  const ids = [...hero.progress.loadout]
  const nodes = hero.progress.allocatedNodeIds
  if (hero.classId === 'mage' && nodes.includes(NODE_ELEMENTAL_CONVERGENCE)) ids.push(...CONVERGENCE_SKILL_IDS)
  if (hero.classId === 'cleric' && nodes.includes(NODE_LIVING_SANCTUARY)) ids.push(...RELEASE_IDS)
  return ids
}

export function hasSacredBalance(hero: SavedHero): boolean {
  return hero.classId === 'cleric' && hero.progress.allocatedNodeIds.includes(NODE_SACRED_BALANCE)
}

export type RulesResult = { ok: true; rows: PriorityRow[] } | { ok: false; errors: string[] }

function rulesDefs(): GameDefs {
  return { enemies, skills, statuses }
}

/**
 * Check a whole rule set. Every message names its row. The sim's own parser has the last word, so
 * a set that passes here is one `setPriorityRules` accepts.
 */
export function validateRules(hero: SavedHero, drafts: readonly RowDraft[]): RulesResult {
  const errors: string[] = []
  const available = ruleSkillIds(hero)
  if (drafts.length > MAX_PRIORITY_ROWS) {
    errors.push(`A hero can have at most ${MAX_PRIORITY_ROWS} rules, and there are ${drafts.length}.`)
  }
  const rows: PriorityRow[] = []
  drafts.forEach((draft, index) => {
    const label = `Rule ${index + 1}`
    if (draft.skillId.length === 0) {
      errors.push(`${label}: pick a skill.`)
      return
    }
    if (!available.includes(draft.skillId)) {
      errors.push(`${label}: ${skills[draft.skillId]?.name ?? draft.skillId} is not in the equipped skills.`)
      return
    }
    const conditions: AutomationCondition[] = []
    draft.conditions.forEach((conditionDraft, conditionIndex) => {
      const built = buildCondition(conditionDraft)
      if (typeof built === 'string') errors.push(`${label}, condition ${conditionIndex + 1}: ${built}`)
      else conditions.push(built)
    })
    if (draft.targetPriority !== '' && !(TARGET_PRIORITIES as readonly string[]).includes(draft.targetPriority)) {
      errors.push(`${label}: unknown target priority.`)
    }
    for (const extra of draft.kept ?? []) conditions.push(extra)
    const row: PriorityRow = { skillId: draft.skillId }
    if (conditions.length > 0) row.conditions = conditions
    if (draft.targetPriority !== '') row.targetPriority = draft.targetPriority
    rows.push(row)
  })
  if (errors.length > 0) return { ok: false, errors }
  const parsed = parsePriorityRules({ rows }, rulesDefs())
  if (!parsed.ok) return { ok: false, errors: [parsed.reason] }
  return { ok: true, rows: parsed.rows }
}

/** Save a rule set for a hero. Invalid sets are refused and nothing changes. */
export function saveRules(save: SaveData, heroId: string, drafts: readonly RowDraft[]): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const checked = validateRules(hero, drafts)
  if (!checked.ok) return { ok: false, reason: checked.errors.join(' ') }
  return {
    ok: true,
    save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, priorityRows: checked.rows } : entry)) },
  }
}

/**
 * Choose 1 to 4 learned skills. Rules that name a skill that is no longer equipped are removed, and
 * the result says how many, so the player is never left with a rule the fight would skip.
 */
export function saveLoadout(
  save: SaveData,
  heroId: string,
  skillIds: readonly string[],
): { ok: true; save: SaveData; removedRules: number } | { ok: false; reason: string } {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  let progress
  try {
    progress = setLoadout(hero.progress, skillIds)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  const updated: SavedHero = { ...hero, progress }
  const allowed = ruleSkillIds(updated)
  const kept = hero.priorityRows.filter((row) => allowed.includes(row.skillId))
  const removedRules = hero.priorityRows.length - kept.length
  return {
    ok: true,
    removedRules,
    save: {
      ...save,
      heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...updated, priorityRows: kept } : entry)),
    },
  }
}

export function skillName(skillId: string): string {
  return skills[skillId]?.name ?? skillId
}
