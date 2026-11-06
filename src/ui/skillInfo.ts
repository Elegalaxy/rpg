import { skills } from '../content/skills.ts'
import type { SkillDef, SkillEffect } from '../sim/types.ts'

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

function humanize(text: string): string {
  return text.replace(/([A-Z])/g, ' $1').replace(/-/g, ' ').toLowerCase()
}

/** One short plain-language line for a skill effect. Unknown kinds fall back to their name. */
export function effectLine(effect: SkillEffect): string {
  switch (effect.kind) {
    case 'damage':
      return `Deals ${effect.coefficient}× ${effect.power ?? effect.school} power as ${effect.school} damage`
    case 'heal':
      return `Heals ${percent(effect.maxHpFraction)} of max HP`
    case 'barrier':
      return `Barrier of ${effect.coefficient}× ${effect.source === 'anchorMaxHp' ? 'max HP' : `${effect.source} power`} for ${effect.durationSeconds} s`
    case 'damageReduction':
      return `Cuts the next hit by ${percent(effect.fraction)}`
    case 'incomingDamage':
      return `You take ${percent(effect.multiplier - 1)} more damage afterwards`
    case 'resource':
      return `Gains ${effect.base} class resource`
    case 'applyStatus':
      return `${percent(effect.baseChance)} base chance to apply ${humanize(effect.statusId)}`
    case 'cleanse':
      return `Removes ${effect.statusIds.map(humanize).join(' and ')}`
    case 'evasion':
      return `Raises evasion`
    default:
      return humanize(effect.kind)
  }
}

export type SkillFacts = { name: string; stats: string[]; effects: string[] }

/** What a skill costs, how often it can be used, what it needs, and what it does. */
export function skillFacts(skillId: string): SkillFacts | null {
  const skill: SkillDef | undefined = skills[skillId]
  if (skill === undefined) return null
  const stats = [skill.cost > 0 ? `Cost ${skill.cost}` : 'No cost', `Cooldown ${skill.cooldownSeconds} s`, skill.target === 'all' ? 'Hits all enemies' : 'One target']
  if (skill.requires?.mainHand !== undefined) stats.push(`Needs a ${humanize(skill.requires.mainHand)} weapon`)
  if (skill.requires?.offHand !== undefined) stats.push(`Needs a ${humanize(skill.requires.offHand)}`)
  if (skill.ammoCost !== undefined) stats.push(`${skill.ammoCost} special arrow`)
  return { name: skill.name, stats, effects: skill.effects.map(effectLine) }
}
