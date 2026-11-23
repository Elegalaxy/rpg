import { debugLog } from './debug.ts'

export type SoundChoice = 'on' | 'off'

const KEY = 'rpg.sound'

let audio: AudioContext | null = null
let installed = false

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

/** The saved choice. Sound is on until the player turns it off. */
export function storedSound(): SoundChoice {
  return read() === 'off' ? 'off' : 'on'
}

/** Remember the choice. Off is the only value stored. */
export function applySound(choice: SoundChoice): void {
  const root = typeof document === 'undefined' ? null : document.documentElement
  if (root !== null) {
    if (choice === 'on') delete root.dataset.sound
    else root.dataset.sound = 'off'
  }
  try {
    if (choice === 'on') globalThis.localStorage?.removeItem(KEY)
    else globalThis.localStorage?.setItem(KEY, 'off')
  } catch {
    // The choice still applies for this visit.
  }
  debugLog('[ui]', 'sound', { choice })
}

export function soundOn(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.sound === 'off') return false
  return storedSound() === 'on'
}

function context(): AudioContext | null {
  if (!soundOn() || typeof window === 'undefined') return null
  const Context = window.AudioContext
  if (Context === undefined) return null
  if (audio === null) audio = new Context()
  if (audio.state === 'suspended') void audio.resume()
  return audio.state === 'running' ? audio : null
}

function tone(ctx: AudioContext, frequency: number, at: number, duration: number, gain: number): void {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = frequency
  amp.gain.setValueAtTime(gain, at)
  amp.gain.exponentialRampToValueAtTime(0.001, at + duration)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(at)
  osc.stop(at + duration)
}

/** A short tick for a button. */
export function playClick(): void {
  const ctx = context()
  if (ctx === null) return
  tone(ctx, 660, ctx.currentTime, 0.04, 0.04)
  debugLog('[ui]', 'sound play', { cue: 'click' })
}

/** A low thud for a landed hit. */
export function playHit(): void {
  const ctx = context()
  if (ctx === null) return
  tone(ctx, 140, ctx.currentTime, 0.08, 0.06)
  debugLog('[ui]', 'sound play', { cue: 'hit' })
}

/** A bright rise when a fight is won. */
export function playVictory(): void {
  const ctx = context()
  if (ctx === null) return
  tone(ctx, 523, ctx.currentTime, 0.1, 0.05)
  tone(ctx, 659, ctx.currentTime + 0.08, 0.1, 0.05)
  tone(ctx, 784, ctx.currentTime + 0.16, 0.16, 0.05)
  debugLog('[ui]', 'sound play', { cue: 'victory' })
}

/** A low fall when a fight is lost. */
export function playDefeat(): void {
  const ctx = context()
  if (ctx === null) return
  tone(ctx, 220, ctx.currentTime, 0.14, 0.05)
  tone(ctx, 146, ctx.currentTime + 0.12, 0.2, 0.05)
  debugLog('[ui]', 'sound play', { cue: 'defeat' })
}

/** A short bright note when gold is gained. */
export function playGold(): void {
  const ctx = context()
  if (ctx === null) return
  tone(ctx, 988, ctx.currentTime, 0.06, 0.04)
  tone(ctx, 1318, ctx.currentTime + 0.05, 0.08, 0.03)
  debugLog('[ui]', 'sound play', { cue: 'gold' })
}

/** Two rising notes for a level up. */
export function playLevel(): void {
  const ctx = context()
  if (ctx === null) return
  tone(ctx, 523, ctx.currentTime, 0.12, 0.05)
  tone(ctx, 784, ctx.currentTime + 0.1, 0.16, 0.05)
  debugLog('[ui]', 'sound play', { cue: 'level' })
}

/** Turn the saved choice on, resume audio after the first gesture, and tick on button clicks. */
export function installSound(): void {
  applySound(storedSound())
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('pointerdown', () => context(), true)
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('button') !== null) playClick()
    },
    true,
  )
}
