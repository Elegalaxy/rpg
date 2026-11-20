import { useLayoutEffect, useRef, useState } from 'react'

import { tutorialAfterTap, tutorialMark, tutorialStep } from '../../persist/tutorial.ts'
import { debugLog } from '../debug.ts'
import { advanceTutorial, useSaveStatus } from '../store.ts'

const MAP_MARKS = new Set(['start-expedition', 'return', 'push', 'settle', 'rescue-fee', 'kept-loot'])

type Box = { top: number; left: number; width: number; height: number }

/** A short chip beside one control. Skip dismisses the whole first-run coach. */
export function Coach({ onShowMap }: { onShowMap: () => void }) {
  const { save } = useSaveStatus()
  const mark = tutorialMark(save)
  const [box, setBox] = useState<Box | null>(null)
  const [chipBox, setChipBox] = useState<{ top: number; left: number } | null>(null)
  const chipRef = useRef<HTMLParagraphElement>(null)
  const scrolled = useRef<string | null>(null)
  const showMap = useRef(onShowMap)
  const markId = mark?.id ?? null
  const markChip = mark?.chip ?? null

  useLayoutEffect(() => {
    showMap.current = onShowMap
  }, [onShowMap])

  useLayoutEffect(() => {
    if (markId === null || markChip === null) return
    debugLog('[ui]', 'tutorial mark', { id: markId, chip: markChip })
    const place = (): void => {
      const el = document.querySelector(`[data-tutor="${markId}"]`)
      if (el === null) {
        setBox(null)
        setChipBox(null)
        if (MAP_MARKS.has(markId)) showMap.current()
        return
      }
      if (scrolled.current !== markId) {
        scrolled.current = markId
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
      }
      const rect = el.getBoundingClientRect()
      const next = { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      setBox((prev) => (sameBox(prev, next) ? prev : next))
      const chip = chipRef.current?.getBoundingClientRect()
      const chipHeight = chip?.height ?? 36
      const chipWidth = chip?.width ?? 160
      let top = rect.top - chipHeight - 8
      if (top < 48) top = rect.bottom + 8
      let left = rect.left
      const maxLeft = Math.max(8, window.innerWidth - chipWidth - 8)
      if (left > maxLeft) left = maxLeft
      if (left < 8) left = 8
      setChipBox((prev) => (prev !== null && prev.top === top && prev.left === left ? prev : { top, left }))
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [markId, markChip])

  if (mark === null) return null
  const tap = mark.kind === 'tap' ? tutorialAfterTap(tutorialStep(save)) : null
  return (
    <div className="tutor" data-testid="tutorial">
      {box !== null ? (
        <div
          className="tutor-hole"
          style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }}
        />
      ) : (
        <div className="tutor-shade" />
      )}
      <p ref={chipRef} className="tutor-chip" style={chipBox === null ? undefined : { top: chipBox.top, left: chipBox.left }} role="status">
        {tap !== null ? (
          <button type="button" onClick={() => advanceTutorial(tap)}>
            {mark.chip}
          </button>
        ) : (
          mark.chip
        )}
      </p>
      <button type="button" className="tutor-skip" onClick={() => advanceTutorial('done')}>
        Skip
      </button>
    </div>
  )
}

function sameBox(prev: Box | null, next: Box): boolean {
  return prev !== null && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height
}
