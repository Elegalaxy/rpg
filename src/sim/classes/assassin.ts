import {
  BOSS_DURATION_FRACTION,
  BOSS_STACK_CAP_FACTOR,
  POISON_DURATION_SECONDS,
  POISON_MAX_STACKS,
  POISON_TICK_SECONDS,
} from '../constants.ts'
import type {
  ClassAction,
  ClassModule,
  CombatActor,
  CombatHero,
  CombatState,
  DamageNotice,
  DamageResult,
  OutgoingModifierQuery,
  SkillDef,
  StatusSnapshot,
} from '../types.ts'
import { defineClassResource, spiritResourceFactor } from './resources.ts'

export const ADVANTAGE_RESOURCE_ID = 'advantage'
export const ADVANTAGE_MAXIMUM = 5
export const ADVANTAGE_SCOPE = 'encounter' as const
/** One qualifying action. Spirit applies. Weapon time does not. */
export const ADVANTAGE_GAIN_BASE = 1
export const EXECUTE_STACK_BONUS = 0.4
export const EXECUTE_MISSING_HEALTH_BONUS = 0.5
export const MARK_REFRESH_FLOOR_MS = 8000
export const MARK_REMAINING_CAP_MS = 12000
/** Skill text that references Mark. In this step only Shadow Cut uses it. */
export const MARK_EXPLOIT_TAG = 'markExploit'
export const EXECUTE_TAG = 'execute'

export const NODE_SHADOW_CUT = 'assassin-shadow-cut'
export const NODE_ELUSIVE_FOOTWORK = 'assassin-elusive-footwork'
export const NODE_AMBUSH = 'assassin-ambush'
export const NODE_GHOST = 'assassin-ghost'
export const NODE_POTENT_TOXINS = 'assassin-potent-toxins'
export const NODE_TOXIC_OPPORTUNITY = 'assassin-toxic-opportunity'
export const NODE_TOXIC_SOVEREIGN = 'assassin-toxic-sovereign'
export const NODE_EXPLOIT_WEAKNESS = 'assassin-exploit-weakness'
export const NODE_RELENTLESS = 'assassin-relentless'
export const NODE_DEATH_SENTENCE = 'assassin-death-sentence'

export const SHADOW_CUT_ID = 'shadow-cut'
export const SMOKE_STEP_ID = 'smoke-step'
export const MARK_FOR_DEATH_ID = 'mark-for-death'

/** Replaces Shadow Cut's 110% coefficient against a Marked target. */
export const SHADOW_CUT_MARKED_COEFFICIENT = 1.35
export const ELUSIVE_EVASION = 15
export const ELUSIVE_COOLDOWN_MS = 1000
export const AMBUSH_DAMAGE = 1.3
export const AMBUSH_CRIT = 0.2
export const VEIL_MS = 4000
export const VEIL_EVASION = 50
export const VEIL_EXTEND_MS = 1000
export const VEIL_DAMAGE = 1.4
export const POTENT_POISON_CAP = 7
export const POTENT_POISON_SECONDS = 10
export const POTENT_POISON_POTENCY = 10
export const EXPLOIT_DAMAGE = 1.15
/** Extra fractional Advantage stored when an action exploits Mark. */
export const EXPLOIT_ADVANTAGE = 1.25
export const RELENTLESS_ADVANTAGE = 2
export const EXECUTE_FATAL_PER_STACK = 0.04
export const EXECUTE_FATAL_CAP = 0.2
export const EXECUTE_BOSS_FINAL_PER_STACK = 0.1

const STATE_SMOKE = 'smokeStep'
const STATE_AMBUSH_ARMED = 'ambushArmed'
const STATE_AMBUSH_ACTIVE = 'ambushActive'
const STATE_VEIL_EXPIRES = 'veilExpiresMs'
const STATE_VEIL_RENEW = 'veilCanRenew'
const STATE_VEIL_EMPOWER = 'veilEmpower'
const STATE_VEIL_CONSUMED = 'veilConsumedRenew'
const STATE_CRIT_BONUS = 'critChanceBonus'
const STATE_EXECUTE_STACKS = 'executeStacks'
const STATE_FINAL_DAMAGE = 'finalDamageMultiplier'
const STATE_POISON = 'poisonCounts'
const STATE_ELUSIVE = 'elusiveAction'

