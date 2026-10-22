import type { CombatHeroSetup, CombatSetup, GameDefs, PriorityRow, TargetPriority } from '../sim/types.ts'

import { enemies, standardDummy } from './enemies.ts'
import { referenceHeroes, type ReferenceHero } from './heroes.ts'
import { skills } from './skills.ts'
import { statuses } from './statuses.ts'

export type ScenarioDef = {
  id: string
  heroId: string
  heroName: string
  enemies: readonly { defId: string; slot: number }[]
  equippedSkillIds?: readonly string[]
  priorityRows?: readonly PriorityRow[]
  targetPriority?: TargetPriority
}

export const DUEL_BASIC_ID = 'duel-basic'
export const DRIVING_BLOW_ID = 'driving-blow'
export const VENOM_EDGE_ID = 'venom-edge'
export const PRIORITY_FOCUS_ID = 'priority-focus'

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
  [VENOM_EDGE_ID]: {
    id: VENOM_EDGE_ID,
    heroId: referenceHeroes.assassin.id,
    heroName: 'Assassin',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['venom-edge'],
    priorityRows: [{ skillId: 'venom-edge' }],
  },
  [PRIORITY_FOCUS_ID]: {
    id: PRIORITY_FOCUS_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['driving-blow'],
    targetPriority: 'lowestHpPercent',
    priorityRows: [
      {
        skillId: 'driving-blow',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 0 }],
      },
      { skillId: 'driving-blow', targetPriority: 'current' },
    ],
  },
}

export function gameDefs(): GameDefs {
  return { enemies: { ...enemies }, skills: { ...skills }, statuses: { ...statuses } }
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
    targetPriority: scenario.targetPriority,
  }
}

function referenceHeroById(id: string): ReferenceHero {
  for (const hero of Object.values(referenceHeroes)) {
    if (hero.id === id) return hero
  }
  throw new Error(`scenario hero '${id}' is not a reference hero`)
}

export function setupForScenario(scenarioId: string): CombatSetup {
  const scenario = scenarios[scenarioId]
  if (scenario === undefined) throw new Error(`unknown scenario '${scenarioId}'`)
  return {
    hero: heroSetup(referenceHeroById(scenario.heroId), scenario),
    enemies: scenario.enemies.map((enemy) => ({ defId: enemy.defId, slot: enemy.slot })),
  }
}
