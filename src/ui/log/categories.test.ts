import { describe, expect, it } from 'vitest'

import type { LogEvent } from '../../sim/types.ts'

import {
  LOG_CATEGORIES,
  LOG_ROW_LIMIT,
  type LogCategory,
  categoriesForEventType,
  eventMatchesCategories,
  limitLogRows,
  rowKind,
  splitDetail,
  splitLeadTime,
} from './categories.ts'

const EXPECTED: Record<LogEvent['type'], readonly LogCategory[]> = {
  encounterStart: [],
  priority: ['automation'],
  rulesChanged: ['automation'],
  manual: ['automation'],
  action: ['automation'],
  hitRoll: ['rolls'],
  damage: ['damage', 'defeatCause'],
  heal: ['healing'],
  barrier: ['statuses'],
  barrierExpired: ['statuses'],
  buff: ['statuses'],
  buffEnded: ['statuses'],
  actionDelay: ['statuses'],
  statusAttempt: ['statuses'],
  statusTick: ['damage', 'statuses', 'defeatCause'],
  statusExpired: ['statuses'],
  statusCleared: ['statuses'],
  markRefresh: ['statuses'],
  reveal: ['statuses'],
  trap: ['statuses'],
  field: ['statuses'],
  fieldTick: ['damage', 'statuses', 'defeatCause'],
  fieldHeal: ['healing', 'statuses'],
  fieldExpired: ['statuses'],
  hpLoss: ['damage', 'defeatCause'],
  vow: ['resources'],
  resource: ['resources'],
  resourceSnapshot: ['resources'],
  wait: ['automation'],
  telegraph: [],
  stance: [],
  summon: [],
  regen: ['healing'],
  skillSkip: ['automation'],
  phase: [],
  stack: [],
  encounterXp: [],
  death: ['defeatCause'],
  encounterEnd: ['defeatCause'],
  escape: ['retreat'],
  race: [],
  skillDodge: ['statuses'],
  supplyUse: ['items'],
}

const DEFEAT_CAUSE_TYPES = ['damage', 'statusTick', 'fieldTick', 'hpLoss', 'death', 'encounterEnd'] as const

describe('log categories', () => {
  it('maps each event type and matches retreat to escape', () => {
    const types = Object.keys(EXPECTED) as LogEvent['type'][]
    const retreatTypes = types.filter((type) => EXPECTED[type].includes('retreat'))
    const defeatTypes = types.filter((type) => EXPECTED[type].includes('defeatCause'))
    console.log('[ui]', 'log categories', {
      types: types.length,
      categories: LOG_CATEGORIES,
      retreatTypes,
      defeatTypes,
    })

    expect(LOG_CATEGORIES).toContain('retreat')
    expect(retreatTypes).toEqual(['escape'])
    expect(defeatTypes).toEqual([...DEFEAT_CAUSE_TYPES])

    for (const category of LOG_CATEGORIES) {
      const users = types.filter((type) => EXPECTED[type].includes(category))
      if (category === 'retreat') expect(users).toEqual(['escape'])
      else expect(users.length).toBeGreaterThan(0)
    }

    for (const type of types) {
      expect(categoriesForEventType(type)).toEqual(EXPECTED[type])
      expect(eventMatchesCategories(type, new Set())).toBe(true)
      expect(eventMatchesCategories(type, new Set(['retreat']))).toBe(type === 'escape')
    }

    expect(eventMatchesCategories('hitRoll', new Set(['rolls']))).toBe(true)
    expect(eventMatchesCategories('hitRoll', new Set(['damage']))).toBe(false)
    expect(eventMatchesCategories('damage', new Set(['defeatCause']))).toBe(true)
    expect(eventMatchesCategories('damage', new Set(['rolls']))).toBe(false)
    expect(eventMatchesCategories('priority', new Set(['automation', 'retreat']))).toBe(true)
    expect(eventMatchesCategories('statusTick', new Set(['statuses']))).toBe(true)
    expect(eventMatchesCategories('encounterStart', new Set(['automation']))).toBe(false)
    expect(eventMatchesCategories('encounterEnd', new Set(['defeatCause']))).toBe(true)
  })

  it('renders the last 500 filtered rows unless show all is on', () => {
    const rows = Array.from({ length: LOG_ROW_LIMIT + 1 }, (_, index) => index)
    const limited = limitLogRows(rows, false)
    console.log('[ui]', 'log row window', {
      total: rows.length,
      limited: limited.length,
      first: limited[0],
      last: limited[limited.length - 1],
    })
    expect(limited).toEqual(rows.slice(rows.length - LOG_ROW_LIMIT))
    expect(limited).toHaveLength(LOG_ROW_LIMIT)
    expect(limitLogRows(rows, true)).toBe(rows)
    const exact = rows.slice(0, LOG_ROW_LIMIT)
    expect(limitLogRows(exact, false)).toBe(exact)
  })
})

describe('log row text', () => {
  it('moves the time lead to its own column and keeps the working out of the headline', () => {
    const line = 'At 1.600s, Shardling deals 5 physical damage to Tester (HP 155 to 150). Power 7 × 1 = 7; roll 0.8791429815813899.'
    const { time, body } = splitLeadTime(line)
    expect(time).toBe('1.6s')
    expect(body).toBe('Shardling deals 5 physical damage to Tester (HP 155 to 150). Power 7 × 1 = 7; roll 0.8791429815813899.')
    expect(splitDetail(body)).toEqual({
      headline: 'Shardling deals 5 physical damage to Tester (HP 155 to 150).',
      detail: 'Power 7 × 1 = 7; roll 0.8791429815813899.',
    })
    const roll = splitDetail('Shardling hit roll 0.6136190716642886 against 0.78 (Accuracy 13, Evasion 10): hit.')
    expect(roll).toEqual({
      headline: 'Shardling hit roll 0.61 against 0.78 (Accuracy 13, Evasion 10): hit.',
      detail: 'Shardling hit roll 0.6136190716642886 against 0.78 (Accuracy 13, Evasion 10): hit.',
    })
    expect(splitDetail('Encounter ended: victory.')).toEqual({ headline: 'Encounter ended: victory.', detail: null })
    expect(splitLeadTime('no lead')).toEqual({ time: null, body: 'no lead' })
    expect(rowKind('damage')).toBe('damage')
    expect(rowKind('telegraph')).toBe('other')
  })
})
