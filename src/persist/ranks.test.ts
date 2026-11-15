import { describe, expect, it } from 'vitest'

import { itemName, newItem } from '../content/items.ts'
import type { ItemInstance } from '../sim/economy.ts'

import { selectedHero } from './character.ts'
import { CRAFT_MS, advanceCrafting, grantCraftingKit, queueInfuse, queueRankUp, queueSocket, queueUpgrade, rankGold } from './crafting.ts'
import { previewEquip } from './equipment.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, purseOf, updatePurse, type SaveData } from './save.ts'
import { beginExpedition } from './world.ts'
import { SPLINTERED_ROAD_ID } from '../sim/expedition.ts'

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

/** A Vicious sword has minimum level 3: rank II costs 90 gold and rank III 180. Keen is level 1: 30 and 60. */
function keenBow(over: Partial<ItemInstance> = {}): ItemInstance {
  return { ...newItem('bow', 'weapon-bow', 17, 1.07), modifiers: ['keen'], ...over }
}

function stocked(level = 17, item: ItemInstance = keenBow()): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const kit = grantCraftingKit(made.save)
  const leveled = { ...kit, heroes: kit.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level } })) }
  const materials = Object.fromEntries(Object.keys(purseOf(leveled).materials).map((id) => [id, 40]))
  return updatePurse(leveled, { gold: 10_000, materials, archive: [item] })
}

const finish = (save: SaveData) => advanceCrafting(save, CRAFT_MS).save
const heroOf = (save: SaveData) => selectedHero(save)!

