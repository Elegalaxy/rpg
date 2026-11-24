import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { CINDER_PREPARED_MODIFIERS } from './cinder.ts'
import { blindSetup } from './telegraph.ts'
import { wardenSetup, type WardenTier } from './warden.ts'

/**
 * Realistic heroes at the Bloodthorn Barrens (Step 14.5 part 3). Same construction as the Cinder Scar tiers (reference
 * attributes, crafted gear at item level equal to hero level, one modifier per piece, the class reference rules behind
 * the starting supply rules), at the zone's levels. Measurements only.
 */
const CLERIC_MODIFIERS: WardenTier['classModifiers'] = { cleric: { offHand: 'kindled', accessory1: 'devout' } }

/** The Cinder prepared set (Emberward on hands and feet) with the Cleric on Kindled and Devout. */
const BARRENS_ARRIVED_MODIFIERS: WardenTier['modifiers'] = CINDER_PREPARED_MODIFIERS

/** The Arrived set with Staunch replacing Emberward on hands and feet. */
export const BARRENS_PREPARED_MODIFIERS: WardenTier['modifiers'] = {
  ...BARRENS_ARRIVED_MODIFIERS,
  hands: 'staunch',
  feet: 'staunch',
}

const PREPARED_SUPPLIES = ['healing-draught', 'healing-draught', 'antidote', 'ward-charm'] as const

export const BARRENS_TIERS: readonly WardenTier[] = [
  {
    id: 'arrived',
    label: 'Just arrived',
    level: 34,
    nodes: 11,
    quality: 1.2,
    burnRow: false,
    bleedRow: true,
    modifiers: BARRENS_ARRIVED_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'healing-draught'],
    classModifiers: CLERIC_MODIFIERS,
  },
  {
    id: 'prepared',
    label: 'Well prepared',
    level: 36,
    nodes: 12,
    quality: 1.24,
    burnRow: false,
    bleedRow: true,
    modifiers: BARRENS_PREPARED_MODIFIERS,
    supplies: PREPARED_SUPPLIES,
    classModifiers: CLERIC_MODIFIERS,
  },
  {
    id: 'over',
    label: 'Over-levelled',
    level: 39,
    nodes: 12,
    quality: 1.24,
    burnRow: false,
    bleedRow: true,
    modifiers: BARRENS_PREPARED_MODIFIERS,
    supplies: PREPARED_SUPPLIES,
    classModifiers: CLERIC_MODIFIERS,
  },
]

/** The prepared tier with Nimble back on hands and feet in place of Staunch (the Staunch check, Step 14.5). */
export function nostaunchVariant(tier: WardenTier): WardenTier {
  return {
    ...tier,
    id: `${tier.id}-nostaunch`,
    label: `${tier.label}, no Staunch`,
    modifiers: { ...tier.modifiers, hands: 'nimble', feet: 'nimble' },
  }
}

/** The prepared tier with the Antidote swapped for a Healing Draught (recorded only). */
export function noantidoteVariant(tier: WardenTier): WardenTier {
  return {
    ...tier,
    id: `${tier.id}-noantidote`,
    label: `${tier.label}, no Antidote`,
    supplies: tier.supplies.map((id) => (id === 'antidote' ? 'healing-draught' : id)),
  }
}

const preparedTier = (): WardenTier => BARRENS_TIERS.find((tier) => tier.id === 'prepared')!

/** Measured beside the tiers, never instead of them. */
export const BARRENS_VARIANTS: readonly WardenTier[] = [nostaunchVariant(preparedTier()), noantidoteVariant(preparedTier())]

export const BARRENS_TIER_IDS: readonly string[] = [...BARRENS_TIERS, ...BARRENS_VARIANTS].map((tier) => tier.id)

export type BarrensFight = {
  id: string
  enemies: CombatSetup['enemies']
  /** Fights with a telegraph or interruptible wind-up also run without the hero's telegraph rows. */
  blind: boolean
}

