import { describe, expect, it } from 'vitest'

import { itemName, newItem } from '../content/items.ts'
import type { ItemInstance } from '../sim/economy.ts'

import { selectedHero } from './character.ts'
import {
  CRAFT_MS,
  advanceCrafting,
  grantCraftingKit,
  infuseGold,
  queueInfuse,
  queueSocket,
  queueUpgrade,
  socketGold,
  socketTargets,
} from './crafting.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, purseOf, serializeSave, updatePurse, type SaveData } from './save.ts'
import { beginExpedition } from './world.ts'
import { SPLINTERED_ROAD_ID } from '../sim/expedition.ts'

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

function keenBow(over: Partial<ItemInstance> = {}): ItemInstance {
  return { ...newItem('bow', 'weapon-bow', 17, 1.07), modifiers: ['keen'], ...over }
}

/** A level-17 warrior with a Keen Bow in the archive, 10,000 gold and 40 of every material. */
function stocked(level = 17, item: ItemInstance = keenBow()): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const kit = grantCraftingKit(made.save)
  const leveled = { ...kit, heroes: kit.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level } })) }
  const materials = Object.fromEntries(Object.keys(purseOf(leveled).materials).map((id) => [id, 40]))
  return updatePurse(leveled, { gold: 10_000, materials, archive: [item] })
}

const hero = (save: SaveData) => selectedHero(save)!

describe('open socket', () => {
  it('costs item level x 40 gold and 8 of riftglass, duskiron or cinderite, paid when queued', () => {
    const save = stocked()
    expect(socketGold(17)).toBe(680)
    for (const gem of ['riftglass', 'duskiron', 'cinderite']) {
      const queued = ok(queueSocket(save, 'hero-1', 'bow', gem))
      expect(purseOf(queued).gold).toBe(10_000 - 680)
      expect(purseOf(queued).materials[gem]).toBe(32)
      expect(purseOf(queued).archive).toEqual([])
      expect(purseOf(queued).craftQueue[0]).toMatchObject({ kind: 'socket', remainingMs: CRAFT_MS, materialId: gem })
    }
    expect(queueSocket(save, 'hero-1', 'bow', 'scrap')).toEqual({ ok: false, reason: 'A socket needs riftglass, duskiron or cinderite.' })
    expect(queueSocket(updatePurse(save, { materials: { riftglass: 7 } }), 'hero-1', 'bow', 'riftglass')).toEqual({ ok: false, reason: 'That needs 8 riftglass. You have 7.' })
    expect(queueSocket(updatePurse(save, { gold: 100 }), 'hero-1', 'bow', 'riftglass')).toEqual({ ok: false, reason: 'That costs 680 gold. You have 100.' })
  })

  it('needs hero level 10, no socket yet, and no expedition', () => {
    expect(queueSocket(stocked(9, keenBow({ itemLevel: 5 })), 'hero-1', 'bow', 'riftglass')).toEqual({
      ok: false,
      reason: 'Sockets need hero level 10. This hero is level 9.',
    })
    expect(queueSocket(stocked(10, keenBow({ itemLevel: 5 })), 'hero-1', 'bow', 'riftglass').ok).toBe(true)
    const done = advanceCrafting(ok(queueSocket(stocked(), 'hero-1', 'bow', 'riftglass')), CRAFT_MS).save
    expect(queueSocket(done, 'hero-1', 'bow', 'riftglass')).toEqual({ ok: false, reason: 'Keen Bow (open socket) already has a socket.' })
    const started = ok(beginExpedition(stocked(), SPLINTERED_ROAD_ID, 1))
    expect(queueSocket(started, 'hero-1', 'bow', 'riftglass')).toEqual({ ok: false, reason: 'Crafting is closed while an expedition is running.' })
    expect(queueSocket(stocked(), 'hero-1', 'nope', 'riftglass')).toEqual({ ok: false, reason: 'That item is not in the archive or worn by this hero.' })
  })

  it('opens the socket after 30 seconds and returns the item with its quality, wear and modifier', () => {
    const worn = keenBow({ durability: 61, quality: 1.093 })
    const queued = ok(queueSocket(stocked(17, worn), 'hero-1', 'bow', 'riftglass'))
    expect(advanceCrafting(queued, CRAFT_MS - 10).finished).toEqual([])
    const done = advanceCrafting(queued, CRAFT_MS)
    expect(done.finished[0]?.text).toMatch(/now has a socket/)
    expect(purseOf(done.save).archive).toEqual([{ ...worn, socketed: true }])
    expect(hero(done.save).craftXp).toBe(1)
  })

  it('works on a worn item: it leaves the slot and returns to it', () => {
    const base = stocked()
    const withWorn = { ...base, heroes: base.heroes.map((h) => ({ ...h, equipment: { ...h.equipment, accessory0: { ...keenBow(), id: 'ring', baseId: newItem('x', 'accessory-ring', 1).baseId } } })) }
    const queued = ok(queueSocket(withWorn, 'hero-1', 'ring', 'riftglass'))
    expect(hero(queued).equipment.accessory0).toBeNull()
    expect(socketTargets(hero(queued)).some((entry) => entry.item.id === 'ring')).toBe(false)
    const done = advanceCrafting(queued, CRAFT_MS).save
    expect(hero(done).equipment.accessory0).toMatchObject({ id: 'ring', socketed: true, modifiers: ['keen'] })
    expect(purseOf(done).archive.map((item) => item.id)).toEqual(['bow'])
  })

  it('an item in the queue cannot take another socket or infuse job until it is back', () => {
    const queued = ok(queueSocket(stocked(), 'hero-1', 'bow', 'riftglass'))
    expect(queueInfuse(queued, 'hero-1', 'bow', 'precise', 'scrap')).toEqual({ ok: false, reason: 'That item is not in the archive or worn by this hero.' })
    expect(queueUpgrade(queued, 'hero-1', 'bow', 'scrap').ok).toBe(false)
  })
})

