import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { carryOver, carrySummary } from '../../persist/carryOver.ts'
import { legacyPreview, stageNextLife } from '../../persist/reincarnation.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave, type SaveData, type SavedHero } from '../../persist/save.ts'

import { NextLifePlanner } from './NextLifePlanner.tsx'

type Patch = {
  legacy?: number
  bossLoss?: boolean
  gold?: number
  craftQueue?: SavedHero['purse']['craftQueue']
}

function build(patch: Patch): { save: SaveData; hero: SavedHero } {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const save: SaveData = {
    ...made.save,
    heroes: made.save.heroes.map((hero) => ({
      ...hero,
      legacy: patch.legacy ?? 0,
      bossLossThisLife: patch.bossLoss ?? true,
      purse: { ...hero.purse, gold: patch.gold ?? 0, craftQueue: patch.craftQueue ?? hero.purse.craftQueue },
    })),
  }
  return { save, hero: save.heroes[0]! }
}

type Props = Partial<Pick<ComponentProps<typeof NextLifePlanner>, 'initialPlan' | 'initialPicks' | 'initialConfirming'>>

function show(patch: Patch, props: Props = {}): string {
  const { save, hero } = build(patch)
  return renderToStaticMarkup(<NextLifePlanner save={save} hero={hero} onBack={() => undefined} onDone={() => undefined} {...props} />)
}

describe('NextLifePlanner', () => {
  it('counts this life Legacy as already available', () => {
    const { hero } = build({ legacy: 10 })
    const total = legacyPreview(hero).total
    const html = show({ legacy: 10 })
    expect(html).toContain('aria-label="Next life"')
    expect(html).toContain('Nothing changes until you begin the new life.')
    expect(html).toContain('aria-label="Where this Legacy comes from"')
    expect(html).toContain(`data-testid="plan-earned">+${total}<`)
    expect(html).toContain(`data-testid="plan-legacy">${10 + total}<`)
  })

  it('previews a planned Stockpile in the carried share and lists the plan', () => {
    const html = show({ gold: 10000, legacy: 100 }, { initialPlan: [{ kind: 'stockpile' }] })
    expect(html).toContain('data-testid="carry-gold">10,000 → 3,000')
    expect(html).toContain('Stockpile II')
    expect(html).toMatch(/data-testid="plan-list"[^]*Stockpile I/)
  })

  it('adds a heirloom picker for a planned Second Heirloom', () => {
    const html = show({ legacy: 100 }, { initialPlan: [{ kind: 'heirloom' }] })
    expect(html).toContain('Heirloom 1 of 2')
    expect(html).toContain('aria-label="Heirloom 2"')
  })

  it('starts the next life at the planned Head Start level', () => {
    const html = show({ legacy: 100 }, { initialPlan: [{ kind: 'headStart' }] })
    expect(html).toMatch(/data-testid="next-start">level 5/)
  })

  it('asks for confirmation with the staged carry and the spent Legacy', () => {
    const { hero } = build({ gold: 10000, legacy: 100 })
    const staged = stageNextLife(hero, [{ kind: 'stockpile' }])
    if (!staged.ok) throw new Error(staged.reason)
    const html = show({ gold: 10000, legacy: 100 }, { initialPlan: [{ kind: 'stockpile' }], initialConfirming: true })
    expect(html).toContain('role="dialog"')
    expect(html).toContain('This cannot be undone')
    expect(html).toContain('Spends 20 Legacy')
    expect(html).toContain(`data-testid="confirm-carry">${carrySummary(carryOver(staged.hero))}<`)
    expect(html).toContain('Heirlooms:')
  })

  it('is blocked while crafting jobs are queued', () => {
    const job = { id: 'job-1' } as unknown as SavedHero['purse']['craftQueue'][number]
    const html = show({ craftQueue: [job] })
    expect(html).toContain('data-testid="reincarnation-block"')
    expect(html).toContain('Wait for the crafters')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Begin new life…/)
  })

  it('words plan rows for the new life, not as applying now', () => {
    const html = show({ legacy: 100 })
    expect(html).toContain('From the new life on')
    expect(html).toContain('Keep one more heirloom. Pick it below')
    expect(html).not.toContain('Applies now')
  })
})
