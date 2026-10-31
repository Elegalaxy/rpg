import type {
  ClassAction,
  ClassModule,
  CombatHero,
  CombatState,
  DamageNotice,
  OutgoingModifierQuery,
  SkillEffect,
} from '../types.ts'
import { logRace } from './events.ts'
import {
  CURSE_GRAVE_PATIENCE,
  CURSE_HOLLOW_HUNGER,
  CURSE_SOUL_DEBT,
  GRAVE_READY,
  GRAVE_SPEED,
  HOLLOW_HEAL_FRACTION,
  HOLLOW_HEALING_RECEIVED,
  HOLLOW_HP_FRACTION,
  HOLLOW_POWER,
  NODE_UNDEAD_DEATHLY_PRECISION,
  NODE_UNDEAD_PATIENT_KILLER,
  NODE_UNDEAD_SOUL_HARVEST,
  PRECISION_CRIT,
  SOUL_CAP,
  SOUL_DEBT_PER_SOUL,
  activeCurse,
  heroHas,
  soulsOf,
} from './racialNodes.ts'

export const STILLNESS_READY = 3
const STILLNESS_ACCURACY = 20
const STILLNESS_FLOOR = 0.1
const STILLNESS_FINAL_DAMAGE = 1.1
const PATIENT_ACCURACY = 30
const PATIENT_FLOOR = 0.15
const PATIENT_FINAL_DAMAGE = 1.2

type Numbers = { accuracy: number; floor: number; finalDamage: number }

function stillnessNumbers(hero: CombatHero): Numbers {
  if (heroHas(hero, NODE_UNDEAD_PATIENT_KILLER)) {
    return { accuracy: PATIENT_ACCURACY, floor: PATIENT_FLOOR, finalDamage: PATIENT_FINAL_DAMAGE }
  }
  return { accuracy: STILLNESS_ACCURACY, floor: STILLNESS_FLOOR, finalDamage: STILLNESS_FINAL_DAMAGE }
}

/** Grave Patience needs only two undamaged actions. */
function readyAt(hero: CombatHero): number {
  return activeCurse(hero) === CURSE_GRAVE_PATIENCE ? GRAVE_READY : STILLNESS_READY
}

function readProgress(hero: CombatHero): number {
  const value = hero.raceState.stillness
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  const ready = readyAt(hero)
  if (value > ready) return ready
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
  const ready = readyAt(state.hero)
  logRace(state, timeMs, `Undead Stillness progress is ${progress} of ${ready}.`)
  if (progress === ready) logRace(state, timeMs, 'Undead Stillness is ready.')
}

function setSouls(state: CombatState, timeMs: number, next: number, reason: string): void {
  const hero = state.hero
  const before = soulsOf(hero)
  const bounded = next < 0 ? 0 : next > SOUL_CAP ? SOUL_CAP : next
  if (bounded === before) return
  hero.raceState.souls = bounded
  logRace(state, timeMs, `Undead ${reason}: Soul Fragments ${before} to ${bounded}.`)
}

function applyCurseStart(hero: CombatHero): void {
  const curse = activeCurse(hero)
  if (curse === CURSE_HOLLOW_HUNGER) {
    hero.power *= HOLLOW_POWER
    hero.physicalPower *= HOLLOW_POWER
    hero.magicalPower *= HOLLOW_POWER
    hero.healingPower *= HOLLOW_POWER
    hero.healingReceived *= HOLLOW_HEALING_RECEIVED
  }
  if (curse === CURSE_GRAVE_PATIENCE) {
    hero.baseActionSeconds /= GRAVE_SPEED
    hero.actionTimeMs = Math.round(hero.actionTimeMs / GRAVE_SPEED)
    hero.nextReadyMs = hero.actionTimeMs
  }
}

