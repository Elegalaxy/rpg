import type { ContractDef } from '../content/contracts.ts'
import { encounters } from '../content/encounters.ts'
import { nodes, routes } from '../content/world.ts'

import { selectedHero } from './character.ts'
import { acceptContract, collectContract, isComplete } from './contracts.ts'
import { contractFor, type SaveData } from './save.ts'

/** True when a contract's target can be met on this route: its enemy, node, elite encounter or resource is on it. */
export function contractFitsRoute(def: ContractDef, routeId: string): boolean {
  const route = routes[routeId]
  if (route === undefined) return false
  const routeNodes = route.nodeIds.flatMap((id) => (nodes[id] === undefined ? [] : [nodes[id]]))
  const target = def.target
  switch (target.kind) {
    case 'fights':
      return route.nodeIds.includes(target.nodeId)
    case 'encounters':
      return routeNodes.some((node) => target.encounterIds.some((id) => node.encounterIds.includes(id) || node.drawEncounterIds?.includes(id) === true))
    case 'secure':
      return routeNodes.some((node) => node.resource?.materialId === target.materialId)
    case 'kill':
      return routeNodes.some((node) =>
        [...node.encounterIds, ...(node.drawEncounterIds ?? [])].some((id) => encounters[id]?.members.some((member) => member.enemyId === target.enemyId) === true),
      )
  }
}

export type AutoContractsResult = { save: SaveData; handedIn: number; taken: number }

/**
 * Auto run at home after a safe return (Step 13.26): with the hero's `autoContracts` on, collect every finished contract and
 * take board offers that fit the route about to be rerun, up to the free active slots. The save has no run (the finished one
 * is settled). The one function the live loop and the away replay share. Does nothing when the setting is off.
 */
export function autoContractsStep(save: SaveData, routeId: string): AutoContractsResult {
  const none = { save, handedIn: 0, taken: 0 }
  const first = selectedHero(save)
  if (first === null || first.autoContracts !== true || save.expedition !== null) return none
  let current = save
  let handedIn = 0
  let taken = 0
  for (const active of first.purse.contracts) {
    const def = contractFor(first.purse, active.contractId)
    if (!isComplete(active, def)) continue
    const result = collectContract(current, first.id, active.contractId)
    if (result.ok) {
      current = result.save
      handedIn += 1
    }
  }
  // Offers are read after collecting: the board replaced the collected slots.
  for (const offer of selectedHero(current)?.purse.board ?? []) {
    const hero = selectedHero(current)
    if (hero === null) break
    if (hero.purse.contracts.some((entry) => entry.contractId === offer.id)) continue
    if (!contractFitsRoute(offer, routeId)) continue
    const result = acceptContract(current, offer.id)
    if (!result.ok) break
    current = result.save
    taken += 1
  }
  return { save: current, handedIn, taken }
}
