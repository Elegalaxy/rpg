import {
  ASSAULT_DEFENSE_MULTIPLIER,
  ASSAULT_POWER_MULTIPLIER,
  BASIC_ATTACK_COEFFICIENT,
  ENCOUNTER_XP_DISCOUNT_CAP,
  ENCOUNTER_XP_DISCOUNT_PER_EXTRA,
  GUARD_DEFENSE_MULTIPLIER,
  PACK_HUNTER_SPEED_CAP,
  PACK_HUNTER_SPEED_PER_ALLY,
  REGEN_EXPOSED_FRACTION_PER_SECOND,
  REGEN_FRACTION_PER_SECOND,
  STANCE_INTERVAL_MS,
} from './constants.ts'
import { activeBarrier, assertSkillDef } from './skills.ts'
import { slowedActionMs } from './statuses.ts'
import type {
  AllyTarget,
  BossPhaseDef,
  CombatActor,
  CombatState,
  DamageSchool,
  EnemyDef,
  EnemyFillerAttack,
  EnemySkillDef,
  EnemyStance,
  SkillDef,
  TelegraphEvent,
} from './types.ts'

/** On death, start the enemy's death-trigger skill as a telegraph. */
export const FRACTURE_BURST_TRAIT = 'fracture-burst'

/** +10% action speed per other living wolf, capped at +20%. Applied when an action is scheduled. */
export const PACK_HUNTER_TRAIT = 'pack-hunter'

/** Restore a fraction of maximum HP once per combat second. Burn pauses it. Expose halves it. */
export const REGENERATION_TRAIT = 'regeneration'

/** Replace Guard and Assault on a clock. Does not move an already scheduled action. */
export const STANCE_TRAIT = 'stance-cycle'

/** The first time HP is at or below the skill's fraction, start its telegraph once. */
export const HP_SUMMON_TRAIT = 'hp-summon'

/** Enter each HP-threshold phase once, then run that phase's immediate skills. */
export const BOSS_PHASES_TRAIT = 'boss-phases'

const KNOWN_TRAITS = [
  FRACTURE_BURST_TRAIT,
  PACK_HUNTER_TRAIT,
  REGENERATION_TRAIT,
  STANCE_TRAIT,
  HP_SUMMON_TRAIT,
  BOSS_PHASES_TRAIT,
] as const

const ALLY_TARGETS = ['lowestHpPercent', 'lowestBarrier', 'woundedLowestHpPercent'] as const

export type EnemySkillSkip = {
  id: string
  name: string
  reason: string
}

export type EnemySkillChoice = {
  skill: EnemySkillDef | null
  skipped: EnemySkillSkip[]
}

