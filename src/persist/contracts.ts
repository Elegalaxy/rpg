import { encounters } from '../content/encounters.ts'
import { BOARD_SIZE, MAX_ACTIVE_CONTRACTS, rollContract, targetKey, type ContractDef } from '../content/contracts.ts'
import { nodes, routes } from '../content/world.ts'
import type { ExpeditionState } from '../sim/expedition.ts'
import { awardXp } from '../sim/progression.ts'
import { createRng, deriveSeed, nextFloat } from '../sim/rng.ts'

import { scaleHeirlooms } from './reincarnation.ts'
import type { RosterResult } from './roster.ts'
import { contractFor, purseOf, updatePurse, type ActiveContract, type SaveData, type SavedHero } from './save.ts'

/** Base seed for contract rolls. Each hero and roll index derives its own stream from it. */
const BOARD_SEED = 0x60a2d

function closed(save: SaveData): string | null {
  return save.expedition === null ? null : 'The contract board is closed while an expedition is running.'
}

export function isComplete(active: ActiveContract, def: ContractDef | undefined): boolean {
  return def !== undefined && active.progress >= def.count
}

function heroNumber(heroId: string): number {
  const match = /(\d+)$/.exec(heroId)
  return match?.[1] === undefined ? 0 : Number(match[1])
}

/** The board with every empty slot filled by a new roll. Taken offers stay where they are. */
export function withFilledBoard(hero: SavedHero, discoveries: readonly string[]): SavedHero {
  const board = [...hero.purse.board]
  let rolls = hero.purse.boardRolls
  while (board.length < BOARD_SIZE) {
    const rng = createRng(deriveSeed(deriveSeed(BOARD_SEED, heroNumber(hero.id)), rolls))
    const offer = rollContract(`${hero.id}-contract-${rolls + 1}`, discoveries, () => nextFloat(rng), board.map((entry) => targetKey(entry.target)), hero)
    rolls += 1
    if (offer === null) break
    board.push(offer)
  }
  if (board.length === hero.purse.board.length && rolls === hero.purse.boardRolls) return hero
  return { ...hero, purse: { ...hero.purse, board, boardRolls: rolls } }
}

/** Reroll every offer the hero has not taken. Used when the hero comes back from an expedition. */
export function withRefreshedBoard(hero: SavedHero, discoveries: readonly string[]): SavedHero {
  const taken = hero.purse.contracts.map((entry) => entry.contractId)
  const kept = hero.purse.board.filter((entry) => taken.includes(entry.id))
  return withFilledBoard({ ...hero, purse: { ...hero.purse, board: kept } }, discoveries)
}

function mapHero(save: SaveData, heroId: string, change: (hero: SavedHero) => SavedHero): SaveData {
  return { ...save, heroes: save.heroes.map((hero) => (hero.id === heroId ? change(hero) : hero)) }
}

/** Fill a hero's empty board slots. */
export function fillBoard(save: SaveData, heroId: string): SaveData {
  return mapHero(save, heroId, (hero) => withFilledBoard(hero, save.account.discoveries))
}

/** Reroll the offers a hero has not taken. */
export function refreshBoard(save: SaveData, heroId: string): SaveData {
  return mapHero(save, heroId, (hero) => withRefreshedBoard(hero, save.account.discoveries))
}

/** Take an offer off the board and roll a new one in its place. */
function replaceOffer(save: SaveData, heroId: string, contractId: string): SaveData {
  return mapHero(save, heroId, (hero) =>
    withFilledBoard({ ...hero, purse: { ...hero.purse, board: hero.purse.board.filter((entry) => entry.id !== contractId) } }, save.account.discoveries),
  )
}

/** The selected hero takes an offer from its board. At most three are active per hero. */
export function acceptContract(save: SaveData, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  if (save.selectedHeroId === null) return { ok: false, reason: 'Select a hero to take a contract.' }
  const purse = purseOf(save)
  if (!purse.board.some((entry) => entry.id === contractId)) return { ok: false, reason: 'That contract is not on the board.' }
  const taken = purse.contracts
  if (taken.some((entry) => entry.contractId === contractId)) return { ok: false, reason: 'You already have that contract.' }
  if (taken.length >= MAX_ACTIVE_CONTRACTS) {
    return { ok: false, reason: `You can have at most ${MAX_ACTIVE_CONTRACTS} contracts at once.` }
  }
  return { ok: true, save: updatePurse(save, { contracts: [...taken, { contractId, progress: 0 }] }) }
}

