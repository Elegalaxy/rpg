import type { HeroClass } from '../sim/constants.ts'
import { enemySpawnLevel } from '../sim/enemyAi.ts'
import type { CombatHeroSetup, CombatSetup, EnemyDef, GameDefs, PriorityRow, TargetPriority } from '../sim/types.ts'

import { bastionMixed, groveMixed, wolfPair } from './encounters.ts'
import {
  blightSpider,
  deserter,
  echoKnight,
  enemies,
  fallenArbalist,
  fractureShardling,
  fractureWisp,
  fracturedWarden,
  hollowSentry,
  oathboundEcho,
  rootmawStalker,
  standardDummy,
  starvedWolf,
  thornbeast,
} from './enemies.ts'
import { referenceHeroAtLevel, referenceHeroes, type ReferenceHero } from './heroes.ts'
import { skills } from './skills.ts'
import { statuses } from './statuses.ts'

export type ScenarioDef = {
  id: string
  heroId: string
  heroName: string
  enemies: readonly { defId: string; slot: number; level?: number; summon?: boolean; rank?: number }[]
  equippedSkillIds?: readonly string[]
  priorityRows?: readonly PriorityRow[]
  targetPriority?: TargetPriority
  startingResource?: number
  specialAmmo?: number
  /** Cleric vow. Other classes ignore it. */
  vow?: string
  /** When set, the hero is the level-L reference build instead of the level-20 constant. */
  heroLevel?: number
}

/** Name of the class × encounter matrix. Batch reports use this id later. */
export const REFERENCE_MATRIX_ID = 'reference'

export const DUEL_BASIC_ID = 'duel-basic'
export const DRIVING_BLOW_ID = 'driving-blow'
export const VENOM_EDGE_ID = 'venom-edge'
export const PRIORITY_FOCUS_ID = 'priority-focus'
export const WARRIOR_VS_STANDARD_ID = 'warrior-vs-standard'
export const MAGE_VS_STANDARD_ID = 'mage-vs-standard'
export const ASSASSIN_VS_STANDARD_ID = 'assassin-vs-standard'
export const RANGER_VS_STANDARD_ID = 'ranger-vs-standard'
export const CLERIC_VS_STANDARD_ID = 'cleric-vs-standard'
export const WARRIOR_VS_WOLF_PAIR_ID = 'warrior-vs-wolf-pair'
export const GROVE_MIXED_ID = 'grove-mixed'
export const BASTION_MIXED_ID = 'bastion-mixed'
export const ROOTMAW_ID = 'rootmaw'
export const ECHO_KNIGHT_ID = 'echo-knight'
export const WARRIOR_VS_WARDEN_ID = 'warrior-vs-warden'

