import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { newItem } from '../content/items.ts'
import { createCombat } from '../sim/combat.ts'
import { ITEM_MODIFIERS, STARTING_MODIFIER_RECIPES } from '../sim/economy.ts'

import { selectedHero } from './character.ts'
import {
  CRAFT_MS,
  advanceCrafting,
  buyRecipe,
  recipePrice,
  recipesForSale,
  craftCheck,
  grantCraftingKit,
  proficiencyRank,
  qualityRange,
  queueCraft,
  queueUpgrade,
  craftGold,
  upgradeGold,
  upgradedQuality,
  upgradeCheck,
  pickMaterialText,
  upgradeCapFor,
  MATERIAL_QUALITY,
  UPGRADE_QUALITY_POINTS,
} from './crafting.ts'
import { equipFromArchive, statsFor } from './equipment.ts'
import { blueprintForHero } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData, purseOf, updatePurse } from './save.ts'

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

const bow = { baseId: 'weapon-one-handed', itemLevel: 1, materialId: 'shard', modifierId: null }

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

  it('charges 3 gold per item level for an upgrade, against 5 for a craft', () => {
    expect([1, 2, 10, 19].map(upgradeGold)).toEqual([3, 6, 30, 57])
    expect([1, 2, 10, 19].map(craftGold)).toEqual([5, 10, 50, 95])
  })
})

