import { chooseHeroAction, parsePriorityRules, skillActionTargets } from './automation.ts'
import { classModule } from './classes/index.ts'
import { grantClassResource, payClassResource } from './classes/resources.ts'
import { BASIC_ATTACK_COEFFICIENT, CRIT_DAMAGE_BASE, STEP_MS, WEAPON_ACTION_TIME } from './constants.ts'
import { basicHitChance, consistencyBounds, resolveDamage } from './damage.ts'
import { centeredRoll, createRng, nextFloat } from './rng.ts'
import {
  activeBarrier,
  applySkillEffects,
  assertSkillBook,
  effectiveEvasion,
  endUntilNextAction,
  finalCooldownSeconds,
  incomingDamageFactor,
} from './skills.ts'
import {
  assertStatusBook,
  chillSlowFraction,
  collectStatusTicks,
  emptyStatuses,
  expireStatuses,
  exposedDefense,
  mitigateStatusDamage,
  slowedActionMs,
  statusTickEvent,
  takeBleedTicks,
  tryApplyStatus,
} from './statuses.ts'
import type { StatusTickDraft } from './statuses.ts'
import { actionTime, deriveEnemyStats, deriveHeroStats } from './stats.ts'
import type {
  ActiveField,
  CombatActor,
  CombatHero,
  CombatHeroSetup,
  CombatSetup,
  CombatState,
  ClassStrike,
  FieldExpiredEvent,
  FieldHealEvent,
  FieldTickEvent,
  DamageNotice,
  DamageResult,
  DamageSchool,
  EnemyDef,
  FallbackDecision,
  GameDefs,
  PriorityRow,
  SkillDef,
} from './types.ts'

export { STEP_MS }

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number, received ${describeValue(value)}`)
  }
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object, received ${describeValue(value)}`)
  }
}

function assertDefs(defs: GameDefs): void {
  assertObject(defs, 'combat definitions')
  if (typeof defs.enemies !== 'object' || defs.enemies === null || Array.isArray(defs.enemies)) {
    throw new Error('combat definitions are missing enemies')
  }
  assertSkillBook(defs.skills)
  assertStatusBook(defs.statuses)
}

function assertMaxMs(maxMs: unknown): asserts maxMs is number {
  if (typeof maxMs !== 'number' || !Number.isInteger(maxMs) || maxMs < 0) {
    throw new Error(`maxMs must be an integer of at least 0, received ${describeValue(maxMs)}`)
  }
}

/** Round a duration in seconds to the nearest millisecond. The result is at least 1. */
export function roundDurationMs(seconds: number, label: string): number {
  assertFiniteNumber(seconds, label)
  if (seconds <= 0) {
    throw new Error(`${label} must be greater than 0, received ${describeValue(seconds)}`)
  }
  const ms = Math.round(seconds * 1000)
  if (ms < 1) {
    throw new Error(`${label} rounded to ${ms} ms and cannot be scheduled`)
  }
  return ms
}

function assertSchool(value: unknown, label: string): asserts value is DamageSchool {
  if (value !== 'physical' && value !== 'magical') {
    throw new Error(`${label} must be physical or magical, received ${describeValue(value)}`)
  }
}

function endEncounter(
  state: CombatState,
  outcome: 'victory' | 'defeat' | 'timeout',
  timeMs: number,
): void {
  if (state.outcome !== 'ongoing') return
  state.outcome = outcome
  classModule(state.hero.classId)?.encounterEnd?.(state, timeMs)
  state.log.push({ type: 'encounterEnd', timeMs, outcome })
}

function heroSchool(kind: string): DamageSchool {
  return kind === 'caster' ? 'magical' : 'physical'
}

function defenseOf(target: CombatActor, school: DamageSchool, timeMs: number): number {
  return exposedDefense(target, school, timeMs)
}

function compareReady(a: CombatActor, b: CombatActor): number {
  if (a.nextReadyMs !== b.nextReadyMs) return a.nextReadyMs - b.nextReadyMs
  if (a.side !== b.side) return a.side === 'hero' ? -1 : 1
  return a.slot - b.slot
}

function livingTarget(state: CombatState, actor: CombatActor): CombatActor {
  if (actor.side === 'enemy') {
    if (!state.hero.alive) throw new Error(`${actor.name} has no living target`)
    return state.hero
  }
  let best: CombatActor | null = null
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    if (best === null || enemy.slot < best.slot) best = enemy
  }
  if (best === null) throw new Error(`${actor.name} has no living target`)
  return best
}

function guardDefaults(): {
  barrier: number
  barrierExpiresMs: number
  damageReduction: number
  evasionBonus: number
  incomingMultipliers: number[]
} {
  return {
    barrier: 0,
    barrierExpiresMs: 0,
    damageReduction: 0,
    evasionBonus: 0,
    incomingMultipliers: [],
  }
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'nobody'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  const last = names[names.length - 1] ?? 'nobody'
  return `${names.slice(0, -1).join(', ')}, and ${last}`
}

