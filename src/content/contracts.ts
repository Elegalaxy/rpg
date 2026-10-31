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
