import { describe, expect, it } from 'vitest'

import { assertEnemyDef } from '../sim/enemyAi.ts'
import { assertStatusDef } from '../sim/statuses.ts'
import { assertSkillDef, SKILL_EFFECT_KINDS } from '../sim/skills.ts'
import type { SkillDef } from '../sim/types.ts'

import { encounters } from './encounters.ts'
import {
  blightSpider,
  deserter,
  enemies,
  fallenArbalist,
  fractureShardling,
  fractureWisp,
  hollowSentry,
  bladeEcho,
  echoKnight,
  fracturedWarden,
  oathboundEcho,
  wardEcho,
  rootmawStalker,
  standardDummy,
  starvedWolf,
  thornbeast,
} from './enemies.ts'
import { referenceHeroes } from './heroes.ts'
import { scenarios } from './scenarios.ts'
import { skills } from './skills.ts'
import { statuses } from './statuses.ts'

function unique(ids: readonly string[], label: string): void {
  const seen: { [id: string]: boolean } = {}
  for (const id of ids) {
    if (seen[id] === true) throw new Error(`duplicate ${label} id '${id}'`)
    seen[id] = true
  }
}

describe('content integrity', () => {
  it('keeps unique ids and resolves every reference', () => {
    const skillIds = Object.keys(skills)
    const enemyIds = Object.keys(enemies)
    const scenarioIds = Object.keys(scenarios)
    const statusIds = Object.keys(statuses)
    console.log('[skills] content ids', {
      skills: skillIds,
      enemies: enemyIds,
      scenarios: scenarioIds,
      statuses: statusIds,
    })
    unique(skillIds, 'skill')
    unique(enemyIds, 'enemy')
    unique(scenarioIds, 'scenario')
    unique(statusIds, 'status')

    expect(statuses.bleed).toMatchObject({ maxStacks: 5, actionsPerStack: 3 })
    expect(statuses.poison).toMatchObject({ maxStacks: 5, durationSeconds: 8, tickSeconds: 2 })
    expect(statuses.burn).toMatchObject({ maxIntensity: 5, durationSeconds: 5, tickSeconds: 1 })
    expect(statuses.chill).toMatchObject({ maxStacks: 3, durationSeconds: 6, slowByStack: [0.1, 0.07, 0.05] })
    expect(statuses.stun).toMatchObject({ delaySeconds: 1.5 })
    expect(statuses.expose).toMatchObject({ durationSeconds: 8 })
    expect(statuses.mark).toMatchObject({ kind: 'mark' })
    for (const status of Object.values(statuses)) assertStatusDef(status)

    for (const id of skillIds) {
      const skill = skills[id]
      expect(skill).toBeDefined()
      if (skill === undefined) continue
      assertSkillDef(skill)
      expect(skill.id).toBe(id)
      for (const effect of skill.effects) {
        expect(SKILL_EFFECT_KINDS).toContain(effect.kind)
        if (effect.kind === 'applyStatus') {
          expect(statuses[effect.statusId], `${id} status ${effect.statusId}`).toBeDefined()
        }
      }
    }
    expect(skills['driving-blow']?.effects).toContainEqual({ kind: 'resource', base: 15 })
    expect(skills['driving-blow']?.tags).toContain('generator')
    expect(skills.cleave).toMatchObject({ cost: 25, tags: expect.arrayContaining(['spender']) })
    expect(skills['reckless-strike']).toMatchObject({
      cost: 40,
      requires: { mainHand: 'twoHanded' },
      effects: expect.arrayContaining([
        { kind: 'damage', school: 'physical', coefficient: 2.2 },
        { kind: 'incomingDamage', multiplier: 1.2 },
      ]),
    })
    expect(skills['sundering-blow']?.effects[1]).toMatchObject({
      kind: 'applyStatus',
      statusId: 'expose',
      baseChance: 1,
      armorMagnitude: 0.2,
    })
    expect(skills['arcane-bolt']).toMatchObject({ cost: 5, cooldownSeconds: 0, actionTimeCoefficient: 0.8 })
    expect(skills.fireball?.effects[1]).toMatchObject({
      kind: 'applyStatus',
      statusId: 'burn',
      coefficient: 0.12,
      power: 'magical',
    })
    expect(skills['frost-lance']?.effects[1]).toMatchObject({ kind: 'applyStatus', statusId: 'chill', baseChance: 1 })
    expect(skills['chain-lightning']?.effects[0]).toMatchObject({
      kind: 'chain',
      school: 'magical',
      coefficient: 1.2,
      decay: 0.75,
      maxTargets: 4,
      delaySeconds: 0.25,
    })
    expect(skills['arcane-recovery']?.effects[0]).toMatchObject({ kind: 'resource', base: 30 })
    expect(scenarios['mage-vs-standard']?.equippedSkillIds).not.toContain('arcane-bolt')
    expect(skills['driving-blow']).toMatchObject({
      cost: 0,
      cooldownSeconds: 3,
      actionTimeCoefficient: 1,
      target: 'single',
    })
    expect(skills['driving-blow']?.effects[0]).toMatchObject({ kind: 'damage', coefficient: 1.1 })
    expect(skills.cleave).toMatchObject({
      cost: 25,
      cooldownSeconds: 5,
      actionTimeCoefficient: 1.15,
      target: 'all',
    })
    expect(skills.cleave?.effects[0]).toMatchObject({ kind: 'damage', coefficient: 0.8 })
    expect(skills['reckless-strike']).toMatchObject({
      cooldownSeconds: 8,
      actionTimeCoefficient: 1.35,
      target: 'single',
    })
    expect(skills['shield-brace']).toMatchObject({
      cost: 0,
      cooldownSeconds: 8,
      actionTimeCoefficient: 0.75,
      requires: { offHand: 'shield' },
      effects: [{ kind: 'damageReduction', fraction: 0.3 }],
    })
    expect(skills['shield-brace']?.tags).not.toContain('generator')
    expect(skills['second-wind']).toMatchObject({
      cost: 50,
      cooldownSeconds: 15,
      actionTimeCoefficient: 1,
      tags: expect.arrayContaining(['spender']),
      effects: [{ kind: 'heal', maxHpFraction: 0.15, healingCoefficient: 0.5 }],
    })
    expect(skills['sundering-blow']).toMatchObject({
      cost: 20,
      cooldownSeconds: 6,
      actionTimeCoefficient: 1,
    })
    expect(skills['sundering-blow']?.effects[0]).toMatchObject({ kind: 'damage', coefficient: 1.25 })
    expect(skills.fireball).toMatchObject({
      cost: 30,
      cooldownSeconds: 6,
      actionTimeCoefficient: 1.2,
      target: 'all',
    })
    expect(skills.fireball?.effects[0]).toMatchObject({ kind: 'damage', school: 'magical', coefficient: 1 })
    expect(skills['frost-lance']).toMatchObject({
      cost: 20,
      cooldownSeconds: 4,
      actionTimeCoefficient: 1,
    })
    expect(skills['frost-lance']?.effects[0]).toMatchObject({ kind: 'damage', coefficient: 1.1 })
    expect(skills['chain-lightning']).toMatchObject({ cost: 25, cooldownSeconds: 6, actionTimeCoefficient: 1.1 })
    expect(skills['mana-ward']).toMatchObject({
      cost: 30,
      cooldownSeconds: 10,
      actionTimeCoefficient: 0.75,
      effects: [{ kind: 'barrier', source: 'magical', coefficient: 1, durationSeconds: 8 }],
    })
    expect(skills['arcane-recovery']).toMatchObject({ cost: 0, cooldownSeconds: 10, actionTimeCoefficient: 1 })
    expect(skills['arcane-bolt']?.effects[0]).toMatchObject({ kind: 'damage', school: 'magical', coefficient: 0.9 })

    const venom = skills['venom-edge']
    expect(venom?.effects[0]).toMatchObject({ kind: 'damage', school: 'physical', coefficient: 0.9 })
    expect(venom?.effects[1]).toMatchObject({
      kind: 'applyStatus',
      statusId: 'poison',
      baseChance: 1,
      coefficient: 0.12,
      power: 'physical',
    })
    expect(venom).toMatchObject({ cost: 0, cooldownSeconds: 4, actionTimeCoefficient: 0.9 })
    expect(skills['smoke-step']).toMatchObject({
      cost: 0,
      cooldownSeconds: 8,
      actionTimeCoefficient: 0.5,
      effects: [{ kind: 'evasion', amount: 30 }],
    })
    expect(skills['mark-for-death']).toMatchObject({
      cost: 0,
      cooldownSeconds: 6,
      actionTimeCoefficient: 0.5,
      effects: [{ kind: 'applyStatus', statusId: 'mark', baseChance: 1, durationSeconds: 8 }],
    })
    expect(skills['shadow-cut']).toMatchObject({
      cost: 0,
      cooldownSeconds: 3,
      actionTimeCoefficient: 0.8,
      tags: expect.arrayContaining(['markExploit']),
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1.1 }],
    })
    expect(skills['fan-of-knives']).toMatchObject({
      cost: 0,
      cooldownSeconds: 6,
      actionTimeCoefficient: 1.1,
      target: 'all',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 0.7 }],
    })
    expect(skills['fan-of-knives']?.effects.some((effect) => effect.kind === 'applyStatus')).toBe(false)
    expect(skills.execute).toMatchObject({
      cost: 0,
      cooldownSeconds: 8,
      actionTimeCoefficient: 1.1,
      tags: expect.arrayContaining(['execute']),
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    expect(skills['hunters-mark']).toMatchObject({
      cost: 0,
      cooldownSeconds: 5,
      actionTimeCoefficient: 0.5,
      effects: [{ kind: 'reveal' }],
    })
    expect(skills['aimed-shot']).toMatchObject({
      cost: 40,
      cooldownSeconds: 5,
      actionTimeCoefficient: 1.2,
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1.8 }],
    })
    expect(skills.volley).toMatchObject({
      cost: 30,
      cooldownSeconds: 6,
      actionTimeCoefficient: 1.2,
      target: 'all',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 0.65 }],
    })
    expect(skills['snare-trap']).toMatchObject({
      cost: 25,
      cooldownSeconds: 8,
      actionTimeCoefficient: 1,
      tags: expect.arrayContaining(['physical']),
      effects: [{ kind: 'armTrap', baseChance: 0.75 }],
    })
    expect(skills['piercing-arrow']).toMatchObject({
      cost: 20,
      cooldownSeconds: 5,
      actionTimeCoefficient: 1,
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1.3, armorPenetrationBonus: 0.3 }],
    })
    expect(skills.smite).toMatchObject({
      cost: 0,
      cooldownSeconds: 3,
      actionTimeCoefficient: 1,
      effects: [{ kind: 'damage', school: 'magical', coefficient: 1 }],
    })
    expect(skills.mend).toMatchObject({
      cost: 25,
      cooldownSeconds: 5,
      actionTimeCoefficient: 1,
      effects: [{ kind: 'heal', maxHpFraction: 0, healingCoefficient: 1.2 }],
    })
    expect(skills.ward).toMatchObject({
      cost: 30,
      cooldownSeconds: 10,
      actionTimeCoefficient: 0.75,
      effects: [{ kind: 'barrier', source: 'healing', coefficient: 1.5, durationSeconds: 8 }],
    })
    expect(skills.consecration).toMatchObject({
      cost: 40,
      cooldownSeconds: 15,
      actionTimeCoefficient: 1.2,
      effects: [
        {
          kind: 'field',
          durationSeconds: 8,
          tickSeconds: 2,
          damageSchool: 'magical',
          damageCoefficient: 0.35,
          healCoefficient: 0.25,
        },
      ],
    })
    expect(skills.judgment).toMatchObject({
      cost: 50,
      cooldownSeconds: 10,
      actionTimeCoefficient: 1.2,
      effects: [{ kind: 'damage', school: 'magical', coefficient: 2 }],
    })
    expect(skills.penance).toMatchObject({
      cost: 0,
      cooldownSeconds: 10,
      actionTimeCoefficient: 1,
      effects: [
        { kind: 'loseHp', maxHpFraction: 0.1, preventFatal: true },
        { kind: 'resource', base: 25 },
      ],
    })
    expect(scenarios['cleric-vs-standard']?.vow).toBe('zeal')
    expect(scenarios['cleric-vs-standard']?.equippedSkillIds).toEqual(['smite', 'mend', 'ward', 'judgment'])

    for (const enemy of Object.values(enemies)) assertEnemyDef(enemy)
    expect(standardDummy).toMatchObject({
      id: 'dummy-standard-20',
      level: 20,
      archetype: 'standard',
      school: 'physical',
      filler: { school: 'physical' },
    })
    expect(standardDummy.skills ?? []).toEqual([])
    expect(standardDummy.traitIds ?? []).toEqual([])
    expect(fractureShardling).toMatchObject({
      levelMin: 1,
      levelMax: 5,
      archetype: 'swarm',
      traitIds: ['fracture-burst'],
      filler: { school: 'physical' },
    })
    expect(fractureShardling.skills?.[0]).toMatchObject({
      id: 'fracture-burst',
      coefficient: 0.4,
      school: 'magical',
      telegraphMs: 1000,
      tag: 'fracture-burst',
      canCrit: false,
      trigger: 'death',
    })
    expect(starvedWolf).toMatchObject({
      levelMin: 2,
      levelMax: 6,
      archetype: 'skirmisher',
      traitIds: ['pack-hunter'],
      filler: { school: 'physical' },
    })
    expect(starvedWolf.skills?.[0]).toMatchObject({
      id: 'pounce',
      coefficient: 1.6,
      telegraphMs: 1500,
      tag: 'pounce',
      canCrit: true,
      cooldownSeconds: 7,
    })
    expect(deserter.skills?.map((skill) => skill.id)).toEqual(['rusted-cut', 'guard'])
    expect(deserter).toMatchObject({ levelMin: 4, levelMax: 7, archetype: 'standard', filler: { school: 'physical' } })
    expect(deserter.skills?.[0]).toMatchObject({
      coefficient: 0.9,
      cooldownSeconds: 5,
      effects: expect.arrayContaining([
        { kind: 'applyStatus', statusId: 'bleed', baseChance: 0.75, coefficient: 0.1, power: 'physical' },
      ]),
    })
    expect(deserter.skills?.[1]).toMatchObject({
      cooldownSeconds: 7,
      actionTimeCoefficient: 0.75,
      effects: [{ kind: 'damageReduction', fraction: 0.3 }],
    })
    expect(deserter.skills?.[1]?.telegraphMs).toBeUndefined()
    expect(blightSpider).toMatchObject({
      levelMin: 6,
      levelMax: 10,
      archetype: 'skirmisher',
      filler: { school: 'physical' },
    })
    expect(blightSpider.skills?.map((skill) => skill.id)).toEqual(['venom-bite', 'web-snare'])
    expect(blightSpider.skills?.[0]).toMatchObject({
      coefficient: 0.85,
      cooldownSeconds: 4,
      effects: expect.arrayContaining([
        { kind: 'applyStatus', statusId: 'poison', baseChance: 0.7, coefficient: 0.1, power: 'physical' },
      ]),
    })
    expect(blightSpider.skills?.[1]?.effects[0]).toMatchObject({
      kind: 'chanceGate',
      baseChance: 0.8,
      school: 'physical',
    })
    expect(thornbeast).toMatchObject({
      levelMin: 8,
      levelMax: 13,
      archetype: 'tank',
      traitIds: ['regeneration'],
      filler: { school: 'physical' },
    })
    expect(thornbeast.skills?.[0]).toMatchObject({
      id: 'bramble-slam',
      coefficient: 1.4,
      telegraphMs: 1000,
      canCrit: false,
      cooldownSeconds: 6,
    })
    expect(fractureWisp).toMatchObject({
      levelMin: 10,
      levelMax: 14,
      archetype: 'burst',
      filler: { school: 'magical' },
      overrides: { armorMultiplier: 0.5, resistanceMultiplier: 1.5 },
    })
    expect(fractureWisp.skills?.map((skill) => skill.id)).toEqual(['cold-spark', 'fracture-ray'])
    expect(fractureWisp.skills?.[1]).toMatchObject({
      coefficient: 1.8,
      telegraphMs: 2000,
      canCrit: true,
      cooldownSeconds: 9,
    })
    expect(hollowSentry).toMatchObject({
      levelMin: 8,
      levelMax: 12,
      archetype: 'tank',
      filler: { school: 'physical' },
      overrides: { armorMultiplier: 1.75, resistanceMultiplier: 1 },
    })
    expect(hollowSentry.skills?.map((skill) => skill.id)).toEqual(['shield-wall', 'shield-bash'])
    expect(hollowSentry.skills?.[0]).toMatchObject({
      allyTarget: 'lowestHpPercent',
      affectSelf: true,
      cooldownSeconds: 7,
      effects: [{ kind: 'damageReduction', fraction: 0.35 }],
    })
    expect(fallenArbalist.skills?.[0]).toMatchObject({
      id: 'aimed-bolt',
      coefficient: 2.2,
      telegraphMs: 2500,
      canCrit: true,
      cooldownSeconds: 10,
      forcedRecovery: { id: 'reload', name: 'Reload', durationMs: 2000, evasion: -20 },
    })
    expect(fallenArbalist).toMatchObject({
      levelMin: 11,
      levelMax: 14,
      archetype: 'burst',
      filler: { school: 'physical' },
    })
    expect(oathboundEcho.skills?.map((skill) => skill.id)).toEqual(['echo-ward', 'echo-mend', 'echo-bolt'])
    expect(oathboundEcho).toMatchObject({
      levelMin: 13,
      levelMax: 16,
      archetype: 'support',
      filler: { school: 'magical' },
      overrides: { armorMultiplier: 0.5, resistanceMultiplier: 1.5 },
    })
    expect(oathboundEcho.skills?.[2]).toMatchObject({ coefficient: 0.7, school: 'magical', cooldownSeconds: 0 })
    expect(rootmawStalker).toMatchObject({
      level: 14,
      archetype: 'skirmisher',
      elite: true,
      traitIds: ['regeneration'],
      filler: { school: 'physical' },
      overrides: { maxHp: 1350, power: 29, armor: 51, resistance: 51, actionTime: 2, consistency: 25 },
    })
    expect(rootmawStalker.skills?.map((skill) => skill.id)).toEqual(['venomous-rend', 'grasping-roots'])
    expect(rootmawStalker.skills?.[0]?.effects.filter((effect) => effect.kind === 'applyStatus')).toEqual([
      { kind: 'applyStatus', statusId: 'poison', baseChance: 0.75, coefficient: 0.1, power: 'physical' },
      { kind: 'applyStatus', statusId: 'poison', baseChance: 0.75, coefficient: 0.1, power: 'physical' },
    ])
    expect(rootmawStalker.skills?.[1]).toMatchObject({
      telegraphMs: 2000,
      cooldownSeconds: 10,
      interruptMaxHpFraction: 0.1,
      coefficient: 0,
    })
    expect(echoKnight).toMatchObject({
      level: 16,
      archetype: 'tank',
      elite: true,
      traitIds: ['stance-cycle', 'hp-summon'],
      filler: { school: 'physical' },
      overrides: { consistency: 25 },
    })
    expect(echoKnight.skills?.map((skill) => skill.id)).toEqual(['fractured-charge', 'summon-oathbound-echo'])
    expect(echoKnight.skills?.[0]).toMatchObject({
      coefficient: 1.8,
      telegraphMs: 1500,
      canCrit: true,
      cooldownSeconds: 8,
    })
    expect(fracturedWarden).toMatchObject({
      level: 20,
      archetype: 'standard',
      boss: true,
      echoRank: true,
      traitIds: ['boss-phases'],
      filler: { school: 'physical', coefficient: 1 },
      overrides: {
        hpMultiplier: 8,
        powerMultiplier: 1.3,
        armorMultiplier: 1.5,
        resistanceMultiplier: 1.5,
        accuracy: 40,
        evasion: 20,
        consistency: 50,
        actionTime: 2.2,
      },
    })
    expect(fracturedWarden.skills?.map((skill) => skill.id)).toEqual([
      'fracture-hammer',
      'wardens-guard',
      'rift-pulse',
      'summon-warden-echoes',
    ])
    expect(fracturedWarden.skills?.[0]).toMatchObject({
      coefficient: 2,
      telegraphMs: 2000,
      canCrit: true,
      cooldownSeconds: 8,
    })
    expect(fracturedWarden.skills?.[1]).toMatchObject({
      phases: [1],
      cooldownSeconds: 10,
      effects: [{ kind: 'defenseBonus', multiplier: 1.5, durationSeconds: 4 }],
    })
    expect(fracturedWarden.skills?.[2]).toMatchObject({
      phases: [3],
      coefficient: 1.2,
      school: 'magical',
      telegraphMs: 1500,
      cooldownSeconds: 6,
      effects: [
        { kind: 'damage', school: 'magical', coefficient: 1.2 },
        { kind: 'applyStatus', statusId: 'chill', baseChance: 1 },
      ],
    })
    expect(bladeEcho.skills?.[0]).toMatchObject({
      coefficient: 1.6,
      telegraphMs: 1000,
      canCrit: true,
      cooldownSeconds: 6,
    })
    expect(wardEcho.skills?.map((skill) => skill.id)).toEqual(['ward-echo-ward', 'ward-echo-mend', 'rift-bolt'])
    expect(wardEcho.skills?.[0]).toMatchObject({
      allyTarget: 'lowestBarrier',
      cooldownSeconds: 8,
      effects: [{ kind: 'barrier', source: 'anchorMaxHp', coefficient: 0.05, durationSeconds: 8 }],
    })
    expect(wardEcho.skills?.[1]).toMatchObject({
      allyTarget: 'woundedLowestHpPercent',
      cooldownSeconds: 10,
      effects: [{ kind: 'heal', maxHpFraction: 0.03, healingCoefficient: 0, maxHpOf: 'anchor' }],
    })
    expect(wardEcho.skills?.[2]).toMatchObject({ coefficient: 0.7, school: 'magical', cooldownSeconds: 0 })
    expect(scenarios['warrior-vs-warden']?.equippedSkillIds).toBeUndefined()
    expect(scenarios['warrior-vs-warden']?.enemies).toEqual([{ defId: 'fractured-warden', slot: 0 }])
    expect(echoKnight.skills?.[1]).toMatchObject({
      trigger: 'hp',
      hpFraction: 0.6,
      telegraphMs: 2000,
      effects: [{ kind: 'summon', enemyId: 'oathbound-echo', level: 16 }],
    })
    expect(encounters['wolf-pair']?.members).toEqual([
      { enemyId: 'starved-wolf', slot: 0, level: 6 },
      { enemyId: 'starved-wolf', slot: 1, level: 6 },
    ])
    expect(encounters['grove-mixed']?.members).toEqual([
      { enemyId: 'thornbeast', slot: 0, level: 10 },
      { enemyId: 'blight-spider', slot: 1, level: 10 },
    ])
    expect(encounters['bastion-mixed']?.members).toEqual([
      { enemyId: 'hollow-sentry', slot: 0, level: 12 },
      { enemyId: 'fallen-arbalist', slot: 1, level: 12 },
    ])
    for (const encounter of Object.values(encounters)) {
      for (const member of encounter.members) {
        expect(enemies[member.enemyId], `${encounter.id} ${member.enemyId}`).toBeDefined()
      }
    }
    expect(scenarios['warrior-vs-wolf-pair']?.equippedSkillIds).toBeUndefined()
    expect(scenarios['warrior-vs-wolf-pair']?.enemies).toEqual([
      { defId: 'starved-wolf', slot: 0, level: 6 },
      { defId: 'starved-wolf', slot: 1, level: 6 },
    ])
    expect(scenarios['grove-mixed']?.equippedSkillIds).toBeUndefined()
    expect(scenarios['grove-mixed']?.enemies).toEqual([
      { defId: 'thornbeast', slot: 0, level: 10 },
      { defId: 'blight-spider', slot: 1, level: 10 },
    ])
    expect(scenarios['bastion-mixed']?.equippedSkillIds).toBeUndefined()
    expect(scenarios['bastion-mixed']?.enemies).toEqual([
      { defId: 'hollow-sentry', slot: 0, level: 12 },
      { defId: 'fallen-arbalist', slot: 1, level: 12 },
    ])
    expect(scenarios.rootmaw?.equippedSkillIds).toBeUndefined()
    expect(scenarios.rootmaw?.enemies).toEqual([{ defId: 'rootmaw-stalker', slot: 0 }])
    expect(scenarios['echo-knight']?.equippedSkillIds).toBeUndefined()
    expect(scenarios['echo-knight']?.enemies).toEqual([{ defId: 'echo-knight', slot: 0 }])

    expect(skills['flame-arrow']).toMatchObject({
      cost: 20,
      ammoCost: 1,
      cooldownSeconds: 6,
      actionTimeCoefficient: 1,
      effects: [
        { kind: 'damage', school: 'magical', coefficient: 1, power: 'physical' },
        { kind: 'applyStatus', statusId: 'burn', baseChance: 1, coefficient: 0.1, power: 'physical' },
      ],
    })

    const heroIds = Object.values(referenceHeroes).map((hero) => hero.id)
    for (const scenario of Object.values(scenarios)) {
      expect(heroIds).toContain(scenario.heroId)
      for (const enemy of scenario.enemies) {
        expect(enemies[enemy.defId], `${scenario.id} enemy ${enemy.defId}`).toBeDefined()
      }
      for (const skillId of scenario.equippedSkillIds ?? []) {
        expect(skills[skillId], `${scenario.id} equipped ${skillId}`).toBeDefined()
      }
      for (const row of scenario.priorityRows ?? []) {
        expect(skills[row.skillId], `${scenario.id} row ${row.skillId}`).toBeDefined()
      }
    }
  })

  it('rejects an unknown effect kind instead of ignoring it', () => {
    const bad = {
      id: 'bad-skill',
      name: 'Bad Skill',
      cost: 0,
      cooldownSeconds: 0,
      actionTimeCoefficient: 1,
      tags: ['test'],
      target: 'single',
      effects: [{ kind: 'poison', stacks: 1 }],
    } as unknown as SkillDef
    console.log('[skills] unknown effect input', bad.effects)
    expect(() => assertSkillDef(bad)).toThrow(/unknown effect kind 'poison'/)
  })
})
