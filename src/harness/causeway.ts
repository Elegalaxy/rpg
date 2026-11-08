import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { blindSetup } from './telegraph.ts'
import { PREPARED_MODIFIERS, STARTER_MODIFIERS, craftedVariant, wardenSetup, type WardenTier } from './warden.ts'

/**
 * Realistic heroes at the Drowned Causeway (Step 13.1 part 3). Same construction as the Warden tiers
 * (reference attributes, crafted gear at item level equal to hero level, one modifier per piece, the
 * class reference rules behind the starting supply rules), at the zone's levels.
 */
export const CAUSEWAY_TIERS: readonly WardenTier[] = [
  {
    id: 'arrived',
    label: 'Just arrived',
    level: 17,
    nodes: 6,
    quality: 1,
    modifiers: STARTER_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught'],
  },
  {
    id: 'prepared',
    label: 'Well prepared',
    level: 19,
    nodes: 6,
    quality: 1.05,
    modifiers: PREPARED_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'],
  },
  {
    id: 'over',
    label: 'Over-levelled',
    level: 22,
    nodes: 8,
    quality: 1.1,
    modifiers: { ...PREPARED_MODIFIERS, accessory0: 'vicious', accessory1: 'quick' },
    supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'],
  },
]

/** Measured beside the tiers (Step 13.3 part 5): the prepared hero with crafted supplies packed. */
export const CAUSEWAY_VARIANTS: readonly WardenTier[] = [craftedVariant(CAUSEWAY_TIERS[1]!)]

const ALL_CAUSEWAY_TIERS: readonly WardenTier[] = [...CAUSEWAY_TIERS, ...CAUSEWAY_VARIANTS]

export type CausewayFight = {
  id: string
  enemies: CombatSetup['enemies']
  /** Fights with a telegraph or interruptible wind-up also run without the hero's telegraph rows. */
  blind: boolean
}

export const CAUSEWAY_FIGHTS: readonly CausewayFight[] = [
  { id: 'leech', enemies: [{ defId: 'mire-leech', slot: 0, level: 18 }], blind: false },
  { id: 'raider', enemies: [{ defId: 'causeway-raider', slot: 0, level: 18 }], blind: false },
  { id: 'bulwark', enemies: [{ defId: 'drowned-bulwark', slot: 0, level: 18 }], blind: true },
  {
    id: 'leech-swarm',
    enemies: [
      { defId: 'mire-leech', slot: 0, level: 17 },
      { defId: 'mire-leech', slot: 1, level: 17 },
      { defId: 'mire-leech', slot: 2, level: 17 },
    ],
    blind: false,
  },
  {
    id: 'causeway-mixed',
    enemies: [
      { defId: 'drowned-bulwark', slot: 0, level: 18 },
      { defId: 'fracture-wisp', slot: 1, level: 18 },
    ],
    blind: true,
  },
  {
    id: 'causeway-deep',
    enemies: [
      { defId: 'drowned-bulwark', slot: 0, level: 20 },
      { defId: 'causeway-raider', slot: 1, level: 20 },
      { defId: 'oathbound-echo', slot: 2, level: 20 },
    ],
    blind: true,
  },
  { id: 'colossus', enemies: [{ defId: 'tidebound-colossus', slot: 0, level: 22 }], blind: true },
]

export const CAUSEWAY_MODES = ['rules', 'blind'] as const
export type CausewayMode = (typeof CAUSEWAY_MODES)[number]

export type CausewayRow = {
  classId: HeroClass
  tier: string
  fight: string
  mode: CausewayMode
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
  /** Median fight time over every run in ms, wins and losses alike. */
  medianMs: number
}

/** The fight for a class at a tier: the Warden-style hero against the fight's enemies. */
export function causewaySetup(classId: HeroClass, tier: WardenTier, fight: CausewayFight, mode: CausewayMode = 'rules'): CombatSetup {
  const base = { ...wardenSetup(classId, tier), enemies: fight.enemies }
  return mode === 'blind' ? blindSetup(base) : base
}

/** Every class at every tier against every Causeway fight, with and without telegraph rules where they matter. */
export function runCausewayMatrix(seed: number, runs: number): CausewayRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: CausewayRow[] = []
  for (const classId of HERO_CLASSES) {
    for (const tier of ALL_CAUSEWAY_TIERS) {
      for (const fight of CAUSEWAY_FIGHTS) {
        for (const mode of CAUSEWAY_MODES) {
          if (mode === 'blind' && !fight.blind) continue
          const setup = causewaySetup(classId, tier, fight, mode)
          let wins = 0
          let lost = 0
          const times: number[] = []
          for (let index = 0; index < runs; index += 1) {
            const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
            if (state.outcome === 'victory') wins += 1
            times.push(state.timeMs)
            lost += 1 - Math.max(0, state.hero.hp) / state.hero.maxHp
          }
          times.sort((a, b) => a - b)
          rows.push({
            classId,
            tier: tier.id,
            fight: fight.id,
            mode,
            winRate: wins / runs,
            hpLost: lost / runs,
            medianMs: times[Math.floor(times.length / 2)] ?? 0,
          })
        }
      }
    }
  }
  return rows
}

/** One line per class, tier and mode, with a cell per fight: wins, mean HP lost, median fight time. */
export function formatCausewayTable(rows: readonly CausewayRow[]): string {
  const lines: string[] = []
  for (const classId of HERO_CLASSES) {
    for (const tier of ALL_CAUSEWAY_TIERS) {
      for (const mode of CAUSEWAY_MODES) {
        const cells: string[] = []
        for (const fight of CAUSEWAY_FIGHTS) {
          const row = rows.find((entry) => entry.classId === classId && entry.tier === tier.id && entry.mode === mode && entry.fight === fight.id)
          if (row === undefined) continue
          cells.push(`${fight.id} ${Math.round(row.winRate * 100)}% (lost ${Math.round(row.hpLost * 100)}%, ${(row.medianMs / 1000).toFixed(0)}s)`)
        }
        if (cells.length === 0) continue
        lines.push(`${classId} ${tier.id} ${mode}: ${cells.join(' | ')}`)
      }
    }
  }
  return `${lines.join('\n')}\n`
}
