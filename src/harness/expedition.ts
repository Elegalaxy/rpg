import {
  encounters,
  splinteredRoadDraw,
  splinteredRoadOpening,
  toExpeditionEncounter,
  type EncounterDef,
} from '../content/encounters.ts'
import { nodes, routeEncounterIds, routes } from '../content/world.ts'
import { referenceHeroAtLevel } from '../content/heroes.ts'
import { referenceLoadoutFor } from '../content/scenarios.ts'
import type { HeroClass } from '../sim/constants.ts'
import {
  SPLINTERED_ROAD_ID,
  TRAVEL_GAP_MS,
  type ExpeditionBlueprint,
} from '../sim/expedition.ts'

const ROAD_HERO_LEVEL = 5

const toEncounter = toExpeditionEncounter

/** Level-5 reference hero on the Splintered Road, with that class's Q4 loadout. */
export function splinteredRoadBlueprint(classId: HeroClass = 'warrior'): ExpeditionBlueprint {
  const hero = referenceHeroAtLevel(classId, ROAD_HERO_LEVEL)
  const loadout = referenceLoadoutFor(classId)
  return {
    id: SPLINTERED_ROAD_ID,
    opening: splinteredRoadOpening.map(toEncounter),
    draw: splinteredRoadDraw.map(toEncounter),
    travelGapMs: TRAVEL_GAP_MS,
    retreatThresholds: [{ kind: 'hpFraction', atMost: 0.4 }],
    hero: {
      id: hero.id,
      name: loadout.heroName,
      level: hero.level,
      classId,
      attributes: hero.attributes,
      gear: hero.gear,
      equippedSkillIds: [...loadout.equippedSkillIds],
      priorityRows: loadout.priorityRows,
      ...(loadout.specialAmmo !== undefined ? { specialAmmo: loadout.specialAmmo } : {}),
      ...(loadout.vow !== undefined ? { vow: loadout.vow } : {}),
    },
  }
}

function heroLevelFor(routeId: string): number {
  if (routeId === SPLINTERED_ROAD_ID) return ROAD_HERO_LEVEL
  const route = routes[routeId]
  const last = route === undefined ? undefined : nodes[route.nodeIds[route.nodeIds.length - 1] ?? '']
  const min = last?.levels?.min ?? ROAD_HERO_LEVEL
  const level = min + 2
  return level < ROAD_HERO_LEVEL ? ROAD_HERO_LEVEL : level > 20 ? 20 : level
}

/** How many fights this command runs on a route. The road keeps its original four. */
export function routeFightCount(routeId: string, roadCount: number): number {
  if (routeId === SPLINTERED_ROAD_ID) return roadCount
  const route = routes[routeId]
  if (route === undefined) throw new Error(`unknown route '${routeId}'`)
  return routeEncounterIds(route).length
}

/**
 * One expedition along a world route: every node's fixed fights in order, then the last zone's draw
 * table. The reference hero is a few levels above the last node's lowest recommended level.
 */
export function routeBlueprint(routeId: string, classId: HeroClass = 'warrior'): ExpeditionBlueprint {
  if (routeId === SPLINTERED_ROAD_ID) return splinteredRoadBlueprint(classId)
  const route = routes[routeId]
  if (route === undefined) throw new Error(`unknown route '${routeId}'`)
  const find = (id: string): EncounterDef => {
    const encounter = encounters[id]
    if (encounter === undefined) throw new Error(`route '${routeId}' names unknown encounter '${id}'`)
    return encounter
  }
  const lastNode = nodes[route.nodeIds[route.nodeIds.length - 1] ?? '']
  const drawIds = lastNode?.drawEncounterIds ?? lastNode?.encounterIds ?? []
  const base = splinteredRoadBlueprint(classId)
  const hero = referenceHeroAtLevel(classId, heroLevelFor(routeId))
  return {
    ...base,
    id: routeId as ExpeditionBlueprint['id'],
    opening: routeEncounterIds(route).map((id) => toEncounter(find(id))),
    draw: drawIds.map((id) => toEncounter(find(id))),
    hero: { ...base.hero, id: hero.id, level: hero.level, attributes: hero.attributes, gear: hero.gear },
  }
}
