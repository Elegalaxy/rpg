import type { ReactNode } from 'react'

/** One list row: the text on the left and the buttons at the end, so changing words never moves the buttons. */
export function Row({ children, actions, testId }: { children: ReactNode; actions?: ReactNode; testId?: string }) {
  return (
    <li className="row" data-testid={testId}>
      <div className="row-text">{children}</div>
      {actions === undefined ? null : <div className="row-actions">{actions}</div>}
    </li>
  )
}
