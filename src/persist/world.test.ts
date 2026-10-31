import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { nodes, routes } from '../content/world.ts'
import { stepExpedition, type ExpeditionState } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, type SaveData } from './save.ts'
import {
  canStartRoute,
  fightNodeIds,
  markerPosition,
  nodeStatus,
  recordProgress,
  routeInfo,
  settleExpedition,
} from './world.ts'

function withHero(): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

function withRun(routeId: string, seed = 1): SaveData {
  const save = withHero()
  const hero = selectedHero(save)
  if (hero === null) throw new Error('no hero')
  return { ...save, expedition: startExpedition(hero, routeId, seed) }
}

function node(id: string) {
  const found = nodes[id]
  if (found === undefined) throw new Error(`no node ${id}`)
  return found
}

function victoryFor(expedition: ExpeditionState, count: number): void {
  const route = routes[expedition.id]
  if (route === undefined) throw new Error('no route')
  const opening = expedition.opening
  expedition.history = opening.slice(0, count).map((encounter, index) => ({
    index,
    encounterId: encounter.id,
    seed: index,
    outcome: 'victory' as const,
    durationMs: 1000,
  }))
}

describe('node states', () => {
  it('starts with the town and the road known and the rest locked', () => {
    const save = withHero()
    const hero = selectedHero(save)
    expect(nodeStatus(node('greyhaven'), save, hero).state).toBe('cleared')
    expect(nodeStatus(node('splintered-road'), save, hero).state).toBe('discovered')
    expect(nodeStatus(node('withered-grove'), save, hero)).toEqual({ state: 'locked', reason: 'Not discovered yet.' })
    expect(nodeStatus(node('fracture-gate'), save, hero).state).toBe('locked')
  })

  it('keeps the Fracture Gate locked for a hero until both elites are defeated', () => {
    let save = withHero()
    save = { ...save, account: { ...save.account, discoveries: [...save.account.discoveries, 'node:fracture-gate'] } }
    expect(nodeStatus(node('fracture-gate'), save, selectedHero(save))).toEqual({
      state: 'locked',
      reason: 'Defeat rootmaw-stalker and echo-knight first.',
    })
    const hero = selectedHero(save)!
    const one = { ...hero, defeatedEnemyIds: ['rootmaw-stalker'] }
    expect(nodeStatus(node('fracture-gate'), save, one).reason).toBe('Defeat echo-knight first.')
    const both = { ...hero, defeatedEnemyIds: ['rootmaw-stalker', 'echo-knight'] }
    expect(nodeStatus(node('fracture-gate'), save, both).state).toBe('discovered')
    const other = createHero(save, { name: 'Cinder', race: 'elf', classId: 'mage' })
    if (!other.ok) throw new Error(other.reason)
    const shared = { ...other.save, heroes: other.save.heroes.map((h) => (h.id === 'hero-1' ? both : h)) }
    expect(nodeStatus(node('fracture-gate'), shared, shared.heroes[1]!).state).toBe('locked')
    expect(nodeStatus(node('withered-grove'), shared, shared.heroes[0]!).state).toBe('locked')
  })

  it('marks a node cleared for the hero who cleared it', () => {
    const save = withHero()
    const hero = { ...selectedHero(save)!, clearedNodeIds: ['splintered-road'] }
    expect(nodeStatus(node('splintered-road'), save, hero).state).toBe('cleared')
    expect(nodeStatus(node('splintered-road'), save, null).state).toBe('discovered')
  })
})

describe('route info', () => {
  it('lists the path, level band, fights, resources, and hides the boss', () => {
    const save = withHero()
    const road = routeInfo('splintered-road', save)
    expect(road.nodeNames).toEqual(['Greyhaven', 'Splintered Road'])
    expect(road.levels).toEqual({ min: 1, max: 6 })
    expect(road.fights).toBe(3)
    expect(road.travelSeconds).toBe(20)
    expect(road.resources).toEqual([{ name: 'Scrap Heap', materialId: 'scrap', quantity: 4 }])
    expect(road.enemyNames).toEqual(expect.arrayContaining(['Fracture Shardling', 'Starved Wolf', 'Deserter']))
    expect(road.bossHidden).toBe(false)
    const gate = routeInfo('fracture-via-grove', save)
    expect(gate.travelSeconds).toBe(60)
    expect(gate.bossHidden).toBe(true)
    expect(gate.enemyNames).not.toContain('Fractured Warden')
    expect(gate.resources.map((resource) => resource.materialId)).toEqual(['scrap', 'hide'])
    expect(gate.levels).toEqual({ min: 1, max: 20 })
    const arrived = { ...save, account: { ...save.account, discoveries: [...save.account.discoveries, 'node:fracture-gate'] } }
    const shown = routeInfo('fracture-via-bastion', arrived)
    expect(shown.bossHidden).toBe(false)
    expect(shown.enemyNames.join(' ')).toMatch(/Warden/)
    expect(() => routeInfo('nowhere', save)).toThrow(/unknown route/)
  })
})

