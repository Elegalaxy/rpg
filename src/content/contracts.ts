import { encounters } from './encounters.ts'
import { enemies } from './enemies.ts'
import { nodes, type WorldNode } from './world.ts'

/**
 * Greyhaven's contract board (G7). A contract asks for a number of units, which are enemies defeated
 * or fights won, and pays about 60% of what those units are normally worth.
 */

export type ContractTarget =
  /** Defeat this enemy type. Each one in a won fight counts. */
  | { kind: 'kill'; enemyId: string }
  /** Win a fixed fight at this node. Each won fight counts. */
  | { kind: 'fights'; nodeId: string }
  /** Win one of these encounters. Each won fight counts. */
  | { kind: 'encounters'; encounterIds: readonly string[] }

export type ContractReward = {
  xp: number
  gold: number
  materialId: string
  materialQuantity: number
}

export type ContractDef = {
  id: string
  name: string
  description: string
  target: ContractTarget
  /** How many units finish the contract. */
  count: number
  /** The zone's enemy level, which scales the reward. */
  level: number
  reward: ContractReward
}

/** Half up. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

/**
 * The G7 reward: XP `round(0.6 × units × (5 + 2L))`, gold `units × L`, and `ceil(units ÷ 2)` of the
 * zone's material.
 */
export function rewardFor(units: number, level: number, materialId: string): ContractReward {
  return {
    xp: roundHalfUp(0.6 * units * (5 + 2 * level)),
    gold: units * level,
    materialId,
    materialQuantity: Math.ceil(units / 2),
  }
}

function contract(
  id: string,
  name: string,
  description: string,
  target: ContractTarget,
  count: number,
  level: number,
  materialId: string,
): ContractDef {
  return { id, name, description, target, count, level, reward: rewardFor(count, level, materialId) }
}

export const contractList: readonly ContractDef[] = [
  contract('cull-the-pack', 'Cull the Pack', 'Defeat 6 Starved Wolves on the Splintered Road.', { kind: 'kill', enemyId: 'starved-wolf' }, 6, 6, 'hide'),
  contract('clear-the-shards', 'Clear the Shards', 'Defeat 8 Fracture Shardlings.', { kind: 'kill', enemyId: 'fracture-shardling' }, 8, 3, 'shard'),
  contract('hunt-deserters', 'Hunt Deserters', 'Defeat 3 Deserters.', { kind: 'kill', enemyId: 'deserter' }, 3, 6, 'scrap'),
  contract('thicket-sweep', 'Thicket Sweep', 'Win 4 fights in the Withered Grove.', { kind: 'fights', nodeId: 'withered-grove' }, 4, 10, 'hide'),
  contract('bastion-patrol', 'Bastion Patrol', 'Win 4 fights in the Fallen Bastion.', { kind: 'fights', nodeId: 'fallen-bastion' }, 4, 12, 'shard'),
  contract(
    'break-the-elite',
    'Break the Elite',
    'Defeat the Rootmaw Stalker or the Echo Knight once.',
    { kind: 'encounters', encounterIds: ['rootmaw-stalker', 'echo-knight'] },
    1,
    14,
    'scrap',
  ),
]

export const contracts: { readonly [id: string]: ContractDef } = Object.fromEntries(contractList.map((entry) => [entry.id, entry]))

/** The most contracts a player can have active at once. */
export const MAX_ACTIVE_CONTRACTS = 3

// Rolled board, decided 2026-11-04 (GAME_DESIGN, contract board).

/** Offers on one hero's board. */
export const BOARD_SIZE = 4
export const BOUNTY_COUNT = { min: 3, max: 8 } as const
export const PATROL_COUNT = { min: 3, max: 6 } as const
/** Shardlings come in pairs, so a Shardling bounty asks for twice as many. */
const PAIRED_ENEMIES = ['fracture-shardling']
export const REWARD_ROLL = { min: 0.8, max: 1.3 } as const
export const ELITE_CHANCE = 1 / 8
export const PATROL_CHANCE = 1 / 4

type Pick = { kind: 'bounty' | 'patrol' | 'elite'; key: string; level: number; materialId: string; zoneName: string; target: ContractTarget; name: string; noun: string }

