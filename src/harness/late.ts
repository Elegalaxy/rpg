import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { CINDER_FIGHTS, CINDER_TIERS, cinderSetup, notonicVariant } from './cinder.ts'
import { WARDEN_TIERS, wardenSetup, type WardenTier } from './warden.ts'

/**
 * Late modifiers (Step 14.3). One modifier is swapped into the Prepared tier of the Cinder Scar (Tyrant fight, rules) or of the
 * Warden harness, and the win rate is read against the unchanged tier. The harness skips the level gate, as `modifierEquipment`
 * does for every tier. Measurements only: these variants are not part of the WARDEN or CINDER variant lists.
 */
export type LateZone = 'tyrant' | 'warden'

export type LateVariant = {
  id: string
  zone: LateZone
  /** The tier this variant changes. */
  tier: WardenTier
  /** The variant id it is measured against. */
  baseline: string
  /** Recorded in the table but not part of the acceptance numbers. */
  recordOnly?: boolean
}

const cinderPrepared = (): WardenTier => CINDER_TIERS.find((tier) => tier.id === 'prepared')!
const wardenPrepared = (): WardenTier => WARDEN_TIERS.find((tier) => tier.id === 'prepared')!

function swapped(tier: WardenTier, id: string, modifiers: Partial<WardenTier['modifiers']>): WardenTier {
  return { ...tier, id, label: `${tier.label}, ${id}`, modifiers: { ...tier.modifiers, ...modifiers } }
}

export const LATE_BASELINES: { readonly [zone in LateZone]: WardenTier } = {
  tyrant: { ...cinderPrepared(), id: 'cinder-prepared' },
  warden: { ...wardenPrepared(), id: 'warden-prepared' },
}

export const LATE_VARIANTS: readonly LateVariant[] = [
  { id: 'cinder-ironbound', zone: 'tyrant', baseline: 'cinder-prepared', tier: swapped(cinderPrepared(), 'cinder-ironbound', { head: 'ironbound', chest: 'ironbound' }) },
  { id: 'cinder-ruthless', zone: 'tyrant', baseline: 'cinder-prepared', tier: swapped(cinderPrepared(), 'cinder-ruthless', { accessory0: 'ruthless' }) },
  { id: 'cinder-swift', zone: 'tyrant', baseline: 'cinder-prepared', tier: swapped(cinderPrepared(), 'cinder-swift', { accessory1: 'swift' }) },
  { id: 'cinder-tempered-acc', zone: 'tyrant', baseline: 'cinder-prepared', tier: swapped(cinderPrepared(), 'cinder-tempered-acc', { accessory1: 'tempered' }) },
  { id: 'cinder-tempered-weapon', zone: 'tyrant', baseline: 'cinder-prepared', tier: swapped(cinderPrepared(), 'cinder-tempered-weapon', { mainHand: 'tempered' }), recordOnly: true },
  /** The Burn check (Step 14.3): prepared minus this row is the Warming Tonic's value against the Tyrant. */
  { id: 'cinder-notonic', zone: 'tyrant', baseline: 'cinder-prepared', tier: { ...notonicVariant(cinderPrepared()), id: 'cinder-notonic' }, recordOnly: true },
  { id: 'warden-staunch', zone: 'warden', baseline: 'warden-prepared', tier: swapped(wardenPrepared(), 'warden-staunch', { hands: 'staunch', feet: 'staunch' }) },
]

export type LateRow = {
  classId: HeroClass
  id: string
  zone: LateZone
  baseline: string
  recordOnly: boolean
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
}

export function lateSetup(classId: HeroClass, zone: LateZone, tier: WardenTier): CombatSetup {
  if (zone === 'warden') return wardenSetup(classId, tier)
  const tyrant = CINDER_FIGHTS.find((fight) => fight.id === 'tyrant')!
  return cinderSetup(classId, tier, tyrant, 'rules')
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

/** Every class at each baseline and each variant. */
export function runLateMatrix(seed: number, runs: number, classes: readonly HeroClass[] = HERO_CLASSES): LateRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const rows: LateRow[] = []
  for (const classId of classes) {
    for (const zone of ['tyrant', 'warden'] as const) {
      const baseline = LATE_BASELINES[zone]
      rows.push({ classId, id: baseline.id, zone, baseline: baseline.id, recordOnly: false, ...measure(lateSetup(classId, zone, baseline), seed, runs) })
    }
    for (const variant of LATE_VARIANTS) {
      rows.push({
        classId,
        id: variant.id,
        zone: variant.zone,
        baseline: variant.baseline,
        recordOnly: variant.recordOnly === true,
        ...measure(lateSetup(classId, variant.zone, variant.tier), seed, runs),
      })
    }
  }
  return rows
}

/** One line per variant: wins per class, then the difference to its baseline in win points. */
export function formatLateTable(rows: readonly LateRow[]): string {
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
