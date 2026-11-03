import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup, PriorityRow } from '../sim/types.ts'

import { HARNESS_LIMIT_MS } from './batch.ts'
import { builtSetup } from './builds.ts'

const RUNS = 60

function winRate(setup: CombatSetup): number {
  const defs = gameDefs()
  let wins = 0
  for (let index = 0; index < RUNS; index += 1) {
    const state = runCombat(createCombat(setup, defs, deriveSeed(1, index)), defs, HARNESS_LIMIT_MS)
    if (state.outcome === 'victory') wins += 1
  }
  return wins / RUNS
}

/** Same build, same enemy: only the priority rules differ. */
describe('rule quality changes the result against an elite', () => {
  it('a Warrior who drops the wasteful Shield Brace rule and keeps Expose up beats the reference rules against the Rootmaw', () => {
    const naive = builtSetup('ref-warrior-rootmaw', 'warrior', 0)
    // The reference rules brace on any telegraph, which spends actions on a skill the Rootmaw barely needs.
    // Expose halves its regeneration, so the tuned rules refresh it and otherwise just hit.
    const tunedRows: PriorityRow[] = [
      { skillId: 'second-wind', conditions: [{ kind: 'hpPercent', who: 'hero', operator: 'atMost', value: 40 }] },
      { skillId: 'sundering-blow', conditions: [{ kind: 'status', who: 'target', statusId: 'expose', measure: 'presence', operator: 'absent' }] },
      { skillId: 'driving-blow' },
    ]
    const tuned = { ...naive, hero: { ...naive.hero, priorityRows: tunedRows } }
    const before = winRate(naive)
    const after = winRate(tuned)
    console.log('[sim]', 'warrior vs rootmaw, reference rules', before, 'tuned rules', after)
    expect(after - before).toBeGreaterThanOrEqual(0.15)
  }, 240_000)

  it('careless rules can lose a fight the reference rules win', () => {
    const naive = builtSetup('ref-mage-echo-knight', 'mage', 0)
    const careless: PriorityRow[] = [
      { skillId: 'mana-ward', conditions: [{ kind: 'telegraph', tag: 'fractured-charge', operator: 'atMost', value: 1500 }] },
      { skillId: 'fireball', conditions: [{ kind: 'status', who: 'target', statusId: 'burn', measure: 'presence', operator: 'absent' }] },
      { skillId: 'frost-lance' },
    ]
    const poor = { ...naive, hero: { ...naive.hero, priorityRows: careless } }
    expect(winRate(naive) - winRate(poor)).toBeGreaterThanOrEqual(0.5)
  }, 240_000)
})
