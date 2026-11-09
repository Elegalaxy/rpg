import { describe, expect, it } from 'vitest'

import { EXPEDITION_IDS } from '../sim/expedition.ts'

import { encounters } from './encounters.ts'
import { enemies } from './enemies.ts'
import {
  FRACTURE_GATE_NODE,
  GREYHAVEN_ID,
  LEG_TRAVEL_MS,
  bossRevealed,
  gateBlock,
  legs,
  nodes,
  routeEncounterIds,
  routes,
} from './world.ts'

describe('Fractured Frontier content', () => {
  it('has the eight decided nodes and no others', () => {
    expect(Object.keys(nodes).sort()).toEqual(['cinder-scar', 'drowned-causeway', 'fallen-bastion', 'fracture-gate', 'greyhaven', 'rift-hollows', 'splintered-road', 'withered-grove'])
    for (const [id, node] of Object.entries(nodes)) expect(node.id).toBe(id)
    expect(nodes[GREYHAVEN_ID]?.kind).toBe('town')
    expect(nodes[FRACTURE_GATE_NODE]?.kind).toBe('fracture')
    expect(new Set(Object.values(nodes).map((node) => node.discoveryId)).size).toBe(8)
  })

  it('resolves every reference: legs, routes, encounters, enemies, and materials', () => {
    for (const leg of legs) {
      expect(nodes[leg.from], leg.from).toBeDefined()
      expect(nodes[leg.to], leg.to).toBeDefined()
      expect(leg.travelMs).toBe(LEG_TRAVEL_MS)
    }
    for (const node of Object.values(nodes)) {
      for (const id of [...node.encounterIds, ...(node.drawEncounterIds ?? [])]) {
        const encounter = encounters[id]
        expect(encounter, `${node.id} encounter ${id}`).toBeDefined()
        for (const member of encounter?.members ?? []) expect(enemies[member.enemyId], member.enemyId).toBeDefined()
      }
      if (node.levels !== undefined) expect(node.levels.min).toBeLessThanOrEqual(node.levels.max)
    }
    const dropped = new Set(Object.values(enemies).flatMap((enemy) => (enemy.drop === undefined ? [] : [enemy.drop.materialId])))
    for (const node of Object.values(nodes)) {
      if (node.resource === undefined) continue
      expect(dropped.has(node.resource.materialId), node.resource.id).toBe(true)
      expect(node.resource.quantity).toBe(['drowned-causeway', 'rift-hollows', 'cinder-scar'].includes(node.id) ? 3 : 4)
    }
    expect(Object.values(nodes).filter((node) => node.resource !== undefined)).toHaveLength(6)
  })

  it('walks each route over real legs, and matches the expedition ids', () => {
    expect(Object.keys(routes).sort()).toEqual([...EXPEDITION_IDS].sort())
    for (const route of Object.values(routes)) {
      expect(route.nodeIds[0]).toBe(GREYHAVEN_ID)
      for (let index = 1; index < route.nodeIds.length; index += 1) {
        const from = route.nodeIds[index - 1]
        const to = route.nodeIds[index]
        expect(legs.some((leg) => leg.from === from && leg.to === to), `${route.id}: ${from} to ${to}`).toBe(true)
      }
      expect(routeEncounterIds(route).length).toBeGreaterThan(0)
    }
  })

  it('ends each branch in its elite and gates the Fracture Gate on both', () => {
    const grove = nodes['withered-grove']
    const bastion = nodes['fallen-bastion']
    expect(grove?.eliteEnemyId).toBe('rootmaw-stalker')
    expect(bastion?.eliteEnemyId).toBe('echo-knight')
    for (const id of [grove?.eliteEnemyId, bastion?.eliteEnemyId]) {
      expect(enemies[id ?? '']?.elite, id).toBe(true)
    }
    expect(grove?.encounterIds.at(-1)).toBe('rootmaw-stalker')
    expect(bastion?.encounterIds.at(-1)).toBe('echo-knight')
    const gate = nodes[FRACTURE_GATE_NODE]
    expect(gate?.gate?.defeatedEnemyIds).toEqual(['rootmaw-stalker', 'echo-knight'])
    expect(gate?.encounterIds).toEqual(['fractured-warden'])
    expect(enemies['fractured-warden']?.boss).toBe(true)
  })

  it('opens the Gate only after both elites, per hero, and shows the boss on arrival', () => {
    const gate = nodes[FRACTURE_GATE_NODE]
    if (gate === undefined) throw new Error('no gate')
    expect(gateBlock(gate, { defeatedEnemyIds: [] })).toBe('Defeat Rootmaw Stalker and Echo Knight first.')
    expect(gateBlock(gate, { defeatedEnemyIds: ['rootmaw-stalker'] })).toBe('Defeat Echo Knight first.')
    expect(gateBlock(gate, { defeatedEnemyIds: ['echo-knight'] })).toBe('Defeat Rootmaw Stalker first.')
    expect(gateBlock(gate, { defeatedEnemyIds: ['echo-knight', 'rootmaw-stalker'] })).toBeNull()
    expect(gateBlock(nodes['splintered-road']!, { defeatedEnemyIds: [] })).toBeNull()
    expect(bossRevealed(gate, false)).toBe(false)
    expect(bossRevealed(gate, true)).toBe(true)
    expect(bossRevealed(nodes['withered-grove']!, true)).toBe(false)
  })
})

