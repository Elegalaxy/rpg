import {
  BOSS_PHASES_TRAIT,
  FRACTURE_BURST_TRAIT,
  HP_SUMMON_TRAIT,
  PACK_HUNTER_TRAIT,
  REGENERATION_TRAIT,
  STANCE_TRAIT,
} from '../sim/enemyAi.ts'
import type { EnemyDef, EnemySkillDef, TimePressureDef } from '../sim/types.ts'

/** Level-20 standard enemy with no overrides. Basic attacks are physical. */
export const standardDummy: EnemyDef = {
  id: 'dummy-standard-20',
  name: 'Standard Dummy',
  level: 20,
  archetype: 'standard',
  school: 'physical',
  filler: { school: 'physical' },
}

const fractureBurst: EnemySkillDef = {
  id: 'fracture-burst',
  name: 'Fracture Burst',
  coefficient: 0.4,
  school: 'magical',
  cooldownSeconds: 0,
  telegraphMs: 1000,
  tag: 'fracture-burst',
  tags: ['fracture-burst', 'magical'],
  canCrit: false,
  trigger: 'death',
  effects: [{ kind: 'damage', school: 'magical', coefficient: 0.4 }],
}

/** Levels 1–5. Swarm. Drops 4 shard. The filler is a physical basic attack. */
export const fractureShardling: EnemyDef = {
  id: 'fracture-shardling',
  name: 'Fracture Shardling',
  level: 1,
  levelMin: 1,
  levelMax: 5,
  archetype: 'swarm',
  school: 'physical',
  filler: { school: 'physical' },
  traitIds: [FRACTURE_BURST_TRAIT],
  skills: [fractureBurst],
  drop: { materialId: 'shard', baseQuantity: 4 },
}

const pounce: EnemySkillDef = {
  id: 'pounce',
  name: 'Pounce',
  coefficient: 1.6,
  school: 'physical',
  cooldownSeconds: 7,
  telegraphMs: 1500,
  tag: 'pounce',
  tags: ['pounce', 'physical'],
  canCrit: true,
  effects: [{ kind: 'damage', school: 'physical', coefficient: 1.6 }],
}

/** Levels 2–6. Skirmisher. Drops 4 hide. The filler is a physical basic attack. */
export const starvedWolf: EnemyDef = {
  id: 'starved-wolf',
  name: 'Starved Wolf',
  level: 2,
  levelMin: 2,
  levelMax: 6,
  archetype: 'skirmisher',
  school: 'physical',
  filler: { school: 'physical' },
  traitIds: [PACK_HUNTER_TRAIT],
  skills: [pounce],
  drop: { materialId: 'hide', baseQuantity: 4 },
}

const rustedCut: EnemySkillDef = {
  id: 'rusted-cut',
  name: 'Rusted Cut',
  coefficient: 0.9,
  school: 'physical',
  cooldownSeconds: 5,
  tag: 'rusted-cut',
  tags: ['physical', 'attack'],
  canCrit: false,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 0.9 },
    { kind: 'applyStatus', statusId: 'bleed', baseChance: 0.75, coefficient: 0.1, power: 'physical' },
    { kind: 'stealSupply', chance: 0.2 },
  ],
}

const guard: EnemySkillDef = {
  id: 'guard',
  name: 'Guard',
  coefficient: 0,
  school: 'physical',
  cooldownSeconds: 7,
  tag: 'guard',
  tags: ['defense'],
  canCrit: false,
  actionTimeCoefficient: 0.75,
  effects: [{ kind: 'damageReduction', fraction: 0.3 }],
}

/** Levels 4–7. Standard. Drops 4 scrap. Rusted Cut is listed before Guard. The filler is a physical basic attack. */
export const deserter: EnemyDef = {
  id: 'deserter',
  name: 'Deserter',
  level: 4,
  levelMin: 4,
  levelMax: 7,
  archetype: 'standard',
  school: 'physical',
  filler: { school: 'physical' },
  skills: [rustedCut, guard],
  drop: { materialId: 'scrap', baseQuantity: 4 },
}

