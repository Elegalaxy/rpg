import { describe, expect, it } from 'vitest'

import { newItem } from '../content/items.ts'

import { CRAFT_MS, advanceCrafting, buyRecipe, queueCraft } from './crafting.ts'
import { acceptContract } from './contracts.ts'
import { contracts } from '../content/contracts.ts'
import { createHero, selectHero } from './roster.ts'
import { newSave, parseSave, purseOf, serializeSave, updatePurse, type SaveData } from './save.ts'
import { buyItem, sellMaterial } from './town.ts'
import { beginExpedition } from './world.ts'
import { SPLINTERED_ROAD_ID } from '../sim/expedition.ts'

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

/** Two heroes on a two-slot account. The second one is selected. */
function twoHeroes(): SaveData {
  const first = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!first.ok) throw new Error(first.reason)
  const second = createHero(first.save, { name: 'Brin', race: 'elf', classId: 'mage' })
  if (!second.ok) throw new Error(second.reason)
  return ok(selectHero(second.save, 'hero-2'))
}

describe('each hero keeps its own purse', () => {
  it('starts every new hero empty and keeps one hero\'s gold, materials, and items away from another', () => {
    const save = twoHeroes()
    const { board: firstBoard, boardRolls: _firstRolls, ...first } = purseOf(save, 'hero-1')
    const { board: secondBoard, boardRolls: _secondRolls, ...second } = purseOf(save, 'hero-2')
    expect(first).toEqual(second)
    expect(firstBoard).toHaveLength(4)
    expect(secondBoard).toHaveLength(4)
    expect(purseOf(save, 'hero-2').gold).toBe(0)

    const rich = updatePurse(ok(selectHero(save, 'hero-1')), { gold: 500, materials: { shard: 10 } })
    const bought = ok(buyItem(rich, 'hero-1', 'weapon-one-handed'))
    expect(purseOf(bought, 'hero-1').archive).toHaveLength(1)
    expect(purseOf(bought, 'hero-2')).toEqual({ ...purseOf(save, 'hero-2') })

    const other = ok(selectHero(bought, 'hero-2'))
    expect(purseOf(other).gold).toBe(0)
    expect(buyItem(other, 'hero-2', 'weapon-caster')).toEqual({ ok: false, reason: 'That costs 10 gold. You have 0.' })
    expect(sellMaterial(other, 'shard', 1)).toEqual({ ok: false, reason: 'You only have 0 shard.' })
    const sold = ok(sellMaterial(bought, 'shard', 2))
    expect(purseOf(sold, 'hero-1').materials).toEqual({ shard: 8 })
    expect(purseOf(sold, 'hero-2').materials).toEqual({})
  })

  it('shares a recipe bought by one hero, paid from that hero\'s gold only', () => {
    const save = updatePurse(twoHeroes(), { gold: 100 }, 'hero-1')
    const learned = ok(buyRecipe(ok(selectHero(save, 'hero-1')), 'nimble'))
    expect(learned.account.recipes).toContain('nimble')
    expect(purseOf(learned, 'hero-1').gold).toBe(25)
    expect(purseOf(learned, 'hero-2').gold).toBe(0)
  })

  it('keeps contracts per hero', () => {
    const posted = updatePurse(updatePurse(twoHeroes(), { board: [contracts['cull-the-pack']!] }, 'hero-1'), { board: [contracts['cull-the-pack']!] }, 'hero-2')
    const save = ok(acceptContract(posted, 'cull-the-pack'))
    expect(purseOf(save, 'hero-2').contracts).toEqual([{ contractId: 'cull-the-pack', progress: 0 }])
    expect(purseOf(save, 'hero-1').contracts).toEqual([])
    expect(ok(acceptContract(ok(selectHero(save, 'hero-1')), 'cull-the-pack'))).toBeDefined()
  })

  it('advances every hero\'s crafting queue, even during an expedition', () => {
    const stocked = updatePurse(updatePurse(twoHeroes(), { gold: 100, materials: { scrap: 10 } }, 'hero-1'), { gold: 100, materials: { scrap: 10 } }, 'hero-2')
    const request = { baseId: 'weapon-caster', itemLevel: 1, materialId: 'scrap', modifierId: null }
    const queued = ok(queueCraft(ok(queueCraft(stocked, 'hero-1', { ...request, baseId: 'weapon-one-handed' })), 'hero-2', request))
    const away = ok(beginExpedition(queued, SPLINTERED_ROAD_ID, 1))
    const half = advanceCrafting(away, CRAFT_MS / 2)
    expect(half.finished).toEqual([])
    const done = advanceCrafting(half.save, CRAFT_MS / 2)
    expect(done.finished.map((notice) => notice.text.split(':')[0])).toEqual(['Ash', 'Brin'])
    expect(purseOf(done.save, 'hero-1').archive.map((item) => item.id)).toEqual(['craft-hero-1-1'])
    expect(purseOf(done.save, 'hero-2').archive.map((item) => item.id)).toEqual(['craft-hero-2-1'])
    expect(purseOf(done.save, 'hero-2').craftQueue).toEqual([])
    expect(done.save.expedition).toBe(away.expedition)
    expect(parseSave(serializeSave(done.save)).ok).toBe(true)
  })
})

describe('saves from before per-hero purses', () => {
  it('give the shared wealth to the selected hero and each craft job to the hero who queued it', () => {
    const save = twoHeroes()
    const raw = JSON.parse(serializeSave(save)) as { account: Record<string, unknown>; heroes: Record<string, unknown>[] }
    for (const hero of raw.heroes) delete hero.purse
    const job = { id: 'job-1', kind: 'craft', heroId: 'hero-1', baseId: 'weapon-bow', itemLevel: 1, materialId: 'scrap', modifierId: null, remainingMs: 1000, seedIndex: 0, rank: 0 }
    Object.assign(raw.account, {
      gold: 140,
      materials: { hide: 4 },
      contracts: [{ contractId: 'cull-the-pack', progress: 1 }],
      craftQueue: [job],
      craftCounter: 1,
      debt: 12,
      archive: [newItem('spare', 'weapon-bow', 1)],
    })
    const parsed = parseSave(JSON.stringify(raw))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(Object.keys(parsed.data.account).sort()).toEqual(['discoveries', 'milestones', 'recipes', 'slots'])
    expect(purseOf(parsed.data, 'hero-2')).toMatchObject({
      gold: 140,
      materials: { hide: 4 },
      contracts: [{ contractId: 'cull-the-pack', progress: 1 }],
      craftQueue: [],
      craftCounter: 1,
      debt: 12,
    })
    expect(purseOf(parsed.data, 'hero-2').archive.map((item) => item.id)).toEqual(['spare'])
    expect(purseOf(parsed.data, 'hero-1')).toMatchObject({ gold: 0, materials: {}, archive: [], contracts: [], debt: 0 })
    expect(purseOf(parsed.data, 'hero-1').craftQueue).toEqual([job])
  })
})
