import type {
  ClassAction,
  ClassModule,
  CombatHero,
  CombatState,
  DamageNotice,
  OutgoingModifierQuery,
  ResourceEvent,
} from '../types.ts'
import {
  BALANCE_BASIC_WRATH,
  BALANCE_JUDGMENT_WRATH,
  BALANCE_MAXIMUM,
  BALANCE_MEND_GRACE,
  BALANCE_PENANCE_GRACE,
  BALANCE_PENANCE_WRATH,
  BALANCE_SMITE_WRATH,
  BALANCE_WARD_GRACE,
  CONSECRATION_ID,
  EXALTED_FACTOR,
  EXALTED_FAITH_LOSS,
  EXALTED_LOCKOUT_MS,
  JUDGMENT_ID,
  MEND_ID,
  MERCY_FACTOR,
  NODE_EXALTED_VOW,
  NODE_FINAL_MERCY,
  NODE_LIVING_SANCTUARY,
  NODE_RIGHTEOUS_FORCE,
  NODE_SAFEGUARD,
  NODE_SMITE,
  NODE_STEADFAST_SPIRIT,
  NODE_VOWKEEPER,
  PENANCE_ID,
  RELEASE_IDS,
  RELEASE_STRIKE_ID,
  RIGHTEOUS_DAMAGE,
  SAFEGUARD_CAP,
  SAFEGUARD_STEP,
  SANCTUARY_CAP,
  SANCTUARY_STORE,
  SMITE_ID,
  SMITE_NODE_COEFFICIENT,
  STATE_GRACE,
  STATE_LAST_CATEGORY,
  STATE_LOCKOUT_UNTIL,
  STATE_LOG_CURSOR,
  STATE_MERCY_HEAL,
  STATE_MERCY_STRIKE,
  STATE_SANCTUARY_ENDS,
  STATE_SANCTUARY_STORED,
  STATE_STEADFAST_USED,
  STATE_WARD_EFFECTIVE,
  STATE_WRATH,
  STEADFAST_BASE,
  STEADFAST_HP,
  VOWKEEPER_FACTOR,
  WARD_ID,
  balanceActive,
  balanceCost,
  categoryOf,
  faithCost,
  faithGenerationLocked,
  hasNode,
  numberState,
  setState,
  spendsForOffense,
} from './clericAdjust.ts'
import {
  defineClassResource,
  grantClassResource,
  normalizeBasicAttackResource,
  payClassResource,
  spiritResourceFactor,
} from './resources.ts'

export const FAITH_RESOURCE_ID = 'faith'
export const FAITH_MAXIMUM = 100
export const FAITH_SCOPE = 'expedition' as const
/** A new combat starts empty. Faith does not decay and is not cleared at encounter end. */
export const FAITH_START = 0

export const VOW_ZEAL = 'zeal'
export const VOW_ENDURANCE = 'endurance'
export const VOW_TEMPERANCE = 'temperance'
export const CLERIC_VOWS = [VOW_ZEAL, VOW_ENDURANCE, VOW_TEMPERANCE] as const
export type ClericVow = (typeof CLERIC_VOWS)[number]

/** Locked at encounter start. The live vow is this class-state entry. */
export const VOW_STATE_KEY = 'vow'

/** Direct HP damage from a hero action. Not weapon-normalized. At most once per action. */
export const ZEAL_BASE = 5
/** Per 1% of maximum HP lost or absorbed, before the per-action cap. Full precision. */
export const ENDURANCE_BASE_PER_PERCENT = 1
/** Cap on the Endurance base, applied before Spirit. */
export const ENDURANCE_BASE_CAP = 10
/** After a hero action that ends inside the HP band. Not weapon-normalized. */
export const TEMPERANCE_BASE = 5
export const TEMPERANCE_HP_MIN = 0.4
export const TEMPERANCE_HP_MAX = 0.8

const VOW_LIST = 'zeal, endurance, or temperance'

function isVow(value: string): value is ClericVow {
  return value === VOW_ZEAL || value === VOW_ENDURANCE || value === VOW_TEMPERANCE
}

