import type { ClassModule, CombatHero, CombatState, OutgoingModifierQuery } from '../types.ts'
import { logRace } from './events.ts'

export const FEROCITY_CAP = 6
export const FEROCITY_OUTGOING_PER_TIER = 0.05
export const FEROCITY_INCOMING_PER_TIER = 0.03
const LOW_HP_THOUSANDTHS = 400

export function ferocityTier(progress: number): number {
  const tier = Math.floor(progress / 2)
  if (tier < 0) return 0
  if (tier > 3) return 3
  return tier
}

function readFerocity(hero: CombatHero): number {
  const value = hero.raceState.ferocity
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return 0
  if (value > FEROCITY_CAP) return FEROCITY_CAP
  return value
}

function appliesToSchool(school: OutgoingModifierQuery['school']): boolean {
  return school === 'physical' || school === 'magical' || school === 'healing'
}

function encounterStart(state: CombatState, timeMs: number): void {
  const supplied = state.hero.suppliedFerocity
  const progress = supplied === null ? 0 : supplied
  state.hero.raceState.ferocity = progress
  const tier = ferocityTier(progress)
  if (tier > 0) {
    const incoming = 1 - FEROCITY_INCOMING_PER_TIER * tier
    state.hero.raceState.incomingKept = incoming
    state.hero.incomingMultipliers.push(incoming)
  }
  logRace(state, timeMs, `Beastfolk Ferocity progress is ${progress} (tier ${tier}).`)
}

function victoryGain(state: CombatState): number {
  let gain = 1
  for (const enemy of state.enemies) {
    if (enemy.summon) continue
    if (enemy.elite) {
      gain = 2
      break
    }
  }
  const hero = state.hero
  if (hero.maxHp > 0 && hero.hp * 1000 <= hero.maxHp * LOW_HP_THOUSANDTHS) gain += 1
  return gain
}

function encounterEnd(state: CombatState, timeMs: number): void {
  if (state.outcome !== 'victory') return
  const before = readFerocity(state.hero)
  let next = before + victoryGain(state)
  if (next > FEROCITY_CAP) next = FEROCITY_CAP
  state.hero.raceState.ferocity = next
  const tier = ferocityTier(next)
  logRace(state, timeMs, `Beastfolk Ferocity progress becomes ${next} (tier ${tier}).`)
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  const tier = ferocityTier(readFerocity(state.hero))
  if (tier === 0) return 1
  if (!appliesToSchool(query.school)) return 1
  return 1 + FEROCITY_OUTGOING_PER_TIER * tier
}

export const beastfolkRace: ClassModule = {
  encounterStart,
  encounterEnd,
  outgoingModifiers,
}
