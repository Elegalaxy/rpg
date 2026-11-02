export type ThemeChoice = 'system' | 'light' | 'dark'

/** The colour styles. `frontier` is the default and needs no CSS override. */
export const PALETTES = {
  frontier: 'Fractured Frontier',
  verdant: 'Verdant Wild',
  arcane: 'Arcane Night',
  crimson: 'Crimson Court',
  frost: 'Frostwatch',
} as const
export type PaletteChoice = keyof typeof PALETTES

const KEY = 'rpg.theme'
const PALETTE_KEY = 'rpg.palette'

/** The saved choice, or `system`. Storage can be missing or blocked, so every read is guarded. */
export function storedTheme(): ThemeChoice {
  try {
    const value = globalThis.localStorage?.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** The saved colour style, or the default. */
export function storedPalette(): PaletteChoice {
  try {
    const value = globalThis.localStorage?.getItem(PALETTE_KEY)
    return value !== null && value !== undefined && Object.hasOwn(PALETTES, value) ? (value as PaletteChoice) : 'frontier'
  } catch {
    return 'frontier'
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

/** Apply a colour style to the page and remember it. */
export function applyPalette(choice: PaletteChoice): void {
  if (typeof document !== 'undefined') {
    if (choice === 'frontier') delete document.documentElement.dataset.palette
    else document.documentElement.dataset.palette = choice
  }
  try {
    if (choice === 'frontier') globalThis.localStorage?.removeItem(PALETTE_KEY)
    else globalThis.localStorage?.setItem(PALETTE_KEY, choice)
  } catch {
    // The choice still applies for this visit.
  }
}