/** `(1 + 0.4 × stacks) × (1 + 0.5 × missing-health fraction)`. That product is the hit coefficient. */
export function executeCoefficient(stacks: number, missingHealthFraction: number): number {
  return (1 + EXECUTE_STACK_BONUS * stacks) * (1 + EXECUTE_MISSING_HEALTH_BONUS * missingHealthFraction)
}

function actorById(state: CombatState, id: string): CombatActor | null {
  if (state.hero.id === id) return state.hero
  for (const enemy of state.enemies) {
    if (enemy.id === id) return enemy
  }
  return null
}

function hasNode(hero: CombatHero, id: string): boolean {
  return hero.allocatedNodeIds.includes(id)
}

function setState(hero: CombatHero, key: string, value: number | string | boolean | null): void {
  if (value === null) {
    if (hero.classState[key] === undefined) return
    const next: CombatHero['classState'] = {}
    for (const existing of Object.keys(hero.classState)) {
      if (existing === key) continue
      const kept = hero.classState[existing]
      if (kept !== undefined) next[existing] = kept
    }
    hero.classState = next
    return
  }
  hero.classState = { ...hero.classState, [key]: value }
}

function stateNumber(hero: CombatHero, key: string): number | null {
  const value = hero.classState[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function assassinHero(actor: CombatActor): CombatHero | null {
  if (actor.side !== 'hero') return null
  const hero = actor as CombatHero
  if (hero.classId !== 'assassin') return null
  return hero
}

function logAdvantage(
  state: CombatState,
  timeMs: number,
  reason: string,
  base: number,
  multiplier: number,
  generated: number,
  before: number,
  after: number,
  fractionBefore: number,
  fractionAfter: number,
): void {
  const hero = state.hero
  state.log.push({
    type: 'resource',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    resourceId: hero.classResourceId,
    scope: hero.classResourceScope,
    reason,
    base,
    multiplier,
    generated,
    gainCap: null,
    before,
    after,
    maximum: hero.classResourceMax,
    fractionBefore,
    fractionAfter,
  })
}

/**
 * Add one Advantage credit, then convert at most one whole stack.
 * At 5 stacks, discard further whole stacks and keep only the fraction below 1.
 * `progressFactor` is 1 except when Mark exploitation stores the extra 25%.
 */
function grantAdvantage(state: CombatState, timeMs: number, reason: string, progressFactor = 1): void {
  const hero = state.hero
  const multiplier = spiritResourceFactor(hero.spirit) * progressFactor
  const credit = ADVANTAGE_GAIN_BASE * multiplier
  const before = hero.classResource
  const fractionBefore = hero.resourceFraction
  let stacks = before
  let fraction = fractionBefore + credit
  if (stacks < ADVANTAGE_MAXIMUM && fraction >= 1) {
    stacks += 1
    fraction -= 1
  }
  if (stacks >= ADVANTAGE_MAXIMUM) fraction -= Math.floor(fraction)
  hero.classResource = stacks
  hero.resourceFraction = fraction
  logAdvantage(state, timeMs, reason, ADVANTAGE_GAIN_BASE, multiplier, credit, before, stacks, fractionBefore, fraction)
}

function refreshMarkedTarget(state: CombatState, target: CombatActor, timeMs: number): void {
  const mark = target.statuses.mark
  if (mark === null || mark.expiresMs === null) return
  const remaining = mark.expiresMs - timeMs
  let next = remaining
  if (next < MARK_REFRESH_FLOOR_MS) next = MARK_REFRESH_FLOOR_MS
  if (next > MARK_REMAINING_CAP_MS) next = MARK_REMAINING_CAP_MS
  mark.expiresMs = timeMs + next
  state.log.push({
    type: 'markRefresh',
    timeMs,
    actorId: state.hero.id,
    actorName: state.hero.name,
    targetId: target.id,
    targetName: target.name,
    remainingMs: remaining,
    nextRemainingMs: next,
    expiresMs: mark.expiresMs,
  })
}

function missingHealthFraction(target: CombatActor): number {
  if (target.maxHp <= 0) {
    throw new Error(`${target.name} has no maximum HP for Execute`)
  }
  return (target.maxHp - target.hp) / target.maxHp
}

function dealsDirectDamage(action: ClassAction): boolean {
  if (action.kind === 'basicAttack') return true
  for (const effect of action.skill.effects) {
    if (effect.kind === 'damage' || effect.kind === 'chain') return true
  }
  return false
}

function markedCrit(state: CombatState, action: ClassAction): boolean {
  if (action.kind === 'basicAttack') {
    if (action.crit !== true || action.targetId === undefined) return false
    const target = actorById(state, action.targetId)
    return target !== null && target.statuses.mark !== null
  }
  for (const strike of action.strikes ?? []) {
    if (!strike.hit || !strike.crit) continue
    const target = actorById(state, strike.targetId)
    if (target !== null && target.statuses.mark !== null) return true
  }
  return false
}

function rememberPoison(state: CombatState): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_TOXIC_OPPORTUNITY)) return
  const parts: string[] = []
  for (const enemy of state.enemies) {
    parts.push(`${enemy.id}=${enemy.statuses.poison?.stacks.length ?? 0}`)
  }
  setState(hero, STATE_POISON, parts.join('|'))
}

