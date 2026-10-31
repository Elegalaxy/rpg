import {
  NODE_BEAST_THICK_HIDE,
  NODE_HUMAN_CROSS_TRAINING,
  NODE_HUMAN_RENAISSANCE,
  RENAISSANCE_HP,
  RENAISSANCE_POWER,
  THICK_HIDE_HP,
} from './races/racialNodes.ts'
import {
  ACTION_TIME_FLOOR_SECONDS,
  AGILITY_SPEED_SCALE,
  ARMOR_BUDGET_BASE,
  ARMOR_BUDGET_PER_LEVEL,
  ARMOR_CATEGORIES,
  ARMOR_CATEGORY_FACTOR,
  ARMOR_SLOT_FRACTION,
  ARMOR_SLOTS,
  CLASS_PREFERENCE,
  COOLDOWN_REDUCTION_CAP,
  COOLDOWN_REDUCTION_FACTOR,
  COOLDOWN_REDUCTION_SOFT_CAP,
  CRIT_CHANCE_BASE,
  CRIT_CHANCE_MAX,
  CRIT_CHANCE_MIN,
  CRIT_CHANCE_PER_AGILITY,
  CRIT_DAMAGE_BASE,
  CRIT_DAMAGE_PER_STRENGTH,
  DEFENSE_PER_ATTACKER_LEVEL,
  DEFENSE_REDUCTION_CAP,
  DEFENSE_SOFT_CAP,
  ELITE_DEFENSE_MULTIPLIER,
  ELITE_HP_MULTIPLIER,
  ELITE_POWER_MULTIPLIER,
  ECHO_RANK_GROWTH,
  ELITE_XP_MULTIPLIER,
  ENEMY_ACCURACY_BASE,
  ENEMY_ACCURACY_PER_LEVEL,
  ENEMY_ACTION_TIME,
  ENEMY_ARCHETYPE,
  ENEMY_CONSISTENCY,
  ENEMY_DEFENSE_BASE,
  ENEMY_DEFENSE_PER_LEVEL,
  ENEMY_EVASION_BASE,
  ENEMY_EVASION_PER_LEVEL,
  ENEMY_HP_BASE,
  ENEMY_HP_PER_LEVEL,
  ENEMY_POWER_BASE,
  ENEMY_POWER_PER_LEVEL,
  ENEMY_XP_BASE,
  ENEMY_XP_PER_LEVEL,
  HEALING_RECEIVED_CAP,
  HEALING_RECEIVED_PER_VITALITY,
  HERO_CLASSES,
  HERO_HP_BASE,
  HERO_HP_PER_LEVEL,
  HERO_HP_PER_VITALITY,
  LIGHT_EVASION_BASE,
  LIGHT_EVASION_PER_LEVEL,
  NEUTRAL_WEAPON_POWER_BASE,
  NEUTRAL_WEAPON_POWER_PER_LEVEL,
  OFF_HAND_KINDS,
  OFF_HAND_POWER_FACTOR,
  OFF_PREFERENCE_EFFECTIVENESS,
  ORDINARY_XP_FACTOR,
  ORDINARY_XP_SOFT_CAP,
  PENETRATION_CAP,
  PENETRATION_FACTOR,
  PENETRATION_SOFT_CAP,
  POWER_PER_PRIMARY,
  PREFERRED_EFFECTIVENESS,
  REGEN_PER_VITALITY,
  RESOURCE_GENERATION_FACTOR,
  RESOURCE_GENERATION_SOFT_CAP,
  SHIELD_DEFENSE_BASE,
  SHIELD_DEFENSE_PER_LEVEL,
  WEAPON_ACTION_TIME,
  WEAPON_POWER_FACTOR,
  XP_TO_NEXT_BASE,
  XP_TO_NEXT_EXPONENT,
  type ArmorCategory,
  type ArmorSlot,
  type EnemyArchetype,
  type HeroClass,
  type OffHandKind,
  type Ratio,
  type WeaponKind,
} from './constants.ts'

