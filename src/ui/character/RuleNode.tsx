import { MAX_PRIORITY_ROWS, TARGET_LABELS, skillName, type RowDraft } from '../../persist/loadout.ts'
import { TARGET_PRIORITIES, type TargetPriority } from '../../sim/types.ts'
import { Tag } from '../Kit.tsx'

import type { ChainRule } from './chainModel.ts'
import { ConditionList } from './ConditionList.tsx'
import './character.css'

export type RuleNodeProps = {
  rule: ChainRule
  row: RowDraft
  rowCount: number
  open: boolean
  /** Times this row was used in the fight now running, or null with no data. */
  used: number | null
  classId: Parameters<typeof ConditionList>[0]['classId']
  skillIds: readonly string[]
  onToggle: () => void
  onPatch: (patch: Partial<RowDraft>) => void
  onMove: (delta: number) => void
  onDuplicate: () => void
  onRemove: () => void
}

/**
 * One rule in the chain. Closed it reads as: number and skill (primary), the rule sentence and target
 * (secondary), the use count (tertiary). Open it holds the existing editing controls.
 */
export function RuleNode({ rule, row, rowCount, open, used, classId, skillIds, onToggle, onPatch, onMove, onDuplicate, onRemove }: RuleNodeProps) {
  const number = rule.index + 1
  const panelId = `rc-edit-${rule.index}`
  const atLimit = rowCount >= MAX_PRIORITY_ROWS
  return (
    <div className={`rc-node${open ? ' rc-node--open' : ''}${rule.blank ? ' rc-node--blank' : ''}`} data-testid={`rule-node-${number}`}>
      <button type="button" className="rc-node-btn" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="rc-num" aria-hidden="true">
          {number}
        </span>
        <span className="rc-main">
          <span className="rc-title">{rule.title}</span>
          <span className="rc-badges">
            {rule.alwaysReady ? <Tag kind="info">Always when ready</Tag> : null}
            {rule.shadowedBy !== null ? (
              <Tag kind="bad" title={`Rule ${rule.shadowedBy} uses the same skill with no conditions, so this rule is never reached.`}>
                Never reached: rule {rule.shadowedBy} always wins
              </Tag>
            ) : null}
            {rule.blank ? <Tag kind="bad">Needs a skill</Tag> : null}
          </span>
          <span className="rc-sentence" aria-label={`Rule ${number} summary`}>
            {rule.sentence}
          </span>
        </span>
        <span className="rc-used" aria-label={used === null ? 'Used: no data' : `Used ${used} times this fight`}>
          {used === null ? 'Used —' : `Used ${used}×`}
        </span>
      </button>
      {open ? (
        <div className="rc-edit" id={panelId}>
          <div className="rc-controls">
            <label>
              Skill{' '}
              <select aria-label={`Rule ${number} skill`} value={row.skillId} onChange={(event) => onPatch({ skillId: event.target.value })}>
                <option value="">Pick a skill</option>
                {skillIds.map((id) => (
                  <option key={id} value={id}>
                    {skillName(id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target{' '}
              <select
                aria-label={`Rule ${number} target`}
                value={row.targetPriority}
                onChange={(event) => onPatch({ targetPriority: event.target.value as '' | TargetPriority })}
              >
                <option value="">Default target</option>
                {TARGET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TARGET_LABELS[priority]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ConditionList
            conditions={row.conditions}
            onChange={(next) => onPatch({ conditions: next })}
            classId={classId}
            skillIds={skillIds}
            label={`Rule ${number}`}
            removeLabel={(n) => `Remove condition ${n} from rule ${number}`}
          />
          <span className="rule-tools rc-tools">
            <button type="button" aria-label={`Move rule ${number} up`} disabled={rule.index === 0} onClick={() => onMove(-1)}>
              Move up
            </button>
            <button type="button" aria-label={`Move rule ${number} down`} disabled={rule.index === rowCount - 1} onClick={() => onMove(1)}>
              Move down
            </button>
            <button
              type="button"
              aria-label={`Duplicate rule ${number}`}
              disabled={atLimit}
              title={atLimit ? `A hero can have at most ${MAX_PRIORITY_ROWS} rules.` : undefined}
              onClick={onDuplicate}
            >
              Duplicate
            </button>
            <button type="button" aria-label={`Remove rule ${number}`} onClick={onRemove}>
              Remove
            </button>
          </span>
        </div>
      ) : null}
    </div>
  )
}