function plural(name: string): string {
  if (name.endsWith('f')) return `${name.slice(0, -1)}ves`
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`
  return `${name}s`
}

function discoveredZones(discoveries: readonly string[]): WorldNode[] {
  return Object.values(nodes).filter((node) => node.kind === 'zone' && discoveries.includes(node.discoveryId))
}

/** Regular (non-elite) members of a zone's fights, with the level of their first appearance in the fixed fights. */
function zoneMonsters(node: WorldNode): { enemyId: string; level: number }[] {
  const found: { enemyId: string; level: number }[] = []
  for (const id of [...node.encounterIds, ...(node.drawEncounterIds ?? [])]) {
    for (const member of encounters[id]?.members ?? []) {
      if (enemies[member.enemyId]?.elite === true || enemies[member.enemyId]?.boss === true) continue
      if (!found.some((entry) => entry.enemyId === member.enemyId)) found.push({ enemyId: member.enemyId, level: member.level })
    }
  }
  return found
}

/** Everything a board could offer for these discoveries, by kind. */
export function boardPool(discoveries: readonly string[]): { bounty: Pick[]; patrol: Pick[]; elite: Pick[] } {
  const bounty: Pick[] = []
  const patrol: Pick[] = []
  const elite: Pick[] = []
  for (const node of discoveredZones(discoveries)) {
    const material = node.resource?.materialId ?? 'scrap'
    const monsters = zoneMonsters(node)
    for (const monster of monsters) {
      const def = enemies[monster.enemyId]
      if (def === undefined || bounty.some((entry) => entry.key === `kill:${monster.enemyId}`)) continue
      bounty.push({
        kind: 'bounty',
        key: `kill:${monster.enemyId}`,
        level: monster.level,
        materialId: def.drop?.materialId ?? material,
        zoneName: node.name,
        target: { kind: 'kill', enemyId: monster.enemyId },
        name: `Bounty: ${plural(def.name)}`,
        noun: plural(def.name),
      })
    }
    if (monsters.length > 0) {
      patrol.push({
        kind: 'patrol',
        key: `fights:${node.id}`,
        level: Math.max(...monsters.map((monster) => monster.level)),
        materialId: material,
        zoneName: node.name,
        target: { kind: 'fights', nodeId: node.id },
        name: `Patrol: ${node.name}`,
        noun: 'fights',
      })
    }
    const eliteId = node.eliteEnemyId
    const eliteDef = eliteId === undefined ? undefined : enemies[eliteId]
    const eliteFight = node.encounterIds.find((id) => encounters[id]?.members.some((member) => member.enemyId === eliteId))
    const eliteLevel = eliteFight === undefined ? undefined : encounters[eliteFight]?.members.find((member) => member.enemyId === eliteId)?.level
    if (eliteDef !== undefined && eliteFight !== undefined && eliteLevel !== undefined) {
      elite.push({
        kind: 'elite',
        key: `encounter:${eliteFight}`,
        level: eliteLevel,
        materialId: material,
        zoneName: node.name,
        target: { kind: 'encounters', encounterIds: [eliteFight] },
        name: `Break the ${eliteDef.name}`,
        noun: eliteDef.name,
      })
    }
  }
  return { bounty, patrol, elite }
}

function between(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1))
}

/** A contract's target, as text, so a board can avoid two offers with the same target. */
export function targetKey(target: ContractTarget): string {
  if (target.kind === 'kill') return `kill:${target.enemyId}`
  if (target.kind === 'fights') return `fights:${target.nodeId}`
  return `encounter:${target.encounterIds.join('+')}`
}

/**
 * Roll one offer. `next` gives floats in [0, 1). An offer whose target is already in `avoid` is
 * rolled again, up to a few times. Null when nothing is discovered.
 */
export function rollContract(id: string, discoveries: readonly string[], next: () => number, avoid: readonly string[] = []): ContractDef | null {
  const pool = boardPool(discoveries)
  if (pool.bounty.length + pool.patrol.length + pool.elite.length === 0) return null
  let pick: Pick | undefined
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const kindRoll = next()
    const list = pool.elite.length > 0 && kindRoll < ELITE_CHANCE ? pool.elite : pool.patrol.length > 0 && kindRoll < ELITE_CHANCE + PATROL_CHANCE ? pool.patrol : pool.bounty
    const candidates = list.length > 0 ? list : pool.bounty.length > 0 ? pool.bounty : pool.patrol
    pick = candidates[Math.floor(next() * candidates.length)]
    if (pick !== undefined && !avoid.includes(pick.key)) break
  }
  if (pick === undefined) return null
  let count = 1
  if (pick.kind === 'bounty') {
    count = between(next, BOUNTY_COUNT.min, BOUNTY_COUNT.max)
    if (pick.target.kind === 'kill' && PAIRED_ENEMIES.includes(pick.target.enemyId)) count *= 2
  } else if (pick.kind === 'patrol') {
    count = between(next, PATROL_COUNT.min, PATROL_COUNT.max)
  }
  const factor = REWARD_ROLL.min + next() * (REWARD_ROLL.max - REWARD_ROLL.min)
  const base = rewardFor(count, pick.level, pick.materialId)
  const reward: ContractReward = {
    xp: roundHalfUp(base.xp * factor),
    gold: roundHalfUp(base.gold * factor),
    materialId: base.materialId,
    materialQuantity: Math.max(1, roundHalfUp(base.materialQuantity * factor)),
  }
  const description =
    pick.kind === 'bounty'
      ? `Defeat ${count} ${pick.noun} (${pick.zoneName}).`
      : pick.kind === 'patrol'
        ? `Win ${count} fights ${pick.zoneName.endsWith('Road') ? 'on' : 'in'} the ${pick.zoneName}.`
        : `Defeat the ${pick.noun} once.`
  return { id, name: pick.name, description, target: pick.target, count, level: pick.level, reward }
}
