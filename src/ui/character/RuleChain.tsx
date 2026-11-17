import { MAX_PRIORITY_ROWS, type RowDraft } from '../../persist/loadout.ts'
import type { SavedHero } from '../../persist/save.ts'

import { buildRules, fallbackText, fireCount, type FireCounts } from './chainModel.ts'
import { RuleNode } from './RuleNode.tsx'
import './character.css'

export type RuleChainProps = {
  hero: SavedHero
  rows: readonly RowDraft[]
  /** Which chain this is, for the fire counts. */
  stackId: string
  skillIds: readonly string[]
  open: number | null
  counts: FireCounts | null
  /** A removed rule the player can still take back. */
  removed: boolean
  onOpen: (index: number | null) => void
  onPatch: (index: number, patch: Partial<RowDraft>) => void
  onMove: (index: number, delta: number) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
  onUndo: () => void
  /** Offered in the empty state when given. */
  onStartTemplate?: () => void
}

/** The decision chain: rule nodes joined by "else", ending in the Fallback. */
export function RuleChain({
  hero,
  rows,
  stackId,
  skillIds,
  open,
  counts,
  removed,
  onOpen,
  onPatch,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
  onUndo,
  onStartTemplate,
}: RuleChainProps) {
  const rules = buildRules(hero, rows)
  const atLimit = rows.length >= MAX_PRIORITY_ROWS
  const limitText = `A hero can have at most ${MAX_PRIORITY_ROWS} rules.`
  return (
    <div className="rc-chain" data-testid="rule-chain">
      {removed ? (
        <p className="rc-removed" role="status">
          Rule removed.{' '}
          <button type="button" onClick={onUndo}>
            Undo
          </button>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="rc-empty" data-testid="rule-chain-empty">
          <p>No rules: the hero uses the Fallback.</p>
          <div className="rc-empty-actions">
            {onStartTemplate !== undefined ? (
              <button type="button" className="btn-primary" onClick={onStartTemplate}>
                Start from template
              </button>
            ) : null}
            <button type="button" onClick={onAdd}>
              Add rule
            </button>
          </div>
        </div>
      ) : null}
      <ol className="rc-list">
        {rules.map((rule) => (
          <li key={rule.index} className="rc-item">
            <RuleNode
              rule={rule}
              row={rows[rule.index]!}
              rowCount={rows.length}
              open={open === rule.index}
              used={fireCount(counts, stackId, rule.index)}
              classId={hero.classId}
              skillIds={skillIds}
              nodeIds={hero.progress.allocatedNodeIds}
              onToggle={() => onOpen(open === rule.index ? null : rule.index)}
              onPatch={(patch) => onPatch(rule.index, patch)}
              onMove={(delta) => onMove(rule.index, delta)}
              onDuplicate={() => onDuplicate(rule.index)}
              onRemove={() => onRemove(rule.index)}
            />
            <span className="rc-else" aria-hidden="true">
              else
            </span>
          </li>
        ))}
        {rows.length > 0 ? (
          <li className="rc-item rc-item--add">
            <button type="button" className="rc-add" disabled={atLimit} onClick={onAdd}>
              Add rule
            </button>
            {atLimit ? <span className="muted-inline rc-add-reason">{limitText}</span> : null}
            <span className="rc-else" aria-hidden="true">
              else
            </span>
          </li>
        ) : null}
        <li className="rc-item rc-fallback" data-testid="rule-fallback">
          <span className="rc-fallback-label">Fallback</span>
          <span className="rc-fallback-text">{fallbackText(hero.classId)}</span>
        </li>
      </ol>
    </div>
  )
}
