import { supplyTable } from '../content/supplies.ts'
import { routes } from '../content/world.ts'
import { CLERIC_VOWS } from '../sim/classes/cleric.ts'
import { SUPPLY_SLOT_COUNT } from '../sim/expedition.ts'
import { EFFICIENT_QUIVER_CAPACITY, NODE_EFFICIENT_QUIVER, QUIVER_CAPACITY } from '../sim/classes/ranger.ts'
import { CURSES, NODE_UNDEAD_CURSEBOUND } from '../sim/races/racialNodes.ts'

import { STACK_LIMIT_REASON, limitStacks, overStacked, packSlots, stackLimit } from './pack.ts'
import type { RosterResult } from './roster.ts'
import { BAG_FULL_ORDERS, REPEAT_LIMITS, type AutoRunMode, type BagFullOrder, type SaveData, type SavedHero } from './save.ts'

/** What the preparation screen edits for the selected hero. Text fields keep what was typed. */
export type PreparationDraft = {
  /** Retreat threshold as a whole percent of maximum HP, or an empty string to never retreat. */
  retreatPercent: string
  vow: string
  curse: string
  specialAmmo: string
  /** Gold to carry, as a whole number. */
  carryGold: string
  /** The Warden's Echo rank for a run to the Fracture Gate. */
  fightRank: string
  /** One supply id per slot, or an empty string for an empty slot. As long as the hero's slots (`packSlots`): 4, or 5 or 6 with a backpack. */
  supplies: string[]
  /** Standing order while away: push on while HP is at least this whole percent of maximum. */
  pushOnPercent: string
  /** Standing order while away: run a cleared route again after a safe return. */
  repeatRoute: boolean
  /** Standing order while away: stop after this many runs in one catch-up. 0 is no limit. */
  repeatLimit: number
  /** Standing order: stop pushing on after this many fights in a run. Blank is no limit. Left out keeps the hero's setting. */
  stopAfterFights?: string
  /** Live Auto run switch. Left out keeps the hero's setting. */
  autoRun?: boolean
  /** Auto run session fight limit. Blank is no limit. Left out keeps the hero's setting. */
  autoRunMaxFights?: string
  /** What Auto run does when the route ends. Left out keeps the hero's setting. */
  autoRunMode?: AutoRunMode
  /** Auto run hands in and takes contracts at home. Left out keeps the hero's setting. */
  autoContracts?: boolean
  /** Auto run repairs worn gear at home. Left out keeps the hero's setting. */
  autoRepair?: boolean
  /** Standing order while away: what to do when the bag is nearly full. */
  bagFullOrder: BagFullOrder
  /** Route to start on its own when the player leaves with no run. An empty string never starts one. */
  awayRouteId: string
}

export const RETREAT_MIN_PERCENT = 5
export const RETREAT_MAX_PERCENT = 90
export const PUSH_ON_MIN_PERCENT = 1
export const PUSH_ON_MAX_PERCENT = 100
export const STOP_AFTER_MIN = 1
export const STOP_AFTER_MAX = 99
export const AUTO_RUN_MIN = 1
export const AUTO_RUN_MAX = 9999

export function draftFor(hero: SavedHero): PreparationDraft {
  return {
    retreatPercent: hero.retreatAtMost === null ? '' : String(Math.round(hero.retreatAtMost * 100)),
    vow: hero.vow ?? '',
    curse: hero.curse ?? '',
    specialAmmo: String(hero.specialAmmo),
    carryGold: String(hero.carryGold),
    fightRank: String(hero.fightRank),
    supplies: fitSlots(limitStacks(hero.packedSupplies, packSlots(hero)), packSlots(hero)),
    pushOnPercent: String(hero.pushOnHpPercent),
    repeatRoute: hero.repeatRoute,
    repeatLimit: hero.repeatLimit,
    stopAfterFights: hero.stopAfterFights === null ? '' : String(hero.stopAfterFights),
    autoRun: hero.autoRun === true,
    autoRunMaxFights: hero.autoRunMaxFights == null ? '' : String(hero.autoRunMaxFights),
    autoRunMode: hero.autoRunMode ?? 'repeat',
    autoContracts: hero.autoContracts === true,
    autoRepair: hero.autoRepair === true,
    bagFullOrder: hero.bagFullOrder,
    awayRouteId: hero.awayRouteId ?? '',
  }
}

