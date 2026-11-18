import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { grantCraftingKit } from '../../persist/crafting.ts'
import { selectedHero } from '../../persist/character.ts'
import { purseOf, updatePurse } from '../../persist/save.ts'
import { commitSave, createHeroFromUi, getSaveStatus, queuePackFromUi } from '../store.ts'
import { PackWorkshop } from './PackWorkshop.tsx'

function setup(level: number, gold = 5000): void {
  if (getSaveStatus().save.heroes.length === 0) expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
  const kit = grantCraftingKit(getSaveStatus().save)
  const leveled = { ...kit, heroes: kit.heroes.map((hero) => ({ ...hero, pack: undefined, progress: { ...hero.progress, level } })) }
  commitSave(updatePurse(leveled, { gold, materials: { shard: 20, riftglass: 20 }, craftQueue: [] }), 'test')
  expect(selectedHero(getSaveStatus().save)?.progress.level).toBe(level)
}

describe('the Backpack counter', () => {
  it('shows 4 slots with no pack, both packs with their costs, and a Craft button for the Satchel', () => {
    setup(17)
    const html = renderToStaticMarkup(<PackWorkshop />)
    expect(html).toContain('data-testid="pack-slots">4<')
    expect(html).toContain('Satchel')
    expect(html).toContain('Field Pack')
    expect(html).toContain('400')
    expect(html).toContain('1200')
    expect(html).toMatch(/<button[^>]*aria-label="Craft Satchel"[^>]*>Craft/)
    expect(html).not.toMatch(/disabled=""[^>]*aria-label="Craft Satchel"/)
    expect(html).toMatch(/disabled=""[^>]*aria-label="Craft Field Pack"/)
    expect(html).toContain('The Field Pack needs the Satchel first.')
  })

  it('says why a pack is refused: hero level, and gold', () => {
    setup(9)
    expect(renderToStaticMarkup(<PackWorkshop />)).toContain('The Satchel needs hero level 10. This hero is level 9.')
    setup(17, 100)
    const poor = renderToStaticMarkup(<PackWorkshop />)
    expect(poor).toMatch(/disabled=""[^>]*aria-label="Craft Satchel"/)
    expect(poor).toContain('That costs 400 gold. You have 100.')
  })

  it('queues the pack, charging 400 gold, and shows the stack limit once a pack is owned', () => {
    setup(17)
    expect(queuePackFromUi('satchel', 'shard')).toBeNull()
    expect(purseOf(getSaveStatus().save).gold).toBe(4600)
    expect(purseOf(getSaveStatus().save).craftQueue[0]).toMatchObject({ kind: 'pack', packId: 'satchel' })
    expect(queuePackFromUi('satchel', 'shard')).toBe('A Satchel is already being made.')
    const owned = { ...getSaveStatus().save, heroes: getSaveStatus().save.heroes.map((hero) => ({ ...hero, pack: 'satchel' as const })) }
    commitSave(owned, 'test')
    const html = renderToStaticMarkup(<PackWorkshop />)
    expect(html).toContain('data-testid="pack-slots">5<')
    expect(html).toContain('At most 2 of each supply with a backpack.')
    expect(html).toContain('Owned')
  })
})
