import { developmentItems, itemBase } from '../content/items.ts'
import { equipBlock, equipItem, gearFromEquipment, slotsFor, type EquipmentSlotId } from '../sim/economy.ts'
import { deriveHeroStats, type HeroDerivedStats } from '../sim/stats.ts'
import { renaissanceActive } from '../sim/progression.ts'
import { classWebs } from '../content/webs/index.ts'

import type { RosterResult } from './roster.ts'
import type { SaveData, SavedHero } from './save.ts'

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
    { label: 'Base action time', value: stats.actionTime, unit: ' s' },
  ]
}

export type EquipPreview = {
  /** The reason the item cannot be equipped, or null. */
  block: string | null
  slot: EquipmentSlotId | null
  /** Each stat before and after, for a legal equip. Empty when it is refused or the gear stays incomplete. */
  changes: { label: string; before: number; after: number; unit: string }[]
}

function withEquipped(hero: SavedHero, archive: SaveData['account']['archive'], itemId: string, slot: EquipmentSlotId | null) {
  return equipItem(hero.equipment, archive, itemId, slot, hero.progress.level, itemBase)
}

/** What equipping an archive item would do, without changing anything. */
export function previewEquip(save: SaveData, heroId: string, itemId: string, slot: EquipmentSlotId | null = null): EquipPreview {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  const item = save.account.archive.find((entry) => entry.id === itemId)
  if (hero === undefined || item === undefined) return { block: 'That item is not in the archive.', slot: null, changes: [] }
  const result = withEquipped(hero, save.account.archive, itemId, slot)
  if (!result.ok) return { block: result.reason, slot: null, changes: [] }
  const base = itemBase(item.baseId)
  const chosen = slot ?? (base === undefined ? null : (slotsFor(base).find((candidate) => equipBlock(hero.equipment, item, candidate, hero.progress.level, itemBase) === null) ?? null))
  const before = statsFor(hero)
  const after = statsFor({ ...hero, equipment: result.equipment })
  if (before === null || after === null) return { block: null, slot: chosen, changes: [] }
  const lines = statLines(before)
  const next = statLines(after)
  const changes = lines.flatMap((line, index) => {
    const changed = next[index]
    return changed !== undefined && changed.value !== line.value
      ? [{ label: line.label, before: line.value, after: changed.value, unit: line.unit }]
      : []
  })
  return { block: null, slot: chosen, changes }
}

/** Equip an archive item. Equipment cannot change while the hero is out on an expedition. */
export function equipFromArchive(save: SaveData, heroId: string, itemId: string, slot: EquipmentSlotId | null = null): RosterResult {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'That hero is not on the roster.' }
  if (save.expedition !== null) return { ok: false, reason: 'Equipment is locked while an expedition is running.' }
  const result = withEquipped(hero, save.account.archive, itemId, slot)
  if (!result.ok) return { ok: false, reason: result.reason }
  return {
    ok: true,
    save: {
      ...save,
      account: { ...save.account, archive: result.archive },
      heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, equipment: result.equipment } : entry)),
    },
  }
}

/** Development builds only: add a spread of weapons to the archive to try the equip rules. */
export function addDevelopmentItems(save: SaveData, heroId: string): SaveData {
  const hero = save.heroes.find((entry) => entry.id === heroId)
  const level = hero === undefined ? 1 : hero.progress.level
  let highest = 0
  for (const item of save.account.archive) {
    const match = /^dev-(\d+)$/.exec(item.id)
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]))
  }
  return { ...save, account: { ...save.account, archive: [...save.account.archive, ...developmentItems(highest + 1, level)] } }
}
