import { useEffect } from 'react'

import type { Moment, MomentKind } from '../persist/moments.ts'
import { debugLog } from './debug.ts'
import { dismissCard, dismissToast, useNotices } from './notices.ts'
import { getAwayView, useSaveStatus } from './store.ts'

/** Where a card's shortcut takes the player. */
export type NoticeTarget = { tab: 'heroes'; heroPart: 'overview' | 'legacy' } | { tab: 'town'; place: 'contract-board' | 'weaponsmith' } | { tab: 'map' }

const TITLES: Record<MomentKind, string> = {
  level: 'Level up',
  warden: 'The Fractured Warden',
  firstClear: 'First clear',
  contract: 'Contract complete',
  discovery: 'New place found',
}

function momentText(moment: Moment): string {
  if (moment.kind === 'level') return `Level ${moment.level}.${moment.points > 0 ? ` ${moment.points} points to spend.` : ''}`
  if (moment.kind === 'contract') return `${moment.text}. Collect it at the Contract Board.`
  return moment.text
}

function shortcut(moment: Moment): { label: string; to: NoticeTarget } | null {
  if (moment.kind === 'level') return moment.points > 0 ? { label: 'Spend points', to: { tab: 'heroes', heroPart: 'overview' } } : null
  if (moment.kind === 'warden') return { label: 'Open Legacy', to: { tab: 'heroes', heroPart: 'legacy' } }
  if (moment.kind === 'firstClear') return { label: 'Spend the free upgrade', to: { tab: 'town', place: 'weaponsmith' } }
  if (moment.kind === 'contract') return { label: 'Go to the Contract Board', to: { tab: 'town', place: 'contract-board' } }
  return { label: 'Open the map', to: { tab: 'map' } }
}

/** The big-moment card and the toasts. The card waits while the away report is up. */
export function Notices({ onGo }: { onGo: (to: NoticeTarget) => void }) {
  useSaveStatus()
  const { card, toasts } = useNotices()
  const shown = card.length > 0 && getAwayView().phase === 'idle'
  useEffect(() => {
    if (!shown) return
    debugLog('[ui]', 'notice card shown', { kinds: card.map((moment) => moment.kind) })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissCard()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shown, card])
  return (
    <>
      <div className="toasts" role="status" aria-live="polite" data-testid="toasts">
        {toasts.map((toast) => (
          <p key={toast.id} className={toast.leaving ? 'toast is-leaving' : 'toast'}>
            <span>{toast.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(toast.id)}>
              ×
            </button>
          </p>
        ))}
      </div>
      {shown ? (
        <>
          <div className="notice-backdrop" onClick={dismissCard} />
          <section className="notice-card" role="dialog" aria-labelledby="notice-title" data-testid="notice-card">
            <h2 id="notice-title">{card.length === 1 ? TITLES[card[0]!.kind] : 'News from the road'}</h2>
            <ul className="notice-list">
              {card.map((moment, index) => {
                const go = shortcut(moment)
                return (
                  <li key={index} data-testid={`notice-${moment.kind}`}>
                    {card.length > 1 ? <strong>{TITLES[moment.kind]}</strong> : null}
                    <span>{momentText(moment)}</span>
                    {go === null ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          debugLog('[ui]', 'notice shortcut', { kind: moment.kind, to: go.to })
                          dismissCard()
                          onGo(go.to)
                        }}
                      >
                        {go.label}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            <button type="button" className="btn-primary" autoFocus onClick={dismissCard}>
              Close
            </button>
          </section>
        </>
      ) : null}
    </>
  )
}