describe('infuse', () => {
  function socketed(item: ItemInstance = keenBow()): SaveData {
    return advanceCrafting(ok(queueSocket(stocked(17, item), 'hero-1', 'bow', 'riftglass')), CRAFT_MS).save
  }

  it('costs item level x 10 gold and 6 of any material and adds a second, different modifier', () => {
    const save = socketed()
    expect(infuseGold(17)).toBe(170)
    const queued = ok(queueInfuse(save, 'hero-1', 'bow', 'precise', 'scrap'))
    expect(purseOf(queued).gold).toBe(purseOf(save).gold - 170)
    expect(purseOf(queued).materials.scrap).toBe(34)
    expect(purseOf(queued).craftQueue[0]).toMatchObject({ kind: 'infuse', modifierId: 'precise', remainingMs: CRAFT_MS })
    const done = advanceCrafting(queued, CRAFT_MS)
    const item = purseOf(done.save).archive[0]!
    expect(item).toMatchObject({ id: 'bow', socketed: true, modifiers: ['keen', 'precise'], quality: 1.07, itemLevel: 17 })
    expect(itemName(item)).toBe('Keen Precise Bow')
    expect(() => assertSaveData(done.save)).not.toThrow()
  })

  it('re-infusing replaces the second modifier for the same cost', () => {
    const first = advanceCrafting(ok(queueInfuse(socketed(), 'hero-1', 'bow', 'precise', 'scrap')), CRAFT_MS).save
    const queued = ok(queueInfuse(first, 'hero-1', 'bow', 'vicious', 'hide'))
    expect(purseOf(queued).gold).toBe(purseOf(first).gold - 170)
    const again = advanceCrafting(queued, CRAFT_MS).save
    expect(purseOf(again).archive[0]?.modifiers).toEqual(['keen', 'vicious'])
  })

  it('is refused without a socket, without a first modifier, with the same modifier, an unknown or misfit one', () => {
    const plainSocket = (item: ItemInstance) => advanceCrafting(ok(queueSocket(stocked(17, item), 'hero-1', 'bow', 'riftglass')), CRAFT_MS).save
    expect(queueInfuse(stocked(), 'hero-1', 'bow', 'precise', 'scrap')).toEqual({ ok: false, reason: 'Keen Bow has no socket yet. Open one first.' })
    expect(queueInfuse(plainSocket(keenBow({ modifiers: [] })), 'hero-1', 'bow', 'precise', 'scrap')).toEqual({
      ok: false,
      reason: 'Bow (open socket) has no first modifier. Infuse adds a second one.',
    })
    const save = socketed()
    expect(queueInfuse(save, 'hero-1', 'bow', 'keen', 'scrap')).toEqual({ ok: false, reason: 'Keen is already the first modifier. Pick a different one.' })
    expect(queueInfuse(save, 'hero-1', 'bow', 'nimble', 'scrap')).toEqual({ ok: false, reason: 'Nimble can only go on armor and accessories.' })
    expect(queueInfuse(save, 'hero-1', 'bow', 'nope', 'scrap')).toEqual({ ok: false, reason: 'Pick a modifier to infuse.' })
    expect(queueInfuse(save, 'hero-1', 'bow', 'vicious', 'iron')).toMatchObject({ ok: false })
    expect(queueInfuse(updatePurse(save, { materials: { scrap: 5 } }), 'hero-1', 'bow', 'precise', 'scrap')).toEqual({ ok: false, reason: 'That needs 6 scrap. You have 5.' })
    // A recipe the account has not learned.
    const forgot = { ...save, account: { ...save.account, recipes: ['keen'] } }
    expect(queueInfuse(forgot, 'hero-1', 'bow', 'precise', 'scrap')).toEqual({ ok: false, reason: 'You have not learned the Precise recipe.' })
  })

  it('respects the recipe lock and the modifier level', () => {
    const save = socketed()
    const locked = queueInfuse(save, 'hero-1', 'bow', 'siphoning', 'scrap')
    expect(locked).toEqual({ ok: false, reason: expect.stringContaining('The Siphoning recipe is locked.') })
    const open = { ...save, account: { ...save.account, discoveries: [...save.account.discoveries, 'defeated:tidebound-colossus'] } }
    expect(queueInfuse(open, 'hero-1', 'bow', 'siphoning', 'scrap')).toEqual({ ok: false, reason: 'Siphoning needs level 20. This hero is level 17.' })
  })

  it('keeps the socket and both modifiers through an upgrade, and on an heirloom', () => {
    const heir = keenBow({ heirloom: { heroId: 'hero-1', cap: 17 } })
    const done = advanceCrafting(ok(queueInfuse(socketed(heir), 'hero-1', 'bow', 'precise', 'scrap')), CRAFT_MS).save
    expect(purseOf(done).archive[0]).toMatchObject({ heirloom: { heroId: 'hero-1', cap: 17 }, socketed: true, modifiers: ['keen', 'precise'] })
    const lower = updatePurse(done, { archive: [{ ...purseOf(done).archive[0]!, itemLevel: 10 }] })
    const upgraded = advanceCrafting(ok(queueUpgrade(lower, 'hero-1', 'bow', 'scrap')), CRAFT_MS).save
    expect(purseOf(upgraded).archive[0]).toMatchObject({ itemLevel: 11, socketed: true, modifiers: ['keen', 'precise'] })
  })

  it('works on a worn item and queues behind other jobs', () => {
    const base = socketed()
    const bow = purseOf(base).archive[0]!
    const worn = { ...base, heroes: base.heroes.map((h) => ({ ...h, equipment: { ...h.equipment, mainHand: bow }, purse: { ...h.purse, archive: [] } })) }
    const first = ok(queueInfuse(worn, 'hero-1', 'bow', 'precise', 'scrap'))
    expect(hero(first).equipment.mainHand).toBeNull()
    const second = ok(queueSocket(updatePurse(first, { archive: [newItem('other', 'weapon-bow', 10)] }), 'hero-1', 'other', 'duskiron'))
    expect(purseOf(second).craftQueue.map((job) => job.kind)).toEqual(['infuse', 'socket'])
    const done = advanceCrafting(second, CRAFT_MS * 2)
    expect(hero(done.save).equipment.mainHand).toMatchObject({ id: 'bow', modifiers: ['keen', 'precise'] })
    expect(purseOf(done.save).archive[0]).toMatchObject({ id: 'other', socketed: true })
    expect(hero(done.save).craftXp).toBe(3)
  })
})

