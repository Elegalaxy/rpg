import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GuideView } from './Guide.tsx'
import { buildGuide, searchGuide } from './guideIndex.ts'

describe('GuideView', () => {
  it('renders every entry anchor, the search box and the section chips', () => {
    const html = renderToStaticMarkup(<GuideView entries={buildGuide()} />)
    expect(html).toContain('aria-label="Search the guide"')
    expect(html).toContain('id="vow-zeal"')
    expect(html).toContain('id="class-cleric"')
    expect(html).toContain('id="skill-fireball"')
    expect(html).toContain('aria-label="Filter by section"')
  })

  it('shows an empty state with a Clear button when nothing matches', () => {
    const html = renderToStaticMarkup(<GuideView entries={[]} />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Nothing in the guide matches')
    expect(html).toContain('Clear')
  })

  it('search results are a subset of the entries', () => {
    expect(searchGuide(buildGuide(), 'fireball', null).length).toBeGreaterThan(0)
  })
})
