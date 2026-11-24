import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { gameDefs, referenceLoadoutFor } from '../content/scenarios.ts'
import type { GameDefs, PriorityRow, SkillDef, CombatSetup } from '../sim/types.ts'

import { builtSetup } from './builds.ts'
import { CLASSIC_ELITE_IDS, ELITE_CELLS, type EliteId } from './elites.ts'
import { SWAP_OUT, measureSlot, placeRows, slotSetup, type SlotTier } from './slots.ts'

/**
 * The Ranger fifth skill measurement (Step 13.35, GAME_DESIGN section 10 "Ranger fifth skill"). The Ranger gains nothing from
 * the fifth slot because Readiness only comes from hit basic attacks and the reference rows already spend it. This tries a
 * redesigned Hunter's Mark and Flame Arrow (patched copies of the skill definitions, harness only; `gameDefs()` is never
 * mutated) and three probes with unchanged content. Measurements only; nothing here changes the game.
 *
 * Shard runner: `npx tsx src/harness/slotsRanger.ts shard <config> <seed> <runs> <prepared|prepared-crafted|side> <out.json>`.
 * Merge: `npx tsx src/harness/slotsRanger.ts report <dir>`. Config ids: `four:<skill>`, `<variant>:<first|last>:<five|swap>`
 * and, with the tier `side`, `side:<variant>:<first|last>`.
 */
export type Placement = 'first' | 'last'
export type RangerShape = 'four' | 'five' | 'swap'

export type RangerVariant = {
  id: string
  /** The skill the variant equips (Snare Trap for its probe: already equipped, so it adds only a row). */
  skillId: string
  /** The patched skill definition, or undefined for a probe with unchanged content. */
  patch?: (def: SkillDef) => SkillDef
  rows: readonly PriorityRow[]
}

const readiness = (operator: 'atLeast' | 'atMost', value: number) => ({ kind: 'classResource' as const, operator, value })
const burnAbsent = { kind: 'status' as const, who: 'target' as const, statusId: 'burn', measure: 'presence' as const, operator: 'absent' as const }
const exposeAbsent = { kind: 'status' as const, who: 'target' as const, statusId: 'expose', measure: 'presence' as const, operator: 'absent' as const }
const ammo = { kind: 'specialAmmo' as const, operator: 'atLeast' as const, value: 1 }

/** Hunter's Mark as an Expose: tagged physical (the Expose resistance roll needs a school tag, and no `attack` tag), cooldown 8. Cost and action time are untouched (0 Readiness, 0.5x). */
const huntersMarkExpose = (extraReadiness: number) => (def: SkillDef): SkillDef => ({
  ...def,
  tags: ['mark', 'physical'],
  cooldownSeconds: 8,
  effects: [
    { kind: 'reveal' },
    { kind: 'applyStatus', statusId: 'expose', baseChance: 1, armorMagnitude: 0.3, resistanceMagnitude: 0.3 },
    ...(extraReadiness > 0 ? [{ kind: 'resource' as const, base: extraReadiness }] : []),
  ],
})

export const RANGER_VARIANTS: readonly RangerVariant[] = [
  { id: 'HM-X', skillId: 'hunters-mark', patch: huntersMarkExpose(0), rows: [{ skillId: 'hunters-mark', conditions: [exposeAbsent] }] },
  { id: 'HM-XR', skillId: 'hunters-mark', patch: huntersMarkExpose(10), rows: [{ skillId: 'hunters-mark', conditions: [exposeAbsent] }] },
  {
    id: 'HM-R',
    skillId: 'hunters-mark',
    patch: (def) => ({ ...def, cooldownSeconds: 8, effects: [{ kind: 'reveal' }, { kind: 'resource', base: 20 }] }),
    rows: [{ skillId: 'hunters-mark', conditions: [readiness('atMost', 60)] }],
  },
  { id: 'FA-0', skillId: 'flame-arrow', patch: (def) => ({ ...def, cost: 0 }), rows: [{ skillId: 'flame-arrow', conditions: [burnAbsent, ammo] }] },
  { id: 'P-snare', skillId: 'snare-trap', rows: [{ skillId: 'snare-trap', conditions: [{ kind: 'fightTime', operator: 'atMost', value: 1000 }] }] },
  {
    id: 'P-volley',
    skillId: 'volley',
    rows: [{ skillId: 'volley', conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 2 }, readiness('atLeast', 55)] }],
  },
  { id: 'P-flame', skillId: 'flame-arrow', rows: [{ skillId: 'flame-arrow', conditions: [readiness('atLeast', 90), burnAbsent, ammo] }] },
]

