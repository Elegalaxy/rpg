import type { CombatHeroSetup, CombatSetup, GameDefs, PriorityRow } from '../sim/types.ts'

import { enemies, standardDummy } from './enemies.ts'
import { referenceHeroes, type ReferenceHero } from './heroes.ts'
import { skills } from './skills.ts'

export type ScenarioDef = {
  id: string
  heroId: string
  heroName: string
  enemies: readonly { defId: string; slot: number }[]
  equippedSkillIds?: readonly string[]
  priorityRows?: readonly PriorityRow[]
}

export const DUEL_BASIC_ID = 'duel-basic'
export const DRIVING_BLOW_ID = 'driving-blow'

export const scenarios: { [id: string]: ScenarioDef } = {
  [DUEL_BASIC_ID]: {
    id: DUEL_BASIC_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
  },
  [DRIVING_BLOW_ID]: {
    id: DRIVING_BLOW_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['driving-blow'],
    priorityRows: [{ skillId: 'driving-blow' }],
  },
}

export function gameDefs(): GameDefs {
  return { enemies: { ...enemies }, skills: { ...skills } }
}

function heroSetup(hero: ReferenceHero, scenario: ScenarioDef): CombatHeroSetup {
  return {
    id: hero.id,
    name: scenario.heroName,
    level: hero.level,
    classId: hero.classId,
    attributes: hero.attributes,
    gear: hero.gear,
    equippedSkillIds: scenario.equippedSkillIds,
    priorityRows: scenario.priorityRows,
  }
}

export function setupForScenario(scenarioId: string): CombatSetup {
  const scenario = scenarios[scenarioId]
  if (scenario === undefined) throw new Error(`unknown scenario '${scenarioId}'`)
  if (scenario.heroId !== referenceHeroes.warrior.id) {
    throw new Error(`scenario '${scenarioId}' has no hero setup for '${scenario.heroId}'`)
  }
  return {
    hero: heroSetup(referenceHeroes.warrior, scenario),
    enemies: scenario.enemies.map((enemy) => ({ defId: enemy.defId, slot: enemy.slot })),
  }
}
