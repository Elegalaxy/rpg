import { skillAffordable, skillOffCooldown } from '../skills.ts'
import type { ClassModule, CombatState, FallbackDecision, GameDefs } from '../types.ts'
import { defineClassResource } from './resources.ts'

export const MANA_RESOURCE_ID = 'mana'
export const MANA_MAXIMUM = 100
export const MANA_SCOPE = 'expedition' as const
export const MANA_REGEN_PER_SECOND = 2
export const ARCANE_BOLT_ID = 'arcane-bolt'
export const MAGE_WAIT_REASON = 'nothing is affordable'

function encounterStart(state: CombatState, timeMs: number): void {
  defineClassResource(state, timeMs, {
    id: MANA_RESOURCE_ID,
    maximum: MANA_MAXIMUM,
    scope: MANA_SCOPE,
    amount: MANA_MAXIMUM,
    regenPerSecond: MANA_REGEN_PER_SECOND,
  })
}

/** Arcane Bolt is innate. It is not equipped and does not take a loadout slot. */
function fallbackAction(state: CombatState, defs: GameDefs, timeMs: number): FallbackDecision {
  const skill = defs.skills[ARCANE_BOLT_ID]
  if (skill === undefined) {
    throw new Error(`mage fallback skill '${ARCANE_BOLT_ID}' is not defined`)
  }
  if (skillAffordable(state.hero, skill) && skillOffCooldown(state.hero, skill, timeMs)) {
    return { kind: 'skill', skillId: skill.id }
  }
  return { kind: 'wait', reason: MAGE_WAIT_REASON }
}

export const mageClass: ClassModule = {
  encounterStart,
  fallbackAction,
}