export type {
  ArmorCategory,
  ArmorSlot,
  EnemyArchetype,
  HeroClass,
  OffHandKind,
  WeaponKind,
}

export type Attributes = {
  strength: number
  vitality: number
  agility: number
  intellect: number
  spirit: number
}

export type WeaponPiece = {
  id: string
  kind: WeaponKind
  itemLevel: number
  quality: number
}

export type OffHandPiece = {
  id: string
  kind: OffHandKind
  itemLevel: number
  quality: number
}

export type ArmorPiece = {
  id: string
  slot: ArmorSlot
  category: ArmorCategory
  itemLevel: number
  quality: number
}

/** Reference accessories contribute no combat stats. `quality` 1 means 100%. */
export type AccessoryPiece = {
  id: string
  itemLevel: number
  quality: number
}

export type HeroGear = {
  mainHand: WeaponPiece
  offHand: OffHandPiece | null
  head: ArmorPiece
  chest: ArmorPiece
  hands: ArmorPiece
  feet: ArmorPiece
  accessories: readonly [AccessoryPiece, AccessoryPiece]
}

export type HeroStatInput = {
  level: number
  classId: HeroClass
  attributes: Attributes
  gear: HeroGear
  skillTimeCoefficient?: number
  equipmentHealingPower?: number
  accuracyBonus?: number
  evasionBonus?: number
  critChanceBonus?: number
  critDamageBonus?: number
  armorPenetrationBonus?: number
  magicalPenetrationBonus?: number
  cooldownReductionBonus?: number
  /** Racial branch nodes that change derived stats. Omitted applies none. */
  racialNodeIds?: readonly string[]
  /** Human Renaissance is active. */
  renaissance?: boolean
}

export type HeroDerivedStats = {
  maxHp: number
  physicalPower: number
  magicalPower: number
  healingPower: number
  accuracy: number
  evasion: number
  critChance: number
  critDamage: number
  actionTime: number
  cooldownReduction: number
  armorPenetration: number
  magicalPenetration: number
  armor: number
  resistance: number
  resourceGenerationBonus: number
  ordinaryXpBonus: number
  outOfCombatRegenPerSecond: number
  healingReceivedBonus: number
}

export type EnemyStatOverrides = {
  maxHp?: number
  power?: number
  armor?: number
  resistance?: number
  accuracy?: number
  evasion?: number
  actionTime?: number
  consistency?: number
  xp?: number
  hpMultiplier?: number
  powerMultiplier?: number
  defenseMultiplier?: number
  armorMultiplier?: number
  resistanceMultiplier?: number
  actionTimeMultiplier?: number
  xpMultiplier?: number
  evasionBonus?: number
}

export type EnemyStatInput = {
  level: number
  archetype: EnemyArchetype
  elite?: boolean
  overrides?: EnemyStatOverrides
}

export type EnemyDerivedStats = {
  maxHp: number
  power: number
  armor: number
  resistance: number
  accuracy: number
  evasion: number
  actionTime: number
  consistency: number
  xp: number
}

const ATTRIBUTE_KEYS = ['strength', 'vitality', 'agility', 'intellect', 'spirit'] as const

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, received ${describeValue(value)}`)
  }
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number, received ${describeValue(value)}`)
  }
}

function assertNonNegative(value: unknown, label: string): asserts value is number {
  assertFiniteNumber(value, label)
  if (value < 0) {
    throw new Error(`${label} must be at least 0, received ${describeValue(value)}`)
  }
}

