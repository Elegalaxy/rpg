import { describe, expect, it } from 'vitest'

import type { CombatState } from '../../sim/types.ts'

import { countsFor } from './useFireCounts.ts'

function combatOf(heroId: string, log: unknown[]): CombatState {
  return { hero: { id: heroId }, log } as unknown as CombatState
}

const use = (actorId: string, rowIndex: number) => ({ type: 'priority', timeMs: 0, actorId, actorName: 'H', rowIndex, skillId: 'x', skillName: 'X', decision: 'use', reason: null })

describe('countsFor', () => {
  it('has no data for an empty log or for another hero', () => {
    expect(countsFor(combatOf('hero-1', []), 'hero-1')).toBeNull()
    expect(countsFor(combatOf('hero', [use('hero', 0)]), 'hero-1')).toBeNull()
  })

  it('counts the selected hero in the fight now running', () => {
    expect(countsFor(combatOf('hero-1', [use('hero-1', 0), use('hero-1', 0), use('hero-1', 2)]), 'hero-1')).toEqual({ default: [2, undefined, 1] })
  })
})
