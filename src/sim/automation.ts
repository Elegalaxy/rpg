import { MISSING_SPECIAL_ARROW_REASON } from './classes/ranger.ts'
import { nextFloat } from './rng.ts'
import {
  activeBarrier,
  equipmentBlock,
  fatalHpLossBlock,
  skillAffordable,
  skillEquipped,
  skillNeedsEnemy,
  skillOffCooldown,
} from './skills.ts'
import {
  TARGET_PRIORITIES,
  type AutomationCondition,
  type CombatActor,
  type CombatHero,
  type CombatState,
  type CompareOperator,
  type ConditionOperator,
  type GameDefs,
  type PresenceOperator,
  type PriorityEvent,
  type PriorityRow,
  type SkillDef,
  type TargetPriority,
} from './types.ts'

export const MAX_PRIORITY_ROWS = 12

const STATUS_IDS = ['bleed', 'poison', 'burn', 'chill', 'mark', 'expose'] as const
const COMPARE_OPERATORS = ['atMost', 'atLeast', 'equal', 'notEqual'] as const
const PRESENCE_OPERATORS = ['present', 'absent'] as const
const REJECTED_PRIORITIES = ['Most dangerous', 'most dangerous', 'mostDangerous', 'most-dangerous']

export type HeroActionChoice =
  | { kind: 'skill'; skill: SkillDef; targets: CombatActor[]; focus: CombatActor | null; events: PriorityEvent[] }
  | { kind: 'basicAttack'; events: PriorityEvent[] }

export type PriorityRulesParse =
  | { ok: true; rows: PriorityRow[]; targetPriority: TargetPriority | null }
  | { ok: false; reason: string; rowCount: number }

type PickResult = {
  enemy: CombatActor | null
  unrevealed: string[]
  failure: string | null
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

function asRecord(value: unknown, label: string): Record<string, unknown> | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return `${label} must be an object, received ${describeValue(value)}`
  }
  return value as Record<string, unknown>
}

function unexpectedKey(record: Record<string, unknown>, allowed: readonly string[]): string | null {
  const keys = Object.keys(record)
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    if (key === undefined) continue
    let known = false
    for (let allowedIndex = 0; allowedIndex < allowed.length; allowedIndex += 1) {
      if (allowed[allowedIndex] === key) known = true
    }
    if (!known) return key
  }
  return null
}

function includesName<T extends string>(values: readonly T[], value: string): value is T {
  for (const entry of values) {
    if (entry === value) return true
  }
  return false
}

function readCompare(value: unknown): CompareOperator | null {
  if (typeof value !== 'string' || !includesName(COMPARE_OPERATORS, value)) return null
  return value
}

function readPresence(value: unknown): PresenceOperator | null {
  if (typeof value !== 'string' || !includesName(PRESENCE_OPERATORS, value)) return null
  return value
}

function readOperator(value: unknown): ConditionOperator | null {
  return readCompare(value) ?? readPresence(value)
}

function reject(reason: string, rowCount: number): PriorityRulesParse {
  return { ok: false, reason, rowCount }
}

