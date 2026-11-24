import { enemies } from '../content/enemies.ts'
import { skills } from '../content/skills.ts'
import { statuses } from '../content/statuses.ts'
import { heroSkill } from '../sim/classes/starterNodes.ts'
import type { ApplyStatusEffect, DamageSchool, SkillDef, SkillEffect } from '../sim/types.ts'

function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`
}

/** Split a camelCase or kebab-case id into lowercase words: `fireBolt` becomes `fire bolt`. */
function humanize(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .toLowerCase()
}

function kindLabel(kind: string): string {
  return kind === 'twoHanded' ? 'two-handed' : humanize(kind)
}

/** The display name of a status (`expose` becomes `Expose`). */
function statusName(statusId: string): string {
  return statuses[statusId]?.name ?? humanize(statusId)
}

function listNames(names: readonly string[], joiner: 'and' | 'or'): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`
}

function lowerFirst(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

function powerLine(coefficient: number, school: DamageSchool, power: DamageSchool | undefined): string {
  const source = power ?? school
  return source === school ? `${coefficient}× ${school} power` : `${coefficient}× ${source} power as ${school} damage`
}

function statusLine(effect: ApplyStatusEffect): string {
  if (effect.baseChance <= 0) return ''
  if (effect.statusId === 'mark') return `Applies ${statusName(effect.statusId)}`
  return `${percent(effect.baseChance)} base chance to apply ${statusName(effect.statusId)}`
}

/**
 * One short plain-language line for a skill effect, or an empty string when the effect does nothing
 * a player would notice (a zero heal, a status that never lands). Callers drop empty lines.
 */
export function effectLine(effect: SkillEffect): string {
  switch (effect.kind) {
    case 'damage':
      return `Deals ${powerLine(effect.coefficient, effect.school, effect.power)}`
    case 'heal': {
      const parts: string[] = []
      if (effect.maxHpFraction > 0) parts.push(`${percent(effect.maxHpFraction)} of ${effect.maxHpOf === 'anchor' ? 'anchor max HP' : 'max HP'}`)
      if (effect.healingCoefficient > 0) parts.push(`${effect.healingCoefficient}× healing power`)
      return parts.length === 0 ? '' : `Heals ${parts.join(' and ')}`
    }
    case 'barrier': {
      const source = effect.source === 'anchorMaxHp' ? 'max HP' : `${effect.source} power`
      return `Barrier of ${effect.coefficient}× ${source} for ${effect.durationSeconds} s`
    }
    case 'damageReduction':
      return effect.fraction > 0 ? `Cuts every hit by ${percent(effect.fraction)} until your next action` : ''
    case 'telegraphWard':
      return `Wards off the next ${effect.charges === undefined || effect.charges === 1 ? 'telegraphed attack' : `${effect.charges} telegraphed attacks`} within ${effect.durationSeconds} s; elites and bosses still deal ${percent(effect.eliteDamageFraction)}`
    case 'statusImmunity':
      return `Stops new ${listNames(effect.statusIds.map(statusName), 'and')} for ${effect.durationSeconds} s`
    case 'incomingDamage':
      if (effect.multiplier === 1) return ''
      return effect.multiplier > 1 ? `You take ${percent(effect.multiplier - 1)} more damage afterwards` : `You take ${percent(1 - effect.multiplier)} less damage afterwards`
    case 'resource':
      return effect.base > 0 ? `Gains ${effect.base} class resource` : ''
    case 'applyStatus':
      return statusLine(effect)
    case 'cleanse': {
      const names = effect.statusIds.map(statusName)
      if (names.length === 0) return ''
      return effect.limit !== undefined && effect.limit < names.length ? `Removes one of ${listNames(names, 'or')}` : `Removes ${listNames(names, 'and')}`
    }
    case 'evasion':
      if (effect.amount === 0) return ''
      return effect.amount > 0 ? `Raises evasion by ${effect.amount} until your next action` : `Lowers evasion by ${-effect.amount} until your next action`
    case 'timedEvasion':
      if (effect.amount === 0) return ''
      return `${effect.amount > 0 ? 'Raises' : 'Lowers'} evasion by ${Math.abs(effect.amount)} for ${effect.durationSeconds} s`
    case 'skillDodge':
      return `Dodges the next enemy skill that would hit you within ${effect.durationSeconds} s`
    case 'reveal':
      return 'Reveals the target'
    case 'armTrap':
      return `Sets a trap with a ${percent(effect.baseChance)} base chance to stun`
    case 'actionDelay':
      return effect.delaySeconds > 0 ? `Delays the target’s next action by ${effect.delaySeconds} s` : ''
    case 'chain': {
      const jump =
        effect.followCoefficient !== undefined
          ? `, then ${effect.followCoefficient}× on each other enemy`
          : effect.decay < 1
            ? `, losing ${percent(1 - effect.decay)} per jump`
            : ''
      const parts = [`Hits up to ${effect.maxTargets} enemies in turn for ${powerLine(effect.coefficient, effect.school, undefined)}${jump}`]
      const first = effect.firstStatus === undefined ? '' : statusLine(effect.firstStatus)
      const follow = effect.followStatus === undefined ? '' : statusLine(effect.followStatus)
      if (first !== '') parts.push(`first target: ${lowerFirst(first)}`)
      if (follow !== '') parts.push(`other targets: ${lowerFirst(follow)}`)
      return parts.join('; ')
    }
    case 'field': {
      const ticks: string[] = []
      if (effect.damageCoefficient > 0) ticks.push(`deals ${powerLine(effect.damageCoefficient, effect.damageSchool, undefined)}`)
      if (effect.healCoefficient > 0) ticks.push(`heals ${effect.healCoefficient}× healing power`)
      return ticks.length === 0 ? '' : `Leaves a field for ${effect.durationSeconds} s that every ${effect.tickSeconds} s ${ticks.join(' and ')}`
    }
    case 'loseHp':
      return effect.maxHpFraction > 0 ? `You lose ${percent(effect.maxHpFraction)} of max HP${effect.preventFatal ? ' (never fatal)' : ''}` : ''
    case 'chanceGate': {
      const inner = effect.effects.map(effectLine).filter((line) => line !== '')
      return inner.length === 0 ? '' : `${percent(effect.baseChance)} base chance to: ${inner.map(lowerFirst).join(', ')}`
    }
    case 'summon':
      return `Summons ${enemies[effect.enemyId]?.name ?? 'an ally'}`
    case 'defenseBonus':
      return `Raises armor and resistance by ${percent(effect.multiplier - 1)} for ${effect.durationSeconds} s`
    case 'stealSupply':
      return `${percent(effect.chance)} chance to take a carried supply`
  }
}

/** Identical neighbours become one line marked `(twice)` or `(3 times)`. */
function collapseRepeats(lines: readonly string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    let n = 1
    while (lines[i + n] === lines[i]) n += 1
    out.push(n === 1 ? (lines[i] ?? '') : `${lines[i]} (${n === 2 ? 'twice' : `${n} times`})`)
    i += n
  }
  return out
}

export type SkillFacts = { name: string; stats: string[]; effects: string[] }

/** What a skill costs, how often it can be used, what it needs, and what it does. `nodeIds` are the nodes whose bonuses count. */
export function skillFacts(skillId: string, nodeIds: readonly string[] = []): SkillFacts | null {
  const base: SkillDef | undefined = skills[skillId]
  if (base === undefined) return null
  const skill = heroSkill({ allocatedNodeIds: nodeIds.slice() }, base)
  const stats = [skill.cost > 0 ? `Cost ${skill.cost}` : 'No cost', `Cooldown ${skill.cooldownSeconds} s`, skill.target === 'all' ? 'Hits all enemies' : 'One target']
  if (skill.requires?.mainHand !== undefined) stats.push(`Needs a ${kindLabel(skill.requires.mainHand)} weapon`)
  if (skill.requires?.offHand !== undefined) stats.push(`Needs a ${kindLabel(skill.requires.offHand)}`)
  if (skill.ammoCost !== undefined) stats.push(`${skill.ammoCost} special arrow`)
  return { name: skill.name, stats, effects: collapseRepeats(skill.effects.map(effectLine).filter((line) => line !== '')) }
}