function poisonAppliedToMarked(state: CombatState): boolean {
  const saved = state.hero.classState[STATE_POISON]
  if (typeof saved !== 'string') return false
  const before: { [id: string]: number } = {}
  if (saved.length > 0) {
    for (const part of saved.split('|')) {
      const splitAt = part.lastIndexOf('=')
      if (splitAt <= 0) continue
      const count = Number(part.slice(splitAt + 1))
      if (!Number.isInteger(count)) continue
      before[part.slice(0, splitAt)] = count
    }
  }
  for (const enemy of state.enemies) {
    if (enemy.statuses.mark === null) continue
    const stacks = enemy.statuses.poison?.stacks.length ?? 0
    if (stacks > (before[enemy.id] ?? 0)) return true
  }
  return false
}

function enemyActionKey(state: CombatState, timeMs: number): string {
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event === undefined || event.type !== 'action' || event.timeMs !== timeMs) continue
    if (event.actorId === state.hero.id) continue
    return `${event.actorId}@${event.timeMs}`
  }
  return `miss@${timeMs}`
}

function reduceSmokeCooldown(state: CombatState, timeMs: number): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_ELUSIVE_FOOTWORK) || hero.classState[STATE_SMOKE] !== true) return
  const key = enemyActionKey(state, timeMs)
  if (hero.classState[STATE_ELUSIVE] === key) return
  setState(hero, STATE_ELUSIVE, key)
  const ready = hero.cooldowns[SMOKE_STEP_ID]
  if (ready === undefined || ready <= timeMs) return
  const next = ready - ELUSIVE_COOLDOWN_MS
  hero.cooldowns[SMOKE_STEP_ID] = next < timeMs ? timeMs : next
}

function extendVeil(state: CombatState, timeMs: number): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_GHOST)) return
  const expires = stateNumber(hero, STATE_VEIL_EXPIRES)
  if (expires === null || expires <= timeMs) return
  const next = expires + VEIL_EXTEND_MS
  setState(hero, STATE_VEIL_EXPIRES, next)
  if (hero.timedEvasionExpiresMs > timeMs) hero.timedEvasionExpiresMs = next
}

function startVeil(state: CombatState, timeMs: number, canRenew: boolean): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_GHOST)) return
  const expires = timeMs + VEIL_MS
  setState(hero, STATE_VEIL_EXPIRES, expires)
  setState(hero, STATE_VEIL_RENEW, canRenew)
  hero.timedEvasion = VEIL_EVASION
  hero.timedEvasionExpiresMs = expires
  state.log.push({
    type: 'buff',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    kind: 'evasion',
    value: VEIL_EVASION,
    until: 'duration',
    expiresMs: expires,
  })
}

