import { describe, expect, it } from 'vitest'

import { readSeenRecipes, writeSeenRecipes } from './enchanterSeen.ts'

describe('enchanter seen recipes', () => {
  it('reads an empty list when storage is missing or blocked', () => {
    expect(readSeenRecipes()).toEqual([])
    expect(() => writeSeenRecipes(['keen'])).not.toThrow()
  })
})