function consumeBarrier(target: CombatActor, absorbed: number): void {
  if (absorbed <= 0) return
  target.barrier -= absorbed
  if (target.barrier <= 0) {
    target.barrier = 0
    target.barrierExpiresMs = 0
  }
}

function noteDeath(
  state: CombatState,
  target: CombatActor,
  killerId: string,
  killerName: string,
  timeMs: number,
): void {
  target.alive = false
  target.hp = 0
  state.log.push({
    type: 'death',
    timeMs,
    actorId: target.id,
    actorName: target.name,
    killerId,
    killerName,
  })
  if (target.side === 'hero') {
    endEncounter(state, 'defeat', timeMs)
    return
  }
  let enemiesAlive = false
  for (const enemy of state.enemies) {
    if (enemy.alive) enemiesAlive = true
  }
  if (!enemiesAlive) endEncounter(state, 'victory', timeMs)
}

type PendingDeath = {
  target: CombatActor
  killerId: string
  killerName: string
  timeMs: number
}

function notifyDamageTaken(state: CombatState, notice: DamageNotice): void {
  classModule(state.hero.classId)?.damageTaken?.(state, notice)
}

function queueDeath(
  deaths: PendingDeath[],
  target: CombatActor,
  killerId: string,
  killerName: string,
  timeMs: number,
): void {
  target.alive = false
  target.hp = 0
  deaths.push({ target, killerId, killerName, timeMs })
}

/** Log queued deaths, then end the encounter once. Resource hooks run before this. */
function commitDeaths(state: CombatState, deaths: readonly PendingDeath[]): void {
  if (deaths.length === 0 || state.outcome !== 'ongoing') return
  let heroDeath: PendingDeath | null = null
  let lastEnemyDeath: PendingDeath | null = null
  for (const death of deaths) {
    state.log.push({
      type: 'death',
      timeMs: death.timeMs,
      actorId: death.target.id,
      actorName: death.target.name,
      killerId: death.killerId,
      killerName: death.killerName,
    })
    if (death.target.side === 'hero') heroDeath = death
    else lastEnemyDeath = death
  }
  if (heroDeath !== null) {
    endEncounter(state, 'defeat', heroDeath.timeMs)
    return
  }
  let enemiesAlive = false
  for (const enemy of state.enemies) {
    if (enemy.alive) enemiesAlive = true
  }
  if (!enemiesAlive && lastEnemyDeath !== null) endEncounter(state, 'victory', lastEnemyDeath.timeMs)
}

function heroOutgoing(
  state: CombatState,
  school: DamageSchool,
  skill: SkillDef | null,
): number {
  const hook = classModule(state.hero.classId)?.outgoingModifiers
  if (hook === undefined) return 1
  const value = hook(state, { school, skill })
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`outgoing modifier must be at least 0, received ${describeValue(value)}`)
  }
  return value
}

function applyStatusDamage(state: CombatState, tick: StatusTickDraft): void {
  const target = tick.target
  if (!target.alive) return
  const hpBefore = target.hp
  let hpAfter = hpBefore - tick.hpDamage
  if (hpAfter < 0) hpAfter = 0
  target.hp = hpAfter
  state.log.push(statusTickEvent(tick, hpBefore, hpAfter))
  if (target.id === state.hero.id) {
    notifyDamageTaken(state, {
      hpLost: hpBefore - hpAfter,
      hpBefore,
      barrierAbsorbed: 0,
      kind: 'statusTick',
      timeMs: tick.timeMs,
      school: tick.school,
    })
  }
  if (hpAfter > 0) return
  noteDeath(state, target, tick.sourceId, tick.sourceName, tick.timeMs)
}

function applyHit(
  state: CombatState,
  actor: CombatActor,
  target: CombatActor,
  scheduled: number,
  result: DamageResult,
  deaths: PendingDeath[],
): void {
  const hpBefore = target.hp
  let hpAfter = hpBefore - result.hpDamage
  if (hpAfter < 0) hpAfter = 0
  target.hp = hpAfter
  consumeBarrier(target, result.barrierAbsorbed)
  state.log.push({
    type: 'damage',
    timeMs: scheduled,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    targetHpBefore: hpBefore,
    targetHpAfter: hpAfter,
    ...result,
  })
  if (target.id === state.hero.id) {
    notifyDamageTaken(state, {
      hpLost: hpBefore - hpAfter,
      hpBefore,
      barrierAbsorbed: result.barrierAbsorbed,
      kind: 'hit',
      timeMs: scheduled,
      school: result.school,
    })
  }
  if (hpAfter > 0) return
  queueDeath(deaths, target, actor.id, actor.name, scheduled)
}

