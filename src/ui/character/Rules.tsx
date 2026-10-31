import { useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  COMPARE_LABELS,
  CONDITION_KINDS,
  MAX_PRIORITY_ROWS,
  RESOURCE_NAMES,
  STATUS_CHOICES,
  TARGET_LABELS,
  draftsFromRows,
  kindsFor,
  newCondition,
  ruleSkillIds,
  skillName,
  validateRules,
  type ConditionDraft,
  type ConditionType,
  type RowDraft,
} from '../../persist/loadout.ts'
import type { SavedHero } from '../../persist/save.ts'
import { TARGET_PRIORITIES, type TargetPriority } from '../../sim/types.ts'
import { saveRulesFromUi, useSaveStatus } from '../store.ts'

function RulesForm({ hero }: { hero: SavedHero }) {
  const [rows, setRows] = useState<RowDraft[]>(() => draftsFromRows(hero.priorityRows))
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const skillIds = ruleSkillIds(hero)
  const kinds = kindsFor(hero.classId)

  function update(next: RowDraft[]): void {
    setRows(next)
    setSaved(false)
    setErrors([])
  }

  function patchRow(index: number, patch: Partial<RowDraft>): void {
    update(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  }

  function patchCondition(index: number, conditionIndex: number, patch: Partial<ConditionDraft>): void {
    patchRow(index, {
      conditions: rows[index]!.conditions.map((condition, at) => (at === conditionIndex ? { ...condition, ...patch } : condition)),
    })
  }

  function move(index: number, delta: number): void {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [row] = next.splice(index, 1)
    if (row === undefined) return
    next.splice(target, 0, row)
    update(next)
  }

  function save(): void {
    const problem = saveRulesFromUi(rows)
    setErrors(problem)
    setSaved(problem.length === 0)
  }

  const live = validateRules(hero, rows)
  return (
    <section aria-label="Priority rules">
      <h2>Priority rules — {hero.name}</h2>
      <p>
        The hero tries rule 1 first, then the next, and uses the first skill whose conditions pass. Rules: {rows.length} of{' '}
        {MAX_PRIORITY_ROWS}. {RESOURCE_NAMES[hero.classId]} is this class resource.
      </p>
      <ol>
        {rows.map((row, index) => (
          <li key={index}>
            <label>
              Skill{' '}
              <select
                aria-label={`Rule ${index + 1} skill`}
                value={row.skillId}
                onChange={(event) => patchRow(index, { skillId: event.target.value })}
              >
                <option value="">Pick a skill</option>
                {skillIds.map((id) => (
                  <option key={id} value={id}>
                    {skillName(id)}
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              Target{' '}
              <select
                aria-label={`Rule ${index + 1} target`}
                value={row.targetPriority}
                onChange={(event) => patchRow(index, { targetPriority: event.target.value as '' | TargetPriority })}
              >
                <option value="">Default target</option>
                {TARGET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TARGET_LABELS[priority]}
                  </option>
                ))}
              </select>
            </label>{' '}
            <button type="button" aria-label={`Move rule ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </button>{' '}
            <button
              type="button"
              aria-label={`Move rule ${index + 1} down`}
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>{' '}
            <button type="button" aria-label={`Remove rule ${index + 1}`} onClick={() => update(rows.filter((_, at) => at !== index))}>
              Remove
            </button>
            <ul>
              {row.conditions.map((condition, conditionIndex) => {
                const kind = CONDITION_KINDS.find((entry) => entry.type === condition.type)
                return (
                  <li key={conditionIndex}>
                    <select
                      aria-label={`Rule ${index + 1} condition ${conditionIndex + 1} type`}
                      value={condition.type}
                      onChange={(event) => patchCondition(index, conditionIndex, newCondition(event.target.value as ConditionType))}
                    >
                      {kinds.map((entry) => (
                        <option key={entry.type} value={entry.type}>
                          {entry.type === 'resource' ? RESOURCE_NAMES[hero.classId] : entry.label}
                        </option>
                      ))}
                    </select>{' '}
                    {condition.type === 'targetStatus' || condition.type === 'heroStatus' || condition.type === 'targetStacks' ? (
                      <select
                        aria-label={`Rule ${index + 1} condition ${conditionIndex + 1} status`}
                        value={condition.statusId}
                        onChange={(event) => patchCondition(index, conditionIndex, { statusId: event.target.value })}
                      >
                        {STATUS_CHOICES.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    ) : null}{' '}
                    <select
                      aria-label={`Rule ${index + 1} condition ${conditionIndex + 1} comparison`}
                      value={condition.operator}
                      onChange={(event) => patchCondition(index, conditionIndex, { operator: event.target.value })}
                    >
                      {(kind?.operators ?? []).map((operator) => (
                        <option key={operator} value={operator}>
                          {COMPARE_LABELS[operator]}
                        </option>
                      ))}
                    </select>{' '}
                    {kind?.numeric === true ? (
                      <input
                        aria-label={`Rule ${index + 1} condition ${conditionIndex + 1} value`}
                        value={condition.value}
                        inputMode="decimal"
                        size={5}
                        onChange={(event) => patchCondition(index, conditionIndex, { value: event.target.value })}
                      />
                    ) : null}{' '}
                    <button
                      type="button"
                      aria-label={`Remove condition ${conditionIndex + 1} from rule ${index + 1}`}
                      onClick={() => patchRow(index, { conditions: row.conditions.filter((_, at) => at !== conditionIndex) })}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() => patchRow(index, { conditions: [...row.conditions, newCondition(kinds[0]?.type ?? 'heroHp')] })}
            >
              Add condition
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={rows.length >= MAX_PRIORITY_ROWS}
        onClick={() => update([...rows, { skillId: '', conditions: [], targetPriority: '', kept: [] }])}
      >
        Add rule
      </button>{' '}
      <button type="button" disabled={!live.ok} onClick={save}>
        Save rules
      </button>
      {!live.ok ? (
        <ul role="alert" aria-label="Rule problems">
          {live.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {errors.length > 0 ? (
        <ul role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {saved ? <p>Rules saved.</p> : null}
    </section>
  )
}

export function Rules() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  if (hero === null) {
    return (
      <section aria-label="Priority rules">
        <h2>Priority rules</h2>
        <p>Select a hero to edit their rules.</p>
      </section>
    )
  }
  return <RulesForm key={`${hero.id}:${hero.progress.loadout.join(',')}`} hero={hero} />
}