/** The skills a `four` baseline is built for (each holds its candidate's skill-web nodes, so the comparison is like for like). */
export const RANGER_FOUR_SKILLS = ['hunters-mark', 'flame-arrow', 'volley', 'snare-trap'] as const

export function rangerVariant(id: string): RangerVariant {
  const found = RANGER_VARIANTS.find((variant) => variant.id === id)
  if (found === undefined) throw new Error(`unknown Ranger variant '${id}'`)
  return found
}

/** A patched copy of `gameDefs()` for the variant; the real definitions and the variant's skill are never mutated. */
export function rangerDefs(variant: RangerVariant, base: GameDefs = gameDefs()): GameDefs {
  if (variant.patch === undefined) return base
  const original = base.skills[variant.skillId]
  if (original === undefined) throw new Error(`no skill '${variant.skillId}'`)
  return { ...base, skills: { ...base.skills, [variant.skillId]: variant.patch(original) } }
}

const cellFor = (elite: EliteId, tier: SlotTier) => ELITE_CELLS.find((entry) => entry.elite === elite && entry.tier === tier)!

/** The Ranger elite fight for a variant: the four-skill baseline, the fifth skill placed `first` or `last`, or the candidate swapped in for Snare Trap. Null if a row cap is passed. */
export function rangerSetup(variant: RangerVariant, elite: EliteId, tier: SlotTier, placement: Placement, shape: RangerShape): CombatSetup | null {
  const cell = cellFor(elite, tier)
  if (shape === 'four') return slotSetup('ranger', cell, variant.skillId, 'four')
  if (variant.id === 'P-snare') {
    // Snare Trap is already equipped with no row: only a row is added, so a swap is meaningless.
    if (shape === 'swap') throw new Error('the Snare Trap probe has no swap')
    const base = slotSetup('ranger', cell, variant.skillId, 'four')!
    const reference = referenceLoadoutFor('ranger').equippedSkillIds
    return { ...base, hero: { ...base.hero, priorityRows: placeRows(base.hero.priorityRows ?? [], variant.rows, placement, (id) => reference.includes(id)) } }
  }
  const slotVariant = shape === 'swap' ? 'swap' : placement === 'first' ? 'tuned-first' : 'tuned-last'
  return slotSetup('ranger', cell, variant.skillId, slotVariant, { rows: variant.rows, placement })
}

export type RangerCellRow = {
  config: string
  elite: string
  tier: string
  winRate: number
  hpLost: number
  medianWinMs: number | null
}

export type RangerShard = { config: string; seed: number; runs: number; tier: string; rows: RangerCellRow[] }

/** One shard: every elite of a tier for one config (`four:<skill>` or `<variant>:<placement>:<shape>`). */
export function runRangerShard(config: string, seed: number, runs: number, tier: SlotTier): RangerShard {
  const parts = config.split(':')
  const rows: RangerCellRow[] = []
  for (const elite of CLASSIC_ELITE_IDS) {
    let setup: CombatSetup | null
    let defs = gameDefs()
    if (parts[0] === 'four') {
      setup = rangerSetup({ id: 'four', skillId: parts[1]!, rows: [] }, elite, tier, 'last', 'four')
    } else {
      const variant = rangerVariant(parts[0]!)
      defs = rangerDefs(variant)
      setup = rangerSetup(variant, elite, tier, parts[1] as Placement, parts[2] as RangerShape)
    }
    if (setup === null) throw new Error(`${config} passes the row cap at ${elite}`)
    rows.push({ config, elite, tier, ...measureSlot(setup, defs, seed, runs) })
  }
  return { config, seed, runs, tier, rows }
}

export const SIDE_ENEMIES = ['rootmaw', 'echo-knight', 'warden'] as const