export const BARRENS_FIGHTS: readonly BarrensFight[] = [
  { id: 'stalker', enemies: [{ defId: 'barbed-stalker', slot: 0, level: 36 }], blind: false },
  { id: 'crawler', enemies: [{ defId: 'venomhide-crawler', slot: 0, level: 37 }], blind: true },
  { id: 'thornwitch', enemies: [{ defId: 'thornwitch', slot: 0, level: 36 }], blind: false },
  {
    id: 'stalker-pair',
    enemies: [
      { defId: 'barbed-stalker', slot: 0, level: 34 },
      { defId: 'barbed-stalker', slot: 1, level: 34 },
    ],
    blind: false,
  },
  {
    id: 'barrens-mixed',
    enemies: [
      { defId: 'venomhide-crawler', slot: 0, level: 35 },
      { defId: 'thornwitch', slot: 1, level: 35 },
    ],
    blind: false,
  },
  {
    id: 'barrens-deep',
    enemies: [
      { defId: 'barbed-stalker', slot: 0, level: 37 },
      { defId: 'venomhide-crawler', slot: 1, level: 37 },
      { defId: 'thornwitch', slot: 2, level: 37 },
    ],
    blind: false,
  },
  { id: 'matriarch', enemies: [{ defId: 'briar-matriarch', slot: 0, level: 38 }], blind: true },
]

export const BARRENS_FIGHT_IDS: readonly string[] = BARRENS_FIGHTS.map((fight) => fight.id)

export const BARRENS_MODES = ['rules', 'blind'] as const
export type BarrensMode = (typeof BARRENS_MODES)[number]

export type BarrensRow = {
  classId: HeroClass
  tier: string
  fight: string
  mode: BarrensMode
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
  /** Median fight time over every run in ms, wins and losses alike. */
  medianMs: number
}

/** The fight for a class at a tier: the Warden-style hero against the fight's enemies. */
export function barrensSetup(classId: HeroClass, tier: WardenTier, fight: BarrensFight, mode: BarrensMode = 'rules'): CombatSetup {
  const base = { ...wardenSetup(classId, tier), enemies: fight.enemies }
  return mode === 'blind' ? blindSetup(base) : base
}

export type BarrensFilter = {
  classes?: readonly HeroClass[]
  tiers?: readonly string[]
  fights?: readonly string[]
  modes?: readonly BarrensMode[]
}

/** Every class at every tier (and the variants) against every Barrens fight, with and without telegraph rules where they matter. */
export function runBarrensMatrix(seed: number, runs: number, filter: BarrensFilter = {}): BarrensRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: BarrensRow[] = []
  for (const classId of HERO_CLASSES) {
    if (filter.classes !== undefined && !filter.classes.includes(classId)) continue
    for (const tier of [...BARRENS_TIERS, ...BARRENS_VARIANTS]) {
      if (filter.tiers !== undefined && !filter.tiers.includes(tier.id)) continue
      for (const fight of BARRENS_FIGHTS) {
        if (filter.fights !== undefined && !filter.fights.includes(fight.id)) continue
        for (const mode of BARRENS_MODES) {
          if (mode === 'blind' && !fight.blind) continue
          if (filter.modes !== undefined && !filter.modes.includes(mode)) continue
          const setup = barrensSetup(classId, tier, fight, mode)
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
export function formatBarrensTable(rows: readonly BarrensRow[]): string {
  const lines: string[] = []
  for (const classId of HERO_CLASSES) {
    for (const tier of BARRENS_TIER_IDS) {
      for (const mode of BARRENS_MODES) {
        const cells: string[] = []
        for (const fight of BARRENS_FIGHTS) {
          const row = rows.find((entry) => entry.classId === classId && entry.tier === tier && entry.mode === mode && entry.fight === fight.id)
          if (row === undefined) continue
          cells.push(`${fight.id} ${Math.round(row.winRate * 100)}% (lost ${Math.round(row.hpLost * 100)}%, ${(row.medianMs / 1000).toFixed(0)}s)`)
        }
        if (cells.length === 0) continue
        lines.push(`${classId} ${tier} ${mode}: ${cells.join(' | ')}`)
      }
    }
  }
  return `${lines.join('\n')}\n`
}
