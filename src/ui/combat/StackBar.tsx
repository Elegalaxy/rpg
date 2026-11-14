import { stackName } from '../../sim/stacks.ts'
import { DEFAULT_STACK_ID, type CombatState } from '../../sim/types.ts'
import { Help } from '../Help.tsx'
import { Tag } from '../Kit.tsx'
import { pickStackFromUi } from '../store.ts'

import { hasStacks, summarizeStack } from './stackSummary.ts'
import './combat.css'

/** Auto plus every stack (Default included) as toggle buttons. Each is at least 44 px tall and the row wraps. */
export function StackPicker({ combat, onPick = pickStackFromUi }: { combat: CombatState; onPick?: (id: string | null) => void }) {
  const live = combat.outcome === 'ongoing'
  const summary = summarizeStack(combat)
  const stacks = combat.hero.ruleStacks ?? []
  const options: { id: string | null; label: string }[] = [
    { id: null, label: 'Auto' },
    { id: DEFAULT_STACK_ID, label: 'Default' },
    ...stacks.map((stack) => ({ id: stack.id, label: stack.name })),
  ]
  return (
    <div className="rs-picker" role="group" aria-label="Rule stack" data-testid="stack-picker">
      {options.map((option) => (
        <button
          key={option.id ?? 'auto'}
          type="button"
          className="rs-pick"
          aria-pressed={summary.manualId === option.id}
          disabled={!live}
          title={live ? (option.id === null ? 'Let the triggers choose' : `Use ${option.label} from the next action until the fight ends`) : 'The fight is over.'}
          onClick={() => onPick(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Which rule stack is active and why, with a picker. Rendered only for a hero that has extra stacks. */
export function StackBar({ combat, onPick }: { combat: CombatState; onPick?: (id: string | null) => void }) {
  if (!hasStacks(combat)) return null
  const summary = summarizeStack(combat)
  return (
    <div className="rs-bar" aria-label="Rule stacks" data-testid="stack-bar">
      <div className="rs-bar-head">
        <strong className="rs-bar-name" data-testid="stack-active" title={summary.activeName}>
          Stack: {summary.activeName}
        </strong>
        {/* One fixed-width slot holds the pending-pick tag, so it never reflows the row. */}
        <span className="queue-slot rs-pending-slot">
          {summary.pendingId !== null ? (
            <Tag kind="info" testId="stack-pending" title={`${stackName(combat.hero, summary.pendingId)} starts at the next action`}>
              Next action
            </Tag>
          ) : null}
        </span>
        <Help label="About rule stacks">
          The hero reads one named stack of rules at a time. Auto lets each stack's trigger choose, switching up at once and down after a 2 s hold. Picking a stack takes effect at the next action and lasts until the fight ends or you pick Auto.
        </Help>
      </div>
      <p className="rs-bar-reason muted" data-testid="stack-reason" title={summary.reason}>
        {summary.reason}
      </p>
      <StackPicker combat={combat} onPick={onPick} />
    </div>
  )
}
