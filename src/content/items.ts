import { ARMOR_SLOTS, HERO_CLASSES, type ArmorCategory, type ArmorSlot, type HeroClass } from '../sim/constants.ts'
import {
  ITEM_MAX_DURABILITY,
  emptyEquipment,
  type Equipment,
  type ItemBase,
  type ItemInstance,
} from '../sim/economy.ts'

const SLOT_NAMES: { [slot in ArmorSlot]: string } = { head: 'Helm', chest: 'Chestpiece', hands: 'Gloves', feet: 'Boots' }
const CATEGORY_NAMES: { [category in ArmorCategory]: string } = {
  heavy: 'Heavy',
  medium: 'Medium',
  light: 'Light',
  cloth: 'Cloth',
}

function armorBases(): ItemBase[] {
  const bases: ItemBase[] = []
  for (const category of ['heavy', 'medium', 'light', 'cloth'] as const) {
    for (const slot of ARMOR_SLOTS) {
      bases.push({
        id: `armor-${category}-${slot}`,
        name: `${CATEGORY_NAMES[category]} ${SLOT_NAMES[slot]}`,
        type: 'armor',
        slot,
        category,
      })
    }
  }
  return bases
}

const bases: ItemBase[] = [
  { id: 'weapon-one-handed', name: 'One-handed Weapon', type: 'weapon', weaponKind: 'oneHanded' },
  { id: 'weapon-two-handed', name: 'Two-handed Weapon', type: 'weapon', weaponKind: 'twoHanded' },
  { id: 'weapon-dagger', name: 'Dagger', type: 'weapon', weaponKind: 'dagger' },
  { id: 'weapon-bow', name: 'Bow', type: 'weapon', weaponKind: 'bow' },
  { id: 'weapon-caster', name: 'Caster Weapon', type: 'weapon', weaponKind: 'caster' },
  { id: 'offhand-shield', name: 'Shield', type: 'offHand', offHandKind: 'shield' },
  { id: 'offhand-focus', name: 'Caster Focus', type: 'offHand', offHandKind: 'focus' },
  { id: 'offhand-dagger', name: 'Off-hand Dagger', type: 'offHand', offHandKind: 'dagger' },
  { id: 'offhand-quiver', name: 'Quiver', type: 'offHand', offHandKind: 'quiver' },
  ...armorBases(),
  { id: 'accessory-ring', name: 'Ring', type: 'accessory' },
  { id: 'accessory-charm', name: 'Charm', type: 'accessory' },
]

export const itemBases: { readonly [id: string]: ItemBase } = Object.fromEntries(bases.map((base) => [base.id, base]))

export function itemBase(baseId: string): ItemBase | undefined {
  return itemBases[baseId]
}

export function itemName(item: ItemInstance): string {
  return itemBase(item.baseId)?.name ?? item.baseId
}

/** The Q-reference loadout for each class (§7): preferred weapon, off-hand, and armor. */
const STARTER: { [classId in HeroClass]: { main: string; off: string; armor: ArmorCategory } } = {
  warrior: { main: 'weapon-one-handed', off: 'offhand-shield', armor: 'heavy' },
  assassin: { main: 'weapon-dagger', off: 'offhand-dagger', armor: 'light' },
  ranger: { main: 'weapon-bow', off: 'offhand-quiver', armor: 'medium' },
  mage: { main: 'weapon-caster', off: 'offhand-focus', armor: 'cloth' },
  cleric: { main: 'weapon-caster', off: 'offhand-shield', armor: 'medium' },
}

export function newItem(id: string, baseId: string, itemLevel: number, quality = 1): ItemInstance {
  if (itemBase(baseId) === undefined) throw new Error(`unknown item base '${baseId}'`)
  return { id, baseId, itemLevel, quality, durability: ITEM_MAX_DURABILITY, maxDurability: ITEM_MAX_DURABILITY, modifiers: [] }
}

/** Basic level 1 gear: exactly 100% quality and no modifiers (§7). Ids are tied to the hero. */
export function starterEquipment(heroId: string, classId: HeroClass): Equipment {
  if (!(HERO_CLASSES as readonly string[]).includes(classId)) throw new Error(`unknown hero class '${classId}'`)
  const plan = STARTER[classId]
  const equipment = emptyEquipment()
  const make = (slot: string, baseId: string) => newItem(`${heroId}-${slot}`, baseId, 1)
  equipment.mainHand = make('mainHand', plan.main)
  equipment.offHand = make('offHand', plan.off)
  for (const slot of ARMOR_SLOTS) equipment[slot] = make(slot, `armor-${plan.armor}-${slot}`)
  equipment.accessory0 = make('accessory0', 'accessory-ring')
  equipment.accessory1 = make('accessory1', 'accessory-charm')
  return equipment
}

/**
 * Development builds only: a spread of weapons for trying the equip rules. `first` makes the ids
 * unique. The two-handed weapon is the one that disables the off-hand.
 */
export function developmentItems(first: number, itemLevel: number): ItemInstance[] {
  const spec: [string, number][] = [
    ['weapon-two-handed', 1],
    ['weapon-one-handed', 1.1],
    ['weapon-dagger', 0.9],
    ['weapon-bow', 1],
    ['offhand-quiver', 1],
    ['offhand-shield', 1.05],
  ]
  return spec.map(([baseId, quality], index) => newItem(`dev-${first + index}`, baseId, itemLevel, quality))
}