function assertQuality(value: unknown, id: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${id} quality must be a finite number greater than 0, received ${describeValue(value)}`,
    )
  }
}

function includesName<T extends string>(values: readonly T[], value: string): value is T {
  for (const entry of values) {
    if (entry === value) return true
  }
  return false
}

type Rational = { numerator: number; denominator: number }

const ZERO_RATIONAL: Rational = { numerator: 0, denominator: 1 }

function scale(base: number, ratios: readonly Ratio[]): number {
  let numerator = 1
  let denominator = 1
  for (const ratio of ratios) {
    numerator *= ratio.numerator
    denominator *= ratio.denominator
  }
  return (base * numerator) / denominator
}

/** Add `base * quality * ratios` without rounding each piece first. */
function addScaled(total: Rational, base: number, ratios: readonly Ratio[], quality = 1): Rational {
  let numerator = base
  let denominator = 1
  for (const ratio of ratios) {
    numerator *= ratio.numerator
    denominator *= ratio.denominator
  }
  if (quality !== 1) numerator *= quality
  return {
    numerator: total.numerator * denominator + numerator * total.denominator,
    denominator: total.denominator * denominator,
  }
}

function optionalBonus(value: number | undefined, label: string): number {
  if (value === undefined) return 0
  assertFiniteNumber(value, label)
  return value
}

function effectiveness(preferred: boolean): Ratio {
  return preferred ? PREFERRED_EFFECTIVENESS : OFF_PREFERENCE_EFFECTIVENESS
}

function prefers(
  classId: HeroClass,
  kind: 'weapon' | 'offHand' | 'armor',
  value: WeaponKind | OffHandKind | ArmorCategory,
): boolean {
  const preference = CLASS_PREFERENCE[classId]
  if (kind === 'weapon') return includesName(preference.weapons, value)
  if (kind === 'offHand') return includesName(preference.offHands, value)
  return preference.armor === value
}

function neutralWeaponPower(itemLevel: number): number {
  return NEUTRAL_WEAPON_POWER_BASE + NEUTRAL_WEAPON_POWER_PER_LEVEL * itemLevel
}

function assertEquippable(piece: { id: string; itemLevel: number; quality: number }, heroLevel: number): void {
  if (typeof piece.id !== 'string' || piece.id.length === 0) {
    throw new Error('gear piece is missing an id')
  }
  assertPositiveInteger(piece.itemLevel, `${piece.id} item level`)
  assertQuality(piece.quality, piece.id)
  if (piece.itemLevel > heroLevel) {
    throw new Error(`item level ${piece.itemLevel} is above hero level ${heroLevel} (${piece.id})`)
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object, received ${describeValue(value)}`)
  }
  return value as Record<string, unknown>
}

/** Evasion from one piece of a full light set. Slot shares match the armor budget. */
export function lightPieceEvasion(slot: ArmorSlot, itemLevel: number): number {
  assertPositiveInteger(itemLevel, 'item level')
  if (!includesName(ARMOR_SLOTS, slot)) {
    throw new Error(`unknown armor slot ${describeValue(slot)}`)
  }
  const budget =
    LIGHT_EVASION_BASE +
    (LIGHT_EVASION_PER_LEVEL.numerator * itemLevel) / LIGHT_EVASION_PER_LEVEL.denominator
  const share = ARMOR_SLOT_FRACTION[slot]
  return (budget * share.numerator) / share.denominator
}

export function actionTime(
  baseSeconds: number,
  agility: number,
  skillTimeCoefficient = 1,
): number {
  assertFiniteNumber(baseSeconds, 'base action time')
  assertNonNegative(agility, 'agility')
  assertFiniteNumber(skillTimeCoefficient, 'skill time coefficient')
  if (baseSeconds <= 0) {
    throw new Error(`base action time must be greater than 0, received ${describeValue(baseSeconds)}`)
  }
  if (skillTimeCoefficient < 0) {
    throw new Error(
      `skill time coefficient must be at least 0, received ${describeValue(skillTimeCoefficient)}`,
    )
  }
  const scaled =
    (baseSeconds * skillTimeCoefficient * AGILITY_SPEED_SCALE) / (AGILITY_SPEED_SCALE + agility)
  if (scaled < ACTION_TIME_FLOOR_SECONDS) return ACTION_TIME_FLOOR_SECONDS
  return scaled
}

