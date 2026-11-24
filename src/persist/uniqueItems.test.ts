import { describe, expect, it } from 'vitest'

import { itemBase, itemName } from '../content/items.ts'
import { itemSellPrice } from '../content/shop.ts'
import { uniqueBaseFor, uniqueItemFor, uniqueSourceName, uniqueZoneName } from '../content/uniques.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import { gearBonusesFor, type ItemInstance } from '../sim/economy.ts'
import { UNIQUE_ITEMS, uniqueDef } from '../sim/uniques.ts'

import { selectedHero } from './character.ts'
import { CRAFT_MS, advanceCrafting, grantCraftingKit, queueInfuse, queueRankUp, queueSocket, spendFreeUpgrade } from './crafting.ts'
import { equipFromArchive, previewEquip } from './equipment.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, purseOf, serializeSave, updatePurse, type SaveData } from './save.ts'
import { needsSellConfirm } from './sellSafety.ts'
import { sellItem } from './town.ts'

const treadsDef = uniqueDef('rootmaw-treads')!
const treads = (extra: Partial<ItemInstance> = {}): ItemInstance => ({ ...uniqueItemFor('hero-1', treadsDef, 'warrior'), ...extra })

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

function stocked(item: ItemInstance = treads(), level = 30): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const kit = grantCraftingKit(made.save)
  const leveled = { ...kit, heroes: kit.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level }, freeUpgrades: 3 })) }
  const materials = Object.fromEntries(Object.keys(purseOf(leveled).materials).map((id) => [id, 40]))
  return updatePurse(leveled, { gold: 10_000, materials, archive: [item] })
}

describe('unique items: content', () => {
  it('makes the item the plan says: class base, table level, quality 110%, one fixed modifier, no socket', () => {
    const item = uniqueItemFor('hero-1', treadsDef, 'warrior')
    expect(item).toEqual({
      id: 'unique-hero-1-rootmaw-treads',
      baseId: 'armor-heavy-feet',
      itemLevel: 14,
      quality: 1.1,
      durability: 100,
      maxDurability: 100,
      modifiers: ['nimble'],
      uniqueId: 'rootmaw-treads',
    })
  })

  it('follows the hero class for armor, weapon and off-hand, and uses the Talisman for the accessory', () => {
    const armor = { warrior: 'heavy', assassin: 'light', ranger: 'medium', mage: 'cloth', cleric: 'medium' } as const
    for (const classId of HERO_CLASSES) {
      expect(uniqueBaseFor(uniqueDef('echoing-visor')!, classId)).toBe(`armor-${armor[classId]}-head`)
      expect(itemBase(uniqueBaseFor(uniqueDef('hollowmaw-fang')!, classId))?.type).toBe('weapon')
      expect(itemBase(uniqueBaseFor(uniqueDef('emberwrought-heart')!, classId))?.type).toBe('offHand')
      expect(uniqueBaseFor(uniqueDef('briarheart-talisman')!, classId)).toBe('accessory-talisman')
    }
    expect(uniqueBaseFor(uniqueDef('hollowmaw-fang')!, 'ranger')).toBe('weapon-bow')
    expect(uniqueBaseFor(uniqueDef('emberwrought-heart')!, 'mage')).toBe('offhand-focus')
  })

  it('names the item with its modifiers and ranks, and an open socket while it is empty', () => {
    expect(itemName(treads())).toBe('Rootmaw Treads · Nimble')
    expect(itemName(treads({ modifierRanks: [2] }))).toBe('Rootmaw Treads · Nimble II')
    expect(itemName(treads({ socketed: true }))).toBe('Rootmaw Treads · Nimble · open socket')
    expect(itemName(treads({ socketed: true, modifiers: ['nimble', 'precise'] }))).toBe('Rootmaw Treads · Nimble · Precise')
  })

  it('treats an unknown unique id as a plain item with the base name and no signature', () => {
    const odd = treads({ uniqueId: 'not-a-unique' })
    expect(itemName(odd)).toBe('Nimble Heavy Boots')
    expect(itemSellPrice(odd)).toBe(Math.round(14 * 5 * 1.1))
  })

  it('names the source elite and zone of every unique', () => {
    expect(uniqueSourceName(treadsDef)).toBe('Rootmaw Stalker')
    expect(uniqueZoneName(treadsDef)).toBe('Withered Grove')
    expect(UNIQUE_ITEMS.map((def) => uniqueZoneName(def))).not.toContain('')
  })

  it('sells at a fixed price of table level x 20 gold, whatever the quality or current level', () => {
    expect(itemSellPrice(treads())).toBe(280)
    expect(itemSellPrice(treads({ quality: 1.2, itemLevel: 40 }))).toBe(280)
    expect(itemSellPrice(uniqueItemFor('h', uniqueDef('briarheart-talisman')!, 'mage'))).toBe(760)
  })
})

function loaded(text: string): SaveData {
  const parsed = parseSave(text)
  if (!parsed.ok) throw new Error(parsed.reason)
  return parsed.data
}