const venomBite: EnemySkillDef = {
  id: 'venom-bite',
  name: 'Venom Bite',
  coefficient: 0.85,
  school: 'physical',
  cooldownSeconds: 4,
  tag: 'venom-bite',
  tags: ['physical', 'attack'],
  canCrit: false,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 0.85 },
    { kind: 'applyStatus', statusId: 'poison', baseChance: 0.7, coefficient: 0.1, power: 'physical' },
  ],
}

const webSnare: EnemySkillDef = {
  id: 'web-snare',
  name: 'Web Snare',
  coefficient: 0,
  school: 'physical',
  cooldownSeconds: 8,
  tag: 'web-snare',
  tags: ['physical'],
  canCrit: false,
  effects: [
    {
      kind: 'chanceGate',
      baseChance: 0.8,
      school: 'physical',
      effects: [
        { kind: 'actionDelay', delaySeconds: 1 },
        { kind: 'timedEvasion', amount: -15, durationSeconds: 4 },
      ],
    },
  ],
}

/** Levels 6–10. Skirmisher. Venom Bite is listed before Web Snare. Drops 2 witherbark. The filler is a physical basic attack. */
export const blightSpider: EnemyDef = {
  id: 'blight-spider',
  name: 'Blight Spider',
  level: 6,
  levelMin: 6,
  levelMax: 10,
  archetype: 'skirmisher',
  school: 'physical',
  filler: { school: 'physical' },
  skills: [venomBite, webSnare],
  drop: { materialId: 'witherbark', baseQuantity: 2 },
}

const brambleSlam: EnemySkillDef = {
  id: 'bramble-slam',
  name: 'Bramble Slam',
  coefficient: 2.2,
  school: 'physical',
  cooldownSeconds: 9,
  telegraphMs: 1800,
  tag: 'bramble-slam',
  tags: ['physical', 'attack'],
  canCrit: false,
  interruptMaxHpFraction: 0.25,
  effects: [{ kind: 'damage', school: 'physical', coefficient: 2.2 }],
}

/** Levels 8–13. Tank. Regenerates during combat. Drops 4 hide. The filler is a physical basic attack. */
export const thornbeast: EnemyDef = {
  id: 'thornbeast',
  name: 'Thornbeast',
  level: 8,
  levelMin: 8,
  levelMax: 13,
  archetype: 'tank',
  school: 'physical',
  filler: { school: 'physical' },
  traitIds: [REGENERATION_TRAIT],
  skills: [brambleSlam],
  drop: { materialId: 'hide', baseQuantity: 4 },
}

const coldSpark: EnemySkillDef = {
  id: 'cold-spark',
  name: 'Cold Spark',
  coefficient: 1,
  school: 'magical',
  cooldownSeconds: 4,
  tag: 'cold-spark',
  tags: ['magical', 'attack'],
  canCrit: false,
  effects: [
    { kind: 'damage', school: 'magical', coefficient: 1 },
    { kind: 'applyStatus', statusId: 'chill', baseChance: 1 },
  ],
}

const fractureRay: EnemySkillDef = {
  id: 'fracture-ray',
  name: 'Fracture Ray',
  coefficient: 1.8,
  school: 'magical',
  cooldownSeconds: 9,
  telegraphMs: 2000,
  tag: 'fracture-ray',
  tags: ['magical', 'attack'],
  canCrit: true,
  effects: [{ kind: 'damage', school: 'magical', coefficient: 1.8 }],
}

/** Levels 10–22. Burst defense is replaced by 0.5× Armor and 1.5× Resistance. The filler is magical. */
export const fractureWisp: EnemyDef = {
  id: 'fracture-wisp',
  name: 'Fracture Wisp',
  level: 10,
  levelMin: 10,
  levelMax: 22,
  archetype: 'burst',
  school: 'magical',
  filler: { school: 'magical' },
  overrides: { armorMultiplier: 0.5, resistanceMultiplier: 1.5 },
  skills: [coldSpark, fractureRay],
}

const shieldWall: EnemySkillDef = {
  id: 'shield-wall',
  name: 'Shield Wall',
  coefficient: 0,
  school: 'physical',
  cooldownSeconds: 7,
  tag: 'shield-wall',
  tags: ['defense'],
  canCrit: false,
  allyTarget: 'lowestHpPercent',
  affectSelf: true,
  effects: [{ kind: 'damageReduction', fraction: 0.35 }],
}

