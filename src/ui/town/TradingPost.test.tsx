import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MATERIAL_BUY_PRICE, MATERIAL_SELL_PRICE } from '../../content/shop.ts'
import { updatePurse } from '../../persist/save.ts'
import { commitSave, createHeroFromUi, getSaveStatus } from '../store.ts'
import { Town } from './Town.tsx'

function stock(quantity: number): void {
  if (getSaveStatus().save.heroes.length === 0) expect(createHeroFromUi({ name: 'Ash', race: 'human', classId: 'warrior' })).toBeNull()
  commitSave(updatePurse(getSaveStatus().save, { materials: { shard: quantity } }), 'test')
}

describe('the Trading Post sell steps', () => {
  const price = MATERIAL_SELL_PRICE.shard ?? 0

  it('offers 1, 10, 100 and All with the gold each one pays, hiding steps larger than the stack', () => {
    stock(150)
    const html = renderToStaticMarkup(<Town place="trading-post" />)
    expect(html).toContain(`Sell 1 (+${price} g)`)
    expect(html).toContain(`Sell 10 (+${10 * price} g)`)
    expect(html).toContain(`Sell 100 (+${100 * price} g)`)
    expect(html).toContain(`Sell all (+${150 * price} g)`)
    expect(html).toContain('aria-label="Sell all shard"')
    stock(12)
    const small = renderToStaticMarkup(<Town place="trading-post" />)
    expect(small).toContain('aria-label="Sell 10 shard"')
    expect(small).not.toContain('aria-label="Sell 100 shard"')
    expect(small).toContain(`Sell all (+${12 * price} g)`)
  })

  it('disables the steps when the hero holds none', () => {
    stock(0)
    const html = renderToStaticMarkup(<Town place="trading-post" />)
    expect(html).toMatch(/disabled=""[^>]*aria-label="Sell 1 shard"/)
    expect(html).not.toContain('aria-label="Sell 10 shard"')
  })
})

describe('the Trading Post buy side', () => {
  const unit = MATERIAL_BUY_PRICE.shard ?? 0

  function fund(gold: number): void {
    stock(0)
    commitSave(updatePurse(getSaveStatus().save, { gold }), 'test')
  }

  it('shows Buy 1, 10 and 100 with their gold cost, only for common materials', () => {
    fund(100000)
    const html = renderToStaticMarkup(<Town place="trading-post" />)
    expect(html).toContain(`Buy 1 (-${unit} g)`)
    expect(html).toContain(`Buy 10 (-${10 * unit} g)`)
    expect(html).toContain(`Buy 100 (-${100 * unit} g)`)
    expect(html).toContain('aria-label="Buy 10 scrap"')
    expect(html).toContain('aria-label="Sell 1 shard"')
    expect(html).not.toContain('aria-label="Buy 1 riftglass"')
    expect(html).not.toContain('aria-label="Buy 1 cinderite"')
    expect(html).toContain('Buying costs five times what selling pays')
  })

  it('disables a step with a visible reason when gold is short', () => {
    fund(unit)
    const html = renderToStaticMarkup(<Town place="trading-post" />)
    expect(html).not.toMatch(/disabled=""[^>]*aria-label="Buy 1 shard"/)
    expect(html).toMatch(/disabled=""[^>]*aria-label="Buy 10 shard"/)
    fund(0)
    const broke = renderToStaticMarkup(<Town place="trading-post" />)
    expect(broke).toMatch(/disabled=""[^>]*aria-label="Buy 1 shard"/)
    expect(broke).toContain(`Need ${unit} more gold to buy 1`)
  })
})
