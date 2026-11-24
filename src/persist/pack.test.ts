import { describe, expect, it } from 'vitest'

import { SPLINTERED_ROAD_ID, SUPPLY_SLOT_COUNT, SUPPLY_STACK_LIMIT, createExpedition } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { CRAFT_MS, advanceCrafting, grantCraftingKit, packCheck, packMaterials, queuePack } from './crafting.ts'
import { blueprintForHero } from './expeditionSetup.ts'
import { PACKS, limitStacks, nextPack, overStacked, packSlots, stackLimit } from './pack.ts'
import { checkPreparation, clampToStash, draftFor, packRefusal, stepPacked } from './preparation.ts'
import { reincarnate } from './reincarnation.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, purseOf, serializeSave, updatePurse, type SaveData } from './save.ts'

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

/** A hero at `level` with 20,000 gold and 40 of every material. */
function stocked(level = 17): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const kit = grantCraftingKit(made.save)
  const leveled = { ...kit, heroes: kit.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level } })) }
  const materials = Object.fromEntries(Object.keys(purseOf(leveled).materials).map((id) => [id, 40]))
  return updatePurse(leveled, { gold: 20_000, materials })
}

const hero = (save: SaveData) => selectedHero(save)!

/** Queue a pack, run its job to the end and return the save. */
function made(save: SaveData, packId: 'satchel' | 'fieldPack', material: string): SaveData {
  return advanceCrafting(ok(queuePack(save, 'hero-1', packId, material)), CRAFT_MS).save
}

describe('pack numbers', () => {
  it('has a 5-slot Satchel and a 6-slot Field Pack, and 4 slots without one', () => {
    expect(PACKS.satchel).toMatchObject({ slots: 5, minHeroLevel: 10, minGrade: 2, gold: 400 })
    expect(PACKS.fieldPack).toMatchObject({ slots: 6, minHeroLevel: 17, minGrade: 3, gold: 1200, needs: 'satchel' })
    expect(packSlots({})).toBe(SUPPLY_SLOT_COUNT)
    expect(packSlots({ pack: 'satchel' })).toBe(5)
    expect(packSlots({ pack: 'fieldPack' })).toBe(6)
    expect([nextPack({}), nextPack({ pack: 'satchel' }), nextPack({ pack: 'fieldPack' })]).toEqual(['satchel', 'fieldPack', null])
  })

  it('takes materials by grade: grade 2 and up for the Satchel, 3 and up for the Field Pack', () => {
    expect(packMaterials('satchel')).toEqual(['shard', 'witherbark', 'oathsteel', 'riftglass', 'duskiron', 'cinderite', 'bloodstone'])
    expect(packMaterials('fieldPack')).toEqual(['riftglass', 'duskiron', 'cinderite', 'bloodstone'])
  })

  it('limits stacks only above 4 slots', () => {
    expect(stackLimit(4)).toBeNull()
    expect(stackLimit(5)).toBe(SUPPLY_STACK_LIMIT)
    expect(limitStacks(['a', 'a', 'a', 'b'], 4)).toEqual(['a', 'a', 'a', 'b'])
    expect(limitStacks(['a', 'a', 'a', 'b', 'a'], 5)).toEqual(['a', 'a', 'a', 'b'])
    expect(overStacked(['a', 'a', 'a'], 4)).toBeNull()
    expect(overStacked(['a', 'a', 'a', 'a', '', ''], 6)).toBe('a')
  })
})

