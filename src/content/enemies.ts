import type { EnemyDef } from '../sim/types.ts'

/** Level-20 standard enemy with no overrides. Basic attacks are physical. */
export const standardDummy: EnemyDef = {
  id: 'dummy-standard-20',
  name: 'Standard Dummy',
  level: 20,
  archetype: 'standard',
  school: 'physical',
}

export const enemies: { [id: string]: EnemyDef } = {
  [standardDummy.id]: standardDummy,
}
