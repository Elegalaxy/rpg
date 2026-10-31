import { RESOURCE_GENERATION_FACTOR, RESOURCE_GENERATION_SOFT_CAP } from '../constants.ts'
import { focusOf, focusResourceMultiplier } from '../races/adjustments.ts'
import { faithGenerationLocked } from './clericAdjust.ts'
import { furyGenerationMultiplier } from './warriorAdjust.ts'
import type { CombatState, ResourceEvent } from '../types.ts'

/** Basic-attack gains normalize around the 2.0-second weapon baseline. Skills and damage taken do not. */
export const BASIC_ATTACK_RESOURCE_BASELINE_SECONDS = 2

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

/** `1 + 50% × Spirit ÷ (Spirit + 50)`. Numeric meters multiply gains by this. */
export function spiritResourceFactor(spirit: number): number {
  if (typeof spirit !== 'number' || !Number.isFinite(spirit) || spirit < 0) {
    throw new Error(`spirit must be at least 0, received ${describeValue(spirit)}`)
  }
  const bonus = (RESOURCE_GENERATION_FACTOR * spirit) / (spirit + RESOURCE_GENERATION_SOFT_CAP)
  return 1 + bonus
}

/** `listed base × weapon base action time ÷ 2.0`. Spirit is applied later. */
export function normalizeBasicAttackResource(base: number, weaponBaseSeconds: number): number {
  if (typeof base !== 'number' || !Number.isFinite(base)) {
    throw new Error(`resource base must be a finite number, received ${describeValue(base)}`)
  }
  if (typeof weaponBaseSeconds !== 'number' || !Number.isFinite(weaponBaseSeconds) || weaponBaseSeconds <= 0) {
    throw new Error(`weapon base action time must be greater than 0, received ${describeValue(weaponBaseSeconds)}`)
  }
  return (base * weaponBaseSeconds) / BASIC_ATTACK_RESOURCE_BASELINE_SECONDS
}

function pushResource(
  state: CombatState,
  timeMs: number,
  reason: string,
  base: number,
  multiplier: number,
  generated: number,
  gainCap: number | null,
  before: number,
  after: number,
): void {
  const hero = state.hero
  const event: ResourceEvent = {
    type: 'resource',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    resourceId: hero.classResourceId,
    scope: hero.classResourceScope,
    reason,
    base,
    multiplier,
    generated,
    gainCap,
    before,
    after,
    maximum: hero.classResourceMax,
  }
  state.log.push(event)
}

/**
 * Add a base gain: Spirit, optional per-hit cap, then the meter maximum.
 * Fractional resource is kept. No-op when the hero has no class resource.
 */
export function grantClassResource(
  state: CombatState,
  timeMs: number,
  base: number,
  reason: string,
  gainCap: number | null = null,
): void {
  const hero = state.hero
  if (hero.classResourceId === '') return
  if (faithGenerationLocked(hero, timeMs)) return
  if (typeof base !== 'number' || !Number.isFinite(base)) {
    throw new Error(`resource gain must be a finite number, received ${describeValue(base)}`)
  }
  const spirit = spiritResourceFactor(hero.spirit)
  const focusFactor = focusResourceMultiplier(focusOf(hero))
  const nodeFactor = furyGenerationMultiplier(hero)
  let multiplier = focusFactor === 1 ? spirit : spirit * focusFactor
  if (nodeFactor !== 1) multiplier *= nodeFactor
  let generated = base * multiplier
  if (gainCap !== null && generated > gainCap) generated = gainCap
  const before = hero.classResource
  let after = before + generated
  if (after > hero.classResourceMax) after = hero.classResourceMax
  if (after < 0) after = 0
  hero.classResource = after
  pushResource(state, timeMs, reason, base, multiplier, generated, gainCap, before, after)
}

/** Pay a positive skill cost. Spirit does not change costs. */
export function payClassResource(state: CombatState, timeMs: number, cost: number, reason: string): void {
  const hero = state.hero
  if (cost <= 0) return
  if (cost > hero.classResource) {
    throw new Error(
      `${hero.name} cannot pay ${cost} ${hero.classResourceId || 'resource'}; the meter is ${hero.classResource}`,
    )
  }
  const before = hero.classResource
  const after = before - cost
  hero.classResource = after
  pushResource(state, timeMs, reason, cost, 1, -cost, null, before, after)
}

/**
 * Set the live meter. Encounter start always logs. A clear that does not change the meter does not log.
 */
export function setClassResource(state: CombatState, timeMs: number, amount: number, reason: string): void {
  const hero = state.hero
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`resource amount must be a finite number, received ${describeValue(amount)}`)
  }
  let after = amount
  if (after < 0) after = 0
  if (after > hero.classResourceMax) after = hero.classResourceMax
  const before = hero.classResource
  if (before === after && reason !== 'encounterStart') return
  hero.classResource = after
  pushResource(state, timeMs, reason, amount, 1, after - before, null, before, after)
}

export function defineClassResource(
  state: CombatState,
  timeMs: number,
  definition: {
    id: string
    maximum: number
    scope: 'encounter' | 'expedition'
    amount: number
    regenPerSecond: number
  },
): void {
  if (definition.id.length === 0) throw new Error('class resource is missing an id')
  if (typeof definition.maximum !== 'number' || !Number.isFinite(definition.maximum) || definition.maximum <= 0) {
    throw new Error(`class resource maximum must be greater than 0, received ${describeValue(definition.maximum)}`)
  }
  if (
    typeof definition.regenPerSecond !== 'number' ||
    !Number.isFinite(definition.regenPerSecond) ||
    definition.regenPerSecond < 0
  ) {
    throw new Error(
      `class resource regen must be at least 0, received ${describeValue(definition.regenPerSecond)}`,
    )
  }
  const hero = state.hero
  hero.classResourceId = definition.id
  hero.classResourceMax = definition.maximum
  hero.classResourceScope = definition.scope
  hero.resourceRegenPerSecond = definition.regenPerSecond
  hero.classResource = 0
  setClassResource(state, timeMs, definition.amount, 'encounterStart')
}
