import type { CombatState } from '../types.ts'

/** Log text keeps three decimal places. The stored meter is not rounded here. */
export function formatMeter(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Math.round(value * 1000) / 1000
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}

export function logRace(state: CombatState, timeMs: number, text: string): void {
  state.log.push({ type: 'race', timeMs, text })
}