/** The built (nine-point) Ranger at the built fights: four skills with Snare Trap, or the variant swapped in for it. */
export function sideSetup(variant: RangerVariant, enemy: string, placement: Placement, swapped: boolean): CombatSetup {
  const base = builtSetup(`ref-ranger-${enemy}`, 'ranger', 9)
  if (!swapped) return base
  const out = SWAP_OUT.ranger!
  const reference = referenceLoadoutFor('ranger').equippedSkillIds
  const equipped = [...(base.hero.equippedSkillIds ?? []).filter((id) => id !== out), variant.skillId]
  return { ...base, hero: { ...base.hero, equippedSkillIds: equipped, priorityRows: placeRows(base.hero.priorityRows ?? [], variant.rows, placement, (id) => reference.includes(id)) } }
}

/** Side check shard: `four` (reference four) and `swap` (variant for Snare Trap) of the nine-point build at the three built fights. */
export function runSideShard(variantId: string, placement: Placement, seed: number, runs: number): RangerShard {
  const variant = rangerVariant(variantId)
  const rows: RangerCellRow[] = []
  for (const enemy of SIDE_ENEMIES) {
    rows.push({ config: 'side-four', elite: enemy, tier: 'side', ...measureSlot(sideSetup(variant, enemy, placement, false), gameDefs(), seed, runs) })
    rows.push({ config: `side-${variantId}:${placement}`, elite: enemy, tier: 'side', ...measureSlot(sideSetup(variant, enemy, placement, true), rangerDefs(variant), seed, runs) })
  }
  return { config: `side:${variantId}:${placement}`, seed, runs, tier: 'side', rows }
}

// ---- Merge and verdict ----

export type VariantSummary = {
  config: string
  tier: string
  fourMean: number
  fiveMean: number
  /** Mean win change in points, then per seed. */
  change: number
  perSeed: number[]
  /** Prepared cells that move from below 95% to 95% or more (seed-averaged win rates). */
  crossing: number
  cells: number
  /** Mean over cells of the change in the seed-averaged median win time. */
  medianChange: number | null
}

export type Verdict = { qualifies: boolean; reasons: string[] }

/** The 13.35 rule: mean gain at most 10 and at least 4 in every seed (so the mean too), at most half the cells crossing to 95+, median win time cut by at most 20%. */
export function verdictFor(summary: VariantSummary): Verdict {
  const reasons: string[] = []
  if (summary.change < 4) reasons.push(`gain ${summary.change.toFixed(1)} is below +4`)
  if (summary.change > 10) reasons.push(`gain ${summary.change.toFixed(1)} is above +10`)
  if (summary.perSeed.some((value) => value < 4)) reasons.push('below +4 in at least one seed')
  if (summary.crossing > summary.cells / 2) reasons.push(`${summary.crossing} of ${summary.cells} cells cross to 95+`)
  if (summary.medianChange !== null && summary.medianChange < -0.2) reasons.push(`median win time cut ${(-summary.medianChange * 100).toFixed(1)}%`)
  return { qualifies: reasons.length === 0, reasons }
}

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Compare the shards of a config with the four baseline of the same skill (same seeds, same tier). `shards` holds every
 * shard; `fourSkill` names the baseline group.
 */
export function summarize(shards: readonly RangerShard[], config: string, fourSkill: string, tier: string): VariantSummary | null {
  const five = shards.filter((shard) => shard.config === config && shard.tier === tier)
  const four = shards.filter((shard) => shard.config === `four:${fourSkill}` && shard.tier === tier)
  if (five.length === 0 || four.length === 0) return null
  const seeds = five.map((shard) => shard.seed).filter((seed) => four.some((entry) => entry.seed === seed)).sort((a, b) => a - b)
  if (seeds.length === 0) return null
  const rowsOf = (list: readonly RangerShard[], seed: number) => list.find((shard) => shard.seed === seed)!.rows
  const perSeed = seeds.map((seed) => (mean(rowsOf(five, seed).map((row) => row.winRate)) - mean(rowsOf(four, seed).map((row) => row.winRate))) * 100)
  let crossing = 0
  const medianChanges: number[] = []
  for (const elite of CLASSIC_ELITE_IDS) {
    const win = (list: readonly RangerShard[]) => mean(seeds.map((seed) => rowsOf(list, seed).find((row) => row.elite === elite)!.winRate))
    if (win(four) < 0.95 && win(five) >= 0.95) crossing += 1
    const median = (list: readonly RangerShard[]) => {
      const values = seeds.map((seed) => rowsOf(list, seed).find((row) => row.elite === elite)!.medianWinMs).filter((value): value is number => value !== null)
      return values.length === 0 ? null : mean(values)
    }
    const a = median(four)
    const b = median(five)
    if (a !== null && b !== null) medianChanges.push((b - a) / a)
  }
  const fourMean = mean(seeds.map((seed) => mean(rowsOf(four, seed).map((row) => row.winRate)))) * 100
  const fiveMean = mean(seeds.map((seed) => mean(rowsOf(five, seed).map((row) => row.winRate)))) * 100
  return { config, tier, fourMean, fiveMean, change: mean(perSeed), perSeed, crossing, cells: CLASSIC_ELITE_IDS.length, medianChange: medianChanges.length === 0 ? null : mean(medianChanges) }
}

