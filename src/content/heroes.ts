import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import type { Attributes, HeroGear, HeroStatInput } from '../sim/stats.ts'

import { referenceGear } from './gear.ts'

// Human level-20 reference heroes: attributes plus gear. No passive nodes or consumables.

/** Tie order for leftover attribute points: STR, VIT, AGI, INT, SPI. */
const ATTRIBUTE_KEYS = ['strength', 'vitality', 'agility', 'intellect', 'spirit'] as const

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

function assertHeroLevel(level: number): void {
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) {
    throw new Error(`hero level must be a positive integer, received ${describeValue(level)}`)
  }
}

function assertHeroClass(classId: string): asserts classId is HeroClass {
  if (!(HERO_CLASSES as readonly string[]).includes(classId)) {
    throw new Error(`unknown hero class ${describeValue(classId)}`)
  }
}

/** Positive-integer division. Adjusts when a float quotient is a hair off an integer boundary. */
function floorDiv(numerator: number, denominator: number): { quotient: number; remainder: number } {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error(`cannot split attributes with ${describeValue(numerator)} / ${describeValue(denominator)}`)
  }
  let quotient = Math.floor(numerator / denominator)
  let remainder = numerator - quotient * denominator
  while (remainder < 0) {
    quotient -= 1
    remainder += denominator
  }
  while (remainder >= denominator) {
    quotient += 1
    remainder -= denominator
  }
  return { quotient, remainder }
}

/**
 * Level L has 50 + 2 × (L − 1) points, split in the level-20 proportions.
 * Each share is floored, then leftover points go one at a time to the largest remainder.
 */
export function splitReferenceAttributes(template: Attributes, level: number): Attributes {
  assertHeroLevel(level)
  const budget = 50 + 2 * (level - 1)
  if (!Number.isSafeInteger(budget)) {
    throw new Error(`attribute budget is outside the safe integer range at level ${level}`)
  }
  let templateTotal = 0
  for (const key of ATTRIBUTE_KEYS) {
    const points = template[key]
    if (typeof points !== 'number' || !Number.isInteger(points) || points < 0) {
      throw new Error(`template ${key} must be an integer of at least 0, received ${describeValue(points)}`)
    }
    templateTotal += points
  }
  if (templateTotal <= 0) throw new Error('level-20 attributes must sum to a positive total')

  const shares = ATTRIBUTE_KEYS.map((key) => {
    const product = budget * template[key]
    if (!Number.isSafeInteger(product)) {
      throw new Error(`attribute product is outside the safe integer range at level ${level}`)
    }
    const divided = floorDiv(product, templateTotal)
    return { key, points: divided.quotient, remainder: divided.remainder }
  })
  let used = 0
  for (const share of shares) used += share.points
  let leftover = budget - used
  if (leftover < 0) throw new Error(`attribute split assigned ${used} points from a budget of ${budget}`)
  const order = [...shares].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder
    return ATTRIBUTE_KEYS.indexOf(a.key) - ATTRIBUTE_KEYS.indexOf(b.key)
  })
  for (const share of order) {
    if (leftover <= 0) break
    share.points += 1
    leftover -= 1
  }
  if (leftover !== 0) throw new Error(`attribute split left ${leftover} points unassigned`)

  const attributes: Attributes = { strength: 0, vitality: 0, agility: 0, intellect: 0, spirit: 0 }
  for (const share of shares) attributes[share.key] = share.points
  return attributes
}

function scalePiece<T extends { itemLevel: number; quality: number }>(piece: T, level: number): T {
  return { ...piece, itemLevel: level, quality: 1 }
}

/** Same slots as the level-20 reference set. Item level L, quality 100%, no modifiers. */
function gearAtLevel(gear: HeroGear, level: number): HeroGear {
  const offHand = gear.offHand === null ? null : scalePiece(gear.offHand, level)
  return {
    mainHand: scalePiece(gear.mainHand, level),
    offHand,
    head: scalePiece(gear.head, level),
    chest: scalePiece(gear.chest, level),
    hands: scalePiece(gear.hands, level),
    feet: scalePiece(gear.feet, level),
    accessories: [scalePiece(gear.accessories[0], level), scalePiece(gear.accessories[1], level)],
  }
}

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

/** Human reference hero at level L. Level 20 reproduces the published §9 hero. */
export function referenceHeroAtLevel(classId: HeroClass, level: number): ReferenceHero {
  assertHeroClass(classId)
  assertHeroLevel(level)
  const published = referenceHeroes[classId]
  const attributes = splitReferenceAttributes(published.attributes, level)
  if (level === published.level) {
    for (const key of ATTRIBUTE_KEYS) {
      if (attributes[key] !== published.attributes[key]) {
        throw new Error(
          `level-${level} ${classId} ${key} is ${attributes[key]}, expected ${published.attributes[key]}`,
        )
      }
    }
  }
  const gear = level === published.level ? published.gear : gearAtLevel(published.gear, level)
  const hero: ReferenceHero = {
    id: published.id,
    race: 'human',
    level,
    classId,
    attributes,
    gear,
  }
  return hero
}
