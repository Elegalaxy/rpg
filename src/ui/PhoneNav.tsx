import { useState, type ReactNode } from 'react'

import { debugLog } from './debug.ts'

type Entry<T extends string> = { id: T; label: string }

/** The phone tab bar along the bottom, with a More sheet for the less used tabs. */
export function PhoneNav<T extends string>({
  main,
  more,
  current,
  onPick,
  badge,
  moreBadge,
  extra,
}: {
  main: Entry<T>[]
  more: Entry<T>[]
  current: T
  onPick: (id: T) => void
  badge: (id: T) => ReactNode
  moreBadge: ReactNode
  extra?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const inMore = more.some((entry) => entry.id === current)

  function pick(id: T): void {
    debugLog('[ui]', 'phone tab', { id })
    setOpen(false)
    onPick(id)
  }

  return (
    <>
      {open ? (
        <>
          <button type="button" className="more-backdrop" aria-label="Close More" onClick={() => setOpen(false)} />
          <div className="more-sheet" role="dialog" aria-label="More">
            <nav className="more-list" aria-label="More tabs">
              {more.map((entry) => (
                <button key={entry.id} type="button" aria-pressed={current === entry.id} onClick={() => pick(entry.id)}>
                  {entry.label}
                  {badge(entry.id)}
                </button>
              ))}
            </nav>
            {extra}
          </div>
        </>
      ) : null}
      <nav className="bottom-tabs" aria-label="Tabs">
        {main.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={current === entry.id} onClick={() => pick(entry.id)}>
            {entry.label}
            {badge(entry.id)}
          </button>
        ))}
        <button type="button" aria-pressed={inMore} aria-expanded={open} onClick={() => setOpen(!open)}>
          More
          {moreBadge}
        </button>
      </nav>
    </>
  )
}
