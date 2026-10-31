import { racialStartingAttributes } from '../content/heroes.ts'
import { starterEquipment } from '../content/items.ts'
import { referenceLoadoutFor } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { EQUIPMENT_SLOT_IDS, type ItemInstance } from '../sim/economy.ts'
import { createProgress, legacyFromProgress } from '../sim/progression.ts'
import type { Attributes } from '../sim/stats.ts'

import { reachMilestone, type AccountData, type HeroPurchases, type SaveData, type SavedHero } from './save.ts'
import type { RosterResult } from './roster.ts'

export const MASTERY_MAX = 10
export const MASTERY_XP_PER_RANK = 0.02

export const ELITE_BONUS = 3
export const BOSS_BONUS = 20
export const RANK_BONUS = 5

export const ATTRIBUTE_SEED_COST = 3
export const ATTRIBUTE_SEED_MAX = 10
export const SKILL_SEED_COSTS: readonly number[] = [8, 12, 16]
export const SECOND_HEIRLOOM_COST = 25

export type Bonus = { id: string; text: string; amount: number }

/** Mastery rank: lives completed, up to 10. It adds 2% ordinary XP per rank and nothing else. */
export function masteryRank(hero: SavedHero): number {
  return hero.lives > MASTERY_MAX ? MASTERY_MAX : hero.lives
}

export function masteryXpFactor(rank: number): number {
  return 1 + MASTERY_XP_PER_RANK * rank
}

/** One-time bonuses this hero has earned and not yet been paid, from what they have reached this life. */
export function bonusesDue(hero: SavedHero): Bonus[] {
  const due: Bonus[] = []
  const reached = (id: string): boolean => hero.defeatedEnemyIds.includes(id)
  const add = (id: string, text: string, amount: number): void => {
    if (!hero.claimedBonuses.includes(id)) due.push({ id, text, amount })
  }
  if (reached('rootmaw-stalker')) add('elite:rootmaw-stalker', 'First defeat of the Rootmaw Stalker', ELITE_BONUS)
  if (reached('echo-knight')) add('elite:echo-knight', 'First defeat of the Echo Knight', ELITE_BONUS)
  if (reached('fractured-warden')) add('boss:fractured-warden', 'First defeat of the Fractured Warden', BOSS_BONUS)
  for (let rank = 1; rank <= hero.echoRank; rank += 1) add(`rank:${rank}`, `Echo rank ${rank} first unlocked`, RANK_BONUS)
  return due
}

export type LegacyPreview = {
  fromLevel: number
  bonuses: Bonus[]
  total: number
}

export function legacyPreview(hero: SavedHero): LegacyPreview {
  const fromLevel = legacyFromProgress(hero.progress)
  const bonuses = bonusesDue(hero)
  return { fromLevel, bonuses, total: fromLevel + bonuses.reduce((sum, bonus) => sum + bonus.amount, 0) }
}

/** Null when the hero can reincarnate. A boss must have beaten them this life, with its defeat costs paid. */
export function reincarnationBlock(save: SaveData, hero: SavedHero): string | null {
  if (save.expedition !== null) return 'Finish the expedition first.'
  if (!hero.bossLossThisLife) return 'Lose to a boss first. Reincarnation opens after a boss defeats you this life.'
  return null
}

/** How many heirlooms this hero may keep: one, or two with the Second Heirloom. */
export function heirloomAllowance(hero: SavedHero): number {
  return hero.purchases.secondHeirloom ? 2 : 1
}

export function heirloomLevel(item: ItemInstance, heroLevel: number): number {
  const cap = item.heirloom?.cap ?? item.itemLevel
  const level = heroLevel < cap ? heroLevel : cap
  return level < 1 ? 1 : level
}

function allItems(hero: SavedHero, account: AccountData): ItemInstance[] {
  const equipped = EQUIPMENT_SLOT_IDS.flatMap((slot) => {
    const item = hero.equipment[slot]
    return item === null ? [] : [item]
  })
  return [...equipped, ...account.archive]
}

/** Bring every one of this hero's heirlooms to the level their level allows. Run after any level change. */
export function scaleHeirlooms(save: SaveData, heroId: string): SaveData {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return save
  let changed = false
  const fix = (item: ItemInstance): ItemInstance => {
    if (item.heirloom === undefined || item.heirloom.heroId !== heroId) return item
    const level = heirloomLevel(item, hero.progress.level)
    if (level === item.itemLevel) return item
    changed = true
    return { ...item, itemLevel: level }
  }
  const equipment = { ...hero.equipment }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = equipment[slot]
    if (item !== null) equipment[slot] = fix(item)
  }
  const archive = save.account.archive.map(fix)
  if (!changed) return save
  return {
    ...save,
    account: { ...save.account, archive },
    heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment } : entry)),
  }
}

function startingAttributes(hero: SavedHero): Attributes {
  const base = racialStartingAttributes[hero.progress.race]
  const seeds = hero.purchases.attributeSeeds
  return {
    strength: base.strength + seeds.strength,
    vitality: base.vitality + seeds.vitality,
    agility: base.agility + seeds.agility,
    intellect: base.intellect + seeds.intellect,
    spirit: base.spirit + seeds.spirit,
  }
}

