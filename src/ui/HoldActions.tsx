import { useState } from 'react'

import { pushOnFromUi, returnFromUi } from './store.ts'

/**
 * Push on and Return to town, for the moment a run waits between fights. Shared by the Running panel and
 * the run dock. The refusal message has its own line, so the buttons never move when one appears.
 */
export function HoldActions({ waiting, whyDisabled, compact = false }: { waiting: boolean; whyDisabled?: string; compact?: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const reason = waiting ? undefined : whyDisabled
  return (
    <div className="hold-actions">
      <div className="button-row">
        <button type="button" className="btn-primary" disabled={!waiting} title={reason} onClick={pushOnFromUi}>
          Push on
        </button>
        <button type="button" className="btn-good" disabled={!waiting} title={reason} aria-label={compact ? 'Return to town' : undefined} onClick={() => setError(returnFromUi())}>
          {compact ? 'Return' : 'Return to town'}
        </button>
      </div>
      <small className="hold-msg" role="alert">
        {error}
      </small>
    </div>
  )
}