export type EncounterXpAward = {
  sum: number
  count: number
  discount: number
  amount: number
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object, received ${describeValue(value)}`)
  }
}

function includesAllyTarget(value: unknown): value is AllyTarget {
  return typeof value === 'string' && ALLY_TARGETS.includes(value as AllyTarget)
}

function assertSchool(value: unknown, label: string): asserts value is DamageSchool {
  if (value !== 'physical' && value !== 'magical') {
    throw new Error(`${label} must be physical or magical, received ${describeValue(value)}`)
  }
}

function skillView(skill: EnemySkillDef): SkillDef {
  return {
    id: skill.id,
    name: skill.name,
    cost: 0,
    cooldownSeconds: skill.cooldownSeconds,
    actionTimeCoefficient: skill.actionTimeCoefficient ?? 1,
    tags: skill.tags,
    target: 'single',
    effects: skill.effects,
  }
}

/** A SkillDef view so status application can read tags. Enemies do not pay hero costs. */
export function enemySkillView(skill: EnemySkillDef): SkillDef {
  return skillView(skill)
}

function assertEnemySkill(value: unknown, enemyId: string): EnemySkillDef {
  assertObject(value, `enemy ${enemyId} skill`)
  const id = value.id
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`enemy ${enemyId} skill is missing an id`)
  }
  if (typeof value.name !== 'string' || value.name.length === 0) {
    throw new Error(`enemy skill '${id}' is missing a name`)
  }
  if (typeof value.coefficient !== 'number' || !Number.isFinite(value.coefficient) || value.coefficient < 0) {
    throw new Error(
      `enemy skill '${id}' coefficient must be at least 0, received ${describeValue(value.coefficient)}`,
    )
  }
  assertSchool(value.school, `enemy skill '${id}' school`)
  if (typeof value.cooldownSeconds !== 'number' || !Number.isFinite(value.cooldownSeconds) || value.cooldownSeconds < 0) {
    throw new Error(
      `enemy skill '${id}' cooldown must be at least 0, received ${describeValue(value.cooldownSeconds)}`,
    )
  }
  if (value.telegraphMs !== undefined) {
    if (typeof value.telegraphMs !== 'number' || !Number.isInteger(value.telegraphMs) || value.telegraphMs < 0) {
      throw new Error(
        `enemy skill '${id}' telegraph must be a whole number of milliseconds, received ${describeValue(value.telegraphMs)}`,
      )
    }
  }
  if (typeof value.tag !== 'string' || value.tag.length === 0) {
    throw new Error(`enemy skill '${id}' is missing a tag`)
  }
  if (value.canCrit !== undefined && typeof value.canCrit !== 'boolean') {
    throw new Error(`enemy skill '${id}' canCrit must be a boolean, received ${describeValue(value.canCrit)}`)
  }
  if (value.actionTimeCoefficient !== undefined) {
    if (
      typeof value.actionTimeCoefficient !== 'number' ||
      !Number.isFinite(value.actionTimeCoefficient) ||
      value.actionTimeCoefficient <= 0
    ) {
      throw new Error(
        `enemy skill '${id}' action-time coefficient must be greater than 0, received ${describeValue(value.actionTimeCoefficient)}`,
      )
    }
  }
  const trigger = value.trigger ?? 'action'
  if (trigger !== 'action' && trigger !== 'death' && trigger !== 'hp' && trigger !== 'phase') {
    throw new Error(
      `enemy skill '${id}' trigger must be action, death, hp, or phase, received ${describeValue(value.trigger)}`,
    )
  }
  if (value.phase !== undefined) {
    if (typeof value.phase !== 'number' || !Number.isInteger(value.phase) || value.phase < 1) {
      throw new Error(`enemy skill '${id}' phase must be a positive integer, received ${describeValue(value.phase)}`)
    }
  }
  if (trigger === 'phase') {
    if (typeof value.phase !== 'number') throw new Error(`enemy skill '${id}' phase trigger needs a phase`)
    if ((value.telegraphMs ?? 0) > 0) throw new Error(`enemy skill '${id}' phase trigger resolves immediately`)
  }
  if (value.phases !== undefined) {
    if (!Array.isArray(value.phases) || value.phases.length === 0) {
      throw new Error(`enemy skill '${id}' phases must be a non-empty list`)
    }
    for (const phase of value.phases) {
      if (typeof phase !== 'number' || !Number.isInteger(phase) || phase < 1) {
        throw new Error(`enemy skill '${id}' phase must be a positive integer, received ${describeValue(phase)}`)
      }
    }
  }
  if (trigger === 'death' && (typeof value.telegraphMs !== 'number' || value.telegraphMs < 1)) {
    throw new Error(`enemy skill '${id}' death trigger needs a telegraph`)
  }
  if (value.hpFraction !== undefined) {
    if (
      typeof value.hpFraction !== 'number' ||
      !Number.isFinite(value.hpFraction) ||
      value.hpFraction <= 0 ||
      value.hpFraction > 1
    ) {
      throw new Error(
        `enemy skill '${id}' HP fraction must be greater than 0 and at most 1, received ${describeValue(value.hpFraction)}`,
      )
    }
  }
  if (trigger === 'hp') {
    if (typeof value.telegraphMs !== 'number' || value.telegraphMs < 1) {
      throw new Error(`enemy skill '${id}' HP trigger needs a telegraph`)
    }
    if (typeof value.hpFraction !== 'number') {
      throw new Error(`enemy skill '${id}' HP trigger needs an HP fraction`)
    }
  }
  if (value.interruptMaxHpFraction !== undefined) {
    if (
      typeof value.interruptMaxHpFraction !== 'number' ||
      !Number.isFinite(value.interruptMaxHpFraction) ||
      value.interruptMaxHpFraction <= 0 ||
      value.interruptMaxHpFraction > 1
    ) {
      throw new Error(
        `enemy skill '${id}' interrupt fraction must be greater than 0 and at most 1, received ${describeValue(value.interruptMaxHpFraction)}`,
      )
    }
    if (typeof value.telegraphMs !== 'number' || value.telegraphMs < 1) {
      throw new Error(`enemy skill '${id}' interrupt needs a telegraph`)
    }
  }
  if (!Array.isArray(value.effects) || value.effects.length === 0) {
    throw new Error(`enemy skill '${id}' has no effects`)
  }
  for (const effect of value.effects) {
    if (typeof effect !== 'object' || effect === null || !('kind' in effect)) {
      throw new Error(`enemy skill '${id}' has an unreadable effect`)
    }
    const kind = effect.kind
    if (
      kind !== 'damage' &&
      kind !== 'damageReduction' &&
      kind !== 'applyStatus' &&
      kind !== 'heal' &&
      kind !== 'barrier' &&
      kind !== 'actionDelay' &&
      kind !== 'chanceGate' &&
      kind !== 'timedEvasion' &&
      kind !== 'summon' &&
      kind !== 'defenseBonus'
    ) {
      throw new Error(`enemy skill '${id}' cannot use effect '${describeValue(kind)}'`)
    }
  }
  if (value.allyTarget !== undefined && !includesAllyTarget(value.allyTarget)) {
    throw new Error(
      `enemy skill '${id}' ally target is unknown, received ${describeValue(value.allyTarget)}`,
    )
  }
  if (value.affectSelf !== undefined && typeof value.affectSelf !== 'boolean') {
    throw new Error(`enemy skill '${id}' affectSelf must be a boolean, received ${describeValue(value.affectSelf)}`)
  }
  if (value.forcedRecovery !== undefined) {
    assertObject(value.forcedRecovery, `enemy skill '${id}' recovery`)
    const recovery = value.forcedRecovery
    if (typeof recovery.id !== 'string' || recovery.id.length === 0) {
      throw new Error(`enemy skill '${id}' recovery is missing an id`)
    }
    if (typeof recovery.name !== 'string' || recovery.name.length === 0) {
      throw new Error(`enemy skill '${id}' recovery is missing a name`)
    }
    if (typeof recovery.durationMs !== 'number' || !Number.isInteger(recovery.durationMs) || recovery.durationMs < 1) {
      throw new Error(
        `enemy skill '${id}' recovery must be a positive number of milliseconds, received ${describeValue(recovery.durationMs)}`,
      )
    }
    if (typeof recovery.evasion !== 'number' || !Number.isFinite(recovery.evasion) || recovery.evasion === 0) {
      throw new Error(
        `enemy skill '${id}' recovery Evasion must be a non-zero number, received ${describeValue(recovery.evasion)}`,
      )
    }
  }
  assertSkillDef(skillView(value as EnemySkillDef))
  const skill = value as EnemySkillDef
  if (skill.canCrit === true && (skill.telegraphMs ?? 0) < 1) {
    throw new Error(`enemy skill '${id}' can crit only on a telegraphed skill`)
  }
  if ((skill.trigger ?? 'action') === 'hp' && !skill.effects.some((effect) => effect.kind === 'summon')) {
    throw new Error(`enemy skill '${id}' HP trigger needs a summon`)
  }
  if ((skill.trigger ?? 'action') === 'phase' && !skill.effects.some((effect) => effect.kind === 'summon')) {
    throw new Error(`enemy skill '${id}' phase trigger needs a summon`)
  }
  return skill
}

function assertFiller(value: unknown, enemyId: string): EnemyFillerAttack {
  assertObject(value, `enemy ${enemyId} filler`)
  assertSchool(value.school, `enemy ${enemyId} filler school`)
  if (value.coefficient !== undefined) {
    if (typeof value.coefficient !== 'number' || !Number.isFinite(value.coefficient) || value.coefficient <= 0) {
      throw new Error(
        `enemy ${enemyId} filler coefficient must be greater than 0, received ${describeValue(value.coefficient)}`,
      )
    }
  }
  return value as EnemyFillerAttack
}

/** Reject an enemy definition the simulation cannot spawn. */
export function assertEnemyDef(value: unknown): asserts value is EnemyDef {
  assertObject(value, 'enemy definition')
  const id = value.id
  if (typeof id !== 'string' || id.length === 0) throw new Error('enemy definition is missing an id')
  if (typeof value.name !== 'string' || value.name.length === 0) {
    throw new Error(`enemy ${id} is missing a name`)
  }
  if (typeof value.level !== 'number' || !Number.isInteger(value.level) || value.level < 1) {
    throw new Error(`enemy ${id} level must be a positive integer, received ${describeValue(value.level)}`)
  }
  const hasMin = value.levelMin !== undefined
  const hasMax = value.levelMax !== undefined
  if (hasMin !== hasMax) throw new Error(`enemy ${id} needs both ends of its level range`)
  if (hasMin && hasMax) {
    if (typeof value.levelMin !== 'number' || !Number.isInteger(value.levelMin) || value.levelMin < 1) {
      throw new Error(`enemy ${id} levelMin must be a positive integer, received ${describeValue(value.levelMin)}`)
    }
    if (typeof value.levelMax !== 'number' || !Number.isInteger(value.levelMax) || value.levelMax < value.levelMin) {
      throw new Error(`enemy ${id} levelMax must be at least levelMin, received ${describeValue(value.levelMax)}`)
    }
    if (value.level < value.levelMin || value.level > value.levelMax) {
      throw new Error(`enemy ${id} level ${value.level} is outside ${value.levelMin}–${value.levelMax}`)
    }
  }
  if (value.filler !== undefined) assertFiller(value.filler, id)
  const skills = value.skills ?? []
  if (!Array.isArray(skills)) throw new Error(`enemy ${id} skills must be a list`)
  const seen: { [skillId: string]: boolean } = {}
  let deathSkills = 0
  let hpSkills = 0
  for (const skill of skills) {
    const checked = assertEnemySkill(skill, id)
    if (seen[checked.id] === true) throw new Error(`enemy ${id} duplicates skill '${checked.id}'`)
    seen[checked.id] = true
    if ((checked.trigger ?? 'action') === 'death') deathSkills += 1
    if ((checked.trigger ?? 'action') === 'hp') hpSkills += 1
  }
  const traits = value.traitIds ?? []
  if (!Array.isArray(traits)) throw new Error(`enemy ${id} traits must be a list`)
  for (const traitId of traits) {
    if (typeof traitId !== 'string' || !KNOWN_TRAITS.includes(traitId as (typeof KNOWN_TRAITS)[number])) {
      throw new Error(`enemy ${id} has unknown trait '${describeValue(traitId)}'`)
    }
  }
  if (traits.includes(FRACTURE_BURST_TRAIT) && deathSkills !== 1) {
    throw new Error(`enemy ${id} fracture burst needs one death skill`)
  }
  if (traits.includes(HP_SUMMON_TRAIT) && hpSkills !== 1) {
    throw new Error(`enemy ${id} HP summon needs one HP skill, received ${hpSkills}`)
  }
  if (value.echoRank !== undefined && typeof value.echoRank !== 'boolean') {
    throw new Error(`enemy ${id} echo rank must be a boolean, received ${describeValue(value.echoRank)}`)
  }
  const hasPhases = traits.includes(BOSS_PHASES_TRAIT)
  if (value.phases !== undefined) assertBossPhases(value.phases, id)
  if (hasPhases && (value.phases === undefined || !Array.isArray(value.phases) || value.phases.length === 0)) {
    throw new Error(`enemy ${id} boss phases need a phase list`)
  }
  if (!hasPhases && value.phases !== undefined) {
    throw new Error(`enemy ${id} phases need the boss-phases trait`)
  }
}

function assertPositiveFactor(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than 0, received ${describeValue(value)}`)
  }
  return value
}

