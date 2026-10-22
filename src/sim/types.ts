import type { RngState } from './rng.ts'
import type {
  Attributes,
  EnemyArchetype,
  EnemyStatOverrides,
  HeroClass,
  HeroGear,
  OffHandKind,
  WeaponKind,
} from './stats.ts'

export type DamageSchool = 'physical' | 'magical'

export type CombatOutcome = 'ongoing' | 'victory' | 'defeat' | 'timeout'

export type StatusKind = 'bleed' | 'poison' | 'burn' | 'chill' | 'stun' | 'mark' | 'expose'

/** Source values frozen when a damage-over-time stack is applied. */
export type StatusSnapshot = {
  power: number
  penetration: number
  coefficient: number
  attackerLevel: number
  sourceId: string
  sourceName: string
}

export type BleedStack = StatusSnapshot & {
  actionsRemaining: number
}

export type BleedStatus = {
  name: string
  stacks: BleedStack[]
}

export type PoisonStatus = {
  name: string
  stacks: StatusSnapshot[]
  expiresMs: number
  /** Interval frozen at application. Boss duration does not change this. */
  tickMs: number
  nextTickMs: number
}

export type BurnStatus = StatusSnapshot & {
  name: string
  intensity: number
  expiresMs: number
  tickMs: number
  nextTickMs: number
}

export type ChillStatus = {
  name: string
  stacks: number
  expiresMs: number
  /** Additional slow at each stack, copied from the definition at the first application. */
  slowByStack: number[]
}

export type MarkStatus = {
  name: string
  expiresMs: number | null
  sourceId: string
  sourceName: string
}

export type ExposeStatus = {
  name: string
  expiresMs: number
  /** Strongest Armor reduction. 0.2 removes 20% of current Armor. */
  armorMagnitude: number
  /** Strongest Resistance reduction. */
  resistanceMagnitude: number
}

export type ActorStatuses = {
  bleed: BleedStatus | null
  poison: PoisonStatus | null
  burn: BurnStatus | null
  chill: ChillStatus | null
  mark: MarkStatus | null
  expose: ExposeStatus | null
}

export type StatusDefBase = {
  id: string
  name: string
}

export type BleedStatusDef = StatusDefBase & {
  kind: 'bleed'
  maxStacks: number
  actionsPerStack: number
}

export type PoisonStatusDef = StatusDefBase & {
  kind: 'poison'
  maxStacks: number
  durationSeconds: number
  tickSeconds: number
}

export type BurnStatusDef = StatusDefBase & {
  kind: 'burn'
  maxIntensity: number
  durationSeconds: number
  tickSeconds: number
}

export type ChillStatusDef = StatusDefBase & {
  kind: 'chill'
  maxStacks: number
  durationSeconds: number
  /** Additional slow fraction at stack 1, then 2, then 3. */
  slowByStack: readonly number[]
}

export type StunStatusDef = StatusDefBase & {
  kind: 'stun'
  delaySeconds: number
}

export type MarkStatusDef = StatusDefBase & {
  kind: 'mark'
}

export type ExposeStatusDef = StatusDefBase & {
  kind: 'expose'
  durationSeconds: number
}

export type StatusDef =
  | BleedStatusDef
  | PoisonStatusDef
  | BurnStatusDef
  | ChillStatusDef
  | StunStatusDef
  | MarkStatusDef
  | ExposeStatusDef

export type CombatActor = {
  id: string
  name: string
  side: 'hero' | 'enemy'
  slot: number
  level: number
  hp: number
  maxHp: number
  alive: boolean
  school: DamageSchool
  power: number
  accuracy: number
  evasion: number
  armor: number
  resistance: number
  penetration: number
  critChance: number
  critDamage: number
  consistency: number
  actionTimeMs: number
  nextReadyMs: number
  barrier: number
  /** Barrier is active while `barrier > 0` and the hit time is strictly before this. */
  barrierExpiresMs: number
  /** Fraction removed from incoming damage. 0.30 means 30% reduction. */
  damageReduction: number
  evasionBonus: number
  incomingMultipliers: number[]
  /** Intellect. Status Potency is this plus equipment and skill potency. */
  intellect: number
  /** Vitality. Physical status resistance is this plus equipment and skill resistance. */
  vitality: number
  /** Spirit. Magical status resistance is this plus equipment and skill resistance. */
  spirit: number
  /** Equipment and skill potency. Added to Intellect. Affects application chance only. */
  statusPotency: number
  physicalStatusResistance: number
  magicalStatusResistance: number
  /** Boss status caps, durations, and Stun delay. Not immunity. */
  boss: boolean
  /**
   * Armor and Resistance priorities can use this actor only when revealed.
   * Encounter setup or a later Hunter's Mark sets it. Harness enemies start revealed.
   */
  revealed: boolean
  archetype: EnemyArchetype
  /** Rank a test or later encounter can set. Not a threat score. */
  rank: number
  /** Boss phase a test or later encounter can set. */
  bossPhase: number
  /** Telegraph a test can set. This step does not run a telegraph clock. */
  telegraph: ActorTelegraph | null
  statuses: ActorStatuses
}