export function cooldownReduction(intellect: number, bonus = 0): number {
  assertNonNegative(intellect, 'intellect')
  assertFiniteNumber(bonus, 'cooldown reduction bonus')
  const innate =
    (COOLDOWN_REDUCTION_FACTOR * intellect) / (intellect + COOLDOWN_REDUCTION_SOFT_CAP)
  const total = innate + bonus
  if (total > COOLDOWN_REDUCTION_CAP) return COOLDOWN_REDUCTION_CAP
  return total
}

export function armorPenetration(strength: number, bonus = 0): number {
  assertNonNegative(strength, 'strength')
  assertFiniteNumber(bonus, 'armor penetration bonus')
  const innate = (PENETRATION_FACTOR * strength) / (strength + PENETRATION_SOFT_CAP)
  const total = innate + bonus
  if (total > PENETRATION_CAP) return PENETRATION_CAP
  return total
}

export function magicalPenetration(intellect: number, bonus = 0): number {
  assertNonNegative(intellect, 'intellect')
  assertFiniteNumber(bonus, 'magical penetration bonus')
  const innate = (PENETRATION_FACTOR * intellect) / (intellect + PENETRATION_SOFT_CAP)
  const total = innate + bonus
  if (total > PENETRATION_CAP) return PENETRATION_CAP
  return total
}

export function defenseReduction(
  defense: number,
  totalPenetration: number,
  attackerLevel: number,
): number {
  assertNonNegative(defense, 'defense')
  assertFiniteNumber(totalPenetration, 'total penetration')
  assertPositiveInteger(attackerLevel, 'attacker level')
  const penetration = totalPenetration > PENETRATION_CAP ? PENETRATION_CAP : totalPenetration
  const effective = defense * (1 - penetration)
  const denominator = effective + DEFENSE_SOFT_CAP + DEFENSE_PER_ATTACKER_LEVEL * attackerLevel
  const reduction = effective / denominator
  if (reduction > DEFENSE_REDUCTION_CAP) return DEFENSE_REDUCTION_CAP
  return reduction
}

export function healingReceivedBonus(vitality: number): number {
  assertNonNegative(vitality, 'vitality')
  const bonus = HEALING_RECEIVED_PER_VITALITY * vitality
  if (bonus > HEALING_RECEIVED_CAP) return HEALING_RECEIVED_CAP
  return bonus
}

export function xpToNextLevel(level: number): number {
  assertPositiveInteger(level, 'level')
  return Math.round(XP_TO_NEXT_BASE * level ** XP_TO_NEXT_EXPONENT)
}

/** XP required to arrive at `level` from level 1. Level 1 is 0. */
export function cumulativeXpToReachLevel(level: number): number {
  assertPositiveInteger(level, 'level')
  let total = 0
  for (let current = 1; current < level; current += 1) {
    total += xpToNextLevel(current)
  }
  return total
}

function addArmorPiece(
  armor: Rational,
  resistance: Rational,
  piece: ArmorPiece,
  preferred: boolean,
): { armor: Rational; resistance: Rational } {
  const budget = ARMOR_BUDGET_BASE + ARMOR_BUDGET_PER_LEVEL * piece.itemLevel
  const share = ARMOR_SLOT_FRACTION[piece.slot]
  const category = ARMOR_CATEGORY_FACTOR[piece.category]
  const rating = effectiveness(preferred)
  return {
    armor: addScaled(armor, budget, [share, category.armor, rating], piece.quality),
    resistance: addScaled(resistance, budget, [share, category.resistance, rating], piece.quality),
  }
}

function readArmorPiece(value: unknown, slot: ArmorSlot, heroLevel: number): ArmorPiece {
  if (value === undefined || value === null) {
    throw new Error(`hero gear is missing the ${slot} slot`)
  }
  const record = requireObject(value, `hero gear ${slot}`)
  const piece = record as unknown as ArmorPiece
  assertEquippable(piece, heroLevel)
  if (!includesName(ARMOR_SLOTS, piece.slot)) {
    throw new Error(`${piece.id} has unknown armor slot ${describeValue(piece.slot)}`)
  }
  if (piece.slot !== slot) {
    throw new Error(`hero gear ${slot} slot has a ${piece.slot} piece (${piece.id})`)
  }
  if (!includesName(ARMOR_CATEGORIES, piece.category)) {
    throw new Error(`${piece.id} has unknown armor category ${describeValue(piece.category)}`)
  }
  return piece
}

