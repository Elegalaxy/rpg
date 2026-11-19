import { gameDefs, referenceLoadoutFor } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { MAX_LOADOUT_SLOTS } from '../sim/progression.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup, PriorityRow } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { ELITE_CELLS, ELITE_IDS, eliteSetup, type EliteCell, type EliteId } from './elites.ts'

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
export type SlotVariant = (typeof SLOT_VARIANTS)[number]

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

/**
 * The elite fight for a class with exactly the reference skills (`four`), or with `skillId` as a fifth skill. Returns
 * null when the extra row would pass `MAX_PRIORITY_ROWS`.
 */
export function slotSetup(classId: HeroClass, cell: EliteCell, skillId: string, variant: SlotVariant): CombatSetup | null {
  const base = eliteSetup(classId, cell, 'rules')
  const reference = referenceLoadoutFor(classId).equippedSkillIds
  const isReference = (id: string): boolean => reference.includes(id)
  const equipped = (base.hero.equippedSkillIds ?? []).filter(isReference)
  const rows = (base.hero.priorityRows ?? []).filter((row) => !((base.hero.equippedSkillIds ?? []).includes(row.skillId) && !isReference(row.skillId)))
  const held = base.hero.allocatedNodeIds ?? []
  const nodes = [...held, ...nodesToUnlock(classId, skillId).filter((id) => !held.includes(id))]
  const hero = { ...base.hero, allocatedNodeIds: nodes }
  if (variant === 'four') return { ...base, hero: { ...hero, equippedSkillIds: equipped, priorityRows: rows } }
  const row: PriorityRow = { skillId }
  let next: PriorityRow[]
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
}

/** Every class, candidate, elite and tier with the four variants, in rules mode. A variant that would pass the row cap is not run and is listed with the note `row cap`. */
export function runSlotsMatrix(seed: number, runs: number, filter: SlotsFilter = {}): SlotRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: SlotRow[] = []
  for (const classId of HERO_CLASSES) {
    if (filter.classes !== undefined && !filter.classes.includes(classId)) continue
    for (const skillId of FIFTH_SKILL_CANDIDATES[classId]) {
      for (const elite of ELITE_IDS) {
        if (filter.elites !== undefined && !filter.elites.includes(elite)) continue
        for (const tier of SLOT_TIERS) {
          if (filter.tiers !== undefined && !filter.tiers.includes(tier)) continue
          const cell = ELITE_CELLS.find((entry) => entry.elite === elite && entry.tier === tier)!
          for (const variant of SLOT_VARIANTS) {
            const setup = slotSetup(classId, cell, skillId, variant)
            if (setup === null) {
              rows.push({ classId, elite, tier, skillId, variant, winRate: null, hpLost: null, medianWinMs: null, note: ROW_CAP_NOTE })
              continue
            }
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
            rows.push({ classId, elite, tier, skillId, variant, winRate: wins / runs, hpLost: lost / runs, medianWinMs: winTimes[Math.floor(winTimes.length / 2)] ?? null, note: null })
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
