import { adjustedEvasionAmount, applyFatalExecute, markedDirectFactor } from './classes/assassin.ts'
import {
  chainDecay,
  convergenceSlotSkill,
  mageAffordable,
  mageSkillBlock,
  recoveryResourceBase,
} from './classes/mageAdjust.ts'
import {
  barrierFactor,
  clericAffordable,
  clericSkillBlock,
  healCoefficient,
  penanceResourceBase,
  releaseSlotSkill,
  righteousPenetration,
} from './classes/clericAdjust.ts'
import { grantClassResource } from './classes/resources.ts'
import { adjustedHealingReceived, resolvedSkillCost } from './classes/warriorAdjust.ts'
import {
  COOLDOWN_REDUCTION_CAP,
  HEALING_ROLL_CEILING,
  HEALING_ROLL_FLOOR,
  OFF_HAND_KINDS,
  PENETRATION_CAP,
  WEAPON_POWER_FACTOR,
} from './constants.ts'
import { consistencyBounds, resolveDamage } from './damage.ts'
import {
  heroDamageRollFloorBonus,
  heroFinalDamageMultiplier,
  heroHealRollFloorBonus,
  heroKeptIncoming,
  raceOutgoingModifier,
  raisedFloor,
} from './races/adjustments.ts'
import { centeredRoll, nextFloat } from './rng.ts'
import { exposedDefense, pushActorTiming, tryApplyStatus } from './statuses.ts'
import type {
  ActionDelayEvent,
  ApplyStatusEffect,
  BarrierEvent,
  BuffEndedEvent,
  ChainEffect,
  CombatActor,
  CombatHero,
  CombatState,
  DamageEffect,
  DamageResult,
  DamageSchool,
  FieldEffect,
  FieldEvent,
  GameDefs,
  HealEvent,
  HealResult,
  HpLossEvent,
  LoseHpEffect,
  SkillDef,
  SkillEffect,
  SummonEffect,
} from './types.ts'

export const SKILL_EFFECT_KINDS = [
  'damage',
  'heal',
  'barrier',
  'damageReduction',
  'evasion',
  'incomingDamage',
  'actionDelay',
  'resource',
  'chain',
  'applyStatus',
  'reveal',
  'armTrap',
  'field',
  'loseHp',
  'timedEvasion',
  'chanceGate',
  'summon',
  'defenseBonus',
] as const

/** Logged when a preventFatal health loss would leave 0 HP or less. */
export const FATAL_HP_LOSS_REASON = 'would be fatal'

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object, received ${describeValue(value)}`)
  }
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number, received ${describeValue(value)}`)
  }
}

function assertNonNegative(value: unknown, label: string): asserts value is number {
  assertFiniteNumber(value, label)
  if (value < 0) {
    throw new Error(`${label} must be at least 0, received ${describeValue(value)}`)
  }
}

function assertPositive(value: unknown, label: string): asserts value is number {
  assertFiniteNumber(value, label)
  if (value <= 0) {
    throw new Error(`${label} must be greater than 0, received ${describeValue(value)}`)
  }
}

function includesName<T extends string>(values: readonly T[], value: string): value is T {
  for (const entry of values) {
    if (entry === value) return true
  }
  return false
}

function roundSecondsToMs(seconds: number, label: string): number {
  assertFiniteNumber(seconds, label)
  if (seconds <= 0) {
    throw new Error(`${label} must be greater than 0, received ${describeValue(seconds)}`)
  }
  const ms = Math.round(seconds * 1000)
  if (ms < 1) {
    throw new Error(`${label} rounded to ${ms} ms and cannot be scheduled`)
  }
  return ms
}

