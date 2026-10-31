import { describe, expect, it } from 'vitest'

import { encounters, toExpeditionEncounter } from '../content/encounters.ts'
import { gameDefs } from '../content/scenarios.ts'
import { newItem } from '../content/items.ts'
import { MATERIAL_SELL_PRICE, itemBuyPrice, itemSellPrice, repairCost, shopStock } from '../content/shop.ts'
import { stepExpedition } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, type SaveData } from './save.ts'
import { buyItem, payDebt, repairAll, repairAllCost, repairOne, sellItem, sellMaterial, wearGear } from './town.ts'
import { beginExpedition, settleExpedition } from './world.ts'

function heroSave(gold = 0): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, account: { ...made.save.account, gold } }
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

describe('prices', () => {
  it('follows the decided formulas', () => {
    expect(MATERIAL_SELL_PRICE).toEqual({ shard: 3, hide: 3, scrap: 2 })
    expect(itemSellPrice(newItem('a', 'weapon-bow', 1))).toBe(5)
    expect(itemSellPrice(newItem('a', 'weapon-bow', 3, 1.1))).toBe(17)
    expect(itemSellPrice(newItem('a', 'weapon-bow', 1, 0.9))).toBe(5)
    expect(itemSellPrice(newItem('a', 'weapon-bow', 5, 0.9))).toBe(23)
    expect(itemBuyPrice(1)).toBe(10)
    expect(itemBuyPrice(20)).toBe(200)
    const worn = (level: number, durability: number) => ({ ...newItem('r', 'weapon-bow', level), durability })
    expect(repairCost(worn(1, 100))).toBe(0)
    expect(repairCost(worn(1, 10))).toBe(14)
    expect(repairCost(worn(20, 90))).toBe(11)
    expect(repairCost(worn(5, 0))).toBe(35)
    expect(shopStock(7).every((entry) => entry.price === 70 && entry.itemLevel === 7)).toBe(true)
    expect(shopStock(1).map((entry) => entry.baseId)).toContain('weapon-two-handed')
  })
})

describe('selling and buying', () => {
  it('sells materials one at a time or all, and keeps the account valid', () => {
    const save = { ...heroSave(), account: { ...heroSave().account, materials: { shard: 4, scrap: 3 } } }
    const one = ok(sellMaterial(save, 'shard', 1))
    expect(one.account.gold).toBe(3)
    expect(one.account.materials).toEqual({ shard: 3, scrap: 3 })
    const all = ok(sellMaterial(one, 'scrap', 3))
    expect(all.account.gold).toBe(9)
    expect(all.account.materials).toEqual({ shard: 3 })
    expect(() => assertSaveData(all)).not.toThrow()
    expect(sellMaterial(save, 'shard', 5)).toEqual({ ok: false, reason: 'You only have 4 shard.' })
    expect(sellMaterial(save, 'iron', 1)).toEqual({ ok: false, reason: 'Greyhaven does not buy that.' })
    expect(sellMaterial(save, 'shard', 0).ok).toBe(false)
    expect(sellMaterial(save, 'shard', 1.5).ok).toBe(false)
  })

  it('sells only archive items', () => {
    const item = newItem('x', 'weapon-bow', 3, 1.1)
    const save = { ...heroSave(), account: { ...heroSave().account, archive: [item] } }
    const sold = ok(sellItem(save, 'x'))
    expect(sold.account.gold).toBe(17)
    expect(sold.account.archive).toEqual([])
    expect(sellItem(save, 'hero-1-mainHand')).toEqual({ ok: false, reason: 'Only archive items can be sold.' })
  })

  it('buys a base item at the hero level and 100% quality into the archive', () => {
    const save = heroSave(25)
    const bought = ok(buyItem(save, 'hero-1', 'weapon-two-handed'))
    expect(bought.account.gold).toBe(15)
    expect(bought.account.archive[0]).toMatchObject({ id: 'shop-1', baseId: 'weapon-two-handed', itemLevel: 1, quality: 1, durability: 100 })
    const again = ok(buyItem(bought, 'hero-1', 'offhand-shield'))
    expect(again.account.archive.map((item) => item.id)).toEqual(['shop-1', 'shop-2'])
    expect(buyItem(save, 'hero-1', 'nothing')).toEqual({ ok: false, reason: 'Greyhaven does not sell that.' })
    expect(buyItem(heroSave(9), 'hero-1', 'weapon-bow')).toEqual({ ok: false, reason: 'That costs 10 gold. You have 9.' })
    expect(buyItem(save, 'nobody', 'weapon-bow').ok).toBe(false)
    expect(() => assertSaveData(again)).not.toThrow()
  })
})

