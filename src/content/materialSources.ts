import { encounters } from './encounters.ts'
import { enemies } from './enemies.ts'
import { nodes, routes } from './world.ts'

export type MaterialSources = {
  /** Names of enemies that drop the material. */
  enemies: string[]
  /** Names of resource nodes that give it. */
  resources: string[]
  /** Names of routes where it can be found. Only a route's last node drops materials. */
  routes: string[]
}

/** Where a material comes from: the routes that yield it first, then the enemies and resource nodes behind them. */
export function materialSources(materialId: string): MaterialSources {
  const enemyNames = Object.values(enemies)
    .filter((enemy) => enemy.drop?.materialId === materialId)
    .map((enemy) => enemy.name)
  const resourceNames = Object.values(nodes)
    .filter((node) => node.resource?.materialId === materialId)
    .map((node) => node.resource!.name)
  const routeNames = Object.values(routes)
    .filter((route) => {
      const last = nodes[route.nodeIds[route.nodeIds.length - 1] ?? '']
      if (last === undefined) return false
      if (last.resource?.materialId === materialId) return true
      return [...last.encounterIds, ...(last.drawEncounterIds ?? [])].some((id) =>
        encounters[id]?.members.some((member) => enemies[member.enemyId]?.drop?.materialId === materialId),
      )
    })
    .map((route) => route.name)
  return { enemies: [...new Set(enemyNames)], resources: resourceNames, routes: routeNames }
}