function parseNumber(value: unknown, label: string): number | string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${label} must be a finite number, received ${describeValue(value)}`
  }
  return value
}

function parsePriority(
  value: unknown,
  label: string,
): { ok: true; priority: TargetPriority } | { ok: false; reason: string } {
  if (typeof value !== 'string') {
    return { ok: false, reason: `${label} must be a target priority, received ${describeValue(value)}` }
  }
  if (includesName(REJECTED_PRIORITIES, value)) {
    return { ok: false, reason: `${label} 'Most dangerous' is not available` }
  }
  if (includesName(TARGET_PRIORITIES, value)) return { ok: true, priority: value }
  return { ok: false, reason: `${label} '${value}' is unknown` }
}

function parseCondition(value: unknown, label: string): AutomationCondition | string {
  const record = asRecord(value, label)
  if (typeof record === 'string') return record
  const kind = record.kind
  if (typeof kind !== 'string' || kind.length === 0) return `${label} is missing a kind`

  if (kind === 'hpPercent') {
    const extra = unexpectedKey(record, ['kind', 'who', 'operator', 'value'])
    if (extra !== null) return `${label} has unknown field '${extra}'`
    if (record.who !== 'hero' && record.who !== 'target') {
      return `${label} who must be hero or target, received ${describeValue(record.who)}`
    }
    const operator = readCompare(record.operator)
    if (operator === null) return `${label} operator is invalid, received ${describeValue(record.operator)}`
    const amount = parseNumber(record.value, `${label} value`)
    if (typeof amount === 'string') return amount
    return { kind, who: record.who, operator, value: amount }
  }

  if (kind === 'classResource' || kind === 'specialAmmo' || kind === 'enemyCount' || kind === 'rank' || kind === 'bossPhase') {
    const extra = unexpectedKey(record, ['kind', 'operator', 'value'])
    if (extra !== null) return `${label} has unknown field '${extra}'`
    const operator = readCompare(record.operator)
    if (operator === null) return `${label} operator is invalid, received ${describeValue(record.operator)}`
    const amount = parseNumber(record.value, `${label} value`)
    if (typeof amount === 'string') return amount
    return { kind, operator, value: amount }
  }

  if (kind === 'enemyType') {
    const extra = unexpectedKey(record, ['kind', 'operator', 'value'])
    if (extra !== null) return `${label} has unknown field '${extra}'`
    if (record.operator !== 'equal' && record.operator !== 'notEqual') {
      return `${label} operator is invalid, received ${describeValue(record.operator)}`
    }
    if (typeof record.value !== 'string' || record.value.length === 0) {
      return `${label} value must be an enemy type`
    }
    return { kind, operator: record.operator, value: record.value }
  }

  if (kind === 'mark') {
    const extra = unexpectedKey(record, ['kind', 'operator'])
    if (extra !== null) return `${label} has unknown field '${extra}'`
    const operator = readPresence(record.operator)
    if (operator === null) return `${label} operator is invalid, received ${describeValue(record.operator)}`
    return { kind, operator }
  }

  if (kind === 'barrier' || kind === 'telegraph') {
    const allowed = kind === 'telegraph' ? ['kind', 'tag', 'operator', 'value'] : ['kind', 'operator', 'value']
    const extra = unexpectedKey(record, allowed)
    if (extra !== null) return `${label} has unknown field '${extra}'`
    const operator = readOperator(record.operator)
    if (operator === null) return `${label} operator is invalid, received ${describeValue(record.operator)}`
    let tag: string | undefined
    if (kind === 'telegraph' && record.tag !== undefined) {
      if (typeof record.tag !== 'string' || record.tag.length === 0) {
        return `${label} tag must be a non-empty string`
      }
      tag = record.tag
    }
    if (includesName(PRESENCE_OPERATORS, operator)) {
      if (record.value !== undefined) return `${label} ${operator} does not take a value`
      return kind === 'telegraph' ? { kind, tag, operator } : { kind, operator }
    }
    const amount = parseNumber(record.value, `${label} value`)
    if (typeof amount === 'string') return amount
    return kind === 'telegraph' ? { kind, tag, operator, value: amount } : { kind, operator, value: amount }
  }

  if (kind === 'status') {
    const extra = unexpectedKey(record, ['kind', 'who', 'statusId', 'measure', 'operator', 'value'])
    if (extra !== null) return `${label} has unknown field '${extra}'`
    if (record.who !== 'hero' && record.who !== 'target') {
      return `${label} who must be hero or target, received ${describeValue(record.who)}`
    }
    if (typeof record.statusId !== 'string' || !includesName(STATUS_IDS, record.statusId)) {
      return `${label} references unknown status '${describeValue(record.statusId)}'`
    }
    if (record.measure !== 'presence' && record.measure !== 'stacks' && record.measure !== 'remaining') {
      return `${label} measure is invalid, received ${describeValue(record.measure)}`
    }
    if (record.measure === 'presence') {
      const operator = readPresence(record.operator)
      if (operator === null) return `${label} operator is invalid, received ${describeValue(record.operator)}`
      if (record.value !== undefined) return `${label} presence does not take a value`
      return { kind, who: record.who, statusId: record.statusId, measure: record.measure, operator }
    }
    const operator = readCompare(record.operator)
    if (operator === null) return `${label} operator is invalid, received ${describeValue(record.operator)}`
    const amount = parseNumber(record.value, `${label} value`)
    if (typeof amount === 'string') return amount
    return {
      kind,
      who: record.who,
      statusId: record.statusId,
      measure: record.measure,
      operator,
      value: amount,
    }
  }

  return `${label} kind '${kind}' is unknown`
}

function parseRow(value: unknown, index: number, skills: GameDefs['skills']): PriorityRow | string {
  const label = `priority row ${index + 1}`
  const record = asRecord(value, label)
  if (typeof record === 'string') return record
  const extra = unexpectedKey(record, ['skillId', 'conditions', 'targetPriority'])
  if (extra !== null) return `${label} has unknown field '${extra}'`
  const skillId = record.skillId
  if (typeof skillId !== 'string' || skillId.length === 0) return `${label} is missing a skill id`
  const conditions: AutomationCondition[] = []
  if (record.conditions !== undefined) {
    if (!Array.isArray(record.conditions)) return `${label} conditions must be a list`
    for (let conditionIndex = 0; conditionIndex < record.conditions.length; conditionIndex += 1) {
      const parsed = parseCondition(record.conditions[conditionIndex], `${label} condition ${conditionIndex + 1}`)
      if (typeof parsed === 'string') return parsed
      conditions.push(parsed)
    }
  }
  let targetPriority: TargetPriority | undefined
  if (record.targetPriority !== undefined) {
    const parsed = parsePriority(record.targetPriority, `${label} target priority`)
    if (!parsed.ok) return parsed.reason
    targetPriority = parsed.priority
  }
  if (skills[skillId] === undefined) return `${label} references unknown skill '${skillId}'`
  const row: PriorityRow = { skillId }
  if (conditions.length > 0) row.conditions = conditions
  if (targetPriority !== undefined) row.targetPriority = targetPriority
  return row
}

/** Read a rule set. A string reason means the set must not replace the previous rules. */
export function parsePriorityRules(rules: unknown, defs: GameDefs): PriorityRulesParse {
  if (typeof defs !== 'object' || defs === null || Array.isArray(defs)) {
    throw new Error('priority rules need combat definitions')
  }
  if (typeof defs.skills !== 'object' || defs.skills === null || Array.isArray(defs.skills)) {
    throw new Error('priority rules need a skill book')
  }
  const record = asRecord(rules, 'priority rules')
  if (typeof record === 'string') return reject(record, 0)
  const extra = unexpectedKey(record, ['rows', 'targetPriority'])
  if (extra !== null) return reject(`priority rules have unknown field '${extra}'`, 0)
  if (record.rows === undefined) return reject('priority rules are missing rows', 0)
  if (!Array.isArray(record.rows)) return reject('priority rows must be a list', 0)
  if (record.rows.length > MAX_PRIORITY_ROWS) {
    return reject(
      `priority rules have ${record.rows.length} rows and the maximum is ${MAX_PRIORITY_ROWS}`,
      record.rows.length,
    )
  }
  let targetPriority: TargetPriority | null = null
  if (record.targetPriority !== undefined && record.targetPriority !== null) {
    const parsed = parsePriority(record.targetPriority, 'global target priority')
    if (!parsed.ok) return reject(parsed.reason, record.rows.length)
    targetPriority = parsed.priority
  }
  const rows: PriorityRow[] = []
  for (let index = 0; index < record.rows.length; index += 1) {
    const parsed = parseRow(record.rows[index], index, defs.skills)
    if (typeof parsed === 'string') return reject(parsed, record.rows.length)
    rows.push(parsed)
  }
  return { ok: true, rows, targetPriority }
}

/**
 * Replace priority rules for the next evaluation.
 * The row list already being walked is left in place.
 * Unknown skills, more than 12 rows, and Most dangerous are logged and not applied.
 */
export function setPriorityRules(state: CombatState, rules: unknown, defs: GameDefs): void {
  if (typeof state !== 'object' || state === null) throw new Error('priority rules need a combat state')
  if (typeof state.hero !== 'object' || state.hero === null) throw new Error('priority rules need a hero')
  if (!Array.isArray(state.log)) throw new Error('priority rules need a combat log')
  if (typeof state.timeMs !== 'number') throw new Error('priority rules need a combat time')
  const parsed = parsePriorityRules(rules, defs)
  if (!parsed.ok) {
    state.log.push({
      type: 'rulesChanged',
      timeMs: state.timeMs,
      actorId: state.hero.id,
      actorName: state.hero.name,
      applied: false,
      reason: parsed.reason,
      rowCount: parsed.rowCount,
      targetPriority: null,
    })
    return
  }
  state.hero.priorityRows = parsed.rows
  state.hero.targetPriority = parsed.targetPriority
  state.log.push({
    type: 'rulesChanged',
    timeMs: state.timeMs,
    actorId: state.hero.id,
    actorName: state.hero.name,
    applied: true,
    reason: null,
    rowCount: parsed.rows.length,
    targetPriority: parsed.targetPriority,
  })
}

function livingEnemies(state: CombatState): CombatActor[] {
  const living: CombatActor[] = []
  for (const enemy of state.enemies) {
    if (enemy.alive) living.push(enemy)
  }
  living.sort((a, b) => a.slot - b.slot)
  return living
}

function enemyTargets(state: CombatState, skill: SkillDef): CombatActor[] {
  const living = livingEnemies(state)
  if (skill.target === 'all') return living
  const first = living[0]
  return first === undefined ? [] : [first]
}

function priorityEvent(
  hero: CombatHero,
  timeMs: number,
  rowIndex: number | null,
  skill: SkillDef | null,
  decision: PriorityEvent['decision'],
  reason: string | null,
): PriorityEvent {
  return {
    type: 'priority',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    rowIndex,
    skillId: skill === null ? null : skill.id,
    skillName: skill === null ? null : skill.name,
    decision,
    reason,
  }
}

/**
 * First failing eligibility check, in the order the log should name.
 * Null means the skill itself can be used. Conditions and the row's target priority are separate.
 */
export function skipReason(
  state: CombatState,
  hero: CombatHero,
  skill: SkillDef,
  timeMs: number,
): string | null {
  if (!skillEquipped(hero, skill.id)) return 'not equipped'
  if (!skillOffCooldown(hero, skill, timeMs)) return 'on cooldown'
  if (!skillAffordable(hero, skill)) return 'unaffordable'
  const ammoCost = skill.ammoCost ?? 0
  if (ammoCost > hero.specialAmmo) return MISSING_SPECIAL_ARROW_REASON
  const equipment = equipmentBlock(hero, skill)
  if (equipment !== null) return equipment
  const fatal = fatalHpLossBlock(hero, skill)
  if (fatal !== null) return fatal
  if (skillNeedsEnemy(skill) && enemyTargets(state, skill).length === 0) return 'no target'
  return null
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100)
}

function numbersPass(actual: number, operator: CompareOperator, expected: number): boolean {
  switch (operator) {
    case 'atMost':
      return actual <= expected
    case 'atLeast':
      return actual >= expected
    case 'equal':
      return actual === expected
    case 'notEqual':
      return actual !== expected
    default: {
      const unexpected: never = operator
      throw new Error(`unknown operator ${JSON.stringify(unexpected)}`)
    }
  }
}

function numericFailure(
  label: string,
  actual: number,
  operator: CompareOperator,
  expected: number,
  unit = '',
): string | null {
  if (numbersPass(actual, operator, expected)) return null
  const left = `${formatNumber(actual)}${unit}`
  const right = `${formatNumber(expected)}${unit}`
  if (operator === 'atMost') return `${label} ${left} is above ${right}`
  if (operator === 'atLeast') return `${label} ${left} is below ${right}`
  if (operator === 'equal') return `${label} ${left} is not ${right}`
  return `${label} ${left} equals ${right}`
}

function presenceFailure(label: string, present: boolean, operator: PresenceOperator): string | null {
  if (operator === 'present') return present ? null : `${label} is absent`
  return present ? `${label} is present` : null
}

function hpPercent(actor: CombatActor): number {
  if (actor.maxHp <= 0) return 0
  return (actor.hp / actor.maxHp) * 100
}

function requireValue(value: number | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} is missing a number`)
  }
  return value
}

