import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { routeEncounterIds, routes } from '../content/world.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import { createExpedition, runExpedition } from '../sim/expedition.ts'

import { HARNESS_LIMIT_MS } from './batch.ts'
import { routeBlueprint, routeFightCount } from './expedition.ts'

describe('expedition on every route', () => {
  it('runs each route for every class without an error', () => {
    for (const routeId of Object.keys(routes)) {
      for (const classId of HERO_CLASSES) {
        const state = runExpedition(createExpedition(routeBlueprint(routeId, classId), 7), gameDefs(), routeFightCount(routeId, 4), HARNESS_LIMIT_MS)
        expect(state.id, `${routeId} ${classId}`).toBe(routeId)
        expect(state.history.length, `${routeId} ${classId}`).toBeGreaterThan(0)
        expect(['ongoing', 'defeat', 'returned']).toContain(state.outcome)
      }
    }
  }, 240_000)

  it('follows the route fight by fight when the hero never retreats', () => {
    for (const routeId of ['fracture-via-grove', 'fracture-via-bastion']) {
      const blueprint = { ...routeBlueprint(routeId, 'warrior'), retreatThresholds: [] }
      const state = runExpedition(createExpedition(blueprint, 3), gameDefs(), routeFightCount(routeId, 4), HARNESS_LIMIT_MS)
      const route = routes[routeId]
      const expected = route === undefined ? [] : routeEncounterIds(route)
      const seen = state.history.map((entry) => entry.encounterId)
      expect(seen).toEqual(expected.slice(0, seen.length))
      if (state.outcome === 'defeat') expect(seen.length).toBeGreaterThan(0)
      else expect(seen).toEqual(expected)
    }
  }, 240_000)

  it('keeps the road at level 5 and its four fights', () => {
    expect(routeFightCount('splintered-road', 4)).toBe(4)
    expect(routeBlueprint('splintered-road', 'mage').hero.level).toBe(5)
    expect(routeBlueprint('fracture-via-grove', 'warrior').hero.level).toBeGreaterThan(5)
    expect(() => routeBlueprint('nowhere')).toThrow(/unknown route/)
  })
})
