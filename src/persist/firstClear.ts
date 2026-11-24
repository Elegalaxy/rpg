import { FIRST_CLEAR_NODE_IDS, firstClearReward, type FirstClearReward } from '../content/firstClear.ts'
import { uniqueDef } from '../sim/uniques.ts'
import type { SavedHero } from './save.ts'

/**
 * First-clear rewards (GAME_DESIGN §9, Step 13.24). A node the hero has cleared that has not been paid yet is
 * due. Payment happens when a run ends in a safe return (`settleExpedition`); this file knows nothing about runs.
 */

/** The rewards this hero is owed, in node order: cleared nodes with a reward that are not in `firstClearIds`. */
export function firstClearsDue(hero: SavedHero): FirstClearReward[] {
  const paid = hero.firstClearIds ?? []
  return FIRST_CLEAR_NODE_IDS.flatMap((id) => {
    const reward = firstClearReward(id)
    return reward === null || paid.includes(id) || !hero.clearedNodeIds.includes(id) ? [] : [reward]
  })
}

/** Free upgrades for an ordinary Echo rank first unlocked (Step 13.51). */
export const ECHO_RANK_TOKENS = 1
/** Free upgrades for a milestone Echo rank (Step 13.52). */
export const ECHO_MILESTONE_TOKENS = 3
/** A milestone rank also pays this much gold per rank number. */
export const ECHO_MILESTONE_GOLD_PER_RANK = 500

/** Milestone Echo ranks: 3, then every fifth rank (5, 10, 15, ...). */
export function isEchoMilestone(rank: number): boolean {
  return rank === 3 || (rank > 0 && rank % 5 === 0)
}

export interface EchoReward {
  tokens: number
  gold: number
  milestone: boolean
}

/** What first unlocking Echo rank `rank` pays. */
export function echoReward(rank: number): EchoReward {
  const milestone = isEchoMilestone(rank)
  return milestone ? { tokens: ECHO_MILESTONE_TOKENS, gold: ECHO_MILESTONE_GOLD_PER_RANK * rank, milestone } : { tokens: ECHO_RANK_TOKENS, gold: 0, milestone }
}

/** Reward text for a toast or the preparation screen, e.g. "3 free upgrades and 2,500 g". */
export function echoRewardText(rank: number): string {
  const reward = echoReward(rank)
  const upgrades = `${reward.tokens} free upgrade${reward.tokens === 1 ? '' : 's'}`
  return reward.gold > 0 ? `${upgrades} and ${reward.gold.toLocaleString('en-US')} g` : upgrades
}

/** The id recorded in `firstClearIds` once Echo rank `rank` has paid its reward. */
export function echoRewardId(rank: number): string {
  return `echo:${rank}`
}

/** The Echo ranks 1 to the hero's `echoRank` whose reward has not been paid yet. */
export function echoRewardsDue(hero: SavedHero): number[] {
  const paid = hero.firstClearIds ?? []
  const ranks: number[] = []
  for (let rank = 1; rank <= hero.echoRank; rank += 1) if (!paid.includes(echoRewardId(rank))) ranks.push(rank)
  return ranks
}

/** The name a paid id shows in reports: the node name, "Echo rank N", or a unique item's name. */
export function firstClearLabel(id: string, nodeName: string | undefined): string {
  if (id.startsWith('unique:')) return uniqueDef(id.slice('unique:'.length))?.name ?? id
  return id.startsWith('echo:') ? `Echo rank ${id.slice(5)}${isEchoMilestone(Number(id.slice(5))) ? ' (milestone)' : ''}` : (nodeName ?? id)
}

/** Pay everything due into the hero's purse and free upgrades, and record it. The same hero object when nothing is due. */
export function payFirstClears(hero: SavedHero): { hero: SavedHero; paid: FirstClearReward[] } {
  const due = firstClearsDue(hero)
  const echoDue = echoRewardsDue(hero)
  if (due.length === 0 && echoDue.length === 0) return { hero, paid: [] }
  const materials = { ...hero.purse.materials }
  let gold = hero.purse.gold
  let tokens = hero.freeUpgrades ?? 0
  for (const reward of due) {
    gold += reward.gold
    if (reward.materialId !== null) materials[reward.materialId] = (materials[reward.materialId] ?? 0) + reward.quantity
    tokens += reward.tokens
  }
  for (const rank of echoDue) {
    const reward = echoReward(rank)
    tokens += reward.tokens
    gold += reward.gold
  }
  return {
    hero: {
      ...hero,
      purse: { ...hero.purse, gold, materials },
      freeUpgrades: tokens,
      firstClearIds: [...(hero.firstClearIds ?? []), ...due.map((reward) => reward.nodeId), ...echoDue.map(echoRewardId)],
    },
    paid: due,
  }
}
