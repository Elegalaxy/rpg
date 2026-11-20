import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { gameDefs } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup, GameDefs, PriorityRow } from '../sim/types.ts'

import { HARNESS_LIMIT_MS } from './batch.ts'
import { ELITE_CELLS, eliteSetup, type EliteCell } from './elites.ts'
import { WARDEN_TIERS } from './warden.ts'

/**
 * The venom passive measurement (Step 13.39 part 2, GAME_DESIGN section 10 "Venom passive"). The Assassin's Venom Edge
 * becomes the passive "Envenomed strikes" (`GameDefs.envenom`); here the hook is switched on in patched copies of the
 * definitions only, never in `gameDefs()`. Measurements only; nothing here changes the game.
 *
 * Shard runner: `npx tsx src/harness/venom.ts shard <variant> <seed> <runs> <cellFilter> <out.json>` where `cellFilter` is
 * `all` or a comma list of `elite:tier`. Merge: `npx tsx src/harness/venom.ts report <dir> [csv]`.
 *
 * Variant ids: `current`; `passive-<06|08|10|12|15>-<empty|smoke|fan>`; `proc50`; `basic-10`; `fan-only-10`; each with an
 * optional `+to` or `+ts` suffix (Toxic Opportunity, or Toxic Opportunity then Toxic Sovereign, allocated through the
 * node chain). The elite builds already carry Smoke Step, so `-smoke` is the same loadout as `-empty` and is run as `-empty`.
 */
export const VENOM_TICKS = ['06', '08', '10', '12', '15'] as const

/** The measured cells: every elite cell plus the Warden just-arrived tier. */
export const VENOM_CELLS: readonly EliteCell[] = [
  ...ELITE_CELLS,
  { elite: 'warden', tier: 'arrived', tierDef: WARDEN_TIERS.find((tier) => tier.id === 'arrived')! },
]

export const cellKey = (cell: EliteCell): string => `${cell.elite}:${cell.tier}`

export type VenomVariant = {
  id: string
  /** Passive settings; absent means no `envenom` (the `current` family). */
  envenom?: { baseChance: number; tick: number; basicOnly?: boolean; basicBonus?: number; shadowCutBonus?: number; bossCoefficient?: number }
  /** The shipped game as it is after 13.39: real definitions and the reference loadout, nothing patched. */
  live?: boolean
  /** Venom Edge is dropped from the equipped skills and rows. */
  dropVenomEdge: boolean
  /** Fan of Knives is equipped on a `enemyCount >= 2` row. */
  fan: boolean
  /** Fan of Knives itself applies Poison (the `fan-only` probe). */
  fanPoisons?: number
  /** Extra nodes allocated through the chain. */
  modifier: 'to' | 'ts' | null
}

export function parseVariant(id: string): VenomVariant {
  const [head, suffix] = id.split('+') as [string, string | undefined]
  if (suffix !== undefined && suffix !== 'to' && suffix !== 'ts') throw new Error(`unknown modifier '+${suffix}'`)
  const modifier = (suffix ?? null) as VenomVariant['modifier']
  if (head === 'current') return { id, dropVenomEdge: false, fan: false, modifier }
  if (head === 'live') return { id, live: true, dropVenomEdge: false, fan: false, modifier }
  if (head === 'proc50') return { id, envenom: { baseChance: 0.5, tick: 0.1 }, dropVenomEdge: true, fan: false, modifier }
  if (head === 'basic-10') return { id, envenom: { baseChance: 1, tick: 0.1, basicOnly: true }, dropVenomEdge: true, fan: false, modifier }
  if (head === 'fan-only-10') return { id, dropVenomEdge: true, fan: true, fanPoisons: 0.1, modifier }
  const comp = /^passive-10-(basic|shadow|boss)(\d\d)$/.exec(head)
  if (comp !== null) {
    const amount = Number(comp[2]) / 100
    const envenom = { baseChance: 1, tick: 0.1, ...(comp[1] === 'basic' ? { basicBonus: amount } : comp[1] === 'shadow' ? { shadowCutBonus: amount } : { bossCoefficient: amount }) }
    return { id, envenom, dropVenomEdge: true, fan: false, modifier }
  }
  const match = /^passive-(\d\d)-(empty|smoke|fan)$/.exec(head)
  if (match === null) throw new Error(`unknown variant '${id}'`)
  const tick = Number(match[1]) / 100
  return { id, envenom: { baseChance: 1, tick }, dropVenomEdge: true, fan: match[2] === 'fan', modifier }
}

