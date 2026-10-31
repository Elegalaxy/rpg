import { toExpeditionEncounter, encounters } from '../content/encounters.ts'
import { referenceHeroAtLevel } from '../content/heroes.ts'
import { referenceLoadoutFor } from '../content/scenarios.ts'
import { nodes, routeEncounterIds, routes } from '../content/world.ts'
import { classWebs } from '../content/webs/index.ts'
import { TRAVEL_GAP_MS, createExpedition, type ExpeditionBlueprint, type ExpeditionState } from '../sim/expedition.ts'
import { renaissanceActive } from '../sim/progression.ts'

import type { SavedHero } from './save.ts'

/**
 * Build the road run for a saved hero. Gear is the neutral reference set at the hero's level until
 * equipment exists (Step 9.1), and retreat is the usual 40% HP threshold until the preparation
 * screen lets the player choose (Step 8.3).
 */
export function blueprintForHero(hero: SavedHero, routeId: string): ExpeditionBlueprint {
  const route = routes[routeId]
  if (route === undefined) throw new Error(`unknown route '${routeId}'`)
  const reference = referenceHeroAtLevel(hero.classId, hero.progress.level)
  const loadout = referenceLoadoutFor(hero.classId)
  const find = (id: string) => {
    const encounter = encounters[id]
    if (encounter === undefined) throw new Error(`route '${routeId}' names unknown encounter '${id}'`)
    return toExpeditionEncounter(encounter)
  }
  const last = nodes[route.nodeIds[route.nodeIds.length - 1] ?? '']
  const drawIds = last?.drawEncounterIds ?? last?.encounterIds ?? []
  const nodeIds = hero.progress.allocatedNodeIds
  return {
    id: routeId as ExpeditionBlueprint['id'],
    opening: routeEncounterIds(route).map(find),
    draw: drawIds.map(find),
    travelGapMs: TRAVEL_GAP_MS,
    retreatThresholds: [{ kind: 'hpFraction', atMost: 0.4 }],
    hero: {
      id: hero.id,
      name: hero.name,
      level: hero.progress.level,
      classId: hero.classId,
      race: hero.progress.race,
      attributes: hero.progress.attributes,
      gear: reference.gear,
      equippedSkillIds: [...hero.progress.loadout],
      priorityRows: hero.priorityRows.map((row) => ({ ...row })),
      allocatedNodeIds: [...nodeIds],
      renaissance: renaissanceActive(nodeIds, classWebs[hero.classId]),
      ...(loadout.specialAmmo !== undefined ? { specialAmmo: loadout.specialAmmo } : {}),
      ...(hero.vow !== null ? { vow: hero.vow } : {}),
      ...(hero.curse !== null ? { curse: hero.curse } : {}),
      ...(hero.preparedSpells.length > 0 ? { preparedSpells: [...hero.preparedSpells] } : {}),
    },
  }
}

/** Start a run for the hero on a route. The seed comes from the caller so a saved run can be replayed. */
export function startExpedition(hero: SavedHero, routeId: string, seed: number): ExpeditionState {
  return createExpedition(blueprintForHero(hero, routeId), seed)
}