function requireVow(value: string | null): ClericVow {
  if (value === null || value.length === 0) {
    throw new Error(`cleric vow is missing; expected ${VOW_LIST}`)
  }
  if (!isVow(value)) {
    throw new Error(`cleric vow '${value}' is unknown; expected ${VOW_LIST}`)
  }
  return value
}

function lockedVow(hero: CombatHero): ClericVow {
  const value = hero.classState[VOW_STATE_KEY]
  if (typeof value !== 'string') {
    throw new Error(`cleric vow is missing; expected ${VOW_LIST}`)
  }
  return requireVow(value)
}

function directHpLost(action: ClassAction): number {
  if (action.kind === 'basicAttack') return action.hpLost ?? 0
  let lost = 0
  for (const strike of action.strikes ?? []) lost += strike.hpLost ?? 0
  return lost
}

/** Zeal is only tested by offensive actions. A heal or ward cannot break it. */
function isOffensiveAction(action: ClassAction): boolean {
  return action.kind === 'basicAttack' || action.skill.tags.includes('attack')
}

function vowMultiplier(hero: CombatHero): number {
  let factor = 1
  if (hasNode(hero, NODE_VOWKEEPER)) factor *= VOWKEEPER_FACTOR
  if (hasNode(hero, NODE_EXALTED_VOW)) factor *= EXALTED_FACTOR
  return factor
}

function temperanceFailure(hero: CombatHero): 'hp' | 'overheal' | 'overcap' | null {
  if (hero.overhealed) return 'overheal'
  const ratio = hero.maxHp <= 0 ? 0 : hero.hp / hero.maxHp
  if (ratio < TEMPERANCE_HP_MIN || ratio > TEMPERANCE_HP_MAX) return 'hp'
  const generated = TEMPERANCE_BASE * vowMultiplier(hero) * spiritResourceFactor(hero.spirit)
  if (hero.classResource + generated > hero.classResourceMax) return 'overcap'
  return null
}

function telegraphActive(state: CombatState): boolean {
  return state.enemies.some((enemy) => enemy.alive && enemy.telegraph !== null)
}

/** One vow gain, after Vowkeeper and Exalted Vow, plus Steadfast Spirit once per hero action. */
function vowGain(state: CombatState, timeMs: number, base: number, vow: ClericVow): void {
  const hero = state.hero
  if (faithGenerationLocked(hero, timeMs)) return
  grantClassResource(state, timeMs, base * vowMultiplier(hero), vow)
  if (!hasNode(hero, NODE_STEADFAST_SPIRIT) || hero.classState[STATE_STEADFAST_USED] === true) return
  const low = hero.maxHp > 0 && hero.hp / hero.maxHp < STEADFAST_HP
  if (!low && !telegraphActive(state)) return
  setState(hero, STATE_STEADFAST_USED, true)
  grantClassResource(state, timeMs, STEADFAST_BASE, 'steadfast')
}

/** Exalted Vow: a broken condition removes 50 Faith and locks generation for 5 seconds. */
function breakVow(state: CombatState, timeMs: number, vow: ClericVow): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_EXALTED_VOW) || faithGenerationLocked(hero, timeMs)) return
  const loss = hero.classResource < EXALTED_FAITH_LOSS ? hero.classResource : EXALTED_FAITH_LOSS
  payClassResource(state, timeMs, loss, 'vowBreak')
  setState(hero, STATE_LOCKOUT_UNTIL, timeMs + EXALTED_LOCKOUT_MS)
  state.log.push({
    type: 'vow',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    vow,
    reason: 'broken',
  })
}

function pushMeter(
  state: CombatState,
  timeMs: number,
  id: string,
  reason: string,
  base: number,
  multiplier: number,
  before: number,
  after: number,
): void {
  const hero = state.hero
  const event: ResourceEvent = {
    type: 'resource',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    resourceId: id,
    scope: 'encounter',
    reason,
    base,
    multiplier,
    generated: after - before,
    gainCap: null,
    before,
    after,
    maximum: BALANCE_MAXIMUM,
  }
  state.log.push(event)
}

