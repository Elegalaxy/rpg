import { describe, expect, it } from 'vitest'

import { uniqueItemFor } from '../content/uniques.ts'
import type { ExpeditionState } from '../sim/expedition.ts'
import { UNIQUE_ITEMS, uniqueDef } from '../sim/uniques.ts'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { firstClearLabel } from './firstClear.ts'
import { momentLine, momentsBetween } from './moments.ts'
import { reincarnate } from './reincarnation.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, type SaveData, type SavedHero } from './save.ts'
import { routes } from '../content/world.ts'
import { runOffline } from './offline.ts'
import { holdsUnique, payUniques, uniqueForRewardId, uniqueRewardId, uniquesDue, uniquesGained } from './uniques.ts'
import { settleExpedition, uniquePreview } from './world.ts'

function withHero(patch: Partial<SavedHero> = {}): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, ...patch })) }
}

const hero = (save: SaveData): SavedHero => selectedHero(save)!

/** A finished run with the given outcome and no fights; the defeated elites are set on the hero. */
function finished(save: SaveData, outcome: 'returned' | 'defeat', routeId = 'withered-grove'): SaveData {
  const expedition: ExpeditionState = startExpedition(hero(save), routeId, 1)
  expedition.outcome = outcome
  expedition.history = []
  expedition.xpEarned = 0
  return { ...save, expedition }
}

const STALKER = ['rootmaw-stalker']
const treadsOf = (h: SavedHero) => h.purse.archive.filter((item) => item.uniqueId === 'rootmaw-treads')

describe('uniquesDue', () => {
  it('lists the uniques of the elites this life has defeated, in table order, and none otherwise', () => {
    expect(uniquesDue(hero(withHero()))).toEqual([])
    const due = uniquesDue(hero(withHero({ defeatedEnemyIds: ['briar-matriarch', 'echo-knight', 'rootmaw-stalker', 'grove-wolf'] })))
    expect(due.map((def) => def.id)).toEqual(['rootmaw-treads', 'echoing-visor', 'briarheart-talisman'])
  })

  it('skips ledger ids already paid, and elites only remembered from an earlier life', () => {
    const paid = hero(withHero({ defeatedEnemyIds: STALKER, firstClearIds: [uniqueRewardId('rootmaw-treads')] }))
    expect(uniquesDue(paid)).toEqual([])
    const remembered = hero(withHero({ defeatedEnemyIds: [], rememberedEnemyIds: STALKER }))
    expect(uniquesDue(remembered)).toEqual([])
  })

  it('knows its ids', () => {
    expect(uniqueRewardId('rootmaw-treads')).toBe('unique:rootmaw-treads')
    expect(uniqueForRewardId('unique:echoing-visor')?.name).toBe('Echoing Visor')
    expect(uniqueForRewardId('unique:nope')).toBeUndefined()
    expect(uniqueForRewardId('splintered-road')).toBeUndefined()
    expect(firstClearLabel('unique:rootmaw-treads', undefined)).toBe('Rootmaw Treads')
  })
})

describe('payUniques', () => {
  it('puts each due unique in the archive on the hero class base and records the ledger id', () => {
    const { hero: paid, paid: defs } = payUniques(hero(withHero({ defeatedEnemyIds: ['rootmaw-stalker', 'hollowmaw-reaver'] })))
    expect(defs.map((def) => def.id)).toEqual(['rootmaw-treads', 'hollowmaw-fang'])
    expect(paid.purse.archive.map((item) => item.id)).toEqual(['unique-hero-1-rootmaw-treads', 'unique-hero-1-hollowmaw-fang'])
    expect(paid.purse.archive[0]).toEqual(uniqueItemFor('hero-1', uniqueDef('rootmaw-treads')!, 'warrior'))
    expect(paid.purse.archive[1]?.baseId).toBe('weapon-one-handed')
    expect(paid.firstClearIds).toEqual(['unique:rootmaw-treads', 'unique:hollowmaw-fang'])
    expect(uniquesDue(paid)).toEqual([])
  })

  it('returns the same hero when nothing is due', () => {
    const plain = hero(withHero())
    expect(payUniques(plain)).toEqual({ hero: plain, paid: [] })
    expect(payUniques(plain).hero).toBe(plain)
  })

  it('only records the id when the hero already holds that unique', () => {
    const held = uniqueItemFor('hero-1', uniqueDef('rootmaw-treads')!, 'warrior')
    const worn = withHero({ defeatedEnemyIds: STALKER })
    const wearing = { ...hero(worn), equipment: { ...hero(worn).equipment, feet: { ...held, id: 'other' } } }
    const result = payUniques(wearing)
    expect(result.paid).toEqual([])
    expect(result.hero.purse.archive).toEqual([])
    expect(result.hero.firstClearIds).toEqual(['unique:rootmaw-treads'])
    const archived = { ...hero(worn), purse: { ...hero(worn).purse, archive: [{ ...held, id: 'else' }] } }
    expect(payUniques(archived).hero.purse.archive).toHaveLength(1)
    expect(payUniques(archived).hero.firstClearIds).toEqual(['unique:rootmaw-treads'])
  })

  it('does not pay a sold unique again', () => {
    const paid = payUniques(hero(withHero({ defeatedEnemyIds: STALKER }))).hero
    const sold = { ...paid, purse: { ...paid.purse, archive: [] } }
    expect(uniquesDue(sold)).toEqual([])
    expect(payUniques(sold).hero).toBe(sold)
  })
})

