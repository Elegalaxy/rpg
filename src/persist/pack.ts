import { SUPPLY_SLOT_COUNT, SUPPLY_STACK_LIMIT, overStackedSupply } from '../sim/expedition.ts'

import type { SavedHero } from './save.ts'

/** A crafted backpack (GAME_DESIGN section 9, Step 13.22). */
export type PackId = 'satchel' | 'fieldPack'

export type PackDef = {
  id: PackId
  name: string
  /** Supply slots a hero with this pack takes on the road. */
  slots: number
  minHeroLevel: number
  /** The lowest material grade it can be crafted from (the material's `UPGRADE_QUALITY_POINTS`). */
  minGrade: number
  /** Units of the material. */
  units: number
  gold: number
  /** The pack the hero must already own. */
  needs?: PackId
}

export const PACKS: { readonly [id in PackId]: PackDef } = {
  satchel: { id: 'satchel', name: 'Satchel', slots: 5, minHeroLevel: 10, minGrade: 2, units: 8, gold: 400 },
  fieldPack: { id: 'fieldPack', name: 'Field Pack', slots: 6, minHeroLevel: 17, minGrade: 3, units: 10, gold: 1200, needs: 'satchel' },
}

export const PACK_IDS: readonly PackId[] = ['satchel', 'fieldPack']

export function isPackId(value: unknown): value is PackId {
  return value === 'satchel' || value === 'fieldPack'
}

/** The supply slots a hero takes on the road: 4 without a pack, else the pack's count. */
export function packSlots(hero: Pick<SavedHero, 'pack'>): number {
  return hero.pack === undefined ? SUPPLY_SLOT_COUNT : PACKS[hero.pack].slots
}

/** The most of one supply a hero's run may carry, or null for no limit (4 slots). */
export function stackLimit(slotCount: number): number | null {
  return slotCount > SUPPLY_SLOT_COUNT ? SUPPLY_STACK_LIMIT : null
}

/** The packs a hero can still craft, best first is not implied: the pack after the one owned, or null when the hero has the Field Pack. */
export function nextPack(hero: Pick<SavedHero, 'pack'>): PackId | null {
  if (hero.pack === undefined) return 'satchel'
  return hero.pack === 'satchel' ? 'fieldPack' : null
}

/** The supply ids with a third copy cut off (above 4 slots), in slot order. Four slots keep every pick. */
export function limitStacks(ids: readonly string[], slotCount: number): string[] {
  if (stackLimit(slotCount) === null) return [...ids]
  const counts: { [id: string]: number } = {}
  return ids.filter((id) => {
    if (id === '') return true
    counts[id] = (counts[id] ?? 0) + 1
    return counts[id] <= SUPPLY_STACK_LIMIT
  })
}

/** The supply id a pick list carries too many of for this slot count, or null. */
export function overStacked(ids: readonly string[], slotCount: number): string | null {
  return overStackedSupply(ids.filter((id) => id !== ''), slotCount)
}

export const STACK_LIMIT_REASON = `At most ${SUPPLY_STACK_LIMIT} of each supply with a backpack.`
