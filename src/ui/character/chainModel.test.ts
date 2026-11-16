import { describe, expect, it } from 'vitest'

import { selectedHero } from '../../persist/character.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import type { LogEvent } from '../../sim/types.ts'

import { buildChain, fallbackText, fireCount, ruleFireCounts, stackFireTotal } from './chainModel.ts'

function warrior() {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)
  if (hero === null) throw new Error('no hero')
  return hero
}

const hp = (value: string) => ({ type: 'heroHp' as const, operator: 'atMost', value, statusId: '' })
const ready = { skillId: 'driving-blow', conditions: [], targetPriority: '' as const }

describe('buildChain', () => {
  it('describes rules, always-ready rows and the class fallback', () => {
    const rows = [{ skillId: 'second-wind', conditions: [hp('40')], targetPriority: '' as const }, ready, { skillId: '', conditions: [], targetPriority: '' as const }]
    const chain = buildChain(warrior(), rows, [])
    expect(chain.router).toEqual([])
    expect(chain.rules.map((rule) => rule.alwaysReady)).toEqual([false, true, false])
    expect(chain.rules[0]!.title).toBe('Second Wind')
    expect(chain.rules[2]).toMatchObject({ blank: true, title: 'No skill yet' })
    expect(chain.fallback).toBe('Weapon basic attack')
    expect(fallbackText('mage')).toContain('Arcane Bolt')
  })

  it('marks a later same-skill row as shadowed by an earlier unconditional row', () => {
    const chain = buildChain(warrior(), [ready, { ...ready, conditions: [hp('50')] }], [])
    expect(chain.rules[0]!.shadowedBy).toBeNull()
    expect(chain.rules[1]!.shadowedBy).toBe(1)
    const other = buildChain(warrior(), [{ ...ready, targetPriority: 'lowestArmor' }, ready], [])
    expect(other.rules[1]!.shadowedBy).toBeNull()
    expect(other.rules[0]!.target).toBe('Lowest Armor')
  })

  it('lists the router in stack order with Auto or manual-only', () => {
    const stacks = [
      { id: 'stack-1', name: 'Group', when: [{ type: 'enemyCount' as const, operator: 'atLeast', value: '2', statusId: '' }], rows: [] },
      { id: 'stack-2', name: 'Hand', when: [], rows: [] },
    ]
    const chain = buildChain(warrior(), [], stacks)
    expect(chain.router.map((entry) => [entry.name, entry.auto])).toEqual([
      ['Group', true],
      ['Hand', false],
    ])
    expect(chain.router[1]!.trigger).toBe('Picked by hand only')
  })
})

describe('ruleFireCounts', () => {
  const use = (rowIndex: number, timeMs: number): LogEvent =>
    ({ type: 'priority', timeMs, actorId: 'hero', actorName: 'H', rowIndex, skillId: 'x', skillName: 'X', decision: 'use', reason: null }) as LogEvent
  const skip = { type: 'priority', timeMs: 5, actorId: 'hero', actorName: 'H', rowIndex: 0, skillId: 'x', skillName: 'X', decision: 'skip', reason: 'r' } as LogEvent
  const change = (toId: string): LogEvent =>
    ({ type: 'stackChanged', timeMs: 1, actorId: 'hero', actorName: 'H', fromId: 'default', fromName: 'Default', toId, toName: toId, reason: 'trigger', detail: null }) as LogEvent

  it('counts only used rows and attributes them to the active stack', () => {
    const counts = ruleFireCounts([use(0, 0), skip, use(1, 10), change('stack-1'), use(0, 20), use(0, 30), change('default'), use(0, 40)])
    expect(counts.default).toEqual([2, 1])
    expect(counts['stack-1']).toEqual([2])
    expect(fireCount(counts, 'default', 1)).toBe(1)
    expect(fireCount(counts, 'default', 5)).toBe(0)
    expect(stackFireTotal(counts, 'stack-1')).toBe(2)
  })

  it('has no data without a log', () => {
    expect(fireCount(null, 'default', 0)).toBeNull()
    expect(stackFireTotal(null, 'default')).toBeNull()
    expect(ruleFireCounts([])).toEqual({})
  })

  it('limits the count to one hero', () => {
    const other = { ...use(0, 0), actorId: 'someone' } as LogEvent
    expect(ruleFireCounts([other, use(0, 1)], 'hero').default).toEqual([1])
  })
})
