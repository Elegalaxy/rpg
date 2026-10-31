import { xpFromEnemies, type XpMember } from '../progression.ts'
import type { ClassModule, CombatState } from '../types.ts'
import { logRace } from './events.ts'

/** Ordinary XP and, later, ordinary mastery. Milestones stay on the unscaled helper. */
export const HUMAN_ORDINARY_XP_MULTIPLIER = 1.05

export function humanOrdinaryXp(heroLevel: number, spirit: number, members: readonly XpMember[]): number {
  return xpFromEnemies(heroLevel, spirit, members, HUMAN_ORDINARY_XP_MULTIPLIER)
}

function encounterStart(state: CombatState, timeMs: number): void {
  logRace(state, timeMs, 'Human ordinary XP bonus is 5%.')
}

export const humanRace: ClassModule = {
  encounterStart,
}
