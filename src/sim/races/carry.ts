import type { HeroRace } from '../progression.ts'
import type { CombatHero } from '../types.ts'

/** Copied into a fight only for the race that keeps that meter. */
export function setupRaceMeters(
  race: HeroRace | null | undefined,
  focus: number,
  ferocity: number,
): { startingFocus?: number; ferocityProgress?: number } {
  if (race === 'elf') return { startingFocus: focus }
  if (race === 'beastfolk') return { ferocityProgress: ferocity }
  return {}
}

/** Null means this race does not carry that meter out of the fight. */
export function storeRaceMeters(
  race: HeroRace | null | undefined,
  hero: CombatHero,
): { focus: number | null; ferocity: number | null } {
  if (race === 'elf') {
    const focus = hero.raceState.focus
    return { focus: typeof focus === 'number' ? focus : 0, ferocity: null }
  }
  if (race === 'beastfolk') {
    const ferocity = hero.raceState.ferocity
    return { focus: null, ferocity: typeof ferocity === 'number' ? ferocity : 0 }
  }
  return { focus: null, ferocity: null }
}
