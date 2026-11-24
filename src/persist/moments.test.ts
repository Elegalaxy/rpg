import { describe, expect, it } from 'vitest'

import { contracts } from '../content/contracts.ts'
import { nodes } from '../content/world.ts'
import { momentLine, momentsBetween } from './moments.ts'
import { createHero } from './roster.ts'
import { newSave, type SaveData, type SavedHero } from './save.ts'

function heroSave(patch: (hero: SavedHero) => Partial<SavedHero> = () => ({})): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, ...patch(hero) })) }
}

const contract = Object.values(contracts)[0]!

function withContract(save: SaveData, progress: number): SaveData {
  return {
    ...save,
    heroes: save.heroes.map((hero) => ({ ...hero, purse: { ...hero.purse, contracts: [{ contractId: contract.id, progress }] } })),
  }
}

describe('moments between two saves', () => {
  it('finds a level up, a Warden win, a first clear, a finished contract and a new place, in that order', () => {
    const before = withContract(heroSave(), 0)
    const unseen = Object.values(nodes).find((node) => node.discoveryId !== undefined && !before.account.discoveries.includes(node.discoveryId))!
    const leveled = heroSave((hero) => ({
      progress: { ...hero.progress, level: 2, unspentAttributePoints: 3, unspentSkillPoints: 1 },
      echoRank: 1,
      firstClearIds: ['splintered-road'],
    }))
    const after = withContract({ ...leveled, account: { ...leveled.account, discoveries: [...before.account.discoveries, unseen.discoveryId] } }, contract.count)
    const moments = momentsBetween(before, after)
    console.log('[persist]', 'moments', moments)
    expect(moments.map((moment) => moment.kind)).toEqual(['level', 'warden', 'warden', 'firstClear', 'contract', 'discovery'])
    expect(moments[0]).toEqual({ kind: 'level', level: 2, points: 4 })
    expect(moments[1]).toEqual({ kind: 'warden', text: 'The Fractured Warden fell. Echo rank 1 is unlocked.' })
    expect(moments[3]).toEqual({ kind: 'firstClear', text: 'Splintered Road: 210 g · 15 scrap · 1 free upgrade' })
    expect(moments[4]).toEqual({ kind: 'contract', text: contract.name })
    expect(moments[5]).toEqual({ kind: 'discovery', text: unseen.name })
    expect(momentLine(moments[0]!)).toBe('Level 2 reached. 4 points to spend.')
  })

  it('says nothing for a contract already finished, a first clear already paid, or another hero', () => {
    const before = withContract(heroSave(() => ({ firstClearIds: ['splintered-road'] })), contract.count)
    expect(momentsBetween(before, before)).toEqual([])
    const other = createHero(newSave(), { name: 'Bryn', race: 'human', classId: 'mage' })
    if (!other.ok) throw new Error(other.reason)
    const swapped = { ...other.save, heroes: other.save.heroes.map((hero) => ({ ...hero, id: 'hero-other', progress: { ...hero.progress, level: 9 } })), selectedHeroId: 'hero-other' }
    expect(momentsBetween(before, swapped)).toEqual([])
  })

  it('names a boss loss as reincarnation unlocked', () => {
    const before = heroSave()
    const after = heroSave(() => ({ bossLossThisLife: true }))
    expect(momentsBetween(before, after)).toEqual([{ kind: 'warden', text: 'You faced a boss this life. You can now reincarnate.' }])
  })
})
