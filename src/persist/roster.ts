import { starterEquipment } from '../content/items.ts'
import { classWebs } from '../content/webs/index.ts'
import { racialStartingAttributes } from '../content/heroes.ts'
import { referenceLoadoutFor } from '../content/scenarios.ts'
import { startingRules } from '../content/supplies.ts'
import { withFilledBoard } from './contracts.ts'
import { HERO_UPDATES } from './heroUpdates.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createProgress, HERO_RACES, type HeroRace } from '../sim/progression.ts'

import { EMPTY_PURCHASES, DEFAULT_BAG_FULL_ORDER, DEFAULT_CARRY_GOLD, DEFAULT_PUSH_ON_PERCENT, DEFAULT_RETREAT, MAX_SLOTS, emptyPurse, type SaveData, type SavedHero } from './save.ts'

export const NAME_MIN = 1
export const NAME_MAX = 24

export type RosterResult = { ok: true; save: SaveData; hero?: SavedHero } | { ok: false; reason: string }

export type NewHero = {
  name: string
  race: HeroRace
  classId: HeroClass
}

/** Trim, then count characters rather than UTF-16 units. */
export function normalizeName(name: string): string {
  return name.trim()
}

/** Null when the name is allowed. Otherwise the message to show. */
export function nameProblem(name: string, save: SaveData): string | null {
  const trimmed = normalizeName(name)
  const length = Array.from(trimmed).length
  if (length < NAME_MIN) return 'Enter a name.'
  if (length > NAME_MAX) return `Names can be at most ${NAME_MAX} characters.`
  const lowered = trimmed.toLowerCase()
  if (save.heroes.some((hero) => hero.name.toLowerCase() === lowered)) {
    return `A hero named "${trimmed}" is already on the roster.`
  }
  return null
}

export function freeSlots(save: SaveData): number {
  return save.account.slots - save.heroes.length
}

function nextHeroId(save: SaveData): string {
  let highest = 0
  for (const hero of save.heroes) {
    const match = /^hero-(\d+)$/.exec(hero.id)
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]))
  }
  return `hero-${highest + 1}`
}

/**
 * Add a level 1 hero with the racial starting attributes, the four class starting skills, and the
 * reference priority rows. Any of the 20 race and class pairs works, and duplicates are allowed.
 * The first hero, or any hero created while no expedition runs, becomes the selected one.
 */
export function createHero(save: SaveData, request: NewHero): RosterResult {
  if (!(HERO_RACES as readonly string[]).includes(request.race)) return { ok: false, reason: 'Pick a race.' }
  if (!(HERO_CLASSES as readonly string[]).includes(request.classId)) return { ok: false, reason: 'Pick a class.' }
  const problem = nameProblem(request.name, save)
  if (problem !== null) return { ok: false, reason: problem }
  if (freeSlots(save) < 1) {
    return { ok: false, reason: `The roster is full (${save.account.slots} of ${MAX_SLOTS} slots in use).` }
  }
  const loadout = referenceLoadoutFor(request.classId)
  const web = classWebs[request.classId]
  const id = nextHeroId(save)
  const hero: SavedHero = {
    id,
    name: normalizeName(request.name),
    classId: request.classId,
    progress: createProgress(request.race, racialStartingAttributes[request.race], {
      startingSkillIds: web.startingSkillIds,
    }),
    priorityRows: startingRules(loadout.priorityRows),
    vow: request.classId === 'cleric' ? (loadout.vow ?? 'zeal') : null,
    curse: null,
    preparedSpells: [],
    defeatedEnemyIds: [],
    clearedNodeIds: [],
    retreatAtMost: DEFAULT_RETREAT,
    specialAmmo: loadout.specialAmmo ?? 0,
    carryGold: DEFAULT_CARRY_GOLD,
    packedSupplies: [],
    pushOnHpPercent: DEFAULT_PUSH_ON_PERCENT,
    repeatRoute: true,
    repeatLimit: 0,
    bagFullOrder: DEFAULT_BAG_FULL_ORDER,
    awayRouteId: null,
    awayRun: null,
    routeReturns: {},
    updates: [...HERO_UPDATES],
    craftXp: 0,
    legacy: 0,
    lives: 0,
    purchases: JSON.parse(JSON.stringify(EMPTY_PURCHASES)) as typeof EMPTY_PURCHASES,
    claimedBonuses: [],
    echoRank: 0,
    fightRank: 0,
    bossLossThisLife: false,
    equipment: starterEquipment(id, request.classId),
    purse: emptyPurse(),
  }
  const boarded = withFilledBoard(hero, save.account.discoveries)
  const next: SaveData = {
    ...save,
    heroes: [...save.heroes, boarded],
    selectedHeroId: save.expedition === null || save.selectedHeroId === null ? hero.id : save.selectedHeroId,
  }
  return { ok: true, save: next, hero: boarded }
}

/** The selected hero cannot change while an expedition is running. */
export function selectHero(save: SaveData, heroId: string): RosterResult {
  if (!save.heroes.some((hero) => hero.id === heroId)) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null && save.selectedHeroId !== heroId) {
    return { ok: false, reason: 'Finish the expedition before switching heroes.' }
  }
  if (save.selectedHeroId === heroId) return { ok: true, save }
  // A run the hero kept going in the background comes onto the live screen. The current hero has no run.
  const away = save.heroes.find((hero) => hero.id === heroId)?.awayRun ?? null
  if (away === null) return { ok: true, save: { ...save, selectedHeroId: heroId } }
  const heroes = save.heroes.map((hero) => (hero.id === heroId ? { ...hero, awayRun: null } : hero))
  return { ok: true, save: { ...save, heroes, selectedHeroId: heroId, expedition: away } }
}

/**
 * Remove a hero for good, with their purse, gear, and crafting queue. Recipes, the map, and slots belong to the
 * account and stay. Refused while an expedition runs. If the selected hero goes, the first one left is selected.
 */
export function deleteHero(save: SaveData, heroId: string): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Finish the expedition before deleting a hero.' }
  if (hero.awayRun !== null) return { ok: false, reason: `${hero.name} is out on an away run. Select the hero and close the run on the Map first.` }
  const heroes = save.heroes.filter((entry) => entry.id !== heroId)
  const selectedHeroId = save.selectedHeroId === heroId ? (heroes[0]?.id ?? null) : save.selectedHeroId
  return { ok: true, save: { ...save, heroes, selectedHeroId } }
}

/** Development builds only: open every slot so the 20 pairs can be checked by hand. */
export function unlockAllSlots(save: SaveData): SaveData {
  return { ...save, account: { ...save.account, slots: MAX_SLOTS } }
}
