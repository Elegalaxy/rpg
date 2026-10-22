import { describe, expect, it } from 'vitest'

import {
  type ArmorCategory,
  type EnemyArchetype,
  type EnemyDerivedStats,
  type HeroClass,
  type HeroDerivedStats,
  type HeroStatInput,
  type OffHandKind,
  type WeaponKind,
  actionTime,
  armorPenetration,
  cooldownReduction,
  cumulativeXpToReachLevel,
  defenseReduction,
  deriveEnemyStats,
  deriveHeroStats,
  healingReceivedBonus,
  lightPieceEvasion,
  magicalPenetration,
  xpToNextLevel,
} from './stats.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function weapon(id: string, kind: WeaponKind) {
  return { id, kind, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function offHand(id: string, kind: OffHandKind) {
  return { id, kind, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function armorSet(category: ArmorCategory) {
  return {
    head: { id: `ref-${category}-head`, slot: 'head' as const, category, itemLevel: ITEM_LEVEL, quality: QUALITY },
    chest: {
      id: `ref-${category}-chest`,
      slot: 'chest' as const,
      category,
      itemLevel: ITEM_LEVEL,
      quality: QUALITY,
    },
    hands: {
      id: `ref-${category}-hands`,
      slot: 'hands' as const,
      category,
      itemLevel: ITEM_LEVEL,
      quality: QUALITY,
    },
    feet: { id: `ref-${category}-feet`, slot: 'feet' as const, category, itemLevel: ITEM_LEVEL, quality: QUALITY },
  }
}

function accessories() {
  return [
    { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
    { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
  ] as const
}

function referenceHero(
  classId: HeroClass,
  attributes: HeroStatInput['attributes'],
  mainKind: WeaponKind,
  offKind: OffHandKind,
  armor: ArmorCategory,
): HeroStatInput {
  return {
    level: 20,
    classId,
    attributes,
    gear: {
      mainHand: weapon(`ref-${mainKind}`, mainKind),
      offHand: offHand(`ref-${offKind}`, offKind),
      ...armorSet(armor),
      accessories: accessories(),
    },
  }
}

const warrior = (): HeroStatInput =>
  referenceHero(
    'warrior',
    { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 },
    'oneHanded',
    'shield',
    'heavy',
  )

const assassin = (): HeroStatInput =>
  referenceHero(
    'assassin',
    { strength: 18, vitality: 16, agility: 30, intellect: 14, spirit: 10 },
    'dagger',
    'dagger',
    'light',
  )

const ranger = (): HeroStatInput =>
  referenceHero(
    'ranger',
    { strength: 22, vitality: 18, agility: 28, intellect: 10, spirit: 10 },
    'bow',
    'quiver',
    'medium',
  )

const mage = (): HeroStatInput =>
  referenceHero(
    'mage',
    { strength: 10, vitality: 16, agility: 16, intellect: 34, spirit: 12 },
    'caster',
    'focus',
    'cloth',
  )

const cleric = (): HeroStatInput =>
  referenceHero(
    'cleric',
    { strength: 10, vitality: 22, agility: 14, intellect: 20, spirit: 22 },
    'caster',
    'shield',
    'medium',
  )

function percent(ratio: number): number {
  return ratio * 100
}

function logHero(classId: string, stats: HeroDerivedStats): void {
  console.log('[stats] reference hero', {
    classId,
    maxHp: stats.maxHp,
    physicalPower: stats.physicalPower,
    magicalPower: stats.magicalPower,
    healingPower: stats.healingPower,
    armor: stats.armor,
    resistance: stats.resistance,
    accuracy: stats.accuracy,
    evasion: stats.evasion,
    critChancePercent: percent(stats.critChance),
    critDamagePercent: percent(stats.critDamage),
    armorPenetrationPercent: percent(stats.armorPenetration),
    magicalPenetrationPercent: percent(stats.magicalPenetration),
    cooldownReductionPercent: percent(stats.cooldownReduction),
    resourceGenerationBonusPercent: percent(stats.resourceGenerationBonus),
    ordinaryXpBonusPercent: percent(stats.ordinaryXpBonus),
    actionTime: stats.actionTime,
    outOfCombatRegenPerSecond: stats.outOfCombatRegenPerSecond,
    healingReceivedBonusPercent: percent(stats.healingReceivedBonus),
  })
}

function logEnemy(label: string, stats: EnemyDerivedStats): void {
  console.log('[stats] enemy', {
    label,
    maxHp: stats.maxHp,
    power: stats.power,
    armor: stats.armor,
    resistance: stats.resistance,
    accuracy: stats.accuracy,
    evasion: stats.evasion,
    actionTime: stats.actionTime,
    consistency: stats.consistency,
    xp: stats.xp,
  })
}

function expectPercent(actualRatio: number, shownPercent: number, places: number): void {
  expect(percent(actualRatio)).toBeCloseTo(shownPercent, places)
}

describe('derived stats', () => {
  it('reproduces the level-20 Warrior reference stats', () => {
    const stats = deriveHeroStats(warrior())
    logHero('warrior', stats)
    expect(stats.maxHp).toBe(370)
    expect(stats.physicalPower).toBe(96)
    expect(stats.magicalPower).toBe(20)
    expect(stats.healingPower).toBe(32)
    expect(stats.armor).toBe(116)
    expect(stats.resistance).toBe(60)
    expect(stats.accuracy).toBe(16)
    expect(stats.evasion).toBe(16)
    expectPercent(stats.critChance, 11.4, 1)
    expectPercent(stats.critDamage, 162, 0)
    expectPercent(stats.armorPenetration, 12.97, 2)
    expectPercent(stats.resourceGenerationBonus, 12.12, 2)
    expect(stats.actionTime).toBeCloseTo(1.72, 2)
    expect(stats.outOfCombatRegenPerSecond).toBeCloseTo(1.1, 10)
    expectPercent(stats.healingReceivedBonus, 11, 0)
    expect(stats.ordinaryXpBonus).toBeCloseTo(0.1 * 16 / 66, 10)
  })

  it('reproduces the level-20 Assassin reference stats', () => {
    const stats = deriveHeroStats(assassin())
    logHero('assassin', stats)
    expect(stats.maxHp).toBe(310)
    expect(stats.physicalPower).toBeCloseTo(89.04, 2)
    expect(stats.armor).toBe(49)
    expect(stats.resistance).toBe(56)
    expect(stats.accuracy).toBe(30)
    expect(stats.evasion).toBe(36)
    expectPercent(stats.critChance, 17, 0)
    expectPercent(stats.critDamage, 159, 0)
    expectPercent(stats.armorPenetration, 10.59, 2)
    expectPercent(stats.resourceGenerationBonus, 8.33, 2)
    expect(stats.actionTime).toBeCloseTo(1.15, 2)
  })

  it('reproduces the level-20 Ranger reference stats', () => {
    const stats = deriveHeroStats(ranger())
    logHero('ranger', stats)
    expect(stats.maxHp).toBe(330)
    expect(stats.physicalPower).toBeCloseTo(96.8, 1)
    expect(stats.magicalPower).toBe(20)
    expect(stats.armor).toBe(70)
    expect(stats.resistance).toBe(70)
    expect(stats.accuracy).toBe(28)
    expect(stats.evasion).toBe(28)
    expectPercent(stats.critChance, 16.2, 1)
    expectPercent(stats.critDamage, 161, 0)
    expectPercent(stats.armorPenetration, 12.22, 2)
    expectPercent(stats.resourceGenerationBonus, 8.33, 2)
    expect(stats.actionTime).toBeCloseTo(1.72, 2)
  })

  it('reproduces the level-20 Mage reference stats', () => {
    const stats = deriveHeroStats(mage())
    logHero('mage', stats)
    expect(stats.maxHp).toBe(310)
    expect(stats.physicalPower).toBe(20)
    expect(stats.magicalPower).toBeCloseTo(130.4, 1)
    expect(stats.armor).toBe(35)
    expect(stats.resistance).toBe(98)
    expect(stats.accuracy).toBe(16)
    expect(stats.evasion).toBe(16)
    expectPercent(stats.critChance, 11.4, 1)
    expectPercent(stats.critDamage, 155, 0)
    expectPercent(stats.magicalPenetration, 16.19, 2)
    expectPercent(stats.cooldownReduction, 12.14, 2)
    expectPercent(stats.resourceGenerationBonus, 9.68, 2)
    expect(stats.actionTime).toBeCloseTo(1.72, 2)
  })

  it('reproduces the level-20 Cleric reference stats', () => {
    const stats = deriveHeroStats(cleric())
    logHero('cleric', stats)
    expect(stats.maxHp).toBe(370)
    expect(stats.magicalPower).toBe(88)
    expect(stats.healingPower).toBe(44)
    expect(stats.armor).toBe(88)
    expect(stats.resistance).toBe(88)
    expect(stats.accuracy).toBe(14)
    expect(stats.evasion).toBe(14)
    expectPercent(stats.critChance, 10.6, 1)
    expectPercent(stats.critDamage, 155, 0)
    expectPercent(stats.magicalPenetration, 11.43, 2)
    expectPercent(stats.cooldownReduction, 8.57, 2)
    expectPercent(stats.resourceGenerationBonus, 15.28, 2)
    expect(stats.actionTime).toBeCloseTo(1.75, 2)
  })

  it('splits a full light set evasion bonus by the armor slot shares', () => {
    const itemLevel = 20
    const budget = 1 + 0.25 * itemLevel
    const head = lightPieceEvasion('head', itemLevel)
    const chest = lightPieceEvasion('chest', itemLevel)
    const hands = lightPieceEvasion('hands', itemLevel)
    const feet = lightPieceEvasion('feet', itemLevel)
    console.log('[stats] light-set evasion', { itemLevel, budget, head, chest, hands, feet })
    expect(head).toBeCloseTo(budget * 0.25, 10)
    expect(chest).toBeCloseTo(budget * 0.4, 10)
    expect(hands).toBeCloseTo(budget * 0.15, 10)
    expect(feet).toBeCloseTo(budget * 0.2, 10)
    expect(head + chest + hands + feet).toBeCloseTo(budget, 10)

    const partial = assassin()
    partial.gear.feet = { ...partial.gear.feet, category: 'medium', id: 'ref-medium-feet' }
    const stats = deriveHeroStats(partial)
    console.log('[stats] partial light set', { evasion: stats.evasion, agility: partial.attributes.agility })
    expect(stats.evasion).toBe(partial.attributes.agility)
  })

  it('uses 90% primary-stat effectiveness off preference and 100% on preference', () => {
    const daggerWarrior = warrior()
    daggerWarrior.gear.mainHand = weapon('ref-dagger', 'dagger')
    const weaponStats = deriveHeroStats(daggerWarrior)
    console.log('[stats] off-preference weapon', {
      physicalPower: weaponStats.physicalPower,
      preferredPhysicalPower: 96,
    })
    expect(weaponStats.physicalPower).toBeCloseTo(84.72, 2)

    const clothWarrior = warrior()
    clothWarrior.gear.chest = {
      id: 'ref-cloth-chest',
      slot: 'chest',
      category: 'cloth',
      itemLevel: ITEM_LEVEL,
      quality: QUALITY,
    }
    const armorStats = deriveHeroStats(clothWarrior)
    console.log('[stats] off-preference armor', {
      armor: armorStats.armor,
      resistance: armorStats.resistance,
    })
    expect(armorStats.armor).toBeCloseTo(89.4, 5)
    expect(armorStats.resistance).toBeCloseTo(78.48, 5)
    expect(deriveHeroStats(warrior()).physicalPower).toBe(96)
  })

  it('reproduces a level-20 standard enemy with Warden multipliers', () => {
    const stats = deriveEnemyStats({
      level: 20,
      archetype: 'standard',
      overrides: {
        hpMultiplier: 8,
        powerMultiplier: 1.3,
        defenseMultiplier: 1.5,
        accuracy: 40,
        consistency: 50,
      },
    })
    logEnemy('warden', stats)
    expect(stats.maxHp).toBe(3840)
    expect(stats.power).toBe(36)
    expect(stats.armor).toBe(68)
    expect(stats.resistance).toBe(68)
    expect(stats.accuracy).toBe(40)
    expect(stats.evasion).toBe(20)
    expect(stats.actionTime).toBeCloseTo(2.2, 10)
    expect(stats.consistency).toBe(50)
  })

  it.each([
    ['swarm', { maxHp: 216, power: 18, armor: 27, resistance: 27, accuracy: 30, evasion: 20, actionTime: 1.65, xp: 18 }],
    ['skirmisher', { maxHp: 384, power: 25, armor: 34, resistance: 34, accuracy: 30, evasion: 30, actionTime: 1.76, xp: 38 }],
    ['standard', { maxHp: 480, power: 28, armor: 45, resistance: 45, accuracy: 30, evasion: 20, actionTime: 2.2, xp: 45 }],
    ['tank', { maxHp: 768, power: 22, armor: 68, resistance: 68, accuracy: 30, evasion: 20, actionTime: 2.64, xp: 56 }],
    ['burst', { maxHp: 384, power: 35, armor: 36, resistance: 36, accuracy: 30, evasion: 20, actionTime: 2.75, xp: 54 }],
    ['support', { maxHp: 360, power: 20, armor: 36, resistance: 36, accuracy: 30, evasion: 20, actionTime: 2.2, xp: 45 }],
  ] as const)('applies the %s archetype multipliers', (archetype: EnemyArchetype, expected) => {
    const stats = deriveEnemyStats({ level: 20, archetype })
    logEnemy(archetype, stats)
    expect(stats.maxHp).toBe(expected.maxHp)
    expect(stats.power).toBe(expected.power)
    expect(stats.armor).toBe(expected.armor)
    expect(stats.resistance).toBe(expected.resistance)
    expect(stats.accuracy).toBe(expected.accuracy)
    expect(stats.evasion).toBe(expected.evasion)
    expect(stats.actionTime).toBeCloseTo(expected.actionTime, 5)
    expect(stats.xp).toBe(expected.xp)
    expect(stats.consistency).toBe(0)
  })

  it('applies elite multipliers on a level-16 tank', () => {
    const stats = deriveEnemyStats({
      level: 16,
      archetype: 'tank',
      elite: true,
      overrides: { consistency: 25 },
    })
    logEnemy('elite-tank', stats)
    expect(stats.maxHp).toBe(1920)
    expect(stats.power).toBe(25)
    expect(stats.armor).toBe(69)
    expect(stats.resistance).toBe(69)
    expect(stats.accuracy).toBe(26)
    expect(stats.evasion).toBe(17)
    expect(stats.actionTime).toBeCloseTo(2.64, 5)
    expect(stats.consistency).toBe(25)
    expect(stats.xp).toBe(139)
  })

  it('replaces a stat when a per-enemy absolute override is set', () => {
    const stats = deriveEnemyStats({
      level: 14,
      archetype: 'skirmisher',
      overrides: { maxHp: 1350, power: 29 },
    })
    logEnemy('absolute-override', stats)
    expect(stats.maxHp).toBe(1350)
    expect(stats.power).toBe(29)
  })

  it('sums the XP curve to about 33600 at level 20', () => {
    expect(xpToNextLevel(1)).toBe(50)
    expect(xpToNextLevel(9)).toBe(1350)
    expect(xpToNextLevel(16)).toBe(3200)
    const total = cumulativeXpToReachLevel(20)
    console.log('[stats] cumulative xp', { level: 20, total, about: 33600 })
    expect(total).toBe(33567)
    expect(Math.abs(total - 33600)).toBeLessThanOrEqual(100)
  })

  it('floors action time at 0.5 seconds', () => {
    const floored = actionTime(1.5, 400)
    const unfloored = actionTime(1.5, 0)
    console.log('[stats] action floor', { base: 1.5, agility: 400, floored, unfloored })
    expect(floored).toBe(0.5)
    expect(unfloored).toBe(1.5)
    const fast = warrior()
    fast.attributes = { ...fast.attributes, agility: 10000 }
    expect(deriveHeroStats(fast).actionTime).toBe(0.5)
    expect(deriveHeroStats(fast).critChance).toBe(0.75)
  })

  it('caps cooldown reduction at 50%', () => {
    const capped = cooldownReduction(34, 0.45)
    const innate = cooldownReduction(34, 0)
    console.log('[stats] cooldown cap', { intellect: 34, bonus: 0.45, capped, innate })
    expect(capped).toBe(0.5)
    expectPercent(innate, 12.14, 2)
  })

  it('caps penetration at 80%', () => {
    const armor = armorPenetration(24, 0.9)
    const magical = magicalPenetration(34, 0.9)
    console.log('[stats] penetration cap', { armor, magical })
    expect(armor).toBe(0.8)
    expect(magical).toBe(0.8)
    expect(armorPenetration(24, 0)).toBeGreaterThan(0.12)
    expect(armorPenetration(24, 0)).toBeLessThan(0.13)
  })

  it('caps defense reduction at 80%', () => {
    const capped = defenseReduction(10000, 0, 20)
    const atCap = defenseReduction(600, 0, 20)
    const below = defenseReduction(100, 0, 20)
    const penetrated = defenseReduction(100, 0.9, 20)
    console.log('[stats] defense reduction cap', { capped, atCap, below, penetrated })
    expect(capped).toBe(0.8)
    expect(atCap).toBeCloseTo(0.8, 10)
    expect(below).toBeLessThan(0.8)
    expect(penetrated).toBeCloseTo(defenseReduction(100, 0.8, 20), 10)
  })

  it('caps healing received at 50%', () => {
    const capped = healingReceivedBonus(200)
    const warriorBonus = healingReceivedBonus(22)
    console.log('[stats] healing received', { capped, vitality: 22, warriorBonus })
    expect(capped).toBe(0.5)
    expect(warriorBonus).toBeCloseTo(0.11, 10)
  })

  it('rejects a negative level, missing gear, and an item level above the hero', () => {
    const cases: { label: string; run: () => void; message: string }[] = [
      {
        label: 'negative level',
        run: () => {
          deriveHeroStats({ ...warrior(), level: -1 })
        },
        message: 'level must be a positive integer, received -1',
      },
      {
        label: 'negative enemy level',
        run: () => {
          deriveEnemyStats({ level: -1, archetype: 'standard' })
        },
        message: 'level must be a positive integer, received -1',
      },
      {
        label: 'missing chest',
        run: () => {
          const hero = warrior()
          deriveHeroStats({
            ...hero,
            gear: { ...hero.gear, chest: undefined as never },
          })
        },
        message: 'hero gear is missing the chest slot',
      },
      {
        label: 'item level above hero',
        run: () => {
          const hero = warrior()
          deriveHeroStats({
            ...hero,
            gear: {
              ...hero.gear,
              mainHand: { ...hero.gear.mainHand, id: 'ref-one-handed', itemLevel: 21 },
            },
          })
        },
        message: 'item level 21 is above hero level 20 (ref-one-handed)',
      },
      {
        label: 'two-handed off-hand',
        run: () => {
          const hero = warrior()
          deriveHeroStats({
            ...hero,
            gear: {
              ...hero.gear,
              mainHand: weapon('ref-two-handed', 'twoHanded'),
            },
          })
        },
        message: 'a two-handed weapon disables the off-hand slot',
      },
    ]
    for (const entry of cases) {
      let thrown: unknown
      try {
        entry.run()
      } catch (error) {
        thrown = error
      }
      const message = thrown instanceof Error ? thrown.message : String(thrown)
      console.log('[stats] invalid', { label: entry.label, message })
      expect(thrown).toBeInstanceOf(Error)
      expect(message).toBe(entry.message)
    }
  })
})