/**
 * Reincarnate a hero. Level, XP, attributes, the skill web, personal gates and Echo ranks, and the
 * account's contracts reset. Mastery, purchases, Legacy, discoveries, recipes, crafting experience,
 * deposited gold, materials, and the archive stay. All worn gear goes to the archive and the hero gets
 * fresh starter gear, and the chosen item becomes an heirloom.
 */
export function reincarnate(save: SaveData, heroId: string, heirloomItemId: string | null): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  const block = reincarnationBlock(save, hero)
  if (block !== null) return { ok: false, reason: block }

  const owned = allItems(hero, save.account)
  const chosen = heirloomItemId === null ? null : owned.find((item) => item.id === heirloomItemId)
  if (heirloomItemId !== null && chosen === undefined) return { ok: false, reason: 'That item is not yours to keep.' }
  if (chosen !== null && chosen !== undefined && chosen.heirloom !== undefined && chosen.heirloom.heroId !== heroId) {
    return { ok: false, reason: 'That is another hero\'s heirloom.' }
  }

  const preview = legacyPreview(hero)
  const lives = hero.lives + 1
  const web = classWebs[hero.classId]
  const progress = createProgress(hero.progress.race, startingAttributes(hero), { startingSkillIds: web.startingSkillIds })
  progress.legacySkillPoints = hero.purchases.skillSeeds
  const loadout = referenceLoadoutFor(hero.classId)

  // Every worn item goes to the archive. Heirlooms already kept stay flagged up to the allowance.
  const archive: ItemInstance[] = [...save.account.archive]
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = hero.equipment[slot]
    if (item !== null) archive.push(item)
  }
  const allowance = heirloomAllowance(hero)
  const previous = archive.filter((item) => item.heirloom?.heroId === heroId && item.id !== heirloomItemId)
  const keepPrevious = new Set(previous.slice(0, Math.max(0, allowance - (heirloomItemId === null ? 0 : 1))).map((item) => item.id))
  const nextArchive = archive.map((item): ItemInstance => {
    if (item.id === heirloomItemId) {
      const cap = item.heirloom?.cap ?? item.itemLevel
      return { ...item, heirloom: { heroId, cap } }
    }
    if (item.heirloom?.heroId === heroId && !keepPrevious.has(item.id)) {
      const { heirloom, ...plain } = item
      return { ...plain, itemLevel: heirloom.cap }
    }
    return item
  })

  const renewed: SavedHero = {
    ...hero,
    progress,
    priorityRows: loadout.priorityRows.map((row) => ({ ...row })),
    preparedSpells: [],
    defeatedEnemyIds: [],
    clearedNodeIds: [],
    echoRank: 0,
    fightRank: 0,
    bossLossThisLife: false,
    legacy: hero.legacy + preview.total,
    lives,
    claimedBonuses: [...hero.claimedBonuses, ...preview.bonuses.map((bonus) => bonus.id)],
    equipment: starterEquipment(hero.id, hero.classId, lives),
  }
  const account = reachMilestone({ ...save.account, archive: nextArchive, contracts: [] }, 'first-reincarnation')
  const next: SaveData = { ...save, account, heroes: save.heroes.map((entry) => (entry.id === heroId ? renewed : entry)) }
  return { ok: true, save: scaleHeirlooms(next, heroId), hero: renewed }
}

export type PurchaseKind = 'attribute' | 'skill' | 'heirloom'

export function skillSeedCost(purchases: HeroPurchases): number | null {
  return SKILL_SEED_COSTS[purchases.skillSeeds] ?? null
}

export function attributeSeedTotal(purchases: HeroPurchases): number {
  const seeds = purchases.attributeSeeds
  return seeds.strength + seeds.vitality + seeds.agility + seeds.intellect + seeds.spirit
}

/** Spend Legacy on a purchase. It is bound to the hero and survives every later life. */
export function buyPurchase(
  save: SaveData,
  heroId: string,
  kind: PurchaseKind,
  attribute?: keyof HeroPurchases['attributeSeeds'],
): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Finish the expedition first.' }
  let cost: number
  let purchases: HeroPurchases = hero.purchases
  if (kind === 'attribute') {
    if (attribute === undefined || !(attribute in hero.purchases.attributeSeeds)) return { ok: false, reason: 'Pick an attribute.' }
    if (attributeSeedTotal(hero.purchases) >= ATTRIBUTE_SEED_MAX) return { ok: false, reason: `You already have ${ATTRIBUTE_SEED_MAX} attribute seeds.` }
    cost = ATTRIBUTE_SEED_COST
    purchases = { ...purchases, attributeSeeds: { ...purchases.attributeSeeds, [attribute]: purchases.attributeSeeds[attribute] + 1 } }
  } else if (kind === 'skill') {
    const price = skillSeedCost(hero.purchases)
    if (price === null) return { ok: false, reason: 'You already have all 3 skill point seeds.' }
    cost = price
    purchases = { ...purchases, skillSeeds: purchases.skillSeeds + 1 }
  } else {
    if (hero.purchases.secondHeirloom) return { ok: false, reason: 'You already have the Second Heirloom.' }
    cost = SECOND_HEIRLOOM_COST
    purchases = { ...purchases, secondHeirloom: true }
  }
  if (hero.legacy < cost) return { ok: false, reason: `That costs ${cost} Legacy. ${hero.name} has ${hero.legacy}.` }
  return {
    ok: true,
    save: { ...save, heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, legacy: entry.legacy - cost, purchases } : entry)) },
  }
}