function resolveBasicAttack(state: CombatState, actor: CombatActor): void {
  const scheduled = actor.nextReadyMs
  const recoveryMs = slowedActionMs(actor.actionTimeMs, chillSlowFraction(actor, scheduled))
  actor.nextReadyMs = scheduled + recoveryMs
  const target = livingTarget(state, actor)
  if (actor.side === 'hero' && target.side === 'enemy') state.hero.currentTargetId = target.id
  const deaths: PendingDeath[] = []
  state.log.push({
    type: 'action',
    timeMs: scheduled,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    action: 'basicAttack',
    skillId: null,
    skillName: null,
    scheduledMs: scheduled,
    nextReadyMs: actor.nextReadyMs,
    cooldownReadyMs: null,
  })

  const evasion = effectiveEvasion(target)
  const hitRoll = nextFloat(state.rng)
  const hitChance = basicHitChance(actor.accuracy, evasion)
  let consistencyRoll = 0
  let critRoll = 0
  if (hitRoll < hitChance) {
    const bounds = consistencyBounds(actor.consistency)
    consistencyRoll = centeredRoll(state.rng, bounds.floor, bounds.ceiling)
    critRoll = nextFloat(state.rng)
  }

  const result = resolveDamage({
    accuracy: actor.accuracy,
    evasion,
    power: actor.power,
    coefficient: BASIC_ATTACK_COEFFICIENT,
    outgoingModifier: actor.side === 'hero' ? heroOutgoing(state, actor.school, null) : 1,
    consistency: actor.consistency,
    critChance: actor.critChance,
    critDamage: actor.critDamage,
    barrier: activeBarrier(target, scheduled),
    penetration: actor.penetration,
    defense: defenseOf(target, actor.school, scheduled),
    attackerLevel: actor.level,
    incomingModifier: incomingDamageFactor(target),
    school: actor.school,
    rolls: { hitRoll, consistencyRoll, critRoll },
  })

  state.log.push({
    type: 'hitRoll',
    timeMs: scheduled,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    roll: hitRoll,
    hitChance: result.hitChance,
    accuracy: actor.accuracy,
    evasion,
    hit: result.hit,
  })
  const hpBeforeHit = target.hp
  if (result.hit) applyHit(state, actor, target, scheduled, result, deaths)
  else if (target.id === state.hero.id) {
    notifyDamageTaken(state, {
      hpLost: 0,
      hpBefore: target.hp,
      barrierAbsorbed: 0,
      kind: 'miss',
      timeMs: scheduled,
      school: result.school,
    })
  }
  if (actor.side === 'hero') {
    classModule(state.hero.classId)?.actionResolved?.(
      state,
      {
        kind: 'basicAttack',
        hit: result.hit,
        crit: result.crit,
        targetId: target.id,
        hpLost: hpBeforeHit - target.hp,
      },
      scheduled,
    )
  }
  commitDeaths(state, deaths)
}

function dueActors(state: CombatState, stepStart: number, stepEnd: number): CombatActor[] {
  const due: CombatActor[] = []
  const actors = [state.hero, ...state.enemies]
  for (const actor of actors) {
    if (!actor.alive) continue
    if (actor.side === 'hero' && state.hero.waiting) continue
    if (actor.nextReadyMs > stepStart && actor.nextReadyMs <= stepEnd) due.push(actor)
  }
  return due
}

function expireField(state: CombatState, stepStart: number, stepEnd: number): void {
  const field = state.hero.field
  if (field === null) return
  if (field.expiresMs <= stepStart || field.expiresMs > stepEnd) return
  const event: FieldExpiredEvent = {
    type: 'fieldExpired',
    timeMs: field.expiresMs,
    actorId: state.hero.id,
    actorName: state.hero.name,
    skillId: field.skillId,
  }
  state.hero.field = null
  state.log.push(event)
}

function healField(state: CombatState, field: ActiveField, timeMs: number): void {
  const hero = state.hero
  if (!hero.alive) return
  const raw = field.healingPower * field.healCoefficient
  const afterReceived = raw * hero.healingReceived
  let amount = Math.round(afterReceived)
  if (amount < 0) amount = 0
  const targetHpBefore = hero.hp
  let targetHpAfter = targetHpBefore + amount
  if (targetHpAfter > hero.maxHp) targetHpAfter = hero.maxHp
  hero.hp = targetHpAfter
  const event: FieldHealEvent = {
    type: 'fieldHeal',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    healingPower: field.healingPower,
    coefficient: field.healCoefficient,
    raw,
    healingReceived: hero.healingReceived,
    afterReceived,
    amount,
    targetHpBefore,
    targetHpAfter,
  }
  state.log.push(event)
}

/** Field ticks bypass barriers, skip variance and crit, and are not hero actions. */
function applyFieldTick(state: CombatState, field: ActiveField, timeMs: number): void {
  const living = state.enemies.filter((enemy) => enemy.alive)
  const deaths: PendingDeath[] = []
  for (const enemy of living) {
    if (state.outcome !== 'ongoing') return
    const defense = exposedDefense(enemy, field.damageSchool, timeMs)
    const raw = field.power * field.damageCoefficient
    const dealt = mitigateStatusDamage(raw, field.penetration, defense, field.attackerLevel)
    const hpBefore = enemy.hp
    let hpAfter = hpBefore - dealt.hpDamage
    if (hpAfter < 0) hpAfter = 0
    enemy.hp = hpAfter
    const event: FieldTickEvent = {
      type: 'fieldTick',
      timeMs,
      actorId: field.sourceId,
      actorName: field.sourceName,
      targetId: enemy.id,
      targetName: enemy.name,
      school: field.damageSchool,
      power: field.power,
      coefficient: field.damageCoefficient,
      raw,
      penetration: field.penetration,
      defense,
      attackerLevel: field.attackerLevel,
      reduction: dealt.reduction,
      afterDefense: dealt.afterDefense,
      hpDamage: dealt.hpDamage,
      targetHpBefore: hpBefore,
      targetHpAfter: hpAfter,
      barrierBypassed: true,
      crit: false,
      varianceRoll: false,
    }
    state.log.push(event)
    if (hpAfter <= 0) queueDeath(deaths, enemy, field.sourceId, field.sourceName, timeMs)
  }
  if (state.outcome === 'ongoing') healField(state, field, timeMs)
  commitDeaths(state, deaths)
}

