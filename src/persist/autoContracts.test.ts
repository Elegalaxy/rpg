import { describe, expect, it } from 'vitest'

import { contracts as contractTable } from '../content/contracts.ts'

import { autoContractsStep, contractFitsRoute } from './autoContracts.ts'
import { selectedHero } from './character.ts'
import { runOffline } from './offline.ts'
import { createHero } from './roster.ts'
import { newSave, type SaveData, type SavedHero } from './save.ts'
import { beginExpedition } from './world.ts'

// Auto run contracts at home (Step 13.26, GAME_DESIGN §11 "Auto run contracts").

const wolves = contractTable['cull-the-pack']!
const grove = contractTable['thicket-sweep']!
const deserters = contractTable['hunt-deserters']!

function base(change: Partial<SavedHero> = {}, offers = [wolves, grove], active: { contractId: string; progress: number }[] = []): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  return {
    ...made.save,
    heroes: made.save.heroes.map((hero) => ({
      ...hero,
      autoRun: true,
      autoContracts: true,
      progress: { ...hero.progress, level: 40, attributes },
      purse: { ...hero.purse, board: [...offers], contracts: active },
      ...change,
    })),
  }
}

const purse = (save: SaveData) => selectedHero(save)!.purse

describe('which contracts fit a route', () => {
  it('matches by enemy, node, elite encounter and resource', () => {
    expect(contractFitsRoute(wolves, 'splintered-road')).toBe(true)
    expect(contractFitsRoute(grove, 'splintered-road')).toBe(false)
    expect(contractFitsRoute(contractTable['break-the-elite']!, 'splintered-road')).toBe(false)
    expect(contractFitsRoute(contractTable['bastion-patrol']!, 'nope')).toBe(false)
  })
})

describe('the shared step', () => {
  it('collects a finished contract and takes a fitting offer, not an unrelated one', () => {
    const save = base({}, [wolves, grove, deserters], [{ contractId: wolves.id, progress: wolves.count }])
    const result = autoContractsStep(save, 'splintered-road')
    expect(result.handedIn).toBe(1)
    expect(selectedHero(result.save)!.purse.gold).toBeGreaterThan(selectedHero(save)!.purse.gold)
    const active = purse(result.save).contracts.map((entry) => entry.contractId)
    expect(active).not.toContain(grove.id)
    expect(result.taken).toBe(active.length)
    expect(purse(result.save).contracts.every((entry) => contractFitsRoute(purse(result.save).board.find((offer) => offer.id === entry.contractId) ?? wolves, 'splintered-road'))).toBe(true)
  })

  it('takes nothing with three active, with the toggle off, or with a run open', () => {
    const full = [{ contractId: 'a', progress: 0 }, { contractId: 'b', progress: 0 }, { contractId: 'c', progress: 0 }]
    expect(autoContractsStep(base({}, [wolves], full), 'splintered-road').taken).toBe(0)
    const off = base({ autoContracts: false }, [wolves])
    expect(autoContractsStep(off, 'splintered-road')).toEqual({ save: off, handedIn: 0, taken: 0 })
    const open = beginExpedition(base({}, [wolves]), 'splintered-road', 1)
    if (!open.ok) throw new Error(open.reason)
    expect(autoContractsStep(open.save, 'splintered-road').taken).toBe(0)
  })

  it('does not take a contract that is already active', () => {
    const save = base({}, [wolves], [{ contractId: wolves.id, progress: 1 }])
    expect(autoContractsStep(save, 'splintered-road').taken).toBe(0)
  })
})

describe('away replay', () => {
  function run(change: Partial<SavedHero>): SaveData {
    const begun = beginExpedition(base({ pushOnHpPercent: 100, stopAfterFights: 1, repeatRoute: false, ...change }, [wolves, grove]), 'splintered-road', 5)
    if (!begun.ok) throw new Error(begun.reason)
    return begun.save
  }

  it('takes a fitting contract at each return when on, and nothing when off', () => {
    const on = runOffline(run({}), 10 * 60_000, true)
    expect(on.summary.heroes[0]!.contractsTaken).toBeGreaterThan(0)
    const off = runOffline(run({ autoContracts: false }), 10 * 60_000, true)
    expect(off.summary.heroes[0]!.contractsTaken).toBeUndefined()
    expect(purse(off.save).contracts).toHaveLength(0)
  })

  it('does nothing after a defeat', () => {
    const save = run({})
    const expedition = save.expedition!
    expedition.retreatThresholds = []
    expedition.heroTemplate.attributes = { strength: 1, vitality: 1, agility: 1, intellect: 1, spirit: 1 }
    expedition.hero.maxHp = 20
    expedition.hero.hp = 1
    const away = runOffline(save, 60 * 60_000, true)
    expect(away.summary.heroes[0]!.stopped).toBe('defeat')
    expect(away.summary.heroes[0]!.contractsTaken).toBeUndefined()
  })
})