describe('queueing a craft', () => {
  it('takes 6 material and item level × 5 gold, and adds a 30 second job', () => {
    const save = stocked(4)
    const next = ok(queueCraft(save, 'hero-1', { ...bow, itemLevel: 3 }))
    expect(purseOf(next).materials.shard).toBe(24)
    expect(purseOf(next).gold).toBe(300 - 15)
    expect(purseOf(next).craftQueue).toHaveLength(1)
    expect(purseOf(next).craftQueue[0]).toMatchObject({ kind: 'craft', remainingMs: 30_000, seedIndex: 0, rank: 0 })
    expect(purseOf(next).craftCounter).toBe(1)
    expect(() => assertSaveData(next)).not.toThrow()
  })

  it('refuses a fourth job, too little material or gold, and a level above the hero', () => {
    let save = stocked(2)
    for (let index = 0; index < 3; index += 1) save = ok(queueCraft(save, 'hero-1', bow))
    expect(queueCraft(save, 'hero-1', bow)).toEqual({ ok: false, reason: 'The queue is full (3 jobs).' })
    const poor = updatePurse(stocked(), { materials: { shard: 5 } })
    expect(queueCraft(poor, 'hero-1', bow)).toEqual({ ok: false, reason: 'That needs 6 shard. You have 5.' })
    const broke = updatePurse(stocked(), { gold: 4 })
    expect(queueCraft(broke, 'hero-1', bow)).toEqual({ ok: false, reason: 'That costs 5 gold. You have 4.' })
    expect(queueCraft(stocked(2), 'hero-1', { ...bow, itemLevel: 3 })).toEqual({
      ok: false,
      reason: 'Item level 3 needs hero level 3. This hero is level 2.',
    })
    expect(queueCraft(stocked(), 'hero-1', { ...bow, baseId: 'nothing' }).ok).toBe(false)
    expect(queueCraft(stocked(), 'hero-1', { ...bow, baseId: 'weapon-bow' })).toEqual({ ok: false, reason: 'Bow cannot be used by a warrior.' })
    expect(queueCraft(stocked(), 'hero-1', { ...bow, materialId: 'iron' }).ok).toBe(false)
    expect(queueCraft(stocked(), 'hero-1', { ...bow, itemLevel: 0 }).ok).toBe(false)
    expect(queueCraft(stocked(), 'nobody', bow).ok).toBe(false)
  })

  it('checks the modifier recipe and its level', () => {
    const fresh = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!fresh.ok) throw new Error(fresh.reason)
    const save = updatePurse(fresh.save, { gold: 100, materials: { shard: 20 } })
    expect(fresh.save.account.recipes).toEqual([...STARTING_MODIFIER_RECIPES])
    expect(craftCheck(save, hero(save), { ...bow, modifierId: 'keen' })).toBeNull()
    expect(craftCheck(save, hero(save), { ...bow, modifierId: 'nimble' })).toBe('You have not learned the Nimble recipe.')
    expect(craftCheck(save, hero(save), { ...bow, modifierId: 'bogus' })).toBe('Unknown modifier.')
    const learned = stocked(2)
    expect(craftCheck(learned, hero(learned), { ...bow, modifierId: 'nimble' })).toBe('Nimble needs level 3. This hero is level 2.')
    expect(craftCheck(stocked(3), hero(stocked(3)), { ...bow, modifierId: 'nimble' })).toBe('Nimble can only go on armor and accessories.')
    expect(craftCheck(stocked(3), hero(stocked(3)), { ...bow, baseId: 'armor-heavy-chest', modifierId: 'nimble' })).toBeNull()
    expect(Object.keys(ITEM_MODIFIERS)).toHaveLength(9)
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
    save = ok(queueCraft(save, 'hero-1', { ...bow, baseId: 'weapon-two-handed' }))
    const half = advanceCrafting(save, 10_000)
    expect(half.finished).toEqual([])
    expect(purseOf(half.save).craftQueue.map((job) => job.remainingMs)).toEqual([20_000, 30_000])
    const first = advanceCrafting(half.save, 25_000)
    expect(first.finished).toHaveLength(1)
    expect(purseOf(first.save).craftQueue.map((job) => job.remainingMs)).toEqual([25_000])
    expect(purseOf(first.save).archive.map((item) => item.baseId)).toEqual(['weapon-one-handed'])
    const both = advanceCrafting(first.save, 25_000)
    expect(both.finished).toHaveLength(1)
    expect(purseOf(both.save).archive.map((item) => item.baseId)).toEqual(['weapon-one-handed', 'weapon-two-handed'])
    expect(purseOf(both.save).craftQueue).toEqual([])
    expect(advanceCrafting(both.save, 1000).finished).toEqual([])
    const one = advanceCrafting(save, 70_000)
    expect(one.finished).toHaveLength(2)
    expect(purseOf(one.save).craftQueue).toEqual([])
  })

  it('makes an item in the visible range with its modifier, and adds 1 experience', () => {
    const save = ok(queueCraft(stocked(), 'hero-1', { ...bow, materialId: 'hide', modifierId: 'keen' }))
    const done = finish(save)
    const item = purseOf(done).archive[0]!
    expect(item).toMatchObject({ id: 'craft-hero-1-1', baseId: 'weapon-one-handed', itemLevel: 1, modifiers: ['keen'], durability: 100 })
    expect(item.quality).toBeGreaterThanOrEqual(0.95)
    expect(item.quality).toBeLessThanOrEqual(1.05)
    expect(hero(done).craftXp).toBe(1)
    expect(() => assertSaveData(done)).not.toThrow()
    expect(parseSave(serializeSave(done)).ok).toBe(true)
  })

  it('rolls the same quality for the same seed, and favors the middle of the range', () => {
    const roll = (index: number) => {
      const base = ok(queueCraft(updatePurse(stocked(), { craftCounter: index }), 'hero-1', bow))
      return purseOf(finish(base)).archive[0]!.quality
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
    expect(purseOf(queued).craftQueue[0]).toMatchObject({ rank: 10 })
    expect(purseOf(finish(queued)).archive[0]!.quality).toBe(1)
    const lower = ok(queueCraft({ ...stocked(), heroes: stocked().heroes.map((h) => ({ ...h, craftXp: 25 })) }, 'hero-1', { ...bow, materialId: 'scrap' }))
    const quality = purseOf(finish(lower)).archive[0]!.quality
    expect(quality).toBeGreaterThanOrEqual(0.95)
    expect(quality).toBeLessThanOrEqual(1)
  })
})

