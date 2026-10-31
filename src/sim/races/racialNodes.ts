import type { CombatHero } from '../types.ts'

export const NODE_HUMAN_QUICK_STUDY = 'human-quick-study'
export const NODE_HUMAN_CROSS_TRAINING = 'human-cross-training'
export const NODE_HUMAN_FLEXIBLE_ROUTE = 'human-flexible-route'
export const NODE_HUMAN_RENAISSANCE = 'human-renaissance'
export const NODE_ELF_FOCUSED_MIND = 'elf-focused-mind'
export const NODE_ELF_EFFICIENT_FLOW = 'elf-efficient-flow'
export const NODE_ELF_FORESIGHT = 'elf-foresight'
export const NODE_ELF_PERFECT_CLARITY = 'elf-perfect-clarity'
export const NODE_BEAST_THICK_HIDE = 'beastfolk-thick-hide'
export const NODE_BEAST_BLOOD_SCENT = 'beastfolk-blood-scent'
export const NODE_BEAST_LONG_HUNT = 'beastfolk-long-hunt'
export const NODE_BEAST_APEX_INSTINCT = 'beastfolk-apex-instinct'
export const NODE_UNDEAD_PATIENT_KILLER = 'undead-patient-killer'
export const NODE_UNDEAD_SOUL_HARVEST = 'undead-soul-harvest'
export const NODE_UNDEAD_CURSEBOUND = 'undead-cursebound'
export const NODE_UNDEAD_DEATHLY_PRECISION = 'undead-deathly-precision'

export const CURSE_HOLLOW_HUNGER = 'hollow-hunger'
export const CURSE_GRAVE_PATIENCE = 'grave-patience'
export const CURSE_SOUL_DEBT = 'soul-debt'
export const CURSES = [CURSE_HOLLOW_HUNGER, CURSE_GRAVE_PATIENCE, CURSE_SOUL_DEBT] as const
export type Curse = (typeof CURSES)[number]

export const HUMAN_QUICK_STUDY_MULTIPLIER = 1.08
export const RENAISSANCE_POWER = 1.08
export const RENAISSANCE_HP = 1.08
export const RENAISSANCE_CONSISTENCY = 10
export const THICK_HIDE_HP = 1.1
export const THICK_HIDE_REGEN = 1.25
export const LONG_HUNT_PER_TIER = 0.05
export const APEX_CRIT_DAMAGE = 0.15
export const APEX_HEALING = 1.15
export const FOCUS_GAIN_NODE = 15
export const FOCUS_LOSS_NODE = 0.75
export const FLOW_BONUS_CAP = 0.2
export const FORESIGHT_FOCUS = 75
export const FORESIGHT_EVASION = 10
export const CLARITY_FLOOR = 0.95
export const CLARITY_HEAL_FLOOR_BONUS = 0.05
export const CLARITY_COOLDOWN = 0.1
export const SOUL_CAP = 5
export const HOLLOW_POWER = 1.15
export const HOLLOW_HEALING_RECEIVED = 0.75
export const HOLLOW_HP_FRACTION = 0.3
export const HOLLOW_HEAL_FRACTION = 0.1
export const GRAVE_SPEED = 0.85
export const GRAVE_READY = 2
export const SOUL_DEBT_PER_SOUL = 0.03
export const SOUL_DEBT_FEE = 1.5
export const PRECISION_CRIT = 0.25

export function hasRacialNode(ids: readonly string[] | undefined, id: string): boolean {
  return ids !== undefined && ids.includes(id)
}

export function heroHas(hero: CombatHero, id: string): boolean {
  return hero.allocatedNodeIds.includes(id)
}

/** The curse only counts when Cursebound is allocated. */
export function activeCurse(hero: CombatHero): Curse | null {
  if (!heroHas(hero, NODE_UNDEAD_CURSEBOUND)) return null
  const curse = hero.suppliedCurse
  return curse !== null && (CURSES as readonly string[]).includes(curse) ? (curse as Curse) : null
}

export function soulsOf(hero: CombatHero): number {
  const value = hero.raceState.souls
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return value > SOUL_CAP ? SOUL_CAP : value
}
