import { gameDefs, referenceLoadoutFor } from '../content/scenarios.ts'
import { referenceHeroAtLevel } from '../content/heroes.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { HERO_RACES, type HeroRace } from '../sim/progression.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup, CombatState, GameDefs } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'

const DUMMY_ID = 'dummy-standard-20'
const HERO_LEVEL = 10

export type ComboPair = {
  race: HeroRace
  classId: HeroClass
  pairIndex: number
}

export type ComboMatrixReport = {
  pairs: number
  runs: number
  errors: number
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertRuns(runs: unknown): asserts runs is number {
  if (typeof runs !== 'number' || !Number.isInteger(runs) || runs < 1) {
    throw new Error(`runs must be an integer of at least 1, received ${describeValue(runs)}`)
  }
  if (runs > MAX_BATCH_RUNS) {
    throw new Error(`runs must be an integer of at most ${MAX_BATCH_RUNS}, received ${runs}`)
  }
}

/** Race-major, then the class roster. Pair 0 is human warrior. */
export function comboPairs(): ComboPair[] {
  const pairs: ComboPair[] = []
  for (let raceIndex = 0; raceIndex < HERO_RACES.length; raceIndex += 1) {
    for (let classIndex = 0; classIndex < HERO_CLASSES.length; classIndex += 1) {
      const race = HERO_RACES[raceIndex]
      const classId = HERO_CLASSES[classIndex]
      if (race === undefined || classId === undefined) continue
      pairs.push({ race, classId, pairIndex: raceIndex * HERO_CLASSES.length + classIndex })
    }
  }
  return pairs
}

/** The published dummy is level 20 only. This copy spawns it at level 10 for the matrix. */
export function comboDefs(): GameDefs {
  const defs = gameDefs()
  const dummy = defs.enemies[DUMMY_ID]
  if (dummy === undefined) throw new Error(`enemy '${DUMMY_ID}' is not defined`)
  defs.enemies[DUMMY_ID] = { ...dummy, level: HERO_LEVEL, levelMin: HERO_LEVEL, levelMax: HERO_LEVEL }
  return defs
}

export function comboSetup(pair: ComboPair): CombatSetup {
  const hero = referenceHeroAtLevel(pair.classId, HERO_LEVEL)
  const loadout = referenceLoadoutFor(pair.classId)
  return {
    hero: {
      id: hero.id,
      name: loadout.heroName,
      level: hero.level,
      classId: pair.classId,
      race: pair.race,
      attributes: hero.attributes,
      gear: hero.gear,
      equippedSkillIds: [...loadout.equippedSkillIds],
      priorityRows: loadout.priorityRows,
      ...(loadout.startingResource !== undefined ? { startingResource: loadout.startingResource } : {}),
      ...(loadout.specialAmmo !== undefined ? { specialAmmo: loadout.specialAmmo } : {}),
      ...(loadout.vow !== undefined ? { vow: loadout.vow } : {}),
    },
    enemies: [{ defId: DUMMY_ID, slot: 0, level: HERO_LEVEL }],
  }
}

export function runComboFight(pair: ComboPair, seed: number, defs: GameDefs = comboDefs()): CombatState {
  return runCombat(createCombat(comboSetup(pair), defs, seed), defs, HARNESS_LIMIT_MS)
}

export function comboSeed(baseSeed: number, pairIndex: number, runs: number, runIndex: number): number {
  return deriveSeed(baseSeed, pairIndex * runs + runIndex)
}

/** One fight per pair per run. A thrown fight or a log with no race event counts as an error. */
export function runComboMatrix(baseSeed: number, runs: number): ComboMatrixReport {
  assertRuns(runs)
  const pairs = comboPairs()
  const defs = comboDefs()
  let errors = 0
  for (const pair of pairs) {
    for (let runIndex = 0; runIndex < runs; runIndex += 1) {
      const seed = comboSeed(baseSeed, pair.pairIndex, runs, runIndex)
      try {
        const state = runComboFight(pair, seed, defs)
        if (!state.log.some((event) => event.type === 'race')) {
          errors += 1
          console.error(
            `[sim] matrix combos missing race event ${pair.race} ${pair.classId} run ${runIndex} seed ${seed}`,
          )
        }
      } catch (error) {
        errors += 1
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[sim] matrix combos error ${pair.race} ${pair.classId} run ${runIndex} seed ${seed}: ${message}`)
      }
    }
  }
  return { pairs: pairs.length, runs, errors }
}
