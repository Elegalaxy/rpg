/**
 * The Fractured Frontier, decided in G7. Nodes are places, legs are the walks between them, and a
 * route is a path out from Greyhaven that an expedition follows. Node discovery is shared across the
 * account. The gate on the Fracture Gate is personal, because it reads what this hero has defeated.
 */

export type NodeKind = 'town' | 'zone' | 'fracture'

export type ResourceNode = {
  id: string
  name: string
  materialId: string
  /** What one visit gives. */
  quantity: number
}

export type NodeGate = {
  /** The hero must have defeated each of these enemies at least once. Personal to the hero. */
  defeatedEnemyIds: readonly string[]
}

export type WorldNode = {
  id: string
  name: string
  kind: NodeKind
  /** Recommended hero level range. Towns have none. */
  levels?: { min: number; max: number }
  /** Fights in order, each followed by the next leg's walk. Ids come from `encounters.ts`. */
  encounterIds: readonly string[]
  /** Where fights past the fixed list come from. Omitted repeats the fixed list. */
  drawEncounterIds?: readonly string[]
  resource?: ResourceNode
  /** The elite that ends a branch. Defeating it counts toward the Fracture Gate. */
  eliteEnemyId?: string
  gate?: NodeGate
  /** When the boss here becomes known to the hero. Only the Fracture Gate has one. */
  bossRevealedOn?: 'arrival'
  /** Account-wide discovery flag set the first time any hero arrives. */
  discoveryId: string
}

export type Leg = {
  from: string
  to: string
  travelMs: number
}

export type Route = {
  id: string
  name: string
  /** Nodes in order, starting at Greyhaven. */
  nodeIds: readonly string[]
}

/** Every leg is the road's ordinary 20 seconds. A return walk is the same. */
export const LEG_TRAVEL_MS = 20_000

export const GREYHAVEN_ID = 'greyhaven'
export const SPLINTERED_ROAD_NODE = 'splintered-road'
export const WITHERED_GROVE_NODE = 'withered-grove'
export const FALLEN_BASTION_NODE = 'fallen-bastion'
export const FRACTURE_GATE_NODE = 'fracture-gate'

export const nodes: { readonly [id: string]: WorldNode } = {
  [GREYHAVEN_ID]: {
    id: GREYHAVEN_ID,
    name: 'Greyhaven',
    kind: 'town',
    encounterIds: [],
    discoveryId: 'node:greyhaven',
  },
  [SPLINTERED_ROAD_NODE]: {
    id: SPLINTERED_ROAD_NODE,
    name: 'Splintered Road',
    kind: 'zone',
    levels: { min: 1, max: 6 },
    encounterIds: ['shardling-pair', 'wolf-pair', 'deserter'],
    drawEncounterIds: ['shardling-pair', 'wolf-pair', 'deserter', 'road-mixed'],
    resource: { id: 'scrap-heap', name: 'Scrap Heap', materialId: 'scrap', quantity: 4 },
    discoveryId: 'node:splintered-road',
  },
  [WITHERED_GROVE_NODE]: {
    id: WITHERED_GROVE_NODE,
    name: 'Withered Grove',
    kind: 'zone',
    levels: { min: 8, max: 14 },
    encounterIds: ['grove-mixed', 'rootmaw-stalker'],
    drawEncounterIds: ['grove-mixed'],
    resource: { id: 'hollow-thicket', name: 'Hollow Thicket', materialId: 'hide', quantity: 4 },
    eliteEnemyId: 'rootmaw-stalker',
    discoveryId: 'node:withered-grove',
  },
  [FALLEN_BASTION_NODE]: {
    id: FALLEN_BASTION_NODE,
    name: 'Fallen Bastion',
    kind: 'zone',
    levels: { min: 10, max: 16 },
    encounterIds: ['bastion-mixed', 'echo-knight'],
    drawEncounterIds: ['bastion-mixed'],
    resource: { id: 'shard-seam', name: 'Shard Seam', materialId: 'shard', quantity: 4 },
    eliteEnemyId: 'echo-knight',
    discoveryId: 'node:fallen-bastion',
  },
  [FRACTURE_GATE_NODE]: {
    id: FRACTURE_GATE_NODE,
    name: 'Fracture Gate',
    kind: 'fracture',
    levels: { min: 18, max: 20 },
    encounterIds: ['fractured-warden'],
    gate: { defeatedEnemyIds: ['rootmaw-stalker', 'echo-knight'] },
    bossRevealedOn: 'arrival',
    discoveryId: 'node:fracture-gate',
  },
}

