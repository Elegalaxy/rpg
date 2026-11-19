import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { commitSave } from '../store.ts'
import { PlacePicker } from './PlacePicker.tsx'
import { Town } from './Town.tsx'

vi.mock('../useNarrow.ts', () => ({ useNarrow: () => true }))

function freshHero(): void {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  commitSave(made.save, 'test', false)
}

describe('the town on a phone', () => {
  afterEach(() => {
    commitSave(newSave(), 'test', false)
  })

  it('picks a place from one list, with waiting counts on the names', () => {
    const html = renderToStaticMarkup(
      <PlacePicker
        places={[
          { id: 'contract-board', label: 'Contract board' },
          { id: 'weaponsmith', label: 'Weaponsmith' },
        ]}
        current="weaponsmith"
        onPick={() => undefined}
        badges={{ 'contract-board': { count: 2, what: 'finished contracts' }, weaponsmith: { count: 0, what: 'finished crafts' } }}
      />,
    )
    console.log('[ui]', 'place picker', { html })
    expect(html).toContain('class="place-picker"')
    expect(html).toContain('<option value="contract-board">Contract board (2)</option>')
    expect(html).toContain('<option value="weaponsmith" selected="">Weaponsmith</option>')
    expect(html).toContain('aria-label="2 things waiting in town"')
  })

  it('shows only gold in the purse and folds the materials, with no debt line at 0', () => {
    freshHero()
    const html = renderToStaticMarkup(<Town place="weaponsmith" />)
    expect(html).toContain('data-testid="gold"')
    expect(html).not.toContain('data-testid="debt"')
    expect(html).toContain('<details class="purse-materials" data-testid="purse-materials"><summary>Materials</summary>')
    expect(html).toContain('aria-label="Gear jobs"')
  })
})