const baseScenarios: { [id: string]: ScenarioDef } = {
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
  [WARRIOR_VS_STANDARD_ID]: {
    id: WARRIOR_VS_STANDARD_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['driving-blow', 'sundering-blow', 'shield-brace', 'second-wind'],
    priorityRows: [
      {
        skillId: 'second-wind',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }],
      },
      {
        skillId: 'sundering-blow',
        conditions: [
          { kind: 'status', who: 'target', statusId: 'expose', measure: 'presence', operator: 'absent' },
          { kind: 'classResource', operator: 'atLeast', value: 20 },
        ],
      },
      { skillId: 'driving-blow' },
    ],
  },
  [MAGE_VS_STANDARD_ID]: {
    id: MAGE_VS_STANDARD_ID,
    heroId: referenceHeroes.mage.id,
    heroName: 'Mage',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['fireball', 'frost-lance', 'mana-ward', 'arcane-recovery'],
    priorityRows: [
      {
        skillId: 'mana-ward',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 50 }],
      },
      {
        skillId: 'arcane-recovery',
        conditions: [{ kind: 'classResource', operator: 'atMost', value: 30 }],
      },
      {
        skillId: 'fireball',
        conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 2 }],
      },
      { skillId: 'frost-lance' },
    ],
  },
  // Poison stacks are whole numbers, so at most 4 is fewer than 5. Execute's OR is two rows.
  [ASSASSIN_VS_STANDARD_ID]: {
    id: ASSASSIN_VS_STANDARD_ID,
    heroId: referenceHeroes.assassin.id,
    heroName: 'Assassin',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['mark-for-death', 'shadow-cut', 'venom-edge', 'execute'],
    priorityRows: [
      {
        skillId: 'mark-for-death',
        conditions: [{ kind: 'mark', operator: 'absent' }],
      },
      {
        skillId: 'execute',
        conditions: [{ kind: 'classResource', operator: 'atLeast', value: 4 }],
      },
      {
        skillId: 'execute',
        conditions: [{ kind: 'hpPercent', who: 'target', operator: 'atMost', value: 30 }],
      },
      {
        skillId: 'venom-edge',
        conditions: [
          { kind: 'status', who: 'target', statusId: 'poison', measure: 'stacks', operator: 'atMost', value: 4 },
        ],
      },
      { skillId: 'shadow-cut' },
    ],
  },
  [RANGER_VS_STANDARD_ID]: {
    id: RANGER_VS_STANDARD_ID,
    heroId: referenceHeroes.ranger.id,
    heroName: 'Ranger',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap'],
    startingResource: 100,
    specialAmmo: 6,
    priorityRows: [
      {
        skillId: 'snare-trap',
        conditions: [{ kind: 'telegraph', operator: 'present' }],
      },
      {
        skillId: 'volley',
        conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 3 }],
      },
      {
        skillId: 'aimed-shot',
        conditions: [{ kind: 'classResource', operator: 'atLeast', value: 80 }],
      },
      { skillId: 'piercing-arrow' },
    ],
  },
  [CLERIC_VS_STANDARD_ID]: {
    id: CLERIC_VS_STANDARD_ID,
    heroId: referenceHeroes.cleric.id,
    heroName: 'Cleric',
    enemies: [{ defId: standardDummy.id, slot: 0 }],
    equippedSkillIds: ['smite', 'mend', 'ward', 'judgment'],
    vow: 'zeal',
    priorityRows: [
      {
        skillId: 'mend',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 50 }],
      },
      {
        skillId: 'ward',
        conditions: [{ kind: 'telegraph', operator: 'atMost', value: 1000 }],
      },
      {
        skillId: 'judgment',
        conditions: [{ kind: 'classResource', operator: 'atLeast', value: 75 }],
      },
      { skillId: 'smite' },
    ],
  },
  [WARRIOR_VS_WOLF_PAIR_ID]: {
    id: WARRIOR_VS_WOLF_PAIR_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: wolfPair.members.map((member) => ({
      defId: member.enemyId,
      slot: member.slot,
      level: member.level,
    })),
  },
  [GROVE_MIXED_ID]: {
    id: GROVE_MIXED_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: groveMixed.members.map((member) => ({
      defId: member.enemyId,
      slot: member.slot,
      level: member.level,
    })),
  },
  [BASTION_MIXED_ID]: {
    id: BASTION_MIXED_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: bastionMixed.members.map((member) => ({
      defId: member.enemyId,
      slot: member.slot,
      level: member.level,
    })),
  },
  [ROOTMAW_ID]: {
    id: ROOTMAW_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: rootmawStalker.id, slot: 0 }],
  },
  [ECHO_KNIGHT_ID]: {
    id: ECHO_KNIGHT_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: echoKnight.id, slot: 0 }],
  },
  [WARRIOR_VS_WARDEN_ID]: {
    id: WARRIOR_VS_WARDEN_ID,
    heroId: referenceHeroes.warrior.id,
    heroName: 'Warrior',
    enemies: [{ defId: fracturedWarden.id, slot: 0 }],
  },
}

type MatrixEnemy = { defId: string; slot: number; level: number; rank?: number }

type MatrixEncounter = {
  slug: string
  heroLevel: number
  enemies: readonly MatrixEnemy[]
}

type ReferenceLoadout = {
  heroName: string
  equippedSkillIds: readonly string[]
  priorityRows: readonly PriorityRow[]
  startingResource?: number
  specialAmmo?: number
  vow?: string
}

const REFERENCE_CLASSES: readonly HeroClass[] = ['warrior', 'assassin', 'ranger', 'mage', 'cleric']