function consumeVeil(state: CombatState, timeMs: number): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_GHOST)) return
  const expires = stateNumber(hero, STATE_VEIL_EXPIRES)
  if (expires === null) return
  if (expires <= timeMs) {
    setState(hero, STATE_VEIL_EXPIRES, null)
    setState(hero, STATE_VEIL_RENEW, null)
    return
  }
  const canRenew = hero.classState[STATE_VEIL_RENEW] === true
  setState(hero, STATE_VEIL_EXPIRES, null)
  setState(hero, STATE_VEIL_RENEW, null)
  setState(hero, STATE_VEIL_EMPOWER, true)
  if (canRenew) setState(hero, STATE_VEIL_CONSUMED, true)
  if (hero.timedEvasion === 0) return
  const evasion = hero.timedEvasion
  hero.timedEvasion = 0
  hero.timedEvasionExpiresMs = 0
  state.log.push({
    type: 'buffEnded',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    damageReduction: 0,
    evasion,
    incomingMultiplier: 1,
    reason: 'duration',
  })
}

function beginAction(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  if (hero.classState[STATE_SMOKE] === true) {
    setState(hero, STATE_SMOKE, null)
    setState(hero, STATE_ELUSIVE, null)
  }
  if (
    hero.classState[STATE_AMBUSH_ARMED] === true &&
    dealsDirectDamage(action) &&
    hasNode(hero, NODE_AMBUSH)
  ) {
    setState(hero, STATE_AMBUSH_ARMED, null)
    setState(hero, STATE_AMBUSH_ACTIVE, true)
    const room = 1 - hero.critChance
    const bonus = room < AMBUSH_CRIT ? (room > 0 ? room : 0) : AMBUSH_CRIT
    if (bonus > 0) {
      hero.critChance += bonus
      setState(hero, STATE_CRIT_BONUS, bonus)
    }
  }
  consumeVeil(state, timeMs)
  rememberPoison(state)
}

function restoreCrit(hero: CombatHero): void {
  const bonus = stateNumber(hero, STATE_CRIT_BONUS)
  if (bonus !== null && bonus !== 0) {
    hero.critChance -= bonus
    if (hero.critChance < 0) hero.critChance = 0
    if (hero.critChance > 1) hero.critChance = 1
  }
  setState(hero, STATE_CRIT_BONUS, null)
}

function finishAction(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  const renew = hero.classState[STATE_VEIL_CONSUMED] === true
  if (action.kind === 'skill' && action.skill.id === SMOKE_STEP_ID) {
    if (hasNode(hero, NODE_ELUSIVE_FOOTWORK)) setState(hero, STATE_SMOKE, true)
    if (hasNode(hero, NODE_AMBUSH)) setState(hero, STATE_AMBUSH_ARMED, true)
    if (hasNode(hero, NODE_GHOST)) startVeil(state, timeMs, true)
  } else if (renew && markedCrit(state, action)) {
    startVeil(state, timeMs, false)
  }
  setState(hero, STATE_VEIL_CONSUMED, null)
  setState(hero, STATE_VEIL_EMPOWER, null)
  setState(hero, STATE_AMBUSH_ACTIVE, null)
  restoreCrit(hero)
  setState(hero, STATE_EXECUTE_STACKS, null)
  setState(hero, STATE_FINAL_DAMAGE, null)
  setState(hero, STATE_POISON, null)
  hero.pendingCoefficient = null
}

function applyShadowCut(state: CombatState, action: ClassAction): void {
  if (action.kind !== 'skill' || action.skill.id !== SHADOW_CUT_ID) return
  if (!hasNode(state.hero, NODE_SHADOW_CUT) || action.targetId === undefined) return
  const target = actorById(state, action.targetId)
  if (target === null || target.statuses.mark === null) return
  state.hero.pendingCoefficient = SHADOW_CUT_MARKED_COEFFICIENT
}

function clearExecuteAdjust(hero: CombatHero): void {
  setState(hero, STATE_EXECUTE_STACKS, null)
  setState(hero, STATE_FINAL_DAMAGE, null)
}

function poisonCap(hero: CombatHero, boss: boolean): number {
  const normal = hasNode(hero, NODE_POTENT_TOXINS) ? POTENT_POISON_CAP : POISON_MAX_STACKS
  if (!boss) return normal
  const scaled = Math.round(normal * BOSS_STACK_CAP_FACTOR)
  return scaled < 1 ? 1 : scaled
}