function assertBossPhases(value: unknown, enemyId: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`enemy ${enemyId} phases must be a non-empty list`)
  }
  const seenPhase: { [phase: number]: boolean } = {}
  const seenFraction: { [fraction: string]: boolean } = {}
  let starts = 0
  for (const entry of value) {
    assertObject(entry, `enemy ${enemyId} phase`)
    if (typeof entry.phase !== 'number' || !Number.isInteger(entry.phase) || entry.phase < 1) {
      throw new Error(`enemy ${enemyId} phase must be a positive integer, received ${describeValue(entry.phase)}`)
    }
    if (seenPhase[entry.phase] === true) throw new Error(`enemy ${enemyId} duplicates phase ${entry.phase}`)
    seenPhase[entry.phase] = true
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      throw new Error(`enemy ${enemyId} phase ${entry.phase} is missing a name`)
    }
    if (entry.atOrBelowHpFraction === undefined) {
      starts += 1
    } else if (
      typeof entry.atOrBelowHpFraction !== 'number' ||
      !Number.isFinite(entry.atOrBelowHpFraction) ||
      entry.atOrBelowHpFraction <= 0 ||
      entry.atOrBelowHpFraction > 1
    ) {
      throw new Error(
        `enemy ${enemyId} phase ${entry.phase} HP fraction must be greater than 0 and at most 1, received ${describeValue(entry.atOrBelowHpFraction)}`,
      )
    } else if (seenFraction[String(entry.atOrBelowHpFraction)] === true) {
      throw new Error(`enemy ${enemyId} duplicates HP fraction ${entry.atOrBelowHpFraction}`)
    } else {
      seenFraction[String(entry.atOrBelowHpFraction)] = true
    }
    const pressure = entry.pressureIntervalMs !== undefined
    if (
      pressure ||
      entry.pressureMaxStacks !== undefined ||
      entry.pressurePower !== undefined ||
      entry.pressureDefense !== undefined ||
      entry.pressureActionSpeed !== undefined
    ) {
      if (typeof entry.pressureIntervalMs !== 'number' || !Number.isInteger(entry.pressureIntervalMs) || entry.pressureIntervalMs < 1) {
        throw new Error(
          `enemy ${enemyId} phase ${entry.phase} pressure interval must be a positive number of milliseconds, received ${describeValue(entry.pressureIntervalMs)}`,
        )
      }
      if (typeof entry.pressureMaxStacks !== 'number' || !Number.isInteger(entry.pressureMaxStacks) || entry.pressureMaxStacks < 1) {
        throw new Error(
          `enemy ${enemyId} phase ${entry.phase} pressure cap must be a positive integer, received ${describeValue(entry.pressureMaxStacks)}`,
        )
      }
      assertPositiveFactor(entry.pressurePower, `enemy ${enemyId} phase ${entry.phase} pressure power`)
      assertPositiveFactor(entry.pressureDefense, `enemy ${enemyId} phase ${entry.phase} pressure defense`)
      assertPositiveFactor(entry.pressureActionSpeed, `enemy ${enemyId} phase ${entry.phase} pressure action speed`)
    }
  }
  if (starts !== 1) throw new Error(`enemy ${enemyId} needs exactly one starting phase, received ${starts}`)
}