const shieldBash: EnemySkillDef = {
  id: 'shield-bash',
  name: 'Shield Bash',
  coefficient: 2.2,
  school: 'physical',
  cooldownSeconds: 10,
  telegraphMs: 1800,
  tag: 'shield-bash',
  tags: ['physical', 'attack'],
  canCrit: false,
  interruptMaxHpFraction: 0.25,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 2.2 },
    { kind: 'applyStatus', statusId: 'stun', baseChance: 0.6 },
  ],
}

/** Levels 8–12. Tank defense is replaced by 1.75× Armor and 1.0× Resistance. Shield Wall is listed first. Drops 4 shard. */
export const hollowSentry: EnemyDef = {
  id: 'hollow-sentry',
  name: 'Hollow Sentry',
  level: 8,
  levelMin: 8,
  levelMax: 12,
  archetype: 'tank',
  school: 'physical',
  filler: { school: 'physical' },
  overrides: { armorMultiplier: 1.75, resistanceMultiplier: 1 },
  skills: [shieldWall, shieldBash],
  drop: { materialId: 'shard', baseQuantity: 4 },
}

const aimedBolt: EnemySkillDef = {
  id: 'aimed-bolt',
  name: 'Aimed Bolt',
  coefficient: 2.2,
  school: 'physical',
  cooldownSeconds: 10,
  telegraphMs: 2500,
  tag: 'aimed-bolt',
  tags: ['physical', 'attack'],
  canCrit: true,
  forcedRecovery: { id: 'reload', name: 'Reload', durationMs: 2000, evasion: -20 },
  effects: [{ kind: 'damage', school: 'physical', coefficient: 2.2 }],
}

/** Levels 11–14. Burst. Aimed Bolt is followed by Reload instead of the normal recovery. Drops 2 oathsteel. */
export const fallenArbalist: EnemyDef = {
  id: 'fallen-arbalist',
  name: 'Fallen Arbalist',
  level: 11,
  levelMin: 11,
  levelMax: 14,
  archetype: 'burst',
  school: 'physical',
  filler: { school: 'physical' },
  skills: [aimedBolt],
  drop: { materialId: 'oathsteel', baseQuantity: 2 },
}

const echoWard: EnemySkillDef = {
  id: 'echo-ward',
  name: 'Ward',
  coefficient: 0,
  school: 'magical',
  cooldownSeconds: 8,
  tag: 'ward',
  tags: ['defense'],
  canCrit: false,
  allyTarget: 'lowestBarrier',
  effects: [{ kind: 'barrier', source: 'magical', coefficient: 1, durationSeconds: 8 }],
}

const echoMend: EnemySkillDef = {
  id: 'echo-mend',
  name: 'Mend',
  coefficient: 0,
  school: 'magical',
  cooldownSeconds: 10,
  tag: 'mend',
  tags: ['healing'],
  canCrit: false,
  allyTarget: 'woundedLowestHpPercent',
  effects: [{ kind: 'heal', maxHpFraction: 0, healingCoefficient: 1.2 }],
}

const echoBolt: EnemySkillDef = {
  id: 'echo-bolt',
  name: 'Echo Bolt',
  coefficient: 0.7,
  school: 'magical',
  cooldownSeconds: 0,
  tag: 'echo-bolt',
  tags: ['magical', 'attack'],
  canCrit: false,
  effects: [{ kind: 'damage', school: 'magical', coefficient: 0.7 }],
}

/** Levels 13–22. Support defense is replaced by 0.5× Armor and 1.5× Resistance. Ward, then Mend, then Echo Bolt. */
export const oathboundEcho: EnemyDef = {
  id: 'oathbound-echo',
  name: 'Oathbound Echo',
  level: 13,
  levelMin: 13,
  levelMax: 22,
  archetype: 'support',
  school: 'magical',
  filler: { school: 'magical' },
  overrides: { armorMultiplier: 0.5, resistanceMultiplier: 1.5 },
  skills: [echoWard, echoMend, echoBolt],
}

