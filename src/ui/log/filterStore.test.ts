import { afterEach, describe, expect, it } from 'vitest'

import { getLogFilter, setLogFilter } from './filterStore.ts'

describe('the shared log filter', () => {
  afterEach(() => setLogFilter(null))

  it('keeps one choice for every log until it changes', () => {
    expect(getLogFilter()).toBeNull()
    setLogFilter('items')
    expect(getLogFilter()).toBe('items')
    setLogFilter('healing')
    expect(getLogFilter()).toBe('healing')
    setLogFilter(null)
    expect(getLogFilter()).toBeNull()
  })
})