/** Encounter level, or the definition's only level when the range is a single step. */
export function enemySpawnLevel(def: EnemyDef, requested: number | undefined): number {
  const min = def.levelMin ?? def.level
  const max = def.levelMax ?? def.level
  if (requested === undefined) {
    if (min !== max) {
      throw new Error(`enemy ${def.id} requires an encounter level from ${min} through ${max}`)
    }
    return min
  }
  if (typeof requested !== 'number' || !Number.isInteger(requested) || requested < min || requested > max) {
    throw new Error(
      `enemy ${def.id} level must be an integer from ${min} through ${max}, received ${describeValue(requested)}`,
    )
  }
  return requested
}

/** Filler school and coefficient. Omitted filler uses the definition school and coefficient 1. */
export function enemyFiller(def: EnemyDef): { school: DamageSchool; coefficient: number } {
  return {
    school: def.filler?.school ?? def.school,
    coefficient: def.filler?.coefficient ?? BASIC_ATTACK_COEFFICIENT,
  }
}

export function copyEnemySkills(def: EnemyDef): EnemySkillDef[] {
  return [...(def.skills ?? [])]
}

/** A shallow copy so combat can keep the phase list on the actor. */
export function copyBossPhases(phases: readonly BossPhaseDef[] | undefined): BossPhaseDef[] {
  if (phases === undefined) return []
  return phases.map((phase) => ({ ...phase }))
}

