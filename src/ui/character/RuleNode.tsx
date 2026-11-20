import { MAX_PRIORITY_ROWS, TARGET_LABELS, type RowDraft } from '../../persist/loadout.ts'
import { TARGET_PRIORITIES, type TargetPriority } from '../../sim/types.ts'
import { skillFacts } from '../skillInfo.ts'
import { Tag } from '../Kit.tsx'

import { skillOptions, type ChainRule } from './chainModel.ts'
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
  /** Skills the kept rules wait for. The menus list them as not relearned (Step 13.37). */
  waiting?: readonly string[]
  /** The hero's learned skill-web nodes, so the skill facts count their bonuses. */
  nodeIds?: readonly string[]
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
export function RuleNode({ rule, row, rowCount, open, used, classId, skillIds, waiting = [], nodeIds, onToggle, onPatch, onMove, onDuplicate, onRemove }: RuleNodeProps) {
  const number = rule.index + 1
  const panelId = `rc-edit-${rule.index}`
  const atLimit = rowCount >= MAX_PRIORITY_ROWS
  return (
    <div className={`rc-node${open ? ' rc-node--open' : ''}${rule.blank ? ' rc-node--blank' : ''}${rule.waitingFor !== null ? ' rc-node--waiting' : ''}`} data-testid={`rule-node-${number}`}>
      <button type="button" className="rc-node-btn" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="rc-num" aria-hidden="true">
          {number}
        </span>
        <span className="rc-main">
          <span className="rc-headline">
            <span className="rc-title">{rule.title}</span>
            <span className="rc-badges">
              {rule.alwaysReady ? <Tag kind="info">Always when ready</Tag> : null}
              {rule.shadowedBy !== null ? (
                <Tag kind="bad" title={`Rule ${rule.shadowedBy} uses the same skill with no conditions, so this rule is never reached.`}>
                  Never reached: rule {rule.shadowedBy} always wins
                </Tag>
              ) : null}
              {rule.waitingFor !== null ? (
                <Tag kind="info" title="Kept from your last life. It is left out of fights until you can use that skill again.">
                  Waiting for {rule.waitingFor}
                </Tag>
              ) : null}
              {rule.blank ? <Tag kind="bad">Needs a skill</Tag> : null}
            </span>
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
                {skillOptions(skillIds, waiting).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
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
          <SkillFactsBox skillId={row.skillId} nodeIds={nodeIds} />
          <ConditionList
            conditions={row.conditions}
            onChange={(next) => onPatch({ conditions: next })}
            classId={classId}
            skillIds={skillIds}
            waiting={waiting}
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

/** What the picked skill costs, how often it fires and what it does, so the rule can be written without leaving this tab. */
function SkillFactsBox({ skillId, nodeIds }: { skillId: string; nodeIds?: readonly string[] }) {
  const facts = skillId === '' ? null : skillFacts(skillId, nodeIds)
  if (facts === null) return null
  return (
    <div className="rc-skill-facts" data-testid="rule-skill-facts">
      <strong>{facts.name}</strong>
      <span className="rc-skill-stats">{facts.stats.join(' · ')}</span>
      <span className="rc-skill-effects muted">{facts.effects.join('. ')}</span>
    </div>
  )
}
