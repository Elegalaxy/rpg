import type { CombatHero, SkillDef, SkillEffect } from '../types.ts'
import { NODE_JUDGMENT, NODE_WARD as NODE_CLERIC_WARD } from './clericAdjust.ts'
import { NODE_FIREBALL, NODE_FROST_LANCE, NODE_MANA_WARD } from './mageAdjust.ts'
import { NODE_PIERCING_ARROW, NODE_SNARE_TRAP } from './ranger.ts'
import { NODE_SECOND_WIND, NODE_SUNDERING_BLOW } from './warriorAdjust.ts'

/**
 * Starting-skill nodes (GAME_DESIGN §8, Batch C). Each node still unlocks its skill and now also
 * improves it. Skill-def bonuses (cooldown, cost, coefficient, barrier duration) are applied here by
 * returning a derived def. Bonuses that act outside the def (Shield Brace Fury, Mark for Death
 * Advantage, Execute base damage) live in the class modules and use the constants below.
 */

export const NODE_VENOM_EDGE = 'assassin-venom-edge'
export const NODE_MARK_FOR_DEATH = 'assassin-mark-for-death'
export const NODE_EXECUTE = 'assassin-execute'

export const SUNDERING_BLOW_NODE_COOLDOWN = 5
export const SECOND_WIND_NODE_COOLDOWN = 12
export const SHIELD_BRACE_NODE_FURY_BASE = 10
export const VENOM_EDGE_NODE_TICK = 0.15
export const MARK_FOR_DEATH_NODE_ADVANTAGE = 1
export const EXECUTE_NODE_BASE = 1.2
export const PIERCING_ARROW_NODE_COST = 15
export const SNARE_TRAP_NODE_COOLDOWN = 6
export const FIREBALL_NODE_COST = 25
export const FROST_LANCE_NODE_COEFFICIENT = 1.3
export const MANA_WARD_NODE_COEFFICIENT = 0.85
export const WARD_NODE_DURATION = 10
export const JUDGMENT_NODE_COEFFICIENT = 2.8

type Bonus = {
  nodeId: string
  skillId: string
  apply: (skill: SkillDef) => SkillDef
}

function mapEffects(skill: SkillDef, change: (effect: SkillEffect) => SkillEffect): SkillDef {
  return { ...skill, effects: skill.effects.map(change) }
}

const BONUSES: readonly Bonus[] = [
  {
    nodeId: NODE_SUNDERING_BLOW,
    skillId: 'sundering-blow',
    apply: (skill) => ({ ...skill, cooldownSeconds: SUNDERING_BLOW_NODE_COOLDOWN }),
  },
  {
    nodeId: NODE_SECOND_WIND,
    skillId: 'second-wind',
    apply: (skill) => ({ ...skill, cooldownSeconds: SECOND_WIND_NODE_COOLDOWN }),
  },
  {
    nodeId: NODE_VENOM_EDGE,
    skillId: 'venom-edge',
    apply: (skill) =>
      mapEffects(skill, (effect) =>
        effect.kind === 'applyStatus' && effect.statusId === 'poison'
          ? { ...effect, coefficient: VENOM_EDGE_NODE_TICK }
          : effect,
      ),
  },
  {
    nodeId: NODE_PIERCING_ARROW,
    skillId: 'piercing-arrow',
    apply: (skill) => ({ ...skill, cost: PIERCING_ARROW_NODE_COST }),
  },
  {
    nodeId: NODE_SNARE_TRAP,
    skillId: 'snare-trap',
    apply: (skill) => ({ ...skill, cooldownSeconds: SNARE_TRAP_NODE_COOLDOWN }),
  },
  {
    nodeId: NODE_FIREBALL,
    skillId: 'fireball',
    apply: (skill) => ({ ...skill, cost: FIREBALL_NODE_COST }),
  },
  {
    nodeId: NODE_FROST_LANCE,
    skillId: 'frost-lance',
    apply: (skill) =>
      mapEffects(skill, (effect) =>
        effect.kind === 'damage' ? { ...effect, coefficient: FROST_LANCE_NODE_COEFFICIENT } : effect,
      ),
  },
  {
    nodeId: NODE_MANA_WARD,
    skillId: 'mana-ward',
    apply: (skill) =>
      mapEffects(skill, (effect) =>
        effect.kind === 'barrier' ? { ...effect, coefficient: MANA_WARD_NODE_COEFFICIENT } : effect,
      ),
  },
  {
    nodeId: NODE_CLERIC_WARD,
    skillId: 'ward',
    apply: (skill) =>
      mapEffects(skill, (effect) =>
        effect.kind === 'barrier' ? { ...effect, durationSeconds: WARD_NODE_DURATION } : effect,
      ),
  },
  {
    nodeId: NODE_JUDGMENT,
    skillId: 'judgment',
    apply: (skill) =>
      mapEffects(skill, (effect) =>
        effect.kind === 'damage' ? { ...effect, coefficient: JUDGMENT_NODE_COEFFICIENT } : effect,
      ),
  },
]

const BONUS_BY_SKILL: { readonly [skillId: string]: Bonus | undefined } = Object.fromEntries(
  BONUSES.map((bonus) => [bonus.skillId, bonus]),
)

/** One derived def per base def, so repeated lookups return the same object. */
const DERIVED = new WeakMap<SkillDef, SkillDef>()

/** The skill as this hero uses it: the base def, or the def improved by the hero's starting-skill node. */
export function heroSkill(hero: Pick<CombatHero, 'allocatedNodeIds'>, skill: SkillDef): SkillDef {
  const bonus = BONUS_BY_SKILL[skill.id]
  if (bonus === undefined || !hero.allocatedNodeIds.includes(bonus.nodeId)) return skill
  let derived = DERIVED.get(skill)
  if (derived === undefined) {
    derived = bonus.apply(skill)
    DERIVED.set(skill, derived)
  }
  return derived
}
