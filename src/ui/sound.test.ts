import { afterEach, describe, expect, it, vi } from 'vitest'

import { applySound, playClick, playHit, playLevel, soundOn, storedSound } from './sound.ts'

describe('sound', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stays on until turned off, and the cues do nothing without an audio device', () => {
    const store = new Map<string, string>()
    const dataset: { sound?: string } = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
    vi.stubGlobal('document', { documentElement: { dataset } })
    applySound('on')
    expect(storedSound()).toBe('on')
    expect(soundOn()).toBe(true)
    applySound('off')
    expect(dataset).toEqual({ sound: 'off' })
    expect(storedSound()).toBe('off')
    expect(soundOn()).toBe(false)
    expect(() => {
      playClick()
      playHit()
      playLevel()
    }).not.toThrow()
  })
})
