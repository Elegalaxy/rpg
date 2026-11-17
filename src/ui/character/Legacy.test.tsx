import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createHero } from '../../persist/roster.ts'
import { newSave, type SaveData } from '../../persist/save.ts'
import { commitSave } from '../store.ts'

import { Legacy } from './Legacy.tsx'

function show(patch: { legacy?: number; peakLevel?: number; lives?: number; headStart?: number }): string {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const save: SaveData = {
    ...made.save,
    account: { ...made.save.account, discoveries: [...made.save.account.discoveries, 'node:drowned-causeway'] },
    heroes: made.save.heroes.map((hero) => ({
      ...hero,
      legacy: patch.legacy ?? 0,
      lives: patch.lives ?? 0,
      peakLevel: patch.peakLevel,
      rememberedEnemyIds: ['rootmaw-stalker', 'echo-knight'],
      purchases: { ...hero.purchases, headStart: patch.headStart ?? 0 },
    })),
  }
  commitSave(save, 'test', false)
  return renderToStaticMarkup(<Legacy />)
}

describe('Legacy screen', () => {
  it('shows the summary, the purchases with reasons for the disabled ones, and the next life', () => {
    const html = show({ legacy: 21, peakLevel: 12, lives: 1 })
    expect(html).toContain('data-testid="legacy"')
    expect(html).toContain('data-testid="mastery"')
    expect(html).toContain('Peak level')
    expect(html).toContain('Head Start I')
    expect(html).toContain('20 Legacy')
    expect(html).toContain('Needs 4 more Legacy.')
    expect(html).toContain('Doubles run XP until level 12.')
    expect(html).toContain('Drowned Causeway')
    expect(html).toContain('data-testid="reincarnation-block"')
  })

  it('names Head Start II once the first tier is bought and starts the next life at its level', () => {
    const html = show({ legacy: 100, headStart: 1 })
    expect(html).toContain('Head Start II')
    expect(html).toContain('level 5')
    const maxed = show({ legacy: 100, headStart: 2 })
    expect(maxed).toContain('level 10 (18 attribute points and 3 skill points unspent)')
    expect(maxed).toContain('All bought.')
  })
})
