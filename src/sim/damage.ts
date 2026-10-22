import {
  CONSISTENCY_MAX,
  CONSISTENCY_MIN,
  DAMAGE_FLOOR_BASE_POINTS,
  DAMAGE_FLOOR_POINTS_PER_CONSISTENCY,
  DAMAGE_ROLL_CEILING,
  HIT_CHANCE_BASE_POINTS,
  HIT_CHANCE_MAX_POINTS,
  HIT_CHANCE_MIN_POINTS,
  MIN_UNSHIELDED_DAMAGE,
} from './constants.ts'
import { defenseReduction } from './stats.ts'
import type { DamageInput, DamageResult, DamageSchool } from './types.ts'

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
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

function assertUnitInterval(value: unknown, label: string): asserts value is number {
  assertFiniteNumber(value, label)
  if (value < 0 || value > 1) {
    throw new Error(`${label} must be from 0 through 1, received ${describeValue(value)}`)
  }
}

function assertSchool(value: unknown): asserts value is DamageSchool {
  if (value !== 'physical' && value !== 'magical') {
    throw new Error(`damage school must be physical or magical, received ${describeValue(value)}`)
  }
}

/**
 * `clamp(5%, 95%, 75% + Accuracy − Evasion)`.
 * One Accuracy or Evasion point is one percentage point.
 */
export function basicHitChance(accuracy: number, evasion: number): number {
  assertFiniteNumber(accuracy, 'accuracy')
  assertFiniteNumber(evasion, 'evasion')
  const points = HIT_CHANCE_BASE_POINTS + accuracy - evasion
  const clamped =
    points < HIT_CHANCE_MIN_POINTS
      ? HIT_CHANCE_MIN_POINTS
      : points > HIT_CHANCE_MAX_POINTS
        ? HIT_CHANCE_MAX_POINTS
        : points
  return clamped / 100
}

/** Damage roll range for a Consistency rating. Ceiling stays at 100%. */
export function consistencyBounds(consistency: number): { floor: number; ceiling: number } {
  assertFiniteNumber(consistency, 'consistency')
  let rating = consistency
  if (rating < CONSISTENCY_MIN) rating = CONSISTENCY_MIN
  if (rating > CONSISTENCY_MAX) rating = CONSISTENCY_MAX
  const floorPoints = DAMAGE_FLOOR_BASE_POINTS + DAMAGE_FLOOR_POINTS_PER_CONSISTENCY * rating
  return { floor: floorPoints / 100, ceiling: DAMAGE_ROLL_CEILING }
}

function missedResult(input: DamageInput, hitChance: number, bounds: { floor: number; ceiling: number }): DamageResult {
  return {
    hitChance,
    hit: false,
    crit: false,
    school: input.school,
    power: input.power,
    coefficient: input.coefficient,
    outgoingModifier: input.outgoingModifier,
    consistency: input.consistency,
    damageFloor: bounds.floor,
    damageCeiling: bounds.ceiling,
    consistencyRoll: input.rolls.consistencyRoll,
    critChance: input.critChance,
    critRoll: input.rolls.critRoll,
    critDamage: input.critDamage,
    barrier: input.barrier,
    barrierAbsorbed: 0,
    overflow: 0,
    penetration: input.penetration,
    defense: input.defense,
    attackerLevel: input.attackerLevel,
    reduction: 0,
    incomingModifier: input.incomingModifier,
    raw: 0,
    afterOutgoing: 0,
    afterConsistency: 0,
    afterCrit: 0,
    afterDefense: 0,
    afterIncoming: 0,
    hpDamage: 0,
  }
}

/**
 * Final pre-mitigation pipeline. Rolls are arguments, so tests can fix them.
 * A miss deals no damage and does not crit.
 * An unshielded hit deals at least 1 HP after rounding. A barrier may reduce that to 0.
 */
export function resolveDamage(input: DamageInput): DamageResult {
  if (typeof input !== 'object' || input === null) {
    throw new Error(`damage input must be an object, received ${describeValue(input)}`)
  }
  assertFiniteNumber(input.accuracy, 'accuracy')
  assertFiniteNumber(input.evasion, 'evasion')
  assertNonNegative(input.power, 'power')
  assertNonNegative(input.coefficient, 'coefficient')
  assertNonNegative(input.outgoingModifier, 'outgoing modifier')
  assertFiniteNumber(input.consistency, 'consistency')
  assertUnitInterval(input.critChance, 'crit chance')
  assertNonNegative(input.critDamage, 'crit damage')
  assertNonNegative(input.barrier, 'barrier')
  assertNonNegative(input.penetration, 'penetration')
  assertNonNegative(input.defense, 'defense')
  assertNonNegative(input.incomingModifier, 'incoming modifier')
  assertSchool(input.school)
  if (typeof input.rolls !== 'object' || input.rolls === null) {
    throw new Error(`damage rolls must be an object, received ${describeValue(input.rolls)}`)
  }
  assertUnitInterval(input.rolls.hitRoll, 'hit roll')
  assertUnitInterval(input.rolls.consistencyRoll, 'consistency roll')
  assertUnitInterval(input.rolls.critRoll, 'crit roll')

  const guaranteed = input.guaranteedHit === true
  const hitChance = guaranteed ? 1 : basicHitChance(input.accuracy, input.evasion)
  const bounds = consistencyBounds(input.consistency)
  const hit = guaranteed || input.rolls.hitRoll < hitChance
  if (!hit) return missedResult(input, hitChance, bounds)

  const raw = input.power * input.coefficient
  const afterOutgoing = raw * input.outgoingModifier
  const afterConsistency = afterOutgoing * input.rolls.consistencyRoll
  const crit = input.rolls.critRoll < input.critChance
  const afterCrit = afterConsistency * (crit ? input.critDamage : 1)
  const barrierAbsorbed = Math.min(input.barrier, afterCrit)
  const overflow = afterCrit - barrierAbsorbed
  const reduction = defenseReduction(input.defense, input.penetration, input.attackerLevel)
  const afterDefense = overflow * (1 - reduction)
  const afterIncoming = afterDefense * input.incomingModifier
  let hpDamage = Math.round(afterIncoming)
  const shielded = input.barrier > 0
  if (!shielded && hpDamage < MIN_UNSHIELDED_DAMAGE) hpDamage = MIN_UNSHIELDED_DAMAGE
  if (hpDamage < 0) hpDamage = 0

  return {
    hitChance,
    hit: true,
    crit,
    school: input.school,
    power: input.power,
    coefficient: input.coefficient,
    outgoingModifier: input.outgoingModifier,
    consistency: input.consistency,
    damageFloor: bounds.floor,
    damageCeiling: bounds.ceiling,
    consistencyRoll: input.rolls.consistencyRoll,
    critChance: input.critChance,
    critRoll: input.rolls.critRoll,
    critDamage: input.critDamage,
    barrier: input.barrier,
    barrierAbsorbed,
    overflow,
    penetration: input.penetration,
    defense: input.defense,
    attackerLevel: input.attackerLevel,
    reduction,
    incomingModifier: input.incomingModifier,
    raw,
    afterOutgoing,
    afterConsistency,
    afterCrit,
    afterDefense,
    afterIncoming,
    hpDamage,
  }
}