export type ActorTelegraph = {
  tag: string
  resolvesAtMs: number
}

/** Inputs a caller can fix so damage tests do not draw from the RNG. */
export type DamageRolls = {
  hitRoll: number
  consistencyRoll: number
  critRoll: number
}

export type DamageInput = {
  accuracy: number
  evasion: number
  power: number
  coefficient: number
  outgoingModifier: number
  consistency: number
  critChance: number
  critDamage: number
  barrier: number
  penetration: number
  defense: number
  attackerLevel: number
  incomingModifier: number
  school: DamageSchool
  rolls: DamageRolls
  /** Active skills skip the hit roll. Basic attacks leave this unset. */
  guaranteedHit?: boolean
}

/** Full-precision pipeline. `hpDamage` is the rounded integer applied to HP. */
export type DamageResult = {
  hitChance: number
  hit: boolean
  crit: boolean
  school: DamageSchool
  power: number
  coefficient: number
  outgoingModifier: number
  consistency: number
  damageFloor: number
  damageCeiling: number
  consistencyRoll: number
  critChance: number
  critRoll: number
  critDamage: number
  barrier: number
  barrierAbsorbed: number
  overflow: number
  penetration: number
  defense: number
  attackerLevel: number
  reduction: number
  incomingModifier: number
  raw: number
  afterOutgoing: number
  afterConsistency: number
  afterCrit: number
  afterDefense: number
  afterIncoming: number
  hpDamage: number
}

export type EncounterStartEvent = {
  type: 'encounterStart'
  timeMs: number
  seed: number
  heroId: string
  heroName: string
  enemies: { id: string; name: string; slot: number }[]
}

export type ActionEvent = {
  type: 'action'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  action: 'basicAttack' | 'skill'
  skillId: string | null
  skillName: string | null
  scheduledMs: number
  nextReadyMs: number
  /** When the skill can be used again. Null for basic attacks and skills with no cooldown. */
  cooldownReadyMs: number | null
}

export type HitRollEvent = {
  type: 'hitRoll'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  roll: number
  hitChance: number
  accuracy: number
  evasion: number
  hit: boolean
}

export type DamageEvent = {
  type: 'damage'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  targetHpBefore: number
  targetHpAfter: number
} & DamageResult

export type DeathEvent = {
  type: 'death'
  timeMs: number
  actorId: string
  actorName: string
  killerId: string
  killerName: string
}

export type EncounterEndEvent = {
  type: 'encounterEnd'
  timeMs: number
  outcome: 'victory' | 'defeat' | 'timeout'
}

export const TARGET_PRIORITIES = [
  'current',
  'lowestHpPercent',
  'highestHpPercent',
  'lowestArmor',
  'lowestResistance',
  'marked',
  'actingSoonest',
  'random',
] as const

export type TargetPriority = (typeof TARGET_PRIORITIES)[number]

export type CompareOperator = 'atMost' | 'atLeast' | 'equal' | 'notEqual'

export type PresenceOperator = 'present' | 'absent'

export type ConditionOperator = CompareOperator | PresenceOperator

/**
 * One check. Every condition on a row must pass.
 * HP values are percent points (40 means 40%). Telegraph times are milliseconds.
 * Bleed remaining is actions. Other status remaining times are milliseconds.
 */
