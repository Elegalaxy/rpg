import {
  BOSS_DURATION_FRACTION,
  BOSS_STACK_CAP_FACTOR,
  BOSS_STUN_FRACTION,
  MIN_UNSHIELDED_DAMAGE,
  STATUS_CHANCE_MAX_POINTS,
  STATUS_CHANCE_MIN_POINTS,
} from './constants.ts'
import { nextFloat } from './rng.ts'
import { defenseReduction } from './stats.ts'
import type {
  ActorStatuses,
  ApplyStatusEffect,
  BleedStack,
  BleedStatusDef,
  BurnStatusDef,
  ChillStatusDef,
  CombatActor,
  CombatHero,
  CombatState,
  DamageSchool,
  ExposeStatusDef,
  MarkStatusDef,
  PoisonStatusDef,
  SkillDef,
  StatusAttemptEvent,
  StatusDef,
  StatusExpiredEvent,
  StatusKind,
  StatusSnapshot,
  StatusTickEvent,
  StunStatusDef,
} from './types.ts'

/** Highest-priority negative status is first. Stun is a push, not a lingering status. */
export const CLEANSE_PRIORITY = ['bleed', 'poison', 'burn', 'chill', 'expose', 'mark'] as const

export type CleansableStatus = (typeof CLEANSE_PRIORITY)[number]

export type StatusTickDraft = {
  target: CombatActor
  timeMs: number
  sourceId: string
  sourceName: string
  statusId: string
  statusName: string
  school: DamageSchool
  stacks: number
  intensity: number
  power: number
  coefficient: number
  raw: number
  penetration: number
  defense: number
  attackerLevel: number
  reduction: number
  afterDefense: number
  hpDamage: number
}

export type BleedTickResult = {
  ticks: StatusTickDraft[]
  expired: { name: string; stacks: number } | null
}

type ApplyInput = {
  state: CombatState
  source: CombatActor
  target: CombatActor
  skill: SkillDef
  effect: ApplyStatusEffect
  timeMs: number
  /** True when an earlier effect of this skill already hit this target. */
  applyingHit: boolean
  hpDamageDealt: number
  /** Fixed roll in [0, 1). Omitted draws from the combat RNG. Mark and contact blocks do not draw. */
  roll?: number
}

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

