import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { contractList } from '../../content/contracts.ts'
import { acceptContract } from '../../persist/contracts.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave, updatePurse } from '../../persist/save.ts'
import { commitSave } from '../store.ts'
import { MapView } from './MapView.tsx'

describe('world map without a hero', () => {
  it('shows every node with its state and the road route, and says why it cannot start', () => {
    const html = renderToStaticMarkup(<MapView />)
    for (const name of ['Greyhaven', 'Splintered Road', 'Withered Grove', 'Fallen Bastion', 'Fracture Gate']) {
      expect(html).toContain(name)
    }
    expect(html).toContain('aria-label="Withered Grove, locked. Not discovered yet."')
    expect(html).toContain('aria-label="Splintered Road, discovered"')
    expect(html).toContain('Level band')
    expect(html).toContain('1–7')
    expect(html).toContain('Select a hero first.')
    expect(html).toContain('Pounce · 1.5 s wind-up')
    expect(html).not.toContain('hero-marker')
  })
})

describe('world map with the Drowned Causeway', () => {
  it('shows the Causeway node as undiscovered', () => {
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('Drowned Causeway')
    expect(html).toContain('aria-label="Drowned Causeway, locked. Not discovered yet."')
  })
})

describe('world map with the Rift Hollows', () => {
  it('shows the Hollows node as undiscovered', () => {
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('Rift Hollows')
    expect(html).toContain('aria-label="Rift Hollows, locked. Not discovered yet."')
  })
})

describe('world map with the Cinder Scar', () => {
  it('shows the Cinder Scar node as undiscovered', () => {
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('Cinder Scar')
    expect(html).toContain('aria-label="Cinder Scar, locked. Not discovered yet."')
  })
})

describe('world map with the Bloodthorn Barrens', () => {
  it('shows the Bloodthorn Barrens node as undiscovered', () => {
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('Bloodthorn Barrens')
    expect(html).toContain('aria-label="Bloodthorn Barrens, locked. Not discovered yet."')
  })
})

describe('map contract track', () => {
  afterEach(() => {
    commitSave(newSave(), 'test', false)
  })

  it('lists accepted contracts before a run', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const board = updatePurse(made.save, { board: contractList.map((def) => ({ ...def })) })
    const accepted = acceptContract(board, 'cull-the-pack')
    if (!accepted.ok) throw new Error(accepted.reason)
    commitSave(accepted.save, 'test', false)
    const html = renderToStaticMarkup(<MapView />)
    expect(html).toContain('data-testid="contract-track"')
    expect(html).toContain('Cull the Pack')
    expect(html).toContain('0/6')
  })

  it('says when none are accepted', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    commitSave(made.save, 'test', false)
    expect(renderToStaticMarkup(<MapView />)).toContain('None accepted')
  })
})
