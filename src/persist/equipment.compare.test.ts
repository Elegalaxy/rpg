import { describe, expect, it } from 'vitest'

import { changeIsBetter, changeKind } from './equipment.ts'

describe('gear comparison colours', () => {
  it('counts a higher stat as better, except base action time, where lower is better', () => {
    expect(changeIsBetter('Armor', 13, 14.09)).toBe(true)
    expect(changeIsBetter('Armor', 14.09, 13)).toBe(false)
    expect(changeIsBetter('Evasion', 5, 8)).toBe(true)
    expect(changeIsBetter('Base action time', 1.75, 1.5)).toBe(true)
    expect(changeIsBetter('Base action time', 1.5, 1.75)).toBe(false)
  })

  it('treats a difference that rounds to 0.0 as unchanged, not better', () => {
    expect(changeKind('Evasion', 43.80000000000001, 43.80000000000003)).toBe('same')
    expect(changeIsBetter('Evasion', 43.80000000000001, 43.80000000000003)).toBe(false)
  })
})
