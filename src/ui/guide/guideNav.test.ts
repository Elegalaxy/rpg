import { afterEach, describe, expect, it } from 'vitest'

import { getGuideTarget, openGuide, resetGuideTarget, subscribeGuideTarget } from './guideNav.ts'

afterEach(() => resetGuideTarget())

describe('guideNav', () => {
  it('starts empty and records the latest request', () => {
    expect(getGuideTarget()).toBeNull()
    openGuide('vow-zeal')
    expect(getGuideTarget()?.id).toBe('vow-zeal')
  })

  it('gives every request a new nonce, even for the same entry', () => {
    openGuide('class-cleric')
    const first = getGuideTarget()?.nonce ?? 0
    openGuide('class-cleric')
    expect(getGuideTarget()?.nonce).toBeGreaterThan(first)
  })

  it('notifies listeners until they unsubscribe', () => {
    let calls = 0
    const stop = subscribeGuideTarget(() => {
      calls += 1
    })
    openGuide('topic-rules')
    stop()
    openGuide('topic-rules')
    expect(calls).toBe(1)
  })
})
