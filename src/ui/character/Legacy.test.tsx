import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { carrySummary } from '../../persist/carryOver.ts'
import { createHero } from '../../persist/roster.ts'
import { startExpedition } from '../../persist/expeditionSetup.ts'
import { newSave, type SaveData, type SavedHero } from '../../persist/save.ts'
import { commitSave } from '../store.ts'

import { Legacy } from './Legacy.tsx'

type Patch = {
  legacy?: number
  peakLevel?: number
  lives?: number
  headStart?: number
  bossLoss?: boolean
  echoRank?: number
  gold?: number
  debt?: number
  materials?: { [id: string]: number }
  supplies?: { [id: string]: number }
  tokens?: number
  stockpile?: number
  artisan?: number
  fifthSlot?: boolean
  heirlooms?: number
  /** Change the hero before rendering. */
  hero?: (hero: SavedHero) => SavedHero
  running?: boolean
}

function show(patch: Patch, planning = false): string {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const save: SaveData = {
    ...made.save,
    account: { ...made.save.account, discoveries: [...made.save.account.discoveries, 'node:drowned-causeway'] },
    heroes: made.save.heroes.map((base) => (patch.hero === undefined ? base : patch.hero(base))).map((hero) => ({
      ...hero,
      legacy: patch.legacy ?? 0,
      lives: patch.lives ?? 0,
      peakLevel: patch.peakLevel,
      bossLossThisLife: patch.bossLoss ?? false,
      echoRank: patch.echoRank ?? 0,
      rememberedEnemyIds: ['rootmaw-stalker', 'echo-knight'],
      purchases: {
        ...hero.purchases,
        headStart: patch.headStart ?? 0,
        stockpile: patch.stockpile ?? 0,
        artisan: patch.artisan ?? 0,
        ...(patch.fifthSlot ? { fifthSlot: true } : {}),
        ...(patch.heirlooms !== undefined && patch.heirlooms >= 2 ? { secondHeirloom: true } : {}),
        ...(patch.heirlooms === 3 ? { thirdHeirloom: true } : {}),
      },
      freeUpgrades: patch.tokens ?? 0,
      purse: {
        ...hero.purse,
        gold: patch.gold ?? 0,
        debt: patch.debt ?? 0,
        materials: patch.materials ?? {},
        supplies: patch.supplies ?? {},
      },
    })),
  }
  const running = patch.running === true ? { ...save, expedition: startExpedition(save.heroes[0]!, 'splintered-road', 1) } : save
  commitSave(running, 'test', false)
  return renderToStaticMarkup(<Legacy initialPlanning={planning} />)
}

