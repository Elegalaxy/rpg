import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { newItem } from '../content/items.ts'
import { createCombat } from '../sim/combat.ts'
import { ITEM_MODIFIERS, STARTING_MODIFIER_RECIPES } from '../sim/economy.ts'

import { selectedHero } from './character.ts'
import {
  CRAFT_MS,
  advanceCrafting,
  craftCheck,
  grantCraftingKit,
  proficiencyRank,
  qualityRange,
  queueCraft,
  queueUpgrade,
  upgradeChance,
} from './crafting.ts'
import { equipFromArchive, statsFor } from './equipment.ts'
import { blueprintForHero } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData } from './save.ts'

function stocked(level = 1): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const save = grantCraftingKit(made.save)
  return {
    ...save,
    heroes: save.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level } })),
  }
}

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

const bow = { baseId: 'weapon-bow', itemLevel: 1, materialId: 'shard', modifierId: null }

function finish(save: SaveData): SaveData {
  return advanceCrafting(save, CRAFT_MS * 5).save
}

describe('proficiency and quality range', () => {
  it('ranks by the square root of experience, up to 10', () => {
    expect([0, 1, 3, 4, 9, 99, 100, 400].map(proficiencyRank)).toEqual([0, 1, 1, 2, 3, 9, 10, 10])
  })

  it('raises the minimum by one point per rank and never above the maximum', () => {
    expect(qualityRange('scrap', 0)).toEqual({ low: 0.9, high: 1.0 })
    expect(qualityRange('hide', 0)).toEqual({ low: 0.95, high: 1.05 })
    expect(qualityRange('shard', 0)).toEqual({ low: 1.0, high: 1.1 })
    expect(qualityRange('scrap', 4)?.low).toBeCloseTo(0.94, 10)
    expect(qualityRange('scrap', 10)).toEqual({ low: 1.0, high: 1.0 })
    expect(qualityRange('shard', 10)).toEqual({ low: 1.1, high: 1.1 })
    expect(qualityRange('iron', 3)).toBeNull()
  })

  it('has an upgrade chance of 85% minus 5 points per item level', () => {
    expect([1, 2, 10, 16, 17, 30].map(upgradeChance)).toEqual([0.8, 0.75, 0.35, 0.05, 0, 0])
  })
})

describe('queueing a craft', () => {
  it('takes 6 material and item level × 5 gold, and adds a 30 second job', () => {
    const save = stocked(4)
    const next = ok(queueCraft(save, 'hero-1', { ...bow, itemLevel: 3 }))
    expect(next.account.materials.shard).toBe(24)
    expect(next.account.gold).toBe(300 - 15)
    expect(next.account.craftQueue).toHaveLength(1)
    expect(next.account.craftQueue[0]).toMatchObject({ kind: 'craft', remainingMs: 30_000, seedIndex: 0, rank: 0 })
    expect(next.account.craftCounter).toBe(1)
    expect(() => assertSaveData(next)).not.toThrow()
  })

  it('refuses a fourth job, too little material or gold, and a level above the hero', () => {
    let save = stocked(2)
    for (let index = 0; index < 3; index += 1) save = ok(queueCraft(save, 'hero-1', bow))
    expect(queueCraft(save, 'hero-1', bow)).toEqual({ ok: false, reason: 'The queue is full (3 jobs).' })
    const poor = { ...stocked(), account: { ...stocked().account, materials: { shard: 5 } } }
    expect(queueCraft(poor, 'hero-1', bow)).toEqual({ ok: false, reason: 'That needs 6 shard. You have 5.' })
    const broke = { ...stocked(), account: { ...stocked().account, gold: 4 } }
    expect(queueCraft(broke, 'hero-1', bow)).toEqual({ ok: false, reason: 'That costs 5 gold. You have 4.' })
    expect(queueCraft(stocked(2), 'hero-1', { ...bow, itemLevel: 3 })).toEqual({
      ok: false,
      reason: 'Item level 3 needs hero level 3. This hero is level 2.',
    })
    expect(queueCraft(stocked(), 'hero-1', { ...bow, baseId: 'nothing' }).ok).toBe(false)
    expect(queueCraft(stocked(), 'hero-1', { ...bow, materialId: 'iron' }).ok).toBe(false)
    expect(queueCraft(stocked(), 'hero-1', { ...bow, itemLevel: 0 }).ok).toBe(false)
    expect(queueCraft(stocked(), 'nobody', bow).ok).toBe(false)
  })

  it('checks the modifier recipe and its level', () => {
    const fresh = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!fresh.ok) throw new Error(fresh.reason)
    const save = { ...fresh.save, account: { ...fresh.save.account, gold: 100, materials: { shard: 20 } } }
    expect(fresh.save.account.recipes).toEqual([...STARTING_MODIFIER_RECIPES])
    expect(craftCheck(save, hero(save), { ...bow, modifierId: 'keen' })).toBeNull()
    expect(craftCheck(save, hero(save), { ...bow, modifierId: 'nimble' })).toBe('You have not learned the Nimble recipe.')
    expect(craftCheck(save, hero(save), { ...bow, modifierId: 'bogus' })).toBe('Unknown modifier.')
    const learned = stocked(2)
    expect(craftCheck(learned, hero(learned), { ...bow, modifierId: 'nimble' })).toBe('Nimble needs level 3. This hero is level 2.')
    expect(craftCheck(stocked(3), hero(stocked(3)), { ...bow, modifierId: 'nimble' })).toBeNull()
    expect(Object.keys(ITEM_MODIFIERS)).toHaveLength(6)
  })

  it('is closed while an expedition runs', () => {
    const save = { ...stocked(), expedition: {} as never }
    expect(queueCraft(save, 'hero-1', bow)).toEqual({ ok: false, reason: 'Crafting is closed while an expedition is running.' })
    expect(advanceCrafting(ok(queueCraft(stocked(), 'hero-1', bow)), 0).finished).toEqual([])
  })
})