describe('repair', () => {
  it('repairs one item, equipped or in the archive, for the formula cost', () => {
    const worn = wearGear(heroSave(100), 'hero-1')
    expect(hero(worn).equipment.mainHand?.durability).toBe(70)
    expect(repairAllCost(hero(worn))).toBe(8 * repairCost({ ...newItem('r', 'weapon-bow', 1), durability: 70 }))
    const one = ok(repairOne(worn, 'hero-1-mainHand'))
    expect(hero(one).equipment.mainHand?.durability).toBe(100)
    expect(one.account.gold).toBe(100 - 5)
    const stored = { ...worn, account: { ...worn.account, gold: 300, archive: [{ ...newItem('old', 'weapon-bow', 20), durability: 0 }] } }
    const fixed = ok(repairOne(stored, 'old'))
    expect(fixed.account.archive[0]?.durability).toBe(100)
    expect(fixed.account.gold).toBe(300 - 110)
  })

  it('refuses a repair it cannot afford, an undamaged item, and an unknown item', () => {
    const worn = wearGear(heroSave(2), 'hero-1')
    expect(repairOne(worn, 'hero-1-mainHand')).toEqual({ ok: false, reason: 'Repair costs 5 gold. You have 2.' })
    expect(repairOne(heroSave(50), 'hero-1-mainHand')).toEqual({ ok: false, reason: 'That item is not damaged.' })
    expect(repairOne(worn, 'ghost')).toEqual({ ok: false, reason: 'That item is not here.' })
  })

  it('repairs everything equipped, or nothing when the gold is short', () => {
    const worn = wearGear(heroSave(100), 'hero-1')
    const cost = repairAllCost(hero(worn))
    expect(cost).toBe(40)
    const repaired = ok(repairAll(worn, 'hero-1'))
    expect(repaired.account.gold).toBe(100 - cost)
    expect(Object.values(hero(repaired).equipment).every((item) => item?.durability === 100)).toBe(true)
    expect(repairAll({ ...worn, account: { ...worn.account, gold: cost - 1 } }, 'hero-1')).toEqual({
      ok: false,
      reason: `Repairing everything costs ${cost} gold. You have ${cost - 1}.`,
    })
    expect(repairAll(heroSave(100), 'hero-1')).toEqual({ ok: false, reason: 'Nothing equipped is damaged.' })
  })
})

describe('debt', () => {
  const indebted = (debt: number, gold: number): SaveData => ({ ...heroSave(gold), account: { ...heroSave(gold).account, debt } })

  it('pays any amount up to what is owed and held', () => {
    const part = ok(payDebt(indebted(25, 100), 10))
    expect(part.account).toMatchObject({ debt: 15, gold: 90 })
    expect(ok(payDebt(part, 15)).account).toMatchObject({ debt: 0, gold: 75 })
    expect(payDebt(indebted(25, 100), 26)).toEqual({ ok: false, reason: 'You only owe 25.' })
    expect(payDebt(indebted(25, 5), 6)).toEqual({ ok: false, reason: 'You have 5 gold.' })
    expect(payDebt(indebted(0, 5), 1)).toEqual({ ok: false, reason: 'You owe nothing.' })
    expect(payDebt(indebted(25, 100), 0).ok).toBe(false)
    expect(payDebt(indebted(25, 100), 1.5).ok).toBe(false)
  })
})

describe('gold on the road', () => {
  it('gives each enemy level × 2 gold, and level × 3 to an elite or the boss', () => {
    const gold = (id: string) => toExpeditionEncounter(encounters[id]!).enemies.map((enemy) => enemy.gold)
    expect(gold('shardling-pair')).toEqual([6, 6])
    expect(gold('wolf-pair')).toEqual([12, 12])
    expect(gold('rootmaw-stalker')).toEqual([42])
    expect(gold('echo-knight')).toEqual([48])
    expect(gold('fractured-warden')).toEqual([60])
  })

  it('carries the chosen gold, earns gold from a won fight, and brings it home', () => {
    let won = false
    for (let seed = 1; seed < 40 && !won; seed += 1) {
      const save = ok(beginExpedition(heroSave(100), 'splintered-road', seed))
      expect(save.account.gold).toBe(0)
      const run = save.expedition!
      expect(run.carriedGold).toBe(25)
      expect(run.depositedGold).toBe(75)
      const defs = gameDefs()
      let guard = 0
      while (run.history.length === 0 && run.outcome === 'ongoing' && guard < 100_000) {
        stepExpedition(run, defs)
        guard += 1
      }
      if (run.history[0]?.outcome !== 'victory') continue
      won = true
      expect(run.carriedGold).toBe(25 + 12)
      run.returning = true
      run.outcome = 'returned'
      const settled = settleExpedition(save)
      expect(settled.account.gold).toBe(75 + 25 + 12)
      expect(settled.account.debt).toBe(0)
    }
    expect(won).toBe(true)
  })

  it('carries at most the gold the account holds, and keeps a defeat from touching deposited gold', () => {
    const poor = ok(beginExpedition(heroSave(10), 'splintered-road', 1))
    expect(poor.expedition?.carriedGold).toBe(10)
    expect(poor.expedition?.depositedGold).toBe(0)
    const save = ok(beginExpedition(heroSave(100), 'splintered-road', 1))
    const run = save.expedition!
    run.outcome = 'defeat'
    run.carriedGold = 0
    run.debt = 15
    run.history = [{ index: 0, encounterId: 'shardling-pair', seed: 1, outcome: 'defeat', durationMs: 1 }]
    const settled = settleExpedition(save)
    expect(settled.account.gold).toBe(75)
    expect(settled.account.debt).toBe(15)
    expect(() => assertSaveData(settled)).not.toThrow()
    const withDebt = ok(payDebt({ ...settled, account: { ...settled.account, gold: 20 } }, 15))
    expect(withDebt.account).toMatchObject({ gold: 5, debt: 0 })
  })

  it('closes the town while an expedition runs', () => {
    const save = { ...heroSave(100), account: { ...heroSave(100).account, materials: { shard: 2 } } }
    const running = { ...save, expedition: startExpedition(hero(save), 'splintered-road', 1) }
    const shut = { ok: false, reason: 'Town services are closed while an expedition is running.' }
    expect(sellMaterial(running, 'shard', 1)).toEqual(shut)
    expect(buyItem(running, 'hero-1', 'weapon-bow')).toEqual(shut)
    expect(repairOne(running, 'hero-1-mainHand')).toEqual(shut)
    expect(payDebt(running, 1)).toEqual(shut)
  })
})
