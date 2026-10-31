import { describe, expect, it } from 'vitest'

import { gameDefs, setupForScenario, WARRIOR_VS_WARDEN_ID } from '../content/scenarios.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS } from './batch.ts'

const RUNS = 40

type Summary = { wins: number; wardenLeft: number; survivedMs: number }

/** Average over many seeds: wins, the Warden's HP fraction left at the end, and how long the hero lasted. */
function fightWarden(setup: CombatSetup): Summary {
  const defs = gameDefs()
  let wins = 0
  let left = 0
  let survived = 0
  for (let run = 0; run < RUNS; run += 1) {
    const state = runCombat(createCombat(setup, defs, deriveSeed(11, run)), defs, HARNESS_LIMIT_MS)
    if (state.outcome === 'victory') wins += 1
    const warden = state.enemies[0]
    left += warden === undefined ? 0 : warden.hp / warden.maxHp
    survived += state.timeMs
  }
  return { wins, wardenLeft: left / RUNS, survivedMs: survived / RUNS }
}

/** The same reference Warrior with a second life's Attribute Seeds on top. */
function secondLife(seeds: { strength: number; vitality: number }): CombatSetup {
  const setup = setupForScenario(WARRIOR_VS_WARDEN_ID)
  return {
    ...setup,
    hero: {
      ...setup.hero,
      attributes: {
        ...setup.hero.attributes,
        strength: setup.hero.attributes.strength + seeds.strength,
        vitality: setup.hero.attributes.vitality + seeds.vitality,
      },
    },
  }
}

describe('first life against the Warden compared with a second life', () => {
  it('does measurably better with ten Attribute Seeds', () => {
    const first = fightWarden(setupForScenario(WARRIOR_VS_WARDEN_ID))
    const second = fightWarden(secondLife({ strength: 5, vitality: 5 }))
    console.log('[sim]', 'warden first life', first, 'second life', second)
    expect(second.wardenLeft).toBeLessThan(first.wardenLeft)
    expect(second.survivedMs).toBeGreaterThan(first.survivedMs)
    expect(second.wins).toBeGreaterThanOrEqual(first.wins)
  }, 240_000)

  it('does better again with more seeds, so the purchase keeps paying', () => {
    const some = fightWarden(secondLife({ strength: 3, vitality: 2 }))
    const all = fightWarden(secondLife({ strength: 5, vitality: 5 }))
    expect(all.wardenLeft).toBeLessThanOrEqual(some.wardenLeft)
  }, 240_000)
})