describe('upgrades', () => {
  function withItem(level: number, counter: number): SaveData {
    const save = stocked(level + 3)
    return updatePurse(save, { craftCounter: counter, archive: [newItem('old', 'weapon-bow', level, 1.05)] })
  }

  it('holds the item while it works, charges 3 material and item level × 3 gold, and always adds 1 level', () => {
    for (let counter = 0; counter < 40; counter += 1) {
      const queued = ok(queueUpgrade(withItem(2, counter), 'hero-1', 'old', 'scrap'))
      expect(purseOf(queued).archive).toEqual([])
      expect(purseOf(queued).materials.scrap).toBe(27)
      expect(purseOf(queued).gold).toBe(300 - 6)
      expect(purseOf(queued).craftQueue[0]).toMatchObject({ kind: 'upgrade', materialId: 'scrap' })
      const done = advanceCrafting(queued, CRAFT_MS)
      const item = purseOf(done.save).archive[0]!
      expect(item).toEqual(newItem('old', 'weapon-bow', 3, 1.05))
      expect(done.finished[0]?.text).toMatch(/upgraded to item level 3/)
      expect(hero(done.save).craftXp).toBe(1)
    }
  })

  it('keeps a deep item upgrading, since there is no failure chance', () => {
    const queued = ok(queueUpgrade(withItem(16, 0), 'hero-1', 'old', 'shard'))
    expect(purseOf(queued).gold).toBe(300 - 48)
    expect(purseOf(advanceCrafting(queued, CRAFT_MS).save).archive[0]?.itemLevel).toBe(17)
  })

  it('refuses items above the hero, in the wrong place, or with no queue room', () => {
    const save = withItem(2, 0)
    const capped = { ...save, heroes: save.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 2 } })) }
    expect(queueUpgrade(capped, 'hero-1', 'old', 'scrap')).toEqual({
      ok: false,
      reason: "This hero is level 2. An item cannot go above the hero's level.",
    })
    expect(queueUpgrade(save, 'hero-1', 'nothing', 'scrap')).toEqual({ ok: false, reason: 'That item is not in the archive or worn by this hero.' })
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
    const equipped = ok(equipFromArchive(save, 'hero-1', 'craft-hero-1-1'))
    const after = statsFor(hero(equipped))!
    expect(after.critChance - before.critChance).toBeCloseTo(0.02, 10)
    const precise = ok(equipFromArchive(crafted('precise', 1), 'hero-1', 'craft-hero-1-1'))
    expect(statsFor(hero(precise))!.accuracy - before.accuracy).toBe(3)
  })

  it('reaches the fight, so a crafted weapon changes the next one (criterion 8)', () => {
    const save = ok(equipFromArchive(crafted('keen', 1), 'hero-1', 'craft-hero-1-1'))
    const plain = ok(equipFromArchive(updatePurse(save, { archive: [newItem('p', 'weapon-one-handed', 1)] }), 'hero-1', 'p'))
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
    expect(equipFromArchive(low, 'hero-1', 'craft-hero-1-1')).toEqual({ ok: false, reason: 'Quick needs level 9. This hero is level 5.' })
    expect(equipFromArchive(quick, 'hero-1', 'craft-hero-1-1').ok).toBe(true)
    const both = ok(equipFromArchive(crafted('keen', 1), 'hero-1', 'craft-hero-1-1'))
    const keenOnRing = {
      ...both,
      heroes: both.heroes.map((h) => ({
        ...h,
        equipment: { ...h.equipment, accessory0: { ...h.equipment.accessory0!, modifiers: ['keen'] } },
      })),
    }
    const stats = statsFor(hero(keenOnRing))!
    const base = statsFor(hero(ok(equipFromArchive(crafted('precise', 1), 'hero-1', 'craft-hero-1-1'))))!
    expect(stats.critChance - base.critChance).toBeCloseTo(0.04, 10)
  })

  it('rejects an unknown modifier or a broken job in a save', () => {
    const save = ok(queueCraft(stocked(), 'hero-1', { ...bow, modifierId: 'keen' }))
    const raw = JSON.parse(serializeSave(save)) as { heroes: { purse: { craftQueue: Record<string, unknown>[] } }[] }
    raw.heroes[0]!.purse.craftQueue[0]!.modifierId = 'bogus'
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false, reason: expect.stringMatching(/unknown modifier/) })
    raw.heroes[0]!.purse.craftQueue[0]!.modifierId = 'keen'
    raw.heroes[0]!.purse.craftQueue[0]!.kind = 'brew'
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false })
    const again = JSON.parse(serializeSave(save)) as { heroes: { purse: { craftQueue: unknown[] } }[] }
    again.heroes[0]!.purse.craftQueue = [1, 2, 3, 4]
    expect(parseSave(JSON.stringify(again))).toMatchObject({ ok: false, reason: expect.stringMatching(/at most 3 jobs/) })
  })
})