/** The picks as a list of exactly `slotCount` entries, empty slots as ''. */
function fitSlots(ids: readonly string[], slotCount: number): string[] {
  return Array.from({ length: slotCount }, (_, index) => ids[index] ?? '')
}

/** How many of each supply the slots hold. */
export function packedCounts(slots: readonly string[]): { [supplyId: string]: number } {
  const counts: { [supplyId: string]: number } = {}
  for (const id of slots) if (id !== '') counts[id] = (counts[id] ?? 0) + 1
  return counts
}

/** The slots limited to what the stash holds, so the screen never shows a pick it cannot fill. */
export function clampToStash(slots: readonly string[], stash: { readonly [supplyId: string]: number }, slotCount: number = SUPPLY_SLOT_COUNT): string[] {
  const left = { ...stash }
  const kept: string[] = []
  for (const id of slots) {
    if (id === '' || (left[id] ?? 0) <= 0) continue
    left[id] = (left[id] ?? 0) - 1
    kept.push(id)
  }
  return fitSlots(kept, slotCount)
}

/**
 * Pack one more or one fewer of a supply. The slots stay filled from the left, in the order the
 * supplies were first packed. Adding stops at the slot count and at what the stash holds.
 */
export function stepPacked(slots: readonly string[], supplyId: string, delta: 1 | -1, owned: number, slotCount: number = SUPPLY_SLOT_COUNT): string[] {
  const packed = slots.filter((id) => id !== '')
  if (delta === 1) {
    if (packRefusal(slots, supplyId, owned, slotCount) !== null) return [...slots]
    packed.push(supplyId)
  } else {
    const at = packed.lastIndexOf(supplyId)
    if (at < 0) return [...slots]
    packed.splice(at, 1)
  }
  return fitSlots(packed, slotCount)
}

/**
 * Why one more of this supply cannot be packed, or null when it can: the slots are full, the stash has no more,
 * or (with a backpack, above 4 slots) the run already carries 3 of it.
 */
export function packRefusal(slots: readonly string[], supplyId: string, owned: number, slotCount: number = SUPPLY_SLOT_COUNT): string | null {
  const packed = slots.filter((id) => id !== '')
  const have = packedCounts(packed)[supplyId] ?? 0
  if (packed.length >= slotCount) return 'Every slot is full.'
  const limit = stackLimit(slotCount)
  if (limit !== null && have >= limit) return STACK_LIMIT_REASON
  if (have >= owned) return owned === 0 ? 'You have none in the stash.' : `You only have ${owned} in the stash.`
  return null
}

/**
 * What a run would take from the stash: the packed ids it can cover, in slot order, and the ones
 * it cannot. A pick the stash cannot cover leaves its slot empty.
 */