/**
 * Recompute Power, Armor, and Resistance from the rank-adjusted bases.
 * Guard multiplies defense. Each pressure stack multiplies Power and defense again.
 */
export function applyPhaseModifiers(actor: CombatActor): void {
  const stacks = actor.pressureStacks
  const powerScale = stacks > 0 ? Math.pow(actor.pressurePowerMultiplier, stacks) : 1
  const defenseScale = stacks > 0 ? Math.pow(actor.pressureDefenseMultiplier, stacks) : 1
  actor.power = actor.rankPower * powerScale
  actor.armor = actor.rankArmor * actor.defenseBonusMultiplier * defenseScale
  actor.resistance = actor.rankResistance * actor.defenseBonusMultiplier * defenseScale
}

/** Other living Pack Hunters, not this actor. The bonus is capped at +20%. */
export function packHunterSpeed(enemies: readonly CombatActor[], actor: CombatActor): number {
  let others = 0
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.id === actor.id) continue
    if (!enemy.traitIds.includes(PACK_HUNTER_TRAIT)) continue
    others += 1
  }
  const bonus = PACK_HUNTER_SPEED_PER_ALLY * others
  return bonus > PACK_HUNTER_SPEED_CAP ? PACK_HUNTER_SPEED_CAP : bonus
}

/**
 * Action-speed bonus applied the next time an action is scheduled.
 * An already scheduled ready time or telegraph is left where it is.
 */
export function enemyActionSpeedBonus(enemies: readonly CombatActor[], actor: CombatActor): number {
  let bonus = 0
  for (const traitId of actor.traitIds) {
    if (traitId === PACK_HUNTER_TRAIT) bonus += packHunterSpeed(enemies, actor)
  }
  if (actor.pressureStacks > 0 && actor.pressureActionSpeed > 1) {
    bonus += Math.pow(actor.pressureActionSpeed, actor.pressureStacks) - 1
  }
  return bonus
}

/**
 * Recovery before the next ready time.
 * Coefficient 1 and no speed bonus returns the chilled action time unchanged.
 */
export function enemyRecoveryMs(
  actionTimeMs: number,
  coefficient: number,
  slowFraction: number,
  speedBonus: number,
): number {
  if (typeof coefficient !== 'number' || !Number.isFinite(coefficient) || coefficient <= 0) {
    throw new Error(`action-time coefficient must be greater than 0, received ${describeValue(coefficient)}`)
  }
  if (typeof speedBonus !== 'number' || !Number.isFinite(speedBonus) || speedBonus < 0) {
    throw new Error(`action-speed bonus must be at least 0, received ${describeValue(speedBonus)}`)
  }
  const scaled = coefficient === 1 ? actionTimeMs : Math.round(actionTimeMs * coefficient)
  if (!Number.isInteger(scaled) || scaled < 1) {
    throw new Error(`action time must be a positive number of milliseconds, received ${describeValue(scaled)}`)
  }
  const chilled = slowedActionMs(scaled, slowFraction)
  if (speedBonus === 0) return chilled
  const ms = Math.round(chilled / (1 + speedBonus))
  return ms < 1 ? 1 : ms
}

/** Other living enemies. The actor is not its own ally. Slot order is stable for ties. */
export function livingAllies(enemies: readonly CombatActor[], actor: CombatActor): CombatActor[] {
  const allies: CombatActor[] = []
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.id === actor.id) continue
    allies.push(enemy)
  }
  allies.sort((left, right) => left.slot - right.slot)
  return allies
}

function hpPercent(actor: CombatActor): number {
  if (typeof actor.maxHp !== 'number' || !Number.isFinite(actor.maxHp) || actor.maxHp <= 0) {
    throw new Error(`${actor.name} max HP must be greater than 0, received ${describeValue(actor.maxHp)}`)
  }
  return actor.hp / actor.maxHp
}

function lowestHpPercent(allies: readonly CombatActor[]): CombatActor | null {
  let best: CombatActor | null = null
  let bestPercent = 0
  for (const ally of allies) {
    const percent = hpPercent(ally)
    if (best === null || percent < bestPercent || (percent === bestPercent && ally.slot < best.slot)) {
      best = ally
      bestPercent = percent
    }
  }
  return best
}

function lowestBarrier(allies: readonly CombatActor[], timeMs: number): CombatActor | null {
  let best: CombatActor | null = null
  let bestAmount = 0
  for (const ally of allies) {
    const amount = activeBarrier(ally, timeMs)
    if (best === null || amount < bestAmount || (amount === bestAmount && ally.slot < best.slot)) {
      best = ally
      bestAmount = amount
    }
  }
  return best
}

/** The ally a support skill would affect. Null when none is legal. */
export function selectAlly(
  enemies: readonly CombatActor[],
  actor: CombatActor,
  target: AllyTarget,
  timeMs: number,
): CombatActor | null {
  const allies = livingAllies(enemies, actor)
  if (target === 'woundedLowestHpPercent') {
    return lowestHpPercent(allies.filter((ally) => ally.hp < ally.maxHp))
  }
  if (target === 'lowestBarrier') return lowestBarrier(allies, timeMs)
  return lowestHpPercent(allies)
}