function assertEffect(value: unknown, skillId: string): SkillEffect {
  assertObject(value, `skill '${skillId}' effect`)
  const kind = value.kind
  if (typeof kind !== 'string' || kind.length === 0) {
    throw new Error(`skill '${skillId}' is missing an effect kind`)
  }
  if (kind === 'damage') {
    const school = value.school
    if (school !== 'physical' && school !== 'magical') {
      throw new Error(
        `skill '${skillId}' damage school must be physical or magical, received ${describeValue(school)}`,
      )
    }
    assertPositive(value.coefficient, `skill '${skillId}' damage coefficient`)
    const effect: DamageEffect = {
      kind,
      school,
      coefficient: value.coefficient,
    }
    if (value.power !== undefined) {
      if (value.power !== 'physical' && value.power !== 'magical') {
        throw new Error(
          `skill '${skillId}' damage power must be physical or magical, received ${describeValue(value.power)}`,
        )
      }
      effect.power = value.power
    }
    if (value.armorPenetrationBonus !== undefined) {
      assertFiniteNumber(value.armorPenetrationBonus, `skill '${skillId}' Armor penetration`)
      if (value.armorPenetrationBonus < 0) {
        throw new Error(
          `skill '${skillId}' Armor penetration must be at least 0, received ${describeValue(value.armorPenetrationBonus)}`,
        )
      }
      effect.armorPenetrationBonus = value.armorPenetrationBonus
    }
    if (value.magicalPenetrationBonus !== undefined) {
      assertFiniteNumber(value.magicalPenetrationBonus, `skill '${skillId}' magical penetration`)
      if (value.magicalPenetrationBonus < 0) {
        throw new Error(
          `skill '${skillId}' magical penetration must be at least 0, received ${describeValue(value.magicalPenetrationBonus)}`,
        )
      }
      effect.magicalPenetrationBonus = value.magicalPenetrationBonus
    }
    return effect
  }
  if (kind === 'heal') {
    assertNonNegative(value.maxHpFraction, `skill '${skillId}' heal max HP fraction`)
    assertNonNegative(value.healingCoefficient, `skill '${skillId}' healing coefficient`)
    if (value.maxHpFraction === 0 && value.healingCoefficient === 0) {
      throw new Error(`skill '${skillId}' heal must restore health`)
    }
    const heal = {
      kind,
      maxHpFraction: value.maxHpFraction,
      healingCoefficient: value.healingCoefficient,
    } as const
    if (value.maxHpOf !== undefined && value.maxHpOf !== 'target' && value.maxHpOf !== 'anchor') {
      throw new Error(
        `skill '${skillId}' heal max HP must be target or anchor, received ${describeValue(value.maxHpOf)}`,
      )
    }
    return value.maxHpOf === undefined ? heal : { ...heal, maxHpOf: value.maxHpOf }
  }
  if (kind === 'barrier') {
    const source = value.source
    if (source !== 'magical' && source !== 'healing' && source !== 'anchorMaxHp') {
      throw new Error(
        `skill '${skillId}' barrier source must be magical, healing, or anchorMaxHp, received ${describeValue(source)}`,
      )
    }
    assertPositive(value.coefficient, `skill '${skillId}' barrier coefficient`)
    assertPositive(value.durationSeconds, `skill '${skillId}' barrier duration`)
    return { kind, source, coefficient: value.coefficient, durationSeconds: value.durationSeconds }
  }
  if (kind === 'damageReduction') {
    assertFiniteNumber(value.fraction, `skill '${skillId}' damage reduction`)
    if (value.fraction <= 0 || value.fraction > 1) {
      throw new Error(
        `skill '${skillId}' damage reduction must be greater than 0 and at most 1, received ${describeValue(value.fraction)}`,
      )
    }
    return { kind, fraction: value.fraction }
  }
  if (kind === 'evasion') {
    assertFiniteNumber(value.amount, `skill '${skillId}' Evasion`)
    if (value.amount === 0) {
      throw new Error(`skill '${skillId}' Evasion bonus must not be 0`)
    }
    return { kind, amount: value.amount }
  }
  if (kind === 'incomingDamage') {
    assertPositive(value.multiplier, `skill '${skillId}' incoming-damage multiplier`)
    return { kind, multiplier: value.multiplier }
  }
  if (kind === 'actionDelay') {
    assertPositive(value.delaySeconds, `skill '${skillId}' action delay`)
    return { kind, delaySeconds: value.delaySeconds }
  }
  if (kind === 'resource') {
    assertPositive(value.base, `skill '${skillId}' resource gain`)
    return { kind, base: value.base }
  }
  if (kind === 'chain') {
    const school = value.school
    if (school !== 'physical' && school !== 'magical') {
      throw new Error(
        `skill '${skillId}' chain school must be physical or magical, received ${describeValue(school)}`,
      )
    }
    assertPositive(value.coefficient, `skill '${skillId}' chain coefficient`)
    assertPositive(value.decay, `skill '${skillId}' chain decay`)
    if (typeof value.maxTargets !== 'number' || !Number.isInteger(value.maxTargets) || value.maxTargets < 1) {
      throw new Error(
        `skill '${skillId}' chain targets must be an integer of at least 1, received ${describeValue(value.maxTargets)}`,
      )
    }
    assertNonNegative(value.delaySeconds, `skill '${skillId}' chain delay`)
    const chain: ChainEffect = {
      kind,
      school,
      coefficient: value.coefficient,
      decay: value.decay,
      maxTargets: value.maxTargets,
      delaySeconds: value.delaySeconds,
    }
    if (value.followCoefficient !== undefined) {
      assertPositive(value.followCoefficient, `skill '${skillId}' chain follow coefficient`)
      chain.followCoefficient = value.followCoefficient
    }
    for (const field of ['firstStatus', 'followStatus'] as const) {
      const nested = value[field]
      if (nested === undefined) continue
      const checked = assertEffect(nested, skillId)
      if (checked.kind !== 'applyStatus') {
        throw new Error(`skill '${skillId}' chain ${field} must be a status effect`)
      }
      chain[field] = checked
    }
    return chain
  }
  if (kind === 'applyStatus') {
    const statusId = value.statusId
    if (typeof statusId !== 'string' || statusId.length === 0) {
      throw new Error(`skill '${skillId}' status effect is missing a status id`)
    }
    assertFiniteNumber(value.baseChance, `skill '${skillId}' status chance`)
    if (value.baseChance < 0 || value.baseChance > 1) {
      throw new Error(
        `skill '${skillId}' status chance must be from 0 through 1, received ${describeValue(value.baseChance)}`,
      )
    }
    const effect: ApplyStatusEffect = { kind, statusId, baseChance: value.baseChance }
    if (value.coefficient !== undefined) {
      assertPositive(value.coefficient, `skill '${skillId}' status coefficient`)
      effect.coefficient = value.coefficient
    }
    if (value.power !== undefined) {
      if (value.power !== 'physical' && value.power !== 'magical') {
        throw new Error(
          `skill '${skillId}' status power must be physical or magical, received ${describeValue(value.power)}`,
        )
      }
      effect.power = value.power
    }
    if (value.potency !== undefined) {
      assertNonNegative(value.potency, `skill '${skillId}' status potency`)
      effect.potency = value.potency
    }
    if (value.armorMagnitude !== undefined) {
      assertFiniteNumber(value.armorMagnitude, `skill '${skillId}' Armor Expose`)
      if (value.armorMagnitude <= 0 || value.armorMagnitude > 1) {
        throw new Error(
          `skill '${skillId}' Armor Expose must be greater than 0 and at most 1, received ${describeValue(value.armorMagnitude)}`,
        )
      }
      effect.armorMagnitude = value.armorMagnitude
    }
    if (value.resistanceMagnitude !== undefined) {
      assertFiniteNumber(value.resistanceMagnitude, `skill '${skillId}' Resistance Expose`)
      if (value.resistanceMagnitude <= 0 || value.resistanceMagnitude > 1) {
        throw new Error(
          `skill '${skillId}' Resistance Expose must be greater than 0 and at most 1, received ${describeValue(value.resistanceMagnitude)}`,
        )
      }
      effect.resistanceMagnitude = value.resistanceMagnitude
    }
    if (value.durationSeconds !== undefined) {
      assertPositive(value.durationSeconds, `skill '${skillId}' status duration`)
      effect.durationSeconds = value.durationSeconds
    }
    return effect
  }
  if (kind === 'reveal') return { kind }
  if (kind === 'field') {
    assertPositive(value.durationSeconds, `skill '${skillId}' field duration`)
    assertPositive(value.tickSeconds, `skill '${skillId}' field tick`)
    const school = value.damageSchool
    if (school !== 'physical' && school !== 'magical') {
      throw new Error(
        `skill '${skillId}' field school must be physical or magical, received ${describeValue(school)}`,
      )
    }
    assertPositive(value.damageCoefficient, `skill '${skillId}' field damage coefficient`)
    assertPositive(value.healCoefficient, `skill '${skillId}' field heal coefficient`)
    const effect: FieldEffect = {
      kind,
      durationSeconds: value.durationSeconds,
      tickSeconds: value.tickSeconds,
      damageSchool: school,
      damageCoefficient: value.damageCoefficient,
      healCoefficient: value.healCoefficient,
    }
    return effect
  }
  if (kind === 'loseHp') {
    assertPositive(value.maxHpFraction, `skill '${skillId}' health loss`)
    if (value.maxHpFraction > 1) {
      throw new Error(
        `skill '${skillId}' health loss must be at most 1, received ${describeValue(value.maxHpFraction)}`,
      )
    }
    if (typeof value.preventFatal !== 'boolean') {
      throw new Error(
        `skill '${skillId}' health loss preventFatal must be a boolean, received ${describeValue(value.preventFatal)}`,
      )
    }
    const effect: LoseHpEffect = {
      kind,
      maxHpFraction: value.maxHpFraction,
      preventFatal: value.preventFatal,
    }
    return effect
  }
  if (kind === 'armTrap') {
    assertFiniteNumber(value.baseChance, `skill '${skillId}' trap chance`)
    if (value.baseChance < 0 || value.baseChance > 1) {
      throw new Error(
        `skill '${skillId}' trap chance must be from 0 through 1, received ${describeValue(value.baseChance)}`,
      )
    }
    return { kind, baseChance: value.baseChance }
  }
  if (kind === 'timedEvasion') {
    assertFiniteNumber(value.amount, `skill '${skillId}' timed Evasion`)
    if (value.amount === 0) {
      throw new Error(`skill '${skillId}' timed Evasion must not be 0`)
    }
    assertPositive(value.durationSeconds, `skill '${skillId}' timed Evasion duration`)
    return { kind, amount: value.amount, durationSeconds: value.durationSeconds }
  }
  if (kind === 'chanceGate') {
    assertFiniteNumber(value.baseChance, `skill '${skillId}' chance`)
    if (value.baseChance < 0 || value.baseChance > 1) {
      throw new Error(
        `skill '${skillId}' chance must be from 0 through 1, received ${describeValue(value.baseChance)}`,
      )
    }
    const school = value.school
    if (school !== 'physical' && school !== 'magical') {
      throw new Error(
        `skill '${skillId}' chance school must be physical or magical, received ${describeValue(school)}`,
      )
    }
    if (!Array.isArray(value.effects) || value.effects.length === 0) {
      throw new Error(`skill '${skillId}' chance gate has no effects`)
    }
    const effects: SkillEffect[] = []
    for (const nested of value.effects) {
      const checked = assertEffect(nested, skillId)
      if (checked.kind !== 'actionDelay' && checked.kind !== 'timedEvasion') {
        throw new Error(`skill '${skillId}' chance gate can only delay an action or change Evasion`)
      }
      effects.push(checked)
    }
    return { kind, baseChance: value.baseChance, school, effects }
  }
  if (kind === 'summon') {
    const enemyId = value.enemyId
    if (typeof enemyId !== 'string' || enemyId.length === 0) {
      throw new Error(`skill '${skillId}' summon is missing an enemy id`)
    }
    if (typeof value.level !== 'number' || !Number.isInteger(value.level) || value.level < 1) {
      throw new Error(
        `skill '${skillId}' summon level must be a positive integer, received ${describeValue(value.level)}`,
      )
    }
    const effect: SummonEffect = { kind, enemyId, level: value.level }
    if (value.fromSummoner !== undefined) {
      assertObject(value.fromSummoner, `skill '${skillId}' summon stats`)
      const stats = value.fromSummoner
      assertPositive(stats.hpFraction, `skill '${skillId}' summon HP fraction`)
      assertPositive(stats.armorFraction, `skill '${skillId}' summon Armor fraction`)
      assertPositive(stats.resistanceFraction, `skill '${skillId}' summon Resistance fraction`)
      assertPositive(stats.powerFraction, `skill '${skillId}' summon Power fraction`)
      assertPositive(stats.actionTime, `skill '${skillId}' summon action time`)
      effect.fromSummoner = {
        hpFraction: stats.hpFraction,
        armorFraction: stats.armorFraction,
        resistanceFraction: stats.resistanceFraction,
        powerFraction: stats.powerFraction,
        actionTime: stats.actionTime,
      }
    }
    if (value.anchorMaxHp !== undefined) {
      if (typeof value.anchorMaxHp !== 'boolean') {
        throw new Error(
          `skill '${skillId}' summon anchor must be a boolean, received ${describeValue(value.anchorMaxHp)}`,
        )
      }
      effect.anchorMaxHp = value.anchorMaxHp
    }
    return effect
  }
  if (kind === 'defenseBonus') {
    assertPositive(value.multiplier, `skill '${skillId}' defense bonus`)
    if (value.multiplier === 1) throw new Error(`skill '${skillId}' defense bonus must change Armor and Resistance`)
    assertPositive(value.durationSeconds, `skill '${skillId}' defense bonus duration`)
    return { kind, multiplier: value.multiplier, durationSeconds: value.durationSeconds }
  }
  throw new Error(`skill '${skillId}' has unknown effect kind '${kind}'`)
}

