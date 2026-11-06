import { describe, expect, it } from 'vitest'

import type { ItemInstance } from '../../sim/economy.ts'

import { countNames, groupItems } from './groupItems.ts'

const item = (id: string, over: Partial<ItemInstance> = {}): ItemInstance => ({
  id,
  baseId: 'weapon-bow',
  itemLevel: 2,
  quality: 1,
  durability: 100,
  maxDurability: 100,
  modifiers: [],
  ...over,
})

describe('grouping duplicates', () => {
  it('merges identical items and keeps different ones apart', () => {
    const groups = groupItems([item('a'), item('b'), item('c', { itemLevel: 3 }), item('d', { modifiers: ['keen'] }), item('e', { durability: 50 })])
    expect(groups.map((group) => [group.item.id, group.count])).toEqual([['a', 2], ['c', 1], ['d', 1], ['e', 1]])
  })

  it('counts repeated names in order of first appearance', () => {
    expect(countNames(['Draught', 'Antidote', 'Draught'])).toEqual([['Draught', 2], ['Antidote', 1]])
  })
})