function gainBalance(state: CombatState, timeMs: number, key: string, base: number, reason: string): void {
  const hero = state.hero
  const factor = spiritResourceFactor(hero.spirit)
  const before = numberState(hero, key)
  const raw = before + base * factor
  const after = raw > BALANCE_MAXIMUM ? BALANCE_MAXIMUM : raw
  setState(hero, key, after)
  pushMeter(state, timeMs, key, reason, base, factor, before, after)
}

function payBalance(state: CombatState, timeMs: number, key: string, cost: number, reason: string): void {
  if (cost <= 0) return
  const before = numberState(state.hero, key)
  const after = before - cost < 0 ? 0 : before - cost
  setState(state.hero, key, after)
  pushMeter(state, timeMs, key, reason, cost, 1, before, after)
}

/** Safeguard refunds are not generation, so Spirit and the Exalted lockout do not touch them. */
function refundFaith(state: CombatState, timeMs: number, amount: number): void {
  const hero = state.hero
  if (amount <= 0 || hero.classResourceId === '') return
  const before = hero.classResource
  const raw = before + amount
  const after = raw > hero.classResourceMax ? hero.classResourceMax : raw
  hero.classResource = after
  const event: ResourceEvent = {
    type: 'resource',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    resourceId: hero.classResourceId,
    scope: hero.classResourceScope,
    reason: 'safeguard',
    base: amount,
    multiplier: 1,
    generated: after - before,
    gainCap: null,
    before,
    after,
    maximum: hero.classResourceMax,
  }
  state.log.push(event)
}

function sanctuaryOpen(hero: CombatHero, timeMs: number): boolean {
  const ends = hero.classState[STATE_SANCTUARY_ENDS]
  return hasNode(hero, NODE_LIVING_SANCTUARY) && typeof ends === 'number' && timeMs < ends
}

function storeSanctuary(hero: CombatHero, timeMs: number, amount: number): void {
  if (!sanctuaryOpen(hero, timeMs) || amount <= 0) return
  const cap = hero.maxHp * SANCTUARY_CAP
  const next = numberState(hero, STATE_SANCTUARY_STORED) + amount * SANCTUARY_STORE
  setState(hero, STATE_SANCTUARY_STORED, next > cap ? cap : next)
}

function safeguardRefund(state: CombatState, timeMs: number, effective: number): void {
  const hero = state.hero
  if (!hasNode(hero, NODE_SAFEGUARD) || hero.maxHp <= 0 || balanceActive(hero)) return
  let steps = Math.floor(effective / (SAFEGUARD_STEP * hero.maxHp))
  if (steps > SAFEGUARD_CAP) steps = SAFEGUARD_CAP
  refundFaith(state, timeMs, steps)
}

/**
 * Walk the log events added since the last call. Heals and barrier absorption feed
 * Safeguard, Living Sanctuary, Final Mercy, and Sacred Balance. Reading the log keeps
 * the class hook list fixed, and every event is read exactly once.
 */
export function syncCleric(state: CombatState): void {
  const hero = state.hero
  const start = numberState(hero, STATE_LOG_CURSOR)
  const end = state.log.length
  if (start >= end) return
  setState(hero, STATE_LOG_CURSOR, end)
  for (let index = start; index < end; index += 1) {
    const event = state.log[index]
    if (event === undefined) continue
    if ((event.type === 'heal' || event.type === 'fieldHeal') && event.actorId === hero.id) {
      const effective = event.targetHpAfter - event.targetHpBefore
      if (effective <= 0) continue
      safeguardRefund(state, event.timeMs, effective)
      storeSanctuary(hero, event.timeMs, effective)
      continue
    }
    if (event.type === 'damage' && event.targetId === hero.id && event.barrierAbsorbed > 0) {
      safeguardRefund(state, event.timeMs, event.barrierAbsorbed)
      storeSanctuary(hero, event.timeMs, event.barrierAbsorbed)
      if (hasNode(hero, NODE_FINAL_MERCY)) setState(hero, STATE_MERCY_STRIKE, true)
      if (balanceActive(hero) && hero.classState[STATE_WARD_EFFECTIVE] !== true) {
        setState(hero, STATE_WARD_EFFECTIVE, true)
        gainBalance(state, event.timeMs, STATE_GRACE, BALANCE_WARD_GRACE, WARD_ID)
      }
    }
  }
}