/** Reject a skill whose id, cost, timing, equipment, target, or effects are unusable. */
export function assertSkillDef(value: unknown): asserts value is SkillDef {
  assertObject(value, 'skill')
  const id = value.id
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('skill is missing an id')
  }
  if (typeof value.name !== 'string' || value.name.length === 0) {
    throw new Error(`skill '${id}' is missing a name`)
  }
  assertNonNegative(value.cost, `skill '${id}' cost`)
  assertNonNegative(value.cooldownSeconds, `skill '${id}' cooldown`)
  assertPositive(value.actionTimeCoefficient, `skill '${id}' action-time coefficient`)
  if (!Array.isArray(value.tags)) {
    throw new Error(`skill '${id}' tags must be a list`)
  }
  for (let index = 0; index < value.tags.length; index += 1) {
    const tag = value.tags[index]
    if (typeof tag !== 'string' || tag.length === 0) {
      throw new Error(`skill '${id}' tag ${index + 1} must be a non-empty string`)
    }
  }
  if (value.requires !== undefined) {
    assertObject(value.requires, `skill '${id}' equipment requirement`)
    const mainHand = value.requires.mainHand
    const offHand = value.requires.offHand
    if (mainHand === undefined && offHand === undefined) {
      throw new Error(`skill '${id}' equipment requirement is empty`)
    }
    if (mainHand !== undefined && !includesName(Object.keys(WEAPON_POWER_FACTOR), String(mainHand))) {
      throw new Error(`skill '${id}' requires unknown weapon '${describeValue(mainHand)}'`)
    }
    if (offHand !== undefined && !includesName(OFF_HAND_KINDS, String(offHand))) {
      throw new Error(`skill '${id}' requires unknown off-hand '${describeValue(offHand)}'`)
    }
  }
  if (value.target !== 'single' && value.target !== 'all') {
    throw new Error(
      `skill '${id}' target must be single or all, received ${describeValue(value.target)}`,
    )
  }
  if (!Array.isArray(value.effects) || value.effects.length === 0) {
    throw new Error(`skill '${id}' has no effects`)
  }
  for (const effect of value.effects) assertEffect(effect, id)
  if (value.ammoCost !== undefined) {
    if (typeof value.ammoCost !== 'number' || !Number.isInteger(value.ammoCost) || value.ammoCost < 0) {
      throw new Error(`skill '${id}' ammo cost must be a whole number of at least 0, received ${describeValue(value.ammoCost)}`)
    }
  }
  if (value.supplyCost !== undefined) {
    if (typeof value.supplyCost !== 'number' || !Number.isInteger(value.supplyCost) || value.supplyCost < 0) {
      throw new Error(`skill '${id}' supply cost must be a whole number of at least 0, received ${describeValue(value.supplyCost)}`)
    }
  }
}

