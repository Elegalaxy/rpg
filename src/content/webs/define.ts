import type { HeroClass } from '../../sim/constants.ts'
import type { SkillNode, SkillWeb } from '../../sim/progression.ts'

export type ClusterSpec = {
  name: string
  nodes: readonly [string, string, string, string, string]
  unlocks: Readonly<Record<string, string>>
}

const NODE_INDEXES = [1, 2, 3, 4, 5] as const

function kebab(name: string): string {
  const lowered = name.toLowerCase().replaceAll("'", '').replaceAll('’', '')
  const dashed = lowered.replaceAll(/[^a-z0-9]+/g, '-')
  let start = 0
  let end = dashed.length
  while (start < end && dashed[start] === '-') start += 1
  while (end > start && dashed[end - 1] === '-') end -= 1
  return dashed.slice(start, end)
}

/** Build one class web: three clusters, five nodes each, previous-node requirements. */
export function defineWeb(
  classId: HeroClass,
  clusters: readonly [ClusterSpec, ClusterSpec, ClusterSpec],
  startingSkillIds: readonly [string, string, string, string],
): SkillWeb {
  const nodes: SkillNode[] = []
  const clusterNames: { [name: string]: boolean } = {}
  for (const cluster of clusters) {
    if (cluster.name.length === 0) throw new Error(`${classId} cluster name is empty`)
    if (clusterNames[cluster.name] === true) throw new Error(`${classId} repeats cluster ${cluster.name}`)
    clusterNames[cluster.name] = true
    const listed: { [name: string]: boolean } = {}
    for (const name of cluster.nodes) {
      if (name.length === 0) throw new Error(`${classId} ${cluster.name} has an empty node name`)
      if (listed[name] === true) throw new Error(`${classId} ${cluster.name} repeats node ${name}`)
      listed[name] = true
    }
    for (const key of Object.keys(cluster.unlocks)) {
      if (listed[key] !== true) {
        throw new Error(`${classId} ${cluster.name} unlock names an unknown node ${key}`)
      }
      const skillId = cluster.unlocks[key]
      if (skillId === undefined || skillId.length === 0) {
        throw new Error(`${classId} ${cluster.name} unlock for ${key} is empty`)
      }
    }
    let previous: string | null = null
    for (let position = 0; position < cluster.nodes.length; position += 1) {
      const name = cluster.nodes[position]
      const index = NODE_INDEXES[position]
      if (name === undefined || index === undefined) {
        throw new Error(`${classId} ${cluster.name} is missing node ${position + 1}`)
      }
      const id = `${classId}-${kebab(name)}`
      nodes.push({
        id,
        name,
        cluster: cluster.name,
        index,
        cost: 1,
        requires: previous,
        keystone: index === 5,
        unlocksSkillId: cluster.unlocks[name] ?? null,
      })
      previous = id
    }
  }
  return { classId, nodes, startingSkillIds }
}