function readWeapon(value: unknown, heroLevel: number): WeaponPiece {
  if (value === undefined || value === null) {
    throw new Error('hero gear is missing the main-hand slot')
  }
  const piece = requireObject(value, 'hero gear main hand') as unknown as WeaponPiece
  assertEquippable(piece, heroLevel)
  if (!includesName(Object.keys(WEAPON_POWER_FACTOR), piece.kind)) {
    throw new Error(`${piece.id} has unknown weapon kind ${describeValue(piece.kind)}`)
  }
  return piece
}

function readOffHand(value: unknown, heroLevel: number, mainHand: WeaponKind): OffHandPiece | null {
  if (mainHand === 'twoHanded') {
    if (value === undefined || value === null) return null
    throw new Error('a two-handed weapon disables the off-hand slot')
  }
  if (value === undefined || value === null) {
    throw new Error('hero gear is missing the off-hand slot')
  }
  const piece = requireObject(value, 'hero gear off hand') as unknown as OffHandPiece
  assertEquippable(piece, heroLevel)
  if (!includesName(OFF_HAND_KINDS, piece.kind)) {
    throw new Error(`${piece.id} has unknown off-hand kind ${describeValue(piece.kind)}`)
  }
  return piece
}

function readAccessory(value: unknown, index: number, heroLevel: number): AccessoryPiece {
  if (value === undefined || value === null) {
    throw new Error(`hero gear is missing accessory slot ${index + 1}`)
  }
  const piece = requireObject(value, `hero gear accessory ${index + 1}`) as unknown as AccessoryPiece
  assertEquippable(piece, heroLevel)
  return piece
}

function readGear(value: unknown, heroLevel: number): HeroGear {
  if (value === undefined || value === null) {
    throw new Error('hero gear is missing')
  }
  const gear = requireObject(value, 'hero gear')
  const mainHand = readWeapon(gear.mainHand, heroLevel)
  const offHand = readOffHand(gear.offHand, heroLevel, mainHand.kind)
  const head = readArmorPiece(gear.head, 'head', heroLevel)
  const chest = readArmorPiece(gear.chest, 'chest', heroLevel)
  const hands = readArmorPiece(gear.hands, 'hands', heroLevel)
  const feet = readArmorPiece(gear.feet, 'feet', heroLevel)
  if (!Array.isArray(gear.accessories) || gear.accessories.length !== 2) {
    throw new Error('hero gear is missing accessory slots')
  }
  const accessories: [AccessoryPiece, AccessoryPiece] = [
    readAccessory(gear.accessories[0], 0, heroLevel),
    readAccessory(gear.accessories[1], 1, heroLevel),
  ]
  return { mainHand, offHand, head, chest, hands, feet, accessories }
}

function readAttributes(value: unknown): Attributes {
  const record = requireObject(value, 'attributes')
  const attributes = {} as Attributes
  for (const key of ATTRIBUTE_KEYS) {
    assertNonNegative(record[key], key)
    attributes[key] = record[key] as number
  }
  return attributes
}

function racialMultipliers(input: HeroStatInput): { hp: number; power: number } {
  const ids = input.racialNodeIds ?? []
  let hp = 1
  let power = 1
  if (ids.includes(NODE_BEAST_THICK_HIDE)) hp *= THICK_HIDE_HP
  if (input.renaissance === true && ids.includes(NODE_HUMAN_RENAISSANCE)) {
    hp *= RENAISSANCE_HP
    power *= RENAISSANCE_POWER
  }
  return { hp, power }
}

