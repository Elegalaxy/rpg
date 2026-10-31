import { HERO_RACES, type HeroRace } from '../progression.ts'
import type { ClassModule } from '../types.ts'
import { beastfolkRace, FEROCITY_CAP } from './beastfolk.ts'
import { elfRace, FOCUS_MAX } from './elf.ts'
import { humanRace } from './human.ts'
import { undeadRace } from './undead.ts'

const RACE_MODULES: { [id: string]: ClassModule } = {
  human: humanRace,
  elf: elfRace,
  beastfolk: beastfolkRace,
  undead: undeadRace,
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

/** Race behavior lives on the module. Combat looks up hooks here and does not branch on race id. */
export function raceModule(race: HeroRace | null): ClassModule | null {
  if (race === null) return null
  return RACE_MODULES[race] ?? null
}

export function readRace(value: unknown): HeroRace | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && (HERO_RACES as readonly string[]).includes(value)) {
    return value as HeroRace
  }
  throw new Error(`unknown race ${describeValue(value)}`)
}

export function readStartingFocus(value: unknown): number | null {
  if (value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > FOCUS_MAX) {
    throw new Error(`starting focus must be from 0 through ${FOCUS_MAX}, received ${describeValue(value)}`)
  }
  return value
}

export function readFerocityProgress(value: unknown): number | null {
  if (value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > FEROCITY_CAP) {
    throw new Error(
      `ferocity progress must be an integer from 0 through ${FEROCITY_CAP}, received ${describeValue(value)}`,
    )
  }
  return value
}