function poisonDurationMs(hero: CombatHero, boss: boolean): number {
  const seconds = hasNode(hero, NODE_POTENT_TOXINS) ? POTENT_POISON_SECONDS : POISON_DURATION_SECONDS
  const scaled = boss ? seconds * BOSS_DURATION_FRACTION : seconds
  return Math.round(scaled * 1000)
}

function spreadPoison(state: CombatState, victim: CombatActor, timeMs: number): void {
  const poison = victim.statuses.poison
  if (poison === null) return
  const grant = Math.floor(poison.stacks.length / 2)
  if (grant <= 0) return
  const hero = state.hero
  const tickMs = Math.round(POISON_TICK_SECONDS * 1000)
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.id === victim.id) continue
    const cap = poisonCap(hero, enemy.boss)
    const current = enemy.statuses.poison
    const before = current === null ? 0 : current.stacks.length
    const room = cap - before
    const added = room > 0 ? Math.min(room, grant) : 0
    const expiresMs = timeMs + poisonDurationMs(hero, enemy.boss)
    if (current === null) {
      if (added <= 0) continue
      const stacks: StatusSnapshot[] = []
      for (let index = 0; index < added; index += 1) {
        const source = poison.stacks[index]
        if (source === undefined) break
        stacks.push({ ...source })
      }
      enemy.statuses.poison = {
        name: poison.name,
        stacks,
        expiresMs,
        tickMs,
        nextTickMs: timeMs + tickMs,
      }
    } else {
      current.expiresMs = expiresMs
      for (let index = 0; index < added; index += 1) {
        const source = poison.stacks[index]
        if (source === undefined) break
        current.stacks.push({ ...source })
      }
    }
    const after = enemy.statuses.poison
    state.log.push({
      type: 'statusAttempt',
      timeMs,
      actorId: hero.id,
      actorName: hero.name,
      targetId: enemy.id,
      targetName: enemy.name,
      statusId: 'poison',
      statusName: poison.name,
      school: 'physical',
      baseChance: 1,
      potency: 0,
      resistance: 0,
      chance: 1,
      roll: null,
      result: added > 0 ? 'applied' : 'cap',
      stacks: after === null ? before : after.stacks.length,
      intensity: 0,
      expiresMs: after === null ? null : after.expiresMs,
      delayMs: null,
      nextReadyMs: null,
    })
  }
}

function clearMarkOnDeath(state: CombatState, victim: CombatActor, timeMs: number): void {
  const mark = victim.statuses.mark
  if (mark === null) return
  victim.statuses.mark = null
  state.log.push({
    type: 'statusCleared',
    timeMs,
    actorId: victim.id,
    actorName: victim.name,
    statusId: 'mark',
    statusName: mark.name,
    stacks: 1,
    reason: 'death',
  })
}

function relentless(state: CombatState, timeMs: number): void {
  const hero = state.hero
  const ready = hero.cooldowns[MARK_FOR_DEATH_ID]
  if (ready !== undefined && ready > timeMs) delete hero.cooldowns[MARK_FOR_DEATH_ID]
  const before = hero.classResource
  if (before >= RELENTLESS_ADVANTAGE) return
  const after = RELENTLESS_ADVANTAGE > ADVANTAGE_MAXIMUM ? ADVANTAGE_MAXIMUM : RELENTLESS_ADVANTAGE
  const fraction = hero.resourceFraction
  hero.classResource = after
  logAdvantage(state, timeMs, 'relentless', after - before, 1, after - before, before, after, fraction, fraction)
}

function stackCount(hero: CombatHero): number | null {
  const stacks = stateNumber(hero, STATE_EXECUTE_STACKS)
  if (stacks === null || !Number.isInteger(stacks) || stacks < 0) return null
  return stacks
}

/** Smoke Step's authored Evasion, plus 15 while Elusive Footwork is allocated. */
export function adjustedEvasionAmount(hero: CombatHero, skill: SkillDef, amount: number): number {
  if (hero.classId !== 'assassin' || skill.id !== SMOKE_STEP_ID) return amount
  if (!hasNode(hero, NODE_ELUSIVE_FOOTWORK)) return amount
  return amount + ELUSIVE_EVASION
}

