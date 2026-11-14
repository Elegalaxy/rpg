import { conditionFailure, livingEnemies, parseRuleStacks, STACK_HOLD_MS, watchedEnemy } from './automation.ts'
import {
  DEFAULT_STACK_ID,
  type AutomationCondition,
  type CombatActor,
  type CombatHero,
  type CombatState,
  type GameDefs,
  type PriorityRow,
  type RuleStack,
  type StackChangedEvent,
  type StackState,
  type TargetPriority,
} from './types.ts'

export type StackReason = StackChangedEvent['reason']

/**
 * The stack to read rows from for this action. `reason` is null when the active stack stays.
 * Otherwise `applyStackPick` commits it.
 */
export type StackPick = { id: string; reason: StackReason | null; detail: string | null }

export type ActiveRules = { rows: readonly PriorityRow[]; targetPriority: TargetPriority | null }

const OPERATOR_WORDS = {
  atMost: 'at most',
  atLeast: 'at least',
  equal: 'equal to',
  notEqual: 'not',
  present: 'present',
  absent: 'absent',
} as const

function operatorWords(operator: keyof typeof OPERATOR_WORDS): string {
  return OPERATOR_WORDS[operator]
}

function valueText(operator: keyof typeof OPERATOR_WORDS, value: number | undefined): string {
  return value === undefined ? operatorWords(operator) : `${operatorWords(operator)} ${value}`
}

/** A short static phrase for one trigger condition, e.g. "enemy count at least 2". */
export function describeCondition(condition: AutomationCondition): string {
  switch (condition.kind) {
    case 'hpPercent':
      return `${condition.who} HP% ${valueText(condition.operator, condition.value)}`
    case 'hpPoints':
      return `${condition.who} ${condition.measure === 'missing' ? 'missing HP' : 'HP'} ${valueText(condition.operator, condition.value)}`
    case 'classResource':
      return `class resource ${valueText(condition.operator, condition.value)}`
    case 'balance':
      return `${condition.meter} ${valueText(condition.operator, condition.value)}`
    case 'barrier':
      return `hero barrier ${valueText(condition.operator, condition.value)}`
    case 'status':
      return `${condition.who} ${condition.statusId} ${condition.measure} ${valueText(condition.operator, condition.value)}`
    case 'specialAmmo':
      return `special ammo ${valueText(condition.operator, condition.value)}`
    case 'enemyCount':
      return `enemy count ${valueText(condition.operator, condition.value)}`
    case 'enemyType':
      return `enemy type ${condition.operator === 'equal' ? 'is' : 'is not'} ${condition.value}`
    case 'rank':
      return `rank ${valueText(condition.operator, condition.value)}`
    case 'mark':
      return `mark ${operatorWords(condition.operator)}`
    case 'stance':
      return `${condition.stance} stance ${operatorWords(condition.operator)}`
    case 'interruptible':
      return `interruptible telegraph ${operatorWords(condition.operator)}`
    case 'bossPhase':
      return `boss phase ${valueText(condition.operator, condition.value)}`
    case 'telegraph':
      return `${condition.tag === undefined ? 'telegraph' : `telegraph ${condition.tag}`} ${valueText(condition.operator, condition.value)}`
    case 'skillReady':
      return `skill ${condition.skillId} ${condition.operator === 'present' ? 'ready' : 'not ready'}`
    case 'fightTime':
      return `fight time ${valueText(condition.operator, condition.value)} ms`
    default: {
      const unexpected: never = condition
      throw new Error(`unknown condition ${JSON.stringify(unexpected)}`)
    }
  }
}

function stacksOf(hero: CombatHero): readonly RuleStack[] {
  return hero.ruleStacks ?? []
}

function stateOf(hero: CombatHero): StackState {
  return hero.stackState ?? { activeId: DEFAULT_STACK_ID, sinceMs: null, manualId: null }
}

