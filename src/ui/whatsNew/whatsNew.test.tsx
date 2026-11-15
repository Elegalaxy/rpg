import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import source from '../../../CHANGELOG.md?raw'
import { CATEGORIES, inlineParts, parseChangelog } from './parseChangelog.ts'
import { WhatsNewView } from './WhatsNew.tsx'

describe('parseChangelog on the real CHANGELOG.md', () => {
  const sections = parseChangelog(source)

  it('has sections, each with entries and a known category', () => {
    expect(sections.length).toBeGreaterThan(0)
    for (const section of sections) {
      expect(section.entries.length, section.heading).toBeGreaterThan(0)
      for (const entry of section.entries) {
        expect(CATEGORIES as readonly string[], `${section.heading}: ${entry.text}`).toContain(entry.category)
        expect(entry.text.length).toBeGreaterThan(0)
      }
    }
  })

  it('drops no bullet line under a section', () => {
    let bullets = 0
    let inSection = false
    for (const line of source.split(/\r?\n/)) {
      if (line.startsWith('## ')) inSection = true
      else if (inSection && line.startsWith('- ')) bullets += 1
    }
    expect(sections.reduce((sum, section) => sum + section.entries.length, 0)).toBe(bullets)
  })

  it('reads the open section and patch headings', () => {
    expect(sections[0]?.unreleased).toBe(true)
    const patch = sections.find((section) => !section.unreleased)
    expect(patch?.version).toMatch(/^0\.\d+\.\d+$/)
    expect(patch?.date).not.toBe('')
  })
})

describe('parser details', () => {
  it('handles planned suffixes and bold', () => {
    const [section] = parseChangelog('intro\n## Unreleased: x\n\nProse.\n\n- Fixed (planned): a **b** c (Step 1).\n')
    expect(section?.entries[0]).toMatchObject({ category: 'Fixed', planned: true })
    expect(section?.intro).toBe('Prose.')
    expect(inlineParts('a **b** c').map((part) => part.kind)).toEqual(['text', 'bold', 'text'])
  })
})

describe('plan-step tags stay out of the page', () => {
  it('strips (Step ...) tags from entries, titles and intros', () => {
    const [section] = parseChangelog('## 0.1.0 · 2026-11-01 · Big zone (Steps 12.6, 13.1-13.4)\n\nSee Step notes (Step 2).\n\n- New: a thing (Step 13.8, part 4).\n')
    expect(section?.title).toBe('Big zone')
    expect(section?.entries[0]?.text).toBe('a thing.')
    expect(section?.intro).toBe('See Step notes.')
  })

  it('leaves no plan-step wording in the rendered page', () => {
    const html = renderToStaticMarkup(<WhatsNewView sections={parseChangelog(source)} />)
    expect(html).not.toMatch(/\(Steps? \d/)
    expect(html).not.toMatch(/batch(es)? \d/i)
  })
})

describe('WhatsNewView', () => {
  it('renders tagged entries, filter counts, and expands only the first section', () => {
    const html = renderToStaticMarkup(<WhatsNewView sections={parseChangelog(source)} />)
    expect(html).toContain('Filter by category')
    for (const category of CATEGORIES) expect(html).toContain(category)
    expect(html.match(/<details[^>]* open/g)?.length).toBe(1)
  })
})
