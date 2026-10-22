// Formula coefficients from GAME_DESIGN.md. Ratios are the published percentages
// (for example 1.4× is 7/5) so full-set defense lands on the published integers.

export type Ratio = {
  readonly numerator: number
  readonly denominator: number
}

export const HERO_CLASSES = ['warrior', 'assassin', 'ranger', 'mage', 'cleric'] as const
export type HeroClass = (typeof HERO_CLASSES)[number]

export const WEAPON_POWER_FACTOR = {
  dagger: { numerator: 17, denominator: 20 }, // 0.85
  oneHanded: { numerator: 1, denominator: 1 }, // 1
  bow: { numerator: 11, denominator: 10 }, // 1.1
  caster: { numerator: 1, denominator: 1 }, // 1
  twoHanded: { numerator: 27, denominator: 20 }, // 1.35
} as const
export type WeaponKind = keyof typeof WEAPON_POWER_FACTOR

export const WEAPON_ACTION_TIME = {
  dagger: { numerator: 3, denominator: 2 }, // 1.5s
  oneHanded: { numerator: 2, denominator: 1 }, // 2.0s
  bow: { numerator: 11, denominator: 5 }, // 2.2s
  caster: { numerator: 2, denominator: 1 }, // 2.0s
  twoHanded: { numerator: 13, denominator: 5 }, // 2.6s
} as const

export const OFF_HAND_KINDS = ['shield', 'focus', 'dagger', 'quiver'] as const
export type OffHandKind = (typeof OFF_HAND_KINDS)[number]

export const ARMOR_SLOTS = ['head', 'chest', 'hands', 'feet'] as const
export type ArmorSlot = (typeof ARMOR_SLOTS)[number]

export const ARMOR_SLOT_FRACTION = {
  chest: { numerator: 2, denominator: 5 }, // 40%
  head: { numerator: 1, denominator: 4 }, // 25%
  hands: { numerator: 3, denominator: 20 }, // 15%
  feet: { numerator: 1, denominator: 5 }, // 20%
} as const

export const ARMOR_CATEGORIES = ['heavy', 'medium', 'light', 'cloth'] as const
export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number]

export const ARMOR_CATEGORY_FACTOR = {
  heavy: {
    armor: { numerator: 7, denominator: 5 }, // 1.4
    resistance: { numerator: 3, denominator: 5 }, // 0.6
  },
  medium: {
    armor: { numerator: 1, denominator: 1 }, // 1
    resistance: { numerator: 1, denominator: 1 }, // 1
  },
  light: {
    armor: { numerator: 7, denominator: 10 }, // 0.7
    resistance: { numerator: 4, denominator: 5 }, // 0.8
  },
  cloth: {
    armor: { numerator: 1, denominator: 2 }, // 0.5
    resistance: { numerator: 7, denominator: 5 }, // 1.4
  },
} as const

export const CLASS_PREFERENCE: {
  readonly [key in HeroClass]: {
    readonly weapons: readonly WeaponKind[]
    readonly offHands: readonly OffHandKind[]
    readonly armor: ArmorCategory
  }
} = {
  warrior: { weapons: ['oneHanded'], offHands: ['shield'], armor: 'heavy' },
  assassin: { weapons: ['dagger'], offHands: ['dagger'], armor: 'light' },
  ranger: { weapons: ['bow'], offHands: ['quiver'], armor: 'medium' },
  mage: { weapons: ['caster'], offHands: ['focus'], armor: 'cloth' },
  cleric: { weapons: ['caster'], offHands: ['shield'], armor: 'medium' },
}

export const PREFERRED_EFFECTIVENESS: Ratio = { numerator: 1, denominator: 1 } // 100%
export const OFF_PREFERENCE_EFFECTIVENESS: Ratio = { numerator: 9, denominator: 10 } // 90%

export const HERO_HP_BASE = 50
export const HERO_HP_PER_LEVEL = 5
export const HERO_HP_PER_VITALITY = 10
export const POWER_PER_PRIMARY = 2

export const NEUTRAL_WEAPON_POWER_BASE = 8
export const NEUTRAL_WEAPON_POWER_PER_LEVEL = 2
export const OFF_HAND_POWER_FACTOR: Ratio = { numerator: 3, denominator: 10 } // 30%

export const SHIELD_DEFENSE_BASE = 3
export const SHIELD_DEFENSE_PER_LEVEL: Ratio = { numerator: 3, denominator: 4 } // 0.75

export const ARMOR_BUDGET_BASE = 10
export const ARMOR_BUDGET_PER_LEVEL = 3

export const LIGHT_EVASION_BASE = 1
export const LIGHT_EVASION_PER_LEVEL: Ratio = { numerator: 1, denominator: 4 } // 0.25

export const CRIT_CHANCE_BASE = 0.05
export const CRIT_CHANCE_PER_AGILITY = 0.004
export const CRIT_CHANCE_MIN = 0
export const CRIT_CHANCE_MAX = 0.75
export const CRIT_DAMAGE_BASE = 1.5
export const CRIT_DAMAGE_PER_STRENGTH = 0.005

export const ACTION_TIME_FLOOR_SECONDS = 0.5
export const AGILITY_SPEED_SCALE = 100

export const COOLDOWN_REDUCTION_FACTOR = 0.3
export const COOLDOWN_REDUCTION_SOFT_CAP = 50
export const COOLDOWN_REDUCTION_CAP = 0.5

export const PENETRATION_FACTOR = 0.4
export const PENETRATION_SOFT_CAP = 50
export const PENETRATION_CAP = 0.8

export const DEFENSE_REDUCTION_CAP = 0.8
export const DEFENSE_SOFT_CAP = 50
export const DEFENSE_PER_ATTACKER_LEVEL = 5

