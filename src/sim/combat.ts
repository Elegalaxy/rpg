import { BASIC_ATTACK_COEFFICIENT, CRIT_DAMAGE_BASE, STEP_MS } from './constants.ts'
import { basicHitChance, consistencyBounds, resolveDamage } from './damage.ts'
import { centeredRoll, createRng, nextFloat } from './rng.ts'
import { deriveEnemyStats, deriveHeroStats } from './stats.ts'
import type {
  CombatActor,
  CombatSetup,
  CombatState,
  DamageResult,
  DamageSchool,
  EnemyDef,
  GameDefs,
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

function defenseOf(target: CombatActor, school: DamageSchool): number {
  return school === 'physical' ? target.armor : target.resistance
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
  target.alive = false
  target.hp = 0
  state.log.push({
    type: 'death',
    timeMs: scheduled,
    actorId: target.id,
    actorName: target.name,
    killerId: actor.id,
    killerName: actor.name,
  })
  if (target.side === 'hero') {
    endEncounter(state, 'defeat', scheduled)
    return
  }
  let enemiesAlive = false
  for (const enemy of state.enemies) {
    if (enemy.alive) enemiesAlive = true
  }
  if (!enemiesAlive) endEncounter(state, 'victory', scheduled)
}

function resolveBasicAttack(state: CombatState, actor: CombatActor): void {
  const scheduled = actor.nextReadyMs
  actor.nextReadyMs = scheduled + actor.actionTimeMs
  const target = livingTarget(state, actor)
  state.log.push({
    type: 'action',
    timeMs: scheduled,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    action: 'basicAttack',
    scheduledMs: scheduled,
    nextReadyMs: actor.nextReadyMs,
  })

  const hitRoll = nextFloat(state.rng)
  const hitChance = basicHitChance(actor.accuracy, target.evasion)
  let consistencyRoll = 0
  let critRoll = 0
  if (hitRoll < hitChance) {
    const bounds = consistencyBounds(actor.consistency)
    consistencyRoll = centeredRoll(state.rng, bounds.floor, bounds.ceiling)
    critRoll = nextFloat(state.rng)
  }

  const result = resolveDamage({
    accuracy: actor.accuracy,
    evasion: target.evasion,
    power: actor.power,
    coefficient: BASIC_ATTACK_COEFFICIENT,
    outgoingModifier: 1,
    consistency: actor.consistency,
    critChance: actor.critChance,
    critDamage: actor.critDamage,
    barrier: 0,
    penetration: actor.penetration,
    defense: defenseOf(target, actor.school),
    attackerLevel: actor.level,
    incomingModifier: 1,
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
    evasion: target.evasion,
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

/** Clock category 1. No expiries in this step. */
function resolveExpiries(): void {
  return
}

/** Clock category 2. No periodic ticks in this step. */
function resolvePeriodicTicks(): void {
  return
}

/** Clock category 3. No telegraph resolutions in this step. */
function resolveTelegraphs(): void {
  return
}

function resolveActions(state: CombatState, stepStart: number, stepEnd: number): void {
  while (state.outcome === 'ongoing') {
    const due = dueActors(state, stepStart, stepEnd)
    if (due.length === 0) return
    due.sort(compareReady)
    const actor = due[0]
    if (actor === undefined) return
    resolveBasicAttack(state, actor)
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
  }
}

function actorFromHero(setup: CombatSetup): CombatActor {
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
  resolveExpiries()
  resolvePeriodicTicks()
  resolveTelegraphs()
  resolveActions(state, stepStart, stepEnd)
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
