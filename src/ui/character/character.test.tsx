import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { classIdentity, raceIdentity } from '../../content/heroes.ts'

import { CreateHero } from './CreateHero.tsx'
import { Roster } from './Roster.tsx'

describe('hero creation screen', () => {
  it('names the empty roster and the starting slots', () => {
    const html = renderToStaticMarkup(<Roster />)
    expect(html).toContain('No heroes yet')
    expect(html).toContain('0 of 2 slots in use')
  })

  it('offers every race and class with the first summaries visible', () => {
    const html = renderToStaticMarkup(<CreateHero />)
    for (const race of ['Human', 'Elf', 'Beastfolk', 'Undead']) expect(html).toContain(race)
    for (const name of ['Warrior', 'Assassin', 'Ranger', 'Mage', 'Cleric']) expect(html).toContain(name)
    expect(html).toContain(raceIdentity.human.summary)
    expect(html).toContain(classIdentity.warrior.summary)
    expect(html).toContain('Create hero')
  })
})
