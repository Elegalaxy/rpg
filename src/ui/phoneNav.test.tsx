import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { createHero } from '../persist/roster.ts'
import { newSave } from '../persist/save.ts'
import App from './App.tsx'
import { PhoneNav } from './PhoneNav.tsx'
import { commitSave } from './store.ts'

const MAIN = [
  { id: 'map', label: 'Map' },
  { id: 'town', label: 'Town' },
  { id: 'heroes', label: 'Hero' },
]
const MORE = [
  { id: 'roster', label: 'Roster' },
  { id: 'guide', label: 'Guide' },
]

describe('phone tab bar', () => {
  it('shows Map, Town, Hero and More, and marks More while a More tab is open', () => {
    const onMap = renderToStaticMarkup(<PhoneNav main={MAIN} more={MORE} current="map" onPick={() => undefined} badge={() => null} moreBadge={null} />)
    console.log('[ui]', 'phone nav', { onMap })
    expect(onMap).toContain('aria-label="Tabs"')
    expect(onMap).toMatch(/aria-pressed="true"[^>]*>Map</)
    expect(onMap).toMatch(/aria-pressed="false" aria-expanded="false"[^>]*>More</)
    expect(onMap).not.toContain('Roster')

    const onGuide = renderToStaticMarkup(<PhoneNav main={MAIN} more={MORE} current="guide" onPick={() => undefined} badge={() => null} moreBadge={null} />)
    expect(onGuide).toMatch(/aria-pressed="true" aria-expanded="false"[^>]*>More</)
  })
})

describe('compact status line', () => {
  afterEach(() => {
    commitSave(newSave(), 'test', false)
  })

  it('names the hero and level, and opens the full status', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    commitSave(made.save, 'test', false)
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('class="status-compact"')
    expect(html).toContain('Ash · L1')
    expect(html).toContain('aria-controls="status-full"')
    expect(html).not.toContain('status-compact-hp')
  })
})