/** Every config with a summary at both tiers, plus the verdict, as a text table. */
export function formatRangerReport(shards: readonly RangerShard[]): string {
  const lines: string[] = []
  const configs = [...new Set(shards.map((shard) => shard.config))].filter((config) => !config.startsWith('four:') && !config.startsWith('side:')).sort()
  for (const config of configs) {
    const variant = rangerVariant(config.split(':')[0]!)
    for (const tier of ['prepared', 'prepared-crafted']) {
      const summary = summarize(shards, config, variant.skillId, tier)
      if (summary === null) continue
      const verdict = verdictFor(summary)
      const median = summary.medianChange === null ? 'n/a' : `${(summary.medianChange * 100).toFixed(1)}%`
      lines.push(
        `${config} ${tier}: four ${summary.fourMean.toFixed(1)} five ${summary.fiveMean.toFixed(1)} change ${summary.change >= 0 ? '+' : ''}${summary.change.toFixed(1)} per seed [${summary.perSeed.map((v) => v.toFixed(1)).join(', ')}] crossing ${summary.crossing}/${summary.cells} median ${median}${tier === 'prepared' ? ` -> ${verdict.qualifies ? 'QUALIFIES' : `no (${verdict.reasons.join('; ')})`}` : ''}`,
      )
    }
  }
  const side = shards.filter((shard) => shard.tier === 'side')
  for (const sideConfig of [...new Set(side.map((shard) => shard.config))]) {
    for (const enemy of SIDE_ENEMIES) {
      const rows = side.filter((shard) => shard.config === sideConfig)
      const fourRows = rows.map((shard) => shard.rows.find((row) => row.config === 'side-four' && row.elite === enemy)!)
      const swapRows = rows.map((shard) => shard.rows.find((row) => row.config !== 'side-four' && row.elite === enemy)!)
      const delta = (mean(swapRows.map((row) => row.winRate)) - mean(fourRows.map((row) => row.winRate))) * 100
      lines.push(`${sideConfig} ${enemy}: four ${(mean(fourRows.map((row) => row.winRate)) * 100).toFixed(1)} swap ${(mean(swapRows.map((row) => row.winRate)) * 100).toFixed(1)} change ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}${delta > 10 ? ' FLAG over +10' : ''}`)
    }
  }
  return `${lines.join('\n')}\n`
}

export function loadShards(dir: string): RangerShard[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as RangerShard)
}

function main(args: readonly string[]): void {
  const [mode, ...rest] = args
  if (mode === 'report' && rest[0] !== undefined) {
    process.stdout.write(formatRangerReport(loadShards(rest[0])))
    return
  }
  if (mode === 'shard' && rest.length === 5) {
    const [config, seedArg, runsArg, tier, out] = rest as [string, string, string, string, string]
    const seed = Number(seedArg)
    const runs = Number(runsArg)
    if (!Number.isInteger(seed) || !Number.isInteger(runs)) throw new Error('seed and runs must be integers')
    let shard: RangerShard
    if (tier === 'side') {
      const [, variantId, placement] = config.split(':')
      shard = runSideShard(variantId!, placement as Placement, seed, runs)
    } else {
      shard = runRangerShard(config, seed, runs, tier as SlotTier)
    }
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(shard))
    console.log(`[slots-ranger] ${config} ${tier} seed ${seed} runs ${runs} -> ${out}`)
    return
  }
  console.error('usage: tsx src/harness/slotsRanger.ts shard <config> <seed> <runs> <prepared|prepared-crafted|side> <out.json> | report <dir>')
  process.exit(1)
}

if (process.argv[1] !== undefined && /slotsRanger\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) main(process.argv.slice(2))
