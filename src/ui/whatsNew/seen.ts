/** Which patch notes the player has opened. Local UI state only; never part of the save. */

const KEY = 'rpg.whatsNewSeen'

export function readSeen(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

export function writeSeen(value: string): void {
  try {
    globalThis.localStorage?.setItem(KEY, value)
  } catch {
    // Storage can be blocked; the badge then simply shows again next visit.
  }
}
