/** How long the "Confirm sell" button waits before it goes back to "Sell" (Step 13.44). */
export const SELL_CONFIRM_MS = 4000

export type SellArm = {
  /** A click. Returns 'confirmed' when the sale should go ahead, else 'armed' (the first click of two). */
  press: () => 'armed' | 'confirmed'
  /** Back to the plain button: blur, Escape or a timeout. */
  cancel: () => void
  armed: () => boolean
  /** Stop the timer without notifying (the component went away). */
  dispose: () => void
}

/**
 * The two-click state of one Sell button, with no React in it so it can be tested with fake timers. `onChange` runs
 * whenever the armed state flips. A button that needs no confirmation never arms: its press is always 'confirmed'.
 */
export function createSellArm(needsConfirm: boolean, onChange: (armed: boolean) => void, ms: number = SELL_CONFIRM_MS): SellArm {
  let armed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const stop = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const set = (value: boolean): void => {
    if (armed === value) return
    armed = value
    onChange(value)
  }
  return {
    press: () => {
      if (!needsConfirm) return 'confirmed'
      if (!armed) {
        set(true)
        stop()
        timer = setTimeout(() => {
          timer = null
          set(false)
        }, ms)
        return 'armed'
      }
      stop()
      set(false)
      return 'confirmed'
    },
    cancel: () => {
      stop()
      set(false)
    },
    armed: () => armed,
    dispose: stop,
  }
}
