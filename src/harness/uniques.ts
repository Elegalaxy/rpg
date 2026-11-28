import { itemBase } from '../content/items.ts'
import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { addStatBonuses, implicitBonuses, type ItemInstance, type StatBonuses } from '../sim/economy.ts'
import { deriveSeed } from '../sim/rng.ts'
import { UNIQUE_ITEMS, uniqueDef, uniqueSignature } from '../sim/uniques.ts'
import type { CombatSetup } from '../sim/types.ts'

import { BARRENS_FIGHTS, BARRENS_TIERS, barrensSetup } from './barrens.ts'
import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { CINDER_FIGHTS, CINDER_TIERS, cinderSetup } from './cinder.ts'
import { HOLLOWS_FIGHTS, HOLLOWS_TIERS, hollowsSetup } from './hollows.ts'
import { WARDEN_TIERS, wardenSetup, type WardenTier } from './warden.ts'

/**
 * Elite uniques (Step 14.6). A hero wears the named uniques on top of a zone's prepared tier: each unique's fixed modifier replaces
 * the tier's modifier in its slot (an accessory in accessory1) and its signature is added to the stat bonuses at the tier's level
 * (the item level follows the hero, so a unique above the tier level is scaled down). The Matriarch's Talisman adds its implicit too, except in the
 * signature-only cells, which measure the signature alone (decision 2026-11-28).
 * Every cell is read against the unchanged prepared tier of its zone. Measurements only.
 *
 * Gates (decision 2026-11-25) apply at a unique's own zone tier and later. At the level 20 Warden tier a later-zone unique is
 * gated on its signature-only cell, and every Warden cell that carries a later-zone fixed modifier is record only.
 */
export type UniqueZone = 'warden' | 'reaver' | 'tyrant' | 'matriarch'

export type UniqueVariant = {
  id: string
  zone: UniqueZone
  /** The baseline id this variant is measured against. */
  baseline: string
  /** The unique ids worn together. */
  uniques: readonly string[]
  /** Recorded in the table but not part of the acceptance numbers. */
  recordOnly: boolean
  /** The signature of a unique is multiplied by this (the halving fallback). 1 is the table value. */
  signatureFactor?: number
  /** Diagnostics: only the signature (the tier's modifiers stay) or only the fixed modifiers (no signature). Absent means both, as worn. */
  part?: UniquePart
}

export type UniquePart = 'signature' | 'modifier'

const wardenPrepared = (): WardenTier => WARDEN_TIERS.find((tier) => tier.id === 'prepared')!
const hollowsPrepared = (): WardenTier => HOLLOWS_TIERS.find((tier) => tier.id === 'prepared')!
const cinderPrepared = (): WardenTier => CINDER_TIERS.find((tier) => tier.id === 'prepared')!
const barrensPrepared = (): WardenTier => BARRENS_TIERS.find((tier) => tier.id === 'prepared')!

/** The prepared tier of each zone, which is the baseline of its cells. */
export const UNIQUE_BASELINE_TIERS: { readonly [zone in UniqueZone]: () => WardenTier } = {
  warden: wardenPrepared,
  reaver: hollowsPrepared,
  tyrant: cinderPrepared,
  matriarch: barrensPrepared,
}

export const UNIQUE_BASELINE_IDS: { readonly [zone in UniqueZone]: string } = {
  warden: 'warden-prepared',
  reaver: 'reaver-prepared',
  tyrant: 'tyrant-prepared',
  matriarch: 'matriarch-prepared',
}

const ALL_IDS: readonly string[] = UNIQUE_ITEMS.map((def) => def.id)
const ID_BY_ENEMY = (enemyId: string): string => UNIQUE_ITEMS.find((def) => def.enemyId === enemyId)!.id

const variant = (id: string, zone: UniqueZone, uniques: readonly string[], recordOnly = false, part?: UniquePart): UniqueVariant => ({
  id,
  zone,
  baseline: UNIQUE_BASELINE_IDS[zone],
  uniques,
  recordOnly,
  ...(part === undefined ? {} : { part }),
})

const COLOSSUS = ID_BY_ENEMY('tidebound-colossus')
const REAVER = ID_BY_ENEMY('hollowmaw-reaver')
const TYRANT = ID_BY_ENEMY('emberwrought-tyrant')
const MATRIARCH = ID_BY_ENEMY('briar-matriarch')

