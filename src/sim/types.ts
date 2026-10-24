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
  /**
   * Another actor whose next action ends `damageReduction`.
   * Null means this actor's own next action ends it.
   */
  damageReductionSourceId: string | null
  evasionBonus: number
  /** Added to Evasion until `timedEvasionExpiresMs`. Not cleared by the next action. */
  timedEvasion: number
  timedEvasionExpiresMs: number
  /** Multiplier on healing received. Enemies start at 1. */
  healingReceived: number
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
  /** Boss phase a test or later encounter can set. The boss-phases trait writes it. */
  bossPhase: number
  /** Rank-adjusted stats before Guard and phase stacks. Echo summons read these. */
  rankMaxHp: number
  rankPower: number
  rankArmor: number
  rankResistance: number
  /** Summoner's rank-adjusted maximum HP. 0 when this actor has none. */
  anchorMaxHp: number
  /** 1 when no timed Armor and Resistance bonus is active. Expose reads the result. */
  defenseBonusMultiplier: number
  defenseBonusExpiresMs: number
  pressureStacks: number
  /** 0 when no pressure stack is scheduled. */
  pressureNextMs: number
  pressureIntervalMs: number
  pressureMaxStacks: number
  pressurePowerMultiplier: number
  pressureDefenseMultiplier: number
  pressureActionSpeed: number
  phases: BossPhaseDef[]
  phaseSkillsDue: PhaseSkillDue[]
  /** Pending action telegraph. Automation reads `tag` and the time until `resolvesAtMs`. */
  telegraph: ActorTelegraph | null
  /**
   * A second telegraph that does not take the action slot or move `nextReadyMs`.
   * Stun and action delay still postpone it. Ordinary damage does not cancel it.
   */
  reaction: ActorTelegraph | null
  /** Active stance. Null when this actor has no stance trait. */
  stance: EnemyStance | null
  /** Power, Armor, and Resistance before the current stance multipliers. */
  stanceBasePower: number
  stanceBaseArmor: number
  stanceBaseResistance: number
  /** One-shot threshold skills that have already started. */
  thresholdStarted: { [skillId: string]: boolean }
  /** Authored skills copied at spawn. Heroes and filler-only enemies keep this empty. */
  skills: EnemySkillDef[]
  /** Enemy definition id. Empty for the hero. */
  defId: string
  traitIds: string[]
  /** XP after archetype multipliers. Summons stay at 0. */
  xp: number
  summon: boolean
  /** Filler basic-attack coefficient. Heroes use 1. */
  fillerCoefficient: number
  /** Skill id → simulated time when the cooldown ends and the skill can be used. */
  cooldowns: { [skillId: string]: number }
  /** One armed Snare Trap. A new cast clears every other trap first. */
  armedTrap: ArmedTrap | null
  statuses: ActorStatuses
}

export type EnemyStance = 'guard' | 'assault'

export type ActorTelegraph = {
  tag: string
  resolvesAtMs: number
  /** Present when the simulation started this telegraph. Tests may set the tag alone. */
  skillId?: string
  /** When the telegraph began. An interrupt spends its cooldown from this time. */
  startedAtMs?: number
  /** A death burst stays armed after the actor dies. Encounter end cancels it. */
  persistsAfterDeath?: boolean
  /** Hero HP damage counted while this telegraph is running. Barrier damage is not included. */
  hpTaken?: number
  /** Cancel when `hpTaken` reaches this fraction of maximum HP. */
  interruptMaxHpFraction?: number
}

