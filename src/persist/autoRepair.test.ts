import { describe, expect, it } from 'vitest'

import { repairCost } from '../content/shop.ts'
import type { Equipment, ItemInstance } from '../sim/economy.ts'

import { autoRepairStep } from './autoRepair.ts'
import { selectedHero } from './character.ts'
import { runOffline } from './offline.ts'
import { reincarnate } from './reincarnation.ts'
import { createHero } from './roster.ts'
import { newSave, parseSave, serializeSave, type SaveData, type SavedHero } from './save.ts'
import { repairAllCost } from './town.ts'
import { autoRerunRefusal, beginExpedition } from './world.ts'

// Auto run repair at home (Step 13.49, GAME_DESIGN "Auto run repair").

function base(wear: Record<string, number>, gold: number, change: Partial<SavedHero> = {}): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  return {
    ...made.save,
    heroes: made.save.heroes.map((hero) => {
      const equipment = { ...hero.equipment } as Equipment
      for (const [slot, durability] of Object.entries(wear)) {
        const item = equipment[slot as keyof Equipment]
        if (item === null) throw new Error(`${slot} is empty`)
        equipment[slot as keyof Equipment] = { ...item, durability }
      }
      return { ...hero, autoRun: true, autoRepair: true, equipment, progress: { ...hero.progress, level: 40, attributes }, purse: { ...hero.purse, gold }, ...change }
    }),
  }
}

const hero = (save: SaveData) => selectedHero(save)!
const worn = (save: SaveData): ItemInstance[] => Object.values(hero(save).equipment).filter((item): item is ItemInstance => item !== null)
const slotsOf = (save: SaveData) => Object.entries(hero(save).equipment).filter(([, item]) => item !== null).map(([slot]) => slot)

describe('the shared step', () => {
  it('repairs every worn piece at the normal price, from the hero gold', () => {
    const slots = slotsOf(base({}, 0))
    expect(slots.length).toBeGreaterThanOrEqual(2)
    const save = base({ [slots[0]!]: 40, [slots[1]!]: 70 }, 1000)
    const cost = repairAllCost(hero(save))
    expect(cost).toBeGreaterThan(0)
    const result = autoRepairStep(save)
    expect(result).toMatchObject({ repaired: 2, gold: cost, unaffordable: 0 })
    expect(hero(result.save).purse.gold).toBe(1000 - cost)
    expect(worn(result.save).every((item) => item.durability === item.maxDurability)).toBe(true)
  })

  it('does nothing when the setting is off', () => {
    const slot = slotsOf(base({}, 0))[0]!
    const off = base({ [slot]: 10 }, 1000, { autoRepair: false })
    expect(autoRepairStep(off)).toEqual({ save: off, repaired: 0, gold: 0, unaffordable: 0 })
    const absent = base({ [slot]: 10 }, 1000, { autoRepair: undefined })
    expect(autoRepairStep(absent).repaired).toBe(0)
  })

  it('does nothing when nothing is worn', () => {
    const save = base({}, 1000)
    expect(autoRepairStep(save)).toEqual({ save, repaired: 0, gold: 0, unaffordable: 0 })
    const slot = slotsOf(save)[0]!
    const once = autoRepairStep(base({ [slot]: 10 }, 1000))
    expect(autoRepairStep(once.save).repaired).toBe(0)
  })

  it('repairs the most worn piece first and skips what the gold cannot cover', () => {
    const slots = slotsOf(base({}, 0))
    const [a, b, c] = slots as [string, string, string]
    const probe = base({ [a]: 90, [b]: 20, [c]: 60 }, 0)
    const costOf = (slot: string) => repairCost(hero(probe).equipment[slot as keyof Equipment]!)
    // Gold for the most worn piece only (b), not for the others.
    const gold = costOf(b)
    expect(costOf(c)).toBeGreaterThan(0)
    const result = autoRepairStep(base({ [a]: 90, [b]: 20, [c]: 60 }, gold))
    expect(result.repaired).toBe(1)
    expect(result.gold).toBe(gold)
    expect(result.unaffordable).toBe(2)
    expect(hero(result.save).equipment[b as keyof Equipment]!.durability).toBe(hero(result.save).equipment[b as keyof Equipment]!.maxDurability)
    expect(hero(result.save).equipment[a as keyof Equipment]!.durability).toBe(90)
    expect(hero(result.save).purse.gold).toBe(0)
  })

  it('does not repair with a run going, and leaves the archive alone', () => {
    const slot = slotsOf(base({}, 0))[0]!
    const save = base({ [slot]: 50 }, 1000)
    const open = beginExpedition({ ...save, heroes: save.heroes.map((h) => ({ ...h, equipment: { ...h.equipment, [slot]: { ...h.equipment[slot as keyof Equipment]!, durability: 50 } } })) }, 'splintered-road', 1)
    if (!open.ok) throw new Error(open.reason)
    expect(autoRepairStep(open.save).repaired).toBe(0)
    const archived = { ...worn(save)[0]!, id: 'archived-1', durability: 5 }
    const withArchive = { ...save, heroes: save.heroes.map((h) => ({ ...h, purse: { ...h.purse, archive: [archived] } })) }
    const result = autoRepairStep(withArchive)
    expect(hero(result.save).purse.archive[0]!.durability).toBe(5)
    expect(result.repaired).toBe(1)
  })

  it('lets a rerun start after the repair, and keeps the refusal when the gold is short', () => {
    const slot = slotsOf(base({}, 0))[0]!
    const rich = autoRepairStep(base({ [slot]: 0 }, 1000)).save
    expect(autoRerunRefusal(rich, 'splintered-road')).toBeNull()
    const poor = autoRepairStep(base({ [slot]: 0 }, 0)).save
    expect(autoRerunRefusal(poor, 'splintered-road')?.reason).toMatch(/is at 0 durability\. Repair it\./)
  })
})

