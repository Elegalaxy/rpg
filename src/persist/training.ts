import { awardXp } from '../sim/progression.ts'
import { xpToNextLevel } from '../sim/stats.ts'

import { scaleHeirlooms } from './reincarnation.ts'
import type { RosterResult } from './roster.ts'
import { DRILL_MS, MAX_DRILLS_PER_LEVEL, type SaveData, type SavedHero } from './save.ts'

export { DRILL_MS }

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

/** True while the hero is out: on the live expedition or on an away run. Drills neither start nor advance then. */
export function heroAway(save: SaveData, hero: SavedHero): boolean {
  return hero.awayRun !== null || (save.expedition !== null && save.selectedHeroId === hero.id)
}

/** How many drills the hero has paid for and not finished, running one included. */
export function drillsQueued(hero: SavedHero): number {
  return hero.training?.queue.length ?? 0
}

/** True when any hero has a drill queued or running. */
export function anyTraining(save: SaveData): boolean {
  return save.heroes.some((hero) => drillsQueued(hero) > 0)
}

/** Why a drill is refused, or null. */
export function trainCheck(save: SaveData, hero: SavedHero): string | null {
  if (heroAway(save, hero)) return `${hero.name} is on an expedition. Drills wait until the hero is home.`
  const info = drillInfo(hero)
  if (drillsQueued(hero) >= MAX_DRILLS_PER_LEVEL) return `Three drills already queued. Wait for one to finish.`
  if (info.left === 0) return `${hero.name} has done all ${MAX_DRILLS_PER_LEVEL} drills for level ${hero.progress.level}. Level up to train again.`
  if (hero.purse.gold < info.price) return `The next drill costs ${info.price} gold. You have ${hero.purse.gold}.`
  return null
}

/**
 * Buy one drill: pay gold from the hero's purse and put it last in the hero's training queue. The XP is fixed
 * now and lands when the drill finishes (`advanceTraining`). The count of drills this level goes up now.
 */
export function trainHero(save: SaveData, heroId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const problem = trainCheck(save, hero)
  if (problem !== null) return { ok: false, reason: problem }
  const info = drillInfo(hero)
  const queue = [...(hero.training?.queue ?? []), { xp: info.xp }]
  const after: SavedHero = {
    ...hero,
    drillsThisLevel: hero.drillsThisLevel + 1,
    purse: { ...hero.purse, gold: hero.purse.gold - info.price },
    training: { remainingMs: hero.training?.remainingMs ?? DRILL_MS, queue },
  }
  return { ok: true, save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? after : entry)) } }
}

export type TrainingNotice = { text: string }

/**
 * Let time pass for every hero's drills. Only the first drill of a queue runs, and only while the hero is home.
 * Time left over when a drill ends goes to that hero's next one. A finished drill adds its XP through `withXp`.
 */
export function advanceTraining(save: SaveData, elapsedMs: number): { save: SaveData; finished: TrainingNotice[] } {
  if (!anyTraining(save) || !(elapsedMs > 0)) return { save, finished: [] }
  let current = save
  const finished: TrainingNotice[] = []
  for (const start of save.heroes) {
    if (heroAway(save, start)) continue
    let left = elapsedMs
    while (left > 0) {
      const hero = current.heroes.find((entry) => entry.id === start.id)
      const training = hero?.training
      if (hero === undefined || training === undefined) break
      const [drill, ...rest] = training.queue
      if (drill === undefined) break
      if (training.remainingMs > left) {
        const waiting: SavedHero = { ...hero, training: { ...training, remainingMs: training.remainingMs - left } }
        current = { ...current, heroes: current.heroes.map((entry) => (entry.id === hero.id ? waiting : entry)) }
        break
      }
      left -= training.remainingMs
      const raised: SavedHero = { ...hero, ...withXp(hero, drill.xp) }
      const { training: _done, ...bare } = raised
      const next: SavedHero = rest.length > 0 ? { ...bare, training: { remainingMs: DRILL_MS, queue: rest } } : bare
      current = scaleHeirlooms({ ...current, heroes: current.heroes.map((entry) => (entry.id === hero.id ? next : entry)) }, hero.id)
      finished.push({ text: `${hero.name}: drill finished, +${drill.xp} XP${next.progress.level > hero.progress.level ? `, level ${next.progress.level}` : ''}.` })
    }
  }
  return { save: current, finished }
}