function resolveFieldTicks(state: CombatState, stepStart: number, stepEnd: number): void {
  const field = state.hero.field
  if (field === null) return
  while (field.nextTickMs > stepStart && field.nextTickMs <= stepEnd && field.nextTickMs < field.expiresMs) {
    if (state.outcome !== 'ongoing' || state.hero.field !== field) return
    const timeMs = field.nextTickMs
    field.nextTickMs = timeMs + field.tickMs
    applyFieldTick(state, field, timeMs)
  }
}

/** Clock category 1. Barriers and statuses whose expiry falls inside this step end before ticks. */
function resolveExpiries(state: CombatState, stepStart: number, stepEnd: number): void {
  expireField(state, stepStart, stepEnd)
  const actors: CombatActor[] = [state.hero, ...state.enemies]
  for (const actor of actors) {
    if (actor.barrier <= 0) continue
    if (actor.barrierExpiresMs <= stepStart || actor.barrierExpiresMs > stepEnd) continue
    const amount = actor.barrier
    const expiredAt = actor.barrierExpiresMs
    actor.barrier = 0
    actor.barrierExpiresMs = 0
    state.log.push({
      type: 'barrierExpired',
      timeMs: expiredAt,
      actorId: actor.id,
      actorName: actor.name,
      amount,
    })
  }
  expireStatuses(state, stepStart, stepEnd)
}

/** Clock category 2. Poison and Burn ticks. They bypass barriers and use current Defense. */
function resolvePeriodicTicks(state: CombatState, stepStart: number, stepEnd: number): void {
  const ticks = collectStatusTicks(state, stepStart, stepEnd)
  for (const tick of ticks) {
    if (state.outcome !== 'ongoing') return
    applyStatusDamage(state, tick)
  }
  resolveFieldTicks(state, stepStart, stepEnd)
}

/** Clock category 3. No telegraph resolutions in this step. */
function resolveTelegraphs(): void {
  return
}

function readSkillIdList(value: unknown, label: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`${label} must be a list`)
  const ids: string[] = []
  const seen: { [id: string]: boolean } = {}
  for (let index = 0; index < value.length; index += 1) {
    const id = value[index]
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`${label} entry ${index + 1} is missing an id`)
    }
    if (seen[id] === true) throw new Error(`duplicate equipped skill '${id}'`)
    seen[id] = true
    ids.push(id)
  }
  return ids
}

function assertLoadout(equipped: readonly string[], rows: readonly PriorityRow[], defs: GameDefs): void {
  for (const id of equipped) {
    const skill = defs.skills[id]
    if (skill === undefined) throw new Error(`unknown skill '${id}'`)
    for (const effect of skill.effects) {
      if (effect.kind !== 'applyStatus') continue
      if (defs.statuses[effect.statusId] === undefined) {
        throw new Error(`skill '${id}' applies unknown status '${effect.statusId}'`)
      }
    }
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (row === undefined || defs.skills[row.skillId] === undefined) {
      throw new Error(`priority row ${index + 1} references unknown skill '${row?.skillId ?? ''}'`)
    }
  }
}

function actionTarget(skill: SkillDef, targets: readonly CombatActor[]): { id: string; name: string } {
  const first = targets[0]
  if (first === undefined) throw new Error(`${skill.name} resolved without a target`)
  if (targets.length === 1) return { id: first.id, name: first.name }
  return { id: first.id, name: joinNames(targets.map((target) => target.name)) }
}

function scheduleSkill(
  hero: CombatHero,
  skill: SkillDef,
  scheduled: number,
): { nextReadyMs: number; cooldownReadyMs: number | null } {
  const actionSeconds = actionTime(hero.baseActionSeconds, hero.agility, skill.actionTimeCoefficient)
  const actionMs = roundDurationMs(actionSeconds, `${skill.id} action time`)
  const slowedMs = slowedActionMs(actionMs, chillSlowFraction(hero, scheduled))
  const nextReadyMs = scheduled + slowedMs
  let cooldownReadyMs: number | null = null
  if (skill.cooldownSeconds > 0) {
    const cooldownSeconds = finalCooldownSeconds(skill.cooldownSeconds, hero.cooldownReduction)
    const cooldownMs = roundDurationMs(cooldownSeconds, `${skill.id} cooldown`)
    cooldownReadyMs = scheduled + cooldownMs
    hero.cooldowns[skill.id] = cooldownReadyMs
  }
  hero.nextReadyMs = nextReadyMs
  return { nextReadyMs, cooldownReadyMs }
}