describe('unique items: save and sell', () => {
  it('always asks twice before selling', () => {
    expect(needsSellConfirm(treads({ modifiers: [], quality: 1 }), new Set())).toBe(true)
  })

  it('sells from the archive at the fixed price', () => {
    const save = stocked()
    const sold = ok(sellItem(save, treads().id))
    expect(purseOf(sold).gold).toBe(purseOf(save).gold + 280)
    expect(purseOf(sold).archive).toEqual([])
  })

  it('round trips through the save, keeps an unknown id, and loads an old item without the field', () => {
    const save = stocked(treads())
    const again = loaded(serializeSave(save))
    expect(selectedHero(again)!.purse.archive[0]).toEqual(treads())
    const odd = stocked(treads({ uniqueId: 'someday-unique' }))
    expect(() => assertSaveData(odd)).not.toThrow()
    expect(selectedHero(loaded(serializeSave(odd)))!.purse.archive[0]?.uniqueId).toBe('someday-unique')
    const plain = JSON.parse(serializeSave(stocked())) as { heroes: { purse: { archive: Record<string, unknown>[] } }[] }
    delete plain.heroes[0]!.purse.archive[0]!.uniqueId
    expect(parseSave(JSON.stringify(plain)).ok).toBe(true)
    const broken = JSON.parse(serializeSave(stocked())) as { heroes: { purse: { archive: Record<string, unknown>[] } }[] }
    broken.heroes[0]!.purse.archive[0]!.uniqueId = ''
    expect(parseSave(JSON.stringify(broken)).ok).toBe(false)
  })

  it('adds the signature of a worn unique to the hero stats through gearBonusesFor', () => {
    const equipment = { ...selectedHero(stocked())!.equipment, feet: treads() }
    expect(gearBonusesFor(equipment, itemBase).accuracyBonus).toBe(3)
  })
})

describe('unique items: crafting', () => {
  const heroOf = (save: SaveData) => selectedHero(save)!
  const fixed = (save: SaveData) => purseOf(save).archive[0]!

  it('opens a socket for a free upgrade and keeps its unique id', () => {
    const result = ok(spendFreeUpgrade(stocked(), 'hero-1', treads().id, { kind: 'socket' }))
    expect(fixed(result)).toEqual({ ...treads(), socketed: true })
    expect(heroOf(result).freeUpgrades).toBe(2)
  })

  it('raises the fixed modifier a rank with a free upgrade and by a paid job, and keeps the signature at full strength', () => {
    const free = ok(spendFreeUpgrade(stocked(), 'hero-1', treads().id, { kind: 'rank', index: 0 }))
    expect(fixed(free)).toEqual({ ...treads(), modifierRanks: [2] })
    const paid = advanceCrafting(ok(queueRankUp(stocked(), 'hero-1', treads().id, 0, 'scrap')), CRAFT_MS).save
    expect(fixed(paid)).toMatchObject({ uniqueId: 'rootmaw-treads', modifiers: ['nimble'], modifierRanks: [2] })
    const equipment = { ...heroOf(stocked()).equipment, feet: fixed(paid) }
    expect(gearBonusesFor(equipment, itemBase).accuracyBonus).toBe(3)
  })

  it('infuses a second modifier into slot 1 and never replaces the fixed one', () => {
    const socketed = advanceCrafting(ok(queueSocket(stocked(), 'hero-1', treads().id, 'riftglass')), CRAFT_MS).save
    const infused = advanceCrafting(ok(queueInfuse(socketed, 'hero-1', treads().id, 'sturdy', 'scrap')), CRAFT_MS).save
    expect(fixed(infused)).toMatchObject({ uniqueId: 'rootmaw-treads', modifiers: ['nimble', 'sturdy'], socketed: true })
    expect(queueInfuse(infused, 'hero-1', treads().id, 'nimble', 'scrap').ok).toBe(false)
    expect(() => assertSaveData(infused)).not.toThrow()
  })
})

describe('unique items: equip preview', () => {
  it('says the signature is gained when a unique replaces a plain piece and lost when it is swapped back', () => {
    const save = stocked()
    const gained = previewEquip(save, 'hero-1', treads().id)
    expect(gained.notes).toContain("Gains signature: Stalker's Step (+3 Evasion, +3 Accuracy)")
    expect(gained.notes.some((note) => note.startsWith('Gains Nimble'))).toBe(true)
    const worn = ok(equipFromArchive(save, 'hero-1', treads().id))
    const plainBoots = { ...selectedHero(worn)!.purse.archive[0]!, id: 'plain-boots', uniqueId: undefined, modifiers: [] as string[] }
    delete (plainBoots as { uniqueId?: string }).uniqueId
    const swapped = updatePurse(worn, { archive: [plainBoots] })
    const lost = previewEquip(swapped, 'hero-1', 'plain-boots')
    expect(lost.notes).toContain("Loses signature: Stalker's Step (+3 Evasion, +3 Accuracy)")
  })

  it('names a scaled signature at the item level', () => {
    const low = treads({ itemLevel: 7 })
    const preview = previewEquip(stocked(low), 'hero-1', low.id)
    expect(preview.notes).toContain("Gains signature: Stalker's Step (+1.5 Evasion, +1.5 Accuracy)")
  })
})