export function packFromStash(hero: SavedHero): { taken: string[]; missing: string[] } {
  const left = { ...hero.purse.supplies }
  const taken: string[] = []
  const missing: string[] = []
  for (const id of hero.packedSupplies) {
    if ((left[id] ?? 0) > 0) {
      left[id] = (left[id] ?? 0) - 1
      taken.push(id)
    } else {
      missing.push(id)
    }
  }
  return { taken, missing }
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

/** A whole Echo rank above the unlocked maximum becomes that maximum. Other text stays as typed. */
export function snapEchoRank(text: string, maxRank: number): string {
  const trimmed = text.trim()
  const rank = Number(trimmed)
  if (trimmed.length === 0 || !Number.isInteger(rank) || rank < 0 || rank <= maxRank) return text
  return String(maxRank)
}

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
  let carryGold = hero.carryGold
  const carryText = draft.carryGold.trim()
  const carry = Number(carryText)
  if (carryText.length === 0 || !Number.isInteger(carry) || carry < 0) {
    errors.push('Gold to carry must be a whole number of at least 0.')
  } else {
    carryGold = carry
  }
  let fightRank = hero.fightRank
  const rankText = snapEchoRank(draft.fightRank, hero.echoRank).trim()
  const rank = Number(rankText)
  if (rankText.length === 0 || !Number.isInteger(rank) || rank < 0) {
    errors.push(`Echo rank must be a whole number from 0 to ${hero.echoRank}.`)
  } else {
    fightRank = rank
  }
  let pushOnHpPercent = hero.pushOnHpPercent
  const pushText = draft.pushOnPercent.trim()
  const push = Number(pushText)
  if (pushText.length === 0 || !Number.isInteger(push) || push < PUSH_ON_MIN_PERCENT || push > PUSH_ON_MAX_PERCENT) {
    errors.push(`Push on while HP is at least must be a whole percent from ${PUSH_ON_MIN_PERCENT} to ${PUSH_ON_MAX_PERCENT}.`)
  } else {
    pushOnHpPercent = push
  }
  let stopAfterFights = hero.stopAfterFights
  if (draft.stopAfterFights !== undefined) {
    const stopText = draft.stopAfterFights.trim()
    const stop = Number(stopText)
    if (stopText.length === 0) stopAfterFights = null
    else if (!Number.isInteger(stop) || stop < STOP_AFTER_MIN || stop > STOP_AFTER_MAX) errors.push(`Stop after fights must be a whole number from ${STOP_AFTER_MIN} to ${STOP_AFTER_MAX}, or empty for no limit.`)
    else stopAfterFights = stop
  }
  let autoRunMaxFights = hero.autoRunMaxFights ?? null
  if (draft.autoRunMaxFights !== undefined) {
    const autoText = draft.autoRunMaxFights.trim()
    const auto = Number(autoText)
    if (autoText.length === 0) autoRunMaxFights = null
    else if (!Number.isInteger(auto) || auto < AUTO_RUN_MIN || auto > AUTO_RUN_MAX) errors.push(`Auto run fight limit must be a whole number from ${AUTO_RUN_MIN} to ${AUTO_RUN_MAX}, or empty for no limit.`)
    else autoRunMaxFights = auto
  }
  const packedSupplies = draft.supplies.filter((id) => id !== '')
  const slotCount = packSlots(hero)
  if (draft.supplies.length > slotCount) errors.push(`Pack at most ${slotCount} supplies.`)
  if (overStacked(packedSupplies, slotCount) !== null) errors.push(STACK_LIMIT_REASON)
  if (packedSupplies.some((id) => supplyTable[id] === undefined)) errors.push('Pick a supply Greyhaven sells, or leave the slot empty.')
  if (!REPEAT_LIMITS.includes(draft.repeatLimit)) errors.push(`Pick a run limit of ${REPEAT_LIMITS.join(', ')} (0 is no limit).`)
  if (draft.autoRunMode !== undefined && draft.autoRunMode !== 'repeat' && draft.autoRunMode !== 'endless' && draft.autoRunMode !== 'echo') errors.push('Pick what Auto run does when the route ends: repeat it, keep going, or climb Echo ranks.')
  if (!BAG_FULL_ORDERS.includes(draft.bagFullOrder)) errors.push('Pick what to do when the bag is nearly full: walk home, ask or keep going.')
  if (draft.awayRouteId !== '' && routes[draft.awayRouteId] === undefined) errors.push('Pick a route Greyhaven knows for away runs, or none.')
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    hero: {
      ...hero,
      retreatAtMost,
      vow,
      curse,
      specialAmmo,
      carryGold,
      fightRank,
      packedSupplies,
      pushOnHpPercent,
      repeatRoute: draft.repeatRoute,
      repeatLimit: draft.repeatLimit,
      stopAfterFights,
      autoRun: draft.autoRun ?? hero.autoRun === true,
      autoRunMaxFights,
      autoRunMode: draft.autoRunMode ?? hero.autoRunMode,
      autoContracts: draft.autoContracts ?? hero.autoContracts === true,
      autoRepair: draft.autoRepair ?? hero.autoRepair === true,
      bagFullOrder: draft.bagFullOrder,
      awayRouteId: draft.awayRouteId === '' ? null : draft.awayRouteId,
    },
  }
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
