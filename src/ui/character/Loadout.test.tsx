import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { commitSave } from '../store.ts'

import { Loadout } from './Loadout.tsx'

function show(fifthSlot: boolean): string {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  commitSave(
    { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, purchases: { ...hero.purchases, ...(fifthSlot ? { fifthSlot: true } : {}) } })) },
    'test',
    false,
  )
  return renderToStaticMarkup(<Loadout />)
}

describe('Loadout slot count', () => {
  it('shows of 4 without the Fifth Skill Slot and of 5 with it', () => {
    const without = show(false)
    expect(without).toContain('data-testid="loadout-count"')
    expect(without).toMatch(/of 4\./)
    expect(without).not.toContain('Fifth slot')
    const withIt = show(true)
    expect(withIt).toMatch(/of 5\./)
    expect(withIt).toContain('Fifth slot')
  })
})

describe('Loadout passive line (Step 13.39)', () => {
  it('names the Assassin passive, and only for an Assassin', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'assassin' })
    if (!made.ok) throw new Error(made.reason)
    commitSave(made.save, 'test', false)
    const html = renderToStaticMarkup(<Loadout />)
    expect(html).toContain('data-testid="loadout-passive"')
    expect(html).toContain('Envenomed strikes')
    expect(show(false)).not.toContain('loadout-passive')
  })
})

describe('Loadout from your last life (Step 13.37)', () => {
  it('names the old skills that return when they are learned again', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    commitSave({ ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, pastLoadout: ['driving-blow', 'cleave'] })) }, 'test', false)
    const html = renderToStaticMarkup(<Loadout />)
    expect(html).toContain('data-testid="loadout-past"')
    expect(html).toContain('From your last life: Cleave returns to the loadout when you learn it again.')
    expect(show(false)).not.toContain('loadout-past')
  })
})