type StatusReading = {
  present: boolean
  stacks: number
  remaining: number | null
  unit: 'ms' | 'actions' | 'none'
}

function readStatus(actor: CombatActor, statusId: string, timeMs: number): StatusReading | null {
  if (statusId === 'bleed') {
    const bleed = actor.statuses.bleed
    if (bleed === null || bleed.stacks.length === 0) {
      return { present: false, stacks: 0, remaining: null, unit: 'actions' }
    }
    let remaining = bleed.stacks[0]?.actionsRemaining ?? 0
    for (const stack of bleed.stacks) {
      if (stack.actionsRemaining < remaining) remaining = stack.actionsRemaining
    }
    return { present: true, stacks: bleed.stacks.length, remaining, unit: 'actions' }
  }
  if (statusId === 'poison') {
    const poison = actor.statuses.poison
    if (poison === null || poison.stacks.length === 0) {
      return { present: false, stacks: 0, remaining: null, unit: 'ms' }
    }
    return { present: true, stacks: poison.stacks.length, remaining: poison.expiresMs - timeMs, unit: 'ms' }
  }
  if (statusId === 'burn') {
    const burn = actor.statuses.burn
    if (burn === null) return { present: false, stacks: 0, remaining: null, unit: 'ms' }
    return { present: true, stacks: burn.intensity, remaining: burn.expiresMs - timeMs, unit: 'ms' }
  }
  if (statusId === 'chill') {
    const chill = actor.statuses.chill
    if (chill === null || chill.stacks === 0) {
      return { present: false, stacks: 0, remaining: null, unit: 'ms' }
    }
    return { present: true, stacks: chill.stacks, remaining: chill.expiresMs - timeMs, unit: 'ms' }
  }
  if (statusId === 'mark') {
    const mark = actor.statuses.mark
    if (mark === null) return { present: false, stacks: 0, remaining: null, unit: 'ms' }
    const remaining = mark.expiresMs === null ? null : mark.expiresMs - timeMs
    return { present: true, stacks: 1, remaining, unit: remaining === null ? 'none' : 'ms' }
  }
  if (statusId === 'expose') {
    const expose = actor.statuses.expose
    if (expose === null) return { present: false, stacks: 0, remaining: null, unit: 'ms' }
    return { present: true, stacks: 1, remaining: expose.expiresMs - timeMs, unit: 'ms' }
  }
  return null
}

