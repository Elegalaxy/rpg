import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import categoriesSource from './categories.ts?raw'
import logPanelSource from './LogPanel.tsx?raw'
import outcomeSource from './OutcomeCard.tsx?raw'

import { DUEL_BASIC_ID, gameDefs, setupForScenario } from '../../content/scenarios.ts'
import { createCombat, runCombat } from '../../sim/combat.ts'
import { formatEvent } from '../../sim/log.ts'
import type { CombatState, GameDefs, LogEvent } from '../../sim/types.ts'

import App from '../App.tsx'
import {
  LOG_CATEGORIES,
  LOG_CATEGORY_LABELS,
  categoriesForEventType,
  filterLog,
  limitLogRows,
} from './categories.ts'
import { LogPanel } from './LogPanel.tsx'
import { OutcomeCard } from './OutcomeCard.tsx'

const summarizeCalls = vi.hoisted(() => [] as string[])

vi.mock('../../sim/log.ts', async () => {
  const actual = await vi.importActual<typeof import('../../sim/log.ts')>('../../sim/log.ts')
  return {
    ...actual,
    summarizeDefeat(state: CombatState) {
      summarizeCalls.push(state.outcome)
      return actual.summarizeDefeat(state)
    },
  }
})

const FIGHT_MS = 60_000
const HEADING = 'RPG – dev build'
const uiSources = import.meta.glob('../*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const nestedUiSources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function decodeText(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
}

function rowTexts(html: string): string[] {
  return [...html.matchAll(/<button[^>]*class="log-row-button"[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    decodeText(match[1] ?? ''),
  )
}

function chainTexts(html: string): string[] {
  const chain = html.match(/<ol class="outcome-chain">([\s\S]*?)<\/ol>/)
  if (chain === null) return []
  return [...(chain[1] ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => decodeText(match[1] ?? ''))
}

function waits(count: number): LogEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'wait',
    timeMs: index,
    actorId: 'hero',
    actorName: 'Hero',
    reason: `reason-${index}`,
  }))
}

function lethalDefs(): GameDefs {
  const defs = gameDefs()
  const defId = setupForScenario(DUEL_BASIC_ID).enemies[0]?.defId
  if (defId === undefined) throw new Error('duel-basic has no enemy')
  const enemy = defs.enemies[defId]
  if (enemy === undefined) throw new Error(`missing enemy ${defId}`)
  return {
    ...defs,
    enemies: {
      ...defs.enemies,
      [defId]: {
        ...enemy,
        overrides: { ...enemy.overrides, power: 50_000, maxHp: 1_000_000 },
      },
    },
  }
}

function finished(seed: number, maxMs: number, defs = gameDefs()): CombatState {
  return runCombat(createCombat(setupForScenario(DUEL_BASIC_ID), defs, seed), defs, maxMs)
}

beforeEach(() => {
  summarizeCalls.length = 0
})