export type AutomationCondition =
  | { kind: 'hpPercent'; who: 'hero' | 'target'; operator: CompareOperator; value: number }
  | { kind: 'classResource'; operator: CompareOperator; value: number }
  | { kind: 'barrier'; operator: ConditionOperator; value?: number }
  | {
      kind: 'status'
      who: 'hero' | 'target'
      statusId: string
      measure: 'presence' | 'stacks' | 'remaining'
      operator: ConditionOperator
      value?: number
    }
  | { kind: 'specialAmmo'; operator: CompareOperator; value: number }
  | { kind: 'enemyCount'; operator: CompareOperator; value: number }
  | { kind: 'enemyType'; operator: 'equal' | 'notEqual'; value: string }
  | { kind: 'rank'; operator: CompareOperator; value: number }
  | { kind: 'mark'; operator: PresenceOperator }
  | { kind: 'bossPhase'; operator: CompareOperator; value: number }
  | { kind: 'telegraph'; tag?: string; operator: ConditionOperator; value?: number }

export type PriorityDecision = 'skip' | 'use' | 'fallback'

export type PriorityEvent = {
  type: 'priority'
  timeMs: number
  actorId: string
  actorName: string
  rowIndex: number | null
  skillId: string | null
  skillName: string | null
  decision: PriorityDecision
  reason: string | null
}

export type RulesChangedEvent = {
  type: 'rulesChanged'
  timeMs: number
  actorId: string
  actorName: string
  applied: boolean
  reason: string | null
  rowCount: number
  targetPriority: TargetPriority | null
}

export type HealResult = {
  maxHpFraction: number
  healingCoefficient: number
  healingPower: number
  outgoingModifier: number
  raw: number
  afterOutgoing: number
  roll: number
  rollFloor: number
  rollCeiling: number
  afterRoll: number
  healingReceived: number
  afterReceived: number
  amount: number
}

export type HealEvent = {
  type: 'heal'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  targetHpBefore: number
  targetHpAfter: number
} & HealResult

export type BarrierEvent = {
  type: 'barrier'
  timeMs: number
  actorId: string
  actorName: string
  sourceId: string
  sourceName: string
  amount: number
  expiresMs: number
  replaced: number
}

export type BarrierExpiredEvent = {
  type: 'barrierExpired'
  timeMs: number
  actorId: string
  actorName: string
  amount: number
}

export type UntilNextActionBuff = 'damageReduction' | 'evasion' | 'incomingDamage'

export type BuffEvent = {
  type: 'buff'
  timeMs: number
  actorId: string
  actorName: string
  kind: UntilNextActionBuff
  value: number
  until: 'nextAction'
}

export type BuffEndedEvent = {
  type: 'buffEnded'
  timeMs: number
  actorId: string
  actorName: string
  damageReduction: number
  evasion: number
  incomingMultiplier: number
}

export type ActionDelayEvent = {
  type: 'actionDelay'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  delayMs: number
  nextReadyMs: number
}

export type StatusAttemptResult = 'applied' | 'resisted' | 'contact' | 'cap' | 'guaranteed'

export type StatusAttemptEvent = {
  type: 'statusAttempt'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  statusId: string
  statusName: string
  /** School used for resistance. Mark does not roll. */
  school: DamageSchool | 'none'
  baseChance: number
  potency: number
  resistance: number
  chance: number
  /** Null when the attempt does not draw (Mark, or a contact status blocked by a barrier). */
  roll: number | null
  result: StatusAttemptResult
  stacks: number
  intensity: number
  expiresMs: number | null
  delayMs: number | null
  nextReadyMs: number | null
}

export type StatusTickEvent = {
  type: 'statusTick'
  timeMs: number
  sourceId: string
  sourceName: string
  targetId: string
  targetName: string
  statusId: string
  statusName: string
  school: DamageSchool
  stacks: number
  intensity: number
  power: number
  coefficient: number
  raw: number
  penetration: number
  defense: number
  attackerLevel: number
  reduction: number
  afterDefense: number
  hpDamage: number
  targetHpBefore: number
  targetHpAfter: number
  barrierBypassed: boolean
  crit: boolean
  varianceRoll: boolean
}

export type StatusExpiredEvent = {
  type: 'statusExpired'
  timeMs: number
  actorId: string
  actorName: string
  statusId: string
  statusName: string
  stacks: number
}

export type StatusClearedEvent = {
  type: 'statusCleared'
  timeMs: number
  actorId: string
  actorName: string
  statusId: string
  statusName: string
  stacks: number
}

/** Encounter meters reset when the encounter ends. Expedition meters carry until a later expedition step. */
export type ResourceScope = 'encounter' | 'expedition'

