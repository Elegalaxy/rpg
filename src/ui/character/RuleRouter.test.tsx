import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RuleRouter } from './RuleRouter.tsx'

const entries = [
  { id: 'stack-1', name: 'Group', trigger: 'Enemies alive is at least 2', auto: true, waitingFor: null },
  { id: 'stack-2', name: 'Hand', trigger: 'Picked by hand only', auto: false, waitingFor: null },
]
const noop = () => undefined

function render(selected: string, counts: Parameters<typeof RuleRouter>[0]['counts'] = null): string {
  return renderToStaticMarkup(<RuleRouter entries={entries} selected={selected} counts={counts} onSelect={noop} />)
}

describe('stack router', () => {
  it('lists stacks in priority order and ends in Otherwise: Default', () => {
    const html = render('default')
    expect(html.indexOf('Group')).toBeLessThan(html.indexOf('Hand'))
    expect(html.indexOf('Hand')).toBeLessThan(html.indexOf('Otherwise: Default'))
    expect(html).toContain('role="tablist"')
    expect(html).toContain('When Enemies alive is at least 2')
    for (const tag of ['Auto', 'Manual only', 'Fallback']) expect(html).toContain(tag)
  })

  it('marks the selected chain and keeps the tab ids the panel is labelled by', () => {
    const html = render('stack-1')
    expect(html).toMatch(/id="stack-tab-stack-1"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="stack-tab-stack-1"/)
    expect(html).toContain('id="stack-tab-default"')
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
  })

  it('shows a dash with no log and the fire count with one', () => {
    expect(render('default')).toContain('Used —')
    const html = render('default', { 'stack-1': [2, 3], default: [1] })
    expect(html).toContain('Used 5×')
    expect(html).toContain('Used 1×')
    expect(html).toContain('Used 0×')
  })
})

describe('waiting stacks (Step 13.37)', () => {
  it('shows a Waiting tag on a stack that is left out of fights', () => {
    const html = renderToStaticMarkup(
      <RuleRouter entries={[{ ...entries[0]!, waitingFor: 'Cleave' }, entries[1]!]} selected="default" counts={null} onSelect={noop} />,
    )
    expect(html.match(/>Waiting</g)).toHaveLength(1)
  })
})
