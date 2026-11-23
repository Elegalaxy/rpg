import { describe, expect, it } from 'vitest'

import { newItem } from '../content/items.ts'
import { itemSellPrice } from '../content/shop.ts'
import type { ItemInstance } from '../sim/economy.ts'

import { createHero } from './roster.ts'
import { newSave, purseOf, updatePurse } from './save.ts'
import { RISKY_QUALITY, needsSellConfirm, sellGroup } from './sellSafety.ts'
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
  const kept: ItemInstance = { ...newItem('h1', 'weapon-bow', 5, 1), heirloom: { heroId: 'hero-1', cap: 5 } }

  function stockedAt(level: number, pastLife = false) {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const withItem = updatePurse(made.save, { archive: [kept] })
    return {
      ...withItem,
      heroes: withItem.heroes.map((hero) => ({
        ...hero,
        progress: { ...hero.progress, level },
        ...(pastLife ? { pastLifeItemIds: ['h1'] } : {}),
      })),
    }
  }

  it('stays refused until the hero reaches the level the heirloom was kept at', () => {
    expect(sellItem(stockedAt(1), 'h1')).toEqual({ ok: false, reason: 'An heirloom can be sold once you reach level 5.' })
    expect(sellItem(stockedAt(4), 'h1').ok).toBe(false)
    const worn = stockedAt(1)
    const wearing = {
      ...worn,
      heroes: worn.heroes.map((hero) => ({ ...hero, equipment: { ...hero.equipment, mainHand: kept }, purse: { ...hero.purse, archive: [] } })),
    }
    expect(sellItem(wearing, 'h1').ok).toBe(false)
  })

  it('sells once the hero has reached that level, and an earlier-life heirloom still pays the carried share', () => {
    const ready = stockedAt(5)
    const sold = sellItem(ready, 'h1')
    if (!sold.ok) throw new Error(sold.reason)
    expect(purseOf(sold.save).gold).toBe(purseOf(ready).gold + itemSellPrice(kept))
    expect(purseOf(sold.save).archive).toEqual([])

    const earlier = stockedAt(5, true)
    const shared = sellItem(earlier, 'h1')
    if (!shared.ok) throw new Error(shared.reason)
    expect(purseOf(shared.save).gold).toBe(purseOf(earlier).gold + Math.floor(itemSellPrice(kept) * 0.2))
    expect(shared.save.heroes[0]?.pastLifeItemIds).toEqual([])
  })
})