export type ResourceEvent = {
  type: 'resource'
  timeMs: number
  actorId: string
  actorName: string
  resourceId: string
  scope: ResourceScope
  reason: string
  /** Listed base before Spirit, or the amount paid. */
  base: number
  /** 1 + Spirit resource-generation bonus. Payments use 1. */
  multiplier: number
  /** After Spirit and a per-hit cap, before the meter maximum. */
  generated: number
  /** Per-hit cap after Spirit. Null when this gain is not capped. */
  gainCap: number | null
  before: number
  after: number
  maximum: number
}

/** Held-resource damage bonus frozen before a spender pays. */
export type ResourceSnapshotEvent = {
  type: 'resourceSnapshot'
  timeMs: number
  actorId: string
  actorName: string
  resourceId: string
  amount: number
  multiplier: number
}

export type WaitEvent = {
  type: 'wait'
  timeMs: number
  actorId: string
  actorName: string
  reason: string
}

export type LogEvent =
  | EncounterStartEvent
  | PriorityEvent
  | RulesChangedEvent
  | ActionEvent
  | HitRollEvent
  | DamageEvent
  | HealEvent
  | BarrierEvent
  | BarrierExpiredEvent
  | BuffEvent
  | BuffEndedEvent
  | ActionDelayEvent
  | StatusAttemptEvent
  | StatusTickEvent
  | StatusExpiredEvent
  | StatusClearedEvent
  | ResourceEvent
  | ResourceSnapshotEvent
  | WaitEvent
  | DeathEvent
  | EncounterEndEvent

export type DamageEffect = {
  kind: 'damage'
  school: DamageSchool
  coefficient: number
}

export type HealEffect = {
  kind: 'heal'
  maxHpFraction: number
  healingCoefficient: number
}

export type BarrierEffect = {
  kind: 'barrier'
  source: 'magical' | 'healing'
  coefficient: number
  durationSeconds: number
}

export type DamageReductionEffect = {
  kind: 'damageReduction'
  fraction: number
}

export type EvasionEffect = {
  kind: 'evasion'
  amount: number
}

export type IncomingDamageEffect = {
  kind: 'incomingDamage'
  multiplier: number
}

export type ActionDelayEffect = {
  kind: 'actionDelay'
  delaySeconds: number
}

/** Restore `base` class resource before Spirit. The meter caps at its maximum. */
export type ResourceGainEffect = {
  kind: 'resource'
  base: number
}

/**
 * Hit the chosen target, then other living enemies by slot.
 * Each later coefficient is the previous coefficient times `decay`.
 * Each hit uses that target's variance, crit, and defense, then pushes its next action.
 */
export type ChainEffect = {
  kind: 'chain'
  school: DamageSchool
  coefficient: number
  decay: number
  maxTargets: number
  delaySeconds: number
}

export type ApplyStatusEffect = {
  kind: 'applyStatus'
  statusId: string
  /**
   * Fraction from 0 through 1 added as percentage points.
   * 1 means 100 points before Potency and Resistance. Mark does not roll.
   */
  baseChance: number
  /** Tick coefficient for Bleed, Poison, and Burn. */
  coefficient?: number
  /** Power to snapshot. Defaults to the status damage school. */
  power?: DamageSchool
  /** Extra Potency points from the skill. Affects application chance only. */
  potency?: number
  /** Fraction of Armor removed by Expose. 0.2 is 20%. */
  armorMagnitude?: number
  /** Fraction of Resistance removed by Expose. */
  resistanceMagnitude?: number
  /** Mark duration in seconds. Omitted Mark does not expire. Bosses use half. */
  durationSeconds?: number
}

/** Closed list. Add a kind only when a listed skill needs it. */
export type SkillEffect =
  | DamageEffect
  | HealEffect
  | BarrierEffect
  | DamageReductionEffect
  | EvasionEffect
  | IncomingDamageEffect
  | ActionDelayEffect
  | ResourceGainEffect
  | ChainEffect
  | ApplyStatusEffect

export type SkillRequirement = {
  mainHand?: WeaponKind
  offHand?: OffHandKind
}

export type SkillDef = {
  id: string
  name: string
  cost: number
  cooldownSeconds: number
  actionTimeCoefficient: number
  tags: readonly string[]
  requires?: SkillRequirement
  target: 'single' | 'all'
  effects: readonly SkillEffect[]
}

/** One automation row. All of its conditions must pass. The same skill on a later row is the OR. */
export type PriorityRow = {
  skillId: string
  conditions?: readonly AutomationCondition[]
  /** Replaces the hero's global target priority for this row. */
  targetPriority?: TargetPriority
}