function statusFailure(
  actor: CombatActor,
  who: 'hero' | 'target',
  condition: Extract<AutomationCondition, { kind: 'status' }>,
  timeMs: number,
): string {
  const reading = readStatus(actor, condition.statusId, timeMs)
  const label = `${who} ${condition.statusId}`
  if (reading === null) return `${label} is unknown`
  if (condition.measure === 'presence') {
    if (condition.operator !== 'present' && condition.operator !== 'absent') {
      throw new Error(`${label} presence operator is invalid`)
    }
    return presenceFailure(label, reading.present, condition.operator) ?? ''
  }
  if (condition.measure === 'stacks') {
    if (!includesName(COMPARE_OPERATORS, condition.operator)) {
      throw new Error(`${label} stacks operator is invalid`)
    }
    return numericFailure(`${label} stacks`, reading.stacks, condition.operator, requireValue(condition.value, label)) ?? ''
  }
  if (!reading.present) return `${label} is absent`
  if (reading.remaining === null) return `${label} has no remaining duration`
  if (!includesName(COMPARE_OPERATORS, condition.operator)) {
    throw new Error(`${label} remaining operator is invalid`)
  }
  const unit = reading.unit === 'actions' ? ' actions' : 'ms'
  return (
    numericFailure(
      `${label} remaining`,
      reading.remaining,
      condition.operator,
      requireValue(condition.value, label),
      unit,
    ) ?? ''
  )
}