export function deriveHeroStats(input: HeroStatInput): HeroDerivedStats {
  const record = requireObject(input, 'hero stat input')
  assertPositiveInteger(record.level, 'level')
  const level = record.level as number
  if (!includesName(HERO_CLASSES, String(record.classId))) {
    throw new Error(`unknown hero class ${describeValue(record.classId)}`)
  }
  const classId = record.classId as HeroClass
  const attributes = readAttributes(record.attributes)
  const gear = readGear(record.gear, level)
  const skillTimeCoefficient =
    record.skillTimeCoefficient === undefined ? 1 : (record.skillTimeCoefficient as number)
  assertFiniteNumber(skillTimeCoefficient, 'skill time coefficient')

  const crossTrained = (input.racialNodeIds ?? []).includes(NODE_HUMAN_CROSS_TRAINING)
  const prefersFor = (...args: Parameters<typeof prefers>): boolean => crossTrained || prefers(...args)

  const weaponRating = effectiveness(prefersFor(classId, 'weapon', gear.mainHand.kind))
  const neutralMain = neutralWeaponPower(gear.mainHand.itemLevel)
  const mainPower =
    scale(neutralMain, [WEAPON_POWER_FACTOR[gear.mainHand.kind], weaponRating]) * gear.mainHand.quality

  let physicalPower = POWER_PER_PRIMARY * attributes.strength
  let magicalPower = POWER_PER_PRIMARY * attributes.intellect
  if (gear.mainHand.kind === 'caster') magicalPower += mainPower
  else physicalPower += mainPower

  let armor = ZERO_RATIONAL
  let resistance = ZERO_RATIONAL
  if (gear.offHand !== null) {
    const offRating = effectiveness(prefersFor(classId, 'offHand', gear.offHand.kind))
    const neutralOff = neutralWeaponPower(gear.offHand.itemLevel)
    if (gear.offHand.kind === 'dagger') {
      physicalPower +=
        scale(neutralOff, [WEAPON_POWER_FACTOR.dagger, OFF_HAND_POWER_FACTOR, offRating]) *
        gear.offHand.quality
    } else if (gear.offHand.kind === 'focus') {
      magicalPower += scale(neutralOff, [OFF_HAND_POWER_FACTOR, offRating]) * gear.offHand.quality
    } else if (gear.offHand.kind === 'shield') {
      const shieldBase =
        SHIELD_DEFENSE_BASE * SHIELD_DEFENSE_PER_LEVEL.denominator +
        SHIELD_DEFENSE_PER_LEVEL.numerator * gear.offHand.itemLevel
      const shieldRatio: Ratio = { numerator: 1, denominator: SHIELD_DEFENSE_PER_LEVEL.denominator }
      armor = addScaled(armor, shieldBase, [shieldRatio, offRating], gear.offHand.quality)
      resistance = addScaled(resistance, shieldBase, [shieldRatio, offRating], gear.offHand.quality)
    }
    // Quiver adds no Power or Defense.
  }

  const armorPieces = [gear.head, gear.chest, gear.hands, gear.feet]
  for (const piece of armorPieces) {
    const contribution = addArmorPiece(armor, resistance, piece, prefersFor(classId, 'armor', piece.category))
    armor = contribution.armor
    resistance = contribution.resistance
  }

  let gearEvasion = 0
  if (armorPieces.every((piece) => piece.category === 'light')) {
    for (const piece of armorPieces) {
      gearEvasion += lightPieceEvasion(piece.slot, piece.itemLevel)
    }
  }

  const actionRatio = WEAPON_ACTION_TIME[gear.mainHand.kind]
  const critChance = clamp(
    CRIT_CHANCE_MIN,
    CRIT_CHANCE_MAX,
    CRIT_CHANCE_BASE +
      CRIT_CHANCE_PER_AGILITY * attributes.agility +
      optionalBonus(input.critChanceBonus, 'crit chance bonus'),
  )
  const critDamage =
    CRIT_DAMAGE_BASE +
    CRIT_DAMAGE_PER_STRENGTH * attributes.strength +
    optionalBonus(input.critDamageBonus, 'crit damage bonus')

  const racial = racialMultipliers(input)
  return {
    maxHp: (HERO_HP_BASE + HERO_HP_PER_LEVEL * level + HERO_HP_PER_VITALITY * attributes.vitality) * racial.hp,
    physicalPower: physicalPower * racial.power,
    magicalPower: magicalPower * racial.power,
    healingPower:
      (optionalBonus(input.equipmentHealingPower, 'equipment healing power') +
        POWER_PER_PRIMARY * attributes.spirit) *
      racial.power,
    accuracy: attributes.agility + optionalBonus(input.accuracyBonus, 'accuracy bonus'),
    evasion: attributes.agility + gearEvasion + optionalBonus(input.evasionBonus, 'evasion bonus'),
    critChance,
    critDamage,
    actionTime: actionTime(
      actionRatio.numerator / actionRatio.denominator,
      attributes.agility,
      skillTimeCoefficient,
    ),
    cooldownReduction: cooldownReduction(
      attributes.intellect,
      optionalBonus(input.cooldownReductionBonus, 'cooldown reduction bonus'),
    ),
    armorPenetration: armorPenetration(
      attributes.strength,
      optionalBonus(input.armorPenetrationBonus, 'armor penetration bonus'),
    ),
    magicalPenetration: magicalPenetration(
      attributes.intellect,
      optionalBonus(input.magicalPenetrationBonus, 'magical penetration bonus'),
    ),
    armor: armor.numerator / armor.denominator,
    resistance: resistance.numerator / resistance.denominator,
    resourceGenerationBonus:
      (RESOURCE_GENERATION_FACTOR * attributes.spirit) /
      (attributes.spirit + RESOURCE_GENERATION_SOFT_CAP),
    ordinaryXpBonus:
      (ORDINARY_XP_FACTOR * attributes.spirit) / (attributes.spirit + ORDINARY_XP_SOFT_CAP),
    outOfCombatRegenPerSecond: REGEN_PER_VITALITY * attributes.vitality,
    healingReceivedBonus: healingReceivedBonus(attributes.vitality),
  }
}

