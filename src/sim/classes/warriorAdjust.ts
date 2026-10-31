import type { CombatHero, SkillDef } from '../types.ts'

export const NODE_DRIVING_BLOW = 'warrior-driving-blow'
export const NODE_RISING_HEAT = 'warrior-rising-heat'
export const NODE_CLEAVE = 'warrior-cleave'
export const NODE_BLOODLETTING = 'warrior-bloodletting'
export const NODE_BERSERKER = 'warrior-berserker'
export const NODE_SUNDERING_BLOW = 'warrior-sundering-blow'
export const NODE_WEAPON_DISCIPLINE = 'warrior-weapon-discipline'
export const NODE_RECKLESS_STRIKE = 'warrior-reckless-strike'
export const NODE_HEAVY_FOLLOW_THROUGH = 'warrior-heavy-follow-through'
export const NODE_WEAPON_MASTER = 'warrior-weapon-master'
export const NODE_SHIELD_BRACE = 'warrior-shield-brace'
export const NODE_SECOND_WIND = 'warrior-second-wind'
export const NODE_DEFIANCE = 'warrior-defiance'
export const NODE_SHIELD_IMPACT = 'warrior-shield-impact'
export const NODE_UNBROKEN = 'warrior-unbroken'

export const DRIVING_BLOW_ID = 'driving-blow'
export const CLEAVE_ID = 'cleave'
export const SUNDERING_BLOW_ID = 'sundering-blow'

/** Added to Driving Blow's authored 15, for 20 before Spirit. */
export const DRIVING_BLOW_FURY_BONUS = 5
export const DRIVING_BLOW_COOLDOWN_SECONDS = 2.5
export const RISING_HEAT_FACTOR = 1.2
export const BLEED_BASE_CHANCE = 0.75
export const BLEED_POWER_COEFFICIENT = 0.1
export const BLEEDING_TARGET_FURY = 3
export const BERSERKER_PHYSICAL_BONUS = 0.5
export const BERSERKER_INCOMING = 1.25
export const WEAPON_DISCIPLINE_FACTOR = 0.9
export const HEAVY_TIME_COEFFICIENT = 1.2
/** Duration multiplier. 25% faster means the action-time coefficient is three quarters. */
export const HEAVY_SPEED_FACTOR = 0.75
export const PERFECT_FORM_LENGTH = 3
export const PERFECT_FORM_ROLL_FLOOR = 0.95
export const DEFIANCE_HP_FRACTION = 0.35
export const DEFIANCE_FACTOR = 1.25
export const SHIELD_IMPACT_WINDOW_MS = 6_000
export const SHIELD_IMPACT_STUN_CHANCE = 0.75
export const UNBROKEN_REDUCTION_AT_FULL = 0.15
export const UNBROKEN_LETHAL_FURY = 75

export const STATE_PERFECT_FORM = 'perfectForm'
export const STATE_PERFECT_FORM_SKILLS = 'perfectFormSkills'
export const STATE_WEAPON_CHAIN = 'weaponChain'
export const STATE_FOLLOW_THROUGH = 'followThrough'
export const STATE_SHIELD_IMPACT_UNTIL = 'shieldImpactUntil'
export const STATE_UNBROKEN_USED = 'unbrokenUsed'
export const STATE_DAMAGE_ROLL_FLOOR = 'damageRollFloorBonus'

export function hasNode(hero: CombatHero, id: string): boolean {
  return hero.allocatedNodeIds.includes(id)
}

/** Weapon skills are the attack-tagged actives. Shield Brace and Second Wind are not. */
export function isWeaponSkill(skill: SkillDef): boolean {
  return skill.tags.includes('attack')
}

/** Strictly below the fraction. 35% uses thousandths: `hp * 1000 < maxHp * 350`. */
export function belowHpFraction(hero: CombatHero, fraction: number): boolean {
  if (hero.maxHp <= 0) return false
  const thousandths = Math.round(fraction * 1000)
  return hero.hp * 1000 < hero.maxHp * thousandths
}

/**
 * Rising Heat is 1.2. Defiance below 35% HP is another 1.25.
 * Both multiply Spirit. No allocated node returns exactly 1.
 */
export function furyGenerationMultiplier(hero: CombatHero): number {
  if (hero.classId !== 'warrior') return 1
  let factor = 1
  if (hasNode(hero, NODE_RISING_HEAT)) factor *= RISING_HEAT_FACTOR
  if (hasNode(hero, NODE_DEFIANCE) && belowHpFraction(hero, DEFIANCE_HP_FRACTION)) {
    factor *= DEFIANCE_FACTOR
  }
  return factor
}

/** Defiance multiplies healing received by 1.25 below 35% HP. Otherwise the hero's own value. */
export function adjustedHealingReceived(hero: CombatHero): number {
  if (hero.classId !== 'warrior') return hero.healingReceived
  if (!hasNode(hero, NODE_DEFIANCE) || !belowHpFraction(hero, DEFIANCE_HP_FRACTION)) {
    return hero.healingReceived
  }
  return hero.healingReceived * DEFIANCE_FACTOR
}

export function perfectFormReady(hero: CombatHero): boolean {
  return hero.classState[STATE_PERFECT_FORM] === true
}

/** Perfect Form pays 0. Weapon Discipline then takes 10% off a weapon skill's listed cost. */
export function resolvedSkillCost(hero: CombatHero, skill: SkillDef): number {
  if (hero.classId !== 'warrior') return skill.cost
  if (isWeaponSkill(skill) && perfectFormReady(hero) && hasNode(hero, NODE_WEAPON_MASTER)) return 0
  if (isWeaponSkill(skill) && hasNode(hero, NODE_WEAPON_DISCIPLINE)) {
    return skill.cost * WEAPON_DISCIPLINE_FACTOR
  }
  return skill.cost
}

/**
 * Driving Blow's node replaces the authored 3 seconds with 2.5.
 * Weapon Discipline then multiplies weapon-skill bases by 0.9.
 */
export function adjustedCooldownSeconds(hero: CombatHero, skill: SkillDef): number {
  if (hero.classId !== 'warrior') return skill.cooldownSeconds
  let base = skill.cooldownSeconds
  if (skill.id === DRIVING_BLOW_ID && hasNode(hero, NODE_DRIVING_BLOW)) {
    base = DRIVING_BLOW_COOLDOWN_SECONDS
  }
  if (isWeaponSkill(skill) && hasNode(hero, NODE_WEAPON_DISCIPLINE)) {
    base *= WEAPON_DISCIPLINE_FACTOR
  }
  return base
}