function conditionNeedsTarget(condition: AutomationCondition): boolean {
  switch (condition.kind) {
    case 'hpPercent':
    case 'status':
      return condition.who === 'target'
    case 'classResource':
    case 'barrier':
    case 'specialAmmo':
    case 'enemyCount':
      return false
    case 'enemyType':
    case 'rank':
    case 'mark':
    case 'bossPhase':
    case 'telegraph':
      return true
    default: {
      const unexpected: never = condition
      throw new Error(`unknown condition ${JSON.stringify(unexpected)}`)
    }
  }
}

function rowNeedsEnemy(skill: SkillDef, row: PriorityRow): boolean {
  if (skillNeedsEnemy(skill)) return true
  const conditions = row.conditions ?? []
  for (const condition of conditions) {
    if (conditionNeedsTarget(condition)) return true
  }
  return false
}

function conditionFailure(
  state: CombatState,
  hero: CombatHero,
  enemy: CombatActor | null,
  condition: AutomationCondition,
  timeMs: number,
): string | null {
  switch (condition.kind) {
    case 'hpPercent': {
      const actor = condition.who === 'hero' ? hero : enemy
      if (actor === null) return 'no target'
      const label = condition.who === 'hero' ? 'hero HP%' : 'target HP%'
      return numericFailure(label, hpPercent(actor), condition.operator, condition.value)
    }
    case 'classResource':
      return numericFailure('class resource', hero.classResource, condition.operator, condition.value)
    case 'specialAmmo':
      return numericFailure('special ammo', hero.specialAmmo, condition.operator, condition.value)
    case 'enemyCount':
      return numericFailure('enemy count', livingEnemies(state).length, condition.operator, condition.value)
    case 'barrier': {
      const amount = activeBarrier(hero, timeMs)
      if (condition.operator === 'present' || condition.operator === 'absent') {
        return presenceFailure('hero barrier', amount > 0, condition.operator)
      }
      return numericFailure('hero barrier', amount, condition.operator, requireValue(condition.value, 'hero barrier'))
    }
    case 'status': {
      const actor = condition.who === 'hero' ? hero : enemy
      if (actor === null) return 'no target'
      const reason = statusFailure(actor, condition.who, condition, timeMs)
      return reason.length === 0 ? null : reason
    }
    case 'enemyType': {
      if (enemy === null) return 'no target'
      if (condition.operator === 'equal') {
        return enemy.archetype === condition.value ? null : `enemy type ${enemy.archetype} is not ${condition.value}`
      }
      return enemy.archetype === condition.value ? `enemy type ${enemy.archetype} equals ${condition.value}` : null
    }
    case 'rank':
      if (enemy === null) return 'no target'
      return numericFailure('rank', enemy.rank, condition.operator, condition.value)
    case 'mark':
      if (enemy === null) return 'no target'
      return presenceFailure('mark', enemy.statuses.mark !== null, condition.operator)
    case 'bossPhase':
      if (enemy === null) return 'no target'
      return numericFailure('boss phase', enemy.bossPhase, condition.operator, condition.value)
    case 'telegraph': {
      if (enemy === null) return 'no target'
      const telegraph = enemy.telegraph
      const tagged = telegraph !== null && (condition.tag === undefined || telegraph.tag === condition.tag)
      const label = condition.tag === undefined ? 'telegraph' : `telegraph ${condition.tag}`
      if (condition.operator === 'present' || condition.operator === 'absent') {
        return presenceFailure(label, tagged, condition.operator)
      }
      if (!tagged || telegraph === null) return `${label} is absent`
      return numericFailure(
        label,
        telegraph.resolvesAtMs - timeMs,
        condition.operator,
        requireValue(condition.value, label),
        'ms',
      )
    }
    default: {
      const unexpected: never = condition
      throw new Error(`unknown condition ${JSON.stringify(unexpected)}`)
    }
  }
}

