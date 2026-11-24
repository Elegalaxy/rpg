import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { newItem } from '../../content/items.ts'
import { selectedHero } from '../../persist/character.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave, type SavedHero } from '../../persist/save.ts'
import type { ItemInstance } from '../../sim/economy.ts'

import { SellList } from './SellList.tsx'

function setup(): { save: ReturnType<typeof newSave>; hero: SavedHero } {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)!
  return { save: made.save, hero: { ...hero, pastLifeItemIds: ['old-1', 'heir-1'] } }
}

const heirloom: ItemInstance = { ...newItem('heir-1', 'weapon-bow', 5, 1.1), heirloom: { heroId: 'hero-1', cap: 5 } }
const old = newItem('old-1', 'weapon-bow', 5, 1)
const plain = newItem('new-1', 'weapon-dagger', 5, 1)
const fancy: ItemInstance = { ...newItem('fancy-1', 'weapon-dagger', 5, 1.1), modifiers: ['vicious'] }
const worn = newItem('worn-1', 'weapon-dagger', 5, 1)

function html(armedId?: string): string {
  const { save, hero } = setup()
  return renderToStaticMarkup(
    <SellList save={save} hero={hero} worn={[worn]} archived={[plain, old, heirloom, fancy]} closed={false} run={() => undefined} armedId={armedId} />,
  )
}

describe('the Sell list groups (Step 13.44)', () => {
  it('shows the groups in order with a badge on each row', () => {
    const out = html()
    const order = ['Worn', 'Heirlooms and kept gear', 'Earlier lives', 'Current life'].map((label) => out.indexOf(`<h4 class="sell-group">${label} `))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(out).toContain('Heirloom</span>')
    expect(out).toContain('Earlier life</span>')
    expect(out).toContain('Current life</span>')
  })

  it('keeps the new gear apart from kept gear', () => {
    const out = html()
    const current = out.slice(out.indexOf('aria-label="Current life"'))
    expect(current).toContain('Sell new-1')
    expect(current).toContain('Sell fancy-1')
    expect(current).not.toContain('Sell old-1')
    expect(current).not.toContain('heir-1')
  })

  it('shows an heirloom disabled with the reason, not hidden', () => {
    const out = html()
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Sell heir-1"/)
    expect(out).toContain('title="Kept through every life. It can be sold once your level reaches the level it was kept at."')
    expect(out).toContain('An heirloom can be sold once you reach level 5.')
  })

  it('lets the heirloom be sold, with a second click, once the hero reaches that level', () => {
    const { save, hero } = setup()
    const ready = { ...hero, progress: { ...hero.progress, level: 5 } }
    const out = renderToStaticMarkup(<SellList save={save} hero={ready} worn={[]} archived={[heirloom]} closed={false} run={() => undefined} />)
    expect(out).not.toContain('An heirloom can be sold once you reach level 5.')
    expect(out).toMatch(/aria-label="Sell heir-1"[^>]*><span/)
  })

  it('sells plain current-life gear with a plain button and asks twice for the rest', () => {
    const out = html()
    expect(out).toMatch(/aria-label="Sell new-1"[^>]*>Sell<\/button>/)
    expect(out).toMatch(/aria-label="Sell old-1"[^>]*><span[^>]*>Sell<\/span><span[^>]*>Confirm sell \+/)
    expect(out).toMatch(/aria-label="Sell fancy-1"[^>]*><span/)
    expect(out).toMatch(/aria-label="Sell worn worn-1"[^>]*>Sell<\/button>/)
  })

  it('renders the armed state with the confirm name and price', () => {
    const out = html('old-1')
    expect(out).toContain('aria-label="Confirm sell old-1 for ')
    expect(out).toContain('aria-label="Sell fancy-1"')
  })

  it('asks twice for worn gear of an earlier life', () => {
    const { save, hero } = setup()
    const out = renderToStaticMarkup(<SellList save={save} hero={hero} worn={[old]} archived={[]} closed={false} run={() => undefined} />)
    expect(out).toContain('Earlier life')
    expect(out).toMatch(/aria-label="Sell worn old-1"[^>]*><span/)
  })

  it('says there is nothing to sell for an empty list', () => {
    const { save, hero } = setup()
    expect(renderToStaticMarkup(<SellList save={save} hero={hero} worn={[]} archived={[]} closed={false} run={() => undefined} />)).toContain('nothing of this kind')
  })
})

describe('the built-in stat of accessories (Step 14.4)', () => {
  it('shows an Amulet and a Talisman with their stat line and nothing for a Ring', () => {
    const { save, hero } = setup()
    const out = renderToStaticMarkup(
      <SellList
        save={save}
        hero={hero}
        worn={[]}
        archived={[newItem('amulet-1', 'accessory-amulet', 30), newItem('talisman-1', 'accessory-talisman', 30), newItem('ring-1', 'accessory-ring', 30)]}
        closed={false}
        run={() => undefined}
      />,
    )
    expect(out).toContain('+0.75% maximum HP')
    expect(out).toContain('+3 points critical damage')
    expect(out.match(/data-testid="implicit-line"/g)).toHaveLength(2)
  })
})
