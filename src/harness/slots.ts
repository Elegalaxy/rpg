import { gameDefs, referenceLoadoutFor } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { MAX_LOADOUT_SLOTS } from '../sim/progression.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { AutomationCondition, CombatSetup, GameDefs, PriorityRow } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { CLASSIC_ELITE_IDS, ELITE_CELLS, eliteSetup, type EliteCell, type EliteId } from './elites.ts'

/**
 * The fifth skill slot measurement (Step 13.34 part 2): the same hero, rules and elite fight with the class's four
 * reference skills, and with one more skill equipped either as the last row or ahead of the reference rows. Every
 * variant of a candidate holds the same skill-web nodes, so only the equipped skill and its row differ. Measurements
 * only; nothing here tunes.
 */
export const FIFTH_SKILL_CANDIDATES: { readonly [classId in HeroClass]: readonly string[] } = {
  warrior: ['cleave', 'reckless-strike'],
  assassin: ['smoke-step', 'fan-of-knives'],
  ranger: ['hunters-mark', 'flame-arrow', 'volley'],
  mage: ['chain-lightning'],
  cleric: ['penance', 'consecration'],
}

export const SLOT_VARIANTS = ['four', 'five-last', 'five-first'] as const
/** The tuned variants (Step 13.34 follow-up): the fifth skill on conditional rows, before the unconditional fallback row (`tuned-last`) or ahead of the reference rows (`tuned-first`). */
export const TUNED_VARIANTS = ['tuned-last', 'tuned-first'] as const
/** The Ranger swap variant (Step 13.35): the candidate replaces Snare Trap, so the loadout stays at four skills. Rows go before the fallback attack, or ahead of the reference rows with `placement: 'first'`. */
export const SWAP_VARIANT = 'swap'
export type SlotVariant = (typeof SLOT_VARIANTS)[number] | (typeof TUNED_VARIANTS)[number] | typeof SWAP_VARIANT

/** The skill each class gives up in the `swap` variant. */
export const SWAP_OUT: { readonly [classId in HeroClass]?: string } = { ranger: 'snare-trap' }

/** Optional overrides for `slotSetup`. Without them the setup is exactly the one the tuned and naive variants always built. */
export type SlotOptions = {
  /** Rows for the candidate instead of `TUNED_ROWS[skillId]` (tuned and swap variants). */
  rows?: readonly PriorityRow[]
  /** Where the `swap` variant puts its rows. Default `last`. */
  placement?: 'first' | 'last'
}

/** The tiers measured: the prepared tier and its crafted-supplies variant. */
export const SLOT_TIERS = ['prepared', 'prepared-crafted'] as const
export type SlotTier = (typeof SLOT_TIERS)[number]

export type SlotRow = {
  classId: HeroClass
  elite: EliteId
  tier: SlotTier
  skillId: string
  variant: SlotVariant
  /** Null on a row that was not run (`note` says why). */
  winRate: number | null
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number | null
  /** Median fight time of the wins in ms, or null with no win or no run. */
  medianWinMs: number | null
  /** `row cap` when the extra row would pass `MAX_PRIORITY_ROWS`, so the variant was not run. */
  note: typeof ROW_CAP_NOTE | null
}

/** Recorded on a variant that was not run because the extra row would pass `MAX_PRIORITY_ROWS`. */
export const ROW_CAP_NOTE = 'row cap'

const atLeast = (kind: 'classResource', value: number): AutomationCondition => ({ kind, operator: 'atLeast', value })
const atMostResource = (value: number): AutomationCondition => ({ kind: 'classResource', operator: 'atMost', value })
const enemies2: AutomationCondition = { kind: 'enemyCount', operator: 'atLeast', value: 2 }
const heroHp = (operator: 'atLeast' | 'atMost', value: number): AutomationCondition => ({ kind: 'hpPercent', who: 'hero', operator, value })

/**
 * The tuned rows for a fifth skill: conditions built only from the existing rule vocabulary (see GAME_DESIGN section 10,
 * "Tuned fifth skill rows"). A skill may have two rows (the same skill on a later row is the OR). One reasonable attempt
 * per skill, not fitted to the results.
 */
