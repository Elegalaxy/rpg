import type { CombatHero, CombatState, OutgoingModifierQuery, SkillDef } from '../types.ts'
import { clarityFloorBonus, focusOf, focusRollFloorBonus } from './elf.ts'
import { raceModule } from './index.ts'

export { focusOf, focusResourceMultiplier, focusRollFloorBonus } from './elf.ts'

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

/** 0 keeps the caller's original floor. */
export function raisedFloor(floor: number, ceiling: number, bonus: number): number {
  if (bonus === 0) return floor
  const raised = floor + bonus
  if (raised > ceiling) return ceiling
  if (raised < 0) return 0
  return raised
}

function classDamageRollFloorBonus(hero: CombatHero): number {
  const extra = hero.classState.damageRollFloorBonus
  if (extra === undefined || extra === null || extra === 0) return 0
  if (typeof extra !== 'number' || !Number.isFinite(extra) || extra < 0) {
    throw new Error(`damage roll floor bonus must be at least 0, received ${describeValue(extra)}`)
  }
  return extra
}

export function heroDamageRollFloorBonus(hero: CombatHero): number {
  const fromFocus = focusRollFloorBonus(focusOf(hero))
  const extra = hero.raceState.damageRollFloorBonus
  let raceBonus = 0
  if (extra !== undefined && extra !== null) {
    if (typeof extra !== 'number' || !Number.isFinite(extra) || extra < 0) {
      throw new Error(`damage roll floor bonus must be at least 0, received ${describeValue(extra)}`)
    }
    raceBonus = extra
  }
  const total = fromFocus + raceBonus + classDamageRollFloorBonus(hero)
  const clarity = clarityFloorBonus(hero)
  const best = clarity > total ? clarity : total
  if (best === 0) return 0
  return best
}

export function heroHealRollFloorBonus(hero: CombatHero): number {
  return focusRollFloorBonus(focusOf(hero))
}

/** Ferocity's incoming multiplier stays after until-next-action effects clear. */
export function heroKeptIncoming(hero: CombatHero): number | null {
  const value = hero.raceState.incomingKept
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function readFinalMultiplier(value: unknown): number {
  if (value === undefined || value === null) return 1
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`final damage multiplier must be at least 0, received ${describeValue(value)}`)
  }
  return value
}

/** Race and class multipliers combine. Either one omitted stays at 1. */
export function heroFinalDamageMultiplier(hero: CombatHero): number {
  const product =
    readFinalMultiplier(hero.raceState.finalDamageMultiplier) *
    readFinalMultiplier(hero.classState.finalDamageMultiplier)
  if (product === 1) return 1
  return product
}

/** Null when this hero has no race outgoing hook. Tier 0 still returns 1 from the hook. */
export function raceOutgoingModifier(
  state: CombatState,
  school: OutgoingModifierQuery['school'],
  skill: SkillDef | null,
): number | null {
  const hook = raceModule(state.hero.race)?.outgoingModifiers
  if (hook === undefined) return null
  const value = hook(state, { school, skill })
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`outgoing modifier must be at least 0, received ${describeValue(value)}`)
  }
  return value
}
