import { useLayoutEffect, useRef, useState } from 'react'

import type { LogEvent } from '../../sim/types.ts'
import { formatEvent } from '../../sim/log.ts'

import { debugLog } from '../debug.ts'
import {
  LOG_CATEGORIES,
  LOG_CATEGORY_LABELS,
  type LogCategory,
  filterLog,
  limitLogRows,
} from './categories.ts'
import './log.css'

function selectedNames(selected: ReadonlySet<LogCategory>): LogCategory[] {
  return LOG_CATEGORIES.filter((category) => selected.has(category))
}

export function LogPanel({ log }: { log: readonly LogEvent[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  const [selected, setSelected] = useState<ReadonlySet<LogCategory>>(() => new Set())
  const [follow, setFollow] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const filtered = filterLog(log, selected)
  const visible = limitLogRows(filtered, showAll)
  const tail = visible.length === 0 ? -1 : (visible[visible.length - 1]?.index ?? -1)

  useLayoutEffect(() => {
    if (!follow) return
    const list = listRef.current
    if (list === null) return
    list.scrollTop = list.scrollHeight
  }, [follow, showAll, tail, visible.length])

  function toggleCategory(category: LogCategory): void {
    const next = new Set(selected)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    const matched = filterLog(log, next).length
    debugLog('[ui]', 'log filter', {
      category,
      selected: selectedNames(next),
      matched,
      total: log.length,
    })
    setSelected(next)
  }

  function toggleFollow(): void {
    const next = !follow
    debugLog('[ui]', 'log follow', { follow: next })
    setFollow(next)
  }

  function toggleShowAll(): void {
    const next = !showAll
    debugLog('[ui]', 'log show all', { showAll: next, filtered: filtered.length })
    setShowAll(next)
  }

  function toggleRow(index: number, event: LogEvent): void {
    const expanded = expandedIndex !== index
    debugLog('[ui]', 'log row', { index, type: event.type, timeMs: event.timeMs, expanded })
    setExpandedIndex(expanded ? index : null)
  }

  return (
    <section className="log-panel" aria-label="Log">
      <h2>Log</h2>
      <div className="log-controls" role="group" aria-label="Log categories">
        {LOG_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={selected.has(category)}
            onClick={() => toggleCategory(category)}
          >
            {LOG_CATEGORY_LABELS[category]}
          </button>
        ))}
        <label className="log-follow">
          <input type="checkbox" checked={follow} onChange={toggleFollow} /> Follow
        </label>
        <button type="button" aria-pressed={showAll} onClick={toggleShowAll}>
          Show all
        </button>
        <p className="log-count">
          Showing {visible.length} of {filtered.length}
        </p>
      </div>
      {visible.length === 0 ? <p>No matching events.</p> : null}
      <ol className="log-list" ref={listRef} aria-label="Combat log">
        {visible.map(({ index, event }) => {
          const expanded = expandedIndex === index
          return (
            <li key={index} className="log-row" data-expanded={expanded ? 'true' : 'false'}>
              <button type="button" className="log-row-button" aria-expanded={expanded} onClick={() => toggleRow(index, event)}>
                {formatEvent(event)}
              </button>
              {expanded ? <pre className="log-payload">{JSON.stringify(event, null, 2)}</pre> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