export const legs: readonly Leg[] = [
  { from: GREYHAVEN_ID, to: SPLINTERED_ROAD_NODE, travelMs: LEG_TRAVEL_MS },
  { from: SPLINTERED_ROAD_NODE, to: WITHERED_GROVE_NODE, travelMs: LEG_TRAVEL_MS },
  { from: SPLINTERED_ROAD_NODE, to: FALLEN_BASTION_NODE, travelMs: LEG_TRAVEL_MS },
  { from: WITHERED_GROVE_NODE, to: FRACTURE_GATE_NODE, travelMs: LEG_TRAVEL_MS },
  { from: FALLEN_BASTION_NODE, to: FRACTURE_GATE_NODE, travelMs: LEG_TRAVEL_MS },
]

/** Route ids match the expedition ids the simulation accepts. */
export const routes: { readonly [id: string]: Route } = {
  'splintered-road': {
    id: 'splintered-road',
    name: 'Splintered Road',
    nodeIds: [GREYHAVEN_ID, SPLINTERED_ROAD_NODE],
  },
  'withered-grove': {
    id: 'withered-grove',
    name: 'Road to the Withered Grove',
    nodeIds: [GREYHAVEN_ID, SPLINTERED_ROAD_NODE, WITHERED_GROVE_NODE],
  },
  'fallen-bastion': {
    id: 'fallen-bastion',
    name: 'Road to the Fallen Bastion',
    nodeIds: [GREYHAVEN_ID, SPLINTERED_ROAD_NODE, FALLEN_BASTION_NODE],
  },
  'fracture-via-grove': {
    id: 'fracture-via-grove',
    name: 'Fracture Gate through the Grove',
    nodeIds: [GREYHAVEN_ID, SPLINTERED_ROAD_NODE, WITHERED_GROVE_NODE, FRACTURE_GATE_NODE],
  },
  'fracture-via-bastion': {
    id: 'fracture-via-bastion',
    name: 'Fracture Gate through the Bastion',
    nodeIds: [GREYHAVEN_ID, SPLINTERED_ROAD_NODE, FALLEN_BASTION_NODE, FRACTURE_GATE_NODE],
  },
}

/** What a hero's record says about the Gate. Personal to the hero. */
export type HeroWorldRecord = {
  defeatedEnemyIds: readonly string[]
}

/** Null when the node is open to this hero. Otherwise what is still needed. */
export function gateBlock(node: WorldNode, record: HeroWorldRecord): string | null {
  if (node.gate === undefined) return null
  const missing = node.gate.defeatedEnemyIds.filter((id) => !record.defeatedEnemyIds.includes(id))
  if (missing.length === 0) return null
  return `Defeat ${missing.join(' and ')} first.`
}

/** The boss at a node is shown to a hero who has arrived there. Nothing else reveals it. */
export function bossRevealed(node: WorldNode, arrived: boolean): boolean {
  return node.bossRevealedOn === 'arrival' && arrived
}

/** Fights along a route, in order: each node's fixed list. */
export function routeEncounterIds(route: Route): string[] {
  const ids: string[] = []
  for (const nodeId of route.nodeIds) {
    const node = nodes[nodeId]
    if (node !== undefined) ids.push(...node.encounterIds)
  }
  return ids
}