function paySkillCosts(state: CombatState, skill: SkillDef, timeMs: number): { ammoSpent: number; ammoRemaining: number } {
  const hero = state.hero
  const ammoCost = skill.ammoCost ?? 0
  if (!Number.isInteger(ammoCost) || ammoCost < 0) {
    throw new Error(`${skill.name} ammo cost must be a whole number of at least 0, received ${describeValue(ammoCost)}`)
  }
  if (ammoCost > hero.specialAmmo || skill.cost > hero.classResource) {
    throw new Error(
      `${hero.name} cannot pay ${skill.name}: readiness ${hero.classResource}, special arrows ${hero.specialAmmo}, costs ${skill.cost} and ${ammoCost}`,
    )
  }
  payClassResource(state, timeMs, skill.cost, 'payment')
  if (ammoCost > 0) hero.specialAmmo -= ammoCost
  return { ammoSpent: ammoCost, ammoRemaining: hero.specialAmmo }
}

function resolveSkill(
  state: CombatState,
  defs: GameDefs,
  skill: SkillDef,
  targets: readonly CombatActor[],
  scheduled: number,
): void {
  const hero = state.hero
  const targetId = targets[0]?.id
  classModule(hero.classId)?.actionChosen?.(state, { kind: 'skill', skill, targetId }, scheduled)
  const payment = paySkillCosts(state, skill, scheduled)
  const timing = scheduleSkill(hero, skill, scheduled)
  const target = actionTarget(skill, targets)
  state.log.push({
    type: 'action',
    timeMs: scheduled,
    actorId: hero.id,
    actorName: hero.name,
    targetId: target.id,
    targetName: target.name,
    action: 'skill',
    skillId: skill.id,
    skillName: skill.name,
    scheduledMs: scheduled,
    nextReadyMs: timing.nextReadyMs,
    cooldownReadyMs: timing.cooldownReadyMs,
    ...(payment.ammoSpent > 0 ? { ammoSpent: payment.ammoSpent, ammoRemaining: payment.ammoRemaining } : {}),
  })
  const deaths: PendingDeath[] = []
  const strikes: ClassStrike[] = []
  applySkillEffects(state, defs, hero, skill, targets, scheduled, (school) => heroOutgoing(state, school, skill), (
    actor,
    result,
  ) => {
    const hpBefore = actor.hp
    applyHit(state, hero, actor, scheduled, result, deaths)
    strikes.push({ targetId: actor.id, hit: result.hit, crit: result.crit, hpLost: hpBefore - actor.hp })
  })
  const crit = strikes.some((strike) => strike.hit && strike.crit)
  classModule(hero.classId)?.actionResolved?.(state, { kind: 'skill', skill, targetId, crit, strikes }, scheduled)
  commitDeaths(state, deaths)
}

function decideFallback(state: CombatState, defs: GameDefs, timeMs: number): FallbackDecision {
  const hook = classModule(state.hero.classId)?.fallbackAction
  if (hook === undefined) return { kind: 'basicAttack' }
  return hook(state, defs, timeMs)
}

function logWait(state: CombatState, timeMs: number, reason: string): void {
  const hero = state.hero
  if (hero.waiting) return
  hero.waiting = true
  state.log.push({
    type: 'wait',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    reason,
  })
}

function resolveHeroAction(state: CombatState, defs: GameDefs): void {
  const hero = state.hero
  hero.overhealed = false
  const scheduled = hero.nextReadyMs
  const choice = chooseHeroAction(state, defs, hero, scheduled)
  for (const event of choice.events) state.log.push(event)
  if (choice.kind === 'basicAttack') {
    const decision = decideFallback(state, defs, scheduled)
    if (decision.kind === 'wait') {
      logWait(state, scheduled, decision.reason)
      return
    }
    if (decision.kind === 'skill') {
      const skill = defs.skills[decision.skillId]
      if (skill === undefined) throw new Error(`fallback skill '${decision.skillId}' is not defined`)
      const aimed = skillActionTargets(state, hero, skill)
      if (aimed.targets.length === 0) {
        logWait(state, scheduled, 'no target')
        return
      }
      hero.waiting = false
      endUntilNextAction(state, hero, scheduled)
      if (aimed.focus !== null && aimed.focus.side === 'enemy') hero.currentTargetId = aimed.focus.id
      resolveSkill(state, defs, skill, aimed.targets, scheduled)
      return
    }
    hero.waiting = false
    endUntilNextAction(state, hero, scheduled)
    resolveBasicAttack(state, hero)
    return
  }
  hero.waiting = false
  endUntilNextAction(state, hero, scheduled)
  if (choice.focus !== null && choice.focus.side === 'enemy') hero.currentTargetId = choice.focus.id
  resolveSkill(state, defs, choice.skill, choice.targets, scheduled)
}