describe('crafting a pack', () => {
  it('pays 8 units and 400 gold when queued, takes 30 s, and adds the pack when the job ends', () => {
    const queued = ok(queuePack(stocked(), 'hero-1', 'satchel', 'shard'))
    expect(purseOf(queued).gold).toBe(19_600)
    expect(purseOf(queued).materials.shard).toBe(32)
    expect(purseOf(queued).craftQueue[0]).toMatchObject({ kind: 'pack', packId: 'satchel', remainingMs: CRAFT_MS })
    expect(hero(queued).pack).toBeUndefined()
    const half = advanceCrafting(queued, CRAFT_MS - 1)
    expect(hero(half.save).pack).toBeUndefined()
    const done = advanceCrafting(queued, CRAFT_MS)
    expect(hero(done.save).pack).toBe('satchel')
    expect(done.finished[0]?.text).toContain('Satchel')
    expect(() => assertSaveData(done.save)).not.toThrow()
  })

  it('needs hero level 10, a grade 2 material, the units and the gold', () => {
    expect(queuePack(stocked(9), 'hero-1', 'satchel', 'shard')).toEqual({ ok: false, reason: 'The Satchel needs hero level 10. This hero is level 9.' })
    const low = queuePack(stocked(), 'hero-1', 'satchel', 'hide')
    expect(low.ok ? '' : low.reason).toContain('grade 2 or better')
    expect(queuePack(updatePurse(stocked(), { materials: { shard: 7 } }), 'hero-1', 'satchel', 'shard')).toEqual({ ok: false, reason: 'That needs 8 shard. You have 7.' })
    expect(queuePack(updatePurse(stocked(), { gold: 399 }), 'hero-1', 'satchel', 'shard')).toEqual({ ok: false, reason: 'That costs 400 gold. You have 399.' })
  })

  it('needs the Satchel finished before the Field Pack, at level 17 and grade 3', () => {
    const save = stocked()
    expect(queuePack(save, 'hero-1', 'fieldPack', 'riftglass')).toEqual({ ok: false, reason: 'The Field Pack needs the Satchel first.' })
    const queued = ok(queuePack(save, 'hero-1', 'satchel', 'shard'))
    expect(packCheck(queued, hero(queued), 'fieldPack', 'riftglass')).toBe('The Field Pack needs the Satchel first.')
    expect(packCheck(queued, hero(queued), 'satchel', 'shard')).toBe('A Satchel is already being made.')
    const satchel = made(save, 'satchel', 'shard')
    const low = { ...satchel, heroes: satchel.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 16 } })) }
    expect(queuePack(low, 'hero-1', 'fieldPack', 'riftglass')).toEqual({ ok: false, reason: 'The Field Pack needs hero level 17. This hero is level 16.' })
    const shard = queuePack(satchel, 'hero-1', 'fieldPack', 'shard')
    expect(shard.ok ? '' : shard.reason).toContain('grade 3 or better')
    const field = made(satchel, 'fieldPack', 'riftglass')
    expect(hero(field).pack).toBe('fieldPack')
    expect(purseOf(field).gold).toBe(20_000 - 400 - 1200)
    expect(purseOf(field).materials.riftglass).toBe(30)
    expect(packCheck(field, hero(field), 'satchel', 'shard')).toContain('already has a better pack')
    expect(packCheck(field, hero(field), 'fieldPack', 'riftglass')).toContain('already has a Field Pack')
  })

  it('is closed while an expedition runs', () => {
    const base = stocked()
    const blueprint = blueprintForHero(hero(base), SPLINTERED_ROAD_ID)
    const running = { ...base, expedition: createExpedition(blueprint, 1) }
    expect(queuePack(running, 'hero-1', 'satchel', 'shard').ok).toBe(false)
  })

  it('survives a save round trip, and an old save without a pack loads with 4 slots', () => {
    const save = made(stocked(), 'satchel', 'shard')
    const round = parseSave(serializeSave(save))
    expect(round.ok && hero(round.data).pack).toBe('satchel')
    const old = JSON.parse(serializeSave(stocked()))
    expect('pack' in old.heroes[0]).toBe(false)
    const loaded = parseSave(JSON.stringify(old))
    expect(loaded.ok && packSlots(hero(loaded.data))).toBe(4)
  })

  it('is kept through reincarnation', () => {
    const save = made(stocked(), 'satchel', 'shard')
    const lost = { ...save, heroes: save.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    const next = ok(reincarnate(lost, 'hero-1', null))
    expect(hero(next).pack).toBe('satchel')
    expect(hero(next).lives).toBe(1)
  })
})