describe('Legacy screen', () => {
  it('shows which boss condition was met, and that a victory or a loss both unlock reincarnation', () => {
    const none = show({})
    expect(none).toContain('Not yet: face the Fractured Warden.')
    expect(none).toContain('data-testid="reincarnation-block"')
    const lost = show({ bossLoss: true })
    expect(lost).toContain('lost to the Fractured Warden.')
    expect(lost).not.toContain('data-testid="reincarnation-block"')
    expect(lost).toContain('Legacy if you reincarnate now')
    expect(lost).toContain('Level and XP')
    expect(lost).toContain('data-testid="plan-next-life"')
    expect(lost).toContain('Plan your next life')
    expect(lost).not.toContain('aria-label="Heirloom"')
    const won = show({ echoRank: 5, bossLoss: true })
    expect(won).toContain('Echo ranks 1–5 first unlocked')
    expect(won).toContain('+45') // ranks 3 and 5 are milestones: 5 + 5 + 15 + 5 + 15
    expect(won).toContain('lost to and defeated the Fractured Warden.')
    const victory = show({ echoRank: 1 })
    expect(victory).toContain('Boss faced this life: defeated the Fractured Warden.')
    expect(won).not.toContain('data-testid="reincarnation-block"')
  })

  it('opens the next life planner instead of the Legacy tab when planning', () => {
    const html = show({ bossLoss: true }, true)
    expect(html).toContain('aria-label="Next life"')
    expect(html).toContain('Between lives')
    expect(html).not.toContain('aria-label="Legacy"')
  })

  it('shows the summary, the purchases with reasons for the disabled ones, and the next life', () => {
    const html = show({ legacy: 21, peakLevel: 12, lives: 1 })
    expect(html).toContain('data-testid="legacy"')
    expect(html).toContain('data-testid="mastery"')
    expect(html).toContain('Peak level')
    expect(html).toContain('Head Start I')
    expect(html).toContain('20 Legacy')
    expect(html).toContain('Applies now and every later life')
    expect(html).toContain('choose at your next reincarnation')
    expect(html).toContain('Needs 4 more Legacy.')
    expect(html).toContain('Doubles run XP until level 12.')
    expect(html).toContain('Drowned Causeway')
    expect(html).toContain('data-testid="reincarnation-block"')
  })

  it('lists the Fifth Skill Slot, with the missing Legacy, and shows it bought', () => {
    const poor = show({ legacy: 80 })
    expect(poor).toContain('Fifth Skill Slot')
    expect(poor).toContain('90 Legacy')
    expect(poor).toContain('Needs 10 more Legacy.')
    expect(poor).toContain('One more skill in your loadout (5 instead of 4)')
    const bought = show({ legacy: 200, fifthSlot: true })
    expect(bought).toContain('1 of 1')
  })

  it('offers a free heirloom slot on the items the hero owns', () => {
    const html = show({})
    expect(html).toContain('data-testid="heirloom-claim"')
    expect(html).toContain('Heirloom slot free')
    expect(html).toContain('Make heirloom now')
  })

  describe('Make heirloom now is always shown (Step 13.45)', () => {
    it('is usable when a slot is free and something is claimable', () => {
      const html = show({})
      expect(html).toContain('Heirloom slot free')
      expect(html).toContain('data-testid="heirloom-owned">1<')
      expect(html).toContain('data-testid="heirloom-used">0<')
      expect(html).toContain('data-testid="heirloom-free">1<')
      expect(html).not.toContain('data-testid="heirloom-claim-block"')
      expect(html).toMatch(/<select[^>]*aria-label="Item to make an heirloom"(?![^>]*disabled)/)
    })

    it('says how many slots the hero owns and uses when none is free', () => {
      const full = show({ hero: (hero) => ({ ...hero, equipment: { ...hero.equipment, mainHand: { ...hero.equipment.mainHand!, heirloom: { heroId: hero.id, cap: 1 } } } }) })
      expect(full).toContain('data-testid="heirloom-claim"')
      expect(full).toContain('Make an heirloom now')
      expect(full).toContain('No heirloom slot is free: you own 1 slot and 1 is used.')
      expect(full).toContain('data-testid="heirloom-free">0<')
      expect(full).not.toContain('<select')
      expect(full).not.toContain('Make heirloom now</button>')
    })

    it('counts several slots', () => {
      const html = show({ heirlooms: 3, hero: (hero) => ({ ...hero, equipment: { ...hero.equipment, mainHand: { ...hero.equipment.mainHand!, heirloom: { heroId: hero.id, cap: 1 } } } }) })
      expect(html).toContain('data-testid="heirloom-owned">3<')
      expect(html).toContain('data-testid="heirloom-used">1<')
      expect(html).toContain('data-testid="heirloom-free">2<')
    })

    it('says so when there is nothing to claim', () => {
      const none = show({
        hero: (hero) => ({
          ...hero,
          equipment: { ...hero.equipment, mainHand: null, offHand: null, head: null, chest: null, hands: null, feet: null, accessory0: null, accessory1: null },
          purse: { ...hero.purse, archive: [] },
        }),
      })
      expect(none).toContain('You own nothing that could become an heirloom yet.')
      expect(none).not.toContain('<select')
    })

    it('says to finish the expedition while one is running', () => {
      const html = show({ running: true })
      expect(html).toContain('data-testid="heirloom-claim-block">Finish the expedition first.')
      expect(html).not.toContain('<select')
      expect(html).not.toContain('Make heirloom now</button>')
    })

    it('lists the best pieces first and marks worn ones (Step 13.46)', () => {
      const html = show({
        hero: (hero) => {
          const main = hero.equipment.mainHand!
          const archived = [
            { ...main, id: 'arch-low', itemLevel: 2, quality: 1 },
            { ...main, id: 'arch-high', itemLevel: 40, quality: 1.2 },
            { ...main, id: 'arch-highq', itemLevel: 40, quality: 1.5 },
          ]
          return { ...hero, purse: { ...hero.purse, archive: archived } }
        },
      })
      const values = [...html.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1])
      expect(values.slice(0, 4)).toEqual(['', 'arch-highq', 'arch-high', expect.any(String)])
      expect(values.indexOf('arch-low')).toBeGreaterThan(values.indexOf('arch-high'))
      expect(html).toContain('(worn)')
      expect(html).not.toContain('Nothing to choose')
    })
  })

  it('names Head Start II once the first tier is bought and starts the next life at its level', () => {
    const html = show({ legacy: 100, headStart: 1 })
    expect(html).toContain('Head Start II')
    expect(html).toContain('level 5')
    const third = show({ legacy: 100, headStart: 2 })
    expect(third).toContain('Head Start III')
    expect(third).toContain('level 10 (18 attribute points and 3 skill points unspent)')
    const maxed = show({ legacy: 100, headStart: 3 })
    expect(maxed).toContain('level 15 (28 attribute points and 5 skill points unspent)')
    expect(maxed).toContain('All bought.')
  })

  it('lists the new purchases in two groups with their tiers and costs (Step 13.31)', () => {
    const html = show({ legacy: 500, lives: 1, peakLevel: 10 })
    expect(html).toContain('Each new life')
    expect(html).toContain('What carries over')
    for (const id of ['memory', 'artisan', 'stockpile', 'heirloom', 'pockets', 'headStart']) expect(html).toContain(`data-testid="purchase-${id}"`)
    expect(html).toContain('Long Memory I')
    expect(html).toContain('Artisan\u2019s Favor I')
    expect(html).toContain('Stockpile I')
    expect(html).toContain('Second Heirloom')
    expect(html).toContain('30 Legacy')
    expect(html).toContain('20 Legacy')
    expect(show({ legacy: 500, stockpile: 3, artisan: 2 })).toContain('Stockpile')
    expect(show({ legacy: 500, stockpile: 3 })).toContain('data-testid="why-stockpile">All bought.')
  })

  it('previews exactly what carries over and says the rest is lost (Step 13.31)', () => {
    const html = show({ gold: 10000, debt: 400, tokens: 2, artisan: 1, materials: { shard: 4, hide: 1200 }, supplies: { 'healing-draught': 3 }, bossLoss: true })
    expect(html).toContain('data-testid="carry-gold">10,000 → 1,920')
    expect(html).toContain('data-testid="carry-debt">400 → 0')
    expect(html).toContain('400 paid from gold first')
    expect(html).toContain('data-testid="carry-tokens">2 → 3')
    expect(html).toContain('data-testid="carry-percent">20%')
    expect(html).toContain('Sells at 20%')
    expect(html).toContain('Materials (2)')
    expect(html).toContain('>1,200<')
    expect(html).toContain('>240<')
    expect(html).toContain('Supplies (1)')
    expect(html).toContain('The rest is lost.')
    const calm = show({ gold: 100 })
    expect(calm).not.toContain('data-testid="carry-debt"')
    expect(calm).toContain('None.')
    const rich = show({ gold: 10000, stockpile: 3 })
    expect(rich).toContain('data-testid="carry-gold">10,000 → 5,000')
    expect(rich).toContain('Sells at 50%')
  })

  it('words the confirmation with what is kept and what is lost', () => {
    const carry = { percent: 20, debtPaid: 0, gold: { now: 10000, kept: 2000 }, debt: { now: 0, kept: 0 }, materials: [], supplies: [] }
    expect(carrySummary(carry)).toBe('Keeps 2,000 of 10,000 gold and 20% of each material and supply. The rest is lost.')
  })
})

describe('Legacy screen combat setup (Step 13.37)', () => {
  it('says the combat setup is kept, with counts', () => {
    const html = show({ bossLoss: true })
    expect(html).toContain('data-testid="carry-setup"')
    expect(html).toMatch(/Kept: \d+ rules, 0 stacks, preparation/)
    expect(html).toContain('Rules, stacks and preparation are kept.')
  })
})
