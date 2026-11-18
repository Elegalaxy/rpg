import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { newItem } from '../../content/items.ts'
import { itemSellPrice } from '../../content/shop.ts'
import { updatePurse } from '../../persist/save.ts'
import { commitSave, createHeroFromUi, getSaveStatus } from '../store.ts'
import { Town } from './Town.tsx'

describe('the sell tab and gear from an earlier life (Step 13.31)', () => {
  it('shows the carried share as the price and an Earlier life tag only on flagged items', () => {
    if (getSaveStatus().save.heroes.length === 0) expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
    const old = newItem('old-1', 'weapon-bow', 10, 1)
    const fresh = newItem('new-1', 'weapon-dagger', 10, 1)
    const stocked = updatePurse(getSaveStatus().save, { archive: [old, fresh] })
    const flagged = { ...stocked, heroes: stocked.heroes.map((hero) => ({ ...hero, pastLifeItemIds: ['old-1'] })) }
    commitSave(flagged, 'test')
    const html = renderToStaticMarkup(<Town place="weaponsmith" startJob="sell" />)
    expect(html).toContain('Earlier life')
    expect(html.match(/Earlier life/g)?.length).toBe(1)
    expect(html).toContain(`+${Math.floor(itemSellPrice(old) * 0.2)}`)
    expect(html).toContain(`+${itemSellPrice(fresh)}`)
  })
})
