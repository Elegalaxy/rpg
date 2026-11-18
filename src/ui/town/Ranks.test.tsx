import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { newItem } from '../../content/items.ts'
import { grantCraftingKit } from '../../persist/crafting.ts'
import { selectedHero } from '../../persist/character.ts'
import { updatePurse } from '../../persist/save.ts'
import type { ItemInstance } from '../../sim/economy.ts'
import { commitSave, createHeroFromUi, getSaveStatus } from '../store.ts'
import { Ranks } from './Ranks.tsx'

function setup(item: ItemInstance, gold = 5000): void {
  if (getSaveStatus().save.heroes.length === 0) expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
  const kit = grantCraftingKit(getSaveStatus().save)
  const leveled = { ...kit, heroes: kit.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level: 17 } })) }
  commitSave(updatePurse(leveled, { gold, materials: { scrap: 20, duskiron: 20 }, archive: [item], craftQueue: [] }), 'test')
}

const keenBow: ItemInstance = { ...newItem('bow', 'weapon-bow', 12), modifiers: ['keen'] }

describe('the Ranks panel', () => {
  it('shows the rank change, the scaled effect, the price and an enabled button', () => {
    setup(keenBow)
    const html = renderToStaticMarkup(<Ranks />)
    expect(html).not.toContain('<details')
    expect(html).toContain('Keen I on Keen Bow')
    expect(html).toContain('I → II')
    expect(html).toContain('+2 points critical chance → +3 points critical chance')
    expect(html).toContain('30')
    expect(html).toMatch(/<button[^>]*aria-label="Rank up Keen on bow"[^>]*>Rank up to II/)
    expect(html).not.toMatch(/disabled=""[^>]*aria-label="Rank up Keen on bow"/)
  })

  it('shows the highest rank as a disabled button and the reason when short of gold', () => {
    setup({ ...keenBow, modifierRanks: [3] })
    const top = renderToStaticMarkup(<Ranks />)
    expect(top).toContain('III (highest)')
    expect(top).toMatch(/disabled=""[^>]*aria-label="Rank up Keen on bow"/)
    expect(top).toContain('Keen is already rank III.')
    setup(keenBow, 5)
    const poor = renderToStaticMarkup(<Ranks />)
    expect(poor).toContain('That costs 30 gold. You have 5.')
  })

  it('says so when nothing can be ranked up', () => {
    setup({ ...newItem('bow', 'weapon-bow', 12) })
    expect(renderToStaticMarkup(<Ranks />)).toContain('No modifier of this kind can be ranked up yet.')
  })
  it('shows the temper the chosen material binds, kept when the old one is higher', () => {
    setup(keenBow)
    expect(renderToStaticMarkup(<Ranks />)).toContain('none (kept)')
    setup(keenBow)
    commitSave(updatePurse(getSaveStatus().save, { materials: { duskiron: 20 } }), 'test')
    const html = renderToStaticMarkup(<Ranks />)
    expect(html).toContain('none → +60%')
    expect(html).toContain('+2 points critical chance → +4.2 points critical chance')
    setup({ ...keenBow, modifierTempers: [5] })
    commitSave(updatePurse(getSaveStatus().save, { materials: { duskiron: 20 } }), 'test')
    expect(renderToStaticMarkup(<Ranks />)).toContain('+75% (kept)')
  })

  it('offers the free upgrade only for I to II, with a token', () => {
    setup(keenBow)
    expect(renderToStaticMarkup(<Ranks />)).not.toContain('Use free upgrade')
    const hero = selectedHero(getSaveStatus().save)!
    commitSave({ ...getSaveStatus().save, heroes: [{ ...hero, freeUpgrades: 1 }] }, 'test')
    const html = renderToStaticMarkup(<Ranks />)
    expect(html).toContain('Free upgrades: 1')
    expect(html).toMatch(/<button[^>]*aria-label="Rank up free Keen on bow"[^>]*>Use free upgrade/)
    setup({ ...keenBow, modifierRanks: [2] })
    const second = selectedHero(getSaveStatus().save)!
    commitSave({ ...getSaveStatus().save, heroes: [{ ...second, freeUpgrades: 1 }] }, 'test')
    expect(renderToStaticMarkup(<Ranks />)).not.toContain('Use free upgrade')
  })
})
