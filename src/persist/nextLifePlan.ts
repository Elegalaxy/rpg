import { EQUIPMENT_SLOT_IDS, type ItemInstance } from '../sim/economy.ts'

import { heirloomAllowance, stageNextLife, type PlannedPurchase, type PurchaseKind } from './reincarnation.ts'
import type { SavedHero } from './save.ts'

/**
 * The between-lives plan kept on the hero (Step 13.43): the purchases staged in the planner and the heirloom picks.
 * Only the planner reads it. It never changes the ending life, a price or a reincarnation; it is cleared by `reincarnate`.
 */

export type SavedPlan = { purchases: PlannedPurchase[]; picks: string[] }

export const PURCHASE_KINDS: readonly PurchaseKind[] = ['attribute', 'skill', 'heirloom', 'pockets', 'headStart', 'stockpile', 'artisan', 'memory', 'fifthSlot']

/** Items the hero could make an heirloom: the worn ones and the archive pieces that are not another hero's heirloom. */
export function heirloomCandidates(hero: SavedHero): ItemInstance[] {
  return [
    ...EQUIPMENT_SLOT_IDS.flatMap((slot) => (hero.equipment[slot] === null ? [] : [hero.equipment[slot]!])),
    ...hero.purse.archive.filter((item) => item.heirloom === undefined || item.heirloom.heroId === hero.id),
  ]
}

/** The picks the planner starts with when nothing is saved: the hero's current heirlooms. */
export function defaultPicks(hero: SavedHero): string[] {
  return heirloomCandidates(hero)
    .filter((item) => item.heirloom?.heroId === hero.id)
    .map((item) => item.id)
}

export type PlanDrop = { kind: 'purchase'; item: PlannedPurchase; reason: string } | { kind: 'heirloom'; reason: string }

export type RestoredPlan = { plan: PlannedPurchase[]; picks: string[]; dropped: PlanDrop[] }

/**
 * The saved plan checked against the hero as they are now. A purchase is kept only if it can still be bought in order
 * (affordable, not already bought); a pick is kept only if the item is still owned and a slot exists for it. Every
 * entry that fails is returned in `dropped` with its reason so the planner can say so.
 */
export function restorePlan(hero: SavedHero): RestoredPlan {
  const saved = hero.nextLifePlan
  if (saved === undefined) return { plan: [], picks: defaultPicks(hero), dropped: [] }
  const dropped: PlanDrop[] = []
  const plan: PlannedPurchase[] = []
  for (const item of saved.purchases) {
    if (!PURCHASE_KINDS.includes(item.kind)) {
      dropped.push({ kind: 'purchase', item, reason: 'It is no longer offered.' })
      continue
    }
    const tried = stageNextLife(hero, [...plan, item])
    if (tried.ok) plan.push(item)
    else dropped.push({ kind: 'purchase', item, reason: tried.reason })
  }
  const staged = stageNextLife(hero, plan)
  const allowance = staged.ok ? heirloomAllowance(staged.hero) : heirloomAllowance(hero)
  const owned = new Set(heirloomCandidates(hero).map((item) => item.id))
  const picks = saved.picks.map((id, index) => {
    if (id === '') return ''
    if (!owned.has(id)) {
      dropped.push({ kind: 'heirloom', reason: 'An item you picked as an heirloom is no longer owned.' })
      return ''
    }
    if (index >= allowance) {
      dropped.push({ kind: 'heirloom', reason: 'An heirloom pick lost its slot.' })
      return ''
    }
    return id
  })
  return { plan, picks, dropped }
}

/** Whether a plan is the planner's starting state, so nothing needs saving. */
export function isDefaultPlan(hero: SavedHero, plan: readonly PlannedPurchase[], picks: readonly string[]): boolean {
  const chosen = picks.filter((id) => id !== '')
  const base = defaultPicks(hero)
  return plan.length === 0 && chosen.length === base.length && chosen.every((id, index) => id === base[index])
}

/** The hero with the plan saved, or with the field removed when the plan is the starting state. */
export function withSavedPlan(hero: SavedHero, plan: readonly PlannedPurchase[], picks: readonly string[]): SavedHero {
  const { nextLifePlan: _old, ...rest } = hero
  if (isDefaultPlan(hero, plan, picks)) return rest
  return { ...rest, nextLifePlan: { purchases: plan.map((item) => ({ ...item })), picks: [...picks] } }
}
