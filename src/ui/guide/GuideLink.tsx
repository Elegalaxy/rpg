import { openGuide } from './guideNav.ts'
import type { GuideEntryId } from './guideIndex.ts'

/** A small quiet "Guide" button that sits next to a Help mark and opens the matching Guide entry. */
export function GuideLink({ id, label }: { id: GuideEntryId; label: string }) {
  return (
    <button type="button" className="guide-open" aria-label={`Open the Guide: ${label}`} onClick={() => openGuide(id)}>
      Guide
    </button>
  )
}
