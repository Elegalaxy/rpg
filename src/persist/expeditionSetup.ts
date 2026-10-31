import { toExpeditionEncounter, encounters } from '../content/encounters.ts'
import { itemBase } from '../content/items.ts'
import { nodes, routeEncounterIds, routes } from '../content/world.ts'
import { classWebs } from '../content/webs/index.ts'
import { TRAVEL_GAP_MS, createExpedition, type ExpeditionBlueprint, type ExpeditionState } from '../sim/expedition.ts'
import { gearFromEquipment, statBonusesFor } from '../sim/economy.ts'
import { renaissanceActive } from '../sim/progression.ts'

import type { SavedHero } from './save.ts'

/**
 * Build the road run for a saved hero. Gear is what the hero has equipped. Retreat threshold, vow, curse, and arrows come from the hero's preparation.
 */
export function blueprintForHero(
  hero: SavedHero,
  routeId: string,
  gold: { carried: number; deposited: number } = { carried: 0, deposited: 0 },
): ExpeditionBlueprint {
  const route = routes[routeId]
  if (route === undefined) throw new Error(`unknown route '${routeId}'`)
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
    carriedGold: gold.carried,
    depositedGold: gold.deposited,
    retreatThresholds: hero.retreatAtMost === null ? [] : [{ kind: 'hpFraction', atMost: hero.retreatAtMost }],
    hero: {
      id: hero.id,
      name: hero.name,
      level: hero.progress.level,
      classId: hero.classId,
      race: hero.progress.race,
      attributes: hero.progress.attributes,
      gear: gearFromEquipment(hero.equipment, itemBase),
      equippedSkillIds: [...hero.progress.loadout],
      priorityRows: hero.priorityRows.map((row) => ({ ...row })),
      allocatedNodeIds: [...nodeIds],
      renaissance: renaissanceActive(nodeIds, classWebs[hero.classId]),
      statBonuses: statBonusesFor(hero.equipment),
      ...(hero.classId === 'ranger' ? { specialAmmo: hero.specialAmmo } : {}),
      ...(hero.vow !== null ? { vow: hero.vow } : {}),
      ...(hero.curse !== null ? { curse: hero.curse } : {}),
      ...(hero.preparedSpells.length > 0 ? { preparedSpells: [...hero.preparedSpells] } : {}),
    },
  }
}

/** Start a run for the hero on a route. The seed comes from the caller so a saved run can be replayed. */
export function startExpedition(
  hero: SavedHero,
  routeId: string,
  seed: number,
  gold?: { carried: number; deposited: number },
): ExpeditionState {
  return createExpedition(blueprintForHero(hero, routeId, gold), seed)
}