describe('crafting time', () => {
  it('advances only the first job, keeps the leftover time, and finishes in order', () => {
    let save = stocked()
    save = ok(queueCraft(save, 'hero-1', bow))
    save = ok(queueCraft(save, 'hero-1', { ...bow, baseId: 'weapon-dagger' }))
    const half = advanceCrafting(save, 10_000)
    expect(half.finished).toEqual([])
    expect(half.save.account.craftQueue.map((job) => job.remainingMs)).toEqual([20_000, 30_000])
    const first = advanceCrafting(half.save, 25_000)
    expect(first.finished).toHaveLength(1)
    expect(first.save.account.craftQueue.map((job) => job.remainingMs)).toEqual([25_000])
    expect(first.save.account.archive.map((item) => item.baseId)).toEqual(['weapon-bow'])
    const both = advanceCrafting(first.save, 25_000)
    expect(both.finished).toHaveLength(1)
    expect(both.save.account.archive.map((item) => item.baseId)).toEqual(['weapon-bow', 'weapon-dagger'])
    expect(both.save.account.craftQueue).toEqual([])
    expect(advanceCrafting(both.save, 1000).finished).toEqual([])
    const one = advanceCrafting(save, 70_000)
    expect(one.finished).toHaveLength(2)
    expect(one.save.account.craftQueue).toEqual([])
  })

  it('makes an item in the visible range with its modifier, and adds 1 experience', () => {
    const save = ok(queueCraft(stocked(), 'hero-1', { ...bow, materialId: 'hide', modifierId: 'keen' }))
    const done = finish(save)
    const item = done.account.archive[0]!
    expect(item).toMatchObject({ id: 'craft-1', baseId: 'weapon-bow', itemLevel: 1, modifiers: ['keen'], durability: 100 })
    expect(item.quality).toBeGreaterThanOrEqual(0.95)
    expect(item.quality).toBeLessThanOrEqual(1.05)
    expect(hero(done).craftXp).toBe(1)
    expect(() => assertSaveData(done)).not.toThrow()
    expect(parseSave(serializeSave(done)).ok).toBe(true)
  })

  it('rolls the same quality for the same seed, and favors the middle of the range', () => {
    const roll = (index: number) => {
      const base = ok(queueCraft({ ...stocked(), account: { ...stocked().account, craftCounter: index } }, 'hero-1', bow))
      return finish(base).account.archive[0]!.quality
    }
    expect(roll(7)).toBe(roll(7))
    const values = Array.from({ length: 300 }, (_, index) => roll(index))
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1.0)
    expect(Math.max(...values)).toBeLessThanOrEqual(1.1)
    const middle = values.filter((value) => value >= 1.025 && value <= 1.075).length
    expect(middle / values.length).toBeGreaterThan(0.6)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    expect(mean).toBeGreaterThan(1.04)
    expect(mean).toBeLessThan(1.06)
  })

  it('narrows the range as the hero gains rank, using the rank held when the job was queued', () => {
    let save = stocked()
    save = { ...save, heroes: save.heroes.map((h) => ({ ...h, craftXp: 100 })) }
    const queued = ok(queueCraft(save, 'hero-1', { ...bow, materialId: 'scrap' }))
    expect(queued.account.craftQueue[0]).toMatchObject({ rank: 10 })
    expect(finish(queued).account.archive[0]!.quality).toBe(1)
    const lower = ok(queueCraft({ ...stocked(), heroes: stocked().heroes.map((h) => ({ ...h, craftXp: 25 })) }, 'hero-1', { ...bow, materialId: 'scrap' }))
    const quality = finish(lower).account.archive[0]!.quality
    expect(quality).toBeGreaterThanOrEqual(0.95)
    expect(quality).toBeLessThanOrEqual(1)
  })
})

