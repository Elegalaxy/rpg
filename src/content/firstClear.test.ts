import { describe, expect, it } from 'vitest'
import { FIRST_CLEAR_NODE_IDS, firstClearReward } from './firstClear.ts'

describe('first-clear rewards', () => {
  it('matches the design table, in node order', () => {
    expect(FIRST_CLEAR_NODE_IDS).toEqual(['splintered-road', 'withered-grove', 'fallen-bastion', 'drowned-causeway', 'rift-hollows', 'cinder-scar', 'fracture-gate'])
    const table = FIRST_CLEAR_NODE_IDS.map((id) => {
      const reward = firstClearReward(id)
      return [id, reward?.gold, reward?.materialId, reward?.quantity, reward?.tokens]
    })
    expect(table).toContainEqual(['splintered-road', 210, 'scrap', 15, 1])
    expect(table).toContainEqual(['withered-grove', 420, 'hide', 15, 1])
    expect(table).toContainEqual(['fallen-bastion', 480, 'shard', 15, 1])
    expect(table).toContainEqual(['fracture-gate', 600, null, 0, 1])
    expect(table).toContainEqual(['drowned-causeway', 660, 'riftglass', 15, 1])
    expect(table).toContainEqual(['rift-hollows', 840, 'duskiron', 15, 1])
    expect(table).toContainEqual(['cinder-scar', 1020, 'cinderite', 15, 1])
    expect(FIRST_CLEAR_NODE_IDS).toHaveLength(7)
  })

  it('has no reward for the town or an unknown node', () => {
    expect(firstClearReward('greyhaven')).toBeNull()
    expect(firstClearReward('nowhere')).toBeNull()
  })
})
