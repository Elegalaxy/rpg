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
  it('has the five decided nodes and no others', () => {
    expect(Object.keys(nodes).sort()).toEqual(['fallen-bastion', 'fracture-gate', 'greyhaven', 'splintered-road', 'withered-grove'])
    for (const [id, node] of Object.entries(nodes)) expect(node.id).toBe(id)
    expect(nodes[GREYHAVEN_ID]?.kind).toBe('town')
    expect(nodes[FRACTURE_GATE_NODE]?.kind).toBe('fracture')
    expect(new Set(Object.values(nodes).map((node) => node.discoveryId)).size).toBe(5)
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
      expect(node.resource.quantity).toBe(4)
    }
    expect(Object.values(nodes).filter((node) => node.resource !== undefined)).toHaveLength(3)
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
    expect(gateBlock(gate, { defeatedEnemyIds: [] })).toBe('Defeat rootmaw-stalker and echo-knight first.')
    expect(gateBlock(gate, { defeatedEnemyIds: ['rootmaw-stalker'] })).toBe('Defeat echo-knight first.')
    expect(gateBlock(gate, { defeatedEnemyIds: ['echo-knight'] })).toBe('Defeat rootmaw-stalker first.')
    expect(gateBlock(gate, { defeatedEnemyIds: ['echo-knight', 'rootmaw-stalker'] })).toBeNull()
    expect(gateBlock(nodes['splintered-road']!, { defeatedEnemyIds: [] })).toBeNull()
    expect(bossRevealed(gate, false)).toBe(false)
    expect(bossRevealed(gate, true)).toBe(true)
    expect(bossRevealed(nodes['withered-grove']!, true)).toBe(false)
  })
})