const venomousRend: EnemySkillDef = {
  id: 'venomous-rend',
  name: 'Venomous Rend',
  coefficient: 1.2,
  school: 'physical',
  cooldownSeconds: 6,
  tag: 'venomous-rend',
  tags: ['physical', 'attack'],
  canCrit: false,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 1.2 },
    { kind: 'applyStatus', statusId: 'poison', baseChance: 0.75, coefficient: 0.1, power: 'physical' },
    { kind: 'applyStatus', statusId: 'poison', baseChance: 0.75, coefficient: 0.1, power: 'physical' },
  ],
}

const graspingRoots: EnemySkillDef = {
  id: 'grasping-roots',
  name: 'Grasping Roots',
  coefficient: 0,
  school: 'physical',
  cooldownSeconds: 10,
  telegraphMs: 2000,
  tag: 'grasping-roots',
  tags: ['physical'],
  canCrit: false,
  interruptMaxHpFraction: 0.06,
  effects: [
    { kind: 'actionDelay', delaySeconds: 2 },
    { kind: 'timedEvasion', amount: -20, durationSeconds: 6 },
  ],
}

/**
 * Level 14 elite skirmisher. The generic elite line misses HP, Power, Armor, Resistance, and action time,
 * so those are absolute overrides. Accuracy 24 and Evasion 26 already match that line. Drops 8 witherbark.
 */
export const rootmawStalker: EnemyDef = {
  id: 'rootmaw-stalker',
  name: 'Rootmaw Stalker',
  level: 14,
  archetype: 'skirmisher',
  elite: true,
  school: 'physical',
  filler: { school: 'physical' },
  overrides: {
    maxHp: 1000,
    power: 29,
    armor: 51,
    resistance: 51,
    actionTime: 2,
    consistency: 25,
  },
  traitIds: [REGENERATION_TRAIT],
  skills: [venomousRend, graspingRoots],
  drop: { materialId: 'witherbark', baseQuantity: 8 },
}

const fracturedCharge: EnemySkillDef = {
  id: 'fractured-charge',
  name: 'Fractured Charge',
  coefficient: 1.8,
  school: 'physical',
  cooldownSeconds: 8,
  telegraphMs: 2000,
  tag: 'fractured-charge',
  tags: ['physical', 'attack'],
  canCrit: true,
  effects: [{ kind: 'damage', school: 'physical', coefficient: 1.8 }],
}

const summonOathboundEcho: EnemySkillDef = {
  id: 'summon-oathbound-echo',
  name: 'Summon Oathbound Echo',
  coefficient: 0,
  school: 'magical',
  cooldownSeconds: 0,
  telegraphMs: 2000,
  tag: 'summon-echo',
  tags: ['summon'],
  canCrit: false,
  trigger: 'hp',
  hpFraction: 0.6,
  effects: [{ kind: 'summon', enemyId: 'oathbound-echo', level: 16 }],
}

/** Level 16 elite tank. The normal elite multipliers already hit the published line. Consistency is 25. Drops 8 oathsteel. */
export const echoKnight: EnemyDef = {
  id: 'echo-knight',
  name: 'Echo Knight',
  level: 16,
  archetype: 'tank',
  elite: true,
  school: 'physical',
  filler: { school: 'physical' },
  overrides: { maxHp: 3200, power: 26, consistency: 25 },
  traitIds: [STANCE_TRAIT, HP_SUMMON_TRAIT],
  skills: [fracturedCharge, summonOathboundEcho],
  drop: { materialId: 'oathsteel', baseQuantity: 8 },
}

const fractureHammer: EnemySkillDef = {
  id: 'fracture-hammer',
  name: 'Fracture Hammer',
  coefficient: 2,
  school: 'physical',
  cooldownSeconds: 8,
  telegraphMs: 2000,
  tag: 'fracture-hammer',
  tags: ['physical', 'attack'],
  canCrit: true,
  effects: [{ kind: 'damage', school: 'physical', coefficient: 2 }],
}

const wardensGuard: EnemySkillDef = {
  id: 'wardens-guard',
  name: "Warden's Guard",
  coefficient: 0,
  school: 'physical',
  cooldownSeconds: 10,
  tag: 'wardens-guard',
  tags: ['defense'],
  canCrit: false,
  phases: [1],
  effects: [{ kind: 'defenseBonus', multiplier: 1.5, durationSeconds: 4 }],
}

