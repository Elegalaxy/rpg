import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { newItem } from '../../content/items.ts'
import { grantCraftingKit } from '../../persist/crafting.ts'
import { selectedHero } from '../../persist/character.ts'
import { purseOf, updatePurse } from '../../persist/save.ts'
import type { ItemInstance } from '../../sim/economy.ts'
import { commitSave, createHeroFromUi, getSaveStatus } from '../store.ts'
import { ReinfuseButton } from './ReinfuseButton.tsx'
import { Sockets } from './Sockets.tsx'
import { replacesLine } from './replacesLine.ts'

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
    expect(html).not.toContain('<details')
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
  it('names the modifier a re-infuse replaces, and not on a first infuse', () => {
    setup(17, { ...keenBow, socketed: true, modifiers: ['keen', 'precise'], modifierRanks: [1, 2] })
    const html = renderToStaticMarkup(<Sockets />)
    expect(html).toContain('<dt>Replaces</dt>')
    expect(html).toMatch(/data-testid="infuse-replaces"[^>]*>.*Precise II → /)
    expect(html).toContain('The first modifier stays.')
    setup(17, { ...keenBow, socketed: true })
    expect(renderToStaticMarkup(<Sockets />)).not.toContain('<dt>Replaces</dt>')
  })

  it('replacesLine names the second modifier, with its rank, and the new one', () => {
    expect(replacesLine({ ...keenBow, socketed: true, modifiers: ['keen', 'precise'] }, 'keen')).toBe('Precise → Keen')
    expect(replacesLine(keenBow, 'precise')).toBeNull()
  })

  it('Re-infuse is a two-click button: Confirm replace once armed', () => {
    const plain = renderToStaticMarkup(<ReinfuseButton disabled={false} label="Infuse bow" confirmLabel="Confirm replace bow" onConfirm={() => undefined} />)
    expect(plain).toContain('aria-label="Infuse bow"')
    const armed = renderToStaticMarkup(<ReinfuseButton disabled={false} label="Infuse bow" confirmLabel="Confirm replace bow" onConfirm={() => undefined} initialArmed />)
    expect(armed).toContain('aria-label="Confirm replace bow"')
    const off = renderToStaticMarkup(<ReinfuseButton disabled label="Infuse bow" confirmLabel="Confirm replace bow" onConfirm={() => undefined} initialArmed />)
    expect(off).toContain('aria-label="Infuse bow"')
  })

  it('shows what the socket material does to quality, and the temper of the infuse material', () => {
    setup(17, keenBow)
    const open = renderToStaticMarkup(<Sockets />)
    expect(open).toContain('<dt>Quality</dt>')
    expect(open).toContain('100% → 103%')
    setup(17, { ...keenBow, socketed: true })
    commitSave(updatePurse(getSaveStatus().save, { materials: { cinderite: 20 } }), 'test')
    const infuse = renderToStaticMarkup(<Sockets />)
    expect(infuse).toContain('<dt>Temper</dt>')
    expect(infuse).toContain('+75%')
  })

  it('shows the free upgrade button and tag only with a token, and disables it below level 10', () => {
    setup(17, keenBow)
    expect(renderToStaticMarkup(<Sockets />)).not.toContain('Use free upgrade')
    const hero = selectedHero(getSaveStatus().save)!
    commitSave({ ...getSaveStatus().save, heroes: [{ ...hero, freeUpgrades: 2 }] }, 'test')
    const html = renderToStaticMarkup(<Sockets />)
    expect(html).toContain('Free upgrades: 2')
    expect(html).toContain('>Now<')
    expect(html).toMatch(/<button[^>]*aria-label="Open socket free bow"[^>]*>Use free upgrade/)
    expect(html).not.toMatch(/disabled=""[^>]*aria-label="Open socket free bow"/)
  })
})
