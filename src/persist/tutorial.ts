// The first-run coach. Pure: it reads the save and names the next mark. It changes nothing.

import type { ExpeditionState } from '../sim/expedition.ts'

import type { SaveData, TutorialStep } from './save.ts'

export type TutorMark = {
  /** Matches `data-tutor` on the control the mark lights. */
  id: string
  chip: string
  /** `tap` moves on when the chip is pressed. `action` waits for the real control. */
  kind: 'tap' | 'action'
}

export function tutorialStep(save: SaveData): TutorialStep {
  return save.account.tutorial ?? 'done'
}

/** The mark to show right now. Null while the step is waiting for a fight, a walk, or a later defeat. */
export function tutorialMark(save: SaveData): TutorMark | null {
  const step = tutorialStep(save)
  const exp = save.expedition
  if (step === 'name') return { id: 'hero-name', chip: 'Name your hero', kind: 'action' }
  if (step === 'race') return { id: 'hero-race', chip: 'Pick a race', kind: 'action' }
  if (step === 'class') return { id: 'hero-class', chip: 'Pick a class', kind: 'action' }
  if (step === 'create') return { id: 'hero-create', chip: 'Create the hero', kind: 'action' }
  if (step === 'start') return exp === null ? { id: 'start-expedition', chip: 'Start the run', kind: 'action' } : null
  if (step === 'bank') return holding(exp) ? { id: 'return', chip: 'Bank this loot', kind: 'action' } : null
  if (step === 'home') return exp?.outcome === 'returned' ? { id: 'settle', chip: 'Home', kind: 'action' } : null
  if (step === 'again') return exp === null ? { id: 'start-expedition', chip: 'Fight again', kind: 'action' } : null
  if (step === 'push') {
    if (exp === null) return { id: 'start-expedition', chip: 'Fight again', kind: 'action' }
    if (holding(exp) && exp.history.length === 1) return { id: 'push', chip: 'Push on once', kind: 'action' }
    return null
  }
  if (step === 'fee') return exp?.outcome === 'defeat' ? { id: 'rescue-fee', chip: 'You pay this', kind: 'tap' } : null
  if (step === 'pouch') return exp?.outcome === 'defeat' ? { id: 'kept-loot', chip: 'The pouch kept this', kind: 'tap' } : null
  if (step === 'back') return exp?.outcome === 'defeat' ? { id: 'settle', chip: 'Back to town', kind: 'action' } : null
  return null
}

/** The chip on the rescue fee and the pouch moves the coach on. Other marks wait for the real control. */
export function tutorialAfterTap(step: TutorialStep): TutorialStep | null {
  if (step === 'fee') return 'pouch'
  if (step === 'pouch') return 'back'
  return null
}

/**
 * Move the coach when the save already shows the step is done.
 * A defeat before the lesson finishes jumps to the rescue fee. A win after Push on waits for the first defeat.
 */
export function nextTutorialStep(step: TutorialStep, save: SaveData): TutorialStep {
  if (step === 'done') return 'done'
  const exp = save.expedition
  if (exp?.outcome === 'defeat' && step !== 'fee' && step !== 'pouch' && step !== 'back') {
    if (step === 'name' || step === 'race' || step === 'class' || step === 'create') return step
    return 'fee'
  }
  if (step === 'name' || step === 'race' || step === 'class' || step === 'create') {
    return save.heroes.length > 0 ? 'start' : step
  }
  if (step === 'start') {
    if (exp === null) return 'start'
    return exp.returning || exp.outcome === 'returned' ? 'home' : 'bank'
  }
  if (step === 'bank') {
    if (exp === null) return 'again'
    if (exp.returning || exp.outcome === 'returned') return 'home'
    return 'bank'
  }
  if (step === 'home') {
    if (exp === null) return 'again'
    if (exp.outcome === 'ongoing' && !exp.returning) return 'push'
    return 'home'
  }
  if (step === 'again') {
    if (exp !== null && exp.outcome === 'ongoing') return 'push'
    return 'again'
  }
  if (step === 'push') {
    if (exp !== null && pushedPastFirst(exp)) return 'fall'
    return 'push'
  }
  if (step === 'fall') return 'fall'
  if (step === 'fee' || step === 'pouch' || step === 'back') {
    if (exp === null || exp.outcome !== 'defeat') return 'done'
    return step
  }
  return step
}

/** Apply `nextTutorialStep` when the step changed. The same save comes back when nothing moved. */
export function syncTutorial(save: SaveData): SaveData {
  const step = tutorialStep(save)
  const next = nextTutorialStep(step, save)
  if (next === step && save.account.tutorial !== undefined) return save
  return { ...save, account: { ...save.account, tutorial: next } }
}

/** The run is waiting between fights, before the player pushes on or returns. */
function holding(exp: ExpeditionState | null): boolean {
  return (
    exp !== null &&
    exp.outcome === 'ongoing' &&
    exp.phase === 'travel' &&
    !exp.returning &&
    exp.encounterIndex > 0 &&
    exp.travelMs === 0
  )
}

/** Fight 1 is over and the run has left that wait: the walk to fight 2 has started, or a later fight exists. */
function pushedPastFirst(exp: ExpeditionState): boolean {
  if (exp.returning || exp.outcome !== 'ongoing') return false
  if (exp.history.length >= 2) return true
  return exp.history.length === 1 && exp.encounterIndex >= 1 && (exp.travelMs > 0 || exp.phase === 'combat')
}