describe('Drowned Causeway', () => {
  it('is a gated zone reached by a leg from the Splintered Road, ending in the Colossus', () => {
    const node = nodes['drowned-causeway']
    if (node === undefined) throw new Error('no causeway')
    expect(node).toMatchObject({
      name: 'Drowned Causeway',
      kind: 'zone',
      levels: { min: 17, max: 22 },
      encounterIds: ['leech-swarm', 'raider', 'causeway-mixed', 'tidebound-colossus'],
      drawEncounterIds: ['causeway-mixed', 'causeway-deep', 'leech-swarm'],
      eliteEnemyId: 'tidebound-colossus',
      resource: { id: 'riftglass-shoal', name: 'Riftglass Shoal', materialId: 'riftglass', quantity: 3 },
    })
    expect(node.gate?.defeatedEnemyIds).toEqual(['rootmaw-stalker', 'echo-knight'])
    expect(legs.some((leg) => leg.from === 'splintered-road' && leg.to === 'drowned-causeway' && leg.travelMs === LEG_TRAVEL_MS)).toBe(true)
    expect(routes['sunken-causeway']?.nodeIds).toEqual(['greyhaven', 'splintered-road', 'drowned-causeway'])
    expect(routeEncounterIds(routes['sunken-causeway']!)).toEqual([
      'shardling-pair',
      'wolf-pair',
      'deserter',
      'leech-swarm',
      'raider',
      'causeway-mixed',
      'tidebound-colossus',
    ])
  })

  it('names enemies, not ids, in the gate message', () => {
    const node = nodes['drowned-causeway']!
    expect(gateBlock(node, { defeatedEnemyIds: [] })).toBe('Defeat Rootmaw Stalker and Echo Knight first.')
    expect(gateBlock(node, { defeatedEnemyIds: ['echo-knight'] })).toBe('Defeat Rootmaw Stalker first.')
    expect(gateBlock(node, { defeatedEnemyIds: ['echo-knight', 'rootmaw-stalker'] })).toBeNull()
  })
})