/**
 * An armed trap resolves when its target is ready, before that action.
 * Success pushes the action. Failure leaves the ready time alone so the action happens now.
 * Returns true when the action was postponed.
 */
function triggerArmedTrap(state: CombatState, defs: GameDefs, actor: CombatActor, scheduled: number): boolean {
  const trap = actor.armedTrap
  if (trap === null) return false
  actor.armedTrap = null
  const skill = defs.skills[trap.skillId]
  if (skill === undefined) throw new Error(`armed trap skill '${trap.skillId}' is not defined`)
  const readyBefore = actor.nextReadyMs
  tryApplyStatus({
    state,
    defs,
    source: state.hero,
    target: actor,
    skill,
    effect: { kind: 'applyStatus', statusId: 'stun', baseChance: trap.baseChance },
    timeMs: scheduled,
    applyingHit: false,
    hpDamageDealt: 0,
  })
  return actor.nextReadyMs !== readyBefore
}

/** Bleed ticks when the actor becomes ready, before that action. Chill was already baked into the previous recovery. */
function resolveActor(state: CombatState, defs: GameDefs, actor: CombatActor): void {
  const scheduled = actor.nextReadyMs
  if (triggerArmedTrap(state, defs, actor, scheduled)) return
  const bleed = takeBleedTicks(actor, scheduled)
  for (const tick of bleed.ticks) {
    if (!actor.alive) break
    applyStatusDamage(state, tick)
  }
  if (bleed.expired !== null) {
    state.log.push({
      type: 'statusExpired',
      timeMs: scheduled,
      actorId: actor.id,
      actorName: actor.name,
      statusId: 'bleed',
      statusName: bleed.expired.name,
      stacks: bleed.expired.stacks,
    })
  }
  if (!actor.alive || state.outcome !== 'ongoing') return
  if (actor.side === 'hero') resolveHeroAction(state, defs)
  else resolveBasicAttack(state, actor)
}

function waitingCanAct(state: CombatState, defs: GameDefs, timeMs: number): boolean {
  const saved = { a: state.rng.a, b: state.rng.b, c: state.rng.c, d: state.rng.d }
  try {
    const hero = state.hero
    const choice = chooseHeroAction(state, defs, hero, timeMs)
    if (choice.kind === 'skill') return true
    const decision = decideFallback(state, defs, timeMs)
    if (decision.kind === 'wait') return false
    if (decision.kind === 'basicAttack') return true
    const skill = defs.skills[decision.skillId]
    if (skill === undefined) throw new Error(`fallback skill '${decision.skillId}' is not defined`)
    return skillActionTargets(state, hero, skill).targets.length > 0
  } finally {
    state.rng = saved
  }
}

function resolveActions(state: CombatState, defs: GameDefs, stepStart: number, stepEnd: number): void {
  while (state.outcome === 'ongoing') {
    const due = dueActors(state, stepStart, stepEnd)
    if (due.length === 0) break
    due.sort(compareReady)
    const actor = due[0]
    if (actor === undefined) return
    resolveActor(state, defs, actor)
  }
  if (state.outcome !== 'ongoing') return
  const hero = state.hero
  if (!hero.waiting || !hero.alive) return
  if (!waitingCanAct(state, defs, stepEnd)) return
  hero.waiting = false
  hero.nextReadyMs = stepEnd
  resolveActor(state, defs, hero)
}

/** One regen event per whole second. The 10 ms steps between those seconds are not logged. */
function applyResourceRegen(state: CombatState, stepStart: number, stepEnd: number): void {
  const hero = state.hero
  if (!hero.alive || state.outcome !== 'ongoing') return
  if (hero.resourceRegenPerSecond <= 0 || hero.classResourceId === '') return
  const firstSecond = Math.floor(stepStart / 1000) + 1
  const lastSecond = Math.floor(stepEnd / 1000)
  for (let second = firstSecond; second <= lastSecond; second += 1) {
    const timeMs = second * 1000
    if (timeMs <= stepStart || timeMs > stepEnd) continue
    grantClassResource(state, timeMs, hero.resourceRegenPerSecond, 'regen')
  }
}

function readEnemySetup(value: unknown, index: number): { defId: string; slot: number; revealed: boolean } {
  assertObject(value, `enemy setup ${index + 1}`)
  const defId = value.defId
  if (typeof defId !== 'string' || defId.length === 0) {
    throw new Error(`enemy setup ${index + 1} is missing a defId`)
  }
  const slot = value.slot
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0) {
    throw new Error(
      `enemy slot must be an integer of at least 0, received ${describeValue(slot)}`,
    )
  }
  let revealed = true
  if (value.revealed !== undefined) {
    if (typeof value.revealed !== 'boolean') {
      throw new Error(
        `enemy setup ${index + 1} revealed must be a boolean, received ${describeValue(value.revealed)}`,
      )
    }
    revealed = value.revealed
  }
  return { defId, slot, revealed }
}