export const TUNED_ROWS: { readonly [skillId: string]: readonly PriorityRow[] } = {
  cleave: [{ skillId: 'cleave', conditions: [enemies2, atLeast('classResource', 50)] }],
  'reckless-strike': [{ skillId: 'reckless-strike', conditions: [heroHp('atLeast', 70), atLeast('classResource', 60)] }],
  // One row, because a second row passes the 12-row cap for the Assassin (11 rows with supplies). First draft had an opener row as well.
  'smoke-step': [{ skillId: 'smoke-step', conditions: [heroHp('atMost', 50)] }],
  'fan-of-knives': [{ skillId: 'fan-of-knives', conditions: [enemies2] }],
  // Refined once: the first gate (`mark` absent) never closes, because Hunter's Mark only reveals and sets no status the rule can read, so it was recast every cooldown. It is now an opener.
  'hunters-mark': [{ skillId: 'hunters-mark', conditions: [{ kind: 'fightTime', operator: 'atMost', value: 1000 }] }],
  'flame-arrow': [
    {
      skillId: 'flame-arrow',
      conditions: [atLeast('classResource', 60), { kind: 'status', who: 'target', statusId: 'burn', measure: 'presence', operator: 'absent' }, { kind: 'specialAmmo', operator: 'atLeast', value: 1 }],
    },
  ],
  volley: [{ skillId: 'volley', conditions: [atLeast('classResource', 80)] }],
  'chain-lightning': [{ skillId: 'chain-lightning', conditions: [enemies2, atLeast('classResource', 60)] }],
  penance: [{ skillId: 'penance', conditions: [heroHp('atLeast', 70), atMostResource(50)] }],
  // Two rows (the same skill twice is the OR). They fit the 12-row cap everywhere except the Cinder Tyrant, which is recorded as `row cap` like the Mage. A one-row draft (healthy target and resource only) fitted the Tyrant and measured worse; see GAME_DESIGN.
  consecration: [
    { skillId: 'consecration', conditions: [enemies2, atLeast('classResource', 50)] },
    { skillId: 'consecration', conditions: [{ kind: 'hpPercent', who: 'target', operator: 'atLeast', value: 50 }, atLeast('classResource', 60)] },
  ],
}

/** The node that unlocks `skillId` and every node before it in its chain, earliest first. */
function nodesToUnlock(classId: HeroClass, skillId: string): string[] {
  const nodes = classWebs[classId].nodes
  const target = nodes.find((node) => node.unlocksSkillId === skillId)
  if (target === undefined) throw new Error(`${classId} has no node that unlocks ${skillId}`)
  const chain: string[] = []
  let current: (typeof nodes)[number] | undefined = target
  while (current !== undefined) {
    chain.unshift(current.id)
    const requires: string | null = current.requires
    current = requires === null ? undefined : nodes.find((node) => node.id === requires)
  }
  return chain
}

/** Put `extra` ahead of the first row for a reference skill (`first`), or just before an unconditional fallback row (`last`; a row after it could never fire). */
export function placeRows(rows: readonly PriorityRow[], extra: readonly PriorityRow[], placement: 'first' | 'last', isReference: (skillId: string) => boolean): PriorityRow[] {
  if (placement === 'first') {
    const index = rows.findIndex((entry) => isReference(entry.skillId))
    return index < 0 ? [...rows, ...extra] : [...rows.slice(0, index), ...extra, ...rows.slice(index)]
  }
  const last = rows.at(-1)
  return last !== undefined && (last.conditions ?? []).length === 0 ? [...rows.slice(0, -1), ...extra, last] : [...rows, ...extra]
}

/**
 * The elite fight for a class with exactly the reference skills (`four`), or with `skillId` as a fifth skill. Returns
 * null when the extra row would pass `MAX_PRIORITY_ROWS`.
 */
export function slotSetup(classId: HeroClass, cell: EliteCell, skillId: string, variant: SlotVariant, options: SlotOptions = {}): CombatSetup | null {
  const base = eliteSetup(classId, cell, 'rules')
  const reference = referenceLoadoutFor(classId).equippedSkillIds
  const isReference = (id: string): boolean => reference.includes(id)
  const equipped = (base.hero.equippedSkillIds ?? []).filter(isReference)
  const rows = (base.hero.priorityRows ?? []).filter((row) => !((base.hero.equippedSkillIds ?? []).includes(row.skillId) && !isReference(row.skillId)))
  const held = base.hero.allocatedNodeIds ?? []
  const nodes = [...held, ...nodesToUnlock(classId, skillId).filter((id) => !held.includes(id))]
  const hero = { ...base.hero, allocatedNodeIds: nodes }
  if (variant === 'four') return { ...base, hero: { ...hero, equippedSkillIds: equipped, priorityRows: rows } }
  let next: PriorityRow[]
  if (variant === 'swap') {
    const out = SWAP_OUT[classId]
    if (out === undefined) throw new Error(`${classId} has no swap-out skill`)
    const tuned = options.rows ?? TUNED_ROWS[skillId]
    if (tuned === undefined) throw new Error(`no rows for ${skillId}`)
    next = placeRows(rows, tuned, options.placement ?? 'last', isReference)
    if (next.length > MAX_PRIORITY_ROWS) return null
    return { ...base, hero: { ...hero, equippedSkillIds: [...equipped.filter((id) => id !== out), skillId], priorityRows: next } }
  }
  if (variant === 'tuned-first' || variant === 'tuned-last') {
    const tuned = options.rows ?? TUNED_ROWS[skillId]
    if (tuned === undefined) throw new Error(`no tuned rows for ${skillId}`)
    // A row after the unconditional fallback attack could never fire, so `last` goes just before it.
    next = placeRows(rows, tuned, variant === 'tuned-first' ? 'first' : 'last', isReference)
    if (next.length > MAX_PRIORITY_ROWS) return null
    return { ...base, hero: { ...hero, equippedSkillIds: [...equipped, skillId], priorityRows: next } }
  }
  const row: PriorityRow = { skillId }
  if (variant === 'five-last') {
    next = [...rows, row]
  } else {
    const index = rows.findIndex((entry) => isReference(entry.skillId))
    next = index < 0 ? [...rows, row] : [...rows.slice(0, index), row, ...rows.slice(index)]
  }
  if (next.length > MAX_PRIORITY_ROWS || equipped.length + 1 > MAX_LOADOUT_SLOTS) return null
  return { ...base, hero: { ...hero, equippedSkillIds: [...equipped, skillId], priorityRows: next } }
}

