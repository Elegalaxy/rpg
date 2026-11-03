import { useId, type ReactNode } from 'react'

/**
 * A small "?" that shows a short explanation on hover or keyboard focus. Rules and background go
 * here so the screen itself keeps to the game's own voice.
 */
export function Help({ children, label = 'Help' }: { children: ReactNode; label?: string }) {
  const id = useId()
  return (
    <span className="help">
      <button type="button" className="help-mark" aria-label={label} aria-describedby={id}>
        ?
      </button>
      <span role="tooltip" id={id} className="help-tip">
        {children}
      </span>
    </span>
  )
}
