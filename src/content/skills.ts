import { FURY_GENERATOR_TAG, FURY_SPENDER_TAG } from '../sim/classes/warrior.ts'
import type { SkillDef } from '../sim/types.ts'

// Venom Edge has no listed resource cost. Its status chance is 100% before the application clamp.
// Driving Blow's 15 Fury is the ordinary 5 plus 10. The web node that raises it to 20 is not applied.

const drivingBlow = {
  id: 'driving-blow',
  name: 'Driving Blow',
  cost: 0,
  cooldownSeconds: 3,
  actionTimeCoefficient: 1,
  tags: ['physical', 'attack', FURY_GENERATOR_TAG],
  target: 'single',
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 1.1 },
    { kind: 'resource', base: 15 },
  ],
} satisfies SkillDef

const cleave = {
  id: 'cleave',
  name: 'Cleave',
  cost: 25,
  cooldownSeconds: 5,
  actionTimeCoefficient: 1.15,
  tags: ['physical', 'attack', FURY_SPENDER_TAG],
  target: 'all',
  effects: [{ kind: 'damage', school: 'physical', coefficient: 0.8 }],
} satisfies SkillDef

const recklessStrike = {
  id: 'reckless-strike',
  name: 'Reckless Strike',
  cost: 40,
  cooldownSeconds: 8,
  actionTimeCoefficient: 1.35,
  tags: ['physical', 'attack', FURY_SPENDER_TAG],
  requires: { mainHand: 'twoHanded' },
  target: 'single',
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 2.2 },
    { kind: 'incomingDamage', multiplier: 1.2 },
  ],
} satisfies SkillDef

const shieldBrace = {
  id: 'shield-brace',
  name: 'Shield Brace',
  cost: 0,
  cooldownSeconds: 8,
  actionTimeCoefficient: 0.75,
  tags: ['defense'],
  requires: { offHand: 'shield' },
  target: 'single',
  effects: [{ kind: 'damageReduction', fraction: 0.3 }],
} satisfies SkillDef

const secondWind = {
  id: 'second-wind',
  name: 'Second Wind',
  cost: 50,
  cooldownSeconds: 15,
  actionTimeCoefficient: 1,
  tags: ['heal', FURY_SPENDER_TAG],
  target: 'single',
  effects: [{ kind: 'heal', maxHpFraction: 0.15, healingCoefficient: 0.5 }],
} satisfies SkillDef

const sunderingBlow = {
  id: 'sundering-blow',
  name: 'Sundering Blow',
  cost: 20,
  cooldownSeconds: 6,
  actionTimeCoefficient: 1,
  tags: ['physical', 'attack', FURY_SPENDER_TAG],
  target: 'single',
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 1.25 },
    { kind: 'applyStatus', statusId: 'expose', baseChance: 1, armorMagnitude: 0.2 },
  ],
} satisfies SkillDef

const smokeStep = {
  id: 'smoke-step',
  name: 'Smoke Step',
  cost: 0,
  cooldownSeconds: 8,
  actionTimeCoefficient: 0.5,
  tags: ['defense'],
  target: 'single',
  effects: [{ kind: 'evasion', amount: 30 }],
} satisfies SkillDef

const venomEdge = {
  id: 'venom-edge',
  name: 'Venom Edge',
  cost: 0,
  cooldownSeconds: 4,
  actionTimeCoefficient: 0.9,
  tags: ['physical', 'attack'],
  target: 'single',
  effects: [
    { kind: 'damage', school: 'physical', coefficient: 0.9 },
    { kind: 'applyStatus', statusId: 'poison', baseChance: 1, coefficient: 0.12, power: 'physical' },
  ],
} satisfies SkillDef

const fanOfKnives = {
  id: 'fan-of-knives',
  name: 'Fan of Knives',
  cost: 0,
  cooldownSeconds: 6,
  actionTimeCoefficient: 1.1,
  tags: ['physical', 'attack'],
  target: 'all',
  effects: [{ kind: 'damage', school: 'physical', coefficient: 0.7 }],
} satisfies SkillDef

const aimedShot = {
  id: 'aimed-shot',
  name: 'Aimed Shot',
  cost: 40,
  cooldownSeconds: 5,
  actionTimeCoefficient: 1.2,
  tags: ['physical', 'attack'],
  target: 'single',
  effects: [{ kind: 'damage', school: 'physical', coefficient: 1.8 }],
} satisfies SkillDef

const volley = {
  id: 'volley',
  name: 'Volley',
  cost: 30,
  cooldownSeconds: 6,
  actionTimeCoefficient: 1.2,
  tags: ['physical', 'attack'],
  target: 'all',
  effects: [{ kind: 'damage', school: 'physical', coefficient: 0.65 }],
} satisfies SkillDef

