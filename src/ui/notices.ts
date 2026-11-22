import { useSyncExternalStore } from 'react'

import { momentLine, sortMoments, type Moment } from '../persist/moments.ts'
import { motionReduced } from './access.ts'
import { debugLog } from './debug.ts'

/**
 * Pop-up notices, kept in memory only so a reload never replays them (doc/POPUP_NOTICES.md).
 * - `hand`: big moments go on one card that collects them until the player closes it.
 * - `away`: the same card, which the screen holds back until the away report is closed.
 * - `auto`: Auto run is on, so every moment is a toast and nothing waits for a click.
 */
export type NoticeMode = 'hand' | 'away' | 'auto'

export type Toast = { id: number; text: string; leaving: boolean }

export type Notices = { card: readonly Moment[]; cardLeaving: boolean; toasts: readonly Toast[] }

export const TOAST_MS = 5000
/** How long a toast or the card stays on screen while it fades out, matching the CSS. */
export const TOAST_LEAVE_MS = 180
export const CARD_LEAVE_MS = 180
export const MAX_TOASTS = 3

let notices: Notices = { card: [], cardLeaving: false, toasts: [] }
let nextToastId = 1
let cardLeaveTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function motionMs(ms: number): number {
  return motionReduced() ? 0 : ms
}

function set(next: Notices): void {
  notices = next
  for (const listener of listeners) listener()
}

export function getNotices(): Notices {
  return notices
}

export function useNotices(): Notices {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getNotices,
    getNotices,
  )
}

/** Show a short line that slides in, then fades out. The oldest goes when more than three are up. */
export function pushToast(text: string): void {
  const toast: Toast = { id: nextToastId++, text, leaving: false }
  debugLog('[ui]', 'notice toast', toast)
  set({ ...notices, toasts: [...notices.toasts, toast].slice(-MAX_TOASTS) })
  setTimeout(() => dismissToast(toast.id), TOAST_MS)
}

/** Start the fade-out. A second call while it is already leaving does nothing. */
export function dismissToast(id: number): void {
  const toast = notices.toasts.find((item) => item.id === id)
  if (!toast || toast.leaving) return
  debugLog('[ui]', 'notice toast leaving', { id })
  set({ ...notices, toasts: notices.toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item)) })
  setTimeout(() => {
    if (!notices.toasts.some((item) => item.id === id)) return
    set({ ...notices, toasts: notices.toasts.filter((item) => item.id !== id) })
  }, motionMs(TOAST_LEAVE_MS))
}

/** Report moments the way the mode asks: on the card, or as toasts under Auto run. */
export function reportMoments(moments: readonly Moment[], mode: NoticeMode): void {
  if (moments.length === 0) return
  debugLog('[ui]', 'notice moments', { mode, kinds: moments.map((moment) => moment.kind) })
  if (mode === 'auto') {
    for (const moment of moments) pushToast(momentLine(moment))
    return
  }
  if (cardLeaveTimer !== null) {
    clearTimeout(cardLeaveTimer)
    cardLeaveTimer = null
  }
  set({ ...notices, card: sortMoments([...notices.card, ...moments]), cardLeaving: false })
}

/** Fade the card out, then drop it. A second call while it is already leaving does nothing. */
export function dismissCard(): void {
  if (notices.card.length === 0 || notices.cardLeaving) return
  debugLog('[ui]', 'notice card leaving', { count: notices.card.length })
  set({ ...notices, cardLeaving: true })
  cardLeaveTimer = setTimeout(() => {
    cardLeaveTimer = null
    if (!notices.cardLeaving) return
    debugLog('[ui]', 'notice card closed', { count: notices.card.length })
    set({ ...notices, card: [], cardLeaving: false })
  }, motionMs(CARD_LEAVE_MS))
}

/** Tests only: start from nothing. */
export function resetNotices(): void {
  if (cardLeaveTimer !== null) clearTimeout(cardLeaveTimer)
  cardLeaveTimer = null
  notices = { card: [], cardLeaving: false, toasts: [] }
}
