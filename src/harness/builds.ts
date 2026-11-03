import { setupForScenario, gameDefs } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'

/**
 * The order each class's reference build spends skill points, by node name. A first life reaches
 * level 20 with six points (one every third level), and three Skill Point Seeds make it nine. A build
 * with N points is the first N names, so every prefix is a legal build (each node follows its own
 * cluster's earlier nodes). No keystone is taken. The nodes follow the reference loadouts: they
 * improve the four skills that loadout already uses, plus the class resource and survival.
 */
export const BUILD_ORDER: { readonly [classId in HeroClass]: readonly string[] } = {
  warrior: ['Driving Blow', 'Rising Heat', 'Sundering Blow', 'Weapon Discipline', 'Shield Brace', 'Second Wind', 'Cleave', 'Defiance', 'Bloodletting'],
  assassin: ['Shadow Cut', 'Venom Edge', 'Mark for Death', 'Potent Toxins', 'Exploit Weakness', 'Execute', 'Relentless', 'Smoke Step', 'Elusive Footwork'],
  ranger: ['Aimed Shot', 'Steady Hands', 'Piercing Arrow', 'Patient Shot', 'Snare Trap', 'Reinforced Snare', "Hunter's Mark", 'Trail Sense', 'Flame Arrow'],
  mage: ['Fireball', 'Frost Lance', 'Arcane Bolt', 'Mana Ward', 'Arcane Recovery', 'Efficient Channeling', 'Chain Lightning', 'Elemental Affinity', 'Spell Memory'],
  cleric: ['Smite', 'Vowkeeper', 'Mend', 'Penance', 'Ward', 'Steadfast Spirit', 'Judgment', 'Righteous Force', 'Consecration'],
}

/** The node ids of the first `points` nodes of a class's reference build. */
export function builtNodeIds(classId: HeroClass, points: number): string[] {
  const web = classWebs[classId]
  return BUILD_ORDER[classId].slice(0, points).map((name) => {
    const node = web.nodes.find((entry) => entry.name === name)
    if (node === undefined) throw new Error(`${classId} reference build names an unknown node ${name}`)
    return node.id
  })
}

/** A reference scenario with the class's build of `points` nodes allocated. Zero points is the floor build. */
export function builtSetup(scenarioId: string, classId: HeroClass, points: number): CombatSetup {
  const setup = setupForScenario(scenarioId)
  return { ...setup, hero: { ...setup.hero, allocatedNodeIds: builtNodeIds(classId, points) } }
}

export const BUILT_ENEMIES = ['deserter', 'rootmaw', 'echo-knight', 'warden'] as const
export const BUILT_POINTS = [0, 6, 9] as const

export type BuiltRow = {
  classId: HeroClass
  points: number
  enemy: string
  winRate: number
  /** The first enemy's HP left, as a fraction, averaged over every run. */
  enemyLeft: number
  /** Median fight time of the wins, or null with no win. */
  medianMs: number | null
}

/** Floor, six-point, and nine-point builds of every class against a regular enemy, both elites, and the Warden. */
export function runBuiltMatrix(seed: number, runs: number): BuiltRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: BuiltRow[] = []
  for (const classId of HERO_CLASSES) {
    for (const points of BUILT_POINTS) {
      for (const enemy of BUILT_ENEMIES) {
        const setup = builtSetup(`ref-${classId}-${enemy}`, classId, points)
        let wins = 0
        let left = 0
        const times: number[] = []
        for (let index = 0; index < runs; index += 1) {
          const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
          if (state.outcome === 'victory') {
            wins += 1
            times.push(state.timeMs)
          }
          const first = state.enemies[0]
          left += first === undefined ? 0 : first.hp / first.maxHp
        }
        times.sort((a, b) => a - b)
        rows.push({
          classId,
          points,
          enemy,
          winRate: wins / runs,
          enemyLeft: left / runs,
          medianMs: times.length === 0 ? null : (times[Math.floor(times.length / 2)] ?? null),
        })
      }
    }
  }
  return rows
}

/** One line per class and build, with a cell per enemy: wins, then the first enemy's HP left. */
export function formatBuiltTable(rows: readonly BuiltRow[]): string {
  const lines: string[] = []
  for (const classId of HERO_CLASSES) {
    for (const points of BUILT_POINTS) {
      const cells = BUILT_ENEMIES.map((enemy) => {
        const row = rows.find((entry) => entry.classId === classId && entry.points === points && entry.enemy === enemy)
        if (row === undefined) return `${enemy} n/a`
        const time = row.medianMs === null ? '-' : `${(row.medianMs / 1000).toFixed(0)}s`
        return `${enemy} ${Math.round(row.winRate * 100)}% (left ${Math.round(row.enemyLeft * 100)}%, ${time})`
      })
      lines.push(`${classId} ${points} nodes: ${cells.join(' | ')}`)
    }
  }
  return `${lines.join('\n')}\n`
}
