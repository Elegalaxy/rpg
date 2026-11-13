import { useState, type ReactNode } from 'react'

/** A native <details> section whose open state survives re-renders. Used to fold long lists. */
export function Collapsible({
  summary,
  defaultOpen = false,
  children,
  testId,
}: {
  summary: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  testId?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details className="fold" open={open} data-testid={testId} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{summary}</summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}
