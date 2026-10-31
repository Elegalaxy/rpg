import type { CombatHero, SkillDef } from '../types.ts'

export const NODE_SMITE = 'cleric-smite'
export const NODE_VOWKEEPER = 'cleric-vowkeeper'
export const NODE_PENANCE = 'cleric-penance'
export const NODE_STEADFAST_SPIRIT = 'cleric-steadfast-spirit'
export const NODE_EXALTED_VOW = 'cleric-exalted-vow'
export const NODE_MEND = 'cleric-mend'
export const NODE_WARD = 'cleric-ward'
export const NODE_CONSECRATION = 'cleric-consecration'
export const NODE_SAFEGUARD = 'cleric-safeguard'
export const NODE_LIVING_SANCTUARY = 'cleric-living-sanctuary'
export const NODE_JUDGMENT = 'cleric-judgment'
export const NODE_RIGHTEOUS_FORCE = 'cleric-righteous-force'
export const NODE_RECIPROCAL_PURPOSE = 'cleric-reciprocal-purpose'
export const NODE_FINAL_MERCY = 'cleric-final-mercy'
export const NODE_SACRED_BALANCE = 'cleric-sacred-balance'

export const SMITE_ID = 'smite'
export const MEND_ID = 'mend'
export const WARD_ID = 'ward'
export const JUDGMENT_ID = 'judgment'
export const CONSECRATION_ID = 'consecration'
export const PENANCE_ID = 'penance'
export const RELEASE_HEAL_ID = 'sanctuary-release-heal'
export const RELEASE_STRIKE_ID = 'sanctuary-release-strike'
export const RELEASE_IDS: readonly string[] = [RELEASE_HEAL_ID, RELEASE_STRIKE_ID]

export const SMITE_NODE_COEFFICIENT = 1.2
export const MEND_NODE_COEFFICIENT = 1.4
export const VOWKEEPER_FACTOR = 1.2
export const EXALTED_FACTOR = 1.5
export const STEADFAST_HP = 0.5
export const STEADFAST_BASE = 5
export const EXALTED_FAITH_LOSS = 50
export const EXALTED_LOCKOUT_MS = 5000
export const SAFEGUARD_STEP = 0.05
export const SAFEGUARD_CAP = 5
export const SANCTUARY_STORE = 0.3
export const SANCTUARY_CAP = 0.5
export const SANCTUARY_WINDOW_MS = 8000
export const RIGHTEOUS_DAMAGE = 1.15
export const RIGHTEOUS_PENETRATION = 0.1
export const RECIPROCAL_FACTOR = 0.8
export const MERCY_FACTOR = 1.25

export const BALANCE_MAXIMUM = 100
export const BALANCE_BASIC_WRATH = 5
export const BALANCE_SMITE_WRATH = 10
export const BALANCE_MEND_WRATH = 25
export const BALANCE_MEND_GRACE = 15
export const BALANCE_WARD_WRATH = 30
export const BALANCE_WARD_GRACE = 20
export const BALANCE_JUDGMENT_GRACE = 50
export const BALANCE_JUDGMENT_WRATH = 25
export const BALANCE_CONSECRATION_GRACE = 20
export const BALANCE_CONSECRATION_WRATH = 20
export const BALANCE_PENANCE_GRACE = 20
export const BALANCE_PENANCE_WRATH = 20

export const STATE_LOG_CURSOR = 'logCursor'
export const STATE_STEADFAST_USED = 'steadfastUsed'
export const STATE_LOCKOUT_UNTIL = 'vowLockoutUntilMs'
export const STATE_LAST_CATEGORY = 'lastCategory'
export const STATE_MERCY_STRIKE = 'mercyStrike'
export const STATE_MERCY_HEAL = 'mercyHeal'
export const STATE_SANCTUARY_STORED = 'sanctuaryStored'
export const STATE_SANCTUARY_ENDS = 'sanctuaryEndsMs'
export const STATE_WARD_EFFECTIVE = 'wardEffective'
export const STATE_GRACE = 'grace'
export const STATE_WRATH = 'wrath'
export const STATE_ACTION_COST = 'actionFaithCost'

export type SkillCategory = 'offensive' | 'defensive'

export function hasNode(hero: CombatHero, id: string): boolean {
  return hero.allocatedNodeIds.includes(id)
}

export function isCleric(hero: CombatHero): boolean {
  return hero.classId === 'cleric'
}

export function balanceActive(hero: CombatHero): boolean {
  return isCleric(hero) && hasNode(hero, NODE_SACRED_BALANCE)
}

