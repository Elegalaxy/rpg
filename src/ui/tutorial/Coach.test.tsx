import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { newSave } from '../../persist/save.ts'
import { commitSave, getSaveStatus } from '../store.ts'
import { CreateHero } from '../character/CreateHero.tsx'
import { Coach } from './Coach.tsx'

describe('the first-run coach on screen', () => {
  it('marks the name and offers Skip, and a finished coach draws nothing', () => {
    commitSave(newSave(), 'test', false)
    const html = renderToStaticMarkup(<Coach onShowMap={() => undefined} />)
    expect(html).toContain('Name your hero')
    expect(html).toContain('Skip')
    expect(html).toContain('data-testid="tutorial"')
    const done = newSave()
    done.account.tutorial = 'done'
    commitSave(done, 'test', false)
    expect(renderToStaticMarkup(<Coach onShowMap={() => undefined} />)).toBe('')
    expect(getSaveStatus().save.account.tutorial).toBe('done')
  })

  it('puts a tutor id on the hero form controls', () => {
    commitSave(newSave(), 'test', false)
    const html = renderToStaticMarkup(<CreateHero />)
    expect(html).toContain('data-tutor="hero-name"')
    expect(html).toContain('data-tutor="hero-race"')
    expect(html).toContain('data-tutor="hero-class"')
    expect(html).toContain('data-tutor="hero-create"')
  })
})
