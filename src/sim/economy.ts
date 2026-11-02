import { CLASS_PREFERENCE, type HeroClass } from './constants.ts'
import type { ArmorCategory, ArmorSlot, OffHandKind, WeaponKind } from './constants.ts'
import type { AccessoryPiece, ArmorPiece, HeroGear, OffHandPiece, WeaponPiece } from './stats.ts'

/** The eight equipment slots. Accessories fill the two accessory slots in order. */
export const EQUIPMENT_SLOT_IDS = [
  'mainHand',
  'offHand',
  'head',
  'chest',
  'hands',
  'feet',
  'accessory0',
  'accessory1',
] as const
export type EquipmentSlotId = (typeof EQUIPMENT_SLOT_IDS)[number]

export const ITEM_MAX_DURABILITY = 100

/** What a kind of item is. The content tables hold one per base id. */
export type ItemBase =
  | { id: string; name: string; type: 'weapon'; weaponKind: WeaponKind }
  | { id: string; name: string; type: 'offHand'; offHandKind: OffHandKind }
  | { id: string; name: string; type: 'armor'; slot: ArmorSlot; category: ArmorCategory }
  | { id: string; name: string; type: 'accessory' }

/** One item the player owns. Plain JSON. Starter gear has quality 1 and no modifiers. */
export type ItemInstance = {
  id: string
  baseId: string
  itemLevel: number
  /** 1 is 100%. Crafted items vary from 0.9 to 1.1. */
  quality: number
  durability: number
  maxDurability: number
  modifiers: string[]
  /** Set on a hero's heirloom: its level follows that hero's level, up to `cap`. Only that hero can use it. */
  heirloom?: { heroId: string; cap: number }
}

/** Equipped items by slot. A hero needs every slot filled except the off-hand under a two-handed weapon. */
export type Equipment = { [slot in EquipmentSlotId]: ItemInstance | null }

export type BaseLookup = (baseId: string) => ItemBase | undefined

export function emptyEquipment(): Equipment {
  return {
    mainHand: null,
    offHand: null,
    head: null,
    chest: null,
    hands: null,
    feet: null,
    accessory0: null,
    accessory1: null,
  }
}

function baseOf(item: ItemInstance, lookup: BaseLookup): ItemBase {
  const base = lookup(item.baseId)
  if (base === undefined) throw new Error(`item ${item.id} has unknown base '${item.baseId}'`)
  return base
}

/** Slots an item can go in, in the order an equip action tries them. */
export function slotsFor(base: ItemBase): EquipmentSlotId[] {
  if (base.type === 'weapon') return ['mainHand']
  if (base.type === 'offHand') return ['offHand']
  if (base.type === 'armor') return [base.slot]
  return ['accessory0', 'accessory1']
}

function mainHandKind(equipment: Equipment, lookup: BaseLookup): WeaponKind | null {
  const main = equipment.mainHand
  if (main === null) return null
  const base = baseOf(main, lookup)
  return base.type === 'weapon' ? base.weaponKind : null
}

/** Null when the item can go in the slot. Otherwise the reason, in the words the screen shows. */
/** Who is wearing the item. A Cross-Trained hero can use any gear. */
export type Wearer = { classId: HeroClass; crossTrained: boolean }

/** The reason a class cannot use this kind of item, or null. Accessories are open to everyone. */
export function classBlock(wearer: Wearer, base: ItemBase): string | null {
  if (wearer.crossTrained || base.type === 'accessory') return null
  const preference = CLASS_PREFERENCE[wearer.classId]
  const allowed =
    base.type === 'weapon'
      ? preference.weapons.includes(base.weaponKind)
      : base.type === 'offHand'
        ? preference.offHands.includes(base.offHandKind)
        : preference.armor === base.category
  return allowed ? null : `${base.name} cannot be used by a ${wearer.classId}.`
}

export function equipBlock(
  equipment: Equipment,
  item: ItemInstance,
  slot: EquipmentSlotId,
  heroLevel: number,
  lookup: BaseLookup,
  wearer?: Wearer,
): string | null {
  const base = baseOf(item, lookup)
  if (wearer !== undefined) {
    const blocked = classBlock(wearer, base)
    if (blocked !== null) return blocked
  }
  for (const id of item.modifiers) {
    const modifier = ITEM_MODIFIERS[id]
    if (modifier !== undefined && modifier.minLevel > heroLevel) {
      return `${modifier.name} needs level ${modifier.minLevel}. This hero is level ${heroLevel}.`
    }
  }
  if (!slotsFor(base).includes(slot)) return `${base.name} does not fit the ${slot} slot.`
  if (item.itemLevel > heroLevel) return `${base.name} needs level ${item.itemLevel}. This hero is level ${heroLevel}.`
  if (base.type === 'offHand') {
    const main = mainHandKind(equipment, lookup)
    if (main === 'twoHanded') return 'A two-handed weapon disables the off-hand slot.'
    if (base.offHandKind === 'quiver' && main !== 'bow') return 'A quiver needs a bow in the main hand.'
  }
  return null
}