// Q4 harness fixtures. Unanswered, so these are the written recommendations.
const referenceLoadouts: { [classId in HeroClass]: ReferenceLoadout } = {
  warrior: {
    heroName: 'Warrior',
    equippedSkillIds: ['driving-blow', 'sundering-blow', 'shield-brace', 'second-wind'],
    priorityRows: [
      {
        skillId: 'second-wind',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }],
      },
      {
        skillId: 'shield-brace',
        conditions: [{ kind: 'telegraph', operator: 'atMost', value: 1000 }],
      },
      {
        skillId: 'sundering-blow',
        conditions: [
          { kind: 'status', who: 'target', statusId: 'expose', measure: 'presence', operator: 'absent' },
        ],
      },
      { skillId: 'driving-blow' },
    ],
  },
  assassin: {
    heroName: 'Assassin',
    equippedSkillIds: ['mark-for-death', 'shadow-cut', 'venom-edge', 'execute'],
    priorityRows: [
      {
        skillId: 'mark-for-death',
        conditions: [{ kind: 'mark', operator: 'absent' }],
      },
      {
        skillId: 'execute',
        conditions: [{ kind: 'classResource', operator: 'atLeast', value: 4 }],
      },
      {
        skillId: 'execute',
        conditions: [{ kind: 'hpPercent', who: 'target', operator: 'atMost', value: 30 }],
      },
      {
        skillId: 'venom-edge',
        conditions: [
          { kind: 'status', who: 'target', statusId: 'poison', measure: 'stacks', operator: 'atMost', value: 4 },
        ],
      },
      { skillId: 'shadow-cut' },
    ],
  },
  ranger: {
    heroName: 'Ranger',
    equippedSkillIds: ['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap'],
    startingResource: 100,
    specialAmmo: 6,
    priorityRows: [
      {
        skillId: 'snare-trap',
        conditions: [{ kind: 'telegraph', operator: 'present' }],
      },
      {
        skillId: 'volley',
        conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 3 }],
      },
      {
        skillId: 'aimed-shot',
        conditions: [{ kind: 'classResource', operator: 'atLeast', value: 80 }],
      },
      { skillId: 'piercing-arrow' },
    ],
  },
  mage: {
    heroName: 'Mage',
    equippedSkillIds: ['fireball', 'frost-lance', 'mana-ward', 'arcane-recovery'],
    priorityRows: [
      {
        skillId: 'mana-ward',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 50 }],
      },
      {
        skillId: 'mana-ward',
        conditions: [{ kind: 'telegraph', operator: 'atMost', value: 1000 }],
      },
      {
        skillId: 'arcane-recovery',
        conditions: [{ kind: 'classResource', operator: 'atMost', value: 30 }],
      },
      {
        skillId: 'fireball',
        conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 2 }],
      },
      { skillId: 'frost-lance' },
    ],
  },
  cleric: {
    heroName: 'Cleric',
    equippedSkillIds: ['smite', 'mend', 'ward', 'judgment'],
    vow: 'zeal',
    priorityRows: [
      {
        skillId: 'mend',
        conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 50 }],
      },
      {
        skillId: 'ward',
        conditions: [{ kind: 'telegraph', operator: 'atMost', value: 1000 }],
      },
      {
        skillId: 'judgment',
        conditions: [{ kind: 'classResource', operator: 'atLeast', value: 75 }],
      },
      { skillId: 'smite' },
    ],
  },
}

function bandMiddle(def: EnemyDef): number {
  const min = def.levelMin ?? def.level
  const max = def.levelMax ?? def.level
  return Math.round((min + max) / 2)
}

function solo(slug: string, def: EnemyDef, level: number): MatrixEncounter {
  const middle = bandMiddle(def)
  if (middle !== level) {
    throw new Error(`enemy ${def.id} band middle is ${middle}, reference matrix expected ${level}`)
  }
  enemySpawnLevel(def, level)
  return { slug, heroLevel: level, enemies: [{ defId: def.id, slot: 0, level }] }
}

function grouped(slug: string, heroLevel: number, enemies: readonly MatrixEnemy[]): MatrixEncounter {
  for (const enemy of enemies) {
    const def = enemiesById(enemy.defId)
    enemySpawnLevel(def, enemy.level)
  }
  return { slug, heroLevel, enemies }
}

function enemiesById(defId: string): EnemyDef {
  const def = enemies[defId]
  if (def === undefined) throw new Error(`reference matrix enemy '${defId}' is not defined`)
  return def
}