function clamp(min: number, max: number, value: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

const ABSOLUTE_OVERRIDE_KEYS = [
  'maxHp',
  'power',
  'armor',
  'resistance',
  'accuracy',
  'evasion',
  'consistency',
  'xp',
] as const

const MULTIPLIER_OVERRIDE_KEYS = [
  'hpMultiplier',
  'powerMultiplier',
  'defenseMultiplier',
  'armorMultiplier',
  'resistanceMultiplier',
  'actionTimeMultiplier',
  'xpMultiplier',
] as const

function readOverrides(value: unknown): EnemyStatOverrides {
  if (value === undefined) return {}
  const record = requireObject(value, 'enemy overrides')
  const overrides: EnemyStatOverrides = {}
  for (const key of ABSOLUTE_OVERRIDE_KEYS) {
    if (record[key] === undefined) continue
    assertNonNegative(record[key], key)
    overrides[key] = record[key] as number
  }
  if (record.actionTime !== undefined) {
    assertFiniteNumber(record.actionTime, 'actionTime')
    if (record.actionTime <= 0) {
      throw new Error(`actionTime must be greater than 0, received ${describeValue(record.actionTime)}`)
    }
    overrides.actionTime = record.actionTime
  }
  for (const key of MULTIPLIER_OVERRIDE_KEYS) {
    if (record[key] === undefined) continue
    assertNonNegative(record[key], key)
    overrides[key] = record[key] as number
  }
  if (record.evasionBonus !== undefined) {
    assertFiniteNumber(record.evasionBonus, 'evasionBonus')
    overrides.evasionBonus = record.evasionBonus
  }
  return overrides
}

function overridden(absolute: number | undefined, computed: number, round: boolean): number {
  if (absolute !== undefined) return absolute
  return round ? Math.round(computed) : computed
}

export function deriveEnemyStats(input: EnemyStatInput): EnemyDerivedStats {
  const record = requireObject(input, 'enemy stat input')
  assertPositiveInteger(record.level, 'level')
  const level = record.level as number
  if (!includesName(Object.keys(ENEMY_ARCHETYPE), String(record.archetype))) {
    throw new Error(`unknown enemy archetype ${describeValue(record.archetype)}`)
  }
  const archetype = ENEMY_ARCHETYPE[record.archetype as EnemyArchetype]
  if (record.elite !== undefined && typeof record.elite !== 'boolean') {
    throw new Error(`elite must be a boolean, received ${describeValue(record.elite)}`)
  }
  const elite = record.elite === true
  const overrides = readOverrides(record.overrides)

  const baselineHp = ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL * level
  const baselinePower = ENEMY_POWER_BASE + ENEMY_POWER_PER_LEVEL * level
  const baselineDefense = ENEMY_DEFENSE_BASE + ENEMY_DEFENSE_PER_LEVEL * level
  const baselineAccuracy = ENEMY_ACCURACY_BASE + ENEMY_ACCURACY_PER_LEVEL * level
  const baselineEvasion =
    ENEMY_EVASION_BASE +
    (ENEMY_EVASION_PER_LEVEL.numerator * level) / ENEMY_EVASION_PER_LEVEL.denominator
  const baselineAction = ENEMY_ACTION_TIME.numerator / ENEMY_ACTION_TIME.denominator
  const baselineXp = ENEMY_XP_BASE + ENEMY_XP_PER_LEVEL * level

  const eliteHp = elite ? ELITE_HP_MULTIPLIER : 1
  const elitePower = elite ? ELITE_POWER_MULTIPLIER : 1
  const eliteDefense = elite ? ELITE_DEFENSE_MULTIPLIER : 1
  const eliteXp = elite ? ELITE_XP_MULTIPLIER : 1
  const armorMultiplier =
    overrides.armorMultiplier ?? overrides.defenseMultiplier ?? archetype.defense
  const resistanceMultiplier =
    overrides.resistanceMultiplier ?? overrides.defenseMultiplier ?? archetype.defense

  // Action time stays fractional. Published times such as 2.2s and 2.64s are not integers.
  return {
    maxHp: overridden(
      overrides.maxHp,
      baselineHp * (overrides.hpMultiplier ?? archetype.hp) * eliteHp,
      true,
    ),
    power: overridden(
      overrides.power,
      baselinePower * (overrides.powerMultiplier ?? archetype.power) * elitePower,
      true,
    ),
    armor: overridden(overrides.armor, baselineDefense * armorMultiplier * eliteDefense, true),
    resistance: overridden(
      overrides.resistance,
      baselineDefense * resistanceMultiplier * eliteDefense,
      true,
    ),
    accuracy: overridden(overrides.accuracy, baselineAccuracy, true),
    evasion: overridden(
      overrides.evasion,
      baselineEvasion + (overrides.evasionBonus ?? archetype.evasionBonus),
      true,
    ),
    actionTime: overridden(
      overrides.actionTime,
      baselineAction * (overrides.actionTimeMultiplier ?? archetype.actionTime),
      false,
    ),
    consistency: overrides.consistency ?? ENEMY_CONSISTENCY,
    xp: overridden(overrides.xp, baselineXp * (overrides.xpMultiplier ?? archetype.xp) * eliteXp, true),
  }
}

/**
 * Multiply already-rounded rank-0 HP, Power, Armor, and Resistance by 1.12^R.
 * Rank 0 returns the same stats. Other stats, including XP, stay as they are.
 */
export function applyEchoRank(stats: EnemyDerivedStats, rank: number): EnemyDerivedStats {
  if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 0) {
    throw new Error(`echo rank must be an integer of at least 0, received ${describeValue(rank)}`)
  }
  if (rank === 0) return stats
  let factor = 1
  for (let step = 0; step < rank; step += 1) factor *= ECHO_RANK_GROWTH
  return {
    ...stats,
    maxHp: Math.round(stats.maxHp * factor),
    power: Math.round(stats.power * factor),
    armor: Math.round(stats.armor * factor),
    resistance: Math.round(stats.resistance * factor),
  }
}