/** +15% direct damage against a Marked target. Unallocated and unmarked stay at 1. */
export function markedDirectFactor(hero: CombatHero, target: CombatActor): number {
  if (hero.classId !== 'assassin' || !hasNode(hero, NODE_EXPLOIT_WEAKNESS)) return 1
  if (target.statuses.mark === null) return 1
  return EXPLOIT_DAMAGE
}

/**
 * Ordinary Execute below `4% HP × stacks`, capped at 20%, deals the target's current HP.
 * Bosses are unchanged here. A rolled hit that is already lethal stays as rolled.
 */
export function applyFatalExecute(
  hero: CombatHero,
  target: CombatActor,
  skill: SkillDef,
  result: DamageResult,
): DamageResult {
  if (!result.hit || hero.classId !== 'assassin' || !skill.tags.includes(EXECUTE_TAG)) return result
  if (!hasNode(hero, NODE_DEATH_SENTENCE) || target.boss || target.maxHp <= 0 || target.hp <= 0) return result
  const stacks = stackCount(hero)
  if (stacks === null || stacks <= 0) return result
  const fraction = Math.min(EXECUTE_FATAL_CAP, EXECUTE_FATAL_PER_STACK * stacks)
  const thousandths = Math.round(fraction * 1000)
  if (target.hp * 1000 >= target.maxHp * thousandths) return result
  if (result.hpDamage >= target.hp) return result
  return { ...result, hpDamage: target.hp }
}

/** Null keeps the status definition. Potent Toxins replaces cap, duration, and application Potency. */
export function poisonApplicationAdjust(
  source: CombatActor,
): { maxStacks: number; durationSeconds: number; potencyBonus: number } | null {
  const hero = assassinHero(source)
  if (hero === null || !hasNode(hero, NODE_POTENT_TOXINS)) return null
  return {
    maxStacks: POTENT_POISON_CAP,
    durationSeconds: POTENT_POISON_SECONDS,
    potencyBonus: POTENT_POISON_POTENCY,
  }
}

/** Death Sentence Mark does not expire by duration. */
export function persistentMark(source: CombatActor): boolean {
  const hero = assassinHero(source)
  return hero !== null && hasNode(hero, NODE_DEATH_SENTENCE)
}

/** While the target is Marked, Poison's remaining duration does not count down. */
export function holdMarkedPoison(state: CombatState, actor: CombatActor, stepStart: number, stepEnd: number): void {
  const hero = state.hero
  if (hero.classId !== 'assassin' || !hasNode(hero, NODE_TOXIC_SOVEREIGN)) return
  if (actor.statuses.mark === null) return
  const poison = actor.statuses.poison
  if (poison === null) return
  const elapsed = stepEnd - stepStart
  if (elapsed <= 0) return
  poison.expiresMs += elapsed
}

function encounterStart(state: CombatState, timeMs: number): void {
  state.hero.resourceFraction = 0
  state.hero.pendingCoefficient = null
  defineClassResource(state, timeMs, {
    id: ADVANTAGE_RESOURCE_ID,
    maximum: ADVANTAGE_MAXIMUM,
    scope: ADVANTAGE_SCOPE,
    amount: 0,
    regenPerSecond: 0,
  })
}

