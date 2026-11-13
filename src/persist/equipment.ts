import { developmentItems, itemBase, itemName } from '../content/items.ts'
import { ITEM_MODIFIERS, equipBlock, equipItem, gearFromEquipment, slotsFor, statBonusesFor, type EquipmentSlotId, type ItemInstance, type Wearer } from '../sim/economy.ts'
import { NODE_HUMAN_CROSS_TRAINING } from '../sim/races/racialNodes.ts'
import { deriveHeroStats, type HeroDerivedStats } from '../sim/stats.ts'
import { renaissanceActive } from '../sim/progression.ts'
import { classWebs } from '../content/webs/index.ts'

import { bagCapacity } from './bag.ts'
import type { RosterResult } from './roster.ts'
import { updatePurse, type SaveData, type SavedHero } from './save.ts'

/** Derived stats for what the hero has equipped now, or null when the gear is incomplete. */
export function statsFor(hero: SavedHero): HeroDerivedStats | null {
  let gear
  try {
    gear = gearFromEquipment(hero.equipment, itemBase)
  } catch {
    return null
  }
  const nodeIds = hero.progress.allocatedNodeIds
  return deriveHeroStats({
    level: hero.progress.level,
    classId: hero.classId,
    attributes: hero.progress.attributes,
    gear,
    racialNodeIds: nodeIds,
    renaissance: renaissanceActive(nodeIds, classWebs[hero.classId]),
    ...statBonusesFor(hero.equipment),
  })
}

export type StatLine = { label: string; value: number; unit: string }

/** The numbers the equipment screen shows. Every one comes straight from `deriveHeroStats`. */
export function statLines(stats: HeroDerivedStats): StatLine[] {
  return [
    { label: 'Maximum HP', value: stats.maxHp, unit: '' },
    { label: 'Physical Power', value: stats.physicalPower, unit: '' },
    { label: 'Magical Power', value: stats.magicalPower, unit: '' },
    { label: 'Healing Power', value: stats.healingPower, unit: '' },
    { label: 'Armor', value: stats.armor, unit: '' },
    { label: 'Resistance', value: stats.resistance, unit: '' },
    { label: 'Evasion', value: stats.evasion, unit: '' },
    { label: 'Accuracy', value: stats.accuracy, unit: '' },
    { label: 'Critical chance', value: Math.round(stats.critChance * 1000) / 10, unit: '%' },
    { label: 'Critical damage', value: Math.round(stats.critDamage * 1000) / 10, unit: '%' },
    { label: 'Armor penetration', value: Math.round(stats.armorPenetration * 1000) / 10, unit: '%' },
    { label: 'Magical penetration', value: Math.round(stats.magicalPenetration * 1000) / 10, unit: '%' },
    { label: 'Life steal', value: Math.round(stats.lifestealFraction * 1000) / 10, unit: '%' },
    { label: 'Magical status resistance', value: stats.magicalStatusResistance, unit: '' },
    { label: 'Cooldown reduction', value: Math.round(stats.cooldownReduction * 1000) / 10, unit: '%' },
    { label: 'Base action time', value: stats.actionTime, unit: ' s' },
  ]
}

/** Stats where a lower number is the better one. */
const LOWER_IS_BETTER = ['Base action time']

/** Whether a change in a stat helps the hero. Always true or false, since a change has a direction. */
export function changeIsBetter(label: string, before: number, after: number): boolean {
  return LOWER_IS_BETTER.includes(label) ? after < before : after > before
}

export type EquipPreview = {
  /** The reason the item cannot be equipped, or null. */
  block: string | null
  slot: EquipmentSlotId | null
  /** Each stat before and after, for a legal equip. Empty when it is refused or the gear stays incomplete. */
  changes: { label: string; before: number; after: number; unit: string }[]
  /** The worn piece this one takes the place of, or null when the slot is empty or the equip is refused. */
  replaces: ReplacedPiece | null
  /** Changes that are not hero stats, such as bag room, before and after. Empty when nothing of the kind changes. */
  extras: { label: string; before: number; after: number; unit: string }[]
  /** Modifiers lost or gained, in words, for example "Loses Hauler's: +3 bag room". */
  notes: string[]
}

/** A worn item as the comparison names it. */
export type ReplacedPiece = { name: string; itemLevel: number; quality: number; durability: number; maxDurability: number }

const NO_PREVIEW: Pick<EquipPreview, 'replaces' | 'extras' | 'notes'> = { replaces: null, extras: [], notes: [] }

function replacedPiece(item: ItemInstance | null | undefined): ReplacedPiece | null {
  if (item === null || item === undefined) return null
  return { name: itemName(item), itemLevel: item.itemLevel, quality: item.quality, durability: item.durability, maxDurability: item.maxDurability }
}

/** The modifiers that leave the hero and those that arrive, from the whole worn set before and after. */
function modifierNotes(before: readonly ItemInstance[], after: readonly ItemInstance[]): string[] {
  const count = (items: readonly ItemInstance[]) => {
    const tally: { [id: string]: number } = {}
    for (const item of items) for (const id of item.modifiers) tally[id] = (tally[id] ?? 0) + 1
    return tally
  }
  const was = count(before)
  const now = count(after)
  const notes: string[] = []
  for (const id of Object.keys(was)) {
    if ((now[id] ?? 0) < (was[id] ?? 0)) notes.push(`Loses ${ITEM_MODIFIERS[id]?.name ?? id}: ${ITEM_MODIFIERS[id]?.text ?? ''}`)
  }
  for (const id of Object.keys(now)) {
    if ((was[id] ?? 0) < (now[id] ?? 0)) notes.push(`Gains ${ITEM_MODIFIERS[id]?.name ?? id}: ${ITEM_MODIFIERS[id]?.text ?? ''}`)
  }
  return notes
}