function actionHealEffective(state: CombatState, timeMs: number): number {
  let total = 0
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const event = state.log[index]
    if (event === undefined || event.timeMs < timeMs) break
    if (event.type === 'heal' && event.actorId === state.hero.id) total += event.targetHpAfter - event.targetHpBefore
  }
  return total
}

function encounterStart(state: CombatState, timeMs: number): void {
  const hero = state.hero
  const balance = balanceActive(hero)
  if (!balance) {
    const vow = requireVow(hero.suppliedVow)
    hero.classState = { ...hero.classState, [VOW_STATE_KEY]: vow }
  }
  const supplied = hero.carryResource && hero.suppliedResource !== null ? hero.suppliedResource : FAITH_START
  defineClassResource(state, timeMs, {
    id: FAITH_RESOURCE_ID,
    maximum: FAITH_MAXIMUM,
    scope: FAITH_SCOPE,
    amount: balance ? 0 : supplied,
    regenPerSecond: 0,
  })
  setState(hero, STATE_LOG_CURSOR, state.log.length)
  if (balance) {
    setState(hero, STATE_GRACE, 0)
    setState(hero, STATE_WRATH, 0)
  }
}

function actionChosen(state: CombatState, action: ClassAction, timeMs: number): void {
  if (action.kind !== 'skill') return
  syncCleric(state)
  const hero = state.hero
  const skill = action.skill
  if (skill.id === SMITE_ID && hasNode(hero, NODE_SMITE)) hero.pendingCoefficient = SMITE_NODE_COEFFICIENT
  if (skill.id === RELEASE_STRIKE_ID) {
    const stored = numberState(hero, STATE_SANCTUARY_STORED)
    hero.pendingCoefficient = hero.magicalPower > 0 ? stored / hero.magicalPower : 0
  }
  if (balanceActive(hero)) {
    const cost = balanceCost(skill)
    if (cost !== null) {
      payBalance(state, timeMs, STATE_GRACE, cost.grace, skill.id)
      payBalance(state, timeMs, STATE_WRATH, cost.wrath, skill.id)
    }
    if (skill.cost > 0) hero.pendingSkillCost = 0
    return
  }
  const cost = faithCost(hero, skill)
  if (cost !== skill.cost) hero.pendingSkillCost = cost
}

function afterSkill(state: CombatState, skillId: string, timeMs: number): void {
  const hero = state.hero
  if (skillId === CONSECRATION_ID && hasNode(hero, NODE_LIVING_SANCTUARY) && hero.field !== null) {
    const previous = hero.classState[STATE_SANCTUARY_ENDS]
    if (typeof previous !== 'number' || timeMs >= previous) setState(hero, STATE_SANCTUARY_STORED, 0)
    setState(hero, STATE_SANCTUARY_ENDS, hero.field.expiresMs)
  }
  if (RELEASE_IDS.includes(skillId)) {
    setState(hero, STATE_SANCTUARY_STORED, 0)
    setState(hero, STATE_SANCTUARY_ENDS, null)
  }
  if (skillId === WARD_ID) setState(hero, STATE_WARD_EFFECTIVE, null)
  if (hasNode(hero, NODE_FINAL_MERCY)) {
    if (skillId === SMITE_ID || skillId === JUDGMENT_ID) setState(hero, STATE_MERCY_STRIKE, null)
    if (skillId === MEND_ID || skillId === WARD_ID) setState(hero, STATE_MERCY_HEAL, null)
    if (skillId === MEND_ID && actionHealEffective(state, timeMs) > 0) setState(hero, STATE_MERCY_STRIKE, true)
  }
  if (!balanceActive(hero)) return
  if (skillId === SMITE_ID) gainBalance(state, timeMs, STATE_WRATH, BALANCE_SMITE_WRATH, skillId)
  if (skillId === JUDGMENT_ID) gainBalance(state, timeMs, STATE_WRATH, BALANCE_JUDGMENT_WRATH, skillId)
  if (skillId === MEND_ID && actionHealEffective(state, timeMs) > 0) {
    gainBalance(state, timeMs, STATE_GRACE, BALANCE_MEND_GRACE, skillId)
  }
  if (skillId === PENANCE_ID) {
    gainBalance(state, timeMs, STATE_GRACE, BALANCE_PENANCE_GRACE, skillId)
    gainBalance(state, timeMs, STATE_WRATH, BALANCE_PENANCE_WRATH, skillId)
  }
}

