import { gameDefs } from '../../content/scenarios.ts'
import { STACK_HOLD_MS } from '../../sim/automation.ts'
import { pickStack, stackName } from '../../sim/stacks.ts'
import { DEFAULT_STACK_ID, type CombatState, type GameDefs, type StackChangedEvent } from '../../sim/types.ts'

let cachedDefs: GameDefs | null = null
function defsForHold(): GameDefs {
  cachedDefs ??= gameDefs()
  return cachedDefs
}

export function hasStacks(combat: CombatState): boolean {
  return (combat.hero.ruleStacks ?? []).length > 0
}

/** What the bar says about the active stack, derived from the hero's stack state and the log. No sim logic is repeated except the hold check. */
export type StackSummary = {
  activeId: string
  activeName: string
  /** The one-line reason: "Auto · enemy count at least 2", "Default · no trigger passed", "Manual · ...", "Held · ...". */
  reason: string
  /** A manual pick that is not the active stack yet. */
  pendingId: string | null
  manualId: string | null
}

function lastChangeInto(combat: CombatState, id: string): StackChangedEvent | null {
  for (let index = combat.log.length - 1; index >= 0; index -= 1) {
    const event = combat.log[index]
    if (event !== undefined && event.type === 'stackChanged' && event.actorId === combat.hero.id) return event.toId === id ? event : null
  }
  return null
}

export function summarizeStack(combat: CombatState): StackSummary {
  const { hero } = combat
  const state = hero.stackState ?? { activeId: DEFAULT_STACK_ID, sinceMs: null, manualId: null }
  const activeId = state.activeId
  const manualId = state.manualId
  const activeName = stackName(hero, activeId)
  const pendingId = manualId !== null && manualId !== activeId ? manualId : null
  let reason: string
  if (manualId !== null && manualId === activeId) {
    reason = 'Manual · until the fight ends'
  } else {
    const change = lastChangeInto(combat, activeId)
    if (activeId === DEFAULT_STACK_ID) reason = 'Default · no trigger passed'
    else if (change !== null && change.reason === 'trigger' && change.detail !== null) reason = `Auto · ${change.detail}`
    else if (change !== null && change.reason === 'manualCleared') reason = 'Auto · picked by the rules'
    else reason = 'Auto'
    // Held: the rules would drop to a lower stack, but the 2 s hold after the last switch is not over. Asked of the sim itself
    // by evaluating the pick at the moment the hold ends, so the UI repeats no rule.
    if (manualId === null && state.sinceMs !== null && combat.outcome === 'ongoing') {
      const heldUntil = state.sinceMs + STACK_HOLD_MS
      if (combat.timeMs < heldUntil) {
        const later = pickStack(combat, defsForHold(), hero, heldUntil)
        if (later !== null && later.id !== activeId) {
          reason = `Held · dropping back in ${((heldUntil - combat.timeMs) / 1000).toFixed(1)} s`
        }
      }
    }
  }
  return { activeId, activeName, reason, pendingId, manualId }
}