describe('Rift Hollows', () => {
  it('is a gated zone reached by a leg from the Splintered Road, ending in the Reaver', () => {
    const node = nodes['rift-hollows']
    if (node === undefined) throw new Error('no hollows')
    expect(node).toMatchObject({
      name: 'Rift Hollows',
      kind: 'zone',
      levels: { min: 22, max: 28 },
      encounterIds: ['shade-pair', 'brute', 'hollows-mixed', 'hollowmaw-reaver'],
      drawEncounterIds: ['hollows-mixed', 'hollows-deep', 'shade-pair'],
      eliteEnemyId: 'hollowmaw-reaver',
      resource: { id: 'dusk-vein', name: 'Dusk Vein', materialId: 'duskiron', quantity: 3 },
      discoveryId: 'node:rift-hollows',
    })
    expect(node.gate?.defeatedEnemyIds).toEqual(['tidebound-colossus'])
    expect(legs.some((leg) => leg.from === 'splintered-road' && leg.to === 'rift-hollows' && leg.travelMs === LEG_TRAVEL_MS)).toBe(true)
    expect(legs.some((leg) => leg.to === 'rift-hollows' && leg.from === 'drowned-causeway')).toBe(false)
    expect(routes['rift-hollows']?.nodeIds).toEqual(['greyhaven', 'splintered-road', 'rift-hollows'])
    expect(routeEncounterIds(routes['rift-hollows']!)).toEqual([
      'shardling-pair',
      'wolf-pair',
      'deserter',
      'shade-pair',
      'brute',
      'hollows-mixed',
      'hollowmaw-reaver',
    ])
  })

  it('names the Colossus, not its id, in the gate message', () => {
    const node = nodes['rift-hollows']!
    expect(gateBlock(node, { defeatedEnemyIds: [] })).toBe('Defeat Tidebound Colossus first.')
    expect(gateBlock(node, { defeatedEnemyIds: ['rootmaw-stalker', 'echo-knight'] })).toBe('Defeat Tidebound Colossus first.')
    expect(gateBlock(node, { defeatedEnemyIds: ['tidebound-colossus'] })).toBeNull()
  })
})

describe('Cinder Scar', () => {
  it('is a gated zone reached by a leg from the Splintered Road, ending in the Tyrant', () => {
    const node = nodes['cinder-scar']
    if (node === undefined) throw new Error('no cinder scar')
    expect(node).toMatchObject({
      name: 'Cinder Scar',
      kind: 'zone',
      levels: { min: 28, max: 34 },
      encounterIds: ['imp-swarm', 'golem', 'cinder-mixed', 'emberwrought-tyrant'],
      drawEncounterIds: ['cinder-mixed', 'cinder-deep', 'imp-swarm'],
      eliteEnemyId: 'emberwrought-tyrant',
      resource: { id: 'ember-seam', name: 'Ember Seam', materialId: 'cinderite', quantity: 3 },
      discoveryId: 'node:cinder-scar',
    })
    expect(node.gate?.defeatedEnemyIds).toEqual(['hollowmaw-reaver'])
    expect(legs.some((leg) => leg.from === 'splintered-road' && leg.to === 'cinder-scar' && leg.travelMs === LEG_TRAVEL_MS)).toBe(true)
    expect(legs.some((leg) => leg.to === 'cinder-scar' && leg.from !== 'splintered-road')).toBe(false)
    expect(routes['cinder-scar']?.nodeIds).toEqual(['greyhaven', 'splintered-road', 'cinder-scar'])
    expect(routeEncounterIds(routes['cinder-scar']!)).toEqual([
      'shardling-pair',
      'wolf-pair',
      'deserter',
      'imp-swarm',
      'golem',
      'cinder-mixed',
      'emberwrought-tyrant',
    ])
  })

  it('names the Reaver, not its id, in the gate message', () => {
    const node = nodes['cinder-scar']!
    expect(gateBlock(node, { defeatedEnemyIds: [] })).toBe('Defeat Hollowmaw Reaver first.')
    expect(gateBlock(node, { defeatedEnemyIds: ['tidebound-colossus'] })).toBe('Defeat Hollowmaw Reaver first.')
    expect(gateBlock(node, { defeatedEnemyIds: ['hollowmaw-reaver'] })).toBeNull()
  })
})
