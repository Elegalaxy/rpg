import { useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  MAX_PRIORITY_ROWS,
  MAX_RULE_STACKS,
  MAX_STACK_NAME_LENGTH,
  RESOURCE_NAMES,
  TARGET_LABELS,
  draftsFromRows,
  draftsFromStacks,
  ruleSkillIds,
  skillName,
  summarizeRule,
  summarizeTrigger,
  validateRules,
  validateStacks,
  type RowDraft,
  type StackDraft,
} from '../../persist/loadout.ts'
import type { SavedHero } from '../../persist/save.ts'
import { TARGET_PRIORITIES, type TargetPriority } from '../../sim/types.ts'
import { Collapsible } from '../Collapsible.tsx'
import { Help } from '../Help.tsx'
import { Tag } from '../Kit.tsx'
import { saveRulesFromUi, useSaveStatus } from '../store.ts'

import { ConditionList } from './ConditionList.tsx'
import { addStack, deleteStack, duplicateStack, hasTrigger, moveStack, patchStack } from './stackEdit.ts'

function copyRow(row: RowDraft): RowDraft {
  return { ...row, conditions: row.conditions.map((condition) => ({ ...condition })), kept: [...(row.kept ?? [])] }
}

const DEFAULT_TAB = 'default'

export function RulesForm({ hero, initialTab = DEFAULT_TAB }: { hero: SavedHero; initialTab?: string }) {
  const [rows, setRows] = useState<RowDraft[]>(() => draftsFromRows(hero.priorityRows))
  const [stacks, setStacks] = useState<StackDraft[]>(() => draftsFromStacks(hero.ruleStacks))
  const [tab, setTab] = useState<string>(initialTab)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const skillIds = ruleSkillIds(hero)

  const stack = stacks.find((entry) => entry.id === tab)
  const stackIndex = stack === undefined ? -1 : stacks.indexOf(stack)
  const activeRows = stack === undefined ? rows : stack.rows
  const atStackLimit = stacks.length >= MAX_RULE_STACKS
  const limitText = `A hero can have at most ${MAX_RULE_STACKS + 1} stacks.`

  function touch(): void {
    setSaved(false)
    setErrors([])
  }

  function updateStacks(next: StackDraft[]): void {
    setStacks(next)
    touch()
  }

  function update(next: RowDraft[]): void {
    if (stack === undefined) setRows(next)
    else setStacks(patchStack(stacks, stack.id, { rows: next }))
    touch()
  }

  function patchRow(index: number, patch: Partial<RowDraft>): void {
    update(activeRows.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  }

  function move(index: number, delta: number): void {
    const target = index + delta
    if (target < 0 || target >= activeRows.length) return
    const next = [...activeRows]
    const [row] = next.splice(index, 1)
    if (row === undefined) return
    next.splice(target, 0, row)
    update(next)
  }

  function selectTab(id: string): void {
    setTab(id)
    setConfirmDelete(false)
  }

  function createStack(): void {
    const next = addStack(stacks)
    updateStacks(next)
    setTab(next[next.length - 1]!.id)
    setConfirmDelete(false)
  }

  function save(): void {
    // A hero with no stacks saves exactly as before; stacks are written only when there are some to write or to clear.
    const keepStacks = stacks.length > 0 || hero.ruleStacks.length > 0
    const problem = saveRulesFromUi(rows, keepStacks ? stacks : undefined)
    setErrors(problem)
    setSaved(problem.length === 0)
  }

  const liveRules = validateRules(hero, rows)
  const liveStacks = stacks.length > 0 ? validateStacks(hero, stacks) : null
  const liveErrors = [...(liveRules.ok ? [] : liveRules.errors), ...(liveStacks === null || liveStacks.ok ? [] : liveStacks.errors)]
  const liveOk = liveErrors.length === 0
  return (
    <section aria-label="Priority rules">
      <h2>Priority rules — {hero.name}</h2>
      <div className="stack-bar">
        {stacks.length > 0 ? (
          <div className="stack-tabs" role="tablist" aria-label="Rule stacks">
            <button
              type="button"
              role="tab"
              id="stack-tab-default"
              aria-selected={tab === DEFAULT_TAB}
              aria-controls="stack-panel"
              className="stack-tab"
              onClick={() => selectTab(DEFAULT_TAB)}
            >
              Default <Tag kind="plain">Fallback</Tag>
            </button>
            {stacks.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`stack-tab-${entry.id}`}
                aria-selected={tab === entry.id}
                aria-controls="stack-panel"
                className="stack-tab"
                title={summarizeTrigger(entry, hero.classId)}
                onClick={() => selectTab(entry.id)}
              >
                {entry.name} <Tag kind={hasTrigger(entry) ? 'info' : 'plain'}>{hasTrigger(entry) ? 'Auto' : 'Manual only'}</Tag>
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="stack-new" disabled={atStackLimit} title={atStackLimit ? limitText : undefined} onClick={createStack}>
          New stack
        </button>
        <Help label="What a stack is">
          A stack is a second set of rules over the same equipped skills. The hero switches to the first stack whose trigger passes, otherwise the Default rules.
        </Help>
        {atStackLimit ? <span className="muted-inline">{limitText}</span> : null}
      </div>
      <div id="stack-panel" role={stacks.length > 0 ? 'tabpanel' : undefined} aria-labelledby={stack === undefined ? 'stack-tab-default' : `stack-tab-${stack.id}`}>
        {stack !== undefined ? (
          <div className="stack-card" data-testid="stack-card">
            <div className="stack-card-head">
              <label>
                Stack name{' '}
                <input
                  aria-label="Stack name"
                  value={stack.name}
                  maxLength={MAX_STACK_NAME_LENGTH}
                  size={20}
                  onChange={(event) => updateStacks(patchStack(stacks, stack.id, { name: event.target.value }))}
                />
              </label>
              <span className="rule-tools">
                <button type="button" aria-label={`Move stack ${stack.name} up`} disabled={stackIndex === 0} onClick={() => updateStacks(moveStack(stacks, stack.id, -1))}>
                  Move up
                </button>
                <button
                  type="button"
                  aria-label={`Move stack ${stack.name} down`}
                  disabled={stackIndex === stacks.length - 1}
                  onClick={() => updateStacks(moveStack(stacks, stack.id, 1))}
                >
                  Move down
                </button>
                <button
                  type="button"
                  aria-label={`Duplicate stack ${stack.name}`}
                  disabled={atStackLimit}
                  title={atStackLimit ? limitText : undefined}
                  onClick={() => {
                    const next = duplicateStack(stacks, stack.id)
                    updateStacks(next)
                    const copy = next[stackIndex + 1]
                    if (copy !== undefined) setTab(copy.id)
                  }}
                >
                  Duplicate
                </button>
                <button type="button" aria-label={`Delete stack ${stack.name}`} onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              </span>
            </div>
            {confirmDelete ? (
              <p role="alert" className="stack-confirm">
                Delete stack "{stack.name}" and its {stack.rows.length} {stack.rows.length === 1 ? 'rule' : 'rules'}?{' '}
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    updateStacks(deleteStack(stacks, stack.id))
                    selectTab(DEFAULT_TAB)
                  }}
                >
                  Delete stack
                </button>{' '}
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </p>
            ) : null}
            <h3 className="stack-when-title">
              Switch to this stack when
              <Help label="How stack triggers work">
                All must pass. Stacks higher in the list take over at once; switching down waits 2 s. The fight log names every switch.
              </Help>
            </h3>
            <p className="rule-summary" aria-label="Stack trigger summary">
              {summarizeTrigger(stack, hero.classId)}.
            </p>
            <ConditionList
              conditions={stack.when}
              onChange={(next) => updateStacks(patchStack(stacks, stack.id, { when: next }))}
              classId={hero.classId}
              skillIds={skillIds}
              label="Stack trigger"
              removeLabel={(n) => `Remove trigger condition ${n}`}
            />
            {(stack.keptWhen ?? []).length > 0 ? (
              <p className="muted-inline">This trigger also keeps conditions that this editor cannot change.</p>
            ) : null}
          </div>
        ) : null}
        <p>
          {stack === undefined ? 'Rules' : `Rules in ${stack.name}`}: {activeRows.length} of {MAX_PRIORITY_ROWS}.
          <Help label="How rules work">
            The hero tries rule 1 first, then the next, and uses the first skill whose conditions pass. {RESOURCE_NAMES[hero.classId]} is this class resource.
          </Help>
        </p>
        <ol className="rule-list">
          {activeRows.map((row, index) => (
            <li key={index} className="rule-item">
              <div className="rule-head">
                <span className="rule-num" aria-hidden="true">
                  {index + 1}
                </span>
                <label>
                  Skill{' '}
                  <select aria-label={`Rule ${index + 1} skill`} value={row.skillId} onChange={(event) => patchRow(index, { skillId: event.target.value })}>
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
                </label>
                <span className="rule-tools">
                  <button type="button" aria-label={`Move rule ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </button>{' '}
                  <button
                    type="button"
                    aria-label={`Move rule ${index + 1} down`}
                    disabled={index === activeRows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>{' '}
                  <button
                    type="button"
                    aria-label={`Duplicate rule ${index + 1}`}
                    disabled={activeRows.length >= MAX_PRIORITY_ROWS}
                    title={activeRows.length >= MAX_PRIORITY_ROWS ? `A hero can have at most ${MAX_PRIORITY_ROWS} rules.` : undefined}
                    onClick={() => update([...activeRows.slice(0, index + 1), copyRow(row), ...activeRows.slice(index + 1)])}
                  >
                    Duplicate
                  </button>{' '}
                  <button type="button" aria-label={`Remove rule ${index + 1}`} onClick={() => update(activeRows.filter((_, at) => at !== index))}>
                    Remove
                  </button>
                </span>
              </div>
              <p className="rule-summary" aria-label={`Rule ${index + 1} summary`}>
                {summarizeRule(row, hero.classId)}
              </p>
              <Collapsible
                defaultOpen={row.conditions.length === 0}
                summary={
                  <>
                    <strong>Conditions</strong>
                    <span className="fold-count">{row.conditions.length}</span>
                  </>
                }
              >
                <ConditionList
                  conditions={row.conditions}
                  onChange={(next) => patchRow(index, { conditions: next })}
                  classId={hero.classId}
                  skillIds={skillIds}
                  label={`Rule ${index + 1}`}
                  removeLabel={(n) => `Remove condition ${n} from rule ${index + 1}`}
                />
              </Collapsible>
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={activeRows.length >= MAX_PRIORITY_ROWS}
          onClick={() => update([...activeRows, { skillId: '', conditions: [], targetPriority: '', kept: [] }])}
        >
          Add rule
        </button>
      </div>{' '}
      <button type="button" disabled={!liveOk} onClick={save}>
        Save rules
      </button>
      {!liveOk ? (
        <ul role="alert" aria-label="Rule problems">
          {liveErrors.map((message) => (
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
  return <RulesForm key={`${hero.id}:${hero.progress.loadout.join(',')}:${hero.ruleStacks.length}`} hero={hero} />
}