/** Position in the list. The Default stack, and any unknown id, sorts after every extra stack. */
function rankOf(stacks: readonly RuleStack[], id: string): number {
  const index = stacks.findIndex((stack) => stack.id === id)
  return index < 0 ? stacks.length : index
}

export function stackName(hero: CombatHero, id: string): string {
  if (id === DEFAULT_STACK_ID) return 'Default'
  return stacksOf(hero).find((stack) => stack.id === id)?.name ?? id
}

/** The rows and target priority a stack reads. An unknown id reads as Default. */
export function activeRules(hero: CombatHero, id?: string): ActiveRules {
  const wanted = id ?? stateOf(hero).activeId
  const stack = wanted === DEFAULT_STACK_ID ? undefined : stacksOf(hero).find((entry) => entry.id === wanted)
  return { rows: stack === undefined ? hero.priorityRows : stack.rows, targetPriority: hero.targetPriority }
}

/** The enemy target-reading triggers look at: the current target if alive, else the lowest slot. No RNG. */
function stackFocus(state: CombatState, hero: CombatHero): CombatActor | null {
  const living = livingEnemies(state)
  if (hero.currentTargetId !== null) {
    const current = living.find((enemy) => enemy.id === hero.currentTargetId)
    if (current !== undefined) return current
  }
  return living[0] ?? null
}

/** The first failing trigger reason, or null when the stack's triggers all pass. */
function triggerFailure(state: CombatState, defs: GameDefs, hero: CombatHero, stack: RuleStack, timeMs: number): string | null {
  if (stack.when.length === 0) return 'no trigger'
  const watch = watchedEnemy(state, defs, hero, { skillId: '', conditions: stack.when }, timeMs)
  const focus = watch ?? stackFocus(state, hero)
  for (const condition of stack.when) {
    const reason = conditionFailure(state, defs, hero, focus, condition, timeMs)
    if (reason !== null) return reason
  }
  return null
}

function triggerText(stack: RuleStack): string {
  return stack.when.map(describeCondition).join(', ')
}

/**
 * Choose the stack for this action evaluation. Pure: reads the state, never touches the RNG, and
 * commits nothing. Null when the hero has no extra stacks, which leaves today's code path alone.
 */
export function pickStack(state: CombatState, defs: GameDefs, hero: CombatHero, timeMs: number): StackPick | null {
  const stacks = stacksOf(hero)
  if (stacks.length === 0) return null
  const current = stateOf(hero)
  const activeKnown = current.activeId === DEFAULT_STACK_ID || stacks.some((stack) => stack.id === current.activeId)
  const activeId = activeKnown ? current.activeId : DEFAULT_STACK_ID

  const manualId = current.manualId
  if (manualId !== null && (manualId === DEFAULT_STACK_ID || stacks.some((stack) => stack.id === manualId))) {
    return { id: manualId, reason: manualId === activeId ? null : 'manual', detail: null }
  }

  let candidate: RuleStack | null = null
  for (const stack of stacks) {
    if (stack.when.length === 0) continue
    if (triggerFailure(state, defs, hero, stack, timeMs) === null) {
      candidate = stack
      break
    }
  }
  const candidateId = candidate === null ? DEFAULT_STACK_ID : candidate.id
  if (candidateId === activeId) return { id: activeId, reason: null, detail: null }

  const goingUp = rankOf(stacks, candidateId) < rankOf(stacks, activeId)
  if (!goingUp && current.sinceMs !== null && timeMs < current.sinceMs + STACK_HOLD_MS && activeKnown) {
    return { id: activeId, reason: null, detail: null }
  }
  if (candidate !== null) return { id: candidateId, reason: 'trigger', detail: triggerText(candidate) }
  const left = stacks.find((stack) => stack.id === activeId)
  const failure = left === undefined ? null : triggerFailure(state, defs, hero, left, timeMs)
  return { id: DEFAULT_STACK_ID, reason: 'fallback', detail: failure }
}

