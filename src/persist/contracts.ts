import { encounters } from '../content/encounters.ts'
import { MAX_ACTIVE_CONTRACTS, contracts, type ContractDef } from '../content/contracts.ts'
import { nodes, routes } from '../content/world.ts'
import type { ExpeditionState } from '../sim/expedition.ts'
import { awardXp } from '../sim/progression.ts'

import { scaleHeirlooms } from './reincarnation.ts'
import type { RosterResult } from './roster.ts'
import { purseOf, updatePurse, type ActiveContract, type SaveData } from './save.ts'

function closed(save: SaveData): string | null {
  return save.expedition === null ? null : 'The contract board is closed while an expedition is running.'
}

export function isComplete(active: ActiveContract): boolean {
  const def = contracts[active.contractId]
  return def !== undefined && active.progress >= def.count
}

/** The selected hero takes a contract. At most three are active per hero, and a contract can be active once. */
export function acceptContract(save: SaveData, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  if (contracts[contractId] === undefined) return { ok: false, reason: 'That contract is not on the board.' }
  if (save.selectedHeroId === null) return { ok: false, reason: 'Select a hero to take a contract.' }
  const taken = purseOf(save).contracts
  if (taken.some((entry) => entry.contractId === contractId)) return { ok: false, reason: 'You already have that contract.' }
  if (taken.length >= MAX_ACTIVE_CONTRACTS) {
    return { ok: false, reason: `You can have at most ${MAX_ACTIVE_CONTRACTS} contracts at once.` }
  }
  return { ok: true, save: updatePurse(save, { contracts: [...taken, { contractId, progress: 0 }] }) }
}

/** The selected hero gives a contract up. Its progress is lost. */
export function abandonContract(save: SaveData, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const taken = purseOf(save).contracts
  if (!taken.some((entry) => entry.contractId === contractId)) return { ok: false, reason: 'You do not have that contract.' }
  return { ok: true, save: updatePurse(save, { contracts: taken.filter((entry) => entry.contractId !== contractId) }) }
}

/** Collect a hero's finished contract: gold, materials, and XP all go to that hero. */
export function collectContract(save: SaveData, heroId: string, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'Select a hero to collect the reward.' }
  const def = contracts[contractId]
  const purse = hero.purse
  const active = purse.contracts.find((entry) => entry.contractId === contractId)
  if (def === undefined || active === undefined) return { ok: false, reason: 'You do not have that contract.' }
  if (!isComplete(active)) return { ok: false, reason: `${def.name} is not finished: ${active.progress} of ${def.count}.` }
  const reward = def.reward
  const materials = { ...purse.materials }
  materials[reward.materialId] = (materials[reward.materialId] ?? 0) + reward.materialQuantity
  const paid = {
    ...purse,
    gold: purse.gold + reward.gold,
    materials,
    contracts: purse.contracts.filter((entry) => entry.contractId !== contractId),
  }
  return {
    ok: true,
    save: scaleHeirlooms({
      ...save,
      heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, progress: awardXp(entry.progress, reward.xp), purse: paid } : entry)),
    }, heroId),
  }
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
  let units = 0
  for (const entry of expedition.history) {
    if (entry.outcome !== 'victory') continue
    const target = def.target
    if (target.kind === 'fights') {
      if (where[entry.index] === target.nodeId) units += 1
    } else if (target.kind === 'encounters') {
      if (target.encounterIds.includes(entry.encounterId)) units += 1
    } else {
      for (const member of encounters[entry.encounterId]?.members ?? []) if (member.enemyId === target.enemyId) units += 1
    }
  }
  return units
}

/** Add an expedition's won fights to the selected hero's active contracts, never past their target. */
export function addContractProgress(save: SaveData, expedition: ExpeditionState): SaveData {
  const taken = purseOf(save).contracts
  if (taken.length === 0) return save
  const contractsNow = taken.map((active): ActiveContract => {
    const def = contracts[active.contractId]
    if (def === undefined) return active
    const progress = Math.min(def.count, active.progress + unitsFrom(expedition, def))
    return progress === active.progress ? active : { ...active, progress }
  })
  return updatePurse(save, { contracts: contractsNow })
}
