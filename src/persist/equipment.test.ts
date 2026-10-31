import { describe, expect, it } from 'vitest'

import { developmentItems, itemBase, newItem, starterEquipment } from '../content/items.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import { equipBlock, equipItem, gearFromEquipment, gearGaps, slotsFor, type Equipment, type ItemInstance } from '../sim/economy.ts'
import { stepExpedition } from '../sim/expedition.ts'
import { deriveHeroStats } from '../sim/stats.ts'

import { selectedHero } from './character.ts'
import { addDevelopmentItems, equipFromArchive, previewEquip, statLines, statsFor } from './equipment.ts'
import { blueprintForHero, startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData } from './save.ts'
import { canStartRoute, settleExpedition } from './world.ts'
import { gameDefs } from '../content/scenarios.ts'

function heroSave(classId: (typeof HERO_CLASSES)[number] = 'warrior'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

function withItems(save: SaveData, items: ItemInstance[]): SaveData {
  return { ...save, account: { ...save.account, archive: [...save.account.archive, ...items] } }
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function equip(save: SaveData, itemId: string, slot: Parameters<typeof equipFromArchive>[3] = null): SaveData {
  const result = equipFromArchive(save, 'hero-1', itemId, slot)
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

const armorSlots = ['head', 'chest', 'hands', 'feet'] as const

describe('starter gear', () => {
  it('gives every class a complete level 1 set at exactly 100% quality with no modifiers', () => {
    for (const classId of HERO_CLASSES) {
      const equipment = starterEquipment('h', classId)
      expect(gearGaps(equipment, itemBase), classId).toEqual([])
      for (const item of Object.values(equipment)) {
        expect(item?.itemLevel).toBe(1)
        expect(item?.quality).toBe(1)
        expect(item?.modifiers).toEqual([])
        expect(item?.durability).toBe(100)
      }
      const gear = gearFromEquipment(equipment, itemBase)
      expect(gear.mainHand.kind).toBe({ warrior: 'oneHanded', assassin: 'dagger', ranger: 'bow', mage: 'caster', cleric: 'caster' }[classId])
      expect(gear.offHand?.kind).toBe({ warrior: 'shield', assassin: 'dagger', ranger: 'quiver', mage: 'focus', cleric: 'shield' }[classId])
      const heavy = { warrior: 'heavy', assassin: 'light', ranger: 'medium', mage: 'cloth', cleric: 'medium' }[classId]
      for (const slot of armorSlots) expect(gear[slot].category).toBe(heavy)
    }
  })

  it('is created with the hero and survives the save', () => {
    const save = heroSave('ranger')
    expect(hero(save).equipment.mainHand?.id).toBe('hero-1-mainHand')
    expect(() => assertSaveData(save)).not.toThrow()
    const again = parseSave(serializeSave(save))
    expect(again.ok && again.data.heroes[0]?.equipment).toEqual(hero(save).equipment)
  })

  it('fills the starter set for a save that has none', () => {
    const raw = JSON.parse(serializeSave(heroSave('mage'))) as { heroes: Record<string, unknown>[]; account: Record<string, unknown> }
    delete raw.heroes[0]!.equipment
    delete raw.account.archive
    const parsed = parseSave(JSON.stringify(raw))
    expect(parsed.ok && parsed.data.heroes[0]?.equipment.mainHand?.baseId).toBe('weapon-caster')
    expect(parsed.ok && parsed.data.account.archive).toEqual([])
  })

  it('rejects a broken item in the save', () => {
    const save = withItems(heroSave(), [newItem('x', 'weapon-bow', 1)])
    const raw = JSON.parse(serializeSave(save)) as { account: { archive: Record<string, unknown>[] } }
    raw.account.archive[0]!.baseId = 'nonsense'
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false, reason: expect.stringMatching(/unknown base/) })
    raw.account.archive[0]!.baseId = 'weapon-bow'
    raw.account.archive[0]!.durability = 500
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false, reason: expect.stringMatching(/above its maximum/) })
  })
})