/**
 * Why a support skill cannot be used. Null when it has a legal target.
 * A skill that also affects its caster is legal with no ally.
 */
export function allyBlock(
  actor: CombatActor,
  skill: EnemySkillDef,
  enemies: readonly CombatActor[],
  timeMs: number,
): string | null {
  if (skill.allyTarget === undefined) return null
  if (selectAlly(enemies, actor, skill.allyTarget, timeMs) !== null) return null
  if (skill.affectSelf === true) return null
  if (skill.allyTarget === 'woundedLowestHpPercent' && livingAllies(enemies, actor).length > 0) {
    return 'every ally is at full HP'
  }
  return 'no living ally'
}

/**
 * First authored action skill that is off cooldown and has a legal target, in listed order.
 * Death skills are not chosen. Support skills with no legal ally are skipped.
 */
export function chooseEnemySkill(
  actor: CombatActor,
  timeMs: number,
  enemies: readonly CombatActor[],
): EnemySkillChoice {
  const skipped: EnemySkillSkip[] = []
  for (const skill of actor.skills) {
    if ((skill.trigger ?? 'action') !== 'action') continue
    if (skill.phases !== undefined && !skill.phases.includes(actor.bossPhase)) continue
    const readyAt = actor.cooldowns[skill.id]
    if (readyAt !== undefined && timeMs < readyAt) continue
    const reason = allyBlock(actor, skill, enemies, timeMs)
    if (reason !== null) {
      skipped.push({ id: skill.id, name: skill.name, reason })
      continue
    }
    return { skill, skipped }
  }
  return { skill: null, skipped }
}

function deathSkill(actor: CombatActor): EnemySkillDef {
  for (const skill of actor.skills) {
    if ((skill.trigger ?? 'action') === 'death') return skill
  }
  throw new Error(`${actor.name} has no death skill`)
}

function telegraphEvent(
  actor: CombatActor,
  skill: EnemySkillDef,
  phase: TelegraphEvent['phase'],
  timeMs: number,
  resolvesAtMs: number,
  cooldownReadyMs?: number | null,
): TelegraphEvent {
  return {
    type: 'telegraph',
    phase,
    timeMs,
    actorId: actor.id,
    actorName: actor.name,
    skillId: skill.id,
    skillName: skill.name,
    tag: skill.tag,
    resolvesAtMs,
    ...(cooldownReadyMs !== undefined ? { cooldownReadyMs } : {}),
  }
}

/** Start the death skill's telegraph. This is not a living actor's action. */
export function fractureBurstOnDeath(state: CombatState, actor: CombatActor, timeMs: number): void {
  const skill = deathSkill(actor)
  const telegraphMs = skill.telegraphMs
  if (telegraphMs === undefined || telegraphMs < 1) {
    throw new Error(`${skill.name} needs a telegraph`)
  }
  const resolvesAtMs = timeMs + telegraphMs
  actor.telegraph = {
    tag: skill.tag,
    resolvesAtMs,
    skillId: skill.id,
    persistsAfterDeath: true,
  }
  state.log.push(telegraphEvent(actor, skill, 'start', timeMs, resolvesAtMs))
}

const TRAIT_ON_DEATH: {
  [id: string]: (state: CombatState, actor: CombatActor, timeMs: number) => void
} = {
  [FRACTURE_BURST_TRAIT]: fractureBurstOnDeath,
}

/** Run death traits. Pack Hunter, regeneration, stances, and HP summons have no death effect. */
export function onEnemyDeath(state: CombatState, actor: CombatActor, timeMs: number): void {
  for (const traitId of actor.traitIds) {
    const handler = TRAIT_ON_DEATH[traitId]
    if (handler !== undefined) handler(state, actor, timeMs)
  }
}

function regenerationOnSecond(state: CombatState, actor: CombatActor, timeMs: number): void {
  if (!actor.alive || state.outcome !== 'ongoing') return
  const burned = actor.statuses.burn !== null && actor.statuses.burn.expiresMs > timeMs
  const exposed = !burned && actor.statuses.expose !== null && actor.statuses.expose.expiresMs > timeMs
  let fraction = REGEN_FRACTION_PER_SECOND
  if (burned) fraction = 0
  else if (exposed) fraction = REGEN_EXPOSED_FRACTION_PER_SECOND
  const hpBefore = actor.hp
  let amount = 0
  if (fraction > 0) {
    amount = Math.round(actor.maxHp * fraction)
    if (amount < 0) amount = 0
    let hpAfter = hpBefore + amount
    if (hpAfter > actor.maxHp) hpAfter = actor.maxHp
    amount = hpAfter - hpBefore
    actor.hp = hpAfter
  }
  state.log.push({
    type: 'regen',
    timeMs,
    actorId: actor.id,
    actorName: actor.name,
    maxHp: actor.maxHp,
    fraction,
    amount,
    hpBefore,
    hpAfter: actor.hp,
    paused: burned,
  })
}

/**
 * True when `amount / total` has reached `fraction`.
 * The comparison tolerates a binary rounding error smaller than one millionth of an HP.
 */