export type CombatHero = CombatActor & {
  physicalPower: number
  magicalPower: number
  healingPower: number
  healingReceived: number
  cooldownReduction: number
  agility: number
  baseActionSeconds: number
  armorPenetration: number
  magicalPenetration: number
  mainHandKind: WeaponKind
  offHandKind: OffHandKind | null
  equippedSkillIds: string[]
  priorityRows: PriorityRow[]
  /** Skill id → simulated time when the cooldown ends and the skill can be used. */
  cooldowns: { [skillId: string]: number }
  classId: HeroClass
  /** Live class meter. Conditions read it, and a positive skill cost is paid from it. */
  classResource: number
  classResourceId: string
  classResourceMax: number
  classResourceScope: ResourceScope
  /** Base resource per second before Spirit. 0 when the class does not regenerate in combat. */
  resourceRegenPerSecond: number
  /** Plain JSON class memory. Not a place for functions. */
  classState: { [key: string]: number | string | boolean | null }
  /** Set while the hero is waiting for a resource. The wait does not spend action time. */
  waiting: boolean
  /** Equipped special-ammunition count for conditions. */
  specialAmmo: number
  /** Null selects the first living enemy by slot. */
  targetPriority: TargetPriority | null
  currentTargetId: string | null
}

export type CombatState = {
  timeMs: number
  rng: RngState
  hero: CombatHero
  enemies: CombatActor[]
  log: LogEvent[]
  outcome: CombatOutcome
  seed: number
}

export type CombatHeroSetup = {
  id: string
  name: string
  level: number
  classId: HeroClass
  attributes: Attributes
  gear: HeroGear
  equippedSkillIds?: readonly string[]
  priorityRows?: readonly PriorityRow[]
  targetPriority?: TargetPriority
}

export type CombatEnemySetup = {
  defId: string
  slot: number
  /** Omitted enemies start revealed. */
  revealed?: boolean
}

export type CombatSetup = {
  hero: CombatHeroSetup
  enemies: readonly CombatEnemySetup[]
}

export type EnemyDef = {
  id: string
  name: string
  level: number
  archetype: EnemyArchetype
  elite?: boolean
  overrides?: EnemyStatOverrides
  school: DamageSchool
  /** Uses boss stack caps, half durations, and the 35% Stun delay. Not immunity. */
  boss?: boolean
}

export type GameDefs = {
  enemies: { [id: string]: EnemyDef }
  skills: { [id: string]: SkillDef }
  statuses: { [id: string]: StatusDef }
}

/**
 * Fixed class and race extension points.
 * Combat calls a hook only when this step's modules use it.
 * Modules do not reach into combat scheduling.
 */
export const CLASS_HOOK_NAMES = [
  'encounterStart',
  'encounterEnd',
  'actionChosen',
  'actionResolved',
  'damageDealt',
  'damageTaken',
  'kill',
  'outgoingModifiers',
  'incomingModifiers',
  'fallbackAction',
] as const

export type ClassHookName = (typeof CLASS_HOOK_NAMES)[number]

export type ClassAction =
  | { kind: 'basicAttack'; hit: boolean }
  | { kind: 'skill'; skill: SkillDef }

export type DamageNotice = {
  hpLost: number
  hpBefore: number
  kind: 'hit' | 'statusTick'
  timeMs: number
  school: DamageSchool
}

export type OutgoingModifierQuery = {
  school: DamageSchool
  skill: SkillDef | null
}

export type FallbackDecision =
  | { kind: 'basicAttack' }
  | { kind: 'skill'; skillId: string }
  | { kind: 'wait'; reason: string }

export type ClassModule = {
  encounterStart?: (state: CombatState, timeMs: number) => void
  encounterEnd?: (state: CombatState, timeMs: number) => void
  actionChosen?: (state: CombatState, action: ClassAction, timeMs: number) => void
  actionResolved?: (state: CombatState, action: ClassAction, timeMs: number) => void
  damageDealt?: (state: CombatState, notice: DamageNotice) => void
  damageTaken?: (state: CombatState, notice: DamageNotice) => void
  kill?: (state: CombatState, victimId: string, timeMs: number) => void
  outgoingModifiers?: (state: CombatState, query: OutgoingModifierQuery) => number
  incomingModifiers?: (state: CombatState, query: OutgoingModifierQuery) => number
  fallbackAction?: (state: CombatState, defs: GameDefs, timeMs: number) => FallbackDecision
}
