import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { classIdentity, raceIdentity } from '../../content/heroes.ts'
import { selectedHero } from '../../persist/character.ts'
import { withView } from '../../persist/offline.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { beginExpedition } from '../../persist/world.ts'
import { commitSave } from '../store.ts'
import { AwayReportView } from '../AwayPanel.tsx'

import { Attributes } from './Attributes.tsx'
import { CreateHero } from './CreateHero.tsx'
import { Loadout } from './Loadout.tsx'
import { Roster } from './Roster.tsx'
import { Rules, RulesForm } from './Rules.tsx'
import { SkillWeb } from './SkillWeb.tsx'

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

describe('allocation screens without a hero', () => {
  it('ask for a selected hero', () => {
    expect(renderToStaticMarkup(<Attributes />)).toContain('Select a hero to allocate attribute points.')
    expect(renderToStaticMarkup(<SkillWeb />)).toContain('Select a hero to see their skill web.')
  })
})

describe('loadout and rules screens without a hero', () => {
  it('ask for a selected hero', () => {
    expect(renderToStaticMarkup(<Loadout />)).toContain('Select a hero to choose their skills.')
    expect(renderToStaticMarkup(<Rules />)).toContain('Select a hero to edit their rules.')
  })
})

describe('rules screen telegraph hint', () => {
  it('explains a telegraph condition under its row', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const hero = selectedHero(made.save)
    if (hero === null) throw new Error('no hero')
    const html = renderToStaticMarkup(<RulesForm hero={hero} />)
    expect(html).toContain('Watches every enemy. Answer with Shield Brace, Ward, Mana Ward, Fade Back or Ward Charm.')
  })
})

describe('roster away badges', () => {
  it('shows a background run on the hero card, with the route, fights and bag', () => {
    let save = newSave()
    for (const name of ['Ash', 'Brin']) {
      const made = createHero(save, { name, race: 'human', classId: 'warrior' })
      if (!made.ok) throw new Error(made.reason)
      save = made.save
    }
    save = withView({ ...save, selectedHeroId: 'hero-1' }, 'hero-2', (view) => {
      const begun = beginExpedition(view, 'splintered-road', 3)
      if (!begun.ok) throw new Error(begun.reason)
      return begun.save
    })
    commitSave(save, 'test', false)
    const html = renderToStaticMarkup(<Roster />)
    expect(html).toContain('Away: Splintered Road, 0 fights, bag 0/20')
    expect(html).toContain('away-status-hero-2')
    expect(html).not.toContain('away-status-hero-1')
  })
})

describe('away report table', () => {
  it('has one row per hero and the shared crafts and discoveries below', () => {
    const hero = {
      heroId: 'hero-1',
      heroName: 'Ash',
      routeId: 'splintered-road',
      runs: 4,
      fightsWon: 12,
      retreats: 0,
      defeated: false,
      xp: 340,
      levelsGained: 1,
      gold: 95,
      materials: { shard: 6 },
      contractsFinished: 0,
      stopped: 'runLimit' as const,
      note: null,
    }
    const html = renderToStaticMarkup(
      <AwayReportView
        report={{
          awayMs: 3_600_000,
          replayedMs: 3_600_000,
          crafts: ['Brin finished a sword.'],
          craftBaseIds: [],
          discovered: ['Withered Grove'],
          heroes: [hero, { ...hero, heroId: 'hero-2', heroName: 'Brin', stopped: 'defeat', defeated: true, materials: {} }],
        }}
      />,
    )
    expect(html).toContain('Route')
    expect(html).toContain('Splintered Road')
    expect(html).toContain('away-row-hero-1')
    expect(html).toContain('away-row-hero-2')
    expect(html).toContain('Run limit reached')
    expect(html).toContain('Defeated')
    expect(html).toContain('Brin finished a sword.')
    expect(html).toContain('Discovered: Withered Grove.')
    expect(html).toContain('Materials brought home by Ash (6)')
  })
})