function pushChange(
  state: CombatState,
  hero: CombatHero,
  fromId: string,
  fromName: string,
  toId: string,
  reason: StackReason,
  detail: string | null,
  timeMs: number,
): void {
  state.log.push({
    type: 'stackChanged',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    fromId,
    fromName,
    toId,
    toName: stackName(hero, toId),
    reason,
    detail,
  })
}

/** Commit a pick. Sets the active stack and pushes one `stackChanged` only when the active stack changes. */
export function applyStackPick(state: CombatState, hero: CombatHero, pick: StackPick, timeMs: number): void {
  if (pick.reason === null) return
  const current = stateOf(hero)
  if (current.activeId === pick.id) return
  const fromName = stackName(hero, current.activeId)
  hero.stackState = { activeId: pick.id, sinceMs: timeMs, manualId: current.manualId }
  pushChange(state, hero, current.activeId, fromName, pick.id, pick.reason, pick.detail, timeMs)
}

/**
 * Pick a stack by hand, or null for Auto. A pick takes effect at the next action evaluation and lasts
 * until Auto or the end of the fight. Clearing it applies the automatic pick at once, with no hold.
 * An unknown stack id throws and leaves the state unchanged.
 */
export function setManualStack(state: CombatState, defs: GameDefs, stackId: string | null): void {
  const hero = state.hero
  const stacks = stacksOf(hero)
  if (stackId !== null && stackId !== DEFAULT_STACK_ID && !stacks.some((stack) => stack.id === stackId)) {
    throw new Error(`cannot pick stack '${stackId}': no such stack`)
  }
  if (stacks.length === 0) return
  const current = stateOf(hero)
  if (stackId !== null) {
    hero.stackState = { ...current, manualId: stackId }
    return
  }
  if (current.manualId === null) return
  hero.stackState = { activeId: current.activeId, sinceMs: null, manualId: null }
  const pick = pickStack(state, defs, hero, state.timeMs)
  if (pick !== null && pick.id !== current.activeId) {
    applyStackPick(state, hero, { ...pick, reason: 'manualCleared' }, state.timeMs)
    hero.stackState = { activeId: pick.id, sinceMs: null, manualId: null }
  }
}

/**
 * Replace the extra stacks for the next evaluation, like `setPriorityRules`. A parse error logs a
 * rejected `rulesChanged` and keeps the old stacks. A deleted active stack falls back to Default and a
 * deleted manual pick is cleared.
 */
export function setRuleStacks(state: CombatState, stacks: unknown, defs: GameDefs): void {
  const hero = state.hero
  const parsed = parseRuleStacks(stacks, defs)
  if (!parsed.ok) {
    state.log.push({
      type: 'rulesChanged',
      timeMs: state.timeMs,
      actorId: hero.id,
      actorName: hero.name,
      applied: false,
      reason: parsed.reason,
      rowCount: 0,
      targetPriority: null,
      stackCount: stacksOf(hero).length,
    })
    return
  }
  const previous = stateOf(hero)
  const oldActiveName = stackName(hero, previous.activeId)
  hero.ruleStacks = parsed.stacks
  const known = (id: string): boolean => id === DEFAULT_STACK_ID || parsed.stacks.some((stack) => stack.id === id)
  const manualId = previous.manualId !== null && known(previous.manualId) ? previous.manualId : null
  const activeId = known(previous.activeId) ? previous.activeId : DEFAULT_STACK_ID
  hero.stackState = { activeId, sinceMs: activeId === previous.activeId ? previous.sinceMs : null, manualId }
  let rows = 0
  for (const stack of parsed.stacks) rows += stack.rows.length
  state.log.push({
    type: 'rulesChanged',
    timeMs: state.timeMs,
    actorId: hero.id,
    actorName: hero.name,
    applied: true,
    reason: null,
    rowCount: rows,
    targetPriority: hero.targetPriority,
    stackCount: parsed.stacks.length,
  })
  if (activeId !== previous.activeId) {
    pushChange(state, hero, previous.activeId, oldActiveName, activeId, 'fallback', 'stack removed', state.timeMs)
  }
}
