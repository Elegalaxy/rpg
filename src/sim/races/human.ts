import { xpFromEnemies, type XpMember } from '../progression.ts'
import type { ClassModule, CombatState } from '../types.ts'
import { HUMAN_QUICK_STUDY_MULTIPLIER, NODE_HUMAN_QUICK_STUDY, hasRacialNode } from './racialNodes.ts'
import { logRace } from './events.ts'

/** Ordinary XP and, later, ordinary mastery. Milestones stay on the unscaled helper. */
export const HUMAN_ORDINARY_XP_MULTIPLIER = 1.05

/** Quick Study raises the bonus from +5% to +8%. Other nodes leave it alone. */
export function humanOrdinaryXp(
  heroLevel: number,
  spirit: number,
  members: readonly XpMember[],
  nodeIds?: readonly string[],
  extra = 1,
): number {
  const multiplier = hasRacialNode(nodeIds, NODE_HUMAN_QUICK_STUDY)
    ? HUMAN_QUICK_STUDY_MULTIPLIER
    : HUMAN_ORDINARY_XP_MULTIPLIER
  return xpFromEnemies(heroLevel, spirit, members, multiplier * extra)
}

function encounterStart(state: CombatState, timeMs: number): void {
  logRace(state, timeMs, 'Human ordinary XP bonus is 5%.')
}

export const humanRace: ClassModule = {
  encounterStart,
}
