import { describe, expect, it } from 'vitest'

import { DEFAULT_SUPPLY_ROWS } from '../content/supplies.ts'
import { SMOKE_BOMB_ID, SPLINTERED_ROAD_ID } from '../sim/expedition.ts'

import { buildCondition, draftsFromRows, describeCondition } from './loadout.ts'
import { checkPreparation, draftFor, packFromStash, savePreparation } from './preparation.ts'
import { createHero, selectHero } from './roster.ts'
import { newSave, parseSave, purseOf, serializeSave, updatePurse, type SaveData } from './save.ts'
import { buySupply } from './town.ts'
import { beginExpedition, settleExpedition } from './world.ts'

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

function heroSave(): SaveData {
  return ok(createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' }))
}

function packed(save: SaveData, supplies: string[]): SaveData {
  const hero = save.heroes[0]!
  return ok(savePreparation(save, hero.id, { ...draftFor(hero), supplies }))
}

describe('buying supplies', () => {
  it('pays from the selected hero and stocks only that hero', () => {
    const first = ok(createHero(updatePurse(heroSave(), { gold: 50 }), { name: 'Brin', race: 'elf', classId: 'mage' }))
    const save = ok(selectHero(first, 'hero-1'))
    const bought = ok(buySupply(save, 'healing-draught', 2))
    expect(purseOf(bought).gold).toBe(20)
    expect(purseOf(bought).supplies).toEqual({ 'healing-draught': 2 })
    expect(purseOf(bought, 'hero-2').supplies).toEqual({})
    expect(buySupply(bought, SMOKE_BOMB_ID)).toEqual({ ok: true, save: expect.anything() })
    expect(buySupply(bought, 'antidote', 3)).toEqual({ ok: false, reason: 'That costs 30 gold. You have 20.' })
    expect(buySupply(bought, 'elixir')).toEqual({ ok: false, reason: 'Greyhaven does not sell that.' })
    expect(buySupply(bought, 'antidote', 0)).toEqual({ ok: false, reason: 'Buy at least 1.' })
  })
})

describe('packing supplies', () => {
  it('saves a pick per slot and refuses an unknown one', () => {
    const save = packed(heroSave(), ['healing-draught', '', 'antidote', ''])
    const hero = save.heroes[0]!
    expect(hero.packedSupplies).toEqual(['healing-draught', 'antidote'])
    expect(draftFor(hero).supplies).toEqual(['healing-draught', 'antidote', '', ''])
    expect(checkPreparation(hero, { ...draftFor(hero), supplies: ['potion', '', '', ''] })).toMatchObject({
      ok: false,
      errors: ['Pick a supply Greyhaven sells, or leave the slot empty.'],
    })
  })

  it('takes what the stash covers, returns what was not used, and keeps a used one used', () => {
    const stocked = updatePurse(packed(heroSave(), ['healing-draught', 'healing-draught', 'antidote', SMOKE_BOMB_ID]), {
      supplies: { 'healing-draught': 3, antidote: 0, [SMOKE_BOMB_ID]: 1 },
    })
    expect(packFromStash(stocked.heroes[0]!)).toEqual({
      taken: ['healing-draught', 'healing-draught', SMOKE_BOMB_ID],
      missing: ['antidote'],
    })
    const started = ok(beginExpedition(stocked, SPLINTERED_ROAD_ID, 1))
    expect(started.expedition?.supplySlots).toEqual([{ id: 'healing-draught' }, { id: 'healing-draught' }, { id: SMOKE_BOMB_ID }, null])
    expect(purseOf(started).supplies).toEqual({ 'healing-draught': 1, antidote: 0 })

    const run = started.expedition!
    run.supplySlots[0] = null
    run.consumedSupplyIds.push('healing-draught')
    run.outcome = 'defeat'
    const settled = settleExpedition(started)
    expect(purseOf(settled).supplies).toEqual({ 'healing-draught': 2, antidote: 0, [SMOKE_BOMB_ID]: 1 })
    expect(parseSave(serializeSave(settled)).ok).toBe(true)
  })
})

describe('supply rules', () => {
  it('gives a new hero the two supply rules on top', () => {
    const hero = heroSave().heroes[0]!
    expect(hero.priorityRows.slice(0, 2)).toEqual(DEFAULT_SUPPLY_ROWS)
    expect(hero.packedSupplies).toEqual([])
    expect(purseOf(heroSave()).supplies).toEqual({})
  })

  it('edits a hero status stacks condition without losing it', () => {
    const antidote = DEFAULT_SUPPLY_ROWS[1]!
    const [draft] = draftsFromRows([antidote])
    expect(draft?.conditions).toEqual([{ type: 'heroStacks', operator: 'atLeast', value: '3', statusId: 'poison' }])
    expect(buildCondition(draft!.conditions[0]!)).toEqual(antidote.conditions?.[0])
    expect(describeCondition(antidote.conditions![0]!, 'warrior')).toBe('Hero poison stacks is at least 3')
  })

  it('fills the stash and packing for a save from before supplies', () => {
    const raw = JSON.parse(serializeSave(heroSave())) as { heroes: Record<string, unknown>[] }
    delete raw.heroes[0]!.packedSupplies
    delete (raw.heroes[0]!.purse as Record<string, unknown>).supplies
    const parsed = parseSave(JSON.stringify(raw))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.data.heroes[0]!.packedSupplies).toEqual([])
    expect(purseOf(parsed.data).supplies).toEqual({})
  })
})
