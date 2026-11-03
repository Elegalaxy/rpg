import { DEFAULT_SUPPLY_ROWS, RULE_SUPPLY_IDS } from '../content/supplies.ts'
import { referenceLoadoutFor } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'
import type { PriorityRow } from '../sim/types.ts'

import type { SaveData, SavedHero } from './save.ts'

/**
 * One-time changes for heroes made before a content change, applied once when a save loads. A hero
 * lists the ones it already has, so a rule the player later removes does not come back. New heroes
 * start with every id.
 */
export const HERO_UPDATES = ['supply-rules', 'ranger-fade-back'] as const

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

const APPLY: { [id in (typeof HERO_UPDATES)[number]]: (hero: SavedHero) => SavedHero } = {
  'supply-rules': addSupplyRules,
  'ranger-fade-back': addFadeBack,
}

/** Apply every update a hero does not have yet, in order, and record it. */
export function applyHeroUpdates(save: SaveData): SaveData {
  let changed = false
  const heroes = save.heroes.map((hero) => {
    let next = hero
    for (const id of HERO_UPDATES) {
      if (next.updates.includes(id)) continue
      next = { ...APPLY[id](next), updates: [...next.updates, id] }
      changed = true
    }
    return next
  })
  return changed ? { ...save, heroes } : save
}