export type EquipResult =
  | { ok: true; equipment: Equipment; archive: ItemInstance[] }
  | { ok: false; reason: string }

/**
 * Put an archive item in a slot, or in the first slot that takes it when `slot` is null. The item it
 * replaces goes to the archive. A two-handed weapon sends the off-hand to the archive, and so does
 * swapping a bow for another weapon when the off-hand is a quiver.
 */
export function equipItem(
  equipment: Equipment,
  archive: readonly ItemInstance[],
  itemId: string,
  slot: EquipmentSlotId | null,
  heroLevel: number,
  lookup: BaseLookup,
  wearer?: Wearer,
): EquipResult {
  const item = archive.find((entry) => entry.id === itemId)
  if (item === undefined) return { ok: false, reason: 'That item is not in the archive.' }
  const base = baseOf(item, lookup)
  const choices = slot === null ? slotsFor(base) : [slot]
  let chosen: EquipmentSlotId | null = null
  let lastReason = `${base.name} does not fit any slot.`
  for (const candidate of choices) {
    const block = equipBlock(equipment, item, candidate, heroLevel, lookup, wearer)
    if (block === null) {
      chosen = candidate
      if (slot === null && base.type === 'accessory' && equipment[candidate] !== null) {
        const free = choices.find((other) => equipment[other] === null)
        if (free !== undefined) chosen = free
      }
      break
    }
    lastReason = block
  }
  if (chosen === null) return { ok: false, reason: lastReason }

  const next: Equipment = { ...equipment }
  const nextArchive = archive.filter((entry) => entry.id !== item.id)
  const replaced = next[chosen]
  if (replaced !== null) nextArchive.push(replaced)
  next[chosen] = item
  if (chosen === 'mainHand') {
    const kind = base.type === 'weapon' ? base.weaponKind : null
    const off = next.offHand
    if (off !== null) {
      const offBase = baseOf(off, lookup)
      const lost = kind === 'twoHanded' || (offBase.type === 'offHand' && offBase.offHandKind === 'quiver' && kind !== 'bow')
      if (lost) {
        nextArchive.push(off)
        next.offHand = null
      }
    }
  }
  return { ok: true, equipment: next, archive: nextArchive }
}

/** What is missing before the hero can fight. An empty list means the gear is complete. */
export function gearGaps(equipment: Equipment, lookup: BaseLookup): string[] {
  const gaps: string[] = []
  const main = mainHandKind(equipment, lookup)
  if (main === null) gaps.push('mainHand')
  for (const slot of ['head', 'chest', 'hands', 'feet', 'accessory0', 'accessory1'] as const) {
    if (equipment[slot] === null) gaps.push(slot)
  }
  if (main !== null && main !== 'twoHanded' && equipment.offHand === null) gaps.push('offHand')
  return gaps
}

/** The combat-facing gear for a complete set. Throws with the gaps when something is missing. */
export function gearFromEquipment(equipment: Equipment, lookup: BaseLookup): HeroGear {
  const gaps = gearGaps(equipment, lookup)
  if (gaps.length > 0) throw new Error(`gear is incomplete: ${gaps.join(', ')}`)
  const piece = (item: ItemInstance | null): ItemInstance => {
    if (item === null) throw new Error('gear is incomplete')
    return item
  }
  const mainItem = piece(equipment.mainHand)
  const mainBase = baseOf(mainItem, lookup)
  if (mainBase.type !== 'weapon') throw new Error(`${mainItem.id} is not a weapon`)
  const mainHand: WeaponPiece = {
    id: mainItem.id,
    kind: mainBase.weaponKind,
    itemLevel: mainItem.itemLevel,
    quality: mainItem.quality,
  }
  let offHand: OffHandPiece | null = null
  if (equipment.offHand !== null) {
    const offBase = baseOf(equipment.offHand, lookup)
    if (offBase.type !== 'offHand') throw new Error(`${equipment.offHand.id} is not an off-hand`)
    offHand = {
      id: equipment.offHand.id,
      kind: offBase.offHandKind,
      itemLevel: equipment.offHand.itemLevel,
      quality: equipment.offHand.quality,
    }
  }
  const armor = (slot: ArmorSlot): ArmorPiece => {
    const item = piece(equipment[slot])
    const base = baseOf(item, lookup)
    if (base.type !== 'armor' || base.slot !== slot) throw new Error(`${item.id} is not ${slot} armor`)
    return { id: item.id, slot, category: base.category, itemLevel: item.itemLevel, quality: item.quality }
  }
  const accessory = (slot: 'accessory0' | 'accessory1'): AccessoryPiece => {
    const item = piece(equipment[slot])
    return { id: item.id, itemLevel: item.itemLevel, quality: item.quality }
  }
  return {
    mainHand,
    offHand,
    head: armor('head'),
    chest: armor('chest'),
    hands: armor('hands'),
    feet: armor('feet'),
    accessories: [accessory('accessory0'), accessory('accessory1')],
  }
}

