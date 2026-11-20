import {
  CONDITION_KINDS,
  RESOURCE_NAMES,
  STATUS_CHOICES,
  kindsFor,
  newCondition,
  operatorLabel,
  type ConditionDraft,
  type ConditionType,
} from '../../persist/loadout.ts'
import type { HeroClass } from '../../sim/constants.ts'

import { skillOptions } from './chainModel.ts'

/**
 * The condition editor shared by a rule row and a stack trigger. `label` prefixes every control's
 * accessible name ("Rule 2", "Stack trigger"); `removeLabel` names the remove button.
 */
export function ConditionList({
  conditions,
  onChange,
  classId,
  skillIds,
  waiting = [],
  label,
  removeLabel,
}: {
  conditions: readonly ConditionDraft[]
  onChange: (next: ConditionDraft[]) => void
  classId: HeroClass
  skillIds: readonly string[]
  /** Skills kept rules wait for, listed as not relearned. */
  waiting?: readonly string[]
  label: string
  removeLabel: (conditionNumber: number) => string
}) {
  const kinds = kindsFor(classId)

  function patch(index: number, change: Partial<ConditionDraft>): void {
    onChange(conditions.map((condition, at) => (at === index ? { ...condition, ...change } : condition)))
  }

  return (
    <>
      <ul className="rule-conditions">
        {conditions.map((condition, conditionIndex) => {
          const kind = CONDITION_KINDS.find((entry) => entry.type === condition.type)
          return (
            <li key={conditionIndex}>
              <select
                aria-label={`${label} condition ${conditionIndex + 1} type`}
                value={condition.type}
                onChange={(event) => patch(conditionIndex, newCondition(event.target.value as ConditionType))}
              >
                {kinds.map((entry) => (
                  <option key={entry.type} value={entry.type}>
                    {entry.type === 'resource' ? RESOURCE_NAMES[classId] : entry.label}
                  </option>
                ))}
              </select>{' '}
              {condition.type === 'targetStatus' || condition.type === 'heroStatus' || condition.type === 'targetStacks' || condition.type === 'heroStacks' ? (
                <select
                  aria-label={`${label} condition ${conditionIndex + 1} status`}
                  value={condition.statusId}
                  onChange={(event) => patch(conditionIndex, { statusId: event.target.value })}
                >
                  {STATUS_CHOICES.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              ) : null}{' '}
              {condition.type === 'skillReady' ? (
                <select
                  aria-label={`${label} condition ${conditionIndex + 1} skill`}
                  value={condition.skillId ?? ''}
                  onChange={(event) => patch(conditionIndex, { skillId: event.target.value })}
                >
                  <option value="">Pick a skill</option>
                  {skillOptions(skillIds, waiting).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}{' '}
              <select
                aria-label={`${label} condition ${conditionIndex + 1} comparison`}
                value={condition.operator}
                onChange={(event) => patch(conditionIndex, { operator: event.target.value })}
              >
                {(kind?.operators ?? []).map((operator) => (
                  <option key={operator} value={operator}>
                    {operatorLabel(condition.type, operator)}
                  </option>
                ))}
              </select>{' '}
              {kind?.numeric === true ? (
                <input
                  aria-label={`${label} condition ${conditionIndex + 1} value`}
                  value={condition.value}
                  inputMode="decimal"
                  size={5}
                  onChange={(event) => patch(conditionIndex, { value: event.target.value })}
                />
              ) : null}{' '}
              {condition.type === 'telegraph' || condition.type === 'telegraphWithin' || condition.type === 'interruptible' ? (
                <span className="muted-inline rule-hint" data-testid="telegraph-hint">
                  Watches every enemy. Answer with Shield Brace, Ward, Mana Ward, Fade Back or Ward Charm. Interrupt by dealing the shown HP during the wind-up.
                </span>
              ) : null}
              <button type="button" aria-label={removeLabel(conditionIndex + 1)} onClick={() => onChange(conditions.filter((_, at) => at !== conditionIndex))}>
                ×
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="rule-add" onClick={() => onChange([...conditions, newCondition(kinds[0]?.type ?? 'heroHp')])}>
        Add condition
      </button>
    </>
  )
}
