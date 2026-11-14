import { MAX_RULE_STACKS, MAX_STACK_NAME_LENGTH, nextStackId, type StackDraft } from '../../persist/loadout.ts'

/** Pure edits on the stack draft list, so the editor's behaviour can be tested without a DOM. */

export function addStack(stacks: readonly StackDraft[]): StackDraft[] {
  if (stacks.length >= MAX_RULE_STACKS) return [...stacks]
  const id = nextStackId(stacks)
  return [...stacks, { id, name: `Stack ${id.slice('stack-'.length)}`, when: [], keptWhen: [], rows: [] }]
}

export function copyStack(stack: StackDraft, id: string): StackDraft {
  return {
    id,
    name: `${stack.name} copy`.slice(0, MAX_STACK_NAME_LENGTH),
    when: stack.when.map((condition) => ({ ...condition })),
    keptWhen: [...(stack.keptWhen ?? [])],
    rows: stack.rows.map((row) => ({ ...row, conditions: row.conditions.map((condition) => ({ ...condition })), kept: [...(row.kept ?? [])] })),
  }
}

/** Put a copy right after the original. Refused at the limit. */
export function duplicateStack(stacks: readonly StackDraft[], id: string): StackDraft[] {
  const at = stacks.findIndex((stack) => stack.id === id)
  if (at < 0 || stacks.length >= MAX_RULE_STACKS) return [...stacks]
  return [...stacks.slice(0, at + 1), copyStack(stacks[at]!, nextStackId(stacks)), ...stacks.slice(at + 1)]
}

export function deleteStack(stacks: readonly StackDraft[], id: string): StackDraft[] {
  return stacks.filter((stack) => stack.id !== id)
}

/** The list order is the priority order. Default is never in the list and stays last. */
export function moveStack(stacks: readonly StackDraft[], id: string, delta: number): StackDraft[] {
  const from = stacks.findIndex((stack) => stack.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= stacks.length) return [...stacks]
  const next = [...stacks]
  const [stack] = next.splice(from, 1)
  next.splice(to, 0, stack!)
  return next
}

export function patchStack(stacks: readonly StackDraft[], id: string, patch: Partial<StackDraft>): StackDraft[] {
  return stacks.map((stack) => (stack.id === id ? { ...stack, ...patch } : stack))
}

/** True when the stack has any trigger, editable or kept, so it can switch in by itself. */
export function hasTrigger(stack: StackDraft): boolean {
  return stack.when.length > 0 || (stack.keptWhen ?? []).length > 0
}