describe('upgrades', () => {
  function withItem(level: number, counter: number): SaveData {
    const save = stocked(level + 3)
    return { ...save, account: { ...save.account, craftCounter: counter, archive: [newItem('old', 'weapon-bow', level, 1.05)] } }
  }

  it('holds the item while it works, charges 4 material and item level × 5 gold, and adds 1 level on success', () => {
    let worked = false
    for (let counter = 0; counter < 60 && !worked; counter += 1) {
      const queued = ok(queueUpgrade(withItem(2, counter), 'hero-1', 'old', 'scrap'))
      expect(queued.account.archive).toEqual([])
      expect(queued.account.materials.scrap).toBe(26)
      expect(queued.account.gold).toBe(300 - 10)
      expect(queued.account.craftQueue[0]).toMatchObject({ kind: 'upgrade', materialId: 'scrap' })
      const done = advanceCrafting(queued, CRAFT_MS)
      const item = done.save.account.archive[0]!
      expect(item.id).toBe('old')
      expect(item.quality).toBe(1.05)
      if (item.itemLevel === 3) {
        worked = true
        expect(done.finished[0]?.text).toMatch(/upgraded to item level 3/)
      }
      expect(hero(done.save).craftXp).toBe(1)
    }
    expect(worked).toBe(true)
  })

  it('on a failure uses the materials and returns the item unchanged', () => {
    let failed = false
    for (let counter = 0; counter < 80 && !failed; counter += 1) {
      const queued = ok(queueUpgrade(withItem(12, counter), 'hero-1', 'old', 'shard'))
      const done = advanceCrafting(queued, CRAFT_MS)
      const item = done.save.account.archive[0]!
      if (item.itemLevel === 12) {
        failed = true
        expect(item).toEqual(newItem('old', 'weapon-bow', 12, 1.05))
        expect(done.save.account.materials.shard).toBe(26)
        expect(done.save.account.gold).toBe(300 - 60)
        expect(done.finished[0]?.text).toMatch(/failed\. The materials are gone and the item is unchanged/)
        expect(hero(done.save).craftXp).toBe(1)
      }
    }
    expect(failed).toBe(true)
  })

  it('refuses items above the hero, in the wrong place, past the chance, or with no queue room', () => {
    const save = withItem(2, 0)
    const capped = { ...save, heroes: save.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 2 } })) }
    expect(queueUpgrade(capped, 'hero-1', 'old', 'scrap')).toEqual({
      ok: false,
      reason: "This hero is level 2. An item cannot go above the hero's level.",
    })
    expect(queueUpgrade(save, 'hero-1', 'hero-1-mainHand', 'scrap')).toEqual({ ok: false, reason: 'Only archive items can be upgraded.' })
    const deep = { ...withItem(17, 0), heroes: withItem(17, 0).heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 20 } })) }
    expect(queueUpgrade(deep, 'hero-1', 'old', 'scrap')).toEqual({ ok: false, reason: 'That item cannot be upgraded further.' })
    expect(queueUpgrade(save, 'hero-1', 'old', 'iron').ok).toBe(false)
    let full = save
    for (let index = 0; index < 3; index += 1) full = ok(queueCraft(full, 'hero-1', bow))
    expect(queueUpgrade(full, 'hero-1', 'old', 'scrap')).toEqual({ ok: false, reason: 'The queue is full (3 jobs).' })
  })
})

