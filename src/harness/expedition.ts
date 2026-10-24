import {
  splinteredRoadDraw,
  splinteredRoadOpening,
  type EncounterDef,
} from '../content/encounters.ts'
import { enemies } from '../content/enemies.ts'
import { referenceHeroAtLevel } from '../content/heroes.ts'
import { referenceLoadoutFor } from '../content/scenarios.ts'
import type { HeroClass } from '../sim/constants.ts'
import {
  SPLINTERED_ROAD_ID,
  TRAVEL_GAP_MS,
  type ExpeditionBlueprint,
  type ExpeditionEncounterDef,
} from '../sim/expedition.ts'

const ROAD_HERO_LEVEL = 5

function toEncounter(encounter: EncounterDef): ExpeditionEncounterDef {
  return {
    id: encounter.id,
    enemies: encounter.members.map((member) => {
      const def = enemies[member.enemyId]
      if (def === undefined) throw new Error(`unknown enemy '${member.enemyId}'`)
      const enemy = {
        defId: member.enemyId,
        slot: member.slot,
        level: member.level,
      }
      const drop = def.drop
      if (drop === undefined) return enemy
      return { ...enemy, materialId: drop.materialId, baseQuantity: drop.baseQuantity }
    }),
  }
}

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