export function reachedFraction(amount: number, total: number, fraction: number): boolean {
  if (!(total > 0)) return false
  return amount * 1_000_000 + 1 >= total * fraction * 1_000_000
}

/** True when `amount / total` is at or below `fraction`, with the same tolerance. */
export function atOrBelowFraction(amount: number, total: number, fraction: number): boolean {
  if (!(total > 0)) return false
  return amount * 1_000_000 <= total * fraction * 1_000_000 + 1
}

function applyStanceNumbers(actor: CombatActor, stance: EnemyStance): void {
  const power = actor.stanceBasePower
  const armor = actor.stanceBaseArmor
  const resistance = actor.stanceBaseResistance
  if (stance === 'guard') {
    actor.power = power
    actor.armor = armor * GUARD_DEFENSE_MULTIPLIER
    actor.resistance = resistance * GUARD_DEFENSE_MULTIPLIER
    return
  }
  actor.power = power * ASSAULT_POWER_MULTIPLIER
  actor.armor = armor * ASSAULT_DEFENSE_MULTIPLIER
  actor.resistance = resistance * ASSAULT_DEFENSE_MULTIPLIER
}

/**
 * Replace the current stance. The first call stores the unstanced stats.
 * Scheduled ready times and telegraphs stay where they are.
 */
function enterStance(state: CombatState, actor: CombatActor, stance: EnemyStance, timeMs: number): void {
  if (actor.stance === null) {
    actor.stanceBasePower = actor.power
    actor.stanceBaseArmor = actor.armor
    actor.stanceBaseResistance = actor.resistance
  }
  applyStanceNumbers(actor, stance)
  actor.stance = stance
  state.log.push({
    type: 'stance',
    timeMs,
    actorId: actor.id,
    actorName: actor.name,
    stance,
    power: actor.power,
    armor: actor.armor,
    resistance: actor.resistance,
  })
}

function stanceOnSpawn(state: CombatState, actor: CombatActor): void {
  enterStance(state, actor, 'guard', state.timeMs)
}

function stanceOnSecond(state: CombatState, actor: CombatActor, timeMs: number): void {
  if (timeMs <= 0 || timeMs % STANCE_INTERVAL_MS !== 0) return
  enterStance(state, actor, actor.stance === 'guard' ? 'assault' : 'guard', timeMs)
}

function startHpSummon(state: CombatState, actor: CombatActor, timeMs: number): void {
  if (!actor.alive || actor.hp <= 0 || state.outcome !== 'ongoing') return
  for (const skill of actor.skills) {
    if ((skill.trigger ?? 'action') !== 'hp') continue
    if (actor.thresholdStarted[skill.id] === true) continue
    const fraction = skill.hpFraction
    const telegraphMs = skill.telegraphMs
    if (fraction === undefined || telegraphMs === undefined || telegraphMs < 1) continue
    if (!atOrBelowFraction(actor.hp, actor.maxHp, fraction)) continue
    actor.thresholdStarted[skill.id] = true
    const resolvesAtMs = timeMs + telegraphMs
    actor.reaction = {
      tag: skill.tag,
      resolvesAtMs,
      skillId: skill.id,
      persistsAfterDeath: false,
    }
    state.log.push(telegraphEvent(actor, skill, 'start', timeMs, resolvesAtMs))
  }
}

function logPhase(state: CombatState, actor: CombatActor, phase: BossPhaseDef, timeMs: number): void {
  state.log.push({
    type: 'phase',
    timeMs,
    actorId: actor.id,
    actorName: actor.name,
    phase: phase.phase,
    name: phase.name,
    hp: actor.hp,
    maxHp: actor.maxHp,
  })
}

function startingPhase(actor: CombatActor): BossPhaseDef {
  for (const phase of actor.phases) {
    if (phase.atOrBelowHpFraction === undefined) return phase
  }
  throw new Error(`${actor.name} has no starting phase`)
}

function enterBossPhase(state: CombatState, actor: CombatActor, phase: BossPhaseDef, timeMs: number): void {
  actor.bossPhase = phase.phase
  logPhase(state, actor, phase, timeMs)
  for (const skill of actor.skills) {
    if ((skill.trigger ?? 'action') !== 'phase' || skill.phase !== phase.phase) continue
    if (actor.thresholdStarted[skill.id] === true) continue
    actor.thresholdStarted[skill.id] = true
    actor.phaseSkillsDue.push({ skillId: skill.id, timeMs })
  }
  if (phase.pressureIntervalMs === undefined) return
  actor.pressureIntervalMs = phase.pressureIntervalMs
  actor.pressureMaxStacks = phase.pressureMaxStacks ?? 0
  actor.pressurePowerMultiplier = phase.pressurePower ?? 1
  actor.pressureDefenseMultiplier = phase.pressureDefense ?? 1
  actor.pressureActionSpeed = phase.pressureActionSpeed ?? 1
  actor.pressureStacks = 0
  actor.pressureNextMs = timeMs + phase.pressureIntervalMs
}

function bossPhasesOnSpawn(state: CombatState, actor: CombatActor): void {
  const phase = startingPhase(actor)
  actor.bossPhase = phase.phase
  logPhase(state, actor, phase, state.timeMs)
}

