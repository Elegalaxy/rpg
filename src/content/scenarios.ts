import type { CombatHeroSetup, CombatSetup, GameDefs } from '../sim/types.ts'

import { enemies, standardDummy } from './enemies.ts'
import { referenceHeroes, type ReferenceHero } from './heroes.ts'

export type ScenarioDef = {
  id: string
  heroId: string
  heroName: string
  enemies: readonly { defId: string; slot: number }[]
}

export const DUEL_BASIC_ID = 'duel-basic'

export const scenarios: { [id: string]: ScenarioDef } = {
  [DUEL_BASIC_ID]: {
    id: DUEL_BASIC_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
  },
}

export function gameDefs(): GameDefs {
  return { enemies: { ...enemies } }
}

function heroSetup(hero: ReferenceHero, name: string): CombatHeroSetup {
  return {
    id: hero.id,
    name,
    level: hero.level,
    classId: hero.classId,
    attributes: hero.attributes,
    gear: hero.gear,
  }
}

export function setupForScenario(scenarioId: string): CombatSetup {
  const scenario = scenarios[scenarioId]
  if (scenario === undefined) throw new Error(`unknown scenario '${scenarioId}'`)
  if (scenario.heroId !== referenceHeroes.warrior.id) {
    throw new Error(`scenario '${scenarioId}' has no hero setup for '${scenario.heroId}'`)
  }
  return {
    hero: heroSetup(referenceHeroes.warrior, scenario.heroName),
    enemies: scenario.enemies.map((enemy) => ({ defId: enemy.defId, slot: enemy.slot })),
  }
}
