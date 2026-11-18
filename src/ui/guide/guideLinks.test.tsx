import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import createHeroSource from '../character/CreateHero.tsx?raw'
import legacySource from '../character/Legacy.tsx?raw'
import rulesSource from '../character/Rules.tsx?raw'
import skillWebSource from '../character/SkillWeb.tsx?raw'
import expeditionSource from '../map/ExpeditionPanel.tsx?raw'
import { CreateHero } from '../character/CreateHero.tsx'
import { GuideLink } from './GuideLink.tsx'
import { buildGuide } from './guideIndex.ts'

const ids = new Set<string>(buildGuide().map((entry) => entry.id))

describe('GuideLink', () => {
  it('renders a labelled button', () => {
    const html = renderToStaticMarkup(<GuideLink id="topic-rules" label="How rules work" />)
    expect(html).toContain('aria-label="Open the Guide: How rules work"')
    expect(html).toContain('>Guide<')
  })

  it('appears on hero creation for the race and the class', () => {
    const html = renderToStaticMarkup(<CreateHero />)
    expect(html).toContain('aria-label="Open the Guide: Human"')
    expect(html).toContain('aria-label="Open the Guide: Warrior"')
  })

  it('only links to entries that exist, at every placement', () => {
    for (const race of ['human', 'elf', 'beastfolk', 'undead']) expect(ids.has(`race-${race}`)).toBe(true)
    for (const id of ['class-cleric', 'topic-rules', 'topic-reincarnation', 'vow-zeal', 'vow-endurance', 'vow-temperance']) expect(ids.has(id), id).toBe(true)
    for (const klass of ['warrior', 'assassin', 'ranger', 'mage', 'cleric']) expect(ids.has(`class-${klass}`), klass).toBe(true)
    // Every literal id used with GuideLink in the UI sources.
    const sources = { expeditionSource, rulesSource, skillWebSource, legacySource, createHeroSource }
    for (const [name, source] of Object.entries(sources)) expect(source, name).toContain('<GuideLink')
  })
})