export function assertSkillBook(skills: unknown): void {
  if (typeof skills !== 'object' || skills === null || Array.isArray(skills)) {
    throw new Error('skill definitions must be an object')
  }
  for (const [id, skill] of Object.entries(skills)) {
    assertSkillDef(skill)
    if (skill.id !== id) throw new Error(`skill entry '${id}' has id '${skill.id}'`)
  }
}

/**
 * `base × (1 − cooldown reduction)`, with reduction capped at 50%.
 * A value above the cap still schedules at half the base cooldown.
 */
export function finalCooldownSeconds(baseSeconds: number, cooldownReduction: number): number {
  assertNonNegative(baseSeconds, 'base cooldown')
  assertFiniteNumber(cooldownReduction, 'cooldown reduction')
  if (cooldownReduction < 0) {
    throw new Error(
      `cooldown reduction must be at least 0, received ${describeValue(cooldownReduction)}`,
    )
  }
  const reduction = cooldownReduction > COOLDOWN_REDUCTION_CAP ? COOLDOWN_REDUCTION_CAP : cooldownReduction
  return baseSeconds * (1 - reduction)
}

export function skillEquipped(hero: CombatHero, skillId: string): boolean {
  return hero.equippedSkillIds.includes(skillId) || convergenceSlotSkill(hero, skillId) || releaseSlotSkill(hero, skillId)
}

