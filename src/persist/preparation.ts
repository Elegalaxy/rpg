import { CLERIC_VOWS } from '../sim/classes/cleric.ts'
import { EFFICIENT_QUIVER_CAPACITY, NODE_EFFICIENT_QUIVER, QUIVER_CAPACITY } from '../sim/classes/ranger.ts'
import { CURSES, NODE_UNDEAD_CURSEBOUND } from '../sim/races/racialNodes.ts'

import type { RosterResult } from './roster.ts'
import type { SaveData, SavedHero } from './save.ts'

/** What the preparation screen edits for the selected hero. Text fields keep what was typed. */
export type PreparationDraft = {
  /** Retreat threshold as a whole percent of maximum HP, or an empty string to never retreat. */
  retreatPercent: string
  vow: string
  curse: string
  specialAmmo: string
}

export const RETREAT_MIN_PERCENT = 5
export const RETREAT_MAX_PERCENT = 90

export function draftFor(hero: SavedHero): PreparationDraft {
  return {
    retreatPercent: hero.retreatAtMost === null ? '' : String(Math.round(hero.retreatAtMost * 100)),
    vow: hero.vow ?? '',
    curse: hero.curse ?? '',
    specialAmmo: String(hero.specialAmmo),
  }
}

/** Special arrows a Ranger can carry: 6, or 8 with Efficient Quiver. Other classes carry none. */
export function quiverLimit(hero: SavedHero): number {
  if (hero.classId !== 'ranger') return 0
  return hero.progress.allocatedNodeIds.includes(NODE_EFFICIENT_QUIVER) ? EFFICIENT_QUIVER_CAPACITY : QUIVER_CAPACITY
}

export function canPickCurse(hero: SavedHero): boolean {
  return hero.progress.race === 'undead' && hero.progress.allocatedNodeIds.includes(NODE_UNDEAD_CURSEBOUND)
}

export type PreparationResult =
  | { ok: true; hero: SavedHero }
  | { ok: false; errors: string[] }

/** Check a draft against this hero. Every message names the setting. */
export function checkPreparation(hero: SavedHero, draft: PreparationDraft): PreparationResult {
  const errors: string[] = []
  let retreatAtMost: number | null = null
  const percentText = draft.retreatPercent.trim()
  if (percentText.length > 0) {
    const percent = Number(percentText)
    if (!Number.isInteger(percent) || percent < RETREAT_MIN_PERCENT || percent > RETREAT_MAX_PERCENT) {
      errors.push(`Retreat threshold must be a whole percent from ${RETREAT_MIN_PERCENT} to ${RETREAT_MAX_PERCENT}, or empty to never retreat.`)
    } else {
      retreatAtMost = percent / 100
    }
  }
  let vow: string | null = hero.vow
  if (hero.classId === 'cleric') {
    if (!(CLERIC_VOWS as readonly string[]).includes(draft.vow)) errors.push('Pick a vow: Zeal, Endurance, or Temperance.')
    else vow = draft.vow
  }
  let curse: string | null = null
  if (draft.curse !== '') {
    if (!canPickCurse(hero)) errors.push('Only an Undead with Cursebound can carry a curse.')
    else if (!(CURSES as readonly string[]).includes(draft.curse)) errors.push('Pick one of the three curses, or none.')
    else curse = draft.curse
  }
  let specialAmmo = hero.specialAmmo
  if (hero.classId === 'ranger') {
    const limit = quiverLimit(hero)
    const amount = Number(draft.specialAmmo.trim())
    if (draft.specialAmmo.trim().length === 0 || !Number.isInteger(amount) || amount < 0 || amount > limit) {
      errors.push(`Special arrows must be a whole number from 0 to ${limit}.`)
    } else {
      specialAmmo = amount
    }
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, hero: { ...hero, retreatAtMost, vow, curse, specialAmmo } }
}

/** Save a hero's preparation. It cannot change while that hero is out on an expedition. */
export function savePreparation(save: SaveData, heroId: string, draft: PreparationDraft): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Preparation is locked while an expedition is running.' }
  const checked = checkPreparation(hero, draft)
  if (!checked.ok) return { ok: false, reason: checked.errors.join(' ') }
  return { ok: true, save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? checked.hero : entry)) } }
}
