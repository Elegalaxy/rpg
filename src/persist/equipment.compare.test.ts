import { describe, expect, it } from 'vitest'

import { changeIsBetter } from './equipment.ts'

describe('gear comparison colours', () => {
  it('counts a higher stat as better, except base action time, where lower is better', () => {
    expect(changeIsBetter('Armor', 13, 14.09)).toBe(true)
    expect(changeIsBetter('Armor', 14.09, 13)).toBe(false)
    expect(changeIsBetter('Evasion', 5, 8)).toBe(true)
    expect(changeIsBetter('Base action time', 1.75, 1.5)).toBe(true)
    expect(changeIsBetter('Base action time', 1.5, 1.75)).toBe(false)
  })
})