/** The selected hero gives a contract up. Its progress is lost, and a new offer takes its slot. */
export function abandonContract(save: SaveData, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const taken = purseOf(save).contracts
  if (!taken.some((entry) => entry.contractId === contractId)) return { ok: false, reason: 'You do not have that contract.' }
  const dropped = updatePurse(save, { contracts: taken.filter((entry) => entry.contractId !== contractId) })
  return { ok: true, save: save.selectedHeroId === null ? dropped : replaceOffer(dropped, save.selectedHeroId, contractId) }
}

/** Collect a hero's finished contract: gold, materials, and XP all go to that hero. A new offer takes its slot. */
export function collectContract(save: SaveData, heroId: string, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'Select a hero to collect the reward.' }
  const purse = hero.purse
  const def = contractFor(purse, contractId)
  const active = purse.contracts.find((entry) => entry.contractId === contractId)
  if (def === undefined || active === undefined) return { ok: false, reason: 'You do not have that contract.' }
  if (!isComplete(active, def)) return { ok: false, reason: `${def.name} is not finished: ${active.progress} of ${def.count}.` }
  const reward = def.reward
  const materials = { ...purse.materials }
  materials[reward.materialId] = (materials[reward.materialId] ?? 0) + reward.materialQuantity
  const paid = {
    ...purse,
    gold: purse.gold + reward.gold,
    materials,
    contracts: purse.contracts.filter((entry) => entry.contractId !== contractId),
  }
  const collected = scaleHeirlooms(
    {
      ...save,
      heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, progress: awardXp(entry.progress, reward.xp), purse: paid } : entry)),
    },
    heroId,
  )
  return { ok: true, save: replaceOffer(collected, heroId, contractId) }
}

/** The node each fight on the expedition's route happened at, in order. */
function fightNodes(expedition: ExpeditionState): string[] {
  const route = routes[expedition.id]
  if (route === undefined) return []
  const ids: string[] = []
  for (const nodeId of route.nodeIds) {
    const node = nodes[nodeId]
    const count = node?.encounterIds.length ?? 0
    for (let index = 0; index < count; index += 1) ids.push(nodeId)
  }
  return ids
}

/** How many units of a contract the expedition's won fights add. Defeats and retreats count for nothing. */
export function unitsFrom(expedition: ExpeditionState, def: ContractDef): number {
  const where = fightNodes(expedition)
  // Fights past the route's fixed ones are drawn at its last zone.
  const last = where[where.length - 1]
  let units = 0
  for (const entry of expedition.history) {
    if (entry.outcome !== 'victory') continue
    const target = def.target
    if (target.kind === 'fights') {
      if ((where[entry.index] ?? last) === target.nodeId) units += 1
    } else if (target.kind === 'encounters') {
      if (target.encounterIds.includes(entry.encounterId)) units += 1
    } else if (target.kind === 'secure') {
      continue
    } else {
      for (const member of encounters[entry.encounterId]?.members ?? []) if (member.enemyId === target.enemyId) units += 1
    }
  }
  if (def.target.kind === 'secure') {
    // Counted from what the run brings home: a safe return, a retreat, or the defeat pouch.
    const materialId = def.target.materialId
    units += expedition.secured.filter((stack) => stack.materialId === materialId).reduce((sum, stack) => sum + stack.quantity, 0)
  }
  return units
}

/** What a live run has already earned toward each of the selected hero's active contracts, before it is settled. */
export function pendingContractProgress(save: SaveData, expedition: ExpeditionState): { contractId: string; name: string; pending: number; progress: number; count: number }[] {
  const purse = purseOf(save)
  const rows: { contractId: string; name: string; pending: number; progress: number; count: number }[] = []
  for (const active of purse.contracts) {
    const def = contractFor(purse, active.contractId)
    if (def === undefined) continue
    const pending = Math.min(def.count - active.progress, unitsFrom(expedition, def))
    if (pending > 0) rows.push({ contractId: def.id, name: def.name, pending, progress: active.progress, count: def.count })
  }
  return rows
}

/** Add an expedition's won fights to the selected hero's active contracts, never past their target. */
export function addContractProgress(save: SaveData, expedition: ExpeditionState): SaveData {
  const purse = purseOf(save)
  if (purse.contracts.length === 0) return save
  const contractsNow = purse.contracts.map((active): ActiveContract => {
    const def = contractFor(purse, active.contractId)
    if (def === undefined) return active
    const progress = Math.min(def.count, active.progress + unitsFrom(expedition, def))
    return progress === active.progress ? active : { ...active, progress }
  })
  return updatePurse(save, { contracts: contractsNow })
}