/** The cells that also get a signature-only and a modifier-only split. */
const SPLIT_CELLS: readonly { id: string; zone: UniqueZone; uniques: readonly string[] }[] = [
  { id: 'warden-colossus', zone: 'warden', uniques: [COLOSSUS] },
  { id: 'warden-reaver', zone: 'warden', uniques: [REAVER] },
  { id: 'warden-tyrant', zone: 'warden', uniques: [TYRANT] },
  { id: 'warden-matriarch', zone: 'warden', uniques: [MATRIARCH] },
  { id: 'warden-u-all', zone: 'warden', uniques: ALL_IDS },
  { id: 'reaver-colossus', zone: 'reaver', uniques: [COLOSSUS] },
  { id: 'tyrant-reaver', zone: 'tyrant', uniques: [REAVER] },
]

/** The split cells whose signature-only half is gated: the later-zone uniques at the Warden tier. */
const GATED_SIGNATURE_CELLS: readonly string[] = ['warden-colossus', 'warden-reaver', 'warden-tyrant', 'warden-matriarch']

/** The cells. A gated cell is one that is not record only. */
export const UNIQUE_VARIANTS: readonly UniqueVariant[] = [
  variant('warden-rootmaw', 'warden', [ID_BY_ENEMY('rootmaw-stalker')]),
  variant('warden-echo', 'warden', [ID_BY_ENEMY('echo-knight')]),
  variant('warden-colossus', 'warden', [COLOSSUS], true),
  variant('warden-reaver', 'warden', [REAVER], true),
  variant('warden-tyrant', 'warden', [TYRANT], true),
  variant('warden-matriarch', 'warden', [MATRIARCH], true),
  variant('warden-u-all', 'warden', ALL_IDS, true),
  variant('reaver-colossus', 'reaver', [COLOSSUS]),
  variant('tyrant-reaver', 'tyrant', [REAVER]),
  variant('tyrant-u-all', 'tyrant', ALL_IDS, true),
  variant('matriarch-tyrant', 'matriarch', [TYRANT], true),
  variant('matriarch-u-all', 'matriarch', ALL_IDS, true),
  // The same cells with only the signature (gated at the Warden for later-zone uniques), and with only the fixed modifiers.
  ...SPLIT_CELLS.flatMap((cell) => [
    variant(`${cell.id}-sig`, cell.zone, cell.uniques, !GATED_SIGNATURE_CELLS.includes(cell.id), 'signature'),
    variant(`${cell.id}-mod`, cell.zone, cell.uniques, true, 'modifier'),
  ]),
]

export type UniqueRow = {
  classId: HeroClass
  id: string
  zone: UniqueZone
  baseline: string
  recordOnly: boolean
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
}

/** Every id the table can show: the four baselines and each variant. */
export const UNIQUE_MATRIX_IDS: readonly string[] = [...Object.values(UNIQUE_BASELINE_IDS), ...UNIQUE_VARIANTS.map((entry) => entry.id)]

/** The slot a unique's fixed modifier replaces in a tier (accessories go in accessory1). */
function tierSlot(slot: string): 'mainHand' | 'offHand' | 'head' | 'chest' | 'hands' | 'feet' | 'accessory1' {
  return slot === 'accessory' ? 'accessory1' : (slot as 'mainHand' | 'offHand' | 'head' | 'chest' | 'hands' | 'feet')
}

/** The unique as a worn item at the hero's level: the item level follows the hero (heirloom scaling), so the signature shrinks above the level. */
function wornAt(uniqueId: string, level: number): ItemInstance {
  const def = uniqueDef(uniqueId)!
  return {
    id: `u-${uniqueId}`,
    baseId: def.baseId ?? 'x',
    itemLevel: level,
    quality: 1.1,
    durability: 100,
    maxDurability: 100,
    modifiers: [def.modifier],
    uniqueId,
  }
}

function halved(bonuses: StatBonuses, factor: number): StatBonuses {
  if (factor === 1) return bonuses
  const out: { [key in keyof StatBonuses]: number } = {}
  for (const key of Object.keys(bonuses) as (keyof StatBonuses)[]) {
    const value = (bonuses[key] ?? 0) * factor
    out[key] = Math.round(value * 10_000) / 10_000
  }
  return out
}

/** The prepared tier with the uniques' fixed modifiers swapped in. */
export function uniqueTier(zone: UniqueZone, uniqueIds: readonly string[], id: string): WardenTier {
  const tier = UNIQUE_BASELINE_TIERS[zone]()
  const modifiers = { ...tier.modifiers }
  for (const uniqueId of uniqueIds) {
    const def = uniqueDef(uniqueId)!
    modifiers[tierSlot(def.slot)] = def.modifier
  }
  return { ...tier, id, label: `${tier.label}, ${id}`, modifiers }
}

/** The signature bonuses of the uniques worn at a level, plus the Talisman implicit for the Matriarch unique unless `implicit` is false. */
export function uniqueBonuses(uniqueIds: readonly string[], level: number, factor = 1, implicit = true): StatBonuses {
  let total: StatBonuses = {}
  for (const uniqueId of uniqueIds) {
    const item = wornAt(uniqueId, level)
    total = addStatBonuses(total, halved(uniqueSignature(item), factor))
    const base = uniqueDef(uniqueId)?.baseId
    if (implicit && base !== undefined) total = addStatBonuses(total, implicitBonuses(itemBase(base), level))
  }
  return total
}

