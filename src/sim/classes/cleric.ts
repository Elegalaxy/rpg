import type { ClassAction, ClassModule, CombatHero, CombatState, DamageNotice } from '../types.ts'
import { defineClassResource, grantClassResource, spiritResourceFactor } from './resources.ts'

export const FAITH_RESOURCE_ID = 'faith'
export const FAITH_MAXIMUM = 100
export const FAITH_SCOPE = 'expedition' as const
/** A new combat starts empty. Faith does not decay and is not cleared at encounter end. */
export const FAITH_START = 0

export const VOW_ZEAL = 'zeal'
export const VOW_ENDURANCE = 'endurance'
export const VOW_TEMPERANCE = 'temperance'
export const CLERIC_VOWS = [VOW_ZEAL, VOW_ENDURANCE, VOW_TEMPERANCE] as const
export type ClericVow = (typeof CLERIC_VOWS)[number]

/** Locked at encounter start. The live vow is this class-state entry. */
export const VOW_STATE_KEY = 'vow'

/** Direct HP damage from a hero action. Not weapon-normalized. At most once per action. */
export const ZEAL_BASE = 5
/** Per 1% of maximum HP lost or absorbed, before the per-action cap. Full precision. */
export const ENDURANCE_BASE_PER_PERCENT = 1
/** Cap on the Endurance base, applied before Spirit. */
export const ENDURANCE_BASE_CAP = 10
/** After a hero action that ends inside the HP band. Not weapon-normalized. */
export const TEMPERANCE_BASE = 5
export const TEMPERANCE_HP_MIN = 0.4
export const TEMPERANCE_HP_MAX = 0.8

const VOW_LIST = 'zeal, endurance, or temperance'

function isVow(value: string): value is ClericVow {
  return value === VOW_ZEAL || value === VOW_ENDURANCE || value === VOW_TEMPERANCE
}

function requireVow(value: string | null): ClericVow {
  if (value === null || value.length === 0) {
    throw new Error(`cleric vow is missing; expected ${VOW_LIST}`)
  }
  if (!isVow(value)) {
    throw new Error(`cleric vow '${value}' is unknown; expected ${VOW_LIST}`)
  }
  return value
}

function lockedVow(hero: CombatHero): ClericVow {
  const value = hero.classState[VOW_STATE_KEY]
  if (typeof value !== 'string') {
    throw new Error(`cleric vow is missing; expected ${VOW_LIST}`)
  }
  return requireVow(value)
}

function directHpLost(action: ClassAction): number {
  if (action.kind === 'basicAttack') return action.hpLost ?? 0
  let lost = 0
  for (const strike of action.strikes ?? []) lost += strike.hpLost ?? 0
  return lost
}

function temperanceFailure(hero: CombatHero): 'hp' | 'overheal' | 'overcap' | null {
  if (hero.overhealed) return 'overheal'
  const ratio = hero.maxHp <= 0 ? 0 : hero.hp / hero.maxHp
  if (ratio < TEMPERANCE_HP_MIN || ratio > TEMPERANCE_HP_MAX) return 'hp'
  const generated = TEMPERANCE_BASE * spiritResourceFactor(hero.spirit)
  if (hero.classResource + generated > hero.classResourceMax) return 'overcap'
  return null
}

function encounterStart(state: CombatState, timeMs: number): void {
  const hero = state.hero
  const vow = requireVow(hero.suppliedVow)
  hero.classState = { ...hero.classState, [VOW_STATE_KEY]: vow }
  defineClassResource(state, timeMs, {
    id: FAITH_RESOURCE_ID,
    maximum: FAITH_MAXIMUM,
    scope: FAITH_SCOPE,
    amount: FAITH_START,
    regenPerSecond: 0,
  })
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  const vow = lockedVow(hero)
  if (vow === VOW_ZEAL && directHpLost(action) > 0) {
    grantClassResource(state, timeMs, ZEAL_BASE, VOW_ZEAL)
  }
  if (vow !== VOW_TEMPERANCE) return
  const reason = temperanceFailure(hero)
  if (reason !== null) {
    state.log.push({
      type: 'vow',
      timeMs,
      actorId: hero.id,
      actorName: hero.name,
      vow: VOW_TEMPERANCE,
      reason,
    })
    return
  }
  grantClassResource(state, timeMs, TEMPERANCE_BASE, VOW_TEMPERANCE)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  if (lockedVow(state.hero) !== VOW_ENDURANCE) return
  if (notice.kind !== 'hit') return
  const hero = state.hero
  if (hero.maxHp <= 0) return
  const absorbed = notice.barrierAbsorbed ?? 0
  let base = ((notice.hpLost + absorbed) / hero.maxHp) * 100 * ENDURANCE_BASE_PER_PERCENT
  if (base <= 0) return
  if (base > ENDURANCE_BASE_CAP) base = ENDURANCE_BASE_CAP
  grantClassResource(state, notice.timeMs, base, VOW_ENDURANCE)
}

export const clericClass: ClassModule = {
  encounterStart,
  actionResolved,
  damageTaken,
}