const riftPulse: EnemySkillDef = {
  id: 'rift-pulse',
  name: 'Rift Pulse',
  coefficient: 1.2,
  school: 'magical',
  cooldownSeconds: 6,
  telegraphMs: 1500,
  tag: 'rift-pulse',
  tags: ['magical', 'attack'],
  canCrit: false,
  phases: [3],
  effects: [
    { kind: 'damage', school: 'magical', coefficient: 1.2 },
    { kind: 'applyStatus', statusId: 'chill', baseChance: 1 },
  ],
}

const summonWardenEchoes: EnemySkillDef = {
  id: 'summon-warden-echoes',
  name: 'Summon Echoes',
  coefficient: 0,
  school: 'physical',
  cooldownSeconds: 0,
  tag: 'summon-echoes',
  tags: ['summon'],
  canCrit: false,
  trigger: 'phase',
  phase: 2,
  effects: [
    {
      kind: 'summon',
      enemyId: 'blade-echo',
      level: 20,
      fromSummoner: {
        hpFraction: 0.15,
        armorFraction: 0.75,
        resistanceFraction: 0.75,
        powerFraction: 0.7,
        actionTime: 1.65,
      },
    },
    {
      kind: 'summon',
      enemyId: 'ward-echo',
      level: 20,
      fromSummoner: {
        hpFraction: 0.15,
        armorFraction: 0.75,
        resistanceFraction: 0.75,
        powerFraction: 0.5,
        actionTime: 2.2,
      },
      anchorMaxHp: true,
    },
  ],
}

/**
 * Level 20 boss from the Standard baseline.
 * XP stays the level-20 Standard amount. Boss XP is still open in the design, so there is no boss multiplier.
 * Echo rank multiplies HP, Power, Armor, and Resistance by 1.12^R after those rank-0 stats are rounded.
 * Authored rank modifiers are not applied.
 */
export const fracturedWarden: EnemyDef = {
  id: 'fractured-warden',
  name: 'Fractured Warden',
  level: 20,
  archetype: 'standard',
  boss: true,
  echoRank: true,
  school: 'physical',
  filler: { school: 'physical', coefficient: 1 },
  overrides: {
    hpMultiplier: 7,
    powerMultiplier: 1.3,
    armorMultiplier: 1.5,
    resistanceMultiplier: 1.5,
    accuracy: 40,
    evasion: 20,
    consistency: 50,
    actionTime: 2.2,
  },
  traitIds: [BOSS_PHASES_TRAIT],
  phases: [
    { phase: 1, name: "Warden's Guard" },
    { phase: 2, name: "Warden's Echoes", atOrBelowHpFraction: 0.7 },
    {
      phase: 3,
      name: 'Shattered Warden',
      atOrBelowHpFraction: 0.35,
      pressureIntervalMs: 3000,
      pressureMaxStacks: 10,
      pressurePower: 1.1,
      pressureDefense: 0.95,
      pressureActionSpeed: 1.05,
    },
  ],
  skills: [fractureHammer, wardensGuard, riftPulse, summonWardenEchoes],
}

const severingDash: EnemySkillDef = {
  id: 'severing-dash',
  name: 'Severing Dash',
  coefficient: 1.6,
  school: 'physical',
  cooldownSeconds: 6,
  telegraphMs: 1000,
  tag: 'severing-dash',
  tags: ['physical', 'attack'],
  canCrit: true,
  effects: [{ kind: 'damage', school: 'physical', coefficient: 1.6 }],
}

/** Summoned by the Warden. Rank-0 numbers match 15% HP, 75% defense, and 70% Power of a rank-0 Warden. */
export const bladeEcho: EnemyDef = {
  id: 'blade-echo',
  name: 'Blade Echo',
  level: 20,
  archetype: 'standard',
  school: 'physical',
  filler: { school: 'physical', coefficient: 1 },
  overrides: {
    maxHp: 576,
    power: 25,
    armor: 51,
    resistance: 51,
    actionTime: 1.65,
  },
  skills: [severingDash],
}

const wardEchoWard: EnemySkillDef = {
  id: 'ward-echo-ward',
  name: 'Ward',
  coefficient: 0,
  school: 'magical',
  cooldownSeconds: 8,
  tag: 'ward',
  tags: ['defense'],
  canCrit: false,
  allyTarget: 'lowestBarrier',
  effects: [{ kind: 'barrier', source: 'anchorMaxHp', coefficient: 0.05, durationSeconds: 8 }],
}

