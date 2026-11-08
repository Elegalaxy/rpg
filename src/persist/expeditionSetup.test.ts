import { describe, expect, it } from 'vitest'

import { enemies } from '../content/enemies.ts'
import { referenceHeroAtLevel } from '../content/heroes.ts'
import { gameDefs } from '../content/scenarios.ts'
import { routeEncounterIds, routes } from '../content/world.ts'
import { createExpedition, runExpedition } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { blueprintForHero } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { newSave } from './save.ts'

function hero() {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error('hero')
  const hero = selectedHero(made.save)
  if (hero === null) throw new Error('no hero')
  return hero
}

describe('blueprintForHero pass-through fights', () => {
  it('gives gold but no materials for fights before the last node', () => {
    for (const routeId of ['withered-grove', 'sunken-causeway']) {
      const blueprint = blueprintForHero(hero(), routeId)
      const route = routes[routeId]!
      expect(blueprint.opening.length, routeId).toBe(routeEncounterIds(route).length)
      const roadFights = 3
      for (const encounter of blueprint.opening.slice(0, roadFights)) {
        for (const enemy of encounter.enemies) {
          expect(enemy.gold, `${routeId} ${enemy.defId}`).toBeGreaterThan(0)
          expect(enemy.materialId, `${routeId} ${enemy.defId}`).toBeUndefined()
          expect(enemy.baseQuantity, `${routeId} ${enemy.defId}`).toBeUndefined()
        }
      }
    }
  })

  it('keeps drops in the last node and in the draw table', () => {
    const blueprint = blueprintForHero(hero(), 'sunken-causeway')
    const dropping = blueprint.opening.slice(3).flatMap((encounter) => encounter.enemies).filter((enemy) => enemy.materialId !== undefined)
    expect(dropping.length).toBeGreaterThan(0)
    const drawn = blueprint.draw.flatMap((encounter) => encounter.enemies).filter((enemy) => enemies[enemy.defId]?.drop !== undefined)
    expect(drawn.length).toBeGreaterThan(0)
    for (const enemy of drawn) expect(enemy.materialId).toBeDefined()
  })

  it('leaves the Splintered Road route unchanged', () => {
    const blueprint = blueprintForHero(hero(), 'splintered-road')
    const dropping = blueprint.opening.flatMap((encounter) => encounter.enemies).filter((enemy) => enemy.materialId !== undefined)
    expect(dropping.length).toBe(blueprint.opening.flatMap((encounter) => encounter.enemies).length)
  })
})

describe('Grove run', () => {
  it('secures witherbark from the Grove fights but nothing from the Road fights', () => {
    const blueprint = blueprintForHero(hero(), 'withered-grove')
    const reference = referenceHeroAtLevel('warrior', 16)
    blueprint.hero = { ...blueprint.hero, level: reference.level, attributes: reference.attributes, gear: reference.gear }
    blueprint.retreatThresholds = []
    const state = runExpedition(createExpedition(blueprint, 3), gameDefs(), 6, 600_000)
    const held = [...state.secured, ...state.unsecured]
    const units = (id: string) => held.filter((stack) => stack.materialId === id).reduce((sum, stack) => sum + stack.quantity, 0)
    expect(state.history.length).toBeGreaterThanOrEqual(4)
    expect(units('witherbark')).toBeGreaterThan(0)
    expect(units('scrap')).toBe(0)
  })
})
