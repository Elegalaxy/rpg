import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DurabilityGrid, Kpi, KpiRow, ShopRow } from './Kit.tsx'

describe('shop rows', () => {
  it('lays out name, owned badge, effect, cost pills, and buttons without prose', () => {
    const html = renderToStaticMarkup(
      <ul>
        <ShopRow
          name="Healing Draught"
          owned={3}
          ownedTestId="stash-healing-draught"
          effect="Restores 30% of maximum HP."
          costs={[
            [{ kind: 'gold', amount: 15 }],
            [
              { kind: 'mat', amount: 3, label: 'hide' },
              { kind: 'gold', amount: 5 },
            ],
          ]}
          actions={<button type="button">Buy 1</button>}
        />
      </ul>,
    )
    expect(html).toContain('class="shop-name"')
    expect(html).toContain('<span data-testid="stash-healing-draught">3</span>')
    expect(html).toContain('pill pill-owned')
    expect(html).toContain('pill pill-gold')
    expect(html).toContain('pill pill-mat')
    expect(html).toContain('15 gold')
    expect(html).toContain('3 hide')
    expect(html).toContain('>or<')
    expect(html).not.toMatch(/You have|Buy for/)
  })

  it('shows no owned badge for none, but keeps a hidden count for tests and scripts', () => {
    const html = renderToStaticMarkup(
      <ul>
        <ShopRow name="Antidote" owned={0} ownedTestId="stash-antidote" costs={[[{ kind: 'gold', amount: 10 }]]} />
      </ul>,
    )
    expect(html).not.toContain('pill-owned')
    expect(html).toContain('hidden=""')
    expect(html).toContain('data-testid="stash-antidote"')
  })
})

describe('stat cards and durability', () => {
  it('shows a big value over a label', () => {
    const html = renderToStaticMarkup(
      <KpiRow label="Outcome">
        <Kpi label="Fights won" value={4} tone="good" />
        <Kpi label="Rescue fee" value="25 g" tone="bad" note="0 g left · debt 0" />
      </KpiRow>,
    )
    expect(html).toContain('<strong class="kpi-value">4</strong><span class="kpi-label">Fights won</span>')
    expect(html).toContain('kpi kpi-bad')
    expect(html).toContain('0 g left · debt 0')
  })

  it('colours each piece by wear and names a broken one', () => {
    const html = renderToStaticMarkup(
      <DurabilityGrid
        label="Gear wear"
        pieces={[
          { label: 'Main Hand', durability: 90, max: 100, disabled: false },
          { label: 'Off Hand', durability: 40, max: 100, disabled: false },
          { label: 'Head', durability: 10, max: 100, disabled: false },
          { label: 'Chest', durability: 0, max: 100, disabled: true },
        ]}
      />,
    )
    expect(html).toContain('durability durability-good')
    expect(html).toContain('durability durability-warn')
    expect(html.match(/durability durability-bad/g)).toHaveLength(2)
    expect(html).toContain('Main Hand')
    expect(html).toContain('Broken')
    expect(html).toContain('90/100')
  })
})
