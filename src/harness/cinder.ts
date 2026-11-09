import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { ITEM_MODIFIERS, type EquipmentSlotId, type StatBonuses } from '../sim/economy.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { HOLLOWS_TIERS } from './hollows.ts'
import { blindSetup } from './telegraph.ts'
import { PREPARED_MODIFIERS, wardenSetup, type WardenTier } from './warden.ts'

/**
 * Realistic heroes at the Cinder Scar (Step 13.6 part 3). Same construction as the Hollows tiers (reference
 * attributes, crafted gear at item level equal to hero level, one modifier per piece, the class reference rules
 * behind the starting supply rules), at the zone's levels. Measurements only.
 */
const hollowsPrepared = (): WardenTier => HOLLOWS_TIERS.find((tier) => tier.id === 'prepared')!

/** The Hollows prepared set with Bloodbound on the weapon (the Reaver's modifier). */
const CINDER_ARRIVED_MODIFIERS: WardenTier['modifiers'] = { ...hollowsPrepared().modifiers, mainHand: 'bloodbound' }

/**
 * Emberward on head, chest and one accessory, Tempered on the weapon (GAME_DESIGN, harness tiers). The same
 * modifier counts at most twice, so the accessory Emberward is worn but does not count.
 */
const CINDER_PREPARED_MODIFIERS: WardenTier['modifiers'] = {
  ...PREPARED_MODIFIERS,
  mainHand: 'tempered',
  head: 'emberward',
  chest: 'emberward',
  accessory0: 'emberward',
  accessory1: 'quick',
}

const PREPARED_SUPPLIES = ['healing-draught', 'healing-draught', 'warming-tonic', 'ward-charm'] as const

export const CINDER_TIERS: readonly WardenTier[] = [
  {
    id: 'arrived',
    label: 'Just arrived',
    level: 28,
    nodes: 9,
    quality: 1.16,
    modifiers: CINDER_ARRIVED_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'healing-draught'],
    classModifiers: { cleric: { offHand: 'devout', accessory1: 'devout' } },
  },
  {
    id: 'prepared',
    label: 'Well prepared',
    level: 30,
    nodes: 10,
    quality: 1.2,
    modifiers: CINDER_PREPARED_MODIFIERS,
    supplies: PREPARED_SUPPLIES,
    classModifiers: { cleric: { offHand: 'kindled' } },
  },
  {
    id: 'over',
    label: 'Over-levelled',
    level: 33,
    nodes: 11,
    quality: 1.2,
    modifiers: CINDER_PREPARED_MODIFIERS,
    supplies: PREPARED_SUPPLIES,
    classModifiers: { cleric: { offHand: 'kindled' } },
  },
]

/** The prepared tier with the Warming Tonic swapped for a Healing Draught (the Burn check, Step 13.6). */
export function notonicVariant(tier: WardenTier): WardenTier {
  return {
    ...tier,
    id: `${tier.id}-notonic`,
    label: `${tier.label}, no Warming Tonic`,
    supplies: tier.supplies.map((id) => (id === 'warming-tonic' ? 'healing-draught' : id)),
  }
}

const preparedTier = (): WardenTier => CINDER_TIERS.find((tier) => tier.id === 'prepared')!

/** Measured beside the tiers, never instead of them. */
export const CINDER_VARIANTS: readonly WardenTier[] = [notonicVariant(preparedTier())]

/**
 * Bonuses of the Cinder Scar modifiers while they are not yet in `ITEM_MODIFIERS` (part 6). Once an id is defined
 * there, that definition is used and this entry is ignored. Emberward has no stat before part 6 and counts as nothing.
 */
const PENDING_BONUSES: { readonly [id: string]: StatBonuses } = {
  emberward: {},
  tempered: { armorPenetrationBonus: 0.04, magicalPenetrationBonus: 0.04, critChanceBonus: 0.02 },
  kindled: { maxHpBonus: 0.05, equipmentHealingPower: 8 },
}

const MODIFIER_STACK = 2

function pendingBonuses(modifiers: WardenTier['modifiers']): StatBonuses {
  const total: { [key in keyof StatBonuses]: number } = {}
  const seen: { [id: string]: number } = {}
  for (const slot of Object.keys(modifiers) as EquipmentSlotId[]) {
    const id = modifiers[slot]
    if (id === null || ITEM_MODIFIERS[id] !== undefined) continue
    const pending = PENDING_BONUSES[id]
    if (pending === undefined) continue
    seen[id] = (seen[id] ?? 0) + 1
    if (seen[id] > MODIFIER_STACK) continue
    for (const key of Object.keys(pending) as (keyof StatBonuses)[]) total[key] = (total[key] ?? 0) + (pending[key] ?? 0)
  }
  return total
}

