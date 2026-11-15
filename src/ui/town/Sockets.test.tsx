import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { newItem } from '../../content/items.ts'
import { grantCraftingKit } from '../../persist/crafting.ts'
import { selectedHero } from '../../persist/character.ts'
import { purseOf, updatePurse } from '../../persist/save.ts'
import type { ItemInstance } from '../../sim/economy.ts'
import { commitSave, createHeroFromUi, getSaveStatus } from '../store.ts'
import { Sockets } from './Sockets.tsx'

function setup(level: number, item: ItemInstance): void {
  if (getSaveStatus().save.heroes.length === 0) expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
  const kit = grantCraftingKit(getSaveStatus().save)
  const leveled = { ...kit, heroes: kit.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level } })) }
  commitSave(updatePurse(leveled, { gold: 5000, materials: { riftglass: 20, scrap: 20 }, archive: [item], craftQueue: [] }), 'test')
  expect(selectedHero(getSaveStatus().save)?.progress.level).toBe(level)
  expect(purseOf(getSaveStatus().save).archive).toHaveLength(1)
}

const keenBow: ItemInstance = { ...newItem('bow', 'weapon-bow', 12), modifiers: ['keen'] }

describe('the Sockets panel', () => {
  it('is locked below hero level 10 and says so', () => {
    setup(9, keenBow)
    const html = renderToStaticMarkup(<Sockets />)
    expect(html).toContain('Sockets unlock at hero level 10. This hero is level 9.')
    expect(html).not.toContain('Open socket')
  })

  it('lists an item with its price, and an enabled Open socket button', () => {
    setup(17, keenBow)
    const html = renderToStaticMarkup(<Sockets />)
    expect(html).toContain('Keen Bow')
    expect(html).toContain('480')
    expect(html).toMatch(/<button[^>]*aria-label="Open socket bow"[^>]*>Open socket/)
    expect(html).not.toMatch(/disabled=""[^>]*aria-label="Open socket bow"/)
  })

  it('shows both modifiers and Re-infuse for a full item, and disables Open socket with the reason when short of gold', () => {
    setup(17, { ...keenBow, socketed: true, modifiers: ['keen', 'precise'] })
    const html = renderToStaticMarkup(<Sockets />)
    expect(html).toContain('Keen + Precise')
    expect(html).toContain('Re-infuse')
    setup(17, keenBow)
    commitSave(updatePurse(getSaveStatus().save, { gold: 10 }), 'test')
    const poor = renderToStaticMarkup(<Sockets />)
    expect(poor).toMatch(/disabled=""[^>]*aria-label="Open socket bow"/)
    expect(poor).toContain('That costs 480 gold. You have 10.')
  })
})
