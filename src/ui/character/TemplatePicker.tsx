import type { RuleTemplate, TemplateSituation } from '../../content/ruleTemplates.ts'
import { MAX_RULE_STACKS } from '../../persist/loadout.ts'
import type { TemplateOption } from '../../persist/ruleTemplates.ts'
import { Tag } from '../Kit.tsx'

import './character.css'

const SITUATIONS: readonly { id: TemplateSituation; title: string }[] = [
  { id: 'damage', title: 'Dealing damage' },
  { id: 'defense', title: 'Staying alive' },
  { id: 'crowd', title: 'Groups' },
  { id: 'boss', title: 'Bosses' },
]

/**
 * Starter scaffolds, grouped by situation. Choosing one only fills the draft; every card says what it gives up and
 * leaves a blank for the player. Locked cards are disabled and say how to unlock them.
 */
export function TemplatePicker({
  options,
  atStackLimit,
  replacing,
  onApply,
  onConfirmReplace,
  onCancelReplace,
  onClose,
}: {
  options: readonly TemplateOption[]
  atStackLimit: boolean
  /** A rows template waiting for the player to confirm replacing the rules in the chain. */
  replacing: { template: RuleTemplate; ruleCount: number; chainName: string } | null
  onApply: (template: RuleTemplate) => void
  onConfirmReplace: () => void
  onCancelReplace: () => void
  onClose: () => void
}) {
  return (
    <section className="rc-picker" aria-label="Rule templates" data-testid="template-picker">
      <div className="rc-picker-head">
        <h3>Start from a template</h3>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted-inline">A template fills in a first draft with a blank for you to decide. Nothing is saved until you press Save rules.</p>
      {replacing !== null ? (
        <p role="alert" className="rc-replace">
          Replace the {replacing.ruleCount} {replacing.ruleCount === 1 ? 'rule' : 'rules'} in {replacing.chainName} with {replacing.template.name}?{' '}
          <button type="button" className="btn-danger" onClick={onConfirmReplace}>
            Replace rules
          </button>{' '}
          <button type="button" onClick={onCancelReplace}>
            Keep mine
          </button>
        </p>
      ) : null}
      {SITUATIONS.map((situation) => {
        const group = options.filter((option) => option.template.situation === situation.id)
        if (group.length === 0) return null
        return (
          <div key={situation.id} className="rc-picker-group">
            <h4>{situation.title}</h4>
            <ul className="rc-picker-list">
              {group.map((option) => {
                const { template } = option
                const stackBlocked = template.kind === 'stack' && atStackLimit
                const disabled = !option.unlocked || stackBlocked
                const reason = !option.unlocked
                  ? option.lockedReason
                  : stackBlocked
                    ? `A hero can have at most ${MAX_RULE_STACKS + 1} stacks.`
                    : null
                return (
                  <li key={template.id}>
                    <button
                      type="button"
                      className="rc-card"
                      aria-label={`Use template ${template.name}`}
                      disabled={disabled}
                      title={reason ?? undefined}
                      onClick={() => onApply(template)}
                    >
                      <span className="rc-card-head">
                        <span className="rc-title">{template.name}</span>
                        <Tag kind="plain">{template.kind === 'stack' ? 'New stack' : 'Rules'}</Tag>
                        {!option.unlocked ? <Tag kind="bad">Locked</Tag> : null}
                      </span>
                      <span className="rc-sentence">{template.summary}</span>
                      <span className="rc-tradeoff">Gives up: {template.tradeOff}</span>
                      <span className="rc-card-reason">{reason ?? ''}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