// Q5 levels. Regulars use the band middle. Mixed groups use the encounter level for every member.
const referenceEncounters: readonly MatrixEncounter[] = [
  solo('shardling', fractureShardling, 3),
  solo('wolf', starvedWolf, 4),
  solo('deserter', deserter, 6),
  solo('spider', blightSpider, 8),
  solo('thornbeast', thornbeast, 11),
  solo('wisp', fractureWisp, 12),
  solo('sentry', hollowSentry, 10),
  solo('arbalist', fallenArbalist, 13),
  solo('oathbound-echo', oathboundEcho, 15),
  grouped('road-mixed', 5, [
    { defId: fractureShardling.id, slot: 0, level: 5 },
    { defId: starvedWolf.id, slot: 1, level: 5 },
    { defId: deserter.id, slot: 2, level: 5 },
  ]),
  grouped('grove-mixed', 10, [
    { defId: thornbeast.id, slot: 0, level: 10 },
    { defId: blightSpider.id, slot: 1, level: 10 },
  ]),
  grouped('bastion-mixed', 12, [
    { defId: hollowSentry.id, slot: 0, level: 12 },
    { defId: fallenArbalist.id, slot: 1, level: 12 },
  ]),
  grouped('rootmaw', 14, [{ defId: rootmawStalker.id, slot: 0, level: 14 }]),
  grouped('echo-knight', 16, [{ defId: echoKnight.id, slot: 0, level: 16 }]),
  grouped('warden', 20, [{ defId: fracturedWarden.id, slot: 0, level: 20, rank: 0 }]),
]

function referenceMatrixScenarios(): { [id: string]: ScenarioDef } {
  const built: { [id: string]: ScenarioDef } = {}
  for (const classId of REFERENCE_CLASSES) {
    const loadout = referenceLoadouts[classId]
    const published = referenceHeroes[classId]
    for (const encounter of referenceEncounters) {
      const id = `ref-${classId}-${encounter.slug}`
      if (built[id] !== undefined || baseScenarios[id] !== undefined) {
        throw new Error(`duplicate scenario '${id}'`)
      }
      built[id] = {
        id,
        heroId: published.id,
        heroName: loadout.heroName,
        heroLevel: encounter.heroLevel,
        enemies: encounter.enemies,
        equippedSkillIds: loadout.equippedSkillIds,
        priorityRows: loadout.priorityRows,
        ...(loadout.startingResource !== undefined ? { startingResource: loadout.startingResource } : {}),
        ...(loadout.specialAmmo !== undefined ? { specialAmmo: loadout.specialAmmo } : {}),
        ...(loadout.vow !== undefined ? { vow: loadout.vow } : {}),
      }
    }
  }
  return built
}

export const scenarios: { [id: string]: ScenarioDef } = {
  ...baseScenarios,
  ...referenceMatrixScenarios(),
}

export function referenceScenarioIds(): string[] {
  return Object.keys(scenarios)
    .filter((id) => id.startsWith('ref-'))
    .sort()
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
    startingResource: scenario.startingResource,
    specialAmmo: scenario.specialAmmo,
    vow: scenario.vow,
  }
}

function referenceHeroById(id: string): ReferenceHero {
  for (const hero of Object.values(referenceHeroes)) {
    if (hero.id === id) return hero
  }
  throw new Error(`scenario hero '${id}' is not a reference hero`)
}

function heroForScenario(scenario: ScenarioDef): ReferenceHero {
  const published = referenceHeroById(scenario.heroId)
  if (scenario.heroLevel === undefined) return published
  return referenceHeroAtLevel(published.classId, scenario.heroLevel)
}

export function setupForScenario(scenarioId: string): CombatSetup {
  const scenario = scenarios[scenarioId]
  if (scenario === undefined) throw new Error(`unknown scenario '${scenarioId}'`)
  return {
    hero: heroSetup(heroForScenario(scenario), scenario),
    enemies: scenario.enemies.map((enemy) => ({
      defId: enemy.defId,
      slot: enemy.slot,
      ...(enemy.level !== undefined ? { level: enemy.level } : {}),
      ...(enemy.summon === true ? { summon: true } : {}),
      ...(enemy.rank !== undefined ? { rank: enemy.rank } : {}),
    })),
  }
}
