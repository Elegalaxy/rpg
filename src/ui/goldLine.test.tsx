import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createHero } from '../persist/roster.ts'
import { newSave } from '../persist/save.ts'
import { GoldLine } from './GoldLine.tsx'
import { goldTotals } from './goldTotals.ts'

function save() {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

describe('sidebar gold', () => {
  it('shows just the purse when not on a run', () => {
    const html = renderToStaticMarkup(<GoldLine save={save()} />)
    expect(html).toContain('Gold')
    expect(html).not.toContain('data-testid="gold-split"')
  })

  it('on a run adds carried and banked to the purse and says where it is', () => {
    const base = save()
    const fake = { ...base, expedition: { carriedGold: 61, depositedGold: 17690 } } as never
    expect(goldTotals(fake)).toMatchObject({ total: 17751, carried: 61, banked: 17690, onRun: true })
    const html = renderToStaticMarkup(<GoldLine save={fake} />)
    expect(html).toContain('17,751')
    expect(html).toContain('61</span> carried')
    expect(html).toContain('17,690</span> banked')
  })
})