/** Mage or Cleric reason a skill cannot be used yet. Null for every other hero. */
export function classSkillBlock(hero: CombatHero, skill: SkillDef, timeMs: number): string | null {
  return mageSkillBlock(hero, skill) ?? clericSkillBlock(hero, skill, timeMs)
}

/** A positive cost is paid from the hero's live class meter. */
export function skillAffordable(hero: CombatHero, skill: SkillDef): boolean {
  if (hero.classId === 'mage') return mageAffordable(hero, skill)
  if (hero.classId === 'cleric') return clericAffordable(hero, skill)
  return resolvedSkillCost(hero, skill) <= hero.classResource
}

/** Cooldowns are ready when simulated time has reached the stored instant. */
export function skillOffCooldown(hero: CombatHero, skill: SkillDef, timeMs: number): boolean {
  const readyAt = hero.cooldowns[skill.id]
  if (readyAt === undefined) return true
  return timeMs >= readyAt
}

/** Returns the first missing requirement, or null when the hero's gear can use the skill. */
export function equipmentBlock(hero: CombatHero, skill: SkillDef): string | null {
  const requires = skill.requires
  if (requires === undefined) return null
  if (requires.mainHand !== undefined && hero.mainHandKind !== requires.mainHand) {
    return `requires ${requires.mainHand}`
  }
  if (requires.offHand !== undefined && hero.offHandKind !== requires.offHand) {
    return `requires ${requires.offHand}`
  }
  return null
}

/** Null when the skill can be used. `would be fatal` spends nothing and does not start the cooldown. */
export function fatalHpLossBlock(hero: CombatHero, skill: SkillDef): string | null {
  for (const effect of skill.effects) {
    if (effect.kind !== 'loseHp' || !effect.preventFatal) continue
    if (hero.hp - effect.maxHpFraction * hero.maxHp <= 0) return FATAL_HP_LOSS_REASON
  }
  return null
}

export function skillNeedsEnemy(skill: SkillDef): boolean {
  for (const effect of skill.effects) {
    if (
      effect.kind === 'damage' ||
      effect.kind === 'actionDelay' ||
      effect.kind === 'applyStatus' ||
      effect.kind === 'chain' ||
      effect.kind === 'reveal' ||
      effect.kind === 'armTrap' ||
      effect.kind === 'field'
    ) {
      return true
    }
  }
  return false
}

export function effectiveEvasion(
  actor: {
    evasion: number
    evasionBonus: number
    timedEvasion?: number
    timedEvasionExpiresMs?: number
  },
  timeMs?: number,
): number {
  let evasion = actor.evasion + actor.evasionBonus
  const extra = actor.timedEvasion ?? 0
  const expiresMs = actor.timedEvasionExpiresMs ?? 0
  if (timeMs !== undefined && extra !== 0 && expiresMs > timeMs) evasion += extra
  return evasion
}

export function activeBarrier(actor: { barrier: number; barrierExpiresMs: number }, timeMs: number): number {
  if (actor.barrier <= 0) return 0
  if (actor.barrierExpiresMs <= timeMs) return 0
  return actor.barrier
}

/** Incoming-damage multipliers multiply. Damage reduction contributes `(1 − fraction)`. */
export function incomingDamageFactor(actor: {
  incomingMultipliers: readonly number[]
  damageReduction: number
}): number {
  let factor = 1
  for (const multiplier of actor.incomingMultipliers) factor *= multiplier
  if (actor.damageReduction > 0) factor *= 1 - actor.damageReduction
  return factor
}

export type HealInput = {
  maxHp: number
  maxHpFraction: number
  healingPower: number
  healingCoefficient: number
  outgoingModifier: number
  healingReceived: number
  roll: number
  /** Logged floor. Omitted uses the healing floor constant. */
  rollFloor?: number
}

/**
 * Direct healing: raw output, outgoing modifiers, centered roll, healing received, then round.
 * The roll is supplied by the caller. Combat draws it from [0.90, 1.00).
 */
export function resolveHeal(input: HealInput): HealResult {
  assertNonNegative(input.maxHp, 'max HP')
  assertNonNegative(input.maxHpFraction, 'heal max HP fraction')
  assertNonNegative(input.healingPower, 'healing power')
  assertNonNegative(input.healingCoefficient, 'healing coefficient')
  assertNonNegative(input.outgoingModifier, 'outgoing healing modifier')
  assertNonNegative(input.healingReceived, 'healing received')
  assertFiniteNumber(input.roll, 'healing roll')
  if (input.roll < 0 || input.roll > 1) {
    throw new Error(`healing roll must be from 0 through 1, received ${describeValue(input.roll)}`)
  }
  const raw = input.maxHp * input.maxHpFraction + input.healingPower * input.healingCoefficient
  const afterOutgoing = raw * input.outgoingModifier
  const afterRoll = afterOutgoing * input.roll
  const afterReceived = afterRoll * input.healingReceived
  let amount = Math.round(afterReceived)
  if (amount < 0) amount = 0
  if (input.rollFloor !== undefined && (typeof input.rollFloor !== 'number' || !Number.isFinite(input.rollFloor))) {
    throw new Error(`healing roll floor must be a finite number, received ${describeValue(input.rollFloor)}`)
  }
  const rollFloor = input.rollFloor === undefined ? HEALING_ROLL_FLOOR : input.rollFloor
  return {
    maxHpFraction: input.maxHpFraction,
    healingCoefficient: input.healingCoefficient,
    healingPower: input.healingPower,
    outgoingModifier: input.outgoingModifier,
    raw,
    afterOutgoing,
    roll: input.roll,
    rollFloor,
    rollCeiling: HEALING_ROLL_CEILING,
    afterRoll,
    healingReceived: input.healingReceived,
    afterReceived,
    amount,
  }
}

