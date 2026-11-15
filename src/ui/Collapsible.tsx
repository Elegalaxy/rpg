import { useState, type ReactNode } from 'react'

function readOpen(key: string | undefined, fallback: boolean): boolean {
  if (key === undefined) return fallback
  try {
    const stored = globalThis.localStorage?.getItem(key)
    return stored === null || stored === undefined ? fallback : stored === '1'
  } catch {
    return fallback
  }
}

function writeOpen(key: string | undefined, open: boolean): void {
  if (key === undefined) return
  try {
    globalThis.localStorage?.setItem(key, open ? '1' : '0')
  } catch {
    // Storage can be blocked; the section then opens in its default state next time.
  }
}

/** A native <details> section whose open state survives re-renders. Used to fold long lists. */
export function Collapsible({
  summary,
  defaultOpen = false,
  children,
  testId,
  persistKey,
}: {
  summary: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  testId?: string
  /** localStorage key that remembers the open state in this browser only. */
  persistKey?: string
}) {
  const [open, setOpen] = useState(() => readOpen(persistKey, defaultOpen))
  return (
    <details className="fold" open={open} data-testid={testId} onToggle={(event) => {
        setOpen(event.currentTarget.open)
        writeOpen(persistKey, event.currentTarget.open)
      }}>
      <summary>{summary}</summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}
