import { describe, expect, it } from 'vitest'

import { FREE_ROWS, freeFights, freeSetup } from './freeUpgrade.ts'

describe('free upgrade matrix', () => {
  it('builds every row for a level-10 warrior, and the upgraded rows change the hero', () => {
    const fight = freeFights(10)[0]!
    const plain = freeSetup('warrior', 10, FREE_ROWS[0]!, fight.enemies)
    for (const row of FREE_ROWS.slice(1)) {
      const setup = freeSetup('warrior', 10, row, fight.enemies)
      expect(JSON.stringify(setup.hero.statBonuses), row.id).not.toBe(JSON.stringify(plain.hero.statBonuses))
    }
  })

  it('uses the zone fights below level 17 and the Causeway fights at 17 or when hard', () => {
    expect(freeFights(13).map((fight) => fight.id)).toContain('echo-knight')
    expect(freeFights(17)).toHaveLength(7)
    expect(freeFights(10, true)).toHaveLength(7)
  })
})