describe('equip rules', () => {
  it('needs the hero level to reach the item level', () => {
    const save = withItems(heroSave(), [newItem('big', 'weapon-two-handed', 3)])
    const result = equipFromArchive(save, 'hero-1', 'big')
    expect(result).toEqual({ ok: false, reason: 'Two-handed Weapon needs level 3. This hero is level 1.' })
    const stronger = { ...save, heroes: save.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 3 } })) }
    expect(equipFromArchive(stronger, 'hero-1', 'big').ok).toBe(true)
  })

  it('refuses an item in a slot it does not fit', () => {
    const save = withItems(heroSave(), [newItem('s', 'offhand-shield', 1)])
    expect(equipFromArchive(save, 'hero-1', 's', 'mainHand')).toEqual({ ok: false, reason: 'Shield does not fit the mainHand slot.' })
    expect(equipFromArchive(save, 'hero-1', 'nope')).toEqual({ ok: false, reason: 'That item is not in the archive.' })
  })

  it('moves the replaced item to the archive and keeps the total number of items', () => {
    const save = withItems(heroSave(), [newItem('sword', 'weapon-one-handed', 1, 1.1)])
    const next = equip(save, 'sword')
    expect(hero(next).equipment.mainHand?.id).toBe('sword')
    expect(next.account.archive.map((item) => item.id)).toEqual(['hero-1-mainHand'])
    const count = (s: SaveData) => s.account.archive.length + Object.values(hero(s).equipment).filter((item) => item !== null).length
    expect(count(next)).toBe(count(save))
  })

  it('a two-handed weapon disables the off-hand and sends it to the archive', () => {
    const save = withItems(heroSave(), [newItem('maul', 'weapon-two-handed', 1), newItem('shield2', 'offhand-shield', 1)])
    const next = equip(save, 'maul')
    expect(hero(next).equipment.offHand).toBeNull()
    expect(next.account.archive.map((item) => item.id)).toEqual(['shield2', 'hero-1-mainHand', 'hero-1-offHand'])
    expect(gearGaps(hero(next).equipment, itemBase)).toEqual([])
    expect(equipFromArchive(next, 'hero-1', 'shield2')).toEqual({ ok: false, reason: 'A two-handed weapon disables the off-hand slot.' })
    const back = equip(next, 'hero-1-mainHand')
    expect(gearGaps(hero(back).equipment, itemBase)).toEqual(['offHand'])
    expect(gearGaps(hero(equip(back, 'shield2')).equipment, itemBase)).toEqual([])
  })

  it('a quiver needs a bow, and leaving the bow sends the quiver away', () => {
    const ranger = withItems(heroSave('ranger'), [newItem('sword', 'weapon-one-handed', 1)])
    const swapped = equip(ranger, 'sword')
    expect(hero(swapped).equipment.mainHand?.id).toBe('sword')
    expect(hero(swapped).equipment.offHand).toBeNull()
    expect(swapped.account.archive.map((item) => item.id)).toContain('hero-1-offHand')
    expect(equipFromArchive(swapped, 'hero-1', 'hero-1-offHand')).toEqual({ ok: false, reason: 'A quiver needs a bow in the main hand.' })
    const warrior = withItems(heroSave(), [newItem('q', 'offhand-quiver', 1)])
    expect(equipFromArchive(warrior, 'hero-1', 'q').ok).toBe(false)
  })

  it('puts an accessory in the first free slot, or the chosen one', () => {
    const save = withItems(heroSave(), [newItem('ring2', 'accessory-ring', 1)])
    expect(equip(save, 'ring2', 'accessory1').heroes[0]?.equipment.accessory1?.id).toBe('ring2')
    expect(equip(save, 'ring2').heroes[0]?.equipment.accessory0?.id).toBe('ring2')
    expect(slotsFor(itemBase('accessory-ring')!)).toEqual(['accessory0', 'accessory1'])
  })

  it('is locked while an expedition runs', () => {
    const save = withItems(heroSave(), [newItem('sword', 'weapon-one-handed', 1)])
    const running = { ...save, expedition: startExpedition(hero(save), 'splintered-road', 1) }
    expect(equipFromArchive(running, 'hero-1', 'sword')).toEqual({
      ok: false,
      reason: 'Equipment is locked while an expedition is running.',
    })
  })

  it('applies the item-level and slot checks through the sim rule', () => {
    const equipment: Equipment = starterEquipment('h', 'warrior')
    const item = newItem('bow', 'weapon-bow', 5)
    expect(equipBlock(equipment, item, 'mainHand', 4, itemBase)).toMatch(/needs level 5/)
    expect(equipBlock(equipment, item, 'mainHand', 5, itemBase)).toBeNull()
    expect(equipItem(equipment, [], 'bow', null, 5, itemBase)).toEqual({ ok: false, reason: 'That item is not in the archive.' })
  })
})

