import { enemies } from '../content/enemies.ts'
import { ruleTemplates, type RuleTemplate, type TemplateCondition, type TemplateUnlock } from '../content/ruleTemplates.ts'
import { enemyDefeatedByAnyHero } from './crafting.ts'
import { MAX_STACK_NAME_LENGTH, newCondition, nextStackId, ruleSkillIds, type ConditionDraft, type RowDraft, type StackDraft } from './loadout.ts'
import type { SaveData, SavedHero } from './save.ts'

/**
 * Starter scaffolds for the rule editor. Applying one only builds drafts: nothing is saved, and the result
 * keeps no link to the template. Every template leaves a blank the existing validation refuses to save.
 */

export type TemplateOption = {
  template: RuleTemplate
  unlocked: boolean
  /** The unlock hint while locked, else null. */
  lockedReason: string | null
}

/** Whether an enemy the save has defeated meets an unlock. Reads only `defeatedEnemyIds` and the account's defeat records. */
export function templateUnlocked(save: SaveData, unlock: TemplateUnlock): boolean {
  if (unlock === 'open') return true
  const meets = (id: string): boolean => {
    const def = enemies[id]
    if (def === undefined) return false
    if (unlock === 'telegraph') return (def.skills ?? []).some((skill) => (skill.telegraphMs ?? 0) > 0)
    if (unlock === 'group') return def.archetype === 'swarm'
    return def.boss === true && (def.phases?.length ?? 0) > 1
  }
  return Object.keys(enemies).some((id) => meets(id) && enemyDefeatedByAnyHero(save, id))
}

/** The templates for this hero's class, plus the class-free ones, each unlocked or locked with its reason. */
export function templatesFor(hero: SavedHero, save: SaveData): TemplateOption[] {
  return ruleTemplates
    .filter((template) => template.classId === 'any' || template.classId === hero.classId)
    .map((template) => {
      const unlocked = templateUnlocked(save, template.unlock)
      return { template, unlocked, lockedReason: unlocked ? null : template.unlockHint }
    })
}

export type AppliedTemplate = {
  /** Rows for a rows template, or the new stack's rows. */
  rows: RowDraft[]
  /** Set for a stack template. */
  stack: StackDraft | null
  /** What the player still has to fill in, one line each, never naming a skill. */
  notes: string[]
}

function conditionDraft(condition: TemplateCondition): ConditionDraft {
  return { ...newCondition(condition.type), operator: condition.operator, value: condition.value }
}

/** Build the drafts for a template. A skill the hero lacks becomes a blank slot with the template's generic hint. */
export function applyTemplate(hero: SavedHero, template: RuleTemplate, stacks: readonly StackDraft[]): AppliedTemplate {
  const available = ruleSkillIds(hero)
  const notes: string[] = []
  const rows: RowDraft[] = template.rows.slice(0, 4).map((row, index) => {
    const has = row.skillId !== null && available.includes(row.skillId)
    if (!has) notes.push(`Rule ${index + 1}: ${row.hint}`)
    else if (row.condition !== undefined && row.condition.value === '' && row.condition.hint !== undefined) {
      notes.push(`Rule ${index + 1}: ${row.condition.hint}`)
    }
    return {
      skillId: has ? row.skillId! : '',
      conditions: row.condition === undefined ? [] : [conditionDraft(row.condition)],
      targetPriority: '',
      kept: [],
    }
  })
  if (template.kind === 'rows') return { rows, stack: null, notes }
  if (template.trigger !== undefined && template.trigger.value === '' && template.trigger.hint !== undefined) {
    notes.unshift(`Stack trigger: ${template.trigger.hint}`)
  }
  const stack: StackDraft = {
    id: nextStackId(stacks),
    name: (template.stackName ?? template.name).slice(0, MAX_STACK_NAME_LENGTH),
    when: template.trigger === undefined ? [] : [conditionDraft(template.trigger)],
    keptWhen: [],
    rows,
  }
  return { rows, stack, notes }
}

/** The skill names a template can use, for tests and the card. Blank slots are skipped. */
export function templateSkillIds(template: RuleTemplate): string[] {
  return template.rows.flatMap((row) => (row.skillId === null ? [] : [row.skillId]))
}
