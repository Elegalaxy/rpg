import { describe, expect, it } from 'vitest'

import { carryOver } from './carryOver.ts'
import { defaultPicks, heirloomCandidates, isDefaultPlan, restorePlan, withSavedPlan } from './nextLifePlan.ts'
import { legacyPreview, nextLifePreview, reincarnate, stageNextLife } from './reincarnation.ts'
import { createHero } from './roster.ts'
import { newSave, parseSave, serializeSave, type SaveData, type SavedHero } from './save.ts'

function build(legacy = 100): { save: SaveData; hero: SavedHero } {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const save: SaveData = {
    ...made.save,
    heroes: made.save.heroes.map((hero) => ({ ...hero, legacy, bossLossThisLife: true, purse: { ...hero.purse, gold: 5000 } })),
  }
  return { save, hero: save.heroes[0]! }
}

function replace(save: SaveData, hero: SavedHero): SaveData {
  return { ...save, heroes: save.heroes.map((entry) => (entry.id === hero.id ? hero : entry)) }
}

describe('saved next life plan (Step 13.43)', () => {
  it('keeps the plan across a save and reload', () => {
    const { save, hero } = build()
    const picked = heirloomCandidates(hero)[0]!.id
    const saved = withSavedPlan(hero, [{ kind: 'stockpile' }, { kind: 'heirloom' }], [picked, ''])
    const parsed = parseSave(serializeSave(replace(save, saved)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const back = parsed.data.heroes[0]!
    const restored = restorePlan(back)
    expect(restored.plan).toEqual([{ kind: 'stockpile' }, { kind: 'heirloom' }])
    expect(restored.picks).toEqual([picked, ''])
    expect(restored.dropped).toEqual([])
  })

  it('loads an old save without the field and starts from the current heirlooms', () => {
    const { save, hero } = build()
    expect(hero.nextLifePlan).toBeUndefined()
    expect(parseSave(serializeSave(save)).ok).toBe(true)
    expect(restorePlan(hero)).toEqual({ plan: [], picks: defaultPicks(hero), dropped: [] })
  })

  it('removes the field when the plan is back to the starting state', () => {
    const { hero } = build()
    const saved = withSavedPlan(hero, [{ kind: 'stockpile' }], defaultPicks(hero))
    expect(saved.nextLifePlan).toBeDefined()
    const cleared = withSavedPlan(saved, [], defaultPicks(hero))
    expect(cleared.nextLifePlan).toBeUndefined()
    expect(isDefaultPlan(hero, [], defaultPicks(hero))).toBe(true)
  })

  it('refuses a malformed plan on load', () => {
    const { save, hero } = build()
    for (const bad of [{ purchases: 'x', picks: [] }, { purchases: [], picks: [1] }, { purchases: [{ kind: 3 }], picks: [] }]) {
      const data = JSON.parse(serializeSave(replace(save, hero)))
      data.heroes[0].nextLifePlan = bad
      expect(parseSave(JSON.stringify(data)).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('drops a purchase that is no longer affordable, with a reason', () => {
    const { hero } = build(0)
    const total = legacyPreview(hero).total
    const poor = { ...hero, nextLifePlan: { purchases: [{ kind: 'stockpile' as const }, { kind: 'fifthSlot' as const }], picks: [] } }
    const restored = restorePlan({ ...poor, legacy: 0 })
    expect(total).toBeLessThan(90)
    expect(restored.plan.map((item) => item.kind)).toEqual(total >= 20 ? ['stockpile'] : [])
    const dropped = restored.dropped.filter((drop) => drop.kind === 'purchase')
    expect(dropped.some((drop) => drop.kind === 'purchase' && drop.item.kind === 'fifthSlot' && /costs 90 Legacy/.test(drop.reason))).toBe(true)
  })

  it('drops a purchase that was already bought', () => {
    const { hero } = build(200)
    const bought = { ...hero, purchases: { ...hero.purchases, fifthSlot: true }, nextLifePlan: { purchases: [{ kind: 'fifthSlot' as const }], picks: [] } }
    const restored = restorePlan(bought)
    expect(restored.plan).toEqual([])
    expect(restored.dropped).toEqual([{ kind: 'purchase', item: { kind: 'fifthSlot' }, reason: 'You already have the fifth skill slot.' }])
  })

  it('drops an unknown purchase kind and an heirloom pick that is no longer owned', () => {
    const { hero } = build()
    const stale = {
      ...hero,
      nextLifePlan: { purchases: [{ kind: 'bogus' } as unknown as { kind: 'skill' }], picks: ['gone-item'] },
    }
    const restored = restorePlan(stale)
    expect(restored.plan).toEqual([])
    expect(restored.picks).toEqual([''])
    expect(restored.dropped.map((drop) => drop.kind)).toEqual(['purchase', 'heirloom'])
  })

  it('drops a pick whose slot was lost with its purchase', () => {
    const { hero } = build()
    const [first, second] = heirloomCandidates(hero)
    const plan = { purchases: [], picks: [first!.id, second!.id] }
    const restored = restorePlan({ ...hero, nextLifePlan: plan })
    expect(restored.picks).toEqual([first!.id, ''])
    expect(restored.dropped).toHaveLength(1)
  })

  it('clears the plan at reincarnation', () => {
    const { save, hero } = build()
    const planned = replace(save, withSavedPlan(hero, [{ kind: 'stockpile' }], defaultPicks(hero)))
    expect(planned.heroes[0]!.nextLifePlan).toBeDefined()
    const result = reincarnate(planned, hero.id, [], [{ kind: 'stockpile' }])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.hero.nextLifePlan).toBeUndefined()
  })

  it('does not change the ending life, the prices or the reincarnation result', () => {
    const { save, hero } = build()
    const planned = withSavedPlan(hero, [{ kind: 'stockpile' }], defaultPicks(hero))
    const withPlan = stageNextLife(planned, [{ kind: 'stockpile' }])
    const without = stageNextLife(hero, [{ kind: 'stockpile' }])
    if (!withPlan.ok || !without.ok) throw new Error('stage failed')
    const { nextLifePlan: _kept, ...stagedHero } = withPlan.hero
    expect({ ...withPlan, hero: stagedHero }).toEqual(without)
    expect(legacyPreview(planned)).toEqual(legacyPreview(hero))
    expect(carryOver(planned)).toEqual(carryOver(hero))
    expect(nextLifePreview(planned, [])).toEqual(nextLifePreview(hero, []))
    const a = reincarnate(save, hero.id, [], [{ kind: 'stockpile' }])
    const b = reincarnate(replace(save, planned), hero.id, [], [{ kind: 'stockpile' }])
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(b.hero).toEqual(a.hero)
  })
})
