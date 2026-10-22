import type { RngState } from './rng.ts'
import type {
  Attributes,
  EnemyArchetype,
  EnemyStatOverrides,
  HeroClass,
  HeroGear,
} from './stats.ts'

export type DamageSchool = 'physical' | 'magical'

export type CombatOutcome = 'ongoing' | 'victory' | 'defeat' | 'timeout'

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
  action: 'basicAttack'
  scheduledMs: number
  nextReadyMs: number
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

export type LogEvent =
  | EncounterStartEvent
  | ActionEvent
  | HitRollEvent
  | DamageEvent
  | DeathEvent
  | EncounterEndEvent

export type CombatState = {
  timeMs: number
  rng: RngState
  hero: CombatActor
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
}

export type GameDefs = {
  enemies: { [id: string]: EnemyDef }
}
