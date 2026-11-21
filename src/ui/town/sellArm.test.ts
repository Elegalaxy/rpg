import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SELL_CONFIRM_MS, createSellArm } from './sellArm.ts'

describe('the two-click sell button', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function make(needs = true) {
    const states: boolean[] = []
    return { states, arm: createSellArm(needs, (value) => states.push(value)) }
  }

  it('arms on the first click and sells on the second', () => {
    const { arm, states } = make()
    expect(arm.press()).toBe('armed')
    expect(arm.armed()).toBe(true)
    expect(arm.press()).toBe('confirmed')
    expect(arm.armed()).toBe(false)
    expect(states).toEqual([true, false])
  })

  it('goes back after about four seconds, not before', () => {
    const { arm } = make()
    arm.press()
    vi.advanceTimersByTime(SELL_CONFIRM_MS - 1)
    expect(arm.armed()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(arm.armed()).toBe(false)
    expect(arm.press()).toBe('armed')
  })

  it('goes back on blur or Escape (cancel), and a late timer does nothing', () => {
    const { arm, states } = make()
    arm.press()
    arm.cancel()
    expect(arm.armed()).toBe(false)
    vi.advanceTimersByTime(SELL_CONFIRM_MS * 2)
    expect(states).toEqual([true, false])
  })

  it('never arms for plain gear: one click sells', () => {
    const { arm, states } = make(false)
    expect(arm.press()).toBe('confirmed')
    expect(states).toEqual([])
  })

  it('restarts the wait on a new first click', () => {
    const { arm } = make()
    arm.press()
    vi.advanceTimersByTime(3000)
    arm.cancel()
    arm.press()
    vi.advanceTimersByTime(3000)
    expect(arm.armed()).toBe(true)
  })
})