/**
 * Advance one threshold at a time, highest HP fraction first.
 * A single hit that crosses two thresholds still summons on the earlier phase.
 * Healing back above a threshold does not return to an earlier phase.
 */
function bossPhasesOnHp(state: CombatState, actor: CombatActor, timeMs: number): void {
  const thresholds = actor.phases.filter((phase) => phase.atOrBelowHpFraction !== undefined)
  thresholds.sort((left, right) => (right.atOrBelowHpFraction ?? 0) - (left.atOrBelowHpFraction ?? 0))
  for (const phase of thresholds) {
    if (actor.bossPhase >= phase.phase) continue
    const fraction = phase.atOrBelowHpFraction
    if (fraction === undefined || !atOrBelowFraction(actor.hp, actor.maxHp, fraction)) continue
    enterBossPhase(state, actor, phase, timeMs)
  }
}

/**
 * Gain every pressure stack whose time falls in this step, up to the cap.
 * An already scheduled ready time is left where it is.
 */
export function gainPressureStacks(state: CombatState, stepStart: number, stepEnd: number): void {
  for (const actor of state.enemies) {
    if (!actor.alive || state.outcome !== 'ongoing') continue
    if (actor.pressureIntervalMs <= 0 || actor.pressureMaxStacks <= 0 || actor.pressureNextMs <= 0) continue
    while (
      actor.pressureStacks < actor.pressureMaxStacks &&
      actor.pressureNextMs > stepStart &&
      actor.pressureNextMs <= stepEnd
    ) {
      const timeMs = actor.pressureNextMs
      actor.pressureStacks += 1
      if (actor.pressureStacks >= actor.pressureMaxStacks) actor.pressureNextMs = 0
      else actor.pressureNextMs = timeMs + actor.pressureIntervalMs
      applyPhaseModifiers(actor)
      state.log.push({
        type: 'stack',
        timeMs,
        actorId: actor.id,
        actorName: actor.name,
        stacks: actor.pressureStacks,
        maxStacks: actor.pressureMaxStacks,
        power: actor.power,
        armor: actor.armor,
        resistance: actor.resistance,
      })
    }
  }
}

const TRAIT_ON_SECOND: {
  [id: string]: (state: CombatState, actor: CombatActor, timeMs: number) => void
} = {
  [REGENERATION_TRAIT]: regenerationOnSecond,
  [STANCE_TRAIT]: stanceOnSecond,
}

const TRAIT_ON_SPAWN: {
  [id: string]: (state: CombatState, actor: CombatActor) => void
} = {
  [STANCE_TRAIT]: stanceOnSpawn,
  [BOSS_PHASES_TRAIT]: bossPhasesOnSpawn,
}

const TRAIT_ON_HP: {
  [id: string]: (state: CombatState, actor: CombatActor, timeMs: number) => void
} = {
  [HP_SUMMON_TRAIT]: startHpSummon,
  [BOSS_PHASES_TRAIT]: bossPhasesOnHp,
}

/** One trait tick per whole combat second. Traits without a handler do nothing. */
export function onEnemySecond(state: CombatState, actor: CombatActor, timeMs: number): void {
  if (!actor.alive || state.outcome !== 'ongoing') return
  for (const traitId of actor.traitIds) {
    const handler = TRAIT_ON_SECOND[traitId]
    if (handler !== undefined) handler(state, actor, timeMs)
  }
}

/** Apply spawn traits. A stance starts in Guard and logs that entry. */
export function onEnemySpawn(state: CombatState, actor: CombatActor): void {
  for (const traitId of actor.traitIds) {
    const handler = TRAIT_ON_SPAWN[traitId]
    if (handler !== undefined) handler(state, actor)
  }
  onEnemyHpChanged(state, actor, state.timeMs)
}

/**
 * The first time a living enemy is at or below its HP-summon fraction, start that telegraph.
 * A killing blow does not start it. Starting it once is remembered even if it is later cancelled.
 */
export function onEnemyHpChanged(state: CombatState, actor: CombatActor, timeMs: number): void {
  if (!actor.alive || actor.hp <= 0 || state.outcome !== 'ongoing') return
  for (const traitId of actor.traitIds) {
    const handler = TRAIT_ON_HP[traitId]
    if (handler !== undefined) handler(state, actor, timeMs)
  }
}

/**
 * Sum non-summon XP, then discount 5% for each of those enemies beyond the first.
 * The discount caps at 20%. Summons add 0 and do not increase the count.
 */
export function encounterXpAward(members: readonly { xp: number; summon: boolean }[]): EncounterXpAward {
  let sum = 0
  let count = 0
  for (const member of members) {
    if (member.summon) continue
    if (typeof member.xp !== 'number' || !Number.isFinite(member.xp) || member.xp < 0) {
      throw new Error(`encounter XP must be at least 0, received ${describeValue(member.xp)}`)
    }
    sum += member.xp
    count += 1
  }
  const extra = count > 0 ? count - 1 : 0
  const raw = extra * ENCOUNTER_XP_DISCOUNT_PER_EXTRA
  const discount = raw > ENCOUNTER_XP_DISCOUNT_CAP ? ENCOUNTER_XP_DISCOUNT_CAP : raw
  return { sum, count, discount, amount: Math.round(sum * (1 - discount)) }
}