describe('log panel', () => {
  it('renders formatEvent text for the last 500 filtered rows', () => {
    const log = waits(501)
    const html = renderToStaticMarkup(<LogPanel log={log} />)
    const texts = rowTexts(html)
    const expected = limitLogRows(log, false).map((event) => formatEvent(event))
    console.log('[ui]', 'log panel window', {
      total: log.length,
      rendered: texts.length,
      first: texts[0],
      last: texts[texts.length - 1],
      showAllPressed: html.includes('aria-pressed="true">Show all'),
      followChecked: html.includes('checked'),
    })

    expect(texts).toEqual(expected)
    expect(texts).toHaveLength(500)
    expect(texts[0]).toBe(formatEvent(log[1]!))
    expect(texts[499]).toBe(formatEvent(log[500]!))
    expect(html).toContain('Showing 500 of 501')
    expect(html).toContain('>Show all<')
    expect(html).not.toContain('aria-pressed="true">Show all')
    expect(html).toContain('Follow')
    expect(html).toContain('aria-label="Log"')
    expect(html).toContain('aria-label="Combat log"')
    expect(summarizeCalls).toEqual([])

    const exact = waits(500)
    expect(rowTexts(renderToStaticMarkup(<LogPanel log={exact} />))).toEqual(exact.map((event) => formatEvent(event)))
    const empty = renderToStaticMarkup(<LogPanel log={[]} />)
    expect(empty).toContain('No matching events.')
    expect(empty).toContain('Showing 0 of 0')
    expect(rowTexts(empty)).toEqual([])
  })

  it('uses one sentence formatter', () => {
    const sources = [logPanelSource, outcomeSource, categoriesSource]
    const localFormatters = sources.flatMap((source) =>
      [...source.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map((match) => match[1] ?? ''),
    )
    console.log('[ui]', 'log formatters', { functions: localFormatters })
    expect(sources.join('\n')).toContain('formatEvent(')
    expect(sources.join('\n')).not.toContain('At ${')
    expect(localFormatters.filter((name) => /format|sentence|describe/i.test(name))).toEqual([])
  })
})

describe('log filters', () => {
  it('shows every event with no selection, matches no retreat event, and hides other types', () => {
    const victory = finished(42, FIGHT_MS)
    const end = victory.log[victory.log.length - 1]
    expect(victory.outcome).toBe('victory')
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 20_688 })

    const labels = LOG_CATEGORIES.map((category) => LOG_CATEGORY_LABELS[category])
    const present = [...new Set(victory.log.map((event) => event.type))]
    const retreatTypes = present.filter((type) => categoriesForEventType(type).includes('retreat'))
    const all = filterLog(victory.log, new Set())
    const retreated = filterLog(victory.log, new Set(['retreat']))
    const rolls = filterLog(victory.log, new Set(['rolls']))
    const damage = filterLog(victory.log, new Set(['damageHeal']))
    console.log('[ui]', 'log filter sample', {
      events: victory.log.length,
      labels,
      present,
      retreatTypes,
      retreated: retreated.length,
      rolls: rolls.map((row) => row.event.type),
      damage: [...new Set(damage.map((row) => row.event.type))],
    })

    expect(labels).toEqual([
      'damage/heal',
      'rolls',
      'statuses',
      'automation',
      'resources',
      'retreat',
      'defeat cause',
    ])
    expect(LOG_CATEGORIES).toContain('retreat')
    expect(retreatTypes).toEqual([])
    expect(all.map((row) => row.event)).toEqual(victory.log)
    expect(retreated).toEqual([])
    expect(victory.log).toHaveLength(all.length)
    expect(rolls.length).toBeGreaterThan(0)
    expect(rolls.every((row) => row.event.type === 'hitRoll')).toBe(true)
    expect(damage.some((row) => row.event.type === 'hitRoll')).toBe(false)
    expect(damage.every((row) => categoriesForEventType(row.event.type).includes('damageHeal'))).toBe(true)
    for (const row of damage) expect(row.event).toBe(victory.log[row.index])
    const hidden = victory.log.filter((event) => !damage.some((row) => row.event === event))
    expect(hidden.length).toBeGreaterThan(0)
    for (const event of hidden) expect(categoriesForEventType(event.type)).not.toContain('damageHeal')

    const html = renderToStaticMarkup(<LogPanel log={victory.log} />)
    expect(rowTexts(html)).toEqual(limitLogRows(victory.log, false).map((event) => formatEvent(event)))
    for (const label of labels) expect(html).toContain(`>${label}<`)
  })
})

