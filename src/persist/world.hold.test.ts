import { describe, expect, it } from 'vitest'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { newSave } from './save.ts'
import { outcomeSummary, shouldHold } from './world.ts'
import type { ExpeditionState } from '../sim/expedition.ts'

function run(): ExpeditionState {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)
  if (hero === null) throw new Error('no hero')
  return startExpedition(hero, 'splintered-road', 1)
}

describe('the wait between fights', () => {
  function afterFight(): ExpeditionState {
    const expedition = run()
    expedition.phase = 'travel'
    expedition.encounterIndex = 1
    expedition.travelMs = 0
    return expedition
  }

  it('holds after a fight until the player pushes on, and never before the first fight', () => {
    const expedition = afterFight()
    expect(shouldHold(expedition, null)).toBe(true)
    expect(shouldHold(expedition, 1)).toBe(false)
    expect(shouldHold(expedition, 0)).toBe(true)
    expedition.travelMs = 500
    expect(shouldHold(expedition, null)).toBe(false)
    expedition.travelMs = 0
    expedition.encounterIndex = 0
    expect(shouldHold(expedition, null)).toBe(false)
    expedition.encounterIndex = 1
    expedition.returning = true
    expect(shouldHold(expedition, null)).toBe(false)
    expedition.returning = false
    expedition.outcome = 'defeat'
    expect(shouldHold(expedition, null)).toBe(false)
  })
})

describe('outcome summary', () => {
  it('lists loot and the retreat for a return', () => {
    const expedition = run()
    expedition.outcome = 'returned'
    expedition.history = [
      { index: 0, encounterId: 'shardling-pair', seed: 1, outcome: 'victory', durationMs: 1 },
      { index: 1, encounterId: 'wolf-pair', seed: 2, outcome: 'retreat', durationMs: 1 },
    ]
    expedition.secured = [{ materialId: 'shard', quantity: 4 }]
    expedition.overflow = 2
    const summary = outcomeSummary(expedition)
    expect(summary.title).toBe('Retreated to Greyhaven')
    expect(summary.lines).toEqual([
      'Fights won: 1.',
      'You retreated during fight 2. That fight gave no loot or momentum.',
      'Loot secured: 4 shard.',
      '2 did not fit in the bag and was lost.',
      'Momentum was cleared on arrival.',
    ])
  })

  it('lists a safe return with no retreat', () => {
    const expedition = run()
    expedition.outcome = 'returned'
    expedition.history = [{ index: 0, encounterId: 'shardling-pair', seed: 1, outcome: 'victory', durationMs: 1 }]
    expect(outcomeSummary(expedition)).toEqual({
      title: 'Returned safely',
      lines: ['Fights won: 1.', 'Loot secured: none.', 'Momentum was cleared on arrival.'],
    })
  })

  it('lists every cost of a defeat', () => {
    const expedition = run()
    expedition.outcome = 'defeat'
    expedition.history = [{ index: 0, encounterId: 'shardling-pair', seed: 1, outcome: 'defeat', durationMs: 1 }]
    expedition.secured = [{ materialId: 'hide', quantity: 4 }]
    expedition.equipment = [{ slot: 'chest', itemId: 'x', durability: 90, maxDurability: 100, disabled: false }]
    expedition.carriedGold = 0
    expedition.debt = 25
    expedition.recoveryMs = 300_000
    expedition.bossLossThisLife = true
    const summary = outcomeSummary(expedition)
    expect(summary.title).toBe('Defeated')
    expect(summary.lines).toEqual([
      'Fights won: 0.',
      'You were defeated in fight 1.',
      'All unsecured loot was destroyed, and momentum was cleared.',
      'Loot kept (already secured): 4 hide.',
      'Gear damaged: chest 90/100.',
      'Rescue fee: 25 gold. Gold you carry now: 0. Debt: 25.',
      'Recovery wait: 5 minutes.',
      'A boss defeated you this life. You can now reincarnate.',
    ])
  })
})