/** The fight of a zone for a class, with the uniques worn. An empty list is the plain prepared tier. */
export function uniqueSetup(classId: HeroClass, zone: UniqueZone, uniqueIds: readonly string[], id: string, factor = 1, part?: UniquePart): CombatSetup {
  const tier = uniqueIds.length === 0 || part === 'signature' ? { ...UNIQUE_BASELINE_TIERS[zone](), id } : uniqueTier(zone, uniqueIds, id)
  const setup =
    zone === 'warden'
      ? wardenSetup(classId, tier)
      : zone === 'reaver'
        ? hollowsSetup(classId, tier, HOLLOWS_FIGHTS.find((fight) => fight.id === 'reaver')!, 'rules')
        : zone === 'tyrant'
          ? cinderSetup(classId, tier, CINDER_FIGHTS.find((fight) => fight.id === 'tyrant')!, 'rules')
          : barrensSetup(classId, tier, BARRENS_FIGHTS.find((fight) => fight.id === 'matriarch')!, 'rules')
  if (uniqueIds.length === 0 || part === 'modifier') return setup
  return { ...setup, hero: { ...setup.hero, statBonuses: addStatBonuses(setup.hero.statBonuses ?? {}, uniqueBonuses(uniqueIds, tier.level, factor, part !== 'signature')) } }
}

function measure(setup: CombatSetup, seed: number, runs: number): { winRate: number; hpLost: number } {
  const defs = gameDefs()
  let wins = 0
  let lost = 0
  for (let index = 0; index < runs; index += 1) {
    const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
    if (state.outcome === 'victory') wins += 1
    lost += 1 - Math.max(0, state.hero.hp) / state.hero.maxHp
  }
  return { winRate: wins / runs, hpLost: lost / runs }
}

/**
 * Every class at each baseline and each variant. `only` limits the variants (the baselines of their zones always run) to those ids;
 * `factor` multiplies every signature (the halving fallback, 0.5).
 */
export function runUniquesMatrix(seed: number, runs: number, classes: readonly HeroClass[] = HERO_CLASSES, only?: readonly string[], factor = 1): UniqueRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const chosen = UNIQUE_VARIANTS.filter((entry) => only === undefined || only.includes(entry.id))
  const zones = (Object.keys(UNIQUE_BASELINE_IDS) as UniqueZone[]).filter((zone) => only === undefined || chosen.some((entry) => entry.zone === zone))
  const rows: UniqueRow[] = []
  for (const classId of classes) {
    for (const zone of zones) {
      const id = UNIQUE_BASELINE_IDS[zone]
      rows.push({ classId, id, zone, baseline: id, recordOnly: false, ...measure(uniqueSetup(classId, zone, [], id), seed, runs) })
    }
    for (const entry of chosen) {
      rows.push({
        classId,
        id: entry.id,
        zone: entry.zone,
        baseline: entry.baseline,
        recordOnly: entry.recordOnly,
        ...measure(uniqueSetup(classId, entry.zone, entry.uniques, entry.id, entry.signatureFactor ?? factor, entry.part), seed, runs),
      })
    }
  }
  return rows
}

/** One line per cell: wins per class, then the difference to its baseline in win points. */
export function formatUniquesTable(rows: readonly UniqueRow[]): string {
  const lines: string[] = []
  const ids = [...new Set(rows.map((row) => row.id))]
  for (const id of ids) {
    const cells: string[] = []
    const diffs: string[] = []
    for (const classId of HERO_CLASSES) {
      const row = rows.find((entry) => entry.classId === classId && entry.id === id)
      if (row === undefined) continue
      const base = rows.find((entry) => entry.classId === classId && entry.id === row.baseline)
      cells.push(`${classId} ${Math.round(row.winRate * 100)}% (lost ${Math.round(row.hpLost * 100)}%)`)
      if (base !== undefined && base.id !== row.id) {
        const diff = Math.round((row.winRate - base.winRate) * 100)
        diffs.push(`${classId} ${diff > 0 ? '+' : ''}${diff}`)
      }
    }
    const first = rows.find((entry) => entry.id === id)
    const note = first?.recordOnly === true ? ' (record only)' : ''
    lines.push(`${id}${note} ${first?.zone ?? ''}: ${cells.join(' | ')}`)
    if (diffs.length > 0) lines.push(`${id} minus ${first?.baseline ?? ''}: ${diffs.join(' | ')}`)
  }
  return `${lines.join('\n')}\n`
}
