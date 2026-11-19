import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { debugLog } from './debug.ts'

/**
 * A small "?" that shows a short explanation on hover, keyboard focus, or a tap. Rules and background go
 * here so the screen itself keeps to the game's own voice. A tap elsewhere or Escape closes a tapped one.
 */
export function Help({ children, label = 'Help' }: { children: ReactNode; label?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <span ref={box} className={open ? 'help is-open' : 'help'}>
      <button
        type="button"
        className="help-mark"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => {
          debugLog('[ui]', 'help', { label, open: !open })
          setOpen(!open)
        }}
      >
        ?
      </button>
      <span role="tooltip" id={id} className="help-tip">
        {children}
      </span>
    </span>
  )
}
