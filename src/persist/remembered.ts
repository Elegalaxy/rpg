import { gateBlock, type HeroWorldRecord, type WorldNode } from '../content/world.ts'

/** The elites whose first defeat opens a zone (Step 13.18). The Warden is not one of them. */
export const ELITE_ENEMY_IDS: readonly string[] = [
  'rootmaw-stalker',
  'echo-knight',
  'tidebound-colossus',
  'hollowmaw-reaver',
  'emberwrought-tyrant',
  'briar-matriarch',
]

const ELITE_BONUS_PREFIX = 'elite:'

/** The elite ids an earlier life's `claimedBonuses` record, for a save from before `rememberedEnemyIds`. */
export function elitesFromClaimed(claimedBonuses: readonly string[]): string[] {
  return claimedBonuses
    .filter((id) => id.startsWith(ELITE_BONUS_PREFIX))
    .map((id) => id.slice(ELITE_BONUS_PREFIX.length))
    .filter((id) => ELITE_ENEMY_IDS.includes(id))
}

/** `remembered` plus the elites in `defeated`, without repeats. */
export function unionElites(remembered: readonly string[] | undefined, defeated: readonly string[]): string[] {
  const result = [...(remembered ?? [])]
  for (const id of defeated) if (ELITE_ENEMY_IDS.includes(id) && !result.includes(id)) result.push(id)
  return result
}

type Memory = { defeatedEnemyIds: string[]; rememberedEnemyIds?: string[] }

/**
 * What a zone gate reads for this hero: this life's defeats plus the elites of earlier lives. Only a
 * zone gate uses it. The Fracture Gate reads this life's defeats alone.
 */
export function zoneGateRecord(hero: Memory | null): HeroWorldRecord {
  const defeated = hero?.defeatedEnemyIds ?? []
  const remembered = hero?.rememberedEnemyIds ?? []
  return { defeatedEnemyIds: [...defeated, ...remembered.filter((id) => !defeated.includes(id))] }
}

/** Whether a zone is open only because of an earlier life. */
export function openByMemory(node: WorldNode, hero: Memory | null): boolean {
  if (node.kind !== 'zone' || node.gate === undefined || hero === null) return false
  return gateBlock(node, { defeatedEnemyIds: hero.defeatedEnemyIds }) !== null && gateBlock(node, zoneGateRecord(hero)) === null
}
