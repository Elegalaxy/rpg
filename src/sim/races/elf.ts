import type { ClassAction, ClassModule, CombatHero, CombatState, DamageNotice } from '../types.ts'
import { consistencyBounds } from '../damage.ts'
import { formatMeter, logRace } from './events.ts'
import {
  CLARITY_COOLDOWN,
  CLARITY_FLOOR,
  FLOW_BONUS_CAP,
  FOCUS_GAIN_NODE,
  FOCUS_LOSS_NODE,
  FORESIGHT_EVASION,
  FORESIGHT_FOCUS,
  NODE_ELF_EFFICIENT_FLOW,
  NODE_ELF_FOCUSED_MIND,
  NODE_ELF_FORESIGHT,
  NODE_ELF_PERFECT_CLARITY,
  heroHas,
} from './racialNodes.ts'

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
export function focusResourceMultiplier(focus: number, flow = false): number {
  const bonus = focusRollFloorBonus(focus)
  if (bonus === 0) return 1
  if (!flow) return 1 + bonus
  const doubled = bonus * 2
  return 1 + (doubled > FLOW_BONUS_CAP ? FLOW_BONUS_CAP : doubled)
}

export function hasEfficientFlow(hero: CombatHero): boolean {
  return heroHas(hero, NODE_ELF_EFFICIENT_FLOW)
}

/** Perfect Clarity is on at 100 Focus. */
export function clarityActive(hero: CombatHero): boolean {
  return heroHas(hero, NODE_ELF_PERFECT_CLARITY) && focusOf(hero) >= FOCUS_MAX
}

/** Extra minimum-roll points that lift the damage floor to 95%. 0 when Clarity is off. */
export function clarityFloorBonus(hero: CombatHero): number {
  if (!clarityActive(hero)) return 0
  const need = CLARITY_FLOOR - consistencyBounds(hero.consistency).floor
  return need > 0 ? need : 0
}

function storedFocus(hero: CombatHero): number {
  const value = hero.raceState.focus
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value
}

/** Foresight (+10 Evasion at 75) and Clarity (+10 points cooldown reduction at 100) follow Focus. */
function syncFocusNodes(hero: CombatHero): void {
  const focus = focusOf(hero)
  const foresight = heroHas(hero, NODE_ELF_FORESIGHT) && focus >= FORESIGHT_FOCUS
  if (foresight !== (hero.raceState.foresight === true)) {
    hero.evasion += foresight ? FORESIGHT_EVASION : -FORESIGHT_EVASION
    hero.raceState.foresight = foresight
  }
  const clarity = clarityActive(hero)
  if (clarity !== (hero.raceState.clarity === true)) {
    hero.cooldownReduction += clarity ? CLARITY_COOLDOWN : -CLARITY_COOLDOWN
    hero.raceState.clarity = clarity
  }
}

function writeFocus(state: CombatState, timeMs: number, next: number, before: number): void {
  const hero = state.hero
  hero.raceState.focus = next
  syncFocusNodes(hero)
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
  syncFocusNodes(state.hero)
  logRace(state, timeMs, `Elf Focus is ${formatMeter(focus)}/${FOCUS_MAX}.`)
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind === 'basicAttack' && !action.hit) return
  changeFocus(state, timeMs, heroHas(state.hero, NODE_ELF_FOCUSED_MIND) ? FOCUS_GAIN_NODE : FOCUS_GAIN)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  if (notice.kind !== 'hit' || notice.hpLost <= 0) return
  const hero = state.hero
  if (!(hero.maxHp > 0)) return
  if (clarityActive(hero)) {
    changeFocus(state, notice.timeMs, -FOCUS_MAX)
    return
  }
  let removed = (FOCUS_LOSS_PER_HP_FRACTION * notice.hpLost) / hero.maxHp
  if (heroHas(hero, NODE_ELF_FOCUSED_MIND)) removed *= FOCUS_LOSS_NODE
  changeFocus(state, notice.timeMs, -removed)
}

export const elfRace: ClassModule = {
  encounterStart,
  actionResolved,
  damageTaken,
}
