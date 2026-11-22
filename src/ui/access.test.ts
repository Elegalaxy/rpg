import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyAccess, motionReduced, storedAccess } from './access.ts'

describe('access choices', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies large text, high contrast and reduced motion, and reads them back', () => {
    const store = new Map<string, string>()
    const dataset: { text?: string; contrast?: string; motion?: string } = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
    vi.stubGlobal('document', { documentElement: { dataset } })
    applyAccess({ text: 'large', contrast: 'high', motion: 'reduce' })
    expect(dataset).toEqual({ text: 'large', contrast: 'high', motion: 'reduce' })
    expect(storedAccess()).toEqual({ text: 'large', contrast: 'high', motion: 'reduce' })
    expect(motionReduced()).toBe(true)
    applyAccess({ text: 'default', contrast: 'default', motion: 'system' })
    expect(dataset).toEqual({})
    expect(storedAccess()).toEqual({ text: 'default', contrast: 'default', motion: 'system' })
  })
})