export const REGEN_PER_VITALITY = 0.05
export const HEALING_RECEIVED_PER_VITALITY = 0.005
export const HEALING_RECEIVED_CAP = 0.5

export const RESOURCE_GENERATION_FACTOR = 0.5
export const RESOURCE_GENERATION_SOFT_CAP = 50
export const ORDINARY_XP_FACTOR = 0.1
export const ORDINARY_XP_SOFT_CAP = 50

export const XP_TO_NEXT_BASE = 50
export const XP_TO_NEXT_EXPONENT = 1.5

export const ENEMY_HP_BASE = 80
export const ENEMY_HP_PER_LEVEL = 20
export const ENEMY_POWER_BASE = 8
export const ENEMY_POWER_PER_LEVEL = 1
export const ENEMY_DEFENSE_BASE = 5
export const ENEMY_DEFENSE_PER_LEVEL = 2
export const ENEMY_ACCURACY_BASE = 10
export const ENEMY_ACCURACY_PER_LEVEL = 1
export const ENEMY_EVASION_BASE = 5
export const ENEMY_EVASION_PER_LEVEL: Ratio = { numerator: 3, denominator: 4 } // 0.75
export const ENEMY_ACTION_TIME: Ratio = { numerator: 11, denominator: 5 } // 2.2s
export const ENEMY_CONSISTENCY = 0
export const ENEMY_XP_BASE = 5
export const ENEMY_XP_PER_LEVEL = 2

export const ENEMY_ARCHETYPE = {
  swarm: { hp: 0.45, power: 0.65, defense: 0.6, actionTime: 0.75, xp: 0.4, evasionBonus: 0 },
  skirmisher: { hp: 0.8, power: 0.9, defense: 0.75, actionTime: 0.8, xp: 0.85, evasionBonus: 10 },
  standard: { hp: 1, power: 1, defense: 1, actionTime: 1, xp: 1, evasionBonus: 0 },
  tank: { hp: 1.6, power: 0.8, defense: 1.5, actionTime: 1.2, xp: 1.25, evasionBonus: 0 },
  burst: { hp: 0.8, power: 1.25, defense: 0.8, actionTime: 1.25, xp: 1.2, evasionBonus: 0 },
  support: { hp: 0.75, power: 0.7, defense: 0.8, actionTime: 1, xp: 1, evasionBonus: 0 },
} as const
export type EnemyArchetype = keyof typeof ENEMY_ARCHETYPE

export const ELITE_HP_MULTIPLIER = 3
export const ELITE_POWER_MULTIPLIER = 1.3
export const ELITE_DEFENSE_MULTIPLIER = 1.25
export const ELITE_XP_MULTIPLIER = 3

/** Fixed simulation step from GAME_DESIGN "Simulation clock and action timing". */
export const STEP_MS = 10

/**
 * Hit chance is `clamp(5%, 95%, 75% + Accuracy − Evasion)`.
 * Accuracy and Evasion are ratings in percentage points (16 Accuracy is +16%).
 */
export const HIT_CHANCE_BASE_POINTS = 75
export const HIT_CHANCE_MIN_POINTS = 5
export const HIT_CHANCE_MAX_POINTS = 95

/** `60% + (0.25% × Consistency)`, ceiling 100%. Consistency is clamped to 0–100. */
export const DAMAGE_FLOOR_BASE_POINTS = 60
export const DAMAGE_FLOOR_POINTS_PER_CONSISTENCY = 0.25
export const CONSISTENCY_MIN = 0
export const CONSISTENCY_MAX = 100
export const DAMAGE_ROLL_CEILING = 1

/** Weapon basic attacks use 100% of the relevant Power. */
export const BASIC_ATTACK_COEFFICIENT = 1

/**
 * Direct healing uses the centered roll on [0.90, 1.00).
 * Q7 is unanswered; this is the recommended distribution, matching `centeredRoll`.
 */
export const HEALING_ROLL_FLOOR = 0.9
export const HEALING_ROLL_CEILING = 1

export const MIN_UNSHIELDED_DAMAGE = 1

/**
 * Status application uses percentage points, same as Accuracy.
 * `clamp(5%, 95%, base chance + Potency − Resistance)`.
 */
export const STATUS_CHANCE_MIN_POINTS = 5
export const STATUS_CHANCE_MAX_POINTS = 95

/** Initial status set. Boss rules scale these; they are not stored on the boss. */
export const BLEED_MAX_STACKS = 5
export const BLEED_ACTIONS_PER_STACK = 3
export const POISON_MAX_STACKS = 5
export const POISON_DURATION_SECONDS = 8
export const POISON_TICK_SECONDS = 2
export const BURN_MAX_INTENSITY = 5
export const BURN_DURATION_SECONDS = 5
export const BURN_TICK_SECONDS = 1
export const CHILL_MAX_STACKS = 3
export const CHILL_DURATION_SECONDS = 6
/** Additional action-speed loss at stack 1, then 2, then 3. */
export const CHILL_SLOW_BY_STACK = [0.1, 0.07, 0.05] as const
export const STUN_DELAY_SECONDS = 1.5
export const EXPOSE_DURATION_SECONDS = 8

/** Bosses use about 60% of normal stack caps: 5 → 3 and 3 → 2. */
export const BOSS_STACK_CAP_FACTOR = 0.6
/** Boss status durations are half of normal. Bleed's action count is not a duration. */
export const BOSS_DURATION_FRACTION = 0.5
/** Boss Stun delay is 35% of the normal 1.5 s push (0.525 s). */
export const BOSS_STUN_FRACTION = 0.35
