import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { blindSetup } from './telegraph.ts'
import { PREPARED_MODIFIERS, wardenSetup, type WardenTier } from './warden.ts'

/**
 * Realistic heroes at the Rift Hollows (Step 13.4 part 3). Same construction as the Causeway tiers
 * (reference attributes, crafted gear at item level equal to hero level, one modifier per piece, the class
 * reference rules behind the starting supply rules), at the zone's levels. Measurements only.
 */
const HOLLOWS_BASE_MODIFIERS: WardenTier['modifiers'] = {
  ...PREPARED_MODIFIERS,
  mainHand: 'siphoning',
  accessory0: 'vicious',
  accessory1: 'quick',
}

/** Stalwart on head and chest (replacing Sturdy); a Cleric wears Devout on the off-hand and one accessory. */
const HOLLOWS_PREPARED_MODIFIERS: WardenTier['modifiers'] = { ...HOLLOWS_BASE_MODIFIERS, head: 'stalwart', chest: 'stalwart' }

export const HOLLOWS_TIERS: readonly WardenTier[] = [
  {
    id: 'arrived',
    label: 'Just arrived',
    level: 22,
    nodes: 8,
    quality: 1.12,
    modifiers: HOLLOWS_BASE_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'healing-draught'],
  },
  {
    id: 'prepared',
    label: 'Well prepared',
    level: 24,
    nodes: 8,
    quality: 1.16,
    modifiers: HOLLOWS_PREPARED_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'],
    classModifiers: { cleric: { offHand: 'devout', accessory1: 'devout' } },
  },
  {
    id: 'over',
    label: 'Over-levelled',
    level: 27,
    nodes: 9,
    quality: 1.16,
    modifiers: HOLLOWS_PREPARED_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'],
    classModifiers: { cleric: { offHand: 'devout', accessory1: 'devout' } },
  },
]

export type HollowsFight = {
  id: string
  enemies: CombatSetup['enemies']
  /** Fights with a telegraph or interruptible wind-up also run without the hero's telegraph rows. */
  blind: boolean
}

export const HOLLOWS_FIGHTS: readonly HollowsFight[] = [
  { id: 'shade', enemies: [{ defId: 'rift-shade', slot: 0, level: 24 }], blind: false },
  { id: 'brute', enemies: [{ defId: 'riftborn-brute', slot: 0, level: 23 }], blind: true },
  { id: 'channeler', enemies: [{ defId: 'hollow-channeler', slot: 0, level: 24 }], blind: false },
  {
    id: 'shade-pair',
    enemies: [
      { defId: 'rift-shade', slot: 0, level: 22 },
      { defId: 'rift-shade', slot: 1, level: 22 },
    ],
    blind: false,
  },
  {
    id: 'hollows-mixed',
    enemies: [
      { defId: 'riftborn-brute', slot: 0, level: 23 },
      { defId: 'hollow-channeler', slot: 1, level: 23 },
    ],
    blind: false,
  },
  {
    id: 'hollows-deep',
    enemies: [
      { defId: 'rift-shade', slot: 0, level: 25 },
      { defId: 'riftborn-brute', slot: 1, level: 25 },
      { defId: 'hollow-channeler', slot: 2, level: 25 },
    ],
    blind: false,
  },
  { id: 'reaver', enemies: [{ defId: 'hollowmaw-reaver', slot: 0, level: 26 }], blind: true },
]

export const HOLLOWS_MODES = ['rules', 'blind'] as const
export type HollowsMode = (typeof HOLLOWS_MODES)[number]

export type HollowsRow = {
  classId: HeroClass
  tier: string
  fight: string
  mode: HollowsMode
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
  /** Median fight time over every run in ms, wins and losses alike. */
  medianMs: number
}

/** The fight for a class at a tier: the Warden-style hero against the fight's enemies. */
export function hollowsSetup(classId: HeroClass, tier: WardenTier, fight: HollowsFight, mode: HollowsMode = 'rules'): CombatSetup {
  const base = { ...wardenSetup(classId, tier), enemies: fight.enemies }
  return mode === 'blind' ? blindSetup(base) : base
}

/** Every class at every tier against every Hollows fight, with and without telegraph rules where they matter. */
export function runHollowsMatrix(seed: number, runs: number): HollowsRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: HollowsRow[] = []
  for (const classId of HERO_CLASSES) {
    for (const tier of HOLLOWS_TIERS) {
      for (const fight of HOLLOWS_FIGHTS) {
        for (const mode of HOLLOWS_MODES) {
          if (mode === 'blind' && !fight.blind) continue
          const setup = hollowsSetup(classId, tier, fight, mode)
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
export function formatHollowsTable(rows: readonly HollowsRow[]): string {
  const lines: string[] = []
  for (const classId of HERO_CLASSES) {
    for (const tier of HOLLOWS_TIERS) {
      for (const mode of HOLLOWS_MODES) {
        const cells: string[] = []
        for (const fight of HOLLOWS_FIGHTS) {
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