describe('modifiers in play', () => {
  function crafted(modifierId: string, level: number): SaveData {
    const queued = ok(queueCraft(stocked(level), 'hero-1', { ...bow, baseId: 'weapon-one-handed', itemLevel: 1, modifierId }))
    return finish(queued)
  }

  it('adds a modifier bonus to the derived stats when the item is equipped', () => {
    const save = crafted('keen', 1)
    const before = statsFor(hero(save))!
    const equipped = ok(equipFromArchive(save, 'hero-1', 'craft-1'))
    const after = statsFor(hero(equipped))!
    expect(after.critChance - before.critChance).toBeCloseTo(0.02, 10)
    const precise = ok(equipFromArchive(crafted('precise', 1), 'hero-1', 'craft-1'))
    expect(statsFor(hero(precise))!.accuracy - before.accuracy).toBe(3)
  })

  it('reaches the fight, so a crafted weapon changes the next one (criterion 8)', () => {
    const save = ok(equipFromArchive(crafted('keen', 1), 'hero-1', 'craft-1'))
    const plain = ok(equipFromArchive({ ...save, account: { ...save.account, archive: [newItem('p', 'weapon-one-handed', 1)] } }, 'hero-1', 'p'))
    const fight = (s: SaveData) => {
      const setup = blueprintForHero(hero(s), 'splintered-road').hero
      const defs = gameDefs()
      return createCombat({ hero: setup, enemies: [{ defId: 'fracture-shardling', slot: 0, level: 3 }] }, defs, 1).hero
    }
    expect(fight(save).critChance - fight(plain).critChance).toBeCloseTo(0.02, 10)
    expect(blueprintForHero(hero(save), 'splintered-road').hero.statBonuses).toEqual({ critChanceBonus: 0.02 })
  })

  it('adds modifiers on different items together and needs the level to wear them', () => {
    const quick = crafted('quick', 9)
    const low = { ...quick, heroes: quick.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 5 } })) }
    expect(equipFromArchive(low, 'hero-1', 'craft-1')).toEqual({ ok: false, reason: 'Quick needs level 9. This hero is level 5.' })
    expect(equipFromArchive(quick, 'hero-1', 'craft-1').ok).toBe(true)
    const both = ok(equipFromArchive(crafted('keen', 1), 'hero-1', 'craft-1'))
    const keenOnRing = {
      ...both,
      heroes: both.heroes.map((h) => ({
        ...h,
        equipment: { ...h.equipment, accessory0: { ...h.equipment.accessory0!, modifiers: ['keen'] } },
      })),
    }
    const stats = statsFor(hero(keenOnRing))!
    const base = statsFor(hero(ok(equipFromArchive(crafted('precise', 1), 'hero-1', 'craft-1'))))!
    expect(stats.critChance - base.critChance).toBeCloseTo(0.04, 10)
  })

  it('rejects an unknown modifier or a broken job in a save', () => {
    const save = ok(queueCraft(stocked(), 'hero-1', { ...bow, modifierId: 'keen' }))
    const raw = JSON.parse(serializeSave(save)) as { account: { craftQueue: Record<string, unknown>[] } }
    raw.account.craftQueue[0]!.modifierId = 'bogus'
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false, reason: expect.stringMatching(/unknown modifier/) })
    raw.account.craftQueue[0]!.modifierId = 'keen'
    raw.account.craftQueue[0]!.kind = 'brew'
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false })
    const again = JSON.parse(serializeSave(save)) as { account: { craftQueue: unknown[] } }
    again.account.craftQueue = [1, 2, 3, 4]
    expect(parseSave(JSON.stringify(again))).toMatchObject({ ok: false, reason: expect.stringMatching(/at most 3 jobs/) })
  })
})