const wardEchoMend: EnemySkillDef = {
  id: 'ward-echo-mend',
  name: 'Mend',
  coefficient: 0,
  school: 'magical',
  cooldownSeconds: 10,
  tag: 'mend',
  tags: ['healing'],
  canCrit: false,
  allyTarget: 'woundedLowestHpPercent',
  effects: [{ kind: 'heal', maxHpFraction: 0.03, healingCoefficient: 0, maxHpOf: 'anchor' }],
}

const riftBolt: EnemySkillDef = {
  id: 'rift-bolt',
  name: 'Rift Bolt',
  coefficient: 0.7,
  school: 'magical',
  cooldownSeconds: 0,
  tag: 'rift-bolt',
  tags: ['magical', 'attack'],
  canCrit: false,
  effects: [{ kind: 'damage', school: 'magical', coefficient: 0.7 }],
}

/** Summoned by the Warden. Ward and Mend use the Warden's rank-adjusted maximum HP. */
export const wardEcho: EnemyDef = {
  id: 'ward-echo',
  name: 'Ward Echo',
  level: 20,
  archetype: 'standard',
  school: 'magical',
  filler: { school: 'magical', coefficient: 1 },
  overrides: {
    maxHp: 576,
    power: 18,
    armor: 51,
    resistance: 51,
    actionTime: 2.2,
  },
  skills: [wardEchoWard, wardEchoMend, riftBolt],
}

const leechBite: EnemySkillDef = {
  id: 'leech-bite',
  name: 'Leech Bite',
  coefficient: 0.8,
  school: 'physical',
  cooldownSeconds: 4,
  tag: 'leech-bite',
  tags: ['physical', 'attack'],
  canCrit: false,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 0.8 },
    { kind: 'applyStatus', statusId: 'bleed', baseChance: 0.5, coefficient: 0.1, power: 'physical' },
  ],
}

/** Levels 17-20. Swarm, in groups of 3. Regenerates 2% maximum HP per second (twice the trait's base rate). Drops 2 hide. */
export const mireLeech: EnemyDef = {
  id: 'mire-leech',
  name: 'Mire Leech',
  level: 17,
  levelMin: 17,
  levelMax: 20,
  archetype: 'swarm',
  school: 'physical',
  filler: { school: 'physical' },
  traitIds: [REGENERATION_TRAIT],
  regenMultiplier: 2,
  skills: [leechBite],
  drop: { materialId: 'hide', baseQuantity: 2 },
}

const pilfer: EnemySkillDef = {
  id: 'pilfer',
  name: 'Pilfer',
  coefficient: 0.9,
  school: 'physical',
  cooldownSeconds: 5,
  tag: 'pilfer',
  tags: ['physical', 'attack'],
  canCrit: false,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 0.9 },
    { kind: 'stealSupply', chance: 0.35 },
  ],
}

/** Levels 17-21. Standard. Pilfer, then Guard, as the Deserter does. Drops 4 scrap. */
export const causewayRaider: EnemyDef = {
  id: 'causeway-raider',
  name: 'Causeway Raider',
  level: 17,
  levelMin: 17,
  levelMax: 21,
  archetype: 'standard',
  school: 'physical',
  filler: { school: 'physical' },
  skills: [pilfer, guard],
  drop: { materialId: 'scrap', baseQuantity: 4 },
}

const undertow: EnemySkillDef = {
  id: 'undertow',
  name: 'Undertow',
  coefficient: 2,
  school: 'physical',
  cooldownSeconds: 9,
  telegraphMs: 2200,
  tag: 'undertow',
  tags: ['physical', 'attack'],
  canCrit: false,
  interruptMaxHpFraction: 0.25,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 2 },
    { kind: 'applyStatus', statusId: 'chill', baseChance: 1 },
    { kind: 'applyStatus', statusId: 'chill', baseChance: 1 },
  ],
}

