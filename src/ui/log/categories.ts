import type { LogEvent } from '../../sim/types.ts'

/**
 * Filters match event types only. Retreat matches nothing until an escape
 * event exists. Defeat cause is death, encounter end, and the HP-loss types
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
  damageHeal: 'damage/heal',
  rolls: 'rolls',
  statuses: 'statuses',
  automation: 'automation',
  resources: 'resources',
  retreat: 'retreat',
  defeatCause: 'defeat cause',
}

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
} as const satisfies Record<LogEvent['type'], readonly LogCategory[]>

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