describe('worn items and recipes', () => {
  function levelled(): SaveData {
    const save = stocked(4)
    return { ...save, heroes: save.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 4 } })) }
  }

  it('upgrades a worn item, holding it away from its slot and returning it to the same slot', () => {
    let kept = false
    for (let counter = 0; counter < 40 && !kept; counter += 1) {
      const base = levelled()
      const start = updatePurse(base, { craftCounter: counter })
      const queued = ok(queueUpgrade(start, 'hero-1', 'hero-1-mainHand', 'scrap'))
      expect(hero(queued).equipment.mainHand).toBeNull()
      expect(purseOf(queued).craftQueue[0]).toMatchObject({ kind: 'upgrade', slot: 'mainHand' })
      const done = finish(queued)
      expect(hero(done).equipment.mainHand?.id).toBe('hero-1-mainHand')
      expect(purseOf(done).archive.some((item) => item.id === 'hero-1-mainHand')).toBe(false)
      expect(() => assertSaveData(queued)).not.toThrow()
      expect(parseSave(serializeSave(queued)).ok).toBe(true)
      kept = true
    }
    expect(kept).toBe(true)
  })

  it('returns a worn item to the archive when its slot was refilled meanwhile', () => {
    const queued = ok(queueUpgrade(levelled(), 'hero-1', 'hero-1-mainHand', 'scrap'))
    const refilled = { ...queued, heroes: queued.heroes.map((h) => ({ ...h, equipment: { ...h.equipment, mainHand: newItem('other', 'weapon-one-handed', 1) } })) }
    const done = finish(refilled)
    expect(hero(done).equipment.mainHand?.id).toBe('other')
    expect(purseOf(done).archive.some((item) => item.id === 'hero-1-mainHand')).toBe(true)
  })

  it('sells the unknown recipes for 25 gold per required level, once', () => {
    const base = levelled()
    const grown = { ...base, heroes: base.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 12 } })) }
    const save = { ...updatePurse(grown, { gold: 300 }), account: { ...base.account, recipes: [...STARTING_MODIFIER_RECIPES] } }
    expect(recipesForSale(save).map((entry) => entry.modifierId).sort()).toEqual(['hauler', 'mending', 'nimble', 'piercing', 'quick', 'sturdy', 'vicious'])
    expect(recipePrice('nimble')).toBe(75)
    expect(recipePrice('quick')).toBe(225)
    expect(recipePrice('vicious')).toBe(75)
    expect(recipePrice('hauler')).toBe(100)
    expect(recipePrice('sturdy')).toBe(150)
    const bought = ok(buyRecipe(save, 'nimble'))
    expect(bought.account.recipes).toContain('nimble')
    expect(purseOf(bought).gold).toBe(purseOf(save).gold - 75)
    expect(buyRecipe(bought, 'nimble')).toEqual({ ok: false, reason: 'You already know the Nimble recipe.' })
    const poor = updatePurse(save, { gold: 10 })
    expect(buyRecipe(poor, 'quick')).toEqual({ ok: false, reason: `The Quick recipe costs 225 gold. You have 10.` })
    expect(buyRecipe(save, 'bogus')).toEqual({ ok: false, reason: 'Unknown recipe.' })
  })

  it('refuses a recipe the selected hero is too low level to learn', () => {
    const base = levelled()
    const low = { ...updatePurse(base, { gold: 1000 }), account: { ...base.account, recipes: [...STARTING_MODIFIER_RECIPES] }, heroes: base.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 6 } })) }
    expect(buyRecipe(low, 'quick')).toEqual({ ok: false, reason: 'The Quick recipe needs level 9. This hero is level 6.' })
  })
})