function conditionsFailure(
  state: CombatState,
  hero: CombatHero,
  enemy: CombatActor | null,
  row: PriorityRow,
  timeMs: number,
): string | null {
  const conditions = row.conditions ?? []
  for (const condition of conditions) {
    const reason = conditionFailure(state, hero, enemy, condition, timeMs)
    if (reason !== null) return reason
  }
  return null
}

function pickExtremum(
  enemies: readonly CombatActor[],
  value: (enemy: CombatActor) => number,
  direction: 'lowest' | 'highest',
): CombatActor | null {
  let best: CombatActor | null = null
  for (const enemy of enemies) {
    if (best === null) {
      best = enemy
      continue
    }
    const left = value(enemy)
    const right = value(best)
    const better = direction === 'lowest' ? left < right : left > right
    if (better || (left === right && enemy.slot < best.slot)) best = enemy
  }
  return best
}

function defenseLabel(priority: 'lowestArmor' | 'lowestResistance'): string {
  return priority === 'lowestArmor' ? 'lowest armor' : 'lowest resistance'
}

function pickTarget(state: CombatState, hero: CombatHero, priority: TargetPriority | null): PickResult {
  const living = livingEnemies(state)
  if (living.length === 0) return { enemy: null, unrevealed: [], failure: null }
  if (priority === null) return { enemy: living[0] ?? null, unrevealed: [], failure: null }
  if (priority === 'current') {
    if (hero.currentTargetId !== null) {
      for (const enemy of living) {
        if (enemy.id === hero.currentTargetId) return { enemy, unrevealed: [], failure: null }
      }
    }
    return { enemy: living[0] ?? null, unrevealed: [], failure: null }
  }
  if (priority === 'lowestHpPercent' || priority === 'highestHpPercent') {
    const direction = priority === 'lowestHpPercent' ? 'lowest' : 'highest'
    return { enemy: pickExtremum(living, hpPercent, direction), unrevealed: [], failure: null }
  }
  if (priority === 'lowestArmor' || priority === 'lowestResistance') {
    const open: CombatActor[] = []
    const unrevealed: string[] = []
    const label = defenseLabel(priority)
    for (const enemy of living) {
      if (enemy.revealed) open.push(enemy)
      else unrevealed.push(`${enemy.name} (${enemy.id}) is unrevealed for ${label}`)
    }
    if (open.length === 0) {
      return { enemy: null, unrevealed, failure: `no revealed target for ${label}` }
    }
    const value = priority === 'lowestArmor' ? (enemy: CombatActor) => enemy.armor : (enemy: CombatActor) => enemy.resistance
    return { enemy: pickExtremum(open, value, 'lowest'), unrevealed, failure: null }
  }
  if (priority === 'marked') {
    const marked: CombatActor[] = []
    for (const enemy of living) {
      if (enemy.statuses.mark !== null) marked.push(enemy)
    }
    if (marked.length === 0) return { enemy: null, unrevealed: [], failure: 'no marked target' }
    return { enemy: marked[0] ?? null, unrevealed: [], failure: null }
  }
  if (priority === 'actingSoonest') {
    return { enemy: pickExtremum(living, (enemy) => enemy.nextReadyMs, 'lowest'), unrevealed: [], failure: null }
  }
  const index = Math.floor(nextFloat(state.rng) * living.length)
  return { enemy: living[index] ?? null, unrevealed: [], failure: null }
}

