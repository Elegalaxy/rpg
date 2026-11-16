import { Tag } from '../Kit.tsx'

import { stackFireTotal, type FireCounts, type RouterEntry } from './chainModel.ts'
import './character.css'

export const DEFAULT_TAB = 'default'

/**
 * The stack router: one row per extra stack in priority order, then "Otherwise: Default". Each row selects
 * that chain, so it keeps the tab roles and the ids the chain panel is labelled by.
 */
export function RuleRouter({
  entries,
  selected,
  counts,
  onSelect,
}: {
  entries: readonly RouterEntry[]
  selected: string
  counts: FireCounts | null
  onSelect: (id: string) => void
}) {
  function use(id: string): string {
    const total = stackFireTotal(counts, id)
    return total === null ? 'Used —' : `Used ${total}×`
  }
  return (
    <div className="rc-router" role="tablist" aria-label="Rule stacks" data-testid="rule-router">
      {entries.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          id={`stack-tab-${entry.id}`}
          aria-selected={selected === entry.id}
          aria-controls="stack-panel"
          className="rc-router-btn"
          title={entry.trigger}
          onClick={() => onSelect(entry.id)}
        >
          <span className="rc-router-pos" aria-hidden="true">
            {index + 1}
          </span>
          <span className="rc-router-main">
            <span className="rc-title">{entry.name}</span>
            <span className="rc-sentence">{entry.auto ? `When ${entry.trigger}` : entry.trigger}</span>
          </span>
          <Tag kind={entry.auto ? 'info' : 'plain'}>{entry.auto ? 'Auto' : 'Manual only'}</Tag>
          <span className="rc-used">{use(entry.id)}</span>
        </button>
      ))}
      <button
        type="button"
        role="tab"
        id="stack-tab-default"
        aria-selected={selected === DEFAULT_TAB}
        aria-controls="stack-panel"
        className="rc-router-btn rc-router-btn--default"
        onClick={() => onSelect(DEFAULT_TAB)}
      >
        <span className="rc-router-pos" aria-hidden="true">
          ↳
        </span>
        <span className="rc-router-main">
          <span className="rc-title">Otherwise: Default</span>
          <span className="rc-sentence">When no stack above applies</span>
        </span>
        <Tag kind="plain">Fallback</Tag>
        <span className="rc-used">{use(DEFAULT_TAB)}</span>
      </button>
    </div>
  )
}
