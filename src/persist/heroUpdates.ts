import { contracts } from '../content/contracts.ts'
import { DEFAULT_SUPPLY_ROWS, GREATER_DRAUGHT_ROW, RIFTGLASS_WARD_ROW, RULE_SUPPLY_IDS, WARD_CHARM_ROW, WARMING_TONIC_BURN_ROW, WARMING_TONIC_ROW } from '../content/supplies.ts'
import { referenceLoadoutFor } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'
import type { PriorityRow } from '../sim/types.ts'

import { withFilledBoard } from './contracts.ts'
import type { SaveData, SavedHero } from './save.ts'

/**
 * One-time changes for heroes made before a content change, applied once when a save loads. A hero
 * lists the ones it already has, so a rule the player later removes does not come back. New heroes
 * start with every id.
 */
export const HERO_UPDATES = ['supply-rules', 'ranger-fade-back', 'contract-board', 'ward-charm-rule', 'warming-tonic-rule', 'crafted-supply-rules', 'warming-tonic-burn-rule'] as const

const FADE_BACK = 'fade-back'
const VOLLEY = 'volley'

function copyRow(row: PriorityRow): PriorityRow {
  return { ...row, ...(row.conditions === undefined ? {} : { conditions: row.conditions.map((condition) => ({ ...condition })) }) }
}

/** The two supply rules go on top, as far as the 12-rule limit allows, unless a rule already names a supply. */
function addSupplyRules(hero: SavedHero): SavedHero {
  if (hero.priorityRows.some((row) => RULE_SUPPLY_IDS.includes(row.skillId))) return hero
  const room = Math.max(0, MAX_PRIORITY_ROWS - hero.priorityRows.length)
  return { ...hero, priorityRows: [...DEFAULT_SUPPLY_ROWS.slice(0, room).map(copyRow), ...hero.priorityRows] }
}

/**
 * Fade Back replaced Volley in the Ranger's starting four on 2026-11-03. Every Ranger learns it. A
 * Volley that came from that old starting kit, not the Volley node, gives its slot to Fade Back, and
 * its rules give way to the starting Fade Back rule. Volley stays learned.
 */
function addFadeBack(hero: SavedHero): SavedHero {
  if (hero.classId !== 'ranger') return hero
  const progress = hero.progress
  const learnedSkillIds = progress.learnedSkillIds.includes(FADE_BACK) ? progress.learnedSkillIds : [...progress.learnedSkillIds, FADE_BACK]
  const volleyNode = classWebs.ranger.nodes.find((node) => node.unlocksSkillId === VOLLEY)?.id
  const starterVolley = progress.loadout.includes(VOLLEY) && !progress.loadout.includes(FADE_BACK) && (volleyNode === undefined || !progress.allocatedNodeIds.includes(volleyNode))
  if (!starterVolley) return { ...hero, progress: { ...progress, learnedSkillIds } }
  const fadeRow = referenceLoadoutFor('ranger').priorityRows.find((row) => row.skillId === FADE_BACK)
  const kept = hero.priorityRows.filter((row) => row.skillId !== VOLLEY)
  const supplyRows = kept.filter((row) => RULE_SUPPLY_IDS.includes(row.skillId)).length
  const rows = fadeRow === undefined || kept.length >= MAX_PRIORITY_ROWS ? kept : [...kept.slice(0, supplyRows), copyRow(fadeRow), ...kept.slice(supplyRows)]
  return {
    ...hero,
    progress: { ...progress, learnedSkillIds, loadout: progress.loadout.map((id) => (id === VOLLEY ? FADE_BACK : id)) },
    priorityRows: rows,
  }
}

/**
 * The board became rolled on 2026-11-04. A contract the hero already holds from the old fixed board
 * goes onto the new board unchanged, and the other slots are rolled.
 */
function addContractBoard(hero: SavedHero, save: SaveData): SavedHero {
  const held = hero.purse.contracts.flatMap((entry) => {
    const def = hero.purse.board.some((offer) => offer.id === entry.contractId) ? undefined : contracts[entry.contractId]
    return def === undefined ? [] : [{ ...def, reward: { ...def.reward } }]
  })
  return withFilledBoard({ ...hero, purse: { ...hero.purse, board: [...held, ...hero.purse.board] } }, save.account.discoveries)
}

/** The Ward Charm came on 2026-11-04. Its rule goes after the hero's other supply rules, unless a rule already names it. */
function addWardCharmRule(hero: SavedHero): SavedHero {
  if (hero.priorityRows.some((row) => row.skillId === WARD_CHARM_ROW.skillId)) return hero
  if (hero.priorityRows.length >= MAX_PRIORITY_ROWS) return hero
  const supplyRows = hero.priorityRows.findIndex((row) => !RULE_SUPPLY_IDS.includes(row.skillId))
  const at = supplyRows < 0 ? hero.priorityRows.length : supplyRows
  return { ...hero, priorityRows: [...hero.priorityRows.slice(0, at), copyRow(WARD_CHARM_ROW), ...hero.priorityRows.slice(at)] }
}