function powerFor(hero: CombatHero, school: DamageSchool): number {
  return school === 'physical' ? hero.physicalPower : hero.magicalPower
}

function penetrationFor(hero: CombatHero, school: DamageSchool): number {
  return school === 'physical' ? hero.armorPenetration : hero.magicalPenetration
}

function defenseOf(target: CombatActor, school: DamageSchool, timeMs: number): number {
  return exposedDefense(target, school, timeMs)
}

function keptIncoming(actor: CombatActor): number | null {
  if (actor.side !== 'hero') return null
  return heroKeptIncoming(actor as CombatHero)
}

function temporaryIncoming(actor: CombatActor, kept: number | null): number[] {
  if (kept === null) return actor.incomingMultipliers
  const temporary: number[] = []
  let skipped = false
  for (const multiplier of actor.incomingMultipliers) {
    if (!skipped && multiplier === kept) {
      skipped = true
      continue
    }
    temporary.push(multiplier)
  }
  return temporary
}

export function endUntilNextAction(state: CombatState, actor: CombatActor, timeMs: number): void {
  const granted = actor.damageReductionSourceId !== null && actor.damageReductionSourceId !== actor.id
  const ownReduction = granted ? 0 : actor.damageReduction
  const kept = keptIncoming(actor)
  const temporary = temporaryIncoming(actor, kept)
  const active = ownReduction > 0 || actor.evasionBonus !== 0 || temporary.length > 0
  if (!active) return
  const incomingMultiplier = incomingDamageFactor({
    incomingMultipliers: temporary,
    damageReduction: 0,
  })
  const event: BuffEndedEvent = {
    type: 'buffEnded',
    timeMs,
    actorId: actor.id,
    actorName: actor.name,
    damageReduction: ownReduction,
    evasion: actor.evasionBonus,
    incomingMultiplier,
  }
  if (!granted) {
    actor.damageReduction = 0
    actor.damageReductionSourceId = null
  }
  actor.evasionBonus = 0
  actor.incomingMultipliers = kept === null ? [] : [kept]
  state.log.push(event)
}

/** End damage reduction this actor granted to someone else. */
export function endGrantedReductions(state: CombatState, source: CombatActor, timeMs: number): void {
  const actors: CombatActor[] = [state.hero, ...state.enemies]
  for (const actor of actors) {
    if (actor.id === source.id || actor.damageReductionSourceId !== source.id) continue
    const reduction = actor.damageReduction
    actor.damageReduction = 0
    actor.damageReductionSourceId = null
    if (reduction <= 0) continue
    state.log.push({
      type: 'buffEnded',
      timeMs,
      actorId: actor.id,
      actorName: actor.name,
      damageReduction: reduction,
      evasion: 0,
      incomingMultiplier: 1,
      reason: 'granted',
    })
  }
}

function chainTargets(state: CombatState, primary: CombatActor, maxTargets: number): CombatActor[] {
  const ordered: CombatActor[] = []
  if (primary.alive && primary.side === 'enemy') ordered.push(primary)
  const rest = state.enemies.filter((enemy) => enemy.alive && enemy.id !== primary.id)
  rest.sort((left, right) => left.slot - right.slot)
  for (const enemy of rest) {
    if (ordered.length >= maxTargets) break
    ordered.push(enemy)
  }
  return ordered
}

function cappedPenetration(base: number, bonus: number): number {
  const total = base + bonus
  if (total > PENETRATION_CAP) return PENETRATION_CAP
  if (total < 0) return 0
  return total
}

function strike(
  state: CombatState,
  hero: CombatHero,
  target: CombatActor,
  school: DamageSchool,
  powerSchool: DamageSchool,
  coefficient: number,
  armorPenetrationBonus: number,
  outgoingModifier: number,
  scheduledMs: number,
  magicalPenetrationBonus = 0,
): DamageResult {
  const bounds = consistencyBounds(hero.consistency)
  const floorBonus = heroDamageRollFloorBonus(hero)
  const floor = raisedFloor(bounds.floor, bounds.ceiling, floorBonus)
  const consistencyRoll = centeredRoll(state.rng, floor, bounds.ceiling)
  const critRoll = nextFloat(state.rng)
  const finalDamageMultiplier = heroFinalDamageMultiplier(hero)
  const penetration =
    school === 'physical'
      ? cappedPenetration(penetrationFor(hero, 'physical'), armorPenetrationBonus)
      : cappedPenetration(penetrationFor(hero, 'magical'), magicalPenetrationBonus)
  const usedCoefficient = hero.pendingCoefficient === null ? coefficient : hero.pendingCoefficient
  return resolveDamage({
    accuracy: hero.accuracy,
    evasion: effectiveEvasion(target, scheduledMs),
    power: powerFor(hero, powerSchool),
    coefficient: usedCoefficient,
    outgoingModifier,
    consistency: hero.consistency,
    critChance: hero.critChance,
    critDamage: hero.critDamage,
    barrier: activeBarrier(target, scheduledMs),
    penetration,
    defense: defenseOf(target, school, scheduledMs),
    attackerLevel: hero.level,
    incomingModifier: incomingDamageFactor(target),
    school,
    guaranteedHit: true,
    ...(floor !== bounds.floor ? { damageFloor: floor } : {}),
    ...(finalDamageMultiplier !== 1 ? { finalDamageMultiplier } : {}),
    rolls: { hitRoll: 0, consistencyRoll, critRoll },
  })
}