/** Copy the durabilities an expedition ended with back onto the items by id. Unknown ids are ignored. */
export function applyDurability(
  equipment: Equipment,
  entries: readonly { itemId: string; durability: number }[],
): Equipment {
  const next: Equipment = { ...equipment }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = next[slot]
    if (item === null) continue
    const entry = entries.find((candidate) => candidate.itemId === item.id)
    if (entry !== undefined) next[slot] = { ...item, durability: entry.durability }
  }
  return next
}

/** Flat or fractional bonuses an item modifier adds, named like the `deriveHeroStats` inputs they feed. */
export type StatBonuses = {
  accuracyBonus?: number
  evasionBonus?: number
  critChanceBonus?: number
  armorPenetrationBonus?: number
  magicalPenetrationBonus?: number
  equipmentHealingPower?: number
  cooldownReductionBonus?: number
}

export type ItemModifier = {
  id: string
  name: string
  /** The hero level needed to craft it and to wear an item that has it. */
  minLevel: number
  bonus: StatBonuses
  /** One line for the screens. */
  text: string
  /** The kinds of item it can be crafted on. */
  appliesTo: readonly ItemBase['type'][]
}

const TYPE_NAMES: { readonly [type in ItemBase['type']]: string } = {
  weapon: 'weapons',
  offHand: 'off-hand items',
  armor: 'armor',
  accessory: 'accessories',
}

/** The kinds of item a modifier can go on, in words, such as `weapons and accessories`. */
export function appliesToText(modifier: ItemModifier): string {
  const names = modifier.appliesTo.map((type) => TYPE_NAMES[type])
  return names.length <= 1 ? (names[0] ?? 'nothing') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Whether a modifier can be crafted on this kind of item. */
export function modifierFits(modifier: ItemModifier, base: ItemBase): boolean {
  return modifier.appliesTo.includes(base.type)
}

/** The six first-playable modifiers (G8). Percent values are fractions: 0.02 is 2 points. */
export const ITEM_MODIFIERS: { readonly [id: string]: ItemModifier } = {
  keen: { id: 'keen', name: 'Keen', minLevel: 1, bonus: { critChanceBonus: 0.02 }, text: '+2 points critical chance', appliesTo: ['weapon', 'accessory'] },
  precise: { id: 'precise', name: 'Precise', minLevel: 1, bonus: { accuracyBonus: 3 }, text: '+3 Accuracy', appliesTo: ['weapon', 'offHand', 'accessory'] },
  nimble: { id: 'nimble', name: 'Nimble', minLevel: 3, bonus: { evasionBonus: 3 }, text: '+3 Evasion', appliesTo: ['armor', 'accessory'] },
  piercing: {
    id: 'piercing',
    name: 'Piercing',
    minLevel: 6,
    bonus: { armorPenetrationBonus: 0.03, magicalPenetrationBonus: 0.03 },
    text: '+3 points armor and magical penetration',
    appliesTo: ['weapon'],
  },
  mending: { id: 'mending', name: 'Mending', minLevel: 6, bonus: { equipmentHealingPower: 5 }, text: '+5 Healing Power', appliesTo: ['offHand', 'accessory'] },
  quick: { id: 'quick', name: 'Quick', minLevel: 9, bonus: { cooldownReductionBonus: 0.02 }, text: '+2 points cooldown reduction', appliesTo: ['weapon', 'accessory'] },
}

/** The modifiers every hero's account knows at the start. */
export const STARTING_MODIFIER_RECIPES: readonly string[] = ['keen', 'precise']

/** The sum of every modifier on every equipped item. Empty when no modifier is equipped. */
export function statBonusesFor(equipment: Equipment): StatBonuses {
  const total: { [key in keyof StatBonuses]: number } = {}
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = equipment[slot]
    if (item === null) continue
    for (const id of item.modifiers) {
      const modifier = ITEM_MODIFIERS[id]
      if (modifier === undefined) continue
      for (const key of Object.keys(modifier.bonus) as (keyof StatBonuses)[]) {
        total[key] = (total[key] ?? 0) + (modifier.bonus[key] ?? 0)
      }
    }
  }
  return total
}