/** The node and every node before it in its chain, earliest first. */
function chainTo(nodeId: string): string[] {
  const nodes = classWebs.assassin.nodes
  const chain: string[] = []
  let current: (typeof nodes)[number] | undefined = nodes.find((node) => node.id === nodeId)
  if (current === undefined) throw new Error(`no assassin node '${nodeId}'`)
  while (current !== undefined) {
    chain.unshift(current.id)
    const requires: string | null = current.requires
    current = requires === null ? undefined : nodes.find((node) => node.id === requires)
  }
  return chain
}

/** The reference Venom Edge row before 13.39. */
const VENOM_EDGE_ROW: PriorityRow = {
  skillId: 'venom-edge',
  conditions: [{ kind: 'status', who: 'target', statusId: 'poison', measure: 'stacks', operator: 'atMost', value: 4 }],
  targetPriority: 'lowestArmor',
}

const FAN_ROW: PriorityRow = { skillId: 'fan-of-knives', conditions: [{ kind: 'enemyCount', operator: 'atLeast', value: 2 }] }

/** Patched copy of the definitions for a variant. The real `gameDefs()` is never mutated. */
export function venomDefs(variant: VenomVariant, base: GameDefs = gameDefs()): GameDefs {
  // `gameDefs()` carries the live passive since 13.39; the measurement variants decide on their own.
  let defs: GameDefs = variant.live === true ? base : { ...base, envenom: undefined }
  if (variant.envenom !== undefined) {
    defs = { ...defs, envenom: { baseChance: variant.envenom.baseChance, coefficient: variant.envenom.tick, nodeCoefficient: variant.envenom.tick, basicOnly: variant.envenom.basicOnly, basicBonus: variant.envenom.basicBonus, shadowCutBonus: variant.envenom.shadowCutBonus, bossCoefficient: variant.envenom.bossCoefficient } }
  }
  if (variant.fanPoisons !== undefined) {
    const fan = defs.skills['fan-of-knives']
    if (fan === undefined) throw new Error('no fan-of-knives skill')
    const poison = { kind: 'applyStatus' as const, statusId: 'poison', baseChance: 1, coefficient: variant.fanPoisons, power: 'physical' as const }
    defs = { ...defs, skills: { ...defs.skills, 'fan-of-knives': { ...fan, effects: [...fan.effects, poison] } } }
  }
  return defs
}

/** The Assassin elite fight (rules mode) for a variant. */
export function venomSetup(variant: VenomVariant, cell: EliteCell): CombatSetup {
  const base = eliteSetup('assassin', cell, 'rules')
  let equipped = [...(base.hero.equippedSkillIds ?? [])]
  let rows = [...(base.hero.priorityRows ?? [])]
  let nodes = [...(base.hero.allocatedNodeIds ?? [])]
  if (variant.dropVenomEdge) {
    equipped = equipped.filter((id) => id !== 'venom-edge')
    rows = rows.filter((row) => row.skillId !== 'venom-edge')
  } else if (variant.live !== true && !equipped.includes('venom-edge')) {
    // The reference loadout no longer carries Venom Edge (13.39): `current` puts back the pre-13.39 skill and row.
    equipped = [...equipped.slice(0, 3), 'venom-edge', ...equipped.slice(3)]
    const at = rows.findIndex((row) => row.skillId === 'shadow-cut')
    rows = [...rows.slice(0, at), VENOM_EDGE_ROW, ...rows.slice(at)]
  }
  const addNodes = (target: string) => {
    for (const id of chainTo(target)) if (!nodes.includes(id)) nodes.push(id)
  }
  if (variant.fan) {
    addNodes('assassin-fan-of-knives')
    if (!equipped.includes('fan-of-knives')) equipped.push('fan-of-knives')
    // Before the first unconditional row: a row after the fallback attack could never fire.
    const index = rows.findIndex((row) => (row.conditions ?? []).length === 0)
    rows = index < 0 ? [...rows, FAN_ROW] : [...rows.slice(0, index), FAN_ROW, ...rows.slice(index)]
  }
  if (variant.modifier === 'to') addNodes('assassin-toxic-opportunity')
  if (variant.modifier === 'ts') addNodes('assassin-toxic-sovereign')
  if (rows.length > MAX_PRIORITY_ROWS) throw new Error(`${variant.id} passes the row cap at ${cellKey(cell)}`)
  return { ...base, hero: { ...base.hero, equippedSkillIds: equipped, priorityRows: rows, allocatedNodeIds: nodes } }
}