function encounterEnd(state: CombatState, timeMs: number): void {
  const hero = state.hero
  restoreCrit(hero)
  const before = hero.classResource
  const fractionBefore = hero.resourceFraction
  hero.classResource = 0
  hero.resourceFraction = 0
  hero.pendingCoefficient = null
  setState(hero, STATE_SMOKE, null)
  setState(hero, STATE_AMBUSH_ARMED, null)
  setState(hero, STATE_AMBUSH_ACTIVE, null)
  setState(hero, STATE_VEIL_EXPIRES, null)
  setState(hero, STATE_VEIL_RENEW, null)
  setState(hero, STATE_VEIL_EMPOWER, null)
  setState(hero, STATE_VEIL_CONSUMED, null)
  setState(hero, STATE_EXECUTE_STACKS, null)
  setState(hero, STATE_FINAL_DAMAGE, null)
  setState(hero, STATE_POISON, null)
  setState(hero, STATE_ELUSIVE, null)
  if (before === 0 && fractionBefore === 0) return
  logAdvantage(state, timeMs, 'encounterEnd', 0, 1, -before, before, 0, fractionBefore, 0)
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  beginAction(state, action, timeMs)
  if (action.kind !== 'skill' || !action.skill.tags.includes(EXECUTE_TAG)) {
    hero.pendingCoefficient = null
    clearExecuteAdjust(hero)
    applyShadowCut(state, action)
    return
  }
  if (action.targetId === undefined) throw new Error('Execute requires a target')
  const target = actorById(state, action.targetId)
  if (target === null) throw new Error(`Execute target '${action.targetId}' is not in the encounter`)
  const stacks = hero.classResource
  const fraction = hero.resourceFraction
  const missing = missingHealthFraction(target)
  hero.pendingCoefficient = executeCoefficient(stacks, missing)
  hero.classResource = 0
  logAdvantage(state, timeMs, 'execute', stacks, 1, -stacks, stacks, 0, fraction, fraction)
  if (!hasNode(hero, NODE_DEATH_SENTENCE)) {
    clearExecuteAdjust(hero)
    return
  }
  setState(hero, STATE_EXECUTE_STACKS, stacks)
  if (target.boss) setState(hero, STATE_FINAL_DAMAGE, 1 + EXECUTE_BOSS_FINAL_PER_STACK * stacks)
  else setState(hero, STATE_FINAL_DAMAGE, null)
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  let crit = false
  let exploited = false
  const refreshTargets: CombatActor[] = []
  if (action.kind === 'basicAttack') {
    crit = action.hit && action.crit === true
    if (action.hit && action.targetId !== undefined) {
      const target = actorById(state, action.targetId)
      if (target !== null) refreshTargets.push(target)
    }
  } else {
    const marked: CombatActor[] = []
    for (const strike of action.strikes ?? []) {
      if (!strike.hit) continue
      if (strike.crit) crit = true
      const target = actorById(state, strike.targetId)
      if (target === null) continue
      refreshTargets.push(target)
      if (target.statuses.mark !== null) marked.push(target)
    }
    if (action.skill.tags.includes(MARK_EXPLOIT_TAG) && marked.length > 0) exploited = true
  }
  for (const target of refreshTargets) refreshMarkedTarget(state, target, timeMs)
  const poisoned = poisonAppliedToMarked(state)
  if (crit || exploited || poisoned) {
    const reason = crit && exploited ? 'criticalAndMark' : crit ? 'critical' : exploited ? 'mark' : 'poison'
    const progress = exploited && hasNode(state.hero, NODE_EXPLOIT_WEAKNESS) ? EXPLOIT_ADVANTAGE : 1
    grantAdvantage(state, timeMs, reason, progress)
  }
  finishAction(state, action, timeMs)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  if (notice.kind !== 'miss') return
  grantAdvantage(state, notice.timeMs, 'evasion')
  reduceSmokeCooldown(state, notice.timeMs)
  extendVeil(state, notice.timeMs)
}

function kill(state: CombatState, victimId: string, timeMs: number): void {
  const victim = actorById(state, victimId)
  if (victim === null || victim.statuses.mark === null) return
  const hero = state.hero
  if (hasNode(hero, NODE_TOXIC_SOVEREIGN)) spreadPoison(state, victim, timeMs)
  if (hasNode(hero, NODE_RELENTLESS)) relentless(state, timeMs)
  if (hasNode(hero, NODE_DEATH_SENTENCE)) clearMarkOnDeath(state, victim, timeMs)
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  if (query.school === 'healing') return 1
  let factor = 1
  if (state.hero.classState[STATE_AMBUSH_ACTIVE] === true) factor *= AMBUSH_DAMAGE
  if (state.hero.classState[STATE_VEIL_EMPOWER] === true) factor *= VEIL_DAMAGE
  return factor
}

export const assassinClass: ClassModule = {
  encounterStart,
  encounterEnd,
  actionChosen,
  actionResolved,
  damageTaken,
  kill,
  outgoingModifiers,
}
