import { useSyncExternalStore } from 'react'

import type { GuideEntryId } from './guideIndex.ts'

export type GuideNavTarget = { id: GuideEntryId; nonce: number }

let target: GuideNavTarget | null = null
let nonceCounter = 0
const listeners = new Set<() => void>()

/** Ask the app to show the Guide tab and scroll to this entry. Every call is a new request, even for the same id. */
export function openGuide(id: GuideEntryId): void {
  nonceCounter += 1
  target = { id, nonce: nonceCounter }
  for (const listener of [...listeners]) listener()
}

export function getGuideTarget(): GuideNavTarget | null {
  return target
}

export function subscribeGuideTarget(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The latest request. Null on the server and until the first openGuide call. */
export function useGuideTarget(): GuideNavTarget | null {
  return useSyncExternalStore(subscribeGuideTarget, getGuideTarget, () => null)
}

/** For tests: forget any earlier request. */
export function resetGuideTarget(): void {
  target = null
  for (const listener of [...listeners]) listener()
}