export function applySkillEffects(
  state: CombatState,
  defs: GameDefs,
  hero: CombatHero,
  skill: SkillDef,
  targets: readonly CombatActor[],
  scheduledMs: number,
  outgoingFor: (school: DamageSchool) => number,
  applyDamage: (target: CombatActor, result: DamageResult) => void,
): void {
  const hpDamageDealt: { [targetId: string]: number } = {}
  for (const effect of skill.effects) {
    if (effect.kind === 'damage') {
      for (const target of targets) {
        if (!target.alive) continue
        const result = applyFatalExecute(
          hero,
          target,
          skill,
          strike(
            state,
            hero,
            target,
            effect.school,
            effect.power ?? effect.school,
            effect.coefficient,
            effect.armorPenetrationBonus ?? 0,
            outgoingFor(effect.school) * markedDirectFactor(hero, target),
            scheduledMs,
            (effect.magicalPenetrationBonus ?? 0) + righteousPenetration(hero, skill),
          ),
        )
        applyDamage(target, result)
        hpDamageDealt[target.id] = (hpDamageDealt[target.id] ?? 0) + result.hpDamage
      }
      continue
    }
    if (effect.kind === 'heal') {
      const healBonus = heroHealRollFloorBonus(hero)
      const healFloor = raisedFloor(HEALING_ROLL_FLOOR, HEALING_ROLL_CEILING, healBonus)
      const roll = centeredRoll(state.rng, healFloor, HEALING_ROLL_CEILING)
      const raceHeal = raceOutgoingModifier(state, 'healing', skill)
      const result = resolveHeal({
        maxHp: hero.maxHp,
        maxHpFraction: effect.maxHpFraction,
        healingPower: hero.healingPower,
        healingCoefficient: healCoefficient(hero, skill, effect.healingCoefficient),
        outgoingModifier: raceHeal === null ? 1 : raceHeal,
        healingReceived: adjustedHealingReceived(hero),
        roll,
        ...(healFloor !== HEALING_ROLL_FLOOR ? { rollFloor: healFloor } : {}),
      })
      const targetHpBefore = hero.hp
      const missing = hero.maxHp - targetHpBefore
      if (result.amount > missing) hero.overhealed = true
      let targetHpAfter = targetHpBefore + result.amount
      if (targetHpAfter > hero.maxHp) targetHpAfter = hero.maxHp
      hero.hp = targetHpAfter
      const event: HealEvent = {
        type: 'heal',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        targetId: hero.id,
        targetName: hero.name,
        targetHpBefore,
        targetHpAfter,
        ...result,
      }
      state.log.push(event)
      continue
    }
    if (effect.kind === 'barrier') {
      const power = effect.source === 'magical' ? hero.magicalPower : hero.healingPower
      const amount = power * effect.coefficient * barrierFactor(hero, skill)
      const expiresMs = scheduledMs + roundSecondsToMs(effect.durationSeconds, `${skill.id} barrier`)
      const replaced = hero.barrier
      hero.barrier = amount
      hero.barrierExpiresMs = expiresMs
      const event: BarrierEvent = {
        type: 'barrier',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        sourceId: hero.id,
        sourceName: hero.name,
        amount,
        expiresMs,
        replaced,
      }
      state.log.push(event)
      continue
    }
    if (effect.kind === 'damageReduction') {
      hero.damageReduction = effect.fraction
      state.log.push({
        type: 'buff',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        kind: 'damageReduction',
        value: effect.fraction,
        until: 'nextAction',
      })
      continue
    }
    if (effect.kind === 'evasion') {
      const amount = adjustedEvasionAmount(hero, skill, effect.amount)
      hero.evasionBonus = amount
      state.log.push({
        type: 'buff',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        kind: 'evasion',
        value: amount,
        until: 'nextAction',
      })
      continue
    }
    if (effect.kind === 'incomingDamage') {
      hero.incomingMultipliers.push(effect.multiplier)
      state.log.push({
        type: 'buff',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        kind: 'incomingDamage',
        value: effect.multiplier,
        until: 'nextAction',
      })
      continue
    }
    if (effect.kind === 'applyStatus') {
      for (const target of targets) {
        if (!target.alive) continue
        const dealt = hpDamageDealt[target.id]
        tryApplyStatus({
          state,
          defs,
          source: hero,
          target,
          skill,
          effect,
          timeMs: scheduledMs,
          applyingHit: dealt !== undefined,
          hpDamageDealt: dealt ?? 0,
        })
      }
      continue
    }
    if (effect.kind === 'actionDelay') {
      const delayMs = roundSecondsToMs(effect.delaySeconds, `${skill.id} action delay`)
      for (const target of targets) {
        if (!target.alive) continue
        pushActorTiming(target, delayMs)
        const event: ActionDelayEvent = {
          type: 'actionDelay',
          timeMs: scheduledMs,
          actorId: hero.id,
          actorName: hero.name,
          targetId: target.id,
          targetName: target.name,
          delayMs,
          nextReadyMs: target.nextReadyMs,
        }
        state.log.push(event)
      }
      continue
    }
    if (effect.kind === 'resource') {
      const base = penanceResourceBase(hero, skill, recoveryResourceBase(hero, skill, effect.base))
      if (base > 0) grantClassResource(state, scheduledMs, base, skill.id)
      continue
    }
    if (effect.kind === 'reveal') {
      for (const target of targets) {
        if (!target.alive) continue
        target.revealed = true
        state.log.push({
          type: 'reveal',
          timeMs: scheduledMs,
          actorId: hero.id,
          actorName: hero.name,
          targetId: target.id,
          targetName: target.name,
        })
      }
      continue
    }
    if (effect.kind === 'armTrap') {
      const target = targets[0]
      if (target === undefined || !target.alive) continue
      let replacedId: string | null = null
      let replacedName: string | null = null
      const actors: CombatActor[] = [state.hero, ...state.enemies]
      for (const actor of actors) {
        if (actor.armedTrap === null) continue
        replacedId = actor.id
        replacedName = actor.name
        actor.armedTrap = null
      }
      target.armedTrap = {
        baseChance: effect.baseChance,
        skillId: skill.id,
        sourceId: hero.id,
      }
      state.log.push({
        type: 'trap',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        targetId: target.id,
        targetName: target.name,
        replacedId,
        replacedName,
      })
      continue
    }
    if (effect.kind === 'chain') {
      const primary = targets[0]
      if (primary === undefined) throw new Error(`${skill.name} chain resolved without a target`)
      const jumped = chainTargets(state, primary, effect.maxTargets)
      let coefficient = effect.coefficient
      const decay = chainDecay(hero, skill, effect.decay)
      let first = true
      for (const target of jumped) {
        if (!target.alive || state.outcome !== 'ongoing') continue
        const result = applyFatalExecute(
          hero,
          target,
          skill,
          strike(
            state,
            hero,
            target,
            effect.school,
            effect.school,
            coefficient,
            0,
            outgoingFor(effect.school) * markedDirectFactor(hero, target),
            scheduledMs,
          ),
        )
        applyDamage(target, result)
        hpDamageDealt[target.id] = (hpDamageDealt[target.id] ?? 0) + result.hpDamage
        const followStatus = first ? effect.firstStatus : effect.followStatus
        if (followStatus !== undefined && target.alive) {
          const dealt = hpDamageDealt[target.id]
          tryApplyStatus({
            state,
            defs,
            source: hero,
            target,
            skill,
            effect: followStatus,
            timeMs: scheduledMs,
            applyingHit: dealt !== undefined,
            hpDamageDealt: dealt ?? 0,
          })
        }
        if (target.alive && effect.delaySeconds > 0) {
          const delayMs = roundSecondsToMs(effect.delaySeconds, `${skill.id} chain delay`)
          pushActorTiming(target, delayMs)
          const event: ActionDelayEvent = {
            type: 'actionDelay',
            timeMs: scheduledMs,
            actorId: hero.id,
            actorName: hero.name,
            targetId: target.id,
            targetName: target.name,
            delayMs,
            nextReadyMs: target.nextReadyMs,
          }
          state.log.push(event)
        }
        if (effect.followCoefficient !== undefined) coefficient = effect.followCoefficient
        else coefficient *= decay
        first = false
      }
      continue
    }
    if (effect.kind === 'field') {
      const durationMs = roundSecondsToMs(effect.durationSeconds, `${skill.id} field duration`)
      const tickMs = roundSecondsToMs(effect.tickSeconds, `${skill.id} field tick`)
      const replaced = hero.field !== null
      const power = effect.damageSchool === 'physical' ? hero.physicalPower : hero.magicalPower
      const penetration = effect.damageSchool === 'physical' ? hero.armorPenetration : hero.magicalPenetration
      const field = {
        skillId: skill.id,
        sourceId: hero.id,
        sourceName: hero.name,
        expiresMs: scheduledMs + durationMs,
        tickMs,
        nextTickMs: scheduledMs + tickMs,
        damageSchool: effect.damageSchool,
        damageCoefficient: effect.damageCoefficient,
        healCoefficient: effect.healCoefficient,
        power,
        penetration,
        healingPower: hero.healingPower,
        attackerLevel: hero.level,
      }
      hero.field = field
      const event: FieldEvent = {
        type: 'field',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        skillId: skill.id,
        expiresMs: field.expiresMs,
        nextTickMs: field.nextTickMs,
        replaced,
        power,
        healingPower: hero.healingPower,
        damageCoefficient: effect.damageCoefficient,
        healCoefficient: effect.healCoefficient,
      }
      state.log.push(event)
      continue
    }
    if (
      effect.kind === 'chanceGate' ||
      effect.kind === 'timedEvasion' ||
      effect.kind === 'summon' ||
      effect.kind === 'defenseBonus'
    ) {
      throw new Error(`skill '${skill.id}' effect '${effect.kind}' is resolved by enemy actions`)
    }
    if (effect.kind === 'loseHp') {
      const loss = hero.maxHp * effect.maxHpFraction
      if (effect.preventFatal && hero.hp - loss <= 0) {
        throw new Error(`${skill.name} would be fatal`)
      }
      const hpBefore = hero.hp
      const hpAfter = hpBefore - loss
      hero.hp = hpAfter
      const event: HpLossEvent = {
        type: 'hpLoss',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        skillId: skill.id,
        amount: loss,
        hpBefore,
        hpAfter,
        barrierBypassed: true,
        defenseBypassed: true,
      }
      state.log.push(event)
      continue
    }
    const unexpected: never = effect
    throw new Error(`skill '${skill.id}' has unknown effect kind '${(unexpected as { kind?: string }).kind ?? ''}'`)
  }
}
