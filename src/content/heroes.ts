import type { HeroClass, HeroStatInput } from '../sim/stats.ts'

import { referenceGear } from './gear.ts'

// Human level-20 reference heroes: attributes plus gear. No passive nodes or consumables.

export type ReferenceHero = HeroStatInput & {
  id: string
  race: 'human'
}

const accessories = [referenceGear.accessoryA, referenceGear.accessoryB] as const

function hero(
  id: string,
  classId: HeroClass,
  attributes: ReferenceHero['attributes'],
  gear: ReferenceHero['gear'],
): ReferenceHero {
  return { id, race: 'human', level: 20, classId, attributes, gear }
}

export const referenceHeroes = {
  warrior: hero('ref-human-warrior', 'warrior', {
    strength: 24,
    vitality: 22,
    agility: 16,
    intellect: 10,
    spirit: 16,
  }, {
    mainHand: referenceGear.oneHanded,
    offHand: referenceGear.shield,
    head: referenceGear.heavyHead,
    chest: referenceGear.heavyChest,
    hands: referenceGear.heavyHands,
    feet: referenceGear.heavyFeet,
    accessories,
  }),
  assassin: hero('ref-human-assassin', 'assassin', {
    strength: 18,
    vitality: 16,
    agility: 30,
    intellect: 14,
    spirit: 10,
  }, {
    mainHand: referenceGear.dagger,
    offHand: referenceGear.offHandDagger,
    head: referenceGear.lightHead,
    chest: referenceGear.lightChest,
    hands: referenceGear.lightHands,
    feet: referenceGear.lightFeet,
    accessories,
  }),
  ranger: hero('ref-human-ranger', 'ranger', {
    strength: 22,
    vitality: 18,
    agility: 28,
    intellect: 10,
    spirit: 10,
  }, {
    mainHand: referenceGear.bow,
    offHand: referenceGear.quiver,
    head: referenceGear.mediumHead,
    chest: referenceGear.mediumChest,
    hands: referenceGear.mediumHands,
    feet: referenceGear.mediumFeet,
    accessories,
  }),
  mage: hero('ref-human-mage', 'mage', {
    strength: 10,
    vitality: 16,
    agility: 16,
    intellect: 34,
    spirit: 12,
  }, {
    mainHand: referenceGear.caster,
    offHand: referenceGear.focus,
    head: referenceGear.clothHead,
    chest: referenceGear.clothChest,
    hands: referenceGear.clothHands,
    feet: referenceGear.clothFeet,
    accessories,
  }),
  cleric: hero('ref-human-cleric', 'cleric', {
    strength: 10,
    vitality: 22,
    agility: 14,
    intellect: 20,
    spirit: 22,
  }, {
    mainHand: referenceGear.caster,
    offHand: referenceGear.shield,
    head: referenceGear.mediumHead,
    chest: referenceGear.mediumChest,
    hands: referenceGear.mediumHands,
    feet: referenceGear.mediumFeet,
    accessories,
  }),
} satisfies Record<HeroClass, ReferenceHero>
