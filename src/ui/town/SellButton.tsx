import { useEffect, useRef, useState } from 'react'

import { createSellArm, type SellArm } from './sellArm.ts'

/**
 * The Sell button of one piece of gear (Step 13.44). Plain gear sells on one click. When `needsConfirm`, the first click
 * turns this same button into "Confirm sell +X g" and a second click sells; it reverts after a few seconds, on blur or on
 * Escape. Both labels are laid over each other, so the button never changes size.
 */
export function SellButton({
  price,
  needsConfirm,
  disabled,
  blockedReason,
  label,
  confirmLabel,
  onSell,
  initialArmed = false,
}: {
  price: number
  needsConfirm: boolean
  disabled: boolean
  /** Set for gear that can never be sold: the button stays, disabled, and says why. */
  blockedReason?: string | null
  /** Accessible name while plain, for example "Sell worn old-1". */
  label: string
  /** Accessible name while armed. */
  confirmLabel: string
  onSell: () => void
  /** Renders the armed state (tests). */
  initialArmed?: boolean
}) {
  const [armed, setArmed] = useState(initialArmed)
  const arm = useRef<SellArm | null>(null)
  const sell = useRef(onSell)
  useEffect(() => {
    sell.current = onSell
  })
  useEffect(() => {
    arm.current = createSellArm(needsConfirm, setArmed)
    return () => arm.current?.dispose()
  }, [needsConfirm])
  const blocked = blockedReason !== undefined && blockedReason !== null
  const showArmed = armed && !blocked
  return (
    <button
      type="button"
      className={needsConfirm ? 'btn-warn sell-button sell-button-confirm' : 'btn-warn sell-button'}
      disabled={disabled || blocked}
      title={blocked ? blockedReason : undefined}
      aria-label={showArmed ? confirmLabel : label}
      onClick={() => {
        if (arm.current?.press() === 'confirmed') sell.current()
      }}
      onBlur={() => arm.current?.cancel()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && armed) {
          event.stopPropagation()
          arm.current?.cancel()
        }
      }}
    >
      {needsConfirm ? (
        <>
          <span className={showArmed ? 'sell-label sell-label-off' : 'sell-label'} aria-hidden="true">
            Sell
          </span>
          <span className={showArmed ? 'sell-label' : 'sell-label sell-label-off'} aria-hidden="true">
            Confirm sell +{price} g
          </span>
        </>
      ) : (
        'Sell'
      )}
    </button>
  )
}