function targetsFor(
  state: CombatState,
  hero: CombatHero,
  skill: SkillDef,
  focus: CombatActor | null,
): CombatActor[] {
  if (!skillNeedsEnemy(skill)) return [hero]
  if (skill.target === 'all') return livingEnemies(state)
  return focus === null ? [] : [focus]
}

/** Targets for a skill chosen outside a priority row, including a class fallback. */
export function skillActionTargets(
  state: CombatState,
  hero: CombatHero,
  skill: SkillDef,
): { targets: CombatActor[]; focus: CombatActor | null } {
  if (!skillNeedsEnemy(skill)) return { targets: [hero], focus: null }
  const picked = pickTarget(state, hero, hero.targetPriority)
  if (skill.target === 'all') return { targets: livingEnemies(state), focus: picked.enemy }
  if (picked.enemy === null) return { targets: [], focus: null }
  return { targets: [picked.enemy], focus: picked.enemy }
}

/**
 * Walk rows from top to bottom.
 * The first equipped, ready, affordable, equipment-valid row whose conditions pass and which has a target wins.
 * Rows are snapshotted so a rules update during this choice waits until the next evaluation.
 * Otherwise the hero uses a weapon basic attack.
 */
export function chooseHeroAction(
  state: CombatState,
  defs: GameDefs,
  hero: CombatHero,
  timeMs: number,
): HeroActionChoice {
  const rows = hero.priorityRows
  const globalPriority = hero.targetPriority
  const events: PriorityEvent[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (row === undefined) continue
    const skill = defs.skills[row.skillId]
    if (skill === undefined) {
      throw new Error(`priority row ${index + 1} references unknown skill '${row.skillId}'`)
    }
    const reason = skipReason(state, hero, skill, timeMs)
    if (reason !== null) {
      events.push(priorityEvent(hero, timeMs, index, skill, 'skip', reason))
      continue
    }
    const priority = row.targetPriority ?? globalPriority
    let focus: CombatActor | null = null
    if (rowNeedsEnemy(skill, row)) {
      const picked = pickTarget(state, hero, priority)
      for (const hidden of picked.unrevealed) {
        events.push(priorityEvent(hero, timeMs, index, skill, 'skip', hidden))
      }
      if (picked.enemy === null) {
        events.push(priorityEvent(hero, timeMs, index, skill, 'skip', picked.failure ?? 'no target'))
        continue
      }
      focus = picked.enemy
    }
    const failed = conditionsFailure(state, hero, focus, row, timeMs)
    if (failed !== null) {
      events.push(priorityEvent(hero, timeMs, index, skill, 'skip', failed))
      continue
    }
    if (skillNeedsEnemy(skill) && focus === null) {
      throw new Error(`${skill.id} was selected without a target`)
    }
    events.push(priorityEvent(hero, timeMs, index, skill, 'use', null))
    return { kind: 'skill', skill, targets: targetsFor(state, hero, skill, focus), focus, events }
  }
  if (rows.length > 0) {
    events.push(priorityEvent(hero, timeMs, null, null, 'fallback', 'no priority row was eligible'))
  }
  return { kind: 'basicAttack', events }
}
