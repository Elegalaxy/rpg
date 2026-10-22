import { chooseHeroAction } from './automation.ts'
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
  slowedActionMs,
  statusTickEvent,
  takeBleedTicks,
} from './statuses.ts'
import type { StatusTickDraft } from './statuses.ts'
import { actionTime, deriveEnemyStats, deriveHeroStats } from './stats.ts'
import type {
  CombatActor,
  CombatHero,
  CombatSetup,
  CombatState,
  DamageResult,
  DamageSchool,
  EnemyDef,
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

function applyStatusDamage(state: CombatState, tick: StatusTickDraft): void {
  const target = tick.target
  if (!target.alive) return
  const hpBefore = target.hp
  let hpAfter = hpBefore - tick.hpDamage
  if (hpAfter < 0) hpAfter = 0
  target.hp = hpAfter
  state.log.push(statusTickEvent(tick, hpBefore, hpAfter))
  if (hpAfter > 0) return
  noteDeath(state, target, tick.sourceId, tick.sourceName, tick.timeMs)
}

function applyHit(
  state: CombatState,
  actor: CombatActor,
  target: CombatActor,
  scheduled: number,
  result: DamageResult,
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
  if (hpAfter > 0) return
  noteDeath(state, target, actor.id, actor.name, scheduled)
}

function resolveBasicAttack(state: CombatState, actor: CombatActor): void {
  const scheduled = actor.nextReadyMs
  const recoveryMs = slowedActionMs(actor.actionTimeMs, chillSlowFraction(actor, scheduled))
  actor.nextReadyMs = scheduled + recoveryMs
  const target = livingTarget(state, actor)
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
    outgoingModifier: 1,
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
  if (!result.hit) return
  applyHit(state, actor, target, scheduled, result)
}

function dueActors(state: CombatState, stepStart: number, stepEnd: number): CombatActor[] {
  const due: CombatActor[] = []
  const actors = [state.hero, ...state.enemies]
  for (const actor of actors) {
    if (!actor.alive) continue
    if (actor.nextReadyMs > stepStart && actor.nextReadyMs <= stepEnd) due.push(actor)
  }
  return due
}

/** Clock category 1. Barriers and statuses whose expiry falls inside this step end before ticks. */
function resolveExpiries(state: CombatState, stepStart: number, stepEnd: number): void {
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

function readPriorityRows(value: unknown): PriorityRow[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('priority rows must be a list')
  const rows: PriorityRow[] = []
  for (let index = 0; index < value.length; index += 1) {
    const row: unknown = value[index]
    assertObject(row, `priority row ${index + 1}`)
    const keys = Object.keys(row)
    if (keys.length !== 1 || keys[0] !== 'skillId') {
      throw new Error(`priority row ${index + 1} must be { skillId } with no conditions`)
    }
    const skillId = row.skillId
    if (typeof skillId !== 'string' || skillId.length === 0) {
      throw new Error(`priority row ${index + 1} is missing a skill id`)
    }
    rows.push({ skillId })
  }
  return rows
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

function resolveHeroAction(state: CombatState, defs: GameDefs): void {
  const hero = state.hero
  const scheduled = hero.nextReadyMs
  endUntilNextAction(state, hero, scheduled)
  const choice = chooseHeroAction(state, defs, hero, scheduled)
  for (const event of choice.events) state.log.push(event)
  if (choice.kind === 'basicAttack') {
    resolveBasicAttack(state, hero)
    return
  }
  const timing = scheduleSkill(hero, choice.skill, scheduled)
  const target = actionTarget(choice.skill, choice.targets)
  state.log.push({
    type: 'action',
    timeMs: scheduled,
    actorId: hero.id,
    actorName: hero.name,
    targetId: target.id,
    targetName: target.name,
    action: 'skill',
    skillId: choice.skill.id,
    skillName: choice.skill.name,
    scheduledMs: scheduled,
    nextReadyMs: timing.nextReadyMs,
    cooldownReadyMs: timing.cooldownReadyMs,
  })
  applySkillEffects(state, defs, hero, choice.skill, choice.targets, scheduled, (actor, result) => {
    applyHit(state, hero, actor, scheduled, result)
  })
}

/** Bleed ticks when the actor becomes ready, before that action. Chill was already baked into the previous recovery. */
function resolveActor(state: CombatState, defs: GameDefs, actor: CombatActor): void {
  const scheduled = actor.nextReadyMs
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

function resolveActions(state: CombatState, defs: GameDefs, stepStart: number, stepEnd: number): void {
  while (state.outcome === 'ongoing') {
    const due = dueActors(state, stepStart, stepEnd)
    if (due.length === 0) return
    due.sort(compareReady)
    const actor = due[0]
    if (actor === undefined) return
    resolveActor(state, defs, actor)
  }
}

function readEnemySetup(value: unknown, index: number): { defId: string; slot: number } {
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
  return { defId, slot }
}

function actorFromEnemy(def: EnemyDef, slot: number): CombatActor {
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
    statuses: emptyStatuses(),
  }
}

function actorFromHero(setup: CombatSetup): CombatHero {
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
  const priorityRows = readPriorityRows(hero.priorityRows)
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
    priorityRows,
    cooldowns: {},
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
    enemies.push(actorFromEnemy(def, entry.slot))
  }
  enemies.sort((a, b) => a.slot - b.slot)

  const hero = actorFromHero(setup)
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