describe('what equipping changes', () => {
  it('changes power and action time when a weapon is swapped', () => {
    const save = withItems(heroSave(), developmentItems(1, 1))
    const before = statsFor(hero(save))!
    const maul = equip(save, 'dev-1')
    const after = statsFor(hero(maul))!
    expect(after.actionTime).toBeGreaterThan(before.actionTime)
    expect(after.physicalPower).toBeGreaterThan(before.physicalPower)
    expect(after.armor).toBeLessThan(before.armor)
    const sword = equip(save, 'dev-2')
    expect(statsFor(hero(sword))!.physicalPower).toBeGreaterThan(before.physicalPower)
    expect(statsFor(hero(sword))!.actionTime).toBe(before.actionTime)
  })

  it('previews the same numbers the equip then produces', () => {
    const save = withItems(heroSave(), developmentItems(1, 1))
    for (const id of ['dev-1', 'dev-2', 'dev-3', 'dev-6']) {
      const preview = previewEquip(save, 'hero-1', id)
      if (preview.block !== null) continue
      const result = equip(save, id)
      const before = statLines(statsFor(hero(save))!)
      const after = statLines(statsFor(hero(result))!)
      const real = before.flatMap((line, index) => (after[index]!.value !== line.value ? [`${line.label}:${line.value}:${after[index]!.value}`] : []))
      expect(preview.changes.map((change) => `${change.label}:${change.before}:${change.after}`), id).toEqual(real)
    }
    expect(previewEquip(save, 'hero-1', 'dev-5').block).toBe('A quiver needs a bow in the main hand.')
    expect(previewEquip(save, 'hero-1', 'missing').block).toBe('That item is not in the archive.')
  })

  it('matches deriveHeroStats on the gear the run uses', () => {
    const save = heroSave('mage')
    const saved = hero(save)
    const direct = deriveHeroStats({
      level: 1,
      classId: 'mage',
      attributes: saved.progress.attributes,
      gear: gearFromEquipment(saved.equipment, itemBase),
      racialNodeIds: [],
      renaissance: false,
    })
    expect(statsFor(saved)).toEqual(direct)
    expect(blueprintForHero(saved, 'splintered-road').hero.gear).toEqual(gearFromEquipment(saved.equipment, itemBase))
  })

  it('cuts off-preference gear to 90% of its power', () => {
    const gear = gearFromEquipment(starterEquipment('r', 'ranger'), itemBase)
    const attributes = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }
    const preferred = deriveHeroStats({ level: 1, classId: 'ranger', attributes, gear })
    const other = deriveHeroStats({ level: 1, classId: 'warrior', attributes, gear })
    // A level 1 bow adds 1.1 x (8 + 2) = 11 Power at full effectiveness, and a Warrior gets 90% of it.
    expect(preferred.physicalPower - other.physicalPower).toBeCloseTo(1.1, 10)
  })

  it('adds test weapons with fresh ids each time', () => {
    const once = addDevelopmentItems(heroSave(), 'hero-1')
    const twice = addDevelopmentItems(once, 'hero-1')
    expect(twice.account.archive).toHaveLength(12)
    expect(new Set(twice.account.archive.map((item) => item.id)).size).toBe(12)
    expect(() => assertSaveData(twice)).not.toThrow()
  })
})

describe('gear on the road', () => {
  it('cannot start with an incomplete set', () => {
    const save = withItems(heroSave(), [newItem('maul', 'weapon-two-handed', 1)])
    const maul = equip(save, 'maul')
    const back = equip(maul, 'hero-1-mainHand')
    expect(canStartRoute(back, 'splintered-road')).toEqual({ ok: false, reason: 'Equip every slot first. Missing: offHand.' })
    expect(canStartRoute(maul, 'splintered-road')).toEqual({ ok: true })
  })

  it('writes the durability an expedition ended with back onto the equipped items', () => {
    const save = heroSave()
    const run = startExpedition(hero(save), 'splintered-road', 1)
    expect(run.equipment.map((entry) => entry.itemId)).toContain('hero-1-mainHand')
    run.outcome = 'defeat'
    for (const entry of run.equipment) entry.durability = 90
    run.history = [{ index: 0, encounterId: 'shardling-pair', seed: 1, outcome: 'defeat', durationMs: 1 }]
    const settled = settleExpedition({ ...save, expedition: run })
    expect(hero(settled).equipment.mainHand?.durability).toBe(90)
    expect(hero(settled).equipment.accessory1?.durability).toBe(90)
    expect(() => assertSaveData(settled)).not.toThrow()
    stepExpedition(startExpedition(hero(save), 'splintered-road', 2), gameDefs())
  })
})