const arcaneBolt = {
  id: 'arcane-bolt',
  name: 'Arcane Bolt',
  cost: 5,
  cooldownSeconds: 0,
  actionTimeCoefficient: 0.8,
  tags: ['magical', 'arcane', 'attack'],
  target: 'single',
  effects: [{ kind: 'damage', school: 'magical', coefficient: 0.9 }],
} satisfies SkillDef

const fireball = {
  id: 'fireball',
  name: 'Fireball',
  cost: 30,
  cooldownSeconds: 6,
  actionTimeCoefficient: 1.2,
  tags: ['magical', 'fire', 'attack'],
  target: 'all',
  effects: [
    { kind: 'damage', school: 'magical', coefficient: 1 },
    { kind: 'applyStatus', statusId: 'burn', baseChance: 1, coefficient: 0.12, power: 'magical' },
  ],
} satisfies SkillDef

const frostLance = {
  id: 'frost-lance',
  name: 'Frost Lance',
  cost: 20,
  cooldownSeconds: 4,
  actionTimeCoefficient: 1,
  tags: ['magical', 'frost', 'attack'],
  target: 'single',
  effects: [
    { kind: 'damage', school: 'magical', coefficient: 1.1 },
    { kind: 'applyStatus', statusId: 'chill', baseChance: 1 },
  ],
} satisfies SkillDef

const chainLightning = {
  id: 'chain-lightning',
  name: 'Chain Lightning',
  cost: 25,
  cooldownSeconds: 6,
  actionTimeCoefficient: 1.1,
  tags: ['magical', 'lightning', 'attack'],
  target: 'single',
  effects: [{ kind: 'chain', school: 'magical', coefficient: 1.2, decay: 0.75, maxTargets: 4, delaySeconds: 0.25 }],
} satisfies SkillDef

const manaWard = {
  id: 'mana-ward',
  name: 'Mana Ward',
  cost: 30,
  cooldownSeconds: 10,
  actionTimeCoefficient: 0.75,
  tags: ['defense', 'magical', 'arcane'],
  target: 'single',
  effects: [{ kind: 'barrier', source: 'magical', coefficient: 1, durationSeconds: 8 }],
} satisfies SkillDef

const arcaneRecovery = {
  id: 'arcane-recovery',
  name: 'Arcane Recovery',
  cost: 0,
  cooldownSeconds: 10,
  actionTimeCoefficient: 1,
  tags: ['arcane', 'recovery'],
  target: 'single',
  effects: [{ kind: 'resource', base: 30 }],
} satisfies SkillDef

const smite = {
  id: 'smite',
  name: 'Smite',
  cost: 0,
  cooldownSeconds: 3,
  actionTimeCoefficient: 1,
  tags: ['magical', 'attack'],
  target: 'single',
  effects: [{ kind: 'damage', school: 'magical', coefficient: 1 }],
} satisfies SkillDef

const mend = {
  id: 'mend',
  name: 'Mend',
  cost: 25,
  cooldownSeconds: 5,
  actionTimeCoefficient: 1,
  tags: ['heal'],
  target: 'single',
  effects: [{ kind: 'heal', maxHpFraction: 0, healingCoefficient: 1.2 }],
} satisfies SkillDef

const ward = {
  id: 'ward',
  name: 'Ward',
  cost: 30,
  cooldownSeconds: 10,
  actionTimeCoefficient: 0.75,
  tags: ['defense'],
  target: 'single',
  effects: [{ kind: 'barrier', source: 'healing', coefficient: 1.5, durationSeconds: 8 }],
} satisfies SkillDef

const judgment = {
  id: 'judgment',
  name: 'Judgment',
  cost: 50,
  cooldownSeconds: 10,
  actionTimeCoefficient: 1.2,
  tags: ['magical', 'attack'],
  target: 'single',
  effects: [{ kind: 'damage', school: 'magical', coefficient: 2 }],
} satisfies SkillDef

export const skills: { [id: string]: SkillDef } = {
  [drivingBlow.id]: drivingBlow,
  [cleave.id]: cleave,
  [recklessStrike.id]: recklessStrike,
  [shieldBrace.id]: shieldBrace,
  [secondWind.id]: secondWind,
  [sunderingBlow.id]: sunderingBlow,
  [smokeStep.id]: smokeStep,
  [venomEdge.id]: venomEdge,
  [fanOfKnives.id]: fanOfKnives,
  [aimedShot.id]: aimedShot,
  [volley.id]: volley,
  [arcaneBolt.id]: arcaneBolt,
  [fireball.id]: fireball,
  [frostLance.id]: frostLance,
  [chainLightning.id]: chainLightning,
  [manaWard.id]: manaWard,
  [arcaneRecovery.id]: arcaneRecovery,
  [smite.id]: smite,
  [mend.id]: mend,
  [ward.id]: ward,
  [judgment.id]: judgment,
}
