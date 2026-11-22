import { useEffect, useRef, useState } from 'react'

import { motionReduced } from './access.ts'
import { debugLog } from './debug.ts'

/** Ease a displayed number toward the real one. The first paint shows the real value. */
export function useCount(value: number, ms = 400): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    const delta = value - start
    const reduce = motionReduced()
    if (delta === 0 || reduce) {
      from.current = value
      setShown(value)
      return
    }
    debugLog('[ui]', 'count', { from: start, to: value })
    const t0 = performance.now()
    let frame = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      setShown(Math.round(start + delta * p))
      if (p < 1) frame = requestAnimationFrame(step)
      else from.current = value
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, ms])
  return shown
}
