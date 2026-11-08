import { gameDefs } from '../content/scenarios.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { CAUSEWAY_FIGHTS, CAUSEWAY_TIERS } from './causeway.ts'
import { HOLLOWS_FIGHTS, HOLLOWS_TIERS } from './hollows.ts'
import { blindSetup } from './telegraph.ts'
import { WARDEN_TIERS, craftedVariant, wardenSetup, type WardenTier } from './warden.ts'

/**
 * Elite measurements for the class balance pass (Step 13.5 part 1): the Warden, the Tidebound Colossus and the
 * Hollowmaw Reaver for every class, with the class reference rules and with the telegraph and interrupt rows
 * removed, plus a crafted-supplies variant of each prepared tier. Measurements only; nothing here tunes.
 */
export const ELITE_IDS = ['warden', 'colossus', 'reaver'] as const
export type EliteId = (typeof ELITE_IDS)[number]

export const ELITE_MODES = ['rules', 'blind'] as const
export type EliteMode = (typeof ELITE_MODES)[number]

const wardenTier = (id: string): WardenTier => WARDEN_TIERS.find((tier) => tier.id === id)!
const causewayTier = (id: string): WardenTier => CAUSEWAY_TIERS.find((tier) => tier.id === id)!
const hollowsTier = (id: string): WardenTier => HOLLOWS_TIERS.find((tier) => tier.id === id)!

export type EliteCell = {
  elite: EliteId
  /** Tier id; a crafted variant ends in `-crafted`. */
  tier: string
  tierDef: WardenTier
}

/** The tiers measured per elite: Warden prepared/over/causeway, Colossus arrived/prepared/over, Reaver prepared/over, plus a crafted variant of each prepared tier. */
export const ELITE_CELLS: readonly EliteCell[] = [
  ...(['prepared', 'over', 'causeway'] as const).map((id) => ({ elite: 'warden' as const, tier: id, tierDef: wardenTier(id) })),
  { elite: 'warden', tier: 'prepared-crafted', tierDef: craftedVariant(wardenTier('prepared')) },
  ...(['arrived', 'prepared', 'over'] as const).map((id) => ({ elite: 'colossus' as const, tier: id, tierDef: causewayTier(id) })),
  { elite: 'colossus', tier: 'prepared-crafted', tierDef: craftedVariant(causewayTier('prepared')) },
  ...(['prepared', 'over'] as const).map((id) => ({ elite: 'reaver' as const, tier: id, tierDef: hollowsTier(id) })),
  { elite: 'reaver', tier: 'prepared-crafted', tierDef: craftedVariant(hollowsTier('prepared')) },
]

/** The diagnostic rows: Warrior and Cleric at the Warden with every row's target priority removed (the old untargeted reference rules, for comparison with the targeted ones). */
export const ELITE_DIAGNOSTIC_CLASSES: readonly HeroClass[] = ['warrior', 'cleric']
export const ELITE_DIAGNOSTIC_TIER = 'prepared'

export type EliteRow = {
  classId: HeroClass
  elite: EliteId
  tier: string
  mode: EliteMode
  /** Set on the diagnostic rows: the hero's target priority override. */
  targeting: 'untargeted' | null
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
  /** Mean share of the elite's HP left at the end (the first enemy), over every run. */
  eliteLeft: number
}

/** The setup for a class against an elite at a tier. */
export function eliteSetup(classId: HeroClass, cell: EliteCell, mode: EliteMode = 'rules'): CombatSetup {
  const base = wardenSetup(classId, cell.tierDef)
  let setup: CombatSetup = base
  if (cell.elite === 'colossus') setup = { ...base, enemies: CAUSEWAY_FIGHTS.find((fight) => fight.id === 'colossus')!.enemies }
  if (cell.elite === 'reaver') setup = { ...base, enemies: HOLLOWS_FIGHTS.find((fight) => fight.id === 'reaver')!.enemies }
  return mode === 'blind' ? blindSetup(setup) : setup
}

function measure(setup: CombatSetup, seed: number, runs: number): { winRate: number; hpLost: number; eliteLeft: number } {
  const defs = gameDefs()
  let wins = 0
  let lost = 0
  let left = 0
  for (let index = 0; index < runs; index += 1) {
    const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
    if (state.outcome === 'victory') wins += 1
    lost += 1 - Math.max(0, state.hero.hp) / state.hero.maxHp
    const first = state.enemies[0]
    left += first === undefined ? 0 : first.hp / first.maxHp
  }
  return { winRate: wins / runs, hpLost: lost / runs, eliteLeft: left / runs }
}

export type EliteFilter = {
  classes?: readonly HeroClass[]
  elites?: readonly EliteId[]
  modes?: readonly EliteMode[]
  /** Tier ids as in `ELITE_CELLS` (for example `prepared`, `over`, `prepared-crafted`). */
  tiers?: readonly string[]
  /** Skip the Warrior and Cleric diagnostic rows. */
  noDiagnostic?: boolean
}

/** Every class against every elite cell in both modes, then the targeting diagnostic rows. */
export function runElitesMatrix(seed: number, runs: number, filter: EliteFilter = {}): EliteRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const rows: EliteRow[] = []
  for (const classId of HERO_CLASSES) {
    if (filter.classes !== undefined && !filter.classes.includes(classId)) continue
    for (const cell of ELITE_CELLS) {
      if (filter.elites !== undefined && !filter.elites.includes(cell.elite)) continue
      if (filter.tiers !== undefined && !filter.tiers.includes(cell.tier)) continue
      for (const mode of ELITE_MODES) {
        if (filter.modes !== undefined && !filter.modes.includes(mode)) continue
        rows.push({ classId, elite: cell.elite, tier: cell.tier, mode, targeting: null, ...measure(eliteSetup(classId, cell, mode), seed, runs) })
      }
    }
  }
  if (filter.noDiagnostic !== true && (filter.elites === undefined || filter.elites.includes('warden'))) {
    const cell = ELITE_CELLS.find((entry) => entry.elite === 'warden' && entry.tier === ELITE_DIAGNOSTIC_TIER)!
    for (const classId of ELITE_DIAGNOSTIC_CLASSES) {
      if (filter.classes !== undefined && !filter.classes.includes(classId)) continue
      const base = eliteSetup(classId, cell)
      const rows0 = (base.hero.priorityRows ?? []).map(({ targetPriority: _unused, ...row }) => row)
      const setup: CombatSetup = { ...base, hero: { ...base.hero, targetPriority: 'current', priorityRows: rows0 } }
      rows.push({ classId, elite: 'warden', tier: cell.tier, mode: 'rules', targeting: 'untargeted', ...measure(setup, seed, runs) })
    }
  }
  return rows
}

/** One line per row: class, elite, tier, mode, then wins, mean HP lost, elite HP left. */
export function formatElitesTable(rows: readonly EliteRow[]): string {
  const lines = rows.map((row) => {
    const target = row.targeting === null ? '' : ` [target ${row.targeting}]`
    return `${row.classId} ${row.elite} ${row.tier} ${row.mode}${target}: wins ${Math.round(row.winRate * 100)}% | lost ${Math.round(row.hpLost * 100)}% | elite left ${Math.round(row.eliteLeft * 100)}%`
  })
  return `${lines.join('\n')}\n`
}
