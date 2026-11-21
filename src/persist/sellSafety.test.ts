import { describe, expect, it } from 'vitest'

import { newItem } from '../content/items.ts'
import type { ItemInstance } from '../sim/economy.ts'

import { createHero } from './roster.ts'
import { RISKY_QUALITY, needsSellConfirm, sellGroup } from './sellSafety.ts'
import { newSave, updatePurse } from './save.ts'
import { sellItem } from './town.ts'

const NONE: ReadonlySet<string> = new Set()
const plain = newItem('a', 'weapon-bow', 5, 1)

function patched(patch: Partial<ItemInstance>): ItemInstance {
  return { ...plain, ...patch }
}

describe('needsSellConfirm', () => {
  it('lets plain current-life gear sell with one click', () => {
    expect(needsSellConfirm(plain, NONE)).toBe(false)
    expect(needsSellConfirm(patched({ quality: 1.04 }), NONE)).toBe(false)
    expect(needsSellConfirm(patched({ quality: 0.9 }), NONE)).toBe(false)
  })

  it('asks twice for quality at or above the threshold, a modifier, a socket, an earlier life or an heirloom', () => {
    expect(RISKY_QUALITY).toBe(1.05)
    expect(needsSellConfirm(patched({ quality: RISKY_QUALITY }), NONE)).toBe(true)
    expect(needsSellConfirm(patched({ modifiers: ['vicious'] }), NONE)).toBe(true)
    expect(needsSellConfirm(patched({ socketed: true }), NONE)).toBe(true)
    expect(needsSellConfirm(plain, new Set(['a']))).toBe(true)
    expect(needsSellConfirm(patched({ heirloom: { heroId: 'hero-1', cap: 5 } }), NONE)).toBe(true)
  })
})

describe('sellGroup', () => {
  it('puts worn gear first, then heirlooms, earlier-life gear and the current life', () => {
    const heirloom = patched({ id: 'h', heirloom: { heroId: 'hero-1', cap: 5 } })
    const earlier = new Set(['a', 'h'])
    expect(sellGroup(plain, true, NONE)).toBe('worn')
    expect(sellGroup(heirloom, false, earlier)).toBe('heirloom')
    expect(sellGroup(plain, false, earlier)).toBe('earlier')
    expect(sellGroup(plain, false, NONE)).toBe('current')
  })
})

describe('selling an heirloom', () => {
  it('is still refused by sellItem, worn or in the archive', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const kept: ItemInstance = { ...newItem('h1', 'weapon-bow', 5, 1), heirloom: { heroId: 'hero-1', cap: 5 } }
    const stocked = updatePurse(made.save, { archive: [kept] })
    expect(sellItem(stocked, 'h1')).toEqual({ ok: false, reason: 'An heirloom cannot be sold.' })
    const worn = { ...stocked, heroes: stocked.heroes.map((hero) => ({ ...hero, equipment: { ...hero.equipment, mainHand: kept } })) }
    expect(sellItem(worn, 'h1').ok).toBe(false)
  })
})
