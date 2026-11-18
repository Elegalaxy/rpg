import { useSyncExternalStore } from 'react'

/** Must match the phone breakpoint (max-width: 899px) in theme.css. */
const QUERY = '(max-width: 899px)'

function media(): MediaQueryList | null {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(QUERY)
}

function subscribe(onChange: () => void): () => void {
  const list = media()
  if (list === null) return () => undefined
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

/** True on a phone-width screen. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false)
}