/** Levels 18-22. Tank with 1.75x Armor like the Sentry. Shield Wall is listed first. Drops 4 riftglass. */
export const drownedBulwark: EnemyDef = {
  id: 'drowned-bulwark',
  name: 'Drowned Bulwark',
  level: 18,
  levelMin: 18,
  levelMax: 22,
  archetype: 'tank',
  school: 'physical',
  filler: { school: 'physical' },
  overrides: { armorMultiplier: 1.75, resistanceMultiplier: 1 },
  skills: [shieldWall, undertow],
  drop: { materialId: 'riftglass', baseQuantity: 4 },
}

/**
 * The late elites' enrage (Step 13.5 part 8a): the Fractured Warden's per-stack numbers (every 3 s up to 10 stacks,
 * x1.1 Power, x0.95 Armor and Resistance, x1.05 action speed), starting `startMs` after the fight begins.
 */
function eliteEnrage(startMs: number): TimePressureDef {
  return { startMs, intervalMs: 3000, maxStacks: 10, power: 1.1, defense: 0.95, actionSpeed: 1.05 }
}

const breakerWave: EnemySkillDef = {
  id: 'breaker-wave',
  name: 'Breaker Wave',
  coefficient: 3,
  school: 'physical',
  cooldownSeconds: 10,
  telegraphMs: 2500,
  tag: 'breaker-wave',
  tags: ['physical', 'attack'],
  canCrit: true,
  interruptMaxHpFraction: 0.05,
  effects: [{ kind: 'damage', school: 'physical', coefficient: 3 }],
}

const summonMireLeeches: EnemySkillDef = {
  id: 'summon-mire-leeches',
  name: 'Summon Mire Leeches',
  coefficient: 0,
  school: 'physical',
  cooldownSeconds: 0,
  telegraphMs: 2000,
  tag: 'summon-leeches',
  tags: ['summon'],
  canCrit: false,
  trigger: 'hp',
  hpFraction: 0.35,
  effects: [
    { kind: 'summon', enemyId: 'mire-leech', level: 18 },
    { kind: 'summon', enemyId: 'mire-leech', level: 18 },
  ],
}

/**
 * Level 22 elite tank. Ebb is the Guard stance and Flood is the Assault stance (the stance trait keeps its
 * sim names). HP 4,000 (Step 13.5 part 5B; the first version was 3,600, about the Echo Knight x 1.12).
 */
export const tideboundColossus: EnemyDef = {
  id: 'tidebound-colossus',
  name: 'Tidebound Colossus',
  level: 22,
  archetype: 'tank',
  elite: true,
  school: 'physical',
  filler: { school: 'physical' },
  overrides: { maxHp: 4000, power: 35, consistency: 25, actionTime: 2.2 },
  timePressure: eliteEnrage(140_000),
  traitIds: [STANCE_TRAIT, HP_SUMMON_TRAIT],
  skills: [breakerWave, summonMireLeeches],
  drop: { materialId: 'riftglass', baseQuantity: 10 },
}

const shadeCut: EnemySkillDef = {
  id: 'shade-cut',
  name: 'Shade Cut',
  coefficient: 1,
  school: 'physical',
  cooldownSeconds: 4,
  tag: 'shade-cut',
  tags: ['physical', 'attack'],
  canCrit: false,
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 1 },
    { kind: 'applyStatus', statusId: 'bleed', baseChance: 0.4, coefficient: 0.1, power: 'physical' },
  ],
}

/** Levels 22-26. Skirmisher. Shade Cut bleeds. Drops 3 shard. */
export const riftShade: EnemyDef = {
  id: 'rift-shade',
  name: 'Rift Shade',
  level: 22,
  levelMin: 22,
  levelMax: 26,
  archetype: 'skirmisher',
  school: 'physical',
  filler: { school: 'physical' },
  skills: [shadeCut],
  drop: { materialId: 'shard', baseQuantity: 3 },
}

const channelerMend: EnemySkillDef = {
  id: 'channeler-mend',
  name: 'Channel',
  coefficient: 0,
  school: 'magical',
  cooldownSeconds: 10,
  tag: 'mend',
  tags: ['healing'],
  canCrit: false,
  allyTarget: 'woundedLowestHpPercent',
  effects: [{ kind: 'heal', maxHpFraction: 0.06, healingCoefficient: 0 }],
}

