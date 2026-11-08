import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { supplyTable } from '../../content/supplies.ts'

import { SupplyCard } from './SupplyCard.tsx'

const noop = () => undefined

function card(id: string, over: { lock?: string | null; haveMaterial?: number; gold?: number } = {}): string {
  return renderToStaticMarkup(
    <ul>
      <SupplyCard
        supply={supplyTable[id]!}
        owned={0}
        haveMaterial={over.haveMaterial ?? 5}
        gold={over.gold ?? 100}
        closed={false}
        heroSelected
        lock={over.lock ?? null}
        onBuy={noop}
        onBrew={noop}
      />
    </ul>,
  )
}

describe('supply card', () => {
  it('shows Brew only instead of Buy for a supply Greyhaven does not sell', () => {
    const html = card('greater-draught')
    expect(html).toContain('Brew only')
    expect(html).not.toContain('Buy 1')
  })

  it('disables Brew and shows the lock reason while locked', () => {
    const html = card('greater-draught', { lock: 'Discover Drowned Causeway first.' })
    expect(html).toContain('Discover Drowned Causeway first.')
    expect(html).toContain('Locked')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Brew 1 Greater Draught"/)
  })

  it('keeps Buy for a sold supply and enables Brew when open', () => {
    const html = card('warming-tonic')
    expect(html).toContain('Buy 1')
    expect(html).not.toContain('Brew only')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Brew 1/)
  })
})