describe('outcome card', () => {
  it('stays hidden while the fight is ongoing', () => {
    const combat = createCombat(setupForScenario(DUEL_BASIC_ID), gameDefs(), 42)
    expect(combat.outcome).toBe('ongoing')
    const html = renderToStaticMarkup(<OutcomeCard combat={combat} />)
    console.log('[ui]', 'outcome ongoing', { html, summarizeCalls })
    expect(html).toBe('')
    expect(summarizeCalls).toEqual([])
  })

  it('shows victory and timeout without summarizeDefeat', () => {
    const victory = finished(42, FIGHT_MS)
    const timeout = finished(42, 10)
    expect(victory.outcome).toBe('victory')
    expect(timeout.outcome).toBe('timeout')
    const victoryEnd = victory.log.findLast((event) => event.type === 'encounterEnd')
    const timeoutEnd = timeout.log.findLast((event) => event.type === 'encounterEnd')
    if (victoryEnd === undefined || timeoutEnd === undefined) throw new Error('finished fight has no encounter end')

    const victoryHtml = renderToStaticMarkup(<OutcomeCard combat={victory} />)
    const timeoutHtml = renderToStaticMarkup(<OutcomeCard combat={timeout} />)
    console.log('[ui]', 'outcome finished', {
      victory: victoryHtml,
      timeout: timeoutHtml,
      summarizeCalls,
    })

    expect(victoryHtml).toContain('<h2>victory</h2>')
    expect(victoryHtml).toContain(formatEvent(victoryEnd))
    expect(victoryHtml).toContain('aria-label="Outcome"')
    expect(victoryHtml).not.toContain('Cause chain')
    expect(timeoutHtml).toContain('<h2>timeout</h2>')
    expect(timeoutHtml).toContain(formatEvent(timeoutEnd))
    expect(timeoutHtml).not.toContain('Cause chain')
    expect(summarizeCalls).toEqual([])
  })

  it('shows the defeat HP-loss chain from summarizeDefeat and formatEvent', async () => {
    const defs = lethalDefs()
    const combat = finished(42, FIGHT_MS, defs)
    expect(combat.outcome).toBe('defeat')
    const actual = await vi.importActual<typeof import('../../sim/log.ts')>('../../sim/log.ts')
    const summary = actual.summarizeDefeat(combat)
    const html = renderToStaticMarkup(<OutcomeCard combat={combat} />)
    console.log('[ui]', 'outcome defeat', {
      losses: summary.hpLoss.map((event) => event.type),
      lines: chainTexts(html),
      summarizeCalls,
    })

    expect(summary.hpLoss.length).toBeGreaterThan(0)
    expect(chainTexts(html)).toEqual(summary.hpLoss.map((event) => formatEvent(event)))
    expect(html).toContain('<h2>defeat</h2>')
    expect(html).toContain('Cause chain')
    expect(html).toContain('Hero statuses')
    expect(summarizeCalls).toEqual(['defeat'])
  })
})

describe('app shell', () => {
  it('mounts the log under the heading, playback controls, and combat panel', () => {
    const html = renderToStaticMarkup(<App />)
    const headingAt = html.indexOf(HEADING)
    const controlsAt = html.indexOf('>Restart<')
    const combatAt = html.indexOf('aria-label="Combat"')
    const logAt = html.indexOf('aria-label="Log"')
    console.log('[ui]', 'app shell', {
      heading: HEADING,
      dash: HEADING.codePointAt(4)?.toString(16),
      headingAt,
      controlsAt,
      combatAt,
      logAt,
      summarizeCalls,
    })

    expect(HEADING.codePointAt(4)).toBe(0x2013)
    expect(html).toContain(`<h1>${HEADING}</h1>`)
    expect(html).toContain('>Restart<')
    expect(html).toContain('>New seed<')
    expect(html).toContain('>Pause<')
    expect(html).toContain('>1×<')
    expect(html).toContain('>2×<')
    expect(html).toContain('>4×<')
    expect(combatAt).toBeGreaterThan(controlsAt)
    expect(logAt).toBeGreaterThan(combatAt)
    expect(html).not.toContain('outcome-card')
    expect(summarizeCalls).toEqual([])

    const harnessImports: string[] = []
    const sources = { ...uiSources, ...nestedUiSources }
    for (const [file, text] of Object.entries(sources)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
      if (typeof text !== 'string') throw new Error(`ui source for ${file} was not text`)
      for (const match of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
        const spec = match[1] ?? ''
        if (spec.includes('harness')) harnessImports.push(`${file} -> ${spec}`)
      }
    }
    expect(harnessImports).toEqual([])
  })
})
