import type { ClassModule, CombatHero, CombatState, OutgoingModifierQuery } from '../types.ts'
import { logRace } from './events.ts'
import {
  APEX_CRIT_DAMAGE,
  APEX_HEALING,
  LONG_HUNT_PER_TIER,
  NODE_BEAST_APEX_INSTINCT,
  NODE_BEAST_BLOOD_SCENT,
  NODE_BEAST_LONG_HUNT,
  heroHas,
} from './racialNodes.ts'

export const FEROCITY_CAP = 6
export const FEROCITY_OUTGOING_PER_TIER = 0.05
export const FEROCITY_INCOMING_PER_TIER = 0.03
const LOW_HP_THOUSANDTHS = 400
/** Blood Scent restores this share of maximum HP after a low-HP victory. */
export const BLOOD_SCENT_HEAL = 0.05

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

/** Long Hunt: each tier adds 5% class-resource generation. 1 without the node. */
export function longHuntResourceFactor(hero: CombatHero): number {
  if (hero.race !== 'beastfolk' || !heroHas(hero, NODE_BEAST_LONG_HUNT)) return 1
  return 1 + LONG_HUNT_PER_TIER * ferocityTier(readFerocity(hero))
}

/** Apex Instinct: tier 3 healing and barrier output. 1 otherwise. */
export function apexOutputFactor(hero: CombatHero): number {
  if (hero.race !== 'beastfolk' || !heroHas(hero, NODE_BEAST_APEX_INSTINCT)) return 1
  return ferocityTier(readFerocity(hero)) >= 3 ? APEX_HEALING : 1
}

/** Long Hunt scales out-of-combat regeneration by tier. Thick Hide is applied by the caller. */
export function longHuntRegenFactor(nodeIds: readonly string[] | undefined, ferocityProgress: number): number {
  if (nodeIds === undefined || !nodeIds.includes(NODE_BEAST_LONG_HUNT)) return 1
  return 1 + LONG_HUNT_PER_TIER * ferocityTier(ferocityProgress)
}

function appliesToSchool(school: OutgoingModifierQuery['school']): boolean {
  return school === 'physical' || school === 'magical' || school === 'healing'
}

function encounterStart(state: CombatState, timeMs: number): void {
  const hero = state.hero
  const supplied = hero.suppliedFerocity
  const progress = supplied === null ? 0 : supplied
  hero.raceState.ferocity = progress
  const tier = ferocityTier(progress)
  if (tier > 0) {
    const incoming = 1 - FEROCITY_INCOMING_PER_TIER * tier
    hero.raceState.incomingKept = incoming
    hero.incomingMultipliers.push(incoming)
  }
  if (tier >= 3 && heroHas(hero, NODE_BEAST_APEX_INSTINCT)) hero.critDamage += APEX_CRIT_DAMAGE
  logRace(state, timeMs, `Beastfolk Ferocity progress is ${progress} (tier ${tier}).`)
}

function endedLow(hero: CombatHero): boolean {
  return hero.maxHp > 0 && hero.hp * 1000 <= hero.maxHp * LOW_HP_THOUSANDTHS
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
  if (endedLow(hero)) gain += heroHas(hero, NODE_BEAST_BLOOD_SCENT) ? 2 : 1
  return gain
}

function encounterEnd(state: CombatState, timeMs: number): void {
  if (state.outcome !== 'victory') return
  const hero = state.hero
  const low = endedLow(hero)
  const before = readFerocity(hero)
  let next = before + victoryGain(state)
  if (next > FEROCITY_CAP) next = FEROCITY_CAP
  hero.raceState.ferocity = next
  const tier = ferocityTier(next)
  logRace(state, timeMs, `Beastfolk Ferocity progress becomes ${next} (tier ${tier}).`)
  if (low && heroHas(hero, NODE_BEAST_BLOOD_SCENT)) {
    const healed = hero.hp + hero.maxHp * BLOOD_SCENT_HEAL
    hero.hp = healed > hero.maxHp ? hero.maxHp : healed
    logRace(state, timeMs, `Blood Scent restores ${BLOOD_SCENT_HEAL * 100}% maximum HP (HP ${hero.hp}).`)
  }
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  const hero = state.hero
  const tier = ferocityTier(readFerocity(hero))
  if (tier === 0) return 1
  if (!appliesToSchool(query.school)) return 1
  const base = 1 + FEROCITY_OUTGOING_PER_TIER * tier
  return query.school === 'healing' ? base * apexOutputFactor(hero) : base
}

export const beastfolkRace: ClassModule = {
  encounterStart,
  encounterEnd,
  outgoingModifiers,
}