describe('settleExpedition and the unique payout', () => {
  it('pays on a safe return, once, into the archive', () => {
    const save = withHero({ defeatedEnemyIds: STALKER })
    const home = settleExpedition(finished(save, 'returned'), 1)
    expect(treadsOf(hero(home))).toHaveLength(1)
    expect(hero(home).firstClearIds).toContain('unique:rootmaw-treads')
    expect(() => assertSaveData(home)).not.toThrow()
    const again = settleExpedition(finished(home, 'returned'), 1)
    expect(treadsOf(hero(again))).toHaveLength(1)
  })

  it('leaves the unique due after a defeat and pays it at the next safe return', () => {
    const save = withHero({ defeatedEnemyIds: STALKER })
    const lost = settleExpedition(finished(save, 'defeat'), 1)
    expect(treadsOf(hero(lost))).toHaveLength(0)
    expect(uniquesDue(hero(lost)).map((def) => def.id)).toEqual(['rootmaw-treads'])
    const home = settleExpedition(finished(lost, 'returned'), 1)
    expect(treadsOf(hero(home))).toHaveLength(1)
  })

  it('pays an old save retroactively at the next safe return', () => {
    const old = withHero({ defeatedEnemyIds: ['rootmaw-stalker', 'echo-knight', 'tidebound-colossus'], firstClearIds: ['splintered-road'] })
    const home = settleExpedition(finished(old, 'returned'), 1)
    expect(hero(home).purse.archive.map((item) => item.uniqueId)).toEqual(['rootmaw-treads', 'echoing-visor', 'tidebound-carapace'])
  })

  it('previews exactly what the safe return will create', () => {
    const save = withHero({ defeatedEnemyIds: STALKER })
    expect(uniquePreview(save)).toEqual([])
    expect(uniquePreview(finished(save, 'defeat'))).toEqual([])
    expect(uniquePreview(finished(save, 'returned')).map((def) => def.id)).toEqual(['rootmaw-treads'])
    const held = payUniques(hero(save)).hero
    const withLedgerOnly = { ...save, heroes: save.heroes.map((entry) => ({ ...entry, firstClearIds: held.firstClearIds ?? [] })) }
    expect(uniquePreview(finished(withLedgerOnly, 'returned'))).toEqual([])
  })

  it('reincarnation keeps the ledger and the item goes to the archive of past lives', () => {
    const home = settleExpedition(finished(withHero({ defeatedEnemyIds: STALKER, bossLossThisLife: true }), 'returned'), 1)
    const result = reincarnate(home, hero(home).id, null)
    if (!result.ok) throw new Error(result.reason)
    const next = hero(result.save)
    expect(next.firstClearIds).toContain('unique:rootmaw-treads')
    expect(next.pastLifeItemIds).toContain('unique-hero-1-rootmaw-treads')
    expect(next.purse.archive.map((item) => item.uniqueId)).toContain('rootmaw-treads')
    expect(uniquesDue(next)).toEqual([])
    // The elite is only remembered now, so a new life does not pay it again even after the item is gone.
    const gone = { ...next, purse: { ...next.purse, archive: [] } }
    expect(uniquesDue(gone)).toEqual([])
  })
})

describe('moments and gains', () => {
  it('makes a unique moment, ordered after the Warden, with the toast text', () => {
    const before = withHero({ defeatedEnemyIds: STALKER })
    const after = settleExpedition(finished(before, 'returned'), 1)
    const moments = momentsBetween(before, after)
    const unique = moments.find((moment) => moment.kind === 'unique')
    expect(unique).toBeDefined()
    expect(momentLine(unique!)).toBe('New unique item: Rootmaw Treads, from the Rootmaw Stalker. It is in your archive.')
    expect(moments.filter((moment) => moment.kind === 'firstClear').every((moment) => !moment.text.includes('Treads'))).toBe(true)
    expect(uniquesGained(hero(before), hero(after)).map((def) => def.id)).toEqual(['rootmaw-treads'])
    expect(holdsUnique(hero(after), 'rootmaw-treads')).toBe(true)
    expect(uniquesGained(null, hero(after))).toEqual([])
  })

  it('has one unique per elite', () => {
    expect(new Set(UNIQUE_ITEMS.map((def) => def.enemyId)).size).toBe(UNIQUE_ITEMS.length)
  })
})

describe('away runs pay uniques like live runs', () => {
  it('banks the item and reports it apart from the first clears', () => {
    const save = withHero()
    const route = routes['splintered-road']!
    const ready = { ...hero(save), awayRouteId: route.id, clearedNodeIds: ['splintered-road'], defeatedEnemyIds: STALKER, repeatRoute: true, stopAfterFights: 3, pushOnHpPercent: 0 }
    const away = { ...save, lastSeenAt: 1_000_000, heroes: save.heroes.map((entry) => (entry.id === ready.id ? ready : entry)) }
    const { save: after, summary } = runOffline(away, 30 * 60_000, false)
    expect(summary.heroes[0]!.uniques).toEqual(['Rootmaw Treads'])
    expect(summary.heroes[0]!.firstClears).toEqual(['Splintered Road'])
    expect(treadsOf(hero(after))).toHaveLength(1)
  })
})
