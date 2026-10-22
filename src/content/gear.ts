import type { AccessoryPiece, ArmorPiece, OffHandPiece, WeaponPiece } from '../sim/stats.ts'

// Level-20 reference pieces. `quality` 1 is 100%. No modifiers.
// Accessories are equipped and contribute no combat stats.

const itemLevel = 20
const quality = 1

function weapon(id: string, kind: WeaponPiece['kind']): WeaponPiece {
  return { id, kind, itemLevel, quality }
}

function offHand(id: string, kind: OffHandPiece['kind']): OffHandPiece {
  return { id, kind, itemLevel, quality }
}

function armor(id: string, slot: ArmorPiece['slot'], category: ArmorPiece['category']): ArmorPiece {
  return { id, slot, category, itemLevel, quality }
}

function accessory(id: string): AccessoryPiece {
  return { id, itemLevel, quality }
}

export const referenceGear = {
  oneHanded: weapon('ref-one-handed', 'oneHanded'),
  dagger: weapon('ref-dagger', 'dagger'),
  bow: weapon('ref-bow', 'bow'),
  caster: weapon('ref-caster', 'caster'),
  offHandDagger: offHand('ref-offhand-dagger', 'dagger'),
  shield: offHand('ref-shield', 'shield'),
  focus: offHand('ref-focus', 'focus'),
  quiver: offHand('ref-quiver', 'quiver'),
  heavyHead: armor('ref-heavy-head', 'head', 'heavy'),
  heavyChest: armor('ref-heavy-chest', 'chest', 'heavy'),
  heavyHands: armor('ref-heavy-hands', 'hands', 'heavy'),
  heavyFeet: armor('ref-heavy-feet', 'feet', 'heavy'),
  mediumHead: armor('ref-medium-head', 'head', 'medium'),
  mediumChest: armor('ref-medium-chest', 'chest', 'medium'),
  mediumHands: armor('ref-medium-hands', 'hands', 'medium'),
  mediumFeet: armor('ref-medium-feet', 'feet', 'medium'),
  lightHead: armor('ref-light-head', 'head', 'light'),
  lightChest: armor('ref-light-chest', 'chest', 'light'),
  lightHands: armor('ref-light-hands', 'hands', 'light'),
  lightFeet: armor('ref-light-feet', 'feet', 'light'),
  clothHead: armor('ref-cloth-head', 'head', 'cloth'),
  clothChest: armor('ref-cloth-chest', 'chest', 'cloth'),
  clothHands: armor('ref-cloth-hands', 'hands', 'cloth'),
  clothFeet: armor('ref-cloth-feet', 'feet', 'cloth'),
  accessoryA: accessory('ref-accessory-a'),
  accessoryB: accessory('ref-accessory-b'),
}
