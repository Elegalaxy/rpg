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
  statuses: ActorStatuses
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

export type LogEvent =
  | EncounterStartEvent
  | PriorityEvent
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

/** Closed list. Resource changes are a later step. */
export type SkillEffect =
  | DamageEffect
  | HealEffect
  | BarrierEffect
  | DamageReductionEffect
  | EvasionEffect
  | IncomingDamageEffect
  | ActionDelayEffect
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

/** Unconditional priority row. Conditions arrive in a later step. */
export type PriorityRow = {
  skillId: string
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
}

export type CombatEnemySetup = {
  defId: string
  slot: number
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