export type CinderFight = {
  id: string
  enemies: CombatSetup['enemies']
  /** Fights with a telegraph or interruptible wind-up also run without the hero's telegraph rows. */
  blind: boolean
}

export const CINDER_FIGHTS: readonly CinderFight[] = [
  { id: 'imp', enemies: [{ defId: 'cinder-imp', slot: 0, level: 30 }], blind: false },
  { id: 'golem', enemies: [{ defId: 'slag-golem', slot: 0, level: 31 }], blind: true },
  { id: 'acolyte', enemies: [{ defId: 'pyre-acolyte', slot: 0, level: 30 }], blind: false },
  {
    id: 'imp-swarm',
    enemies: [
      { defId: 'cinder-imp', slot: 0, level: 28 },
      { defId: 'cinder-imp', slot: 1, level: 28 },
      { defId: 'cinder-imp', slot: 2, level: 28 },
    ],
    blind: false,
  },
  {
    id: 'cinder-mixed',
    enemies: [
      { defId: 'slag-golem', slot: 0, level: 29 },
      { defId: 'pyre-acolyte', slot: 1, level: 29 },
    ],
    blind: false,
  },
  {
    id: 'cinder-deep',
    enemies: [
      { defId: 'cinder-imp', slot: 0, level: 31 },
      { defId: 'slag-golem', slot: 1, level: 31 },
      { defId: 'pyre-acolyte', slot: 2, level: 31 },
    ],
    blind: false,
  },
  { id: 'tyrant', enemies: [{ defId: 'emberwrought-tyrant', slot: 0, level: 32 }], blind: true },
]

export const CINDER_MODES = ['rules', 'blind'] as const
export type CinderMode = (typeof CINDER_MODES)[number]

export type CinderRow = {
  classId: HeroClass
  tier: string
  fight: string
  mode: CinderMode
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
  /** Median fight time over every run in ms, wins and losses alike. */
  medianMs: number
}

/** A class at a Cinder Scar tier, with the tier's modifier bonuses (and pending ones before part 6), against the Warden-style default enemies. */
export function cinderTierSetup(classId: HeroClass, tier: WardenTier): CombatSetup {
  const warden = wardenSetup(classId, tier)
  const merged: { [key in keyof StatBonuses]: number } = { ...(warden.hero.statBonuses ?? {}) }
  const extra = pendingBonuses({ ...tier.modifiers, ...(tier.classModifiers?.[classId] ?? {}) })
  for (const key of Object.keys(extra) as (keyof StatBonuses)[]) merged[key] = (merged[key] ?? 0) + (extra[key] ?? 0)
  return { ...warden, hero: { ...warden.hero, statBonuses: merged } }
}

/** The fight for a class at a tier: the Warden-style hero against the fight's enemies. */
export function cinderSetup(classId: HeroClass, tier: WardenTier, fight: CinderFight, mode: CinderMode = 'rules'): CombatSetup {
  const base = { ...cinderTierSetup(classId, tier), enemies: fight.enemies }
  return mode === 'blind' ? blindSetup(base) : base
}

/** Every class at every tier (and the no-Tonic variant) against every Cinder Scar fight, with and without telegraph rules where they matter. */
export function runCinderMatrix(seed: number, runs: number): CinderRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: CinderRow[] = []
  for (const classId of HERO_CLASSES) {
    for (const tier of [...CINDER_TIERS, ...CINDER_VARIANTS]) {
      for (const fight of CINDER_FIGHTS) {
        for (const mode of CINDER_MODES) {
          if (mode === 'blind' && !fight.blind) continue
          const setup = cinderSetup(classId, tier, fight, mode)
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
export function formatCinderTable(rows: readonly CinderRow[]): string {
  const lines: string[] = []
  const tierIds = [...CINDER_TIERS, ...CINDER_VARIANTS].map((tier) => tier.id)
  for (const classId of HERO_CLASSES) {
    for (const tier of tierIds) {
      for (const mode of CINDER_MODES) {
        const cells: string[] = []
        for (const fight of CINDER_FIGHTS) {
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