const channelerBolt: EnemySkillDef = {
  id: 'channeler-bolt',
  name: 'Rift Bolt',
  coefficient: 0.9,
  school: 'magical',
  cooldownSeconds: 0,
  tag: 'rift-bolt',
  tags: ['magical', 'attack'],
  canCrit: false,
  effects: [{ kind: 'damage', school: 'magical', coefficient: 0.9 }],
}

/** Levels 22-27. Support. Heals an ally for 6% of its maximum HP every 10 s, then Rift Bolt. Drops 3 riftglass. */
export const hollowChanneler: EnemyDef = {
  id: 'hollow-channeler',
  name: 'Hollow Channeler',
  level: 22,
  levelMin: 22,
  levelMax: 27,
  archetype: 'support',
  school: 'magical',
  filler: { school: 'magical' },
  overrides: { armorMultiplier: 0.5, resistanceMultiplier: 1.5 },
  skills: [channelerMend, channelerBolt],
  drop: { materialId: 'riftglass', baseQuantity: 3 },
}

const riftCleave: EnemySkillDef = {
  id: 'rift-cleave',
  name: 'Rift Cleave',
  coefficient: 2.4,
  school: 'physical',
  cooldownSeconds: 10,
  telegraphMs: 1800,
  tag: 'rift-cleave',
  tags: ['physical', 'attack'],
  canCrit: false,
  interruptMaxHpFraction: 0.25,
  effects: [{ kind: 'damage', school: 'physical', coefficient: 2.4 }],
}

/** Levels 23-28. Burst. Rift Cleave is a 1.8 s interruptible wind-up. Drops 3 duskiron. */
export const riftbornBrute: EnemyDef = {
  id: 'riftborn-brute',
  name: 'Riftborn Brute',
  level: 23,
  levelMin: 23,
  levelMax: 28,
  archetype: 'burst',
  school: 'physical',
  filler: { school: 'physical' },
  skills: [riftCleave],
  drop: { materialId: 'duskiron', baseQuantity: 3 },
}

const riftSurge: EnemySkillDef = {
  id: 'rift-surge',
  name: 'Rift Surge',
  coefficient: 4,
  school: 'magical',
  cooldownSeconds: 12,
  telegraphMs: 2500,
  tag: 'rift-surge',
  tags: ['magical', 'attack'],
  canCrit: true,
  effects: [{ kind: 'damage', school: 'magical', coefficient: 4 }],
}

/**
 * Level 26 elite burst. Rift Surge cannot be interrupted. Reaver Strike (the 100% filler) fills ordinary actions.
 * Guard and assault stances as the Echo Knight. No summons. Drops 10 duskiron.
 */
export const hollowmawReaver: EnemyDef = {
  id: 'hollowmaw-reaver',
  name: 'Hollowmaw Reaver',
  level: 26,
  archetype: 'burst',
  elite: true,
  school: 'physical',
  filler: { school: 'physical', coefficient: 1 },
  overrides: { maxHp: 4400, power: 44, consistency: 25 },
  traitIds: [STANCE_TRAIT],
  skills: [riftSurge],
  drop: { materialId: 'duskiron', baseQuantity: 10 },
}

export const enemies: { [id: string]: EnemyDef } = {
  [standardDummy.id]: standardDummy,
  [fractureShardling.id]: fractureShardling,
  [starvedWolf.id]: starvedWolf,
  [deserter.id]: deserter,
  [blightSpider.id]: blightSpider,
  [thornbeast.id]: thornbeast,
  [fractureWisp.id]: fractureWisp,
  [hollowSentry.id]: hollowSentry,
  [fallenArbalist.id]: fallenArbalist,
  [oathboundEcho.id]: oathboundEcho,
  [rootmawStalker.id]: rootmawStalker,
  [echoKnight.id]: echoKnight,
  [fracturedWarden.id]: fracturedWarden,
  [bladeEcho.id]: bladeEcho,
  [wardEcho.id]: wardEcho,
  [mireLeech.id]: mireLeech,
  [causewayRaider.id]: causewayRaider,
  [drownedBulwark.id]: drownedBulwark,
  [tideboundColossus.id]: tideboundColossus,
  [riftShade.id]: riftShade,
  [hollowChanneler.id]: hollowChanneler,
  [riftbornBrute.id]: riftbornBrute,
  [hollowmawReaver.id]: hollowmawReaver,
}
