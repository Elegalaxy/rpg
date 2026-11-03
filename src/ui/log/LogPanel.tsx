import { useId, useLayoutEffect, useRef, useState } from 'react'

import type { LogEvent } from '../../sim/types.ts'
import { formatEvent } from '../../sim/log.ts'

import { debugLog } from '../debug.ts'
import {
  LOG_ALL_HINT,
  LOG_CATEGORIES,
  LOG_CATEGORY_HINTS,
  LOG_CATEGORY_LABELS,
  type LogCategory,
  filterLog,
  limitLogRows,
  rowKind,
  splitDetail,
  splitLeadTime,
} from './categories.ts'
import './log.css'

/**
 * The combat log. One filter at a time (Everything by default), a time column, and a colour stripe
 * per kind of line. Each row shows its first sentence; opening it shows the working and the raw event. Only the newest 500 matching lines are drawn until the player asks for older ones.
 */
export function LogPanel({ log }: { log: readonly LogEvent[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  const name = useId()
  const [category, setCategory] = useState<LogCategory | null>(null)
  const [follow, setFollow] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const filtered = filterLog(log, category === null ? new Set() : new Set([category]))
  const visible = limitLogRows(filtered, showAll)
  const hidden = filtered.length - visible.length
  const tail = visible.length === 0 ? -1 : (visible[visible.length - 1]?.index ?? -1)

  useLayoutEffect(() => {
    if (!follow) return
    const list = listRef.current
    if (list === null) return
    list.scrollTop = list.scrollHeight
  }, [follow, showAll, tail, visible.length])

  function choose(next: LogCategory | null): void {
    const matched = filterLog(log, next === null ? new Set() : new Set([next])).length
    debugLog('[ui]', 'log filter', { category: next, matched, total: log.length })
    setCategory(next)
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

  const count =
    hidden > 0
      ? `Newest ${visible.length} of ${filtered.length} lines`
      : `${filtered.length} ${filtered.length === 1 ? 'line' : 'lines'}`

  return (
    <section className="log-panel" aria-label="Log">
      <div className="log-head">
        <h2>Log</h2>
        <label className="log-follow" title="Keep the newest line in view while the fight runs.">
          <input type="checkbox" checked={follow} onChange={toggleFollow} /> Stay on newest
        </label>
      </div>
      <fieldset className="log-filters" aria-label="Log categories">
        <legend>Show</legend>
        <label title={LOG_ALL_HINT}>
          <input type="radio" name={name} checked={category === null} onChange={() => choose(null)} /> Everything
        </label>
        {LOG_CATEGORIES.map((entry) => (
          <label key={entry} title={LOG_CATEGORY_HINTS[entry]} data-kind={entry}>
            <input type="radio" name={name} checked={category === entry} onChange={() => choose(entry)} />{' '}
            {LOG_CATEGORY_LABELS[entry]}
          </label>
        ))}
      </fieldset>
      <p className="log-hint">{category === null ? LOG_ALL_HINT : LOG_CATEGORY_HINTS[category]}</p>
      <div className="log-meta">
        <p className="log-count">{count}</p>
        {hidden > 0 || showAll ? (
          <button type="button" className="log-more" aria-pressed={showAll} onClick={toggleShowAll}>
            {showAll ? 'Show newest only' : `Show ${hidden} older`}
          </button>
        ) : null}
      </div>
      {visible.length === 0 ? <p className="log-empty">No lines match this filter yet.</p> : null}
      <ol className="log-list" ref={listRef} aria-label="Combat log">
        {visible.map(({ index, event }) => {
          const expanded = expandedIndex === index
          const { time, body } = splitLeadTime(formatEvent(event))
          const { headline, detail } = splitDetail(body)
          return (
            <li key={index} className="log-row" data-kind={rowKind(event.type)} data-expanded={expanded ? 'true' : 'false'}>
              <button
                type="button"
                className="log-row-button"
                aria-expanded={expanded}
                title={expanded ? 'Hide the details' : 'Show the details'}
                onClick={() => toggleRow(index, event)}
              >
                <span className="log-time">{time ?? ''}</span>
                <span className="log-text">{headline}</span>
                <span className="log-caret" aria-hidden="true">
                  {expanded ? '▾' : '▸'}
                </span>
              </button>
              {expanded ? (
                <div className="log-detail">
                  {detail !== null ? <p>{detail}</p> : null}
                  <details>
                    <summary>Raw event</summary>
                    <pre className="log-payload">{JSON.stringify(event, null, 2)}</pre>
                  </details>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
