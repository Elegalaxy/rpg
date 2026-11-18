import { useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  MAX_PRIORITY_ROWS,
  MAX_RULE_STACKS,
  MAX_STACK_NAME_LENGTH,
  RESOURCE_NAMES,
  draftsFromRows,
  draftsFromStacks,
  ruleSkillIds,
  startingRuleDrafts,
  summarizeTrigger,
  validateRules,
  validateStacks,
  type RowDraft,
  type StackDraft,
} from '../../persist/loadout.ts'
import { applyTemplate, templatesFor } from '../../persist/ruleTemplates.ts'
import type { SaveData, SavedHero } from '../../persist/save.ts'
import type { RuleTemplate } from '../../content/ruleTemplates.ts'
import { Help } from '../Help.tsx'
import { GuideLink } from '../guide/GuideLink.tsx'
import { saveRulesFromUi, useSaveStatus } from '../store.ts'

import { ConditionList } from './ConditionList.tsx'
import { buildRouter } from './chainModel.ts'
import { useFireCounts } from './useFireCounts.ts'
import { RuleChain } from './RuleChain.tsx'
import { DEFAULT_TAB, RuleRouter } from './RuleRouter.tsx'
import { TemplatePicker } from './TemplatePicker.tsx'
import { addStack, deleteStack, duplicateStack, moveStack, patchStack } from './stackEdit.ts'

function copyRow(row: RowDraft): RowDraft {
  return { ...row, conditions: row.conditions.map((condition) => ({ ...condition })), kept: [...(row.kept ?? [])] }
}

