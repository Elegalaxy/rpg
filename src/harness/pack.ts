import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { MAX_SUPPLY_SLOTS, SUPPLY_SLOT_COUNT } from '../sim/expedition.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { ELITE_CELLS, ELITE_IDS, eliteSetup, type EliteCell, type EliteId } from './elites.ts'

/**
 * The crafted backpack measurement (Step 13.22 part 2): the same hero, rules and elite fight with 4, 5 and 6 supply
 * slots. The extra slots hold more of the tier's main healing supply (a Healing Draught at the prepared tier, a Greater
 * Draught at the crafted tier), so the default supply rows are unchanged. Measurements only; nothing here tunes.
 */
export const PACK_SLOT_COUNTS: readonly number[] = [SUPPLY_SLOT_COUNT, SUPPLY_SLOT_COUNT + 1, MAX_SUPPLY_SLOTS]

/** The tiers measured: the prepared tier and its crafted-supplies variant, for every elite. */
export const PACK_TIERS = ['prepared', 'prepared-crafted'] as const
export type PackTier = (typeof PACK_TIERS)[number]

export type PackRow = {
  classId: HeroClass
  elite: EliteId
  tier: PackTier
  slots: number
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
}

/** The supply id the extra slots hold at this tier. */
export function packFillerId(tier: PackTier): string {
  return tier === 'prepared-crafted' ? 'greater-draught' : 'healing-draught'
}

/** The elite fight for a class with the tier's supplies topped up to `slots`. */
export function packSetup(classId: HeroClass, cell: EliteCell, slots: number): CombatSetup {
  if (!Number.isInteger(slots) || slots < SUPPLY_SLOT_COUNT || slots > MAX_SUPPLY_SLOTS) {
    throw new Error(`slots must be a whole number from ${SUPPLY_SLOT_COUNT} to ${MAX_SUPPLY_SLOTS}, received ${slots}`)
  }
  const base = eliteSetup(classId, cell)
  const extra = Array.from({ length: slots - base.hero.supplies!.length }, () => packFillerId(cell.tier as PackTier))
  const supplies = [...base.hero.supplies!, ...extra]
  return {
    ...base,
    hero: { ...base.hero, supplies, ...(classId === 'ranger' ? { carriedSupplyCount: supplies.length } : {}) },
  }
}

export type PackFilter = { classes?: readonly HeroClass[]; elites?: readonly EliteId[]; tiers?: readonly PackTier[] }

/** Every class against every elite at the prepared and crafted tiers with 4, 5 and 6 slots, in rules mode. */
export function runPackMatrix(seed: number, runs: number, filter: PackFilter = {}): PackRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: PackRow[] = []
  for (const classId of HERO_CLASSES) {
    if (filter.classes !== undefined && !filter.classes.includes(classId)) continue
    for (const elite of ELITE_IDS) {
      if (filter.elites !== undefined && !filter.elites.includes(elite)) continue
      for (const tier of PACK_TIERS) {
        if (filter.tiers !== undefined && !filter.tiers.includes(tier)) continue
        const cell = ELITE_CELLS.find((entry) => entry.elite === elite && entry.tier === tier)!
        for (const slots of PACK_SLOT_COUNTS) {
          const setup = packSetup(classId, cell, slots)
          let wins = 0
          let lost = 0
          for (let index = 0; index < runs; index += 1) {
            const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
            if (state.outcome === 'victory') wins += 1
            lost += 1 - Math.max(0, state.hero.hp) / state.hero.maxHp
          }
          rows.push({ classId, elite, tier, slots, winRate: wins / runs, hpLost: lost / runs })
        }
      }
    }
  }
  return rows
}

/** One line per row: class, elite, tier, slots, then wins and mean HP lost. */
export function formatPackTable(rows: readonly PackRow[]): string {
  const lines = rows.map((row) => `${row.classId} ${row.elite} ${row.tier} slots ${row.slots}: wins ${Math.round(row.winRate * 100)}% | lost ${Math.round(row.hpLost * 100)}%`)
  return `${lines.join('\n')}\n`
}
