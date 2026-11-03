import { useSyncExternalStore } from 'react'

import type { LogCategory } from './categories.ts'

/**
 * The chosen log filter, shared by every fight log on screen, so switching between fights or
 * between the viewer and a run keeps the same filter. Null shows everything.
 */
let current: LogCategory | null = null
const listeners = new Set<() => void>()

export function getLogFilter(): LogCategory | null {
  return current
}

export function setLogFilter(next: LogCategory | null): void {
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLogFilter(): LogCategory | null {
  return useSyncExternalStore(subscribe, getLogFilter, getLogFilter)
}