function worn(hero: SavedHero): ItemInstance[] {
  return Object.values(hero.equipment).flatMap((item) => (item === null ? [] : [item]))
}

/** Who the hero is for the class gear rule. */
export function wearerOf(hero: SavedHero): Wearer {
  return { classId: hero.classId, crossTrained: hero.progress.allocatedNodeIds.includes(NODE_HUMAN_CROSS_TRAINING) }
}

function withEquipped(hero: SavedHero, itemId: string, slot: EquipmentSlotId | null) {
  return equipItem(hero.equipment, hero.purse.archive, itemId, slot, hero.progress.level, itemBase, wearerOf(hero))
}

/** What equipping an item from the hero's archive would do, without changing anything. */
export function previewEquip(save: SaveData, heroId: string, itemId: string, slot: EquipmentSlotId | null = null): EquipPreview {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  const item = hero?.purse.archive.find((entry) => entry.id === itemId)
  if (hero === undefined || item === undefined) return { block: 'That item is not in the archive.', slot: null, changes: [], ...NO_PREVIEW }
  const result = withEquipped(hero, itemId, slot)
  if (!result.ok) return { block: result.reason, slot: null, changes: [], ...NO_PREVIEW }
  const base = itemBase(item.baseId)
  const chosen = slot ?? (base === undefined ? null : (slotsFor(base).find((candidate) => equipBlock(hero.equipment, item, candidate, hero.progress.level, itemBase, wearerOf(hero)) === null) ?? null))
  const afterHero = { ...hero, equipment: result.equipment }
  const replaces = chosen === null ? null : replacedPiece(hero.equipment[chosen])
  const extras: EquipPreview['extras'] = []
  const bagBefore = bagCapacity(hero)
  const bagAfter = bagCapacity(afterHero)
  if (bagBefore !== bagAfter) extras.push({ label: 'Bag room', before: bagBefore, after: bagAfter, unit: '' })
  const notes = modifierNotes(worn(hero), worn(afterHero))
  const before = statsFor(hero)
  const after = statsFor(afterHero)
  if (before === null || after === null) return { block: null, slot: chosen, changes: [], replaces, extras, notes }
  const lines = statLines(before)
  const next = statLines(after)
  const changes = lines.flatMap((line, index) => {
    const changed = next[index]
    return changed !== undefined && changed.value !== line.value
      ? [{ label: line.label, before: line.value, after: changed.value, unit: line.unit }]
      : []
  })
  return { block: null, slot: chosen, changes, replaces, extras, notes }
}

/** Equip an item from the hero's archive. Equipment cannot change while the hero is out on an expedition. */
export function equipFromArchive(save: SaveData, heroId: string, itemId: string, slot: EquipmentSlotId | null = null): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Equipment is locked while an expedition is running.' }
  const wanted = hero.purse.archive.find((entry) => entry.id === itemId)
  if (wanted?.heirloom !== undefined && wanted.heirloom.heroId !== heroId) {
    return { ok: false, reason: 'That is another hero\'s heirloom.' }
  }
  const result = withEquipped(hero, itemId, slot)
  if (!result.ok) return { ok: false, reason: result.reason }
  return {
    ok: true,
    save: {
      ...save,
      heroes: save.heroes.map((entry) =>
        entry.id === heroId ? { ...entry, equipment: result.equipment, purse: { ...entry.purse, archive: result.archive } } : entry,
      ),
    },
  }
}

/**
 * Take a worn item off and put it in the hero's archive. Taking off a bow also sends a worn quiver to the
 * archive, because a quiver needs a bow. The hero cannot start a run until the slot is filled again.
 */
export function unequipToArchive(save: SaveData, heroId: string, slot: EquipmentSlotId): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Equipment is locked while an expedition is running.' }
  const item = hero.equipment[slot]
  if (item === null) return { ok: false, reason: 'Nothing is worn in that slot.' }
  const equipment = { ...hero.equipment, [slot]: null }
  const moved = [item]
  const off = hero.equipment.offHand
  if (slot === 'mainHand' && off !== null) {
    const offBase = itemBase(off.baseId)
    if (offBase?.type === 'offHand' && offBase.offHandKind === 'quiver') {
      equipment.offHand = null
      moved.push(off)
    }
  }
  return {
    ok: true,
    save: {
      ...save,
      heroes: save.heroes.map((entry) =>
        entry.id === heroId ? { ...entry, equipment, purse: { ...entry.purse, archive: [...entry.purse.archive, ...moved] } } : entry,
      ),
    },
  }
}

/** Development builds only: add a spread of weapons to the hero's archive to try the equip rules. */
export function addDevelopmentItems(save: SaveData, heroId: string): SaveData {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return save
  let highest = 0
  for (const item of hero.purse.archive) {
    const match = /^dev-(\d+)$/.exec(item.id)
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]))
  }
  const archive = [...hero.purse.archive, ...developmentItems(highest + 1, hero.progress.level)]
  return updatePurse(save, { archive }, heroId)
}