export type VenomCellRow = {
  variant: string
  cell: string
  elite: string
  tier: string
  winRate: number
  medianWinMs: number | null
  /** Mean share of the fight time with Poison on at least one enemy. */
  uptime: number
  /** Mean over runs of the highest Poison stack count seen. */
  peakStacks: number
}

export type VenomShard = { variant: string; seed: number; runs: number; rows: VenomCellRow[] }

/** Win rate, median win time, Poison uptime and peak stacks of one setup over `runs` seeded fights. */
export function measureVenom(setup: CombatSetup, defs: GameDefs, seed: number, runs: number): Pick<VenomCellRow, 'winRate' | 'medianWinMs' | 'uptime' | 'peakStacks'> {
  let wins = 0
  let uptime = 0
  let peak = 0
  const winTimes: number[] = []
  for (let index = 0; index < runs; index += 1) {
    const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
    if (state.outcome === 'victory') {
      wins += 1
      winTimes.push(state.timeMs)
    }
    const intervals: [number, number][] = []
    let runPeak = 0
    for (const event of state.log) {
      if (event.type !== 'statusAttempt' || event.statusId !== 'poison') continue
      if (event.result === 'resisted' || event.result === 'contact') continue
      if (event.stacks > runPeak) runPeak = event.stacks
      if (event.expiresMs !== null) intervals.push([event.timeMs, Math.min(event.expiresMs, state.timeMs)])
    }
    peak += runPeak
    intervals.sort((a, b) => a[0] - b[0])
    let covered = 0
    let reach = 0
    for (const [from, to] of intervals) {
      const start = Math.max(from, reach)
      if (to > start) {
        covered += to - start
        reach = to
      }
    }
    if (state.timeMs > 0) uptime += covered / state.timeMs
  }
  winTimes.sort((a, b) => a - b)
  return { winRate: wins / runs, medianWinMs: winTimes[Math.floor(winTimes.length / 2)] ?? null, uptime: uptime / runs, peakStacks: peak / runs }
}

/** One shard: every selected cell for one variant and seed. */
export function runVenomShard(variantId: string, seed: number, runs: number, cellFilter: string): VenomShard {
  const variant = parseVariant(variantId)
  const defs = venomDefs(variant)
  const wanted = cellFilter === 'all' ? null : cellFilter.split(',')
  const rows: VenomCellRow[] = []
  for (const cell of VENOM_CELLS) {
    if (wanted !== null && !wanted.includes(cellKey(cell))) continue
    rows.push({ variant: variantId, cell: cellKey(cell), elite: cell.elite, tier: cell.tier, ...measureVenom(venomSetup(variant, cell), defs, seed, runs) })
  }
  return { variant: variantId, seed, runs, rows }
}

// ---- Merge and verdict ----

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length)

export type TierSummary = {
  variant: string
  baseline: string
  tier: string
  cells: number
  baseMean: number
  variantMean: number
  /** Points. */
  delta: number
  perSeed: number[]
  crossing: number
  /** Mean per-cell relative change of the seed-averaged median win time (negative is faster), or null. */
  medianChange: number | null
  uptime: number
  peakStacks: number
}

/** `current` with the same modifier is the baseline of a variant (`+to` compares with `current+to`). */
export const baselineOf = (variantId: string): string => {
  const suffix = variantId.includes('+') ? `+${variantId.split('+')[1]}` : ''
  return `current${suffix}`
}

const rowsFor = (shards: readonly VenomShard[], variant: string, seed: number) => shards.find((shard) => shard.variant === variant && shard.seed === seed)?.rows ?? []

