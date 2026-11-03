import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Help } from './Help.tsx'

describe('Help', () => {
  it('renders a keyboard-reachable ? whose tooltip text is linked to it', () => {
    const html = renderToStaticMarkup(<Help label="About debt">Debt blocks nothing.</Help>)
    expect(html).toContain('aria-label="About debt"')
    expect(html).toContain('role="tooltip"')
    expect(html).toContain('Debt blocks nothing.')
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1]
    expect(described).toBeDefined()
    expect(html).toContain(`id="${described}"`)
  })
})