function actionResolved(state: CombatState, action: ClassAction, timeMs: number): void {
  const hero = state.hero
  hero.pendingCoefficient = null
  if (action.kind === 'skill') afterSkill(state, action.skill.id, timeMs)
  if (action.kind === 'basicAttack' && action.hit && balanceActive(hero)) {
    const base = normalizeBasicAttackResource(BALANCE_BASIC_WRATH, hero.baseActionSeconds)
    gainBalance(state, timeMs, STATE_WRATH, base, 'basicAttack')
  }
  const category = action.kind === 'skill' ? categoryOf(action.skill) : null
  if (category !== null) setState(hero, STATE_LAST_CATEGORY, category)
  syncCleric(state)
  if (balanceActive(hero)) {
    setState(hero, STATE_STEADFAST_USED, null)
    return
  }
  const vow = lockedVow(hero)
  if (vow === VOW_ZEAL) {
    if (directHpLost(action) > 0) vowGain(state, timeMs, ZEAL_BASE, VOW_ZEAL)
    else if (isOffensiveAction(action)) breakVow(state, timeMs, VOW_ZEAL)
  }
  if (vow === VOW_TEMPERANCE) {
    const reason = temperanceFailure(hero)
    if (reason !== null) {
      state.log.push({
        type: 'vow',
        timeMs,
        actorId: hero.id,
        actorName: hero.name,
        vow: VOW_TEMPERANCE,
        reason,
      })
      breakVow(state, timeMs, VOW_TEMPERANCE)
    } else {
      vowGain(state, timeMs, TEMPERANCE_BASE, VOW_TEMPERANCE)
    }
  }
  setState(hero, STATE_STEADFAST_USED, null)
}

function damageTaken(state: CombatState, notice: DamageNotice): void {
  const hero = state.hero
  syncCleric(state)
  if (balanceActive(hero)) return
  if (lockedVow(hero) !== VOW_ENDURANCE) return
  if (notice.kind !== 'hit') return
  if (hero.maxHp <= 0) return
  const absorbed = notice.barrierAbsorbed ?? 0
  let base = ((notice.hpLost + absorbed) / hero.maxHp) * 100 * ENDURANCE_BASE_PER_PERCENT
  if (base <= 0) {
    breakVow(state, notice.timeMs, VOW_ENDURANCE)
    return
  }
  if (base > ENDURANCE_BASE_CAP) base = ENDURANCE_BASE_CAP
  vowGain(state, notice.timeMs, base, VOW_ENDURANCE)
}

/** Final Mercy: a kill empowers the next Mend or Ward. */
function kill(state: CombatState): void {
  if (hasNode(state.hero, NODE_FINAL_MERCY)) setState(state.hero, STATE_MERCY_HEAL, true)
}

function encounterEnd(state: CombatState): void {
  syncCleric(state)
  state.hero.pendingCoefficient = null
}

function outgoingModifiers(state: CombatState, query: OutgoingModifierQuery): number {
  const skill = query.skill
  if (skill === null || query.school === 'healing') return 1
  const hero = state.hero
  let factor = 1
  if (hasNode(hero, NODE_RIGHTEOUS_FORCE) && spendsForOffense(skill)) factor *= RIGHTEOUS_DAMAGE
  if (hero.classState[STATE_MERCY_STRIKE] === true && (skill.id === SMITE_ID || skill.id === JUDGMENT_ID)) {
    factor *= MERCY_FACTOR
  }
  return factor
}

export const clericClass: ClassModule = {
  encounterStart,
  encounterEnd,
  actionChosen,
  actionResolved,
  damageTaken,
  kill,
  outgoingModifiers,
}