function encounterStart(state: CombatState, timeMs: number): void {
  const hero = state.hero
  hero.raceState.stillness = 0
  hero.raceState.spending = false
  if (heroHas(hero, NODE_UNDEAD_SOUL_HARVEST)) {
    hero.raceState.souls = hero.suppliedSouls === null ? 0 : hero.suppliedSouls
  }
  hero.raceState.hollowUsed = false
  applyCurseStart(hero)
  logProgress(state, timeMs, 0)
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  if (timeMs < 0) return
  if (!isOffensive(action)) return
  const hero = state.hero
  if (readProgress(hero) < readyAt(hero)) return
  const numbers = stillnessNumbers(hero)
  hero.raceState.spending = true
  hero.accuracy += numbers.accuracy
  hero.raceState.spentAccuracy = numbers.accuracy
  hero.raceState.damageRollFloorBonus = numbers.floor
  hero.raceState.finalDamageMultiplier = numbers.finalDamage
  if (heroHas(hero, NODE_UNDEAD_DEATHLY_PRECISION) && soulsOf(hero) >= 1) {
    setSouls(state, timeMs, soulsOf(hero) - 1, 'spends a Soul for Deathly Precision')
    hero.raceState.damageRollFloorBonus = 1
    const room = 1 - hero.critChance
    const applied = room < PRECISION_CRIT ? (room > 0 ? room : 0) : PRECISION_CRIT
    hero.critChance += applied
    hero.raceState.precisionCrit = applied
  }
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  if (hero.raceState.spending === true) {
    const spent = hero.raceState.spentAccuracy
    hero.accuracy -= typeof spent === 'number' ? spent : STILLNESS_ACCURACY
    hero.raceState.spentAccuracy = null
    hero.raceState.spending = false
    const crit = hero.raceState.precisionCrit
    if (typeof crit === 'number' && crit > 0) hero.critChance -= crit
    hero.raceState.precisionCrit = null
    hero.raceState.stillness = 0
    hero.raceState.damageRollFloorBonus = null
    hero.raceState.finalDamageMultiplier = null
    logRace(state, timeMs, 'Undead spends Stillness.')
    if (activeCurse(hero) === CURSE_GRAVE_PATIENCE && soulsOf(hero) >= 1) {
      setSouls(state, timeMs, soulsOf(hero) - 1, 'spends a Soul for Grave Patience')
      hero.raceState.stillness = 1
      logProgress(state, timeMs, 1)
    }
    return
  }
  if (!countsForProgress(action)) return
  const ready = readyAt(hero)
  const before = readProgress(hero)
  const next = Math.min(ready, before + 1)
  hero.raceState.stillness = next
  if (next !== before) logProgress(state, timeMs, next)
}

/** Hollow Hunger: below 30% HP, one Soul heals 10% maximum HP, once per encounter. */
function hollowHeal(state: CombatState, timeMs: number): void {
  const hero = state.hero
  if (activeCurse(hero) !== CURSE_HOLLOW_HUNGER || hero.raceState.hollowUsed === true) return
  if (soulsOf(hero) < 1 || !hero.alive || hero.hp <= 0) return
  if (hero.maxHp <= 0 || hero.hp / hero.maxHp >= HOLLOW_HP_FRACTION) return
  hero.raceState.hollowUsed = true
  setSouls(state, timeMs, soulsOf(hero) - 1, 'spends a Soul for Hollow Hunger')
  const healed = hero.hp + hero.maxHp * HOLLOW_HEAL_FRACTION
  hero.hp = healed > hero.maxHp ? hero.maxHp : healed
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  if (notice.kind !== 'hit' || notice.hpLost <= 0) return
  hollowHeal(state, notice.timeMs)
  const before = readProgress(state.hero)
  if (before === 0) return
  state.hero.raceState.stillness = 0
  logProgress(state, notice.timeMs, 0)
}

/** Soul Harvest: one Soul per kill, up to the cap. */
function kill(state: CombatState, _victimId: string, timeMs: number): void {
  if (!heroHas(state.hero, NODE_UNDEAD_SOUL_HARVEST)) return
  setSouls(state, timeMs, soulsOf(state.hero) + 1, 'harvests a Soul')
}

/** Soul Debt: each held Soul adds 3% to all Power. */
function outgoingModifiers(state: CombatState, _query: OutgoingModifierQuery): number {
  const hero = state.hero
  if (activeCurse(hero) !== CURSE_SOUL_DEBT) return 1
  return 1 + SOUL_DEBT_PER_SOUL * soulsOf(hero)
}

export const undeadRace: ClassModule = {
  encounterStart,
  actionChosen,
  actionResolved,
  damageTaken,
  kill,
  outgoingModifiers,
}