/** Plain JSON trap armed on one target. It resolves the next time that target is ready. */
export type ArmedTrap = {
  baseChance: number
  skillId: string
  sourceId: string
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
  /** Special arrows spent with this action. Omitted when the skill spends none. */
  ammoSpent?: number
  ammoRemaining?: number
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

/** A queued skill was used, or cancelled because it was ineligible at the action. */
export type ManualEvent = {
  type: 'manual'
  timeMs: number
  actorId: string
  actorName: string
  skillId: string
  skillName: string
  result: 'use' | 'cancel'
  /** Skip reason when cancelled. Null when the queued skill is used. */
  reason: string | null
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

export type UntilNextActionBuff = 'damageReduction' | 'evasion' | 'incomingDamage' | 'defense'

export type BuffEvent = {
  type: 'buff'
  timeMs: number
  actorId: string
  actorName: string
  kind: UntilNextActionBuff
  value: number
  /** `duration` ends at `expiresMs`. `nextAction` ends when this actor next acts. */
  until: 'nextAction' | 'duration'
  expiresMs?: number
}

export type BuffEndedEvent = {
  type: 'buffEnded'
  timeMs: number
  actorId: string
  actorName: string
  damageReduction: number
  evasion: number
  incomingMultiplier: number
  /** `duration` is a timed Evasion expiry. `granted` is a buff another actor applied. `defense` is a timed Armor and Resistance bonus. */
  reason?: 'duration' | 'granted' | 'defense'
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
  /** Set when Mark moves to another target. Cleanse leaves this unset. */
  reason?: string
}

export type MarkRefreshEvent = {
  type: 'markRefresh'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  remainingMs: number
  nextRemainingMs: number
  expiresMs: number
}

export type RevealEvent = {
  type: 'reveal'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
}

export type TrapEvent = {
  type: 'trap'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  replacedId: string | null
  replacedName: string | null
}

/** One caster field. A new cast replaces the previous field. */
export type ActiveField = {
  skillId: string
  sourceId: string
  sourceName: string
  expiresMs: number
  tickMs: number
  nextTickMs: number
  damageSchool: DamageSchool
  damageCoefficient: number
  healCoefficient: number
  /** Magical or physical power frozen at cast. */
  power: number
  penetration: number
  healingPower: number
  attackerLevel: number
}

export type FieldEvent = {
  type: 'field'
  timeMs: number
  actorId: string
  actorName: string
  skillId: string
  expiresMs: number
  nextTickMs: number
  replaced: boolean
  power: number
  healingPower: number
  damageCoefficient: number
  healCoefficient: number
}

export type FieldTickEvent = {
  type: 'fieldTick'
  timeMs: number
  actorId: string
  actorName: string
  targetId: string
  targetName: string
  school: DamageSchool
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
  barrierBypassed: true
  crit: false
  varianceRoll: false
}

export type FieldHealEvent = {
  type: 'fieldHeal'
  timeMs: number
  actorId: string
  actorName: string
  healingPower: number
  coefficient: number
  raw: number
  healingReceived: number
  afterReceived: number
  amount: number
  targetHpBefore: number
  targetHpAfter: number
}

export type FieldExpiredEvent = {
  type: 'fieldExpired'
  timeMs: number
  actorId: string
  actorName: string
  skillId: string
}

/** Direct health loss that bypasses barriers and Defense. */
export type HpLossEvent = {
  type: 'hpLoss'
  timeMs: number
  actorId: string
  actorName: string
  skillId: string
  amount: number
  hpBefore: number
  hpAfter: number
  barrierBypassed: true
  defenseBypassed: true
}

/** Temperance did not generate. The reason is hp, overheal, or overcap. */
export type VowEvent = {
  type: 'vow'
  timeMs: number
  actorId: string
  actorName: string
  vow: string
  reason: 'hp' | 'overheal' | 'overcap'
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
  /** Advantage accumulator before and after this change. Omitted for numeric meters. */
  fractionBefore?: number
  fractionAfter?: number
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

export type TelegraphPhase = 'start' | 'resolve' | 'cancel'

/** A telegraph start names the tag and the time the skill resolves. */
export type TelegraphEvent = {
  type: 'telegraph'
  timeMs: number
  actorId: string
  actorName: string
  skillId: string
  skillName: string
  tag: string
  resolvesAtMs: number
  phase: TelegraphPhase
  /** Set when the skill resolves and the cooldown has started. */
  cooldownReadyMs?: number | null
  /** Set when hero HP damage cancels the telegraph before it resolves. */
  reason?: 'interrupt'
  /** Hero HP damage counted toward an interrupt. */
  hpTaken?: number
  /** HP damage required to interrupt. `maxHp × fraction`. */
  hpNeeded?: number
}

/** One stance replaced the previous multipliers. It does not move a scheduled action. */
export type StanceEvent = {
  type: 'stance'
  timeMs: number
  actorId: string
  actorName: string
  stance: EnemyStance
  power: number
  armor: number
  resistance: number
}

/** A summon joined the encounter. Its XP stays 0 and it does not increase the group discount. */
export type SummonEvent = {
  type: 'summon'
  timeMs: number
  actorId: string
  actorName: string
  summonId: string
  summonName: string
  defId: string
  level: number
  slot: number
  xp: number
  summon: true
}

/** One regeneration tick. Burn logs a paused tick instead of healing every 10 ms step. */
export type RegenEvent = {
  type: 'regen'
  timeMs: number
  actorId: string
  actorName: string
  maxHp: number
  fraction: number
  amount: number
  hpBefore: number
  hpAfter: number
  paused: boolean
}

/** A ready support skill had no legal ally, so the AI moved to the next skill. */
export type SkillSkipEvent = {
  type: 'skillSkip'
  timeMs: number
  actorId: string
  actorName: string
  skillId: string
  skillName: string
  reason: string
}

/** A boss entered one phase. Each HP threshold is entered once. */
export type PhaseEvent = {
  type: 'phase'
  timeMs: number
  actorId: string
  actorName: string
  phase: number
  name: string
  hp: number
  maxHp: number
}

/** One phase-pressure stack. It does not move an already scheduled action. */
export type StackEvent = {
  type: 'stack'
  timeMs: number
  actorId: string
  actorName: string
  stacks: number
  maxStacks: number
  power: number
  armor: number
  resistance: number
}

/** Victory XP after archetype multipliers and the group discount. */
export type EncounterXpEvent = {
  type: 'encounterXp'
  timeMs: number
  /** Sum of non-summon XP before the discount. */
  sum: number
  /** Non-summon enemies included in `sum`. */
  members: number
  /** Discount fraction after the 20% cap. 0.05 is 5%. */
  discount: number
  amount: number
}

/**
 * One escape attempt. It does not spend the hero's action.
 * `thresholdPercent` is the fraction that was met, as a percent. 40 is 40%.
 */
export type EscapeEvent = {
  type: 'escape'
  timeMs: number
  actorId: string
  actorName: string
  hp: number
  maxHp: number
  thresholdPercent: number
  roll: number
  chancePercent: number
  basePercent: number
  agility: number
  agilityPoints: number
  suppliesBonus: number
  zoneBonus: number
  momentumBonus: number
  success: boolean
}

export type LogEvent =
  | EncounterStartEvent
  | PriorityEvent
  | RulesChangedEvent
  | ManualEvent
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
  | MarkRefreshEvent
  | RevealEvent
  | TrapEvent
  | FieldEvent
  | FieldTickEvent
  | FieldHealEvent
  | FieldExpiredEvent
  | HpLossEvent
  | VowEvent
  | ResourceEvent
  | ResourceSnapshotEvent
  | WaitEvent
  | TelegraphEvent
  | StanceEvent
  | SummonEvent
  | RegenEvent
  | SkillSkipEvent
  | PhaseEvent
  | StackEvent
  | EncounterXpEvent
  | DeathEvent
  | EncounterEndEvent
  | EscapeEvent

export type DamageEffect = {
  kind: 'damage'
  school: DamageSchool
  coefficient: number
  /** Power stat to multiply. Defaults to the damage school. */
  power?: DamageSchool
  /** Added to Armor penetration before the 80% cap. Physical hits only. */
  armorPenetrationBonus?: number
}

export type HealEffect = {
  kind: 'heal'
  maxHpFraction: number
  healingCoefficient: number
  /** `anchor` uses the caster's anchor max HP instead of the target's maximum. */
  maxHpOf?: 'target' | 'anchor'
}

export type BarrierEffect = {
  kind: 'barrier'
  source: 'magical' | 'healing' | 'anchorMaxHp'
  coefficient: number
  durationSeconds: number
}

/** Timed multiplier on Armor and Resistance. Expose reads the multiplied defense. */
export type DefenseBonusEffect = {
  kind: 'defenseBonus'
  /** 1.5 means +50%. */
  multiplier: number
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

/** Sets the target's revealed flag for this encounter. Does not apply Mark. */
export type RevealEffect = {
  kind: 'reveal'
}

/** Arms one trap. A later cast replaces any trap already armed. */
export type ArmTrapEffect = {
  kind: 'armTrap'
  /** Stun chance before Potency and Resistance. 0.75 is 75 percentage points. */
  baseChance: number
}

/**
 * One field on the caster. Recasting replaces it.
 * Ticks use snapshotted power and current defense, and they are not hero actions.
 */
export type FieldEffect = {
  kind: 'field'
  durationSeconds: number
  tickSeconds: number
  damageSchool: DamageSchool
  damageCoefficient: number
  healCoefficient: number
}

/** Evasion added for a duration. It is not removed when the actor next acts. */
export type TimedEvasionEffect = {
  kind: 'timedEvasion'
  amount: number
  durationSeconds: number
}

/**
 * Roll one application chance. On success, resolve every nested effect.
 * On failure, resolve none of them.
 */
export type ChanceGateEffect = {
  kind: 'chanceGate'
  baseChance: number
  school: DamageSchool
  effects: readonly SkillEffect[]
}

/** Fractions of the summoner's rank-adjusted stats. Action time is absolute seconds. */
export type SummonerStatFractions = {
  hpFraction: number
  armorFraction: number
  resistanceFraction: number
  powerFraction: number
  actionTime: number
}

/** Spawn one enemy from the combat definitions. The spawn is a summon. */
export type SummonEffect = {
  kind: 'summon'
  enemyId: string
  level: number
  /** When set, replace the summon's stats from the summoner's rank-adjusted stats. */
  fromSummoner?: SummonerStatFractions
  /** Copy the summoner's rank-adjusted maximum HP onto the summon. */
  anchorMaxHp?: boolean
}

/** Remove a fraction of maximum HP. Barriers and Defense do not reduce it. */
export type LoseHpEffect = {
  kind: 'loseHp'
  maxHpFraction: number
  /** The skill is ineligible when the loss would leave 0 HP or less. */
  preventFatal: boolean
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
  | RevealEffect
  | ArmTrapEffect
  | FieldEffect
  | LoseHpEffect
  | TimedEvasionEffect
  | ChanceGateEffect
  | SummonEffect
  | DefenseBonusEffect

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
  /** Special arrows required in addition to `cost`. Spend neither unless both can be paid. */
  ammoCost?: number
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
  /** Equipped special-ammunition count for conditions and Flame Arrow. */
  specialAmmo: number
  /**
   * Advantage progress toward the next whole stack.
   * `classResource` stays the live whole-number meter. This fraction can stay at or above 1.
   */
  resourceFraction: number
  /** Starting class meter from the encounter setup. Null when the setup did not supply one. */
  suppliedResource: number | null
  /** Starting special ammo from the encounter setup. Null when the setup did not supply it. */
  suppliedAmmo: number | null
  /** Vow copied from setup. Only a Cleric reads it. Null when the setup omitted it. */
  suppliedVow: string | null
  /**
   * Expedition fights pass the carried meter in through `suppliedResource`.
   * Warrior Fury then stays after the fight. Standalone fights leave this false and still clear Fury.
   */
  carryResource: boolean
  /** One active field. A new field effect replaces this. */
  field: ActiveField | null
  /** This action's applied heal, after the roll and healing received, exceeded the HP missing. */
  overhealed: boolean
  /** When set, the next skill hit uses this coefficient instead of the effect's. */
  pendingCoefficient: number | null
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
  /** One skill id for the hero's next action. Null when nothing is queued. */
  queuedSkillId: string | null
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
  /** Ranger Readiness start. Omitted uses the harness default. Other classes ignore it. */
  startingResource?: number
  /** Special arrows at the start. Omitted lets the class apply its own default. */
  specialAmmo?: number
  /** Cleric vow. Other classes ignore it. */
  vow?: string
  /**
   * When true, Warrior, Mage, and Cleric start from `startingResource`.
   * Warrior Fury is not cleared at the end of that fight. Omitted is a standalone fight.
   */
  carryResource?: boolean
  /** Current HP. Omitted starts at maximum HP. Values above maximum HP are capped. */
  startingHp?: number
}

export type CombatEnemySetup = {
  defId: string
  slot: number
  /** Omitted enemies start revealed. */
  revealed?: boolean
  /** Required when the definition's level range is wider than one level. */
  level?: number
  /** Summons add no encounter XP and do not increase the group discount. */
  summon?: boolean
  /** Echo rank. Omitted is 0. Only an enemy with echo-rank scaling uses it for stats. */
  rank?: number
}

export type CombatSetup = {
  hero: CombatHeroSetup
  enemies: readonly CombatEnemySetup[]
}

/** Basic attack used when every authored action skill is on cooldown. It rolls to hit and cannot crit. */
export type EnemyFillerAttack = {
  school: DamageSchool
  /** Omitted uses the basic-attack coefficient, 1. */
  coefficient?: number
}

export type EnemySkillTrigger = 'action' | 'death' | 'hp' | 'phase'

/** One boss phase. A phase with no HP fraction is the start. Later phases are entered once. */
export type BossPhaseDef = {
  phase: number
  name: string
  /** Enter this phase the first time HP is at or below this fraction of maximum HP. */
  atOrBelowHpFraction?: number
  /** Milliseconds after entering this phase before the first pressure stack, then between stacks. */
  pressureIntervalMs?: number
  pressureMaxStacks?: number
  /** Each stack multiplies Power by this. */
  pressurePower?: number
  /** Each stack multiplies Armor and Resistance by this. */
  pressureDefense?: number
  /** Each stack divides action time by this when the next action is scheduled. */
  pressureActionSpeed?: number
}

/** A phase skill waiting to resolve at `timeMs`. */
export type PhaseSkillDue = {
  skillId: string
  timeMs: number
}

/** Another living enemy. The acting enemy is not its own ally. */
export type AllyTarget = 'lowestHpPercent' | 'lowestBarrier' | 'woundedLowestHpPercent'

/** Recovery that replaces the skill's action time. Reload uses this. */
export type ForcedRecovery = {
  id: string
  name: string
  durationMs: number
  /** Added to Evasion at resolution and cleared when this actor next acts. */
  evasion: number
}

/**
 * Numbers for one enemy skill. The AI uses `action` skills in listed order.
 * A `death` skill starts only from a trait.
 */
export type EnemySkillDef = {
  id: string
  name: string
  /** Primary damage coefficient. 0 when the skill deals no damage. */
  coefficient: number
  school: DamageSchool
  cooldownSeconds: number
  /** Wind-up in milliseconds. Omitted or 0 resolves on the ready time. */
  telegraphMs?: number
  /** Tag shown on the telegraph and to automation. */
  tag: string
  tags: readonly string[]
  /** Crits only when this is true. The filler attack never sets it. */
  canCrit?: boolean
  /** Omitted means 1.0 × the enemy's base action time. */
  actionTimeCoefficient?: number
  effects: readonly SkillEffect[]
  /**
   * Omitted skills are chosen by the AI.
   * `hp` starts once, from a trait, when HP is at or below `hpFraction`.
   * `phase` runs once, immediately, when that boss phase is entered.
   */
  trigger?: EnemySkillTrigger
  /** Used by an `hp` trigger. 0.6 means 60% of maximum HP. */
  hpFraction?: number
  /** Used by a `phase` trigger. */
  phase?: number
  /** Usable only while `bossPhase` is one of these. Omitted skills are available in every phase. */
  phases?: readonly number[]
  /**
   * Cancel this telegraph when hero HP damage during it reaches this fraction of maximum HP.
   * Barrier damage that never reaches HP is not counted.
   */
  interruptMaxHpFraction?: number
  /** Ally chosen when the skill resolves. Omitted skills do not need an ally. */
  allyTarget?: AllyTarget
  /** The caster is affected even when no ally exists. */
  affectSelf?: boolean
  /**
   * When set, the next ready time is the resolution plus `durationMs`,
   * not the skill's action time. Evasion is applied at resolution.
   */
  forcedRecovery?: ForcedRecovery
}

export type EnemyDef = {
  id: string
  name: string
  /**
   * Fixed level used when the encounter omits a level and the range is one level.
   * Ranged enemies still keep a level inside that range.
   */
  level: number
  /** Inclusive. Omitted means this enemy is exactly `level`. */
  levelMin?: number
  levelMax?: number
  archetype: EnemyArchetype
  elite?: boolean
  overrides?: EnemyStatOverrides
  /** Filler school when `filler` is omitted. */
  school: DamageSchool
  filler?: EnemyFillerAttack
  skills?: readonly EnemySkillDef[]
  traitIds?: readonly string[]
  /** Uses boss stack caps, half durations, and the 35% Stun delay. Not immunity. */
  boss?: boolean
  /** Ordered boss phases. The trait enters each threshold once. */
  phases?: readonly BossPhaseDef[]
  /** Encounter rank R multiplies HP, Power, Armor, and Resistance by 1.12^R. */
  echoRank?: boolean
  /** Material dropped when an expedition fight is won. Omitted enemies drop nothing. */
  drop?: EnemyDrop
}

/** Base material quantity for one enemy, before expedition momentum. */
export type EnemyDrop = {
  materialId: string
  baseQuantity: number
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

export type ClassStrike = {
  targetId: string
  hit: boolean
  crit: boolean
  /** HP this hit removed. Omitted on older notices. A full absorb is 0. */
  hpLost?: number
}

export type ClassAction =
  | { kind: 'basicAttack'; hit: boolean; crit?: boolean; targetId?: string; hpLost?: number }
  | {
      kind: 'skill'
      skill: SkillDef
      /** Primary target. Execute reads this target's health before the hit. */
      targetId?: string
      crit?: boolean
      strikes?: readonly ClassStrike[]
    }

export type DamageNotice = {
  hpLost: number
  hpBefore: number
  /** Barrier absorbed by this hit. Status ticks and misses omit it or use 0. */
  barrierAbsorbed?: number
  /** `miss` is an enemy basic attack that failed its hit roll. It is not a hit for 0 HP. */
  kind: 'hit' | 'statusTick' | 'miss'
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