export type SlotsFilter = {
  classes?: readonly HeroClass[]
  elites?: readonly EliteId[]
  tiers?: readonly SlotTier[]
  /** Default `SLOT_VARIANTS`. */
  variants?: readonly SlotVariant[]
  /** Only these candidate skills. */
  skills?: readonly string[]
  /** Definitions to run against instead of `gameDefs()` (a patched copy; never mutate the real one). */
  defs?: GameDefs
  /** Rows for the candidate instead of `TUNED_ROWS` (tuned and swap variants). */
  rows?: readonly PriorityRow[]
  /** Where the `swap` variant puts its rows. */
  placement?: 'first' | 'last'
}

/** Win rate, mean HP lost and median win time of one setup over `runs` seeded fights. */
export function measureSlot(setup: CombatSetup, defs: GameDefs, seed: number, runs: number): { winRate: number; hpLost: number; medianWinMs: number | null } {
  let wins = 0
  let lost = 0
  const winTimes: number[] = []
  for (let index = 0; index < runs; index += 1) {
    const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
    if (state.outcome === 'victory') {
      wins += 1
      winTimes.push(state.timeMs)
    }
    lost += 1 - Math.max(0, state.hero.hp) / state.hero.maxHp
  }
  winTimes.sort((a, b) => a - b)
  return { winRate: wins / runs, hpLost: lost / runs, medianWinMs: winTimes[Math.floor(winTimes.length / 2)] ?? null }
}

/** Every class, candidate, elite and tier with the four variants, in rules mode. A variant that would pass the row cap is not run and is listed with the note `row cap`. */
export function runSlotsMatrix(seed: number, runs: number, filter: SlotsFilter = {}): SlotRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = filter.defs ?? gameDefs()
  const rows: SlotRow[] = []
  for (const classId of HERO_CLASSES) {
    if (filter.classes !== undefined && !filter.classes.includes(classId)) continue
    for (const skillId of FIFTH_SKILL_CANDIDATES[classId]) {
      if (filter.skills !== undefined && !filter.skills.includes(skillId)) continue
      for (const elite of CLASSIC_ELITE_IDS) {
        if (filter.elites !== undefined && !filter.elites.includes(elite)) continue
        for (const tier of SLOT_TIERS) {
          if (filter.tiers !== undefined && !filter.tiers.includes(tier)) continue
          const cell = ELITE_CELLS.find((entry) => entry.elite === elite && entry.tier === tier)!
          for (const variant of filter.variants ?? SLOT_VARIANTS) {
            const setup = slotSetup(classId, cell, skillId, variant, { rows: filter.rows, placement: filter.placement })
            if (setup === null) {
              rows.push({ classId, elite, tier, skillId, variant, winRate: null, hpLost: null, medianWinMs: null, note: ROW_CAP_NOTE })
              continue
            }
            const result = measureSlot(setup, defs, seed, runs)
            rows.push({ classId, elite, tier, skillId, variant, winRate: result.winRate, hpLost: result.hpLost, medianWinMs: result.medianWinMs, note: null })
          }
        }
      }
    }
  }
  return rows
}

/** One line per row: class, skill, elite, tier, variant, then wins, mean HP lost and median win time. */
export function formatSlotsTable(rows: readonly SlotRow[]): string {
  const lines = rows.map((row) => {
    if (row.winRate === null || row.hpLost === null) return `${row.classId} ${row.skillId} ${row.elite} ${row.tier} ${row.variant}: ${row.note ?? 'not run'}`
    const median = row.medianWinMs === null ? 'no win' : `${Math.round(row.medianWinMs / 100) / 10}s`
    return `${row.classId} ${row.skillId} ${row.elite} ${row.tier} ${row.variant}: wins ${Math.round(row.winRate * 100)}% | lost ${Math.round(row.hpLost * 100)}% | median win ${median}`
  })
  return `${lines.join('\n')}\n`
}