export function RulesForm({
  hero,
  initialTab = DEFAULT_TAB,
  initialOpenRule = null,
  initialPicker = false,
  save: saveProp,
}: {
  hero: SavedHero
  initialTab?: string
  initialOpenRule?: number | null
  initialPicker?: boolean
  save?: SaveData
}) {
  const [rows, setRows] = useState<RowDraft[]>(() => draftsFromRows(hero.priorityRows))
  const [stacks, setStacks] = useState<StackDraft[]>(() => draftsFromStacks(hero.ruleStacks))
  const [tab, setTab] = useState<string>(initialTab)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openRule, setOpenRule] = useState<number | null>(initialOpenRule)
  const [removedRule, setRemovedRule] = useState<{ tab: string; index: number; row: RowDraft } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [beforeReset, setBeforeReset] = useState<RowDraft[] | null>(null)
  const [saved, setSaved] = useState(false)
  const skillIds = ruleSkillIds(hero)
  const [pickerOpen, setPickerOpen] = useState(initialPicker)
  const [replacing, setReplacing] = useState<RuleTemplate | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const status = useSaveStatus()
  const known = saveProp ?? status.save
  const options = templatesFor(hero, { ...known, heroes: [...known.heroes.filter((entry) => entry.id !== hero.id), hero] })
  const counts = useFireCounts(hero.id)

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
    reorder(index, index + delta)
  }

  function reorder(from: number, to: number): void {
    if (from === to || to < 0 || to >= activeRows.length) return
    const next = [...activeRows]
    const [row] = next.splice(from, 1)
    if (row === undefined) return
    next.splice(to, 0, row)
    update(next)
    if (openRule === null) return
    if (openRule === from) setOpenRule(to)
    else if (from < openRule && to >= openRule) setOpenRule(openRule - 1)
    else if (from > openRule && to <= openRule) setOpenRule(openRule + 1)
  }

  function selectTab(id: string): void {
    setTab(id)
    setConfirmDelete(false)
    setOpenRule(null)
    setRemovedRule(null)
  }

  function createStack(): void {
    const next = addStack(stacks)
    updateStacks(next)
    setTab(next[next.length - 1]!.id)
    setConfirmDelete(false)
    setOpenRule(null)
    setRemovedRule(null)
  }

  function applyChosen(template: RuleTemplate): void {
    const applied = applyTemplate(hero, template, stacks)
    if (applied.stack !== null) {
      const next = [...stacks, applied.stack]
      updateStacks(next)
      selectTab(applied.stack.id)
    } else {
      update(applied.rows)
      setOpenRule(null)
    }
    setNotes(applied.notes)
    setReplacing(null)
    setPickerOpen(false)
  }

  function chooseTemplate(template: RuleTemplate): void {
    if (template.kind === 'rows' && activeRows.length > 0) setReplacing(template)
    else applyChosen(template)
  }

  function save(): void {
    // A hero with no stacks saves exactly as before; stacks are written only when there are some to write or to clear.
    const keepStacks = stacks.length > 0 || hero.ruleStacks.length > 0
    const problem = saveRulesFromUi(rows, keepStacks ? stacks : undefined)
    setErrors(problem)
    setSaved(problem.length === 0)
    setRemovedRule(null)
    setBeforeReset(null)
  }

  const liveRules = validateRules(hero, rows)
  const liveStacks = stacks.length > 0 ? validateStacks(hero, stacks) : null
  const liveErrors = [...(liveRules.ok ? [] : liveRules.errors), ...(liveStacks === null || liveStacks.ok ? [] : liveStacks.errors)]
  const liveOk = liveErrors.length === 0
  return (
    <section aria-label="Priority rules">
      <h2>Priority rules — {hero.name}</h2>
      <div className="stack-bar">
        {stacks.length > 0 ? <RuleRouter entries={buildRouter(hero, stacks)} selected={tab} counts={counts} onSelect={selectTab} /> : null}
        <button type="button" className="stack-new" aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>
          Templates
        </button>
        <button type="button" className="stack-new" disabled={atStackLimit} title={atStackLimit ? limitText : undefined} onClick={createStack}>
          New stack
        </button>
        <Help label="What a stack is">
          A stack is a second set of rules over the same equipped skills. The hero switches to the first stack whose trigger passes, otherwise the Default rules.
        </Help>
        {atStackLimit ? <span className="muted-inline">{limitText}</span> : null}
      </div>
      {pickerOpen ? (
        <TemplatePicker
          options={options}
          atStackLimit={atStackLimit}
          replacing={replacing === null ? null : { template: replacing, ruleCount: activeRows.length, chainName: stack === undefined ? 'Default' : stack.name }}
          onApply={chooseTemplate}
          onConfirmReplace={() => replacing !== null && applyChosen(replacing)}
          onCancelReplace={() => setReplacing(null)}
          onClose={() => {
            setPickerOpen(false)
            setReplacing(null)
          }}
        />
      ) : null}
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
          <GuideLink id="topic-rules" label="How rules work" />
        </p>
        <RuleChain
          hero={hero}
          rows={activeRows}
          stackId={stack === undefined ? DEFAULT_TAB : stack.id}
          skillIds={skillIds}
          open={openRule}
          counts={counts}
          removed={removedRule !== null && removedRule.tab === tab}
          onOpen={setOpenRule}
          onPatch={patchRow}
          onMove={move}
          onReorder={reorder}
          onDuplicate={(index) => {
            update([...activeRows.slice(0, index + 1), copyRow(activeRows[index]!), ...activeRows.slice(index + 1)])
            setOpenRule(index + 1)
          }}
          onRemove={(index) => {
            setRemovedRule({ tab, index, row: activeRows[index]! })
            setOpenRule(null)
            update(activeRows.filter((_, at) => at !== index))
          }}
          onAdd={() => {
            update([...activeRows, { skillId: '', conditions: [], targetPriority: '', kept: [] }])
            setOpenRule(activeRows.length)
          }}
          onStartTemplate={() => setPickerOpen(true)}
          onUndo={() => {
            if (removedRule === null) return
            const at = Math.min(removedRule.index, activeRows.length)
            update([...activeRows.slice(0, at), removedRule.row, ...activeRows.slice(at)])
            setRemovedRule(null)
            setOpenRule(at)
          }}
        />
        {notes.length > 0 ? (
          <div className="rc-notes" role="status" data-testid="template-notes">
            <strong>Still to fill in</strong>
            <ul>
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setNotes([])}>
              Dismiss
            </button>
          </div>
        ) : null}
      </div>{' '}
      <button type="button" disabled={!liveOk} onClick={save}>
        Save rules
      </button>{' '}
      {beforeReset === null ? (
        <button
          type="button"
          data-testid="reset-rules"
          title="Replace the default rules with the ones this class starts with. Nothing changes until you press Save rules. Rule stacks are kept."
          onClick={() => {
            touch()
            setBeforeReset(rows)
            setRows(startingRuleDrafts(hero))
            setTab(DEFAULT_TAB)
            setOpenRule(null)
            setRemovedRule(null)
          }}
        >
          Reset to starting rules
        </button>
      ) : (
        <button
          type="button"
          data-testid="undo-reset-rules"
          onClick={() => {
            touch()
            setRows(beforeReset)
            setBeforeReset(null)
            setOpenRule(null)
          }}
        >
          Undo reset
        </button>
      )}
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
