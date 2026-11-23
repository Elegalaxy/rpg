import { describe, expect, it } from 'vitest'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { ECHO_RANK_TOKENS, echoRewardsDue, firstClearLabel, firstClearsDue, payFirstClears } from './firstClear.ts'
import { runOffline } from './offline.ts'
import { bonusesDue, reincarnate } from './reincarnation.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData, type SavedHero } from './save.ts'
import { firstClearPreview, settleExpedition } from './world.ts'
import { routes } from '../content/world.ts'
import type { ExpeditionState } from '../sim/expedition.ts'

function withHero(patch: Partial<SavedHero> = {}): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, ...patch })) }
}

function hero(save: SaveData): SavedHero {
  return selectedHero(save)!
}

/** A finished run with the given outcome and no fights; the cleared nodes are set on the hero. */
function finished(save: SaveData, outcome: 'returned' | 'defeat', routeId = 'withered-grove'): SaveData {
  const expedition: ExpeditionState = startExpedition(hero(save), routeId, 1)
  expedition.outcome = outcome
  expedition.history = []
  expedition.xpEarned = 0
  return { ...save, expedition }
}

/** The gold a run puts in the purse with no first-clear reward: what it deposited plus what it carried home. */
function runGold(save: SaveData): number {
  return save.expedition!.depositedGold + save.expedition!.carriedGold
}

const GROVE_CLEARED = ['splintered-road', 'withered-grove']