function actorFromEnemy(def: EnemyDef, slot: number, revealed: boolean): CombatActor {
  if (def.id.length === 0) throw new Error('enemy definition is missing an id')
  if (def.name.length === 0) throw new Error(`enemy ${def.id} is missing a name`)
  assertSchool(def.school, `enemy ${def.id} school`)
  if (def.boss !== undefined && typeof def.boss !== 'boolean') {
    throw new Error(`enemy ${def.id} boss must be a boolean, received ${describeValue(def.boss)}`)
  }
  const stats = deriveEnemyStats({
    level: def.level,
    archetype: def.archetype,
    elite: def.elite,
    overrides: def.overrides,
  })
  const actionTimeMs = roundDurationMs(stats.actionTime, `${def.id} action time`)
  return {
    id: `${def.id}#${slot}`,
    name: def.name,
    side: 'enemy',
    slot,
    level: def.level,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    alive: true,
    school: def.school,
    power: stats.power,
    accuracy: stats.accuracy,
    evasion: stats.evasion,
    armor: stats.armor,
    resistance: stats.resistance,
    penetration: 0,
    // Ordinary enemies cannot critically hit.
    critChance: 0,
    critDamage: CRIT_DAMAGE_BASE,
    consistency: stats.consistency,
    actionTimeMs,
    nextReadyMs: actionTimeMs,
    ...guardDefaults(),
    intellect: 0,
    vitality: 0,
    spirit: 0,
    statusPotency: 0,
    physicalStatusResistance: 0,
    magicalStatusResistance: 0,
    boss: def.boss === true,
    revealed,
    archetype: def.archetype,
    rank: 0,
    bossPhase: 0,
    telegraph: null,
    armedTrap: null,
    statuses: emptyStatuses(),
  }
}

function applySuppliedResources(hero: CombatHero, setup: CombatHeroSetup): void {
  if (setup.startingResource !== undefined) {
    if (
      typeof setup.startingResource !== 'number' ||
      !Number.isFinite(setup.startingResource) ||
      setup.startingResource < 0
    ) {
      throw new Error(
        `starting resource must be at least 0, received ${describeValue(setup.startingResource)}`,
      )
    }
    hero.suppliedResource = setup.startingResource
  }
  if (setup.specialAmmo !== undefined) {
    if (typeof setup.specialAmmo !== 'number' || !Number.isInteger(setup.specialAmmo) || setup.specialAmmo < 0) {
      throw new Error(
        `starting special ammo must be a whole number of at least 0, received ${describeValue(setup.specialAmmo)}`,
      )
    }
    hero.suppliedAmmo = setup.specialAmmo
    hero.specialAmmo = setup.specialAmmo
  }
  if (setup.vow !== undefined) {
    if (typeof setup.vow !== 'string') {
      throw new Error(`vow must be a string, received ${describeValue(setup.vow)}`)
    }
    hero.suppliedVow = setup.vow
  }
}

function actorFromHero(setup: CombatSetup, defs: GameDefs): CombatHero {
  const hero = setup.hero
  if (typeof hero.id !== 'string' || hero.id.length === 0) {
    throw new Error('combat hero is missing an id')
  }
  if (typeof hero.name !== 'string' || hero.name.length === 0) {
    throw new Error('combat hero is missing a name')
  }
  const derived = deriveHeroStats({
    level: hero.level,
    classId: hero.classId,
    attributes: hero.attributes,
    gear: hero.gear,
  })
  const school = heroSchool(hero.gear.mainHand.kind)
  const actionTimeMs = roundDurationMs(derived.actionTime, `${hero.id} action time`)
  const actionRatio = WEAPON_ACTION_TIME[hero.gear.mainHand.kind]
  const equippedSkillIds = readSkillIdList(hero.equippedSkillIds, 'equipped skills')
  const parsedRules = parsePriorityRules(
    { rows: hero.priorityRows ?? [], targetPriority: hero.targetPriority },
    defs,
  )
  if (!parsedRules.ok) throw new Error(parsedRules.reason)
  return {
    id: hero.id,
    name: hero.name,
    side: 'hero',
    slot: 0,
    level: hero.level,
    hp: derived.maxHp,
    maxHp: derived.maxHp,
    alive: true,
    school,
    power: school === 'physical' ? derived.physicalPower : derived.magicalPower,
    accuracy: derived.accuracy,
    evasion: derived.evasion,
    armor: derived.armor,
    resistance: derived.resistance,
    penetration: school === 'physical' ? derived.armorPenetration : derived.magicalPenetration,
    critChance: derived.critChance,
    critDamage: derived.critDamage,
    // A new hero has Consistency 0: damage rolls from 60% through 100%.
    consistency: 0,
    actionTimeMs,
    nextReadyMs: actionTimeMs,
    ...guardDefaults(),
    intellect: hero.attributes.intellect,
    vitality: hero.attributes.vitality,
    spirit: hero.attributes.spirit,
    statusPotency: 0,
    physicalStatusResistance: 0,
    magicalStatusResistance: 0,
    boss: false,
    revealed: true,
    archetype: 'standard',
    rank: 0,
    bossPhase: 0,
    telegraph: null,
    armedTrap: null,
    statuses: emptyStatuses(),
    physicalPower: derived.physicalPower,
    magicalPower: derived.magicalPower,
    healingPower: derived.healingPower,
    healingReceived: 1 + derived.healingReceivedBonus,
    cooldownReduction: derived.cooldownReduction,
    agility: hero.attributes.agility,
    baseActionSeconds: actionRatio.numerator / actionRatio.denominator,
    armorPenetration: derived.armorPenetration,
    magicalPenetration: derived.magicalPenetration,
    mainHandKind: hero.gear.mainHand.kind,
    offHandKind: hero.gear.offHand === null ? null : hero.gear.offHand.kind,
    equippedSkillIds,
    priorityRows: parsedRules.rows,
    cooldowns: {},
    classId: hero.classId,
    classResource: 0,
    classResourceId: '',
    classResourceMax: 0,
    classResourceScope: 'encounter',
    resourceRegenPerSecond: 0,
    classState: {},
    waiting: false,
    specialAmmo: 0,
    resourceFraction: 0,
    suppliedResource: null,
    suppliedAmmo: null,
    suppliedVow: null,
    field: null,
    overhealed: false,
    pendingCoefficient: null,
    targetPriority: parsedRules.targetPriority,
    currentTargetId: null,
  }
}