describe('starting a route', () => {
  it('needs a hero, an idle expedition, and every node open to the hero', () => {
    expect(canStartRoute(newSave(), 'splintered-road')).toEqual({ ok: false, reason: 'Select a hero first.' })
    const save = withHero()
    expect(canStartRoute(save, 'splintered-road')).toEqual({ ok: true })
    expect(canStartRoute(save, 'withered-grove')).toEqual({ ok: false, reason: 'Withered Grove: Not discovered yet.' })
    expect(canStartRoute(save, 'nowhere')).toEqual({ ok: false, reason: 'Unknown route.' })
    expect(canStartRoute(withRun('splintered-road'), 'splintered-road')).toEqual({
      ok: false,
      reason: 'An expedition is already running.',
    })
    const known = {
      ...save,
      account: { ...save.account, discoveries: [...save.account.discoveries, 'node:withered-grove', 'node:fallen-bastion', 'node:fracture-gate'] },
    }
    expect(canStartRoute(known, 'withered-grove')).toEqual({ ok: true })
    expect(canStartRoute(known, 'fracture-via-grove')).toEqual({
      ok: false,
      reason: 'Fracture Gate: Defeat rootmaw-stalker and echo-knight first.',
    })
  })
})

describe('hero marker', () => {
  it('follows the expedition state: walking out, fighting, and walking back', () => {
    const save = withRun('fracture-via-grove')
    const defs = gameDefs()
    const expedition = save.expedition!
    expect(markerPosition(expedition)).toEqual({ kind: 'between', fromId: 'greyhaven', toId: 'splintered-road', fraction: 0 })
    for (let step = 0; step < 1000; step += 1) stepExpedition(expedition, defs)
    const moving = markerPosition(expedition)
    expect(moving.kind).toBe('between')
    if (moving.kind === 'between') {
      expect(moving.fraction).toBeGreaterThan(0.4)
      expect(moving.fraction).toBeLessThan(0.6)
    }
    let guard = 0
    while (expedition.phase !== 'combat' && guard < 5000) {
      stepExpedition(expedition, defs)
      guard += 1
    }
    expect(markerPosition(expedition)).toEqual({ kind: 'at', nodeId: 'splintered-road' })
    expedition.phase = 'travel'
    expedition.encounterIndex = 3
    expedition.travelMs = 10_000
    expect(markerPosition(expedition)).toEqual({ kind: 'between', fromId: 'splintered-road', toId: 'withered-grove', fraction: 0.5 })
    expedition.encounterIndex = 1
    expect(markerPosition(expedition)).toEqual({ kind: 'at', nodeId: 'splintered-road' })
    expedition.returning = true
    expedition.travelMs = 5_000
    expect(markerPosition(expedition)).toEqual({ kind: 'between', fromId: 'splintered-road', toId: 'greyhaven', fraction: 0.25 })
    expedition.outcome = 'returned'
    expect(markerPosition(expedition)).toEqual({ kind: 'at', nodeId: 'greyhaven' })
  })

  it('maps each fight to its node, in route order', () => {
    expect(fightNodeIds(routes['fracture-via-bastion']!)).toEqual([
      'splintered-road',
      'splintered-road',
      'splintered-road',
      'fallen-bastion',
      'fallen-bastion',
      'fracture-gate',
    ])
  })
})

