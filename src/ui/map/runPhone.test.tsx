import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContractTrackRow } from '../../persist/contracts.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { Help } from '../Help.tsx'
import { commitSave, startExpeditionFromUi } from '../store.ts'
import { contractSummary } from './ContractTrack.tsx'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'

vi.mock('../useNarrow.ts', () => ({ useNarrow: () => true }))

const row = (patch: Partial<ContractTrackRow>): ContractTrackRow => ({
  contractId: 'c',
  name: 'Bounty',
  label: 'Bounty',
  description: '',
  progress: 0,
  count: 5,
  pending: 0,
  ...patch,
})

describe('the run on a phone', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    commitSave(newSave(), 'test', false)
    vi.unstubAllGlobals()
  })

  it('shows short control names that keep their full names for screen readers, and folds the contracts', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    commitSave(made.save, 'test', false)
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    const html = renderToStaticMarkup(<ExpeditionPanel />)
    console.log('[ui]', 'phone run bar', { labels: [...html.matchAll(/aria-label="(Return to town|Auto run|Auto-escape)"[^>]*>([^<]+)</g)].map((m) => m[2]) })
    expect(html).toMatch(/aria-label="Return to town"[^>]*>Return</)
    expect(html).toMatch(/aria-label="Auto run"[^>]*>Auto: Off</)
    expect(html).toMatch(/aria-label="Auto-escape"[^>]*>Escape: On</)
    expect(html).toContain('<details class="contract-track contract-fold" data-testid="contract-track"><summary>Contracts')
  })

  it('sums the contracts on one line', () => {
    expect(contractSummary([])).toBe('none accepted')
    expect(contractSummary([row({ progress: 5 }), row({ progress: 1, pending: 2 })])).toBe('2 active · 1 done · +2 this run')
    expect(contractSummary([row({ progress: 3, pending: 4 })])).toBe('1 active · 1 done · +4 this run')
  })

  it('renders a help mark that a tap can open', () => {
    const html = renderToStaticMarkup(<Help label="About it">Text</Help>)
    expect(html).toContain('class="help"')
    expect(html).toContain('aria-expanded="false"')
  })
})