export function createCombat(setup: CombatSetup, defs: GameDefs, seed: number): CombatState {
  assertObject(setup, 'combat setup')
  if (typeof setup.hero !== 'object' || setup.hero === null) {
    throw new Error('combat setup is missing a hero')
  }
  if (!Array.isArray(setup.enemies) || setup.enemies.length === 0) {
    throw new Error('combat setup has no enemies')
  }
  const rng = createRng(seed)
  assertDefs(defs)

  const seenSlots: { [slot: number]: boolean } = {}
  const enemies: CombatActor[] = []
  for (let index = 0; index < setup.enemies.length; index += 1) {
    const entry = readEnemySetup(setup.enemies[index], index)
    if (seenSlots[entry.slot] === true) throw new Error(`duplicate enemy slot ${entry.slot}`)
    seenSlots[entry.slot] = true
    const def = defs.enemies[entry.defId]
    if (def === undefined) throw new Error(`unknown enemy '${entry.defId}'`)
    enemies.push(actorFromEnemy(def, entry.slot, entry.revealed))
  }
  enemies.sort((a, b) => a.slot - b.slot)

  const hero = actorFromHero(setup, defs)
  applySuppliedResources(hero, setup.hero)
  assertLoadout(hero.equippedSkillIds, hero.priorityRows, defs)
  const state: CombatState = {
    timeMs: 0,
    rng,
    hero,
    enemies,
    log: [],
    outcome: 'ongoing',
    seed,
  }
  state.log.push({
    type: 'encounterStart',
    timeMs: 0,
    seed,
    heroId: hero.id,
    heroName: hero.name,
    enemies: enemies.map((enemy) => ({ id: enemy.id, name: enemy.name, slot: enemy.slot })),
  })
  classModule(hero.classId)?.encounterStart?.(state, 0)
  return state
}

/**
 * Advance exactly one 10 ms step.
 * Inside the step: expiries, periodic ticks, telegraph resolutions, then actions.
 * Actions due in (timeMs, timeMs + 10] resolve at their scheduled ready time.
 */
export function stepCombat(state: CombatState, defs: GameDefs): CombatState {
  assertDefs(defs)
  assertObject(state, 'combat state')
  if (
    state.outcome !== 'ongoing' &&
    state.outcome !== 'victory' &&
    state.outcome !== 'defeat' &&
    state.outcome !== 'timeout'
  ) {
    throw new Error(`combat outcome is unknown, received ${describeValue(state.outcome)}`)
  }
  if (state.outcome !== 'ongoing') return state
  if (typeof state.timeMs !== 'number' || !Number.isInteger(state.timeMs) || state.timeMs < 0) {
    throw new Error(`combat time must be an integer of at least 0, received ${describeValue(state.timeMs)}`)
  }

  const stepStart = state.timeMs
  const stepEnd = stepStart + STEP_MS
  resolveExpiries(state, stepStart, stepEnd)
  resolvePeriodicTicks(state, stepStart, stepEnd)
  applyResourceRegen(state, stepStart, stepEnd)
  resolveTelegraphs()
  resolveActions(state, defs, stepStart, stepEnd)
  state.timeMs = stepEnd
  return state
}

/** Run until victory, defeat, or the clock reaches `maxMs` (timeout). */
export function runCombat(state: CombatState, defs: GameDefs, maxMs: number): CombatState {
  assertMaxMs(maxMs)
  assertDefs(defs)
  assertObject(state, 'combat state')
  if (state.outcome !== 'ongoing') return state
  if (state.timeMs >= maxMs) {
    endEncounter(state, 'timeout', state.timeMs)
    return state
  }
  while (state.outcome === 'ongoing' && state.timeMs < maxMs) {
    stepCombat(state, defs)
    if (state.outcome === 'ongoing' && state.timeMs >= maxMs) {
      endEncounter(state, 'timeout', state.timeMs)
    }
  }
  return state
}