/** The Warming Tonic came on 2026-11-08. Its rule goes after the hero's other supply rules, unless a rule already names it. */
function addWarmingTonicRule(hero: SavedHero): SavedHero {
  return addSupplyRowAfterSupplies(hero, WARMING_TONIC_ROW)
}

function addSupplyRowAfterSupplies(hero: SavedHero, row: PriorityRow): SavedHero {
  if (hero.priorityRows.some((existing) => existing.skillId === row.skillId)) return hero
  if (hero.priorityRows.length >= MAX_PRIORITY_ROWS) return hero
  const supplyRows = hero.priorityRows.findIndex((existing) => !RULE_SUPPLY_IDS.includes(existing.skillId))
  const at = supplyRows < 0 ? hero.priorityRows.length : supplyRows
  return { ...hero, priorityRows: [...hero.priorityRows.slice(0, at), copyRow(row), ...hero.priorityRows.slice(at)] }
}

/**
 * The Greater Draught and Riftglass Ward came on 2026-11-08. Each rule goes just above its basic
 * counterpart (Healing Draught, Ward Charm), or after the supply rules when the hero has no such row,
 * unless a rule already names it.
 */
function addCraftedSupplyRules(hero: SavedHero): SavedHero {
  let next = hero
  for (const [row, counterpart] of [
    [GREATER_DRAUGHT_ROW, 'healing-draught'],
    [RIFTGLASS_WARD_ROW, 'ward-charm'],
  ] as const) {
    if (next.priorityRows.some((existing) => existing.skillId === row.skillId)) continue
    if (next.priorityRows.length >= MAX_PRIORITY_ROWS) continue
    const above = next.priorityRows.findIndex((existing) => existing.skillId === counterpart)
    const firstOther = next.priorityRows.findIndex((existing) => !RULE_SUPPLY_IDS.includes(existing.skillId))
    const at = above >= 0 ? above : firstOther < 0 ? next.priorityRows.length : firstOther
    next = { ...next, priorityRows: [...next.priorityRows.slice(0, at), copyRow(row), ...next.priorityRows.slice(at)] }
  }
  return next
}

/**
 * The Warming Tonic's Burn rule came on 2026-11-09. It goes right after the hero's own Warming Tonic row, or after
 * the supply rules when the hero has none, unless a Warming Tonic row already reads Burn.
 */
function addWarmingTonicBurnRule(hero: SavedHero): SavedHero {
  const row = WARMING_TONIC_BURN_ROW
  const readsBurn = (existing: PriorityRow): boolean =>
    existing.skillId === row.skillId && (existing.conditions ?? []).some((condition) => condition.kind === 'status' && condition.statusId === 'burn')
  if (hero.priorityRows.some(readsBurn)) return hero
  if (hero.priorityRows.length >= MAX_PRIORITY_ROWS) return hero
  const tonic = hero.priorityRows.findIndex((existing) => existing.skillId === row.skillId)
  const firstOther = hero.priorityRows.findIndex((existing) => !RULE_SUPPLY_IDS.includes(existing.skillId))
  const at = tonic >= 0 ? tonic + 1 : firstOther < 0 ? hero.priorityRows.length : firstOther
  return { ...hero, priorityRows: [...hero.priorityRows.slice(0, at), copyRow(row), ...hero.priorityRows.slice(at)] }
}

const APPLY: { [id in (typeof HERO_UPDATES)[number]]: (hero: SavedHero, save: SaveData) => SavedHero } = {
  'supply-rules': addSupplyRules,
  'ranger-fade-back': addFadeBack,
  'contract-board': addContractBoard,
  'ward-charm-rule': addWardCharmRule,
  'warming-tonic-rule': addWarmingTonicRule,
  'crafted-supply-rules': addCraftedSupplyRules,
  'warming-tonic-burn-rule': addWarmingTonicBurnRule,
}

/** Apply every update a hero does not have yet, in order, and record it. */
export function applyHeroUpdates(save: SaveData): SaveData {
  let changed = false
  const heroes = save.heroes.map((hero) => {
    let next = hero
    for (const id of HERO_UPDATES) {
      if (next.updates.includes(id)) continue
      next = { ...APPLY[id](next, save), updates: [...next.updates, id] }
      changed = true
    }
    return next
  })
  return changed ? { ...save, heroes } : save
}