/** Compare a variant with its baseline per tier (`all` for every cell, `warden:prepared` for that one cell). */
export function summarizeTier(shards: readonly VenomShard[], variant: string, tier: string): TierSummary | null {
  const baseline = baselineOf(variant)
  const seeds = [...new Set(shards.filter((shard) => shard.variant === variant).map((shard) => shard.seed))].filter((seed) => rowsFor(shards, baseline, seed).length > 0).sort((a, b) => a - b)
  if (seeds.length === 0) return null
  const pick = (row: VenomCellRow) => tier === 'all' || row.cell === tier || row.tier === tier
  const cells = [...new Set(rowsFor(shards, variant, seeds[0]!).filter(pick).map((row) => row.cell))]
  if (cells.length === 0) return null
  const cellRows = (id: string, seed: number, cell: string) => rowsFor(shards, id, seed).find((row) => row.cell === cell)
  const winOf = (id: string, seed: number) => mean(cells.map((cell) => cellRows(id, seed, cell)?.winRate ?? 0)) * 100
  const perSeed = seeds.map((seed) => winOf(variant, seed) - winOf(baseline, seed))
  let crossing = 0
  const medianChanges: number[] = []
  for (const cell of cells) {
    const avg = (id: string) => mean(seeds.map((seed) => cellRows(id, seed, cell)?.winRate ?? 0))
    if (avg(baseline) < 0.95 && avg(variant) >= 0.95) crossing += 1
    const median = (id: string) => {
      const values = seeds.map((seed) => cellRows(id, seed, cell)?.medianWinMs ?? null).filter((value): value is number => value !== null)
      return values.length === 0 ? null : mean(values)
    }
    const a = median(baseline)
    const b = median(variant)
    if (a !== null && b !== null && a > 0) medianChanges.push((b - a) / a)
  }
  const stat = (key: 'uptime' | 'peakStacks') => mean(seeds.flatMap((seed) => cells.map((cell) => cellRows(variant, seed, cell)?.[key] ?? 0)))
  return {
    variant,
    baseline,
    tier,
    cells: cells.length,
    baseMean: mean(seeds.map((seed) => winOf(baseline, seed))),
    variantMean: mean(seeds.map((seed) => winOf(variant, seed))),
    delta: mean(perSeed),
    perSeed,
    crossing,
    medianChange: medianChanges.length === 0 ? null : mean(medianChanges),
    uptime: stat('uptime'),
    peakStacks: stat('peakStacks'),
  }
}

export const VENOM_TIERS = ['arrived', 'prepared', 'over', 'causeway', 'prepared-crafted'] as const

export type VenomVerdict = { go: boolean; reasons: string[] }

/** The GO/NO-GO rule (GAME_DESIGN section 10, "Venom passive"). A modifier variant is judged on its tier deltas against `current` with the same nodes, capped at +12. */
export function verdictFor(shards: readonly VenomShard[], variant: string): VenomVerdict {
  const reasons: string[] = []
  if (summarizeTier(shards, variant, 'all') === null) return { go: false, reasons: ['no baseline data'] }
  const modifier = variant.includes('+')
  const limit = modifier ? 12 : 8
  for (const tier of VENOM_TIERS) {
    const summary = summarizeTier(shards, variant, tier)
    if (summary === null) continue
    if (modifier ? summary.delta > limit : Math.abs(summary.delta) > limit) reasons.push(`${tier} ${summary.delta >= 0 ? '+' : ''}${summary.delta.toFixed(1)} beyond ${modifier ? '+' : '+/-'}${limit}`)
  }
  const all = summarizeTier(shards, variant, 'all')
  if (all !== null) {
    if (all.crossing > all.cells / 2) reasons.push(`${all.crossing} of ${all.cells} cells cross to 95+`)
    if (all.medianChange !== null && all.medianChange < -0.2) reasons.push(`median win time cut ${(-all.medianChange * 100).toFixed(1)}%`)
  }
  const warden = summarizeTier(shards, variant, 'warden:prepared')
  if (warden !== null && Math.abs(warden.delta) > 8) reasons.push(`Warden prepared ${warden.delta >= 0 ? '+' : ''}${warden.delta.toFixed(1)} beyond +/-8`)
  return { go: reasons.length === 0, reasons }
}

export function loadShards(dir: string): VenomShard[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as VenomShard)
}

const signs = (values: readonly number[]) => values.map((value) => (value > 0.05 ? '+' : value < -0.05 ? '-' : '0')).join('')

