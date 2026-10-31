import type { ClassAction, ClassModule, CombatHero, CombatState, DamageNotice, SkillEffect } from '../types.ts'
import { logRace } from './events.ts'

export const STILLNESS_READY = 3
const STILLNESS_ACCURACY = 20
const STILLNESS_FLOOR = 0.1
const STILLNESS_FINAL_DAMAGE = 1.1

function readProgress(hero: CombatHero): number {
  const value = hero.raceState.stillness
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  if (value > STILLNESS_READY) return STILLNESS_READY
  return value
}

function dealsDamage(effects: readonly SkillEffect[]): boolean {
  for (const effect of effects) {
    if (effect.kind === 'damage' || effect.kind === 'chain') return true
    if (effect.kind === 'chanceGate' && dealsDamage(effect.effects)) return true
  }
  return false
}

function isOffensive(action: ClassAction): boolean {
  if (action.kind === 'basicAttack') return true
  return dealsDamage(action.skill.effects)
}

function countsForProgress(action: ClassAction): boolean {
  if (action.kind === 'basicAttack') return action.hit
  return true
}

function logProgress(state: CombatState, timeMs: number, progress: number): void {
  logRace(state, timeMs, `Undead Stillness progress is ${progress} of ${STILLNESS_READY}.`)
  if (progress === STILLNESS_READY) logRace(state, timeMs, 'Undead Stillness is ready.')
}

function encounterStart(state: CombatState, timeMs: number): void {
  state.hero.raceState.stillness = 0
  state.hero.raceState.spending = false
  logProgress(state, timeMs, 0)
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  if (timeMs < 0) return
  if (!isOffensive(action)) return
  if (readProgress(state.hero) < STILLNESS_READY) return
  const hero = state.hero
  hero.raceState.spending = true
  hero.accuracy += STILLNESS_ACCURACY
  hero.raceState.damageRollFloorBonus = STILLNESS_FLOOR
  hero.raceState.finalDamageMultiplier = STILLNESS_FINAL_DAMAGE
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  if (hero.raceState.spending === true) {
    hero.accuracy -= STILLNESS_ACCURACY
    hero.raceState.spending = false
    hero.raceState.stillness = 0
    hero.raceState.damageRollFloorBonus = null
    hero.raceState.finalDamageMultiplier = null
    logRace(state, timeMs, 'Undead spends Stillness.')
    return
  }
  if (!countsForProgress(action)) return
  const next = Math.min(STILLNESS_READY, readProgress(hero) + 1)
  const before = readProgress(hero)
  hero.raceState.stillness = next
  if (next !== before) logProgress(state, timeMs, next)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  if (notice.kind !== 'hit' || notice.hpLost <= 0) return
  const before = readProgress(state.hero)
  if (before === 0) return
  state.hero.raceState.stillness = 0
  logProgress(state, notice.timeMs, 0)
}

export const undeadRace: ClassModule = {
  encounterStart,
  actionChosen,
  actionResolved,
  damageTaken,
}