describe('supply slots follow the pack', () => {
  const withPack = (save: SaveData, pack: 'satchel' | 'fieldPack') => ({ ...save, heroes: save.heroes.map((h) => ({ ...h, pack })) })

  it('sizes the preparation draft, and leaves the blueprint at 4 slots untouched', () => {
    const plain = stocked()
    expect(draftFor(hero(plain)).supplies).toHaveLength(4)
    expect('supplySlotCount' in blueprintForHero(hero(plain), SPLINTERED_ROAD_ID)).toBe(false)
    expect(draftFor(hero(withPack(plain, 'satchel'))).supplies).toHaveLength(5)
    expect(draftFor(hero(withPack(plain, 'fieldPack'))).supplies).toHaveLength(6)
    expect(blueprintForHero(hero(withPack(plain, 'fieldPack')), SPLINTERED_ROAD_ID).supplySlotCount).toBe(6)
  })

  it('refuses a third copy with a backpack and says why, but not at 4 slots', () => {
    const picks = ['healing-draught', 'healing-draught', 'healing-draught', '', '']
    expect(packRefusal(picks, 'healing-draught', 9, 5)).toBe('At most 3 of each supply with a backpack.')
    expect(stepPacked(picks, 'healing-draught', 1, 9, 5)).toEqual(picks)
    expect(stepPacked(picks, 'ward-charm', 1, 9, 5)).toEqual(['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm', ''])
    expect(packRefusal(['healing-draught', 'healing-draught', '', ''], 'healing-draught', 9, 4)).toBeNull()
    expect(stepPacked(['healing-draught', 'healing-draught', '', ''], 'healing-draught', 1, 9)).toEqual(['healing-draught', 'healing-draught', 'healing-draught', ''])
    expect(packRefusal(['a', 'b', 'c', 'd', 'e'], 'a', 9, 5)).toBe('Every slot is full.')
    expect(packRefusal(['', '', '', ''], 'a', 0, 4)).toBe('You have none in the stash.')
    expect(clampToStash(['healing-draught', '', ''], { 'healing-draught': 1 }, 6)).toHaveLength(6)
  })

  it('checks the draft against the hero slots and the stack limit', () => {
    const plain = hero(stocked())
    const five = hero(withPack(stocked(), 'satchel'))
    const fiveSupplies = ['healing-draught', 'healing-draught', 'ward-charm', 'antidote', '']
    expect(checkPreparation(plain, { ...draftFor(plain), supplies: fiveSupplies }).ok).toBe(false)
    expect(checkPreparation(five, { ...draftFor(five), supplies: fiveSupplies }).ok).toBe(true)
    const third = checkPreparation(five, { ...draftFor(five), supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'healing-draught', ''] })
    expect(third.ok ? [] : third.errors).toContain('At most 3 of each supply with a backpack.')
    const four = checkPreparation(plain, { ...draftFor(plain), supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'healing-draught'] })
    expect(four.ok).toBe(true)
  })

  it('rejects a saved hero that packs more than its slots or a third copy with a pack', () => {
    const save = withPack(stocked(), 'satchel')
    const six = { ...save, heroes: save.heroes.map((h) => ({ ...h, packedSupplies: ['healing-draught', 'healing-draught', 'ward-charm', 'antidote', 'smoke-bomb', 'ward-charm'] })) }
    expect(() => assertSaveData(six)).toThrow(/packs more than 5/)
    const third = { ...save, heroes: save.heroes.map((h) => ({ ...h, packedSupplies: ['healing-draught', 'healing-draught', 'healing-draught', 'healing-draught'] })) }
    expect(() => assertSaveData(third)).toThrow(/more than 3 of one supply/)
    const plain = stocked()
    const fine = { ...plain, heroes: plain.heroes.map((h) => ({ ...h, packedSupplies: ['healing-draught', 'healing-draught', 'healing-draught', 'healing-draught'] })) }
    expect(() => assertSaveData(fine)).not.toThrow()
  })
})