/** Text table plus CSV for every variant, tier and the Warden prepared cell. */
export function formatVenomReport(shards: readonly VenomShard[]): { text: string; csv: string } {
  const variants = [...new Set(shards.map((shard) => shard.variant))].sort()
  const header = ['variant', 'baseline', 'tier', 'cells', 'base_win', 'win', 'delta', 'per_seed', 'signs', 'crossing', 'median_change_pct', 'poison_uptime', 'peak_stacks', 'verdict']
  const csv: string[] = [header.join(',')]
  const text: string[] = []
  for (const variant of variants) {
    if (variant.startsWith('current') && !variant.includes('+')) continue
    const verdict = verdictFor(shards, variant)
    text.push(`${variant} (vs ${baselineOf(variant)}): ${verdict.go ? 'GO' : `NO-GO (${verdict.reasons.join('; ')})`}`)
    for (const tier of [...VENOM_TIERS, 'warden:prepared', 'all']) {
      const summary = summarizeTier(shards, variant, tier)
      if (summary === null) continue
      const median = summary.medianChange === null ? '' : (summary.medianChange * 100).toFixed(1)
      text.push(
        `  ${tier.padEnd(16)} base ${summary.baseMean.toFixed(1)} win ${summary.variantMean.toFixed(1)} delta ${summary.delta >= 0 ? '+' : ''}${summary.delta.toFixed(1)} [${summary.perSeed.map((v) => v.toFixed(1)).join(', ')}] cross ${summary.crossing}/${summary.cells} median ${median === '' ? 'n/a' : `${median}%`} uptime ${(summary.uptime * 100).toFixed(0)}% peak ${summary.peakStacks.toFixed(1)}`,
      )
      csv.push([variant, summary.baseline, tier, summary.cells, summary.baseMean.toFixed(2), summary.variantMean.toFixed(2), summary.delta.toFixed(2), `"${summary.perSeed.map((v) => v.toFixed(1)).join(' ')}"`, signs(summary.perSeed), summary.crossing, median, summary.uptime.toFixed(3), summary.peakStacks.toFixed(2), tier === 'all' ? (verdict.go ? 'GO' : 'NO-GO') : ''].join(','))
    }
  }
  // The baselines themselves, for reference.
  const baselines = variants.filter((variant) => variant.startsWith('current'))
  for (const variant of baselines) {
    const rows = shards.filter((shard) => shard.variant === variant).flatMap((shard) => shard.rows)
    text.push(`${variant}: mean win ${(mean(rows.map((row) => row.winRate)) * 100).toFixed(1)} uptime ${(mean(rows.map((row) => row.uptime)) * 100).toFixed(0)}% peak ${mean(rows.map((row) => row.peakStacks)).toFixed(1)}`)
    for (const cell of VENOM_CELLS) {
      const cellRowsAll = rows.filter((row) => row.cell === cellKey(cell))
      if (cellRowsAll.length > 0) text.push(`  ${cellKey(cell).padEnd(24)} win ${(mean(cellRowsAll.map((row) => row.winRate)) * 100).toFixed(1)}`)
    }
  }
  return { text: `${text.join('\n')}\n`, csv: `${csv.join('\n')}\n` }
}

function main(args: readonly string[]): void {
  const [mode, ...rest] = args
  if (mode === 'report' && rest[0] !== undefined) {
    const report = formatVenomReport(loadShards(rest[0]))
    process.stdout.write(report.text)
    if (rest[1] !== undefined) {
      mkdirSync(dirname(rest[1]), { recursive: true })
      writeFileSync(rest[1], report.csv, 'utf8')
    }
    return
  }
  if (mode === 'shard' && rest.length === 5) {
    const [variant, seedArg, runsArg, cellFilter, out] = rest as [string, string, string, string, string]
    const seed = Number(seedArg)
    const runs = Number(runsArg)
    if (!Number.isInteger(seed) || !Number.isInteger(runs) || runs < 1) throw new Error('seed and runs must be integers')
    const shard = runVenomShard(variant, seed, runs, cellFilter)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(shard))
    console.log(`[venom] ${variant} seed ${seed} runs ${runs} -> ${out}`)
    return
  }
  console.error('usage: tsx src/harness/venom.ts shard <variant> <seed> <runs> <cellFilter|all> <out.json> | report <dir> [csv]')
  process.exit(1)
}

if (process.argv[1] !== undefined && /venom\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) main(process.argv.slice(2))