describe('first-clear payout', () => {
  it('pays the Grove and the unpaid Road once, with gold, material and tokens', () => {
    const save = withHero({ clearedNodeIds: GROVE_CLEARED })
    const run = finished(save, 'returned')
    const paid = hero(settleExpedition(run, 1))
    expect(paid.purse.gold).toBe(runGold(run) + 180 + 420)
    expect(paid.purse.materials.scrap).toBe(15)
    expect(paid.purse.materials.hide).toBe(15)
    expect(paid.freeUpgrades).toBe(2)
    expect(paid.firstClearIds).toEqual(['splintered-road', 'withered-grove'])
  })

  it('pays nothing on a second return', () => {
    const first = settleExpedition(finished(withHero({ clearedNodeIds: GROVE_CLEARED }), 'returned'), 1)
    const secondRun = finished(first, 'returned')
    const second = settleExpedition(secondRun, 1)
    expect(hero(second).purse.gold).toBe(runGold(secondRun))
    expect(hero(second).freeUpgrades).toBe(2)
    expect(hero(second).firstClearIds).toEqual(['splintered-road', 'withered-grove'])
  })

  it('a defeat pays nothing and leaves it due until the next safe return', () => {
    const save = withHero({ clearedNodeIds: GROVE_CLEARED })
    const lost = settleExpedition(finished(save, 'defeat'), 1)
    expect(hero(lost).freeUpgrades).toBeUndefined()
    expect(hero(lost).firstClearIds).toBeUndefined()
    expect(firstClearsDue(hero(lost)).map((reward) => reward.nodeId)).toEqual(['splintered-road', 'withered-grove'])
    const home = settleExpedition(finished(lost, 'returned'), 1)
    expect(hero(home).freeUpgrades).toBe(2)
  })

  it('the Fracture Gate pays gold only', () => {
    const save = withHero({ clearedNodeIds: ['fracture-gate'] })
    const run = finished(save, 'returned', 'fracture-via-grove')
    const paid = hero(settleExpedition(run, 1))
    expect(paid.purse.gold).toBe(runGold(run) + 600)
    expect(Object.keys(paid.purse.materials)).toEqual(Object.keys(hero(save).purse.materials))
    expect(paid.freeUpgrades).toBe(1)
  })

  it('reincarnation keeps both fields and a re-clear pays nothing', () => {
    const paidSave = settleExpedition(finished(withHero({ clearedNodeIds: GROVE_CLEARED }), 'returned'), 1)
    const ready = { ...paidSave, heroes: paidSave.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    const result = reincarnate(ready, hero(ready).id, null)
    if (!result.ok) throw new Error(result.reason)
    expect(hero(result.save).firstClearIds).toEqual(['splintered-road', 'withered-grove'])
    expect(hero(result.save).freeUpgrades).toBe(2)
    expect(hero(result.save).clearedNodeIds).toEqual([])
    const again = { ...result.save, heroes: result.save.heroes.map((h) => ({ ...h, clearedNodeIds: GROVE_CLEARED })) }
    const againRun = finished(again, 'returned')
    const home = hero(settleExpedition(againRun, 1))
    expect(home.freeUpgrades).toBe(2)
    expect(home.purse.gold).toBe(runGold(againRun))
  })

  it('payFirstClears returns the same hero when nothing is due', () => {
    const plain = hero(withHero())
    expect(payFirstClears(plain).hero).toBe(plain)
  })

  it('pays 1 free upgrade per Echo rank first unlocked, once, and not again after reincarnation resets the rank', () => {
    const hero3 = hero(withHero({ echoRank: 3 }))
    expect(echoRewardsDue(hero3)).toEqual([1, 2, 3])
    const paid = payFirstClears(hero3).hero
    expect(paid.freeUpgrades).toBe(3 * ECHO_RANK_TOKENS)
    expect(paid.firstClearIds).toEqual(['echo:1', 'echo:2', 'echo:3'])
    expect(echoRewardsDue(paid)).toEqual([])
    expect(payFirstClears(paid).hero).toBe(paid)
    // A new life: the rank is back at 0, the ids stay, and reaching rank 3 again pays nothing.
    const again = { ...paid, echoRank: 3 }
    expect(echoRewardsDue(again)).toEqual([])
    // Only the next new rank pays.
    expect(echoRewardsDue({ ...paid, echoRank: 4 })).toEqual([4])
  })

  it('a defeat does not pay an Echo rank, and the label reads "Echo rank N"', () => {
    const save = withHero({ echoRank: 1 })
    expect(hero(settleExpedition(finished(save, 'defeat'), 1)).freeUpgrades ?? 0).toBe(0)
    expect(hero(settleExpedition(finished(save, 'returned'), 1)).freeUpgrades).toBe(ECHO_RANK_TOKENS)
    expect(firstClearLabel('echo:2', undefined)).toBe('Echo rank 2')
    expect(firstClearLabel('withered-grove', 'Withered Grove')).toBe('Withered Grove')
  })

  it('the preview equals what settle pays, and is empty for a defeat or an ongoing run', () => {
    const save = withHero({ clearedNodeIds: GROVE_CLEARED })
    const run = finished(save, 'returned')
    const preview = firstClearPreview(run)
    expect(preview.map((reward) => reward.nodeId)).toEqual(['splintered-road', 'withered-grove'])
    const settled = hero(settleExpedition(run, 1))
    expect(settled.purse.gold - runGold(run)).toBe(preview.reduce((sum, reward) => sum + reward.gold, 0))
    expect(settled.freeUpgrades).toBe(preview.length)
    expect(firstClearPreview(finished(save, 'defeat'))).toEqual([])
    expect(firstClearPreview(save)).toEqual([])
  })

  it('an old save without the fields parses and the fields round-trip', () => {
    const save = withHero()
    expect(hero(save).firstClearIds).toBeUndefined()
    expect(parseSave(serializeSave(save)).ok).toBe(true)
    const paid = settleExpedition(finished(withHero({ clearedNodeIds: GROVE_CLEARED }), 'returned'), 1)
    const parsed = parseSave(serializeSave(paid))
    if (!parsed.ok) throw new Error('parse failed')
    const back = parsed.data
    expect(hero(back).firstClearIds).toEqual(['splintered-road', 'withered-grove'])
    expect(hero(back).freeUpgrades).toBe(2)
  })

  it('rejects a bad token count or id list', () => {
    expect(() => assertSaveData(withHero({ freeUpgrades: -1 }))).toThrow()
    expect(() => assertSaveData(withHero({ freeUpgrades: 1.5 }))).toThrow()
    expect(() => assertSaveData(withHero({ firstClearIds: [3 as unknown as string] }))).toThrow()
  })
})

describe('late-zone Legacy', () => {
  it('is due only after the payout, once, and not for a node merely cleared', () => {
    const cleared = withHero({ clearedNodeIds: ['drowned-causeway'], bossLossThisLife: true })
    expect(bonusesDue(hero(cleared)).some((bonus) => bonus.id.startsWith('zone:'))).toBe(false)
    const paid = settleExpedition(finished(cleared, 'returned', 'sunken-causeway'), 1)
    const due = bonusesDue(hero(paid)).find((bonus) => bonus.id === 'zone:drowned-causeway')
    expect(due).toMatchObject({ amount: 2, text: 'First clear of the Drowned Causeway' })
    const result = reincarnate(paid, hero(paid).id, null)
    if (!result.ok) throw new Error(result.reason)
    expect(hero(result.save).claimedBonuses).toContain('zone:drowned-causeway')
    const again = { ...result.save, heroes: result.save.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    expect(bonusesDue(hero(again)).some((bonus) => bonus.id === 'zone:drowned-causeway')).toBe(false)
  })

  it('the Road, Grove, Bastion and Gate give no Legacy', () => {
    const save = withHero({ firstClearIds: ['splintered-road', 'withered-grove', 'fallen-bastion', 'fracture-gate'] })
    expect(bonusesDue(hero(save)).some((bonus) => bonus.id.startsWith('zone:'))).toBe(false)
  })
})

describe('away runs pay like live runs', () => {
  it('banks the same purse and names the zone in the report', () => {
    const save = withHero()
    const route = routes['splintered-road']!
    const ready = { ...hero(save), awayRouteId: route.id, clearedNodeIds: ['splintered-road'], repeatRoute: true, stopAfterFights: 3, pushOnHpPercent: 0 }
    const away = { ...save, lastSeenAt: 1_000_000, heroes: save.heroes.map((entry) => (entry.id === ready.id ? ready : entry)) }
    const { save: after, summary } = runOffline(away, 30 * 60_000, false)
    expect(summary.heroes[0]!.firstClears).toEqual(['Splintered Road'])
    expect(hero(after).firstClearIds).toEqual(['splintered-road'])
    expect(hero(after).freeUpgrades).toBe(1)
    expect(hero(after).purse.materials.scrap ?? 0).toBeGreaterThanOrEqual(15)
    // Same settle function: a live settle of the same state pays the same.
    const liveRun = finished({ ...away, heroes: [ready] }, 'returned', 'splintered-road')
    const live = hero(settleExpedition(liveRun, 1))
    expect(live.purse.gold).toBe(runGold(liveRun) + 180)
    expect(live.freeUpgrades).toBe(1)
  })
})