describe('saves with sockets', () => {
  function withItem(item: ItemInstance): string {
    return JSON.stringify(updatePurse(stocked(), { archive: [item] }))
  }

  it('round-trips a socketed item with two modifiers', () => {
    const parsed = parseSave(withItem(keenBow({ socketed: true, modifiers: ['keen', 'precise'] })))
    expect(parsed.ok).toBe(true)
  })

  it('rejects a third modifier, a second one without a socket, and a repeated modifier', () => {
    expect(parseSave(withItem(keenBow({ socketed: true, modifiers: ['keen', 'precise', 'vicious'] })))).toEqual({
      ok: false,
      reason: expect.stringContaining('at most 2'),
    })
    expect(parseSave(withItem(keenBow({ modifiers: ['keen', 'precise'] })))).toEqual({ ok: false, reason: expect.stringContaining('no socket') })
    expect(parseSave(withItem(keenBow({ socketed: true, modifiers: ['keen', 'keen'] }))).ok).toBe(false)
    expect(parseSave(withItem(keenBow({ socketed: 'yes' as unknown as boolean }))).ok).toBe(false)
  })

  it('loads an older save: items without the flag are unsocketed and valid', () => {
    const parsed = parseSave(withItem(keenBow()))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(purseOf(parsed.data).archive[0]).not.toHaveProperty('socketed')
    expect(() => assertSaveData(parsed.data)).not.toThrow()
  })

  it('rejects a job that holds an item with a second modifier and no socket', () => {
    const queued = ok(queueSocket(stocked(), 'hero-1', 'bow', 'riftglass'))
    const raw = JSON.parse(serializeSave(queued)) as { heroes: { purse: { craftQueue: { item: ItemInstance }[] } }[] }
    raw.heroes[0]!.purse.craftQueue[0]!.item.modifiers = ['keen', 'precise']
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
  })
})