describe('upgrade quality', () => {
  it('adds 0, 1, or 2 points by material and never passes 110%', () => {
    expect(upgradedQuality(1, 'scrap')).toBe(1)
    expect(upgradedQuality(1, 'hide')).toBeCloseTo(1.01)
    expect(upgradedQuality(1, 'shard')).toBeCloseTo(1.02)
    expect(upgradedQuality(1.09, 'shard')).toBe(1.1)
    expect(upgradedQuality(1.1, 'shard')).toBe(1.1)
    expect(upgradedQuality(0.95, 'unknown')).toBe(0.95)
  })
})

function upgradeCheckText(save: SaveData): string | null {
  const item = newItem('t-1', 'weapon-one-handed', 0)
  return upgradeCheck(save, hero(save), item, 'iron')
}

describe('riftglass', () => {
  it('is the best craft material: 102% to 112%, rank raises the minimum up to the maximum', () => {
    expect(qualityRange('riftglass', 0)).toEqual({ low: 1.02, high: 1.12 })
    expect(qualityRange('riftglass', 5)?.low).toBeCloseTo(1.07, 10)
    expect(qualityRange('riftglass', 10)?.low).toBeCloseTo(1.12, 10)
    expect(qualityRange('riftglass', 10)?.high).toBe(1.12)
    expect(Object.keys(MATERIAL_QUALITY)).toEqual(['scrap', 'hide', 'shard', 'riftglass'])
  })

  it('adds 3 upgrade points up to 112%, while other materials keep 110% and never lower quality', () => {
    expect(UPGRADE_QUALITY_POINTS.riftglass).toBe(3)
    expect(upgradedQuality(1, 'riftglass')).toBeCloseTo(1.03)
    expect(upgradedQuality(1.1, 'riftglass')).toBe(1.12)
    expect(upgradedQuality(1.12, 'riftglass')).toBe(1.12)
    expect(upgradedQuality(1.115, 'shard')).toBe(1.115)
    expect(upgradedQuality(1.09, 'shard')).toBe(1.1)
    expect(upgradeCapFor('riftglass')).toBe(1.12)
    expect(upgradeCapFor('shard')).toBe(1.1)
  })

  it('lists every material in the pick-a-material message, from the table', () => {
    expect(pickMaterialText()).toBe('Pick scrap, hide, shard, or riftglass.')
    const save = stocked()
    expect(craftCheck(save, hero(save), { ...bow, materialId: 'iron' })).toBe(pickMaterialText())
    expect(upgradeCheckText(save)).toBe(pickMaterialText())
  })

  it('crafts with riftglass, and a hero with none sees it as 0 and cannot craft', () => {
    const save = updatePurse(stocked(), { materials: { riftglass: 6 } })
    const done = finish(ok(queueCraft(save, 'hero-1', { ...bow, materialId: 'riftglass' })))
    const made = purseOf(done).archive.at(-1)
    expect(made?.quality).toBeGreaterThanOrEqual(1.02)
    expect(made?.quality).toBeLessThanOrEqual(1.12)
    const none = updatePurse(stocked(), { materials: { shard: 20 } })
    expect(purseOf(none).materials.riftglass ?? 0).toBe(0)
    expect(craftCheck(none, hero(none), { ...bow, materialId: 'riftglass' })).toBe('That needs 6 riftglass. You have 0.')
  })
})
