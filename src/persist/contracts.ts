import { encounters } from '../content/encounters.ts'
import { MAX_ACTIVE_CONTRACTS, contracts, type ContractDef } from '../content/contracts.ts'
import { nodes, routes } from '../content/world.ts'
import type { ExpeditionState } from '../sim/expedition.ts'
import { awardXp } from '../sim/progression.ts'

import { scaleHeirlooms } from './reincarnation.ts'
import type { RosterResult } from './roster.ts'
import type { ActiveContract, SaveData } from './save.ts'

function closed(save: SaveData): string | null {
  return save.expedition === null ? null : 'The contract board is closed while an expedition is running.'
}

export function isComplete(active: ActiveContract): boolean {
  const def = contracts[active.contractId]
  return def !== undefined && active.progress >= def.count
}

/** Take a contract. At most three are active, and a contract can be active once. */
export function acceptContract(save: SaveData, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  if (contracts[contractId] === undefined) return { ok: false, reason: 'That contract is not on the board.' }
  if (save.account.contracts.some((entry) => entry.contractId === contractId)) return { ok: false, reason: 'You already have that contract.' }
  if (save.account.contracts.length >= MAX_ACTIVE_CONTRACTS) {
    return { ok: false, reason: `You can have at most ${MAX_ACTIVE_CONTRACTS} contracts at once.` }
  }
  const next = { ...save.account, contracts: [...save.account.contracts, { contractId, progress: 0 }] }
  return { ok: true, save: { ...save, account: next } }
}

/** Give a contract up. Its progress is lost. */
export function abandonContract(save: SaveData, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  if (!save.account.contracts.some((entry) => entry.contractId === contractId)) return { ok: false, reason: 'You do not have that contract.' }
  const next = { ...save.account, contracts: save.account.contracts.filter((entry) => entry.contractId !== contractId) }
  return { ok: true, save: { ...save, account: next } }
}

/** Collect a finished contract: gold and materials to the account, XP to the hero who collects. */
export function collectContract(save: SaveData, heroId: string, contractId: string): RosterResult {
  const shut = closed(save)
  if (shut !== null) return { ok: false, reason: shut }
  const def = contracts[contractId]
  const active = save.account.contracts.find((entry) => entry.contractId === contractId)
  if (def === undefined || active === undefined) return { ok: false, reason: 'You do not have that contract.' }
  if (!isComplete(active)) return { ok: false, reason: `${def.name} is not finished: ${active.progress} of ${def.count}.` }
  const hero = save.heroes.find((entry) => entry.id === heroId)
  if (hero === undefined) return { ok: false, reason: 'Select a hero to collect the experience.' }
  const reward = def.reward
  const materials = { ...save.account.materials }
  materials[reward.materialId] = (materials[reward.materialId] ?? 0) + reward.materialQuantity
  return {
    ok: true,
    save: scaleHeirlooms({
      ...save,
      account: {
        ...save.account,
        gold: save.account.gold + reward.gold,
        materials,
        contracts: save.account.contracts.filter((entry) => entry.contractId !== contractId),
      },
      heroes: save.heroes.map((entry) => (entry.id === heroId ? { ...entry, progress: awardXp(entry.progress, reward.xp) } : entry)),
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

/** Add an expedition's won fights to the active contracts, never past their target. */
export function addContractProgress(save: SaveData, expedition: ExpeditionState): SaveData {
  if (save.account.contracts.length === 0) return save
  const contractsNow = save.account.contracts.map((active): ActiveContract => {
    const def = contracts[active.contractId]
    if (def === undefined) return active
    const progress = Math.min(def.count, active.progress + unitsFrom(expedition, def))
    return progress === active.progress ? active : { ...active, progress }
  })
  return { ...save, account: { ...save.account, contracts: contractsNow } }
}
