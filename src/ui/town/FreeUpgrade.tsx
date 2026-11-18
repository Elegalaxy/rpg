import { useState } from 'react'

/**
 * The "Use free upgrade" button with its confirm step (Step 13.24). Shown by the caller only when the hero has a
 * token. Disabled with the check's reason when the upgrade is refused.
 */
export function FreeUpgradeButton({ subject, reason, label, onConfirm }: { subject: string; reason: string | null; label: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span role="dialog" aria-label={`Confirm free upgrade for ${subject}`}>
        <span>Spend 1 free upgrade on {subject}? This cannot be undone.</span>{' '}
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            onConfirm()
          }}
        >
          Confirm
        </button>{' '}
        <button type="button" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    )
  }
  return (
    <button type="button" disabled={reason !== null} title={reason ?? undefined} aria-label={label} onClick={() => setConfirming(true)}>
      Use free upgrade
    </button>
  )
}