export function numberState(hero: CombatHero, key: string): number {
  const value = hero.classState[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function setState(hero: CombatHero, key: string, value: number | string | boolean | null): void {
  if (value === null) {
    if (hero.classState[key] === undefined) return
    const next: CombatHero['classState'] = {}
    for (const existing of Object.keys(hero.classState)) {
      if (existing === key) continue
      const kept = hero.classState[existing]
      if (kept !== undefined) next[existing] = kept
    }
    hero.classState = next
    return
  }
  hero.classState = { ...hero.classState, [key]: value }
}

/** Offensive skills carry the attack tag. Heals and wards are defensive. Others count as neither. */
export function categoryOf(skill: SkillDef): SkillCategory | null {
  if (RELEASE_IDS.includes(skill.id)) return null
  if (skill.tags.includes('attack')) return 'offensive'
  if (skill.tags.includes('heal') || skill.tags.includes('defense')) return 'defensive'
  return null
}

/** Exalted Vow's lockout stops all Faith generation, including Penance. */
export function faithGenerationLocked(hero: CombatHero, timeMs: number): boolean {
  if (!isCleric(hero)) return false
  const until = hero.classState[STATE_LOCKOUT_UNTIL]
  return typeof until === 'number' && timeMs < until
}

export function releaseWindowOpen(hero: CombatHero, timeMs: number): boolean {
  if (!isCleric(hero) || !hasNode(hero, NODE_LIVING_SANCTUARY)) return false
  const ends = hero.classState[STATE_SANCTUARY_ENDS]
  if (typeof ends !== 'number') return false
  if (timeMs < ends || timeMs >= ends + SANCTUARY_WINDOW_MS) return false
  return numberState(hero, STATE_SANCTUARY_STORED) > 0
}

/** The two temporary Sanctuary Release skills sit outside the loadout, like Convergence spells. */
export function releaseSlotSkill(hero: CombatHero, skillId: string): boolean {
  return isCleric(hero) && hasNode(hero, NODE_LIVING_SANCTUARY) && RELEASE_IDS.includes(skillId)
}

/** Heal coefficient after nodes and Final Mercy. Release heals use the stored value. */
export function healCoefficient(hero: CombatHero, skill: SkillDef, coefficient: number): number {
  if (!isCleric(hero)) return coefficient
  if (skill.id === RELEASE_HEAL_ID) {
    const stored = numberState(hero, STATE_SANCTUARY_STORED)
    return hero.healingPower > 0 ? stored / hero.healingPower : 0
  }
  let value = coefficient
  if (skill.id === MEND_ID && hasNode(hero, NODE_MEND)) value = MEND_NODE_COEFFICIENT
  if ((skill.id === MEND_ID || skill.id === WARD_ID) && hero.classState[STATE_MERCY_HEAL] === true) {
    value *= MERCY_FACTOR
  }
  return value
}

export function barrierFactor(hero: CombatHero, skill: SkillDef): number {
  if (!isCleric(hero) || skill.id !== WARD_ID) return 1
  return hero.classState[STATE_MERCY_HEAL] === true ? MERCY_FACTOR : 1
}

/** Righteous Force: a Faith-spending offensive skill gains 10 points of magical penetration. */
export function spendsForOffense(skill: SkillDef): boolean {
  return skill.cost > 0 && skill.tags.includes('attack')
}

export function righteousPenetration(hero: CombatHero, skill: SkillDef): number {
  if (!isCleric(hero) || !hasNode(hero, NODE_RIGHTEOUS_FORCE)) return 0
  return spendsForOffense(skill) ? RIGHTEOUS_PENETRATION : 0
}

/** Faith cost after Reciprocal Purpose. Sacred Balance prices skills in Grace and Wrath instead. */
export function faithCost(hero: CombatHero, skill: SkillDef): number {
  if (!isCleric(hero) || skill.cost <= 0) return skill.cost
  if (hasNode(hero, NODE_RECIPROCAL_PURPOSE)) {
    const last = hero.classState[STATE_LAST_CATEGORY]
    const now = categoryOf(skill)
    if (now !== null && last !== undefined && last !== now) return skill.cost * RECIPROCAL_FACTOR
  }
  return skill.cost
}

export type BalanceCost = { grace: number; wrath: number }

export function balanceCost(skill: SkillDef): BalanceCost | null {
  switch (skill.id) {
    case MEND_ID:
      return { grace: 0, wrath: BALANCE_MEND_WRATH }
    case WARD_ID:
      return { grace: 0, wrath: BALANCE_WARD_WRATH }
    case JUDGMENT_ID:
      return { grace: BALANCE_JUDGMENT_GRACE, wrath: 0 }
    case CONSECRATION_ID:
      return { grace: BALANCE_CONSECRATION_GRACE, wrath: BALANCE_CONSECRATION_WRATH }
    default:
      return null
  }
}

/** Null when the cleric can use the skill right now. */
export function clericSkillBlock(hero: CombatHero, skill: SkillDef, timeMs: number): string | null {
  if (!isCleric(hero)) return null
  if (RELEASE_IDS.includes(skill.id)) return releaseWindowOpen(hero, timeMs) ? null : 'no stored Sanctuary'
  if (balanceActive(hero)) {
    const cost = balanceCost(skill)
    if (cost === null) return null
    if (numberState(hero, STATE_GRACE) < cost.grace || numberState(hero, STATE_WRATH) < cost.wrath) {
      return 'unaffordable'
    }
  }
  return null
}

export function clericAffordable(hero: CombatHero, skill: SkillDef): boolean {
  if (balanceActive(hero)) return true
  return faithCost(hero, skill) <= hero.classResource
}

/** Penance gives Grace and Wrath under Sacred Balance, not Faith. */
export function penanceResourceBase(hero: CombatHero, skill: SkillDef, base: number): number {
  if (skill.id === PENANCE_ID && balanceActive(hero)) return 0
  return base
}
