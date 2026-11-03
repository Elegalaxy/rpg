import type { LogEvent } from '../../sim/types.ts'

/**
 * Filters match event types only. Retreat matches escape.
 * Defeat cause is death, encounter end, and the HP-loss types
 * `summarizeDefeat` reads: damage, statusTick, fieldTick, and hpLoss.
 */
export const LOG_CATEGORIES = [
  'damageHeal',
  'rolls',
  'statuses',
  'automation',
  'resources',
  'retreat',
  'defeatCause',
] as const

export type LogCategory = (typeof LOG_CATEGORIES)[number]

export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  damageHeal: 'Damage & healing',
  rolls: 'Hits & misses',
  statuses: 'Effects',
  automation: 'Rule choices',
  resources: 'Resources',
  retreat: 'Escapes',
  defeatCause: 'Why it ended',
}

/** One line under the filter chips that says what the chosen filter keeps. */
export const LOG_CATEGORY_HINTS: Record<LogCategory, string> = {
  damageHeal: 'Every hit, damage-over-time tick, heal, and regeneration.',
  rolls: 'Each hit roll: the chance, the roll, and whether it landed.',
  statuses: 'Poison, Burn, Stun, barriers, buffs, traps, telegraph delays, and other effects.',
  automation: 'Which rule fired on each action, and why rules above it were skipped.',
  resources: 'Fury, Readiness, Mana, Advantage, and other class resources.',
  retreat: 'Escape attempts, with the chance and the roll.',
  defeatCause: 'The damage, deaths, and result that decided the fight.',
}

export const LOG_ALL_HINT = 'Every line of the fight, oldest first.'

export const LOG_ROW_LIMIT = 500

const EVENT_CATEGORIES = {
  encounterStart: [],
  priority: ['automation'],
  rulesChanged: ['automation'],
  manual: ['automation'],
  action: ['automation'],
  hitRoll: ['rolls'],
  damage: ['damageHeal', 'defeatCause'],
  heal: ['damageHeal'],
  barrier: ['statuses'],
  barrierExpired: ['statuses'],
  buff: ['statuses'],
  buffEnded: ['statuses'],
  actionDelay: ['statuses'],
  statusAttempt: ['statuses'],
  statusTick: ['damageHeal', 'statuses', 'defeatCause'],
  statusExpired: ['statuses'],
  statusCleared: ['statuses'],
  markRefresh: ['statuses'],
  reveal: ['statuses'],
  trap: ['statuses'],
  field: ['statuses'],
  fieldTick: ['damageHeal', 'statuses', 'defeatCause'],
  fieldHeal: ['damageHeal', 'statuses'],
  fieldExpired: ['statuses'],
  hpLoss: ['damageHeal', 'defeatCause'],
  vow: ['resources'],
  resource: ['resources'],
  resourceSnapshot: ['resources'],
  wait: ['automation'],
  telegraph: [],
  stance: [],
  summon: [],
  regen: ['damageHeal'],
  skillSkip: ['automation'],
  phase: [],
  stack: [],
  encounterXp: [],
  death: ['defeatCause'],
  encounterEnd: ['defeatCause'],
  escape: ['retreat'],
  race: [],
} as const satisfies Record<LogEvent['type'], readonly LogCategory[]>

/** The colour group of a row: its first category, or `other` for telegraphs, stances, summons, and similar. */
export function rowKind(type: LogEvent['type']): LogCategory | 'other' {
  return EVENT_CATEGORIES[type][0] ?? 'other'
}

/**
 * Split the `At 9.400s, ` lead from a formatted line, so the time can sit in its own column.
 * A line without that lead is returned whole.
 */
export function splitLeadTime(text: string): { time: string | null; body: string } {
  const match = /^At (\d+(?:\.\d+)?)s, /.exec(text)
  if (match === null) return { time: null, body: text }
  const rest = text.slice(match[0].length)
  const seconds = Number(match[1])
  return { time: `${seconds.toFixed(1)}s`, body: rest.charAt(0).toUpperCase() + rest.slice(1) }
}

/** Long fractions such as roll values print with two decimals in the headline. */
function roundLong(text: string): string {
  return text.replace(/-?\d+\.\d{3,}/g, (value) => String(Number(Number(value).toFixed(2))))
}

/**
 * Split a line into a short headline and the working behind it. The headline is the first
 * sentence with long fractions rounded; the detail is the rest of the line, unrounded, shown
 * only when the row is opened. A one-sentence line has no detail beyond its exact numbers.
 */
export function splitDetail(body: string): { headline: string; detail: string | null } {
  const stop = body.indexOf('. ')
  const first = stop === -1 ? body : body.slice(0, stop + 1)
  const rest = stop === -1 ? '' : body.slice(stop + 2)
  const headline = roundLong(first)
  if (rest.length === 0) return { headline, detail: headline === body ? null : body }
  return { headline, detail: rest }
}

export function categoriesForEventType(type: LogEvent['type']): readonly LogCategory[] {
  return EVENT_CATEGORIES[type]
}

/** No selected category shows every event. Otherwise a row matches any selected category. */
export function eventMatchesCategories(type: LogEvent['type'], selected: ReadonlySet<LogCategory>): boolean {
  if (selected.size === 0) return true
  for (const category of EVENT_CATEGORIES[type]) {
    if (selected.has(category)) return true
  }
  return false
}

export type IndexedLogEvent = {
  index: number
  event: LogEvent
}

export function filterLog(log: readonly LogEvent[], selected: ReadonlySet<LogCategory>): IndexedLogEvent[] {
  const rows: IndexedLogEvent[] = []
  for (let index = 0; index < log.length; index += 1) {
    const event = log[index]
    if (event !== undefined && eventMatchesCategories(event.type, selected)) {
      rows.push({ index, event })
    }
  }
  return rows
}

export function limitLogRows<T>(rows: readonly T[], showAll: boolean): readonly T[] {
  if (showAll || rows.length <= LOG_ROW_LIMIT) return rows
  return rows.slice(rows.length - LOG_ROW_LIMIT)
}
