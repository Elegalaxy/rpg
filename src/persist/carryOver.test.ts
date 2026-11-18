import { describe, expect, it } from 'vitest'

import { CARRY_PERCENT_BASE, STOCKPILE_COSTS, STOCKPILE_PERCENTS, carriedPurse, carryOver, carryPercent } from './carryOver.ts'
import { createHero } from './roster.ts'
import { newSave, type SavedHero } from './save.ts'

function base(): SavedHero {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save.heroes[0]!
}

function withPurse(patch: Partial<SavedHero['purse']>, stockpile?: number): SavedHero {
  const hero = base()
  return { ...hero, purse: { ...hero.purse, ...patch }, purchases: { ...hero.purchases, ...(stockpile === undefined ? {} : { stockpile }) } }
}

describe('carried share (Step 13.31)', () => {
  it('is 20% and rises to 30, 40 and 50% with Stockpile I to III', () => {
    expect(CARRY_PERCENT_BASE).toBe(20)
    expect(STOCKPILE_PERCENTS).toEqual([30, 40, 50])
    expect(STOCKPILE_COSTS).toEqual([20, 35, 50])
    expect([0, 1, 2, 3].map((tier) => carryPercent({ stockpile: tier }))).toEqual([20, 30, 40, 50])
    expect(carryPercent({})).toBe(20)
  })

  it('floors each stack and removes stacks that round to nothing', () => {
    const hero = withPurse({ materials: { shard: 4, scrap: 7, hide: 100 }, supplies: { 'healing-draught': 3, 'ward-charm': 5 } })
    const carry = carryOver(hero)
    expect(carry.materials).toEqual([
      { id: 'hide', now: 100, kept: 20 },
      { id: 'scrap', now: 7, kept: 1 },
      { id: 'shard', now: 4, kept: 0 },
    ])
    const purse = carriedPurse(hero.purse, carry)
    expect(purse.materials).toEqual({ hide: 20, scrap: 1 })
    expect(purse.supplies).toEqual({ 'ward-charm': 1 })
  })

  it('shares gold at the tier percent', () => {
    expect(carryOver(withPurse({ gold: 10000 })).gold).toEqual({ now: 10000, kept: 2000 })
    expect(carryOver(withPurse({ gold: 10000 }, 3)).gold).toEqual({ now: 10000, kept: 5000 })
    expect(carryOver(withPurse({ gold: 9 })).gold.kept).toBe(1)
  })

  it('pays debt from gold first, then shares what is left of each', () => {
    const small = carryOver(withPurse({ gold: 1000, debt: 200 }))
    expect(small).toMatchObject({ debtPaid: 200, gold: { now: 1000, kept: 160 }, debt: { now: 200, kept: 0 } })
    const heavy = withPurse({ gold: 100, debt: 350 })
    const large = carryOver(heavy)
    expect(large).toMatchObject({ debtPaid: 100, gold: { kept: 0 }, debt: { now: 350, kept: 50 } })
    // Debt rounds up: 3 owed at 20% keeps 1.
    expect(carryOver(withPurse({ gold: 0, debt: 3 })).debt.kept).toBe(1)
    expect(carriedPurse(heavy.purse, large)).toMatchObject({ gold: 0, debt: 50 })
  })

  it('leaves the archive, queue and board alone', () => {
    const hero = withPurse({ gold: 50, boardRolls: 7, craftCounter: 4 })
    expect(carriedPurse(hero.purse, carryOver(hero))).toMatchObject({ gold: 10, boardRolls: 7, craftCounter: 4 })
  })
})
