import { useEffect, useRef, useState } from 'react'

import { createSellArm, type SellArm } from './sellArm.ts'

/**
 * The Re-infuse button of an item that already has a second modifier. The first click turns this same button into
 * "Confirm replace" and a second click queues the job; it reverts after a few seconds, on blur or on Escape (the same two
 * clicks as the risky Sell button). The "Replaces" row beside it names what is lost. Both labels are laid over each other,
 * so the button never changes size.
 */
export function ReinfuseButton({
  disabled,
  label,
  confirmLabel,
  onConfirm,
  initialArmed = false,
}: {
  disabled: boolean
  /** Accessible name while plain, for example "Infuse old-1". */
  label: string
  /** Accessible name while armed. */
  confirmLabel: string
  onConfirm: () => void
  /** Renders the armed state (tests). */
  initialArmed?: boolean
}) {
  const [armed, setArmed] = useState(initialArmed)
  const arm = useRef<SellArm | null>(null)
  const confirm = useRef(onConfirm)
  useEffect(() => {
    confirm.current = onConfirm
  })
  useEffect(() => {
    arm.current = createSellArm(true, setArmed)
    return () => arm.current?.dispose()
  }, [])
  useEffect(() => {
    if (disabled) arm.current?.cancel()
  }, [disabled])
  const showArmed = armed && !disabled
  return (
    <button
      type="button"
      className="btn-primary sell-button-confirm"
      disabled={disabled}
      aria-label={showArmed ? confirmLabel : label}
      onClick={() => {
        if (arm.current?.press() === 'confirmed') confirm.current()
      }}
      onBlur={() => arm.current?.cancel()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && armed) {
          event.stopPropagation()
          arm.current?.cancel()
        }
      }}
    >
      <span className={showArmed ? 'sell-label sell-label-off' : 'sell-label'} aria-hidden="true">
        Re-infuse
      </span>
      <span className={showArmed ? 'sell-label' : 'sell-label sell-label-off'} aria-hidden="true">
        Confirm replace
      </span>
    </button>
  )
}
