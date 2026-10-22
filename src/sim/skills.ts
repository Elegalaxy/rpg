import { grantClassResource } from './classes/resources.ts'
import {
  COOLDOWN_REDUCTION_CAP,
  HEALING_ROLL_CEILING,
  HEALING_ROLL_FLOOR,
  OFF_HAND_KINDS,
  WEAPON_POWER_FACTOR,
} from './constants.ts'
import { consistencyBounds, resolveDamage } from './damage.ts'
import { centeredRoll, nextFloat } from './rng.ts'
import { exposedDefense, tryApplyStatus } from './statuses.ts'
import type {
  ActionDelayEvent,
  ApplyStatusEffect,
  BarrierEvent,
  BuffEndedEvent,
  CombatActor,
  CombatHero,
  CombatState,
  DamageResult,
  DamageSchool,
  GameDefs,
  HealEvent,
  HealResult,
  SkillDef,
  SkillEffect,
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
] as const

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
    return { kind, school, coefficient: value.coefficient }
  }
  if (kind === 'heal') {
    assertNonNegative(value.maxHpFraction, `skill '${skillId}' heal max HP fraction`)
    assertNonNegative(value.healingCoefficient, `skill '${skillId}' healing coefficient`)
    if (value.maxHpFraction === 0 && value.healingCoefficient === 0) {
      throw new Error(`skill '${skillId}' heal must restore health`)
    }
    return {
      kind,
      maxHpFraction: value.maxHpFraction,
      healingCoefficient: value.healingCoefficient,
    }
  }
  if (kind === 'barrier') {
    const source = value.source
    if (source !== 'magical' && source !== 'healing') {
      throw new Error(
        `skill '${skillId}' barrier source must be magical or healing, received ${describeValue(source)}`,
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
    assertPositive(value.delaySeconds, `skill '${skillId}' chain delay`)
    return {
      kind,
      school,
      coefficient: value.coefficient,
      decay: value.decay,
      maxTargets: value.maxTargets,
      delaySeconds: value.delaySeconds,
    }
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
  return hero.equippedSkillIds.includes(skillId)
}

/** A positive cost is paid from the hero's live class meter. */
export function skillAffordable(hero: CombatHero, skill: SkillDef): boolean {
  return skill.cost <= hero.classResource
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

export function skillNeedsEnemy(skill: SkillDef): boolean {
  for (const effect of skill.effects) {
    if (
      effect.kind === 'damage' ||
      effect.kind === 'actionDelay' ||
      effect.kind === 'applyStatus' ||
      effect.kind === 'chain'
    ) {
      return true
    }
  }
  return false
}

export function effectiveEvasion(actor: { evasion: number; evasionBonus: number }): number {
  return actor.evasion + actor.evasionBonus
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
  return {
    maxHpFraction: input.maxHpFraction,
    healingCoefficient: input.healingCoefficient,
    healingPower: input.healingPower,
    outgoingModifier: input.outgoingModifier,
    raw,
    afterOutgoing,
    roll: input.roll,
    rollFloor: HEALING_ROLL_FLOOR,
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

export function endUntilNextAction(state: CombatState, hero: CombatHero, timeMs: number): void {
  const active =
    hero.damageReduction > 0 || hero.evasionBonus !== 0 || hero.incomingMultipliers.length > 0
  if (!active) return
  const incomingMultiplier = incomingDamageFactor({
    incomingMultipliers: hero.incomingMultipliers,
    damageReduction: 0,
  })
  const event: BuffEndedEvent = {
    type: 'buffEnded',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    damageReduction: hero.damageReduction,
    evasion: hero.evasionBonus,
    incomingMultiplier,
  }
  hero.damageReduction = 0
  hero.evasionBonus = 0
  hero.incomingMultipliers = []
  state.log.push(event)
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

function strike(
  state: CombatState,
  hero: CombatHero,
  target: CombatActor,
  school: DamageSchool,
  coefficient: number,
  outgoingModifier: number,
  scheduledMs: number,
): DamageResult {
  const bounds = consistencyBounds(hero.consistency)
  const consistencyRoll = centeredRoll(state.rng, bounds.floor, bounds.ceiling)
  const critRoll = nextFloat(state.rng)
  return resolveDamage({
    accuracy: hero.accuracy,
    evasion: effectiveEvasion(target),
    power: powerFor(hero, school),
    coefficient,
    outgoingModifier,
    consistency: hero.consistency,
    critChance: hero.critChance,
    critDamage: hero.critDamage,
    barrier: activeBarrier(target, scheduledMs),
    penetration: penetrationFor(hero, school),
    defense: defenseOf(target, school, scheduledMs),
    attackerLevel: hero.level,
    incomingModifier: incomingDamageFactor(target),
    school,
    guaranteedHit: true,
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
        const result = strike(
          state,
          hero,
          target,
          effect.school,
          effect.coefficient,
          outgoingFor(effect.school),
          scheduledMs,
        )
        applyDamage(target, result)
        hpDamageDealt[target.id] = (hpDamageDealt[target.id] ?? 0) + result.hpDamage
      }
      continue
    }
    if (effect.kind === 'heal') {
      const roll = centeredRoll(state.rng, HEALING_ROLL_FLOOR, HEALING_ROLL_CEILING)
      const result = resolveHeal({
        maxHp: hero.maxHp,
        maxHpFraction: effect.maxHpFraction,
        healingPower: hero.healingPower,
        healingCoefficient: effect.healingCoefficient,
        outgoingModifier: 1,
        healingReceived: hero.healingReceived,
        roll,
      })
      const targetHpBefore = hero.hp
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
      const amount = power * effect.coefficient
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
      hero.evasionBonus = effect.amount
      state.log.push({
        type: 'buff',
        timeMs: scheduledMs,
        actorId: hero.id,
        actorName: hero.name,
        kind: 'evasion',
        value: effect.amount,
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
        target.nextReadyMs += delayMs
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
      grantClassResource(state, scheduledMs, effect.base, skill.id)
      continue
    }
    if (effect.kind === 'chain') {
      const primary = targets[0]
      if (primary === undefined) throw new Error(`${skill.name} chain resolved without a target`)
      const jumped = chainTargets(state, primary, effect.maxTargets)
      let coefficient = effect.coefficient
      for (const target of jumped) {
        if (!target.alive || state.outcome !== 'ongoing') continue
        const result = strike(
          state,
          hero,
          target,
          effect.school,
          coefficient,
          outgoingFor(effect.school),
          scheduledMs,
        )
        applyDamage(target, result)
        hpDamageDealt[target.id] = (hpDamageDealt[target.id] ?? 0) + result.hpDamage
        if (target.alive) {
          const delayMs = roundSecondsToMs(effect.delaySeconds, `${skill.id} chain delay`)
          target.nextReadyMs += delayMs
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
        coefficient *= effect.decay
      }
      continue
    }
    const unexpected: never = effect
    throw new Error(`skill '${skill.id}' has unknown effect kind '${(unexpected as { kind?: string }).kind ?? ''}'`)
  }
}
