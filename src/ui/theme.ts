export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'rpg.theme'

/** The saved choice, or `system`. Storage can be missing or blocked, so every read is guarded. */
export function storedTheme(): ThemeChoice {
  try {
    const value = globalThis.localStorage?.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** Apply the choice to the page and remember it. `system` follows the device. */
export function applyTheme(choice: ThemeChoice): void {
  if (typeof document !== 'undefined') {
    if (choice === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = choice
  }
  try {
    if (choice === 'system') globalThis.localStorage?.removeItem(KEY)
    else globalThis.localStorage?.setItem(KEY, choice)
  } catch {
    // The choice still applies for this visit.
  }
}