function assertPositive(value: unknown, label: string): asserts value is number {
  assertFiniteNumber(value, label)
  if (value <= 0) {
    throw new Error(`${label} must be greater than 0, received ${describeValue(value)}`)
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be an integer of at least 1, received ${describeValue(value)}`)
  }
}

function assertFraction(value: unknown, label: string): asserts value is number {
  assertFiniteNumber(value, label)
  if (value <= 0 || value > 1) {
    throw new Error(`${label} must be greater than 0 and at most 1, received ${describeValue(value)}`)
  }
}

function roundMs(seconds: number, label: string): number {
  assertPositive(seconds, label)
  const ms = Math.round(seconds * 1000)
  if (ms < 1) throw new Error(`${label} rounded to ${ms} ms and cannot be scheduled`)
  return ms
}

export function emptyStatuses(): ActorStatuses {
  return {
    bleed: null,
    poison: null,
    burn: null,
    chill: null,
    mark: null,
    expose: null,
  }
}

function assertSlowByStack(value: unknown, id: string, maxStacks: number): readonly number[] {
  if (!Array.isArray(value) || value.length !== maxStacks) {
    throw new Error(`status '${id}' slow steps must list ${maxStacks} fractions`)
  }
  let sum = 0
  for (let index = 0; index < value.length; index += 1) {
    assertFraction(value[index], `status '${id}' slow step ${index + 1}`)
    sum += value[index] as number
  }
  if (sum >= 1) {
    throw new Error(`status '${id}' slow steps must leave a positive action speed, received ${sum}`)
  }
  return value as number[]
}

function assertKind(value: unknown, id: string): StatusKind {
  const kinds: readonly StatusKind[] = ['bleed', 'poison', 'burn', 'chill', 'stun', 'mark', 'expose']
  for (const kind of kinds) {
    if (value === kind) return kind
  }
  throw new Error(`status '${id}' has unknown kind ${describeValue(value)}`)
}

/** Reject a status definition whose caps, duration, or slow steps cannot be applied. */
export function assertStatusDef(value: unknown): asserts value is StatusDef {
  assertObject(value, 'status')
  const id = value.id
  if (typeof id !== 'string' || id.length === 0) throw new Error('status is missing an id')
  if (typeof value.name !== 'string' || value.name.length === 0) {
    throw new Error(`status '${id}' is missing a name`)
  }
  const kind = assertKind(value.kind, id)
  if (kind === 'bleed') {
    assertPositiveInteger(value.maxStacks, `status '${id}' stack cap`)
    assertPositiveInteger(value.actionsPerStack, `status '${id}' actions per stack`)
    return
  }
  if (kind === 'poison') {
    assertPositiveInteger(value.maxStacks, `status '${id}' stack cap`)
    assertPositive(value.durationSeconds, `status '${id}' duration`)
    assertPositive(value.tickSeconds, `status '${id}' tick`)
    return
  }
  if (kind === 'burn') {
    assertPositiveInteger(value.maxIntensity, `status '${id}' intensity cap`)
    assertPositive(value.durationSeconds, `status '${id}' duration`)
    assertPositive(value.tickSeconds, `status '${id}' tick`)
    return
  }
  if (kind === 'chill') {
    assertPositiveInteger(value.maxStacks, `status '${id}' stack cap`)
    assertPositive(value.durationSeconds, `status '${id}' duration`)
    assertSlowByStack(value.slowByStack, id, value.maxStacks)
    return
  }
  if (kind === 'stun') {
    assertPositive(value.delaySeconds, `status '${id}' delay`)
    return
  }
  if (kind === 'mark') return
  if (kind === 'expose') {
    assertPositive(value.durationSeconds, `status '${id}' duration`)
  }
}

export function assertStatusBook(statuses: unknown): void {
  if (typeof statuses !== 'object' || statuses === null || Array.isArray(statuses)) {
    throw new Error('status definitions must be an object')
  }
  for (const [id, status] of Object.entries(statuses)) {
    assertStatusDef(status)
    if (status.id !== id) throw new Error(`status entry '${id}' has id '${status.id}'`)
  }
}

/** `clamp(5%, 95%, base + Potency − Resistance)`. Inputs are percentage points except `baseChance` (0–1). */
export function applicationChance(baseChance: number, potency: number, resistance: number): number {
  assertFiniteNumber(baseChance, 'base status chance')
  if (baseChance < 0 || baseChance > 1) {
    throw new Error(`base status chance must be from 0 through 1, received ${describeValue(baseChance)}`)
  }
  assertFiniteNumber(potency, 'status potency')
  assertFiniteNumber(resistance, 'status resistance')
  const points = baseChance * 100 + potency - resistance
  const clamped =
    points < STATUS_CHANCE_MIN_POINTS
      ? STATUS_CHANCE_MIN_POINTS
      : points > STATUS_CHANCE_MAX_POINTS
        ? STATUS_CHANCE_MAX_POINTS
        : points
  return clamped / 100
}

/** Boss caps follow `round(normal × 0.6)`, and never drop below 1. */
export function statusStackCap(maxStacks: number, boss: boolean): number {
  assertPositiveInteger(maxStacks, 'stack cap')
  if (!boss) return maxStacks
  const scaled = Math.round(maxStacks * BOSS_STACK_CAP_FACTOR)
  return scaled < 1 ? 1 : scaled
}

export function scaledDurationMs(seconds: number, boss: boolean, label: string): number {
  const scaled = boss ? seconds * BOSS_DURATION_FRACTION : seconds
  return roundMs(scaled, label)
}

export function stunDelayMs(delaySeconds: number, boss: boolean): number {
  assertPositive(delaySeconds, 'stun delay')
  const factor = boss ? BOSS_STUN_FRACTION : 1
  return roundMs(delaySeconds * factor, 'stun delay')
}

export function statusPotency(actor: CombatActor, skillPotency = 0): number {
  assertFiniteNumber(actor.intellect, 'intellect')
  assertFiniteNumber(actor.statusPotency, 'status potency')
  assertFiniteNumber(skillPotency, 'skill potency')
  return actor.intellect + actor.statusPotency + skillPotency
}

export function statusResistance(actor: CombatActor, school: DamageSchool): number {
  if (school === 'physical') {
    assertFiniteNumber(actor.vitality, 'vitality')
    assertFiniteNumber(actor.physicalStatusResistance, 'physical status resistance')
    return actor.vitality + actor.physicalStatusResistance
  }
  assertFiniteNumber(actor.spirit, 'spirit')
  assertFiniteNumber(actor.magicalStatusResistance, 'magical status resistance')
  return actor.spirit + actor.magicalStatusResistance
}

/** Sum of the additional slows for the first `stacks` entries. */
export function chillSlowForStacks(slowByStack: readonly number[], stacks: number): number {
  if (!Number.isInteger(stacks) || stacks < 0) {
    throw new Error(`chill stacks must be an integer of at least 0, received ${describeValue(stacks)}`)
  }
  let slow = 0
  const used = stacks < slowByStack.length ? stacks : slowByStack.length
  for (let index = 0; index < used; index += 1) {
    const step = slowByStack[index]
    if (step === undefined) break
    slow += step
  }
  return slow
}

/** Slow active at `timeMs`. An expired Chill contributes nothing. Does not move `nextReadyMs`. */
export function chillSlowFraction(actor: CombatActor, timeMs: number): number {
  const chill = actor.statuses.chill
  if (chill === null || chill.expiresMs <= timeMs) return 0
  return chillSlowForStacks(chill.slowByStack, chill.stacks)
}

/** Action recovery after Chill. A zero slow returns `baseMs` unchanged. */
export function slowedActionMs(baseMs: number, slowFraction: number): number {
  assertPositiveInteger(baseMs, 'action time')
  assertFiniteNumber(slowFraction, 'chill slow')
  if (slowFraction <= 0) return baseMs
  if (slowFraction >= 1) {
    throw new Error(`chill slow must be less than 1, received ${describeValue(slowFraction)}`)
  }
  const ms = Math.round(baseMs / (1 - slowFraction))
  return ms < 1 ? 1 : ms
}

/** Armor or Resistance after the strongest applicable Expose. Missing or expired Expose returns the base. */
export function exposedDefense(target: CombatActor, school: DamageSchool, timeMs: number): number {
  const base = school === 'physical' ? target.armor : target.resistance
  const expose = target.statuses.expose
  if (expose === null || expose.expiresMs <= timeMs) return base
  const magnitude = school === 'physical' ? expose.armorMagnitude : expose.resistanceMagnitude
  if (magnitude <= 0) return base
  const reduced = base * (1 - magnitude)
  return reduced < 0 ? 0 : reduced
}

/**
 * Fixed DoT damage. No variance and no critical.
 * A positive result that rounds to 0 becomes 1 because the tick is unshielded.
 */
export function mitigateStatusDamage(
  raw: number,
  penetration: number,
  defense: number,
  attackerLevel: number,
): { reduction: number; afterDefense: number; hpDamage: number } {
  assertFiniteNumber(raw, 'status damage')
  if (raw < 0) throw new Error(`status damage must be at least 0, received ${describeValue(raw)}`)
  const reduction = defenseReduction(defense, penetration, attackerLevel)
  const afterDefense = raw * (1 - reduction)
  let hpDamage = Math.round(afterDefense)
  if (afterDefense > 0 && hpDamage < MIN_UNSHIELDED_DAMAGE) hpDamage = MIN_UNSHIELDED_DAMAGE
  if (hpDamage < 0) hpDamage = 0
  return { reduction, afterDefense, hpDamage }
}

function heroStats(actor: CombatActor): CombatHero | null {
  if (actor.side !== 'hero') return null
  return actor as CombatHero
}

function powerFor(source: CombatActor, school: DamageSchool): number {
  const hero = heroStats(source)
  if (hero === null) return source.power
  return school === 'physical' ? hero.physicalPower : hero.magicalPower
}

function penetrationFor(source: CombatActor, school: DamageSchool): number {
  const hero = heroStats(source)
  if (hero === null) return source.school === school ? source.penetration : 0
  return school === 'physical' ? hero.armorPenetration : hero.magicalPenetration
}

function taggedSchool(skill: SkillDef): DamageSchool | null {
  let school: DamageSchool | null = null
  for (const tag of skill.tags) {
    if (tag !== 'physical' && tag !== 'magical') continue
    if (school !== null && school !== tag) return null
    school = tag
  }
  return school
}

function damageSchool(def: StatusDef): DamageSchool | null {
  if (def.kind === 'bleed' || def.kind === 'poison') return 'physical'
  if (def.kind === 'burn') return 'magical'
  return null
}

function resistanceSchool(def: StatusDef, skill: SkillDef): DamageSchool | 'none' {
  if (def.kind === 'mark') return 'none'
  if (def.kind === 'bleed' || def.kind === 'poison') return 'physical'
  if (def.kind === 'burn' || def.kind === 'chill') return 'magical'
  const tagged = taggedSchool(skill)
  if (tagged === null) {
    throw new Error(`skill '${skill.id}' must have one physical or magical tag to apply ${def.name}`)
  }
  return tagged
}

function isContact(def: StatusDef): boolean {
  return def.kind === 'bleed' || def.kind === 'poison'
}

function snapshotOf(
  source: CombatActor,
  effect: ApplyStatusEffect,
  school: DamageSchool,
): StatusSnapshot {
  if (effect.coefficient === undefined) {
    throw new Error(`applying ${school} damage over time requires a coefficient`)
  }
  const powerSchool = effect.power ?? school
  return {
    power: powerFor(source, powerSchool),
    penetration: penetrationFor(source, school),
    coefficient: effect.coefficient,
    attackerLevel: source.level,
    sourceId: source.id,
    sourceName: source.name,
  }
}

function attemptEvent(
  input: ApplyInput,
  def: StatusDef,
  fields: Omit<StatusAttemptEvent, 'type' | 'timeMs' | 'actorId' | 'actorName' | 'targetId' | 'targetName' | 'statusId' | 'statusName'>,
): void {
  input.state.log.push({
    type: 'statusAttempt',
    timeMs: input.timeMs,
    actorId: input.source.id,
    actorName: input.source.name,
    targetId: input.target.id,
    targetName: input.target.name,
    statusId: def.id,
    statusName: def.name,
    ...fields,
  })
}

function drawRoll(input: ApplyInput): number {
  if (input.roll === undefined) return nextFloat(input.state.rng)
  assertFiniteNumber(input.roll, 'status roll')
  if (input.roll < 0 || input.roll >= 1) {
    throw new Error(`status roll must be in [0, 1), received ${describeValue(input.roll)}`)
  }
  return input.roll
}

function applyBleed(input: ApplyInput, def: BleedStatusDef, snapshot: StatusSnapshot, chance: number, potency: number, resistance: number, roll: number): void {
  const cap = statusStackCap(def.maxStacks, input.target.boss)
  const current = input.target.statuses.bleed
  const count = current === null ? 0 : current.stacks.length
  if (count >= cap) {
    attemptEvent(input, def, {
      school: 'physical',
      baseChance: input.effect.baseChance,
      potency,
      resistance,
      chance,
      roll,
      result: 'cap',
      stacks: count,
      intensity: 0,
      expiresMs: null,
      delayMs: null,
      nextReadyMs: null,
    })
    return
  }
  const stack: BleedStack = { ...snapshot, actionsRemaining: def.actionsPerStack }
  if (current === null) input.target.statuses.bleed = { name: def.name, stacks: [stack] }
  else current.stacks.push(stack)
  attemptEvent(input, def, {
    school: 'physical',
    baseChance: input.effect.baseChance,
    potency,
    resistance,
    chance,
    roll,
    result: 'applied',
    stacks: count + 1,
    intensity: 0,
    expiresMs: null,
    delayMs: null,
    nextReadyMs: null,
  })
}

function applyPoison(input: ApplyInput, def: PoisonStatusDef, snapshot: StatusSnapshot, chance: number, potency: number, resistance: number, roll: number): void {
  const cap = statusStackCap(def.maxStacks, input.target.boss)
  const expiresMs = input.timeMs + scaledDurationMs(def.durationSeconds, input.target.boss, `${def.id} duration`)
  const tickMs = roundMs(def.tickSeconds, `${def.id} tick`)
  const current = input.target.statuses.poison
  if (current === null) {
    input.target.statuses.poison = {
      name: def.name,
      stacks: [snapshot],
      expiresMs,
      tickMs,
      nextTickMs: input.timeMs + tickMs,
    }
  } else {
    current.expiresMs = expiresMs
    if (current.stacks.length < cap) current.stacks.push(snapshot)
  }
  const stacks = input.target.statuses.poison?.stacks.length ?? 0
  attemptEvent(input, def, {
    school: 'physical',
    baseChance: input.effect.baseChance,
    potency,
    resistance,
    chance,
    roll,
    result: 'applied',
    stacks,
    intensity: 0,
    expiresMs,
    delayMs: null,
    nextReadyMs: null,
  })
}

function applyBurn(input: ApplyInput, def: BurnStatusDef, snapshot: StatusSnapshot, chance: number, potency: number, resistance: number, roll: number): void {
  const cap = statusStackCap(def.maxIntensity, input.target.boss)
  const expiresMs = input.timeMs + scaledDurationMs(def.durationSeconds, input.target.boss, `${def.id} duration`)
  const tickMs = roundMs(def.tickSeconds, `${def.id} tick`)
  const current = input.target.statuses.burn
  let intensity = 1
  if (current === null) {
    input.target.statuses.burn = {
      ...snapshot,
      name: def.name,
      intensity: 1,
      expiresMs,
      tickMs,
      nextTickMs: input.timeMs + tickMs,
    }
  } else {
    current.expiresMs = expiresMs
    current.power = snapshot.power
    current.penetration = snapshot.penetration
    current.coefficient = snapshot.coefficient
    current.attackerLevel = snapshot.attackerLevel
    current.sourceId = snapshot.sourceId
    current.sourceName = snapshot.sourceName
    if (current.intensity < cap) current.intensity += 1
    intensity = current.intensity
  }
  attemptEvent(input, def, {
    school: 'magical',
    baseChance: input.effect.baseChance,
    potency,
    resistance,
    chance,
    roll,
    result: 'applied',
    stacks: 0,
    intensity,
    expiresMs,
    delayMs: null,
    nextReadyMs: null,
  })
}

function applyChill(input: ApplyInput, def: ChillStatusDef, chance: number, potency: number, resistance: number, roll: number): void {
  const cap = statusStackCap(def.maxStacks, input.target.boss)
  const expiresMs = input.timeMs + scaledDurationMs(def.durationSeconds, input.target.boss, `${def.id} duration`)
  const current = input.target.statuses.chill
  let stacks = 1
  if (current === null) {
    input.target.statuses.chill = {
      name: def.name,
      stacks: 1,
      expiresMs,
      slowByStack: def.slowByStack.slice(),
    }
  } else {
    current.expiresMs = expiresMs
    if (current.stacks < cap) current.stacks += 1
    stacks = current.stacks
  }
  attemptEvent(input, def, {
    school: 'magical',
    baseChance: input.effect.baseChance,
    potency,
    resistance,
    chance,
    roll,
    result: 'applied',
    stacks,
    intensity: 0,
    expiresMs,
    delayMs: null,
    nextReadyMs: null,
  })
}

function applyStun(input: ApplyInput, def: StunStatusDef, school: DamageSchool, chance: number, potency: number, resistance: number, roll: number): void {
  const delayMs = stunDelayMs(def.delaySeconds, input.target.boss)
  input.target.nextReadyMs += delayMs
  attemptEvent(input, def, {
    school,
    baseChance: input.effect.baseChance,
    potency,
    resistance,
    chance,
    roll,
    result: 'applied',
    stacks: 0,
    intensity: 0,
    expiresMs: null,
    delayMs,
    nextReadyMs: input.target.nextReadyMs,
  })
}

function applyMark(input: ApplyInput, def: MarkStatusDef): void {
  let expiresMs: number | null = null
  if (input.effect.durationSeconds !== undefined) {
    const seconds = input.target.boss
      ? input.effect.durationSeconds * BOSS_DURATION_FRACTION
      : input.effect.durationSeconds
    expiresMs = input.timeMs + roundMs(seconds, `${def.id} duration`)
  }
  for (const enemy of input.state.enemies) {
    if (enemy.id === input.target.id || enemy.statuses.mark === null) continue
    const previous = enemy.statuses.mark
    enemy.statuses.mark = null
    input.state.log.push({
      type: 'statusCleared',
      timeMs: input.timeMs,
      actorId: enemy.id,
      actorName: enemy.name,
      statusId: def.id,
      statusName: previous.name,
      stacks: 1,
      reason: 'moved',
    })
  }
  input.target.statuses.mark = {
    name: def.name,
    expiresMs,
    sourceId: input.source.id,
    sourceName: input.source.name,
  }
  attemptEvent(input, def, {
    school: 'none',
    baseChance: input.effect.baseChance,
    potency: 0,
    resistance: 0,
    chance: 1,
    roll: null,
    result: 'guaranteed',
    stacks: 1,
    intensity: 0,
    expiresMs,
    delayMs: null,
    nextReadyMs: null,
  })
}

function applyExpose(input: ApplyInput, def: ExposeStatusDef, school: DamageSchool, chance: number, potency: number, resistance: number, roll: number): void {
  const armor = input.effect.armorMagnitude ?? 0
  const magical = input.effect.resistanceMagnitude ?? 0
  if (armor <= 0 && magical <= 0) {
    throw new Error(`skill '${input.skill.id}' Expose requires an Armor or Resistance magnitude`)
  }
  const expiresMs = input.timeMs + scaledDurationMs(def.durationSeconds, input.target.boss, `${def.id} duration`)
  const current = input.target.statuses.expose
  if (current === null) {
    input.target.statuses.expose = {
      name: def.name,
      expiresMs,
      armorMagnitude: armor,
      resistanceMagnitude: magical,
    }
  } else {
    current.expiresMs = expiresMs
    if (armor > current.armorMagnitude) current.armorMagnitude = armor
    if (magical > current.resistanceMagnitude) current.resistanceMagnitude = magical
  }
  attemptEvent(input, def, {
    school,
    baseChance: input.effect.baseChance,
    potency,
    resistance,
    chance,
    roll,
    result: 'applied',
    stacks: 1,
    intensity: 0,
    expiresMs,
    delayMs: null,
    nextReadyMs: null,
  })
}

/**
 * Roll and apply one status. Contact Bleed and Poison are skipped, without a roll,
 * when the applying hit dealt no HP. Chill does not move `nextReadyMs`. Stun does.
 */
export function tryApplyStatus(input: ApplyInput & { defs: { statuses: { [id: string]: StatusDef } } }): void {
  if (!input.target.alive) return
  const def = input.defs.statuses[input.effect.statusId]
  if (def === undefined) {
    throw new Error(`skill '${input.skill.id}' applies unknown status '${input.effect.statusId}'`)
  }
  if (isContact(def) && (!input.applyingHit || input.hpDamageDealt <= 0)) {
    attemptEvent(input, def, {
      school: 'physical',
      baseChance: input.effect.baseChance,
      potency: statusPotency(input.source, input.effect.potency ?? 0),
      resistance: statusResistance(input.target, 'physical'),
      chance: 0,
      roll: null,
      result: 'contact',
      stacks: 0,
      intensity: 0,
      expiresMs: null,
      delayMs: null,
      nextReadyMs: null,
    })
    return
  }
  if (def.kind === 'mark') {
    applyMark(input, def)
    return
  }

  const school = resistanceSchool(def, input.skill)
  if (school === 'none') throw new Error(`status '${def.id}' has no resistance school`)
  const potency = statusPotency(input.source, input.effect.potency ?? 0)
  const resistance = statusResistance(input.target, school)
  const chance = applicationChance(input.effect.baseChance, potency, resistance)
  const roll = drawRoll(input)
  if (!(roll < chance)) {
    attemptEvent(input, def, {
      school,
      baseChance: input.effect.baseChance,
      potency,
      resistance,
      chance,
      roll,
      result: 'resisted',
      stacks: 0,
      intensity: 0,
      expiresMs: null,
      delayMs: null,
      nextReadyMs: null,
    })
    return
  }

  if (def.kind === 'bleed') {
    const dealt = damageSchool(def)
    if (dealt === null) return
    applyBleed(input, def, snapshotOf(input.source, input.effect, dealt), chance, potency, resistance, roll)
    return
  }
  if (def.kind === 'poison') {
    const dealt = damageSchool(def)
    if (dealt === null) return
    applyPoison(input, def, snapshotOf(input.source, input.effect, dealt), chance, potency, resistance, roll)
    return
  }
  if (def.kind === 'burn') {
    applyBurn(input, def, snapshotOf(input.source, input.effect, 'magical'), chance, potency, resistance, roll)
    return
  }
  if (def.kind === 'chill') {
    applyChill(input, def, chance, potency, resistance, roll)
    return
  }
  if (def.kind === 'stun') {
    applyStun(input, def, school, chance, potency, resistance, roll)
    return
  }
  applyExpose(input, def, school, chance, potency, resistance, roll)
}

function combinedDamage(
  snapshots: readonly StatusSnapshot[],
  intensity: number,
  defense: number,
): {
  power: number
  coefficient: number
  raw: number
  penetration: number
  attackerLevel: number
  reduction: number
  afterDefense: number
  hpDamage: number
} {
  const first = snapshots[0]
  if (first === undefined) throw new Error('status tick has no snapshot')
  let raw = 0
  let afterDefense = 0
  let uniform = true
  for (const stack of snapshots) {
    const partRaw = stack.power * stack.coefficient * intensity
    raw += partRaw
    const part = mitigateStatusDamage(partRaw, stack.penetration, defense, stack.attackerLevel)
    afterDefense += part.afterDefense
    if (stack.penetration !== first.penetration || stack.attackerLevel !== first.attackerLevel) uniform = false
  }
  const reduction = uniform
    ? defenseReduction(defense, first.penetration, first.attackerLevel)
    : raw === 0
      ? 0
      : 1 - afterDefense / raw
  let hpDamage = Math.round(afterDefense)
  if (afterDefense > 0 && hpDamage < MIN_UNSHIELDED_DAMAGE) hpDamage = MIN_UNSHIELDED_DAMAGE
  if (hpDamage < 0) hpDamage = 0
  return {
    power: first.power,
    coefficient: first.coefficient,
    raw,
    penetration: first.penetration,
    attackerLevel: first.attackerLevel,
    reduction,
    afterDefense,
    hpDamage,
  }
}

function tickDraft(
  target: CombatActor,
  timeMs: number,
  statusId: string,
  statusName: string,
  school: DamageSchool,
  stacks: number,
  intensity: number,
  defense: number,
  dealt: ReturnType<typeof combinedDamage>,
  source: StatusSnapshot,
): StatusTickDraft {
  return {
    target,
    timeMs,
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    statusId,
    statusName,
    school,
    stacks,
    intensity,
    power: dealt.power,
    coefficient: dealt.coefficient,
    raw: dealt.raw,
    penetration: dealt.penetration,
    defense,
    attackerLevel: dealt.attackerLevel,
    reduction: dealt.reduction,
    afterDefense: dealt.afterDefense,
    hpDamage: dealt.hpDamage,
  }
}

/** Bleed triggers when the target acts. Each stack then loses one action and drops at 0. */
export function takeBleedTicks(actor: CombatActor, timeMs: number): BleedTickResult {
  const bleed = actor.statuses.bleed
  if (bleed === null || bleed.stacks.length === 0) return { ticks: [], expired: null }
  const defense = exposedDefense(actor, 'physical', timeMs)
  const ticks: StatusTickDraft[] = []
  const next: BleedStack[] = []
  for (const stack of bleed.stacks) {
    const dealt = combinedDamage([stack], 1, defense)
    ticks.push(tickDraft(actor, timeMs, 'bleed', bleed.name, 'physical', 1, 1, defense, dealt, stack))
    const actionsRemaining = stack.actionsRemaining - 1
    if (actionsRemaining > 0) next.push({ ...stack, actionsRemaining })
  }
  if (next.length === 0) {
    const stacks = bleed.stacks.length
    const name = bleed.name
    actor.statuses.bleed = null
    return { ticks, expired: { name, stacks } }
  }
  bleed.stacks = next
  return { ticks, expired: null }
}

function actorsInOrder(state: CombatState): CombatActor[] {
  return [state.hero, ...state.enemies]
}

/** Poison and Burn ticks due in (stepStart, stepEnd] and strictly before their expiry. */
export function collectStatusTicks(state: CombatState, stepStart: number, stepEnd: number): StatusTickDraft[] {
  const queued: { timeMs: number; order: number; tick: StatusTickDraft }[] = []
  let order = 0
  for (const actor of actorsInOrder(state)) {
    if (!actor.alive) continue
    const poison = actor.statuses.poison
    if (poison !== null) {
      while (poison.nextTickMs > stepStart && poison.nextTickMs <= stepEnd && poison.nextTickMs < poison.expiresMs) {
        const timeMs = poison.nextTickMs
        const defense = exposedDefense(actor, 'physical', timeMs)
        const dealt = combinedDamage(poison.stacks, 1, defense)
        const source = poison.stacks[0]
        if (source === undefined) break
        queued.push({
          timeMs,
          order,
          tick: tickDraft(
            actor,
            timeMs,
            'poison',
            poison.name,
            'physical',
            poison.stacks.length,
            1,
            defense,
            dealt,
            source,
          ),
        })
        order += 1
        poison.nextTickMs = timeMs + poison.tickMs
      }
    }
    const burn = actor.statuses.burn
    if (burn !== null) {
      while (burn.nextTickMs > stepStart && burn.nextTickMs <= stepEnd && burn.nextTickMs < burn.expiresMs) {
        const timeMs = burn.nextTickMs
        const defense = exposedDefense(actor, 'magical', timeMs)
        const dealt = combinedDamage([burn], burn.intensity, defense)
        queued.push({
          timeMs,
          order,
          tick: tickDraft(actor, timeMs, 'burn', burn.name, 'magical', 1, burn.intensity, defense, dealt, burn),
        })
        order += 1
        burn.nextTickMs = timeMs + burn.tickMs
      }
    }
  }
  queued.sort((a, b) => a.timeMs - b.timeMs || a.order - b.order)
  return queued.map((entry) => entry.tick)
}

function expireOne(
  state: CombatState,
  actor: CombatActor,
  statusId: CleansableStatus,
  name: string,
  stacks: number,
  expiresMs: number,
  stepStart: number,
  stepEnd: number,
): boolean {
  if (expiresMs <= stepStart || expiresMs > stepEnd) return false
  const event: StatusExpiredEvent = {
    type: 'statusExpired',
    timeMs: expiresMs,
    actorId: actor.id,
    actorName: actor.name,
    statusId,
    statusName: name,
    stacks,
  }
  state.log.push(event)
  return true
}

/** Durations that fall inside this step end before periodic ticks. */
export function expireStatuses(state: CombatState, stepStart: number, stepEnd: number): void {
  for (const actor of actorsInOrder(state)) {
    const poison = actor.statuses.poison
    if (poison !== null && expireOne(state, actor, 'poison', poison.name, poison.stacks.length, poison.expiresMs, stepStart, stepEnd)) {
      actor.statuses.poison = null
    }
    const burn = actor.statuses.burn
    if (burn !== null && expireOne(state, actor, 'burn', burn.name, burn.intensity, burn.expiresMs, stepStart, stepEnd)) {
      actor.statuses.burn = null
    }
    const chill = actor.statuses.chill
    if (chill !== null && expireOne(state, actor, 'chill', chill.name, chill.stacks, chill.expiresMs, stepStart, stepEnd)) {
      actor.statuses.chill = null
    }
    const expose = actor.statuses.expose
    if (expose !== null && expireOne(state, actor, 'expose', expose.name, 1, expose.expiresMs, stepStart, stepEnd)) {
      actor.statuses.expose = null
    }
    const mark = actor.statuses.mark
    if (
      mark !== null &&
      mark.expiresMs !== null &&
      expireOne(state, actor, 'mark', mark.name, 1, mark.expiresMs, stepStart, stepEnd)
    ) {
      actor.statuses.mark = null
    }
  }
}

function presentKind(actor: CombatActor, kind: CleansableStatus): boolean {
  if (kind === 'bleed') return actor.statuses.bleed !== null && actor.statuses.bleed.stacks.length > 0
  if (kind === 'poison') return actor.statuses.poison !== null && actor.statuses.poison.stacks.length > 0
  if (kind === 'burn') return actor.statuses.burn !== null
  if (kind === 'chill') return actor.statuses.chill !== null
  if (kind === 'expose') return actor.statuses.expose !== null
  return actor.statuses.mark !== null
}

function stackCount(actor: CombatActor, kind: CleansableStatus): number {
  if (kind === 'bleed') return actor.statuses.bleed?.stacks.length ?? 0
  if (kind === 'poison') return actor.statuses.poison?.stacks.length ?? 0
  if (kind === 'burn') return actor.statuses.burn?.intensity ?? 0
  if (kind === 'chill') return actor.statuses.chill?.stacks ?? 0
  if (kind === 'expose') return actor.statuses.expose === null ? 0 : 1
  return actor.statuses.mark === null ? 0 : 1
}

function statusName(actor: CombatActor, kind: CleansableStatus): string {
  if (kind === 'bleed') return actor.statuses.bleed?.name ?? 'Bleed'
  if (kind === 'poison') return actor.statuses.poison?.name ?? 'Poison'
  if (kind === 'burn') return actor.statuses.burn?.name ?? 'Burn'
  if (kind === 'chill') return actor.statuses.chill?.name ?? 'Chill'
  if (kind === 'expose') return actor.statuses.expose?.name ?? 'Expose'
  return actor.statuses.mark?.name ?? 'Mark'
}

function clearKind(actor: CombatActor, kind: CleansableStatus): void {
  if (kind === 'bleed') actor.statuses.bleed = null
  else if (kind === 'poison') actor.statuses.poison = null
  else if (kind === 'burn') actor.statuses.burn = null
  else if (kind === 'chill') actor.statuses.chill = null
  else if (kind === 'expose') actor.statuses.expose = null
  else actor.statuses.mark = null
}

function isCleansable(value: string): value is CleansableStatus {
  for (const kind of CLEANSE_PRIORITY) {
    if (kind === value) return true
  }
  return false
}

/**
 * Remove one negative status and every stack or intensity point on it.
 * With no id, remove the highest-priority status that is actually present.
 * Returns the removed id, or null when there was nothing to remove.
 */
export function cleanseStatus(
  state: CombatState,
  target: CombatActor,
  timeMs: number,
  statusId?: string,
): CleansableStatus | null {
  assertFiniteNumber(timeMs, 'cleanse time')
  let kind: CleansableStatus | null = null
  if (statusId === undefined) {
    for (const candidate of CLEANSE_PRIORITY) {
      if (presentKind(target, candidate)) {
        kind = candidate
        break
      }
    }
  } else if (statusId === 'stun') {
    throw new Error('stun has no lingering status to cleanse')
  } else if (!isCleansable(statusId)) {
    throw new Error(`unknown status '${statusId}'`)
  } else if (presentKind(target, statusId)) {
    kind = statusId
  }
  if (kind === null) return null
  const stacks = stackCount(target, kind)
  const name = statusName(target, kind)
  clearKind(target, kind)
  state.log.push({
    type: 'statusCleared',
    timeMs,
    actorId: target.id,
    actorName: target.name,
    statusId: kind,
    statusName: name,
    stacks,
  })
  return kind
}

/** Fill HP fields and keep the tick flags the log shows: barrier bypassed, no crit, no variance. */
export function statusTickEvent(draft: StatusTickDraft, hpBefore: number, hpAfter: number): StatusTickEvent {
  return {
    type: 'statusTick',
    timeMs: draft.timeMs,
    sourceId: draft.sourceId,
    sourceName: draft.sourceName,
    targetId: draft.target.id,
    targetName: draft.target.name,
    statusId: draft.statusId,
    statusName: draft.statusName,
    school: draft.school,
    stacks: draft.stacks,
    intensity: draft.intensity,
    power: draft.power,
    coefficient: draft.coefficient,
    raw: draft.raw,
    penetration: draft.penetration,
    defense: draft.defense,
    attackerLevel: draft.attackerLevel,
    reduction: draft.reduction,
    afterDefense: draft.afterDefense,
    hpDamage: draft.hpDamage,
    targetHpBefore: hpBefore,
    targetHpAfter: hpAfter,
    barrierBypassed: true,
    crit: false,
    varianceRoll: false,
  }
}
