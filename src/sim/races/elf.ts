import type { ClassAction, ClassModule, CombatHero, CombatState, DamageNotice } from '../types.ts'
import { formatMeter, logRace } from './events.ts'

export const FOCUS_MAX = 100
export const FOCUS_GAIN = 10
/** 0.1 percentage points per Focus, which is 0.001 on a 0–1 roll floor. */
export const FOCUS_FLOOR_PER_POINT = 0.001
export const FOCUS_BONUS_CAP = 0.1
/** 2 Focus per 1% of maximum HP: 200 × hpLost / maxHp. */
const FOCUS_LOSS_PER_HP_FRACTION = 200

export function focusOf(hero: CombatHero): number {
  const value = hero.raceState.focus
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  if (value > FOCUS_MAX) return FOCUS_MAX
  return value
}

/** 0 Focus returns 0 so the caller can keep the original floor. */
export function focusRollFloorBonus(focus: number): number {
  if (focus <= 0) return 0
  const bonus = focus * FOCUS_FLOOR_PER_POINT
  return bonus > FOCUS_BONUS_CAP ? FOCUS_BONUS_CAP : bonus
}

/** 0 Focus returns 1 so resource logs keep the Spirit multiplier unchanged. */
export function focusResourceMultiplier(focus: number): number {
  const bonus = focusRollFloorBonus(focus)
  if (bonus === 0) return 1
  return 1 + bonus
}

function storedFocus(hero: CombatHero): number {
  const value = hero.raceState.focus
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value
}

function writeFocus(state: CombatState, timeMs: number, next: number, before: number): void {
  const hero = state.hero
  hero.raceState.focus = next
  const amount = next - before
  if (amount === 0) return
  const verb = amount > 0 ? 'gains' : 'loses'
  const shown = amount > 0 ? amount : -amount
  logRace(state, timeMs, `Elf ${verb} ${formatMeter(shown)} Focus (${formatMeter(next)}/${FOCUS_MAX}).`)
}

function changeFocus(state: CombatState, timeMs: number, delta: number): void {
  const before = storedFocus(state.hero)
  let next = before + delta
  if (next < 0) next = 0
  if (next > FOCUS_MAX) next = FOCUS_MAX
  writeFocus(state, timeMs, next, before)
}

function encounterStart(state: CombatState, timeMs: number): void {
  const supplied = state.hero.suppliedFocus
  const focus = supplied === null ? 0 : supplied
  state.hero.raceState.focus = focus
  logRace(state, timeMs, `Elf Focus is ${formatMeter(focus)}/${FOCUS_MAX}.`)
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind === 'basicAttack' && !action.hit) return
  changeFocus(state, timeMs, FOCUS_GAIN)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  if (notice.kind !== 'hit' || notice.hpLost <= 0) return
  const hero = state.hero
  if (!(hero.maxHp > 0)) return
  const removed = (FOCUS_LOSS_PER_HP_FRACTION * notice.hpLost) / hero.maxHp
  changeFocus(state, notice.timeMs, -removed)
}

export const elfRace: ClassModule = {
  encounterStart,
  actionResolved,
  damageTaken,
}
