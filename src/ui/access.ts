import { debugLog } from './debug.ts'

export type TextSize = 'default' | 'large'
export type ContrastChoice = 'default' | 'high'
export type MotionChoice = 'system' | 'reduce'

export type AccessChoice = {
  text: TextSize
  contrast: ContrastChoice
  motion: MotionChoice
}

const TEXT_KEY = 'rpg.text'
const CONTRAST_KEY = 'rpg.contrast'
const MOTION_KEY = 'rpg.motion'

const DEFAULTS: AccessChoice = { text: 'default', contrast: 'default', motion: 'system' }

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string, forget: boolean): void {
  try {
    if (forget) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch {
    // The choice still applies for this visit.
  }
}

/** The saved reading choices, or the defaults when nothing is stored. */
export function storedAccess(): AccessChoice {
  const text = read(TEXT_KEY)
  const contrast = read(CONTRAST_KEY)
  const motion = read(MOTION_KEY)
  return {
    text: text === 'large' ? 'large' : 'default',
    contrast: contrast === 'high' ? 'high' : 'default',
    motion: motion === 'reduce' ? 'reduce' : 'system',
  }
}

/** Apply the reading choices to the page and remember them. Defaults are not stored. */
export function applyAccess(choice: AccessChoice): void {
  const root = typeof document === 'undefined' ? null : document.documentElement
  if (root !== null) {
    if (choice.text === 'default') delete root.dataset.text
    else root.dataset.text = choice.text
    if (choice.contrast === 'default') delete root.dataset.contrast
    else root.dataset.contrast = choice.contrast
    if (choice.motion === 'system') delete root.dataset.motion
    else root.dataset.motion = choice.motion
  }
  write(TEXT_KEY, choice.text, choice.text === 'default')
  write(CONTRAST_KEY, choice.contrast, choice.contrast === 'default')
  write(MOTION_KEY, choice.motion, choice.motion === 'system')
  debugLog('[ui]', 'access', choice)
}

/** True when the player turned motion off, or the device asks for less motion. */
export function motionReduced(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce') return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const ACCESS_DEFAULTS = DEFAULTS