describe('recording progress', () => {
  it('discovers the node a hero arrives at, for the whole account', () => {
    const save = withRun('withered-grove')
    const expedition = save.expedition!
    victoryFor(expedition, 3)
    expedition.encounterIndex = 3
    expedition.phase = 'combat'
    expedition.current = { index: 3, encounterId: 'grove-mixed', seed: 3, enemies: [] }
    const next = recordProgress(save)
    expect(next.account.discoveries).toContain('node:withered-grove')
  })

  it('clears a node after all its fights, and opens the nodes beyond it', () => {
    const save = withRun('fracture-via-grove')
    victoryFor(save.expedition!, 3)
    const next = recordProgress(save)
    expect(selectedHero(next)!.clearedNodeIds).toEqual(['splintered-road'])
    expect(next.account.discoveries).toEqual(expect.arrayContaining(['node:withered-grove', 'node:fallen-bastion']))
    expect(next.account.discoveries).not.toContain('node:fracture-gate')
    expect(selectedHero(next)!.defeatedEnemyIds).toEqual([])
    expect(recordProgress(next)).toBe(next)
  })

  it('records an elite defeat for the hero, and the Gate opens after both', () => {
    let save = withRun('fracture-via-grove')
    victoryFor(save.expedition!, 5)
    save = recordProgress(save)
    const hero = selectedHero(save)!
    expect(hero.clearedNodeIds).toEqual(['splintered-road', 'withered-grove'])
    expect(hero.defeatedEnemyIds).toEqual(['rootmaw-stalker'])
    expect(save.account.discoveries).toContain('node:fracture-gate')
    expect(nodeStatus(node('fracture-gate'), save, hero).reason).toBe('Defeat echo-knight first.')
    const bastion = {
      ...save,
      heroes: save.heroes.map((h) => ({ ...h, defeatedEnemyIds: [...h.defeatedEnemyIds, 'echo-knight'] })),
    }
    expect(nodeStatus(node('fracture-gate'), bastion, selectedHero(bastion)).state).toBe('discovered')
  })

  it('does not clear a node when a fight there was lost', () => {
    const save = withRun('splintered-road')
    victoryFor(save.expedition!, 3)
    save.expedition!.history[2]!.outcome = 'defeat'
    expect(selectedHero(recordProgress(save))!.clearedNodeIds).toEqual([])
  })
})

describe('settling an expedition', () => {
  it('leaves a running expedition alone', () => {
    const save = withRun('splintered-road')
    expect(settleExpedition(save)).toBe(save)
    expect(settleExpedition(withHero())).toEqual(withHero())
  })

  it('banks secured loot and opens the first-return slot on a safe return', () => {
    const save = withRun('splintered-road')
    const expedition = save.expedition!
    expedition.outcome = 'returned'
    expedition.secured = [{ materialId: 'shard', quantity: 8 }, { materialId: 'scrap', quantity: 4 }]
    expedition.depositedGold = 5
    expedition.carriedGold = 7
    const settled = settleExpedition(save)
    expect(settled.expedition).toBeNull()
    expect(settled.account.materials).toEqual({ shard: 8, scrap: 4 })
    expect(settled.account.gold).toBe(12)
    expect(settled.account.slots).toBe(3)
    expect(settled.account.milestones).toEqual(['first-return'])
    expect(() => assertSaveData(settled)).not.toThrow()
  })

  it('banks only secured loot after a defeat, and opens no slot', () => {
    const save = withRun('splintered-road')
    const expedition = save.expedition!
    expedition.outcome = 'defeat'
    expedition.secured = [{ materialId: 'hide', quantity: 4 }]
    expedition.unsecured = [{ materialId: 'shard', quantity: 4 }]
    expedition.depositedGold = 5
    expedition.carriedGold = 7
    const settled = settleExpedition(save)
    expect(settled.account.materials).toEqual({ hide: 4 })
    expect(settled.account.gold).toBe(5)
    expect(settled.account.slots).toBe(2)
    expect(settled.account.milestones).toEqual([])
  })

  it('plays a real road run to its end and settles it into a valid save', () => {
    let save = withRun('splintered-road', 5)
    const expedition = save.expedition!
    const defs = gameDefs()
    let guard = 0
    while (expedition.outcome === 'ongoing' && guard < 400_000) {
      const fights = expedition.history.length
      stepExpedition(expedition, defs)
      if (expedition.history.length !== fights) save = recordProgress(save)
      guard += 1
      if (expedition.history.length >= 4 && !expedition.returning && expedition.phase === 'travel') {
        expedition.returning = true
        expedition.travelMs = 0
      }
    }
    expect(expedition.outcome).not.toBe('ongoing')
    const settled = settleExpedition(save)
    expect(settled.expedition).toBeNull()
    expect(() => assertSaveData(settled)).not.toThrow()
  }, 120_000)
})