describe('rank up', () => {
  it('costs minimum level x 30 gold and 6 of any material for II, x 60 and 10 rare for III', () => {
    expect(rankGold('keen', 2)).toBe(30)
    expect(rankGold('keen', 3)).toBe(60)
    expect(rankGold('sturdy', 2)).toBe(180)
    expect(rankGold('bloodbound', 3)).toBe(1440)
    const queued = ok(queueRankUp(stocked(), 'hero-1', 'bow', 0, 'scrap'))
    expect(purseOf(queued).gold).toBe(10_000 - 30)
    expect(purseOf(queued).materials.scrap).toBe(34)
    expect(purseOf(queued).archive).toEqual([])
    expect(purseOf(queued).craftQueue[0]).toMatchObject({ kind: 'rank', modifierIndex: 0, toRank: 2, remainingMs: CRAFT_MS })
    const two = finish(queued)
    expect(purseOf(two).archive[0]).toMatchObject({ id: 'bow', modifiers: ['keen'], modifierRanks: [2], quality: 1.07, durability: 100 })
    expect(itemName(purseOf(two).archive[0]!)).toBe('Keen II Bow')
    expect(heroOf(two).craftXp).toBe(1)
    // Rank III asks for a rare material.
    expect(queueRankUp(two, 'hero-1', 'bow', 0, 'scrap')).toEqual({ ok: false, reason: 'Rank III needs riftglass, duskiron or cinderite.' })
    const three = queueRankUp(two, 'hero-1', 'bow', 0, 'duskiron')
    const queuedThree = ok(three)
    expect(purseOf(queuedThree).gold).toBe(purseOf(two).gold - 60)
    expect(purseOf(queuedThree).materials.duskiron).toBe(30)
    const done = finish(queuedThree)
    expect(purseOf(done).archive[0]?.modifierRanks).toEqual([3])
    expect(queueRankUp(done, 'hero-1', 'bow', 0, 'cinderite')).toEqual({ ok: false, reason: 'Keen is already rank III.' })
  })

  it('is refused for a missing modifier, Hauler, a low hero level, short stock and during a run', () => {
    expect(queueRankUp(stocked(), 'hero-1', 'bow', 1, 'scrap')).toEqual({ ok: false, reason: 'Keen Bow has no modifier in that slot.' })
    const hauler = stocked(17, { ...newItem('c', 'armor-heavy-chest', 10), modifiers: ['hauler'] })
    expect(queueRankUp(hauler, 'hero-1', 'c', 0, 'scrap')).toEqual({ ok: false, reason: 'Hauler\'s has no number a rank could raise.' })
    const sturdy = stocked(5, { ...newItem('a', 'armor-heavy-chest', 5), modifiers: ['sturdy'] })
    expect(queueRankUp(sturdy, 'hero-1', 'a', 0, 'scrap')).toEqual({ ok: false, reason: 'Sturdy needs level 6. This hero is level 5.' })
    expect(queueRankUp(updatePurse(stocked(), { gold: 10 }), 'hero-1', 'bow', 0, 'scrap')).toEqual({ ok: false, reason: 'That costs 30 gold. You have 10.' })
    expect(queueRankUp(updatePurse(stocked(), { materials: { scrap: 5 } }), 'hero-1', 'bow', 0, 'scrap')).toEqual({ ok: false, reason: 'That needs 6 scrap. You have 5.' })
    const started = ok(beginExpedition(stocked(), SPLINTERED_ROAD_ID, 1))
    expect(queueRankUp(started, 'hero-1', 'bow', 0, 'scrap')).toEqual({ ok: false, reason: 'Crafting is closed while an expedition is running.' })
  })

  it('works on a worn item and returns it to the slot with its rank', () => {
    const base = stocked()
    const worn = { ...base, heroes: base.heroes.map((h) => ({ ...h, equipment: { ...h.equipment, accessory0: { ...keenBow(), id: 'ring', baseId: 'accessory-ring' } }, purse: { ...h.purse, archive: [] } })) }
    const queued = ok(queueRankUp(worn, 'hero-1', 'ring', 0, 'hide'))
    expect(heroOf(queued).equipment.accessory0).toBeNull()
    expect(heroOf(finish(queued)).equipment.accessory0).toMatchObject({ id: 'ring', modifierRanks: [2] })
  })

  it('ranks the socket modifier separately, keeps ranks through an upgrade, and infuse starts the new one at rank I', () => {
    const socketed = finish(ok(queueSocket(stocked(), 'hero-1', 'bow', 'riftglass')))
    const infused = finish(ok(queueInfuse(socketed, 'hero-1', 'bow', 'precise', 'scrap')))
    const second = finish(ok(queueRankUp(infused, 'hero-1', 'bow', 1, 'scrap')))
    expect(purseOf(second).archive[0]).toMatchObject({ modifiers: ['keen', 'precise'], modifierRanks: [1, 2] })
    expect(itemName(purseOf(second).archive[0]!)).toBe('Keen Precise II Bow')
    const first = finish(ok(queueRankUp(second, 'hero-1', 'bow', 0, 'scrap')))
    expect(purseOf(first).archive[0]?.modifierRanks).toEqual([2, 2])
    const lower = updatePurse(first, { archive: [{ ...purseOf(first).archive[0]!, itemLevel: 10 }] })
    expect(purseOf(finish(ok(queueUpgrade(lower, 'hero-1', 'bow', 'scrap')))).archive[0]).toMatchObject({ itemLevel: 11, modifierRanks: [2, 2], socketed: true })
    // Replacing the second modifier resets that slot only.
    const replaced = finish(ok(queueInfuse(first, 'hero-1', 'bow', 'vicious', 'hide')))
    expect(purseOf(replaced).archive[0]).toMatchObject({ modifiers: ['keen', 'vicious'], modifierRanks: [2, 1] })
    const plainFirst = finish(ok(queueInfuse(second, 'hero-1', 'bow', 'vicious', 'hide')))
    expect(purseOf(plainFirst).archive[0]).not.toHaveProperty('modifierRanks')
  })

  it('shows the rank in the compare notes', () => {
    const base = stocked(17, { ...newItem('ring2', 'accessory-ring', 5), modifiers: ['keen'], modifierRanks: [2] })
    const withNew = { ...base, heroes: base.heroes.map((h) => ({ ...h, equipment: { ...h.equipment, accessory0: { ...newItem('ring', 'accessory-ring', 1), modifiers: ['keen'] } } })) }
    const preview = previewEquip(withNew, 'hero-1', 'ring2', 'accessory0')
    const text = JSON.stringify(preview)
    expect(text).toContain('Gains Keen II: +2.4 points critical chance')
    expect(text).toContain('Loses Keen: +2 points critical chance')
  })
})

describe('saves with ranks', () => {
  const withItem = (item: ItemInstance) => JSON.stringify(updatePurse(stocked(), { archive: [item] }))

  it('round-trips ranks and loads an older item without them', () => {
    expect(parseSave(withItem(keenBow({ modifierRanks: [3] }))).ok).toBe(true)
    const old = parseSave(withItem(keenBow()))
    if (!old.ok) throw new Error(old.reason)
    expect(purseOf(old.data).archive[0]).not.toHaveProperty('modifierRanks')
    expect(() => assertSaveData(old.data)).not.toThrow()
  })

  it('rejects a rank above III, below I, extra ranks, or a rank on Hauler', () => {
    expect(parseSave(withItem(keenBow({ modifierRanks: [4] }))).ok).toBe(false)
    expect(parseSave(withItem(keenBow({ modifierRanks: [0] }))).ok).toBe(false)
    expect(parseSave(withItem(keenBow({ modifierRanks: [2, 2] }))).ok).toBe(false)
    expect(parseSave(withItem(keenBow({ modifierRanks: [1.5] }))).ok).toBe(false)
    expect(parseSave(withItem({ ...newItem('c', 'armor-heavy-chest', 10), modifiers: ['hauler'], modifierRanks: [2] })).ok).toBe(false)
  })
})
