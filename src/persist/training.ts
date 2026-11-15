import { awardXp } from '../sim/progression.ts'
import { xpToNextLevel } from '../sim/stats.ts'

import { scaleHeirlooms } from './reincarnation.ts'
import type { RosterResult } from './roster.ts'
import { MAX_DRILLS_PER_LEVEL, type SaveData, type SavedHero } from './save.ts'

/** The share of the level a drill gives, as a fraction of `xpToNextLevel` (GAME_DESIGN §9, "Gold sinks"). */
export const DRILL_XP_FRACTION = 0.1
/** The n-th drill within a level costs `level × DRILL_GOLD_PER_LEVEL × n` gold. */
export const DRILL_GOLD_PER_LEVEL = 40

/** XP one drill gives at this level: 10% of the level's XP cost, rounded half up, at least 1. */
export function drillXp(level: number): number {
  return Math.max(1, Math.round(xpToNextLevel(level) * DRILL_XP_FRACTION))
}

/** Gold the next drill costs for a hero who has already done `done` drills this level. */
export function drillPrice(level: number, done: number): number {
  return level * DRILL_GOLD_PER_LEVEL * (done + 1)
}

export type DrillInfo = { xp: number; price: number; done: number; left: number }

/** What the next drill gives and costs, and how many are left this level. */
export function drillInfo(hero: SavedHero): DrillInfo {
  const done = hero.drillsThisLevel
  return { xp: drillXp(hero.progress.level), price: drillPrice(hero.progress.level, done), done, left: Math.max(0, MAX_DRILLS_PER_LEVEL - done) }
}

/** The progress after an XP award, with the drill count back at 0 when the award raised the level. */
export function withXp(hero: SavedHero, xp: number): Pick<SavedHero, 'progress' | 'drillsThisLevel'> {
  const progress = awardXp(hero.progress, xp)
  return { progress, drillsThisLevel: progress.level > hero.progress.level ? 0 : hero.drillsThisLevel }
}

/** Why a drill is refused, or null. */
export function trainCheck(save: SaveData, hero: SavedHero): string | null {
  if (hero.awayRun !== null || (save.expedition !== null && save.selectedHeroId === hero.id)) {
    return `${hero.name} is on an expedition. Drills wait until the hero is home.`
  }
  const info = drillInfo(hero)
  if (info.left === 0) return `${hero.name} has done all ${MAX_DRILLS_PER_LEVEL} drills for level ${hero.progress.level}. Level up to train again.`
  if (hero.purse.gold < info.price) return `The next drill costs ${info.price} gold. You have ${hero.purse.gold}.`
  return null
}

/** Buy one drill: pay gold from the hero's purse, add XP through the normal level-up path. */
export function trainHero(save: SaveData, heroId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const problem = trainCheck(save, hero)
  if (problem !== null) return { ok: false, reason: problem }
  const info = drillInfo(hero)
  const trained: SavedHero = {
    ...hero,
    ...withXp(hero, info.xp),
    purse: { ...hero.purse, gold: hero.purse.gold - info.price },
  }
  const after: SavedHero = trained.progress.level > hero.progress.level ? trained : { ...trained, drillsThisLevel: hero.drillsThisLevel + 1 }
  const next = { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? after : entry)) }
  return { ok: true, save: scaleHeirlooms(next, heroId) }
}