describe('the save and reincarnation', () => {
  it('round trips autoRepair and rejects a non-boolean', () => {
    const save = base({}, 5)
    const good = parseSave(serializeSave(save))
    if (!good.ok) throw new Error(good.reason)
    expect(hero(good.data).autoRepair).toBe(true)
    const bad = JSON.parse(serializeSave(save))
    bad.heroes[0].autoRepair = 'yes'
    const result = parseSave(JSON.stringify(bad))
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.reason).toMatch(/auto repair/)
  })

  it('is kept through reincarnation', () => {
    const save = base({}, 5, { bossLossThisLife: true })
    const result = reincarnate(save, hero(save).id, null)
    if (!result.ok) throw new Error(result.reason)
    expect(hero(result.save).autoRepair).toBe(true)
  })
})

describe('away replay', () => {
  function run(change: Partial<SavedHero>): SaveData {
    const slot = slotsOf(base({}, 0))[0]!
    const begun = beginExpedition(base({ [slot]: 50 }, 100_000, { pushOnHpPercent: 100, stopAfterFights: 1, repeatRoute: false, ...change }), 'splintered-road', 5)
    if (!begun.ok) throw new Error(`${slot}: ${begun.reason}`)
    return begun.save
  }

  it('repairs worn gear at each return when on, and counts it for the report', () => {
    const on = runOffline(run({}), 10 * 60_000, true)
    const summary = on.summary.heroes[0]!
    expect(summary.repairedPieces).toBeGreaterThan(0)
    expect(summary.repairGold).toBeGreaterThan(0)
    const off = runOffline(run({ autoRepair: false }), 10 * 60_000, true)
    expect(off.summary.heroes[0]!.repairedPieces).toBeUndefined()
  })

  it('still stops at 0 durability when the gold does not cover it', () => {
    const save = run({ autoRepair: true })
    // The run wears the piece to 0 and the purse is empty: the return pays too little to repair it.
    const piece = save.expedition!.equipment[0]!
    piece.durability = 0
    piece.disabled = true
    const broken = { ...save, expedition: { ...save.expedition!, depositedGold: 0, carriedGold: 0 } }
    const result = runOffline(broken, 10 * 60_000, true)
    const summary = result.summary.heroes[0]!
    expect(summary.stopped).toBe('blocked')
    expect(summary.note).toMatch(/is at 0 durability\. Repair it\./)
  })
})
