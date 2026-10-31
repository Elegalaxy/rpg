import { describe, expect, it } from 'vitest'

import { referenceHeroAtLevel } from '../content/heroes.ts'
import { deriveSeed } from '../sim/rng.ts'
import { deriveHeroStats } from '../sim/stats.ts'

import { comboPairs, comboSeed, runComboFight } from './combos.ts'

describe('combo matrix', () => {
  it('runs one fight for each of the 20 race and class pairs', () => {
    const pairs = comboPairs()
    expect(pairs).toHaveLength(20)
    expect(comboSeed(1, 0, 50, 0)).toBe(deriveSeed(1, 0))
    expect(comboSeed(1, 3, 50, 4)).toBe(deriveSeed(1, 3 * 50 + 4))
    for (const pair of pairs) {
      const reference = referenceHeroAtLevel(pair.classId, 10)
      const seed = comboSeed(1, pair.pairIndex, 1, 0)
      const state = runComboFight(pair, seed)
      const raceEvents = state.log.filter((event) => event.type === 'race')
      const end = state.log[state.log.length - 1]
      console.log('[sim]', 'combo', {
        race: pair.race,
        classId: pair.classId,
        pairIndex: pair.pairIndex,
        seed,
        outcome: state.outcome,
        raceEvents: raceEvents.length,
        durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
      })
      expect(raceEvents.length).toBeGreaterThan(0)
      const derived = deriveHeroStats({
        level: reference.level,
        classId: pair.classId,
        attributes: reference.attributes,
        gear: reference.gear,
      })
      const enemy = state.enemies[0]
      expect(state.hero.race).toBe(pair.race)
      expect(state.hero.level).toBe(10)
      expect(enemy?.defId).toBe('dummy-standard-20')
      expect(enemy?.name).toBe('Standard Dummy')
      expect(enemy?.archetype).toBe('standard')
      expect(enemy?.level).toBe(10)
      expect(state.hero.physicalPower).toBe(derived.physicalPower)
      expect(state.hero.critDamage).toBe(derived.critDamage)
      expect(state.hero.spirit).toBe(reference.attributes.spirit)
      expect(state.hero.agility).toBe(reference.attributes.agility)
      expect(state.hero.vitality).toBe(reference.attributes.vitality)
      expect(state.hero.intellect).toBe(reference.attributes.intellect)
    }
  }, 180_000)
})
