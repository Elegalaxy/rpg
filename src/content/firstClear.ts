import { rewardFor } from './contracts.ts'
import { nodes } from './world.ts'

/**
 * First-clear rewards (GAME_DESIGN Â§9, Step 13.24). The first time a hero clears a zone node and gets home
 * safely: gold and the zone's material at the contract rate for 30 units (without its XP), and one free upgrade.
 */
export const FIRST_CLEAR_UNITS = 30
export const FIRST_CLEAR_TOKENS = 1

export type FirstClearReward = {
  nodeId: string
  name: string
  gold: number
  /** Null for a node with no resource (the Fracture Gate): gold only. */
  materialId: string | null
  quantity: number
  tokens: number
}

/** The reward for clearing a node for the first time, or null for the town and unknown ids. */
export function firstClearReward(nodeId: string): FirstClearReward | null {
  const node = nodes[nodeId]
  if (node === undefined || node.levels === undefined || node.kind === 'town') return null
  const resource = node.resource
  if (resource === undefined) {
    const base = rewardFor(FIRST_CLEAR_UNITS, node.levels.max, '')
    return { nodeId, name: node.name, gold: base.gold, materialId: null, quantity: 0, tokens: FIRST_CLEAR_TOKENS }
  }
  const base = rewardFor(FIRST_CLEAR_UNITS, node.levels.max, resource.materialId)
  return { nodeId, name: node.name, gold: base.gold, materialId: resource.materialId, quantity: base.materialQuantity, tokens: FIRST_CLEAR_TOKENS }
}

/** Every node with a first-clear reward, in `nodes` order. */
export const FIRST_CLEAR_NODE_IDS: readonly string[] = Object.keys(nodes).filter((id) => firstClearReward(id) !== null)

/** The reward as plain text for a pill or a fact, without the node name: `660 g · 15 riftglass · 1 free upgrade`. */
export function firstClearRewardText(reward: FirstClearReward): string {
  const parts = [`${reward.gold} g`]
  if (reward.materialId !== null) parts.push(`${reward.quantity} ${reward.materialId}`)
  parts.push(`${reward.tokens} free ${reward.tokens === 1 ? 'upgrade' : 'upgrades'}`)
  return parts.join(' · ')
}
