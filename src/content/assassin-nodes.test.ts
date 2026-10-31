import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { assassinClass } from '../sim/classes/assassin.ts'
import {
  EXECUTE_TAG,
  NODE_AMBUSH,
  NODE_DEATH_SENTENCE,
  NODE_ELUSIVE_FOOTWORK,
  NODE_EXPLOIT_WEAKNESS,
  NODE_GHOST,
  NODE_POTENT_TOXINS,
  NODE_RELENTLESS,
  NODE_SHADOW_CUT,
  NODE_TOXIC_OPPORTUNITY,
  NODE_TOXIC_SOVEREIGN,
  executeCoefficient,
} from '../sim/classes/assassin.ts'
import { spiritResourceFactor } from '../sim/classes/resources.ts'
import { tryApplyStatus } from '../sim/statuses.ts'
import { allocateNode, createProgress, grantLegacySkillPoint, setLoadout } from '../sim/progression.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef, StatusSnapshot } from '../sim/types.ts'

import { skills } from './skills.ts'
import { statuses } from './statuses.ts'
import { assassinWeb } from './webs/assassin.ts'

const ITEM_LEVEL = 20
const QUALITY = 1
const HUMAN = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }

function nodeId(name: string): string {
  const node = assassinWeb.nodes.find((entry) => entry.name === name)
  if (node === undefined) throw new Error(`missing assassin node ${name}`)
  return node.id
}

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-light-${slot}`, slot, category: 'light' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function assassinSetup(options?: {
  nodes?: readonly string[]
  spirit?: number
  equipped?: readonly string[]
  rows?: CombatSetup['hero']['priorityRows']
  enemies?: CombatSetup['enemies']
}): CombatSetup {
  return {
    hero: {
      id: 'ref-human-assassin',
      name: 'Assassin',
      level: 20,
      classId: 'assassin',
      attributes: { strength: 18, vitality: 16, agility: 30, intellect: 14, spirit: options?.spirit ?? 10 },
      gear: {
        mainHand: { id: 'ref-dagger', kind: 'dagger', itemLevel: ITEM_LEVEL, quality: QUALITY },
        offHand: { id: 'ref-offhand-dagger', kind: 'dagger', itemLevel: ITEM_LEVEL, quality: QUALITY },
        head: armor('head'),
        chest: armor('chest'),
        hands: armor('hands'),
        feet: armor('feet'),
        accessories: [
          { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
          { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
        ],
      },
      equippedSkillIds: options?.equipped,
      priorityRows: options?.rows,
      allocatedNodeIds: options?.nodes,
    },
    enemies: options?.enemies ?? [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}, id = 'dummy', name = 'Dummy', boss = false): EnemyDef {
  return {
    id,
    name,
    level: 20,
    archetype: 'standard',
    school: 'physical',
    ...(boss ? { boss: true } : {}),
    overrides,
  }
}

function defsFor(enemies: readonly EnemyDef[]): GameDefs {
  const book: GameDefs['enemies'] = {}
  for (const enemy of enemies) book[enemy.id] = enemy
  return { enemies: book, skills, statuses }
}

function until(state: CombatState, defs: GameDefs, seen: (state: CombatState) => boolean): void {
  let steps = 0
  while (state.outcome === 'ongoing' && !seen(state)) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 20_000) throw new Error('combat did not reach the expected event')
  }
}

function skillActions(state: CombatState, skillId: string) {
  return state.log.filter((event) => event.type === 'action' && event.skillId === skillId)
}

function resources(state: CombatState, reason: string) {
  return state.log.filter((event) => event.type === 'resource' && event.reason === reason)
}

function authored(id: string): SkillDef {
  const skill = skills[id]
  if (skill === undefined) throw new Error(`missing skill ${id}`)
  return skill
}

function learned(names: readonly string[]) {
  let progress = createProgress('human', HUMAN)
  for (let index = 0; index < names.length; index += 1) progress = grantLegacySkillPoint(progress)
  for (const name of names) progress = allocateNode(progress, assassinWeb, nodeId(name))
  return progress
}

function open(options: {
  nodes?: readonly string[]
  spirit?: number
  equipped?: readonly string[]
  rows?: CombatSetup['hero']['priorityRows']
  enemies?: EnemyDef[]
  seed?: number
}) {
  const enemies = options.enemies ?? [dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 })]
  const defs = defsFor(enemies)
  const state = createCombat(
    assassinSetup({
      nodes: options.nodes,
      spirit: options.spirit,
      equipped: options.equipped,
      rows: options.rows,
      enemies: enemies.map((enemy, index) => ({ defId: enemy.id, slot: index })),
    }),
    defs,
    options.seed ?? 1,
  )
  return { state, defs }
}

function useSkill(state: CombatState, defs: GameDefs, skillId: string): void {
  const before = skillActions(state, skillId).length
  state.hero.priorityRows = [{ skillId }]
  delete state.hero.cooldowns[skillId]
  state.hero.nextReadyMs = state.timeMs + 10
  let steps = 0
  while (state.outcome === 'ongoing' && skillActions(state, skillId).length <= before) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 500) throw new Error(`did not use ${skillId}`)
  }
}

function damagesAt(state: CombatState, timeMs: number) {
  return state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id && event.timeMs === timeMs)
}

function mark(state: CombatState, enemy = state.enemies[0]): void {
  if (enemy === undefined) throw new Error('missing enemy')
  enemy.statuses.mark = { name: 'Mark', expiresMs: 60_000, sourceId: state.hero.id, sourceName: state.hero.name }
}

function snapshot(state: CombatState): StatusSnapshot {
  return {
    power: 10,
    penetration: 0,
    coefficient: 0.12,
    attackerLevel: state.hero.level,
    sourceId: state.hero.id,
    sourceName: state.hero.name,
  }
}

function poisonEffect() {
  const skill = authored('venom-edge')
  const effect = skill.effects[1]
  if (effect === undefined || effect.kind !== 'applyStatus') throw new Error('missing venom poison effect')
  return { skill, effect }
}

describe('assassin nodes', () => {
  it('raises Shadow Cut against a Marked target from 110% to 135% Physical Power', () => {
    expect(nodeId('Shadow Cut')).toBe(NODE_SHADOW_CUT)
    const plain = open({ equipped: ['shadow-cut'], rows: [{ skillId: 'shadow-cut' }] })
    expect(plain.state.hero.allocatedNodeIds).toEqual([])
    mark(plain.state)
    useSkill(plain.state, plain.defs, 'shadow-cut')
    const plainAction = skillActions(plain.state, 'shadow-cut')[0]
    if (plainAction?.type !== 'action') throw new Error('missing plain shadow cut')
    const plainHit = damagesAt(plain.state, plainAction.timeMs)[0]

    const boosted = open({ nodes: [NODE_SHADOW_CUT], equipped: ['shadow-cut'], rows: [{ skillId: 'shadow-cut' }] })
    mark(boosted.state)
    useSkill(boosted.state, boosted.defs, 'shadow-cut')
    const action = skillActions(boosted.state, 'shadow-cut')[0]
    if (action?.type !== 'action') throw new Error('missing shadow cut')
    const hit = damagesAt(boosted.state, action.timeMs)[0]

    const unmarked = open({ nodes: [NODE_SHADOW_CUT], equipped: ['shadow-cut'], rows: [{ skillId: 'shadow-cut' }] })
    useSkill(unmarked.state, unmarked.defs, 'shadow-cut')
    const plainMark = skillActions(unmarked.state, 'shadow-cut')[0]
    if (plainMark?.type !== 'action') throw new Error('missing unmarked shadow cut')
    const unmarkedHit = damagesAt(unmarked.state, plainMark.timeMs)[0]

    console.log('[sim]', 'shadow cut', {
      plain: plainHit?.type === 'damage' ? plainHit.coefficient : null,
      marked: hit?.type === 'damage' ? hit.coefficient : null,
      unmarked: unmarkedHit?.type === 'damage' ? unmarkedHit.coefficient : null,
    })
    expect(plainHit).toMatchObject({ type: 'damage', coefficient: 1.1 })
    expect(hit).toMatchObject({ type: 'damage', coefficient: 1.35 })
    expect(unmarkedHit).toMatchObject({ type: 'damage', coefficient: 1.1 })
    expect(authored('shadow-cut').effects[0]).toMatchObject({ coefficient: 1.1 })
  })

  it('unlocks Smoke Step without adding Evasion or Veil', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('smoke-step')
    expect(() => setLoadout(fresh, ['smoke-step'])).toThrow(/unlearned/)
    const progress = learned(['Shadow Cut', 'Smoke Step'])
    expect(progress.learnedSkillIds).toContain('smoke-step')
    expect(setLoadout(progress, ['smoke-step']).loadout).toEqual(['smoke-step'])
    expect(authored('smoke-step').effects).toEqual([{ kind: 'evasion', amount: 30 }])

    const fight = open({
      nodes: [nodeId('Smoke Step')],
      equipped: ['smoke-step'],
      rows: [{ skillId: 'smoke-step' }],
    })
    useSkill(fight.state, fight.defs, 'smoke-step')
    const buff = fight.state.log.find((event) => event.type === 'buff' && event.kind === 'evasion')
    expect(buff).toMatchObject({ type: 'buff', value: 30, until: 'nextAction' })
    expect(fight.state.hero.timedEvasion).toBe(0)
    expect(fight.state.hero.evasionBonus).toBe(30)
  })

  it('adds 15 Evasion to Smoke Step and shortens its cooldown once per enemy action', () => {
    const plain = open({ equipped: ['smoke-step'], rows: [{ skillId: 'smoke-step' }] })
    useSkill(plain.state, plain.defs, 'smoke-step')
    const plainBuff = plain.state.log.find((event) => event.type === 'buff' && event.kind === 'evasion')

    const fight = open({
      nodes: [NODE_ELUSIVE_FOOTWORK],
      equipped: ['smoke-step'],
      rows: [{ skillId: 'smoke-step' }],
    })
    useSkill(fight.state, fight.defs, 'smoke-step')
    const buff = fight.state.log.find((event) => event.type === 'buff' && event.kind === 'evasion')
    const ready = fight.state.hero.cooldowns['smoke-step']
    if (ready === undefined) throw new Error('smoke step cooldown was not stored')
    const taken = assassinClass.damageTaken
    if (taken === undefined) throw new Error('assassin damageTaken is missing')
    const timeMs = fight.state.timeMs
    taken(fight.state, { hpLost: 0, hpBefore: fight.state.hero.hp, kind: 'miss', timeMs, school: 'physical' })
    const once = fight.state.hero.cooldowns['smoke-step']
    taken(fight.state, { hpLost: 0, hpBefore: fight.state.hero.hp, kind: 'miss', timeMs, school: 'physical' })
    const twice = fight.state.hero.cooldowns['smoke-step']
    taken(fight.state, { hpLost: 0, hpBefore: fight.state.hero.hp, kind: 'miss', timeMs: timeMs + 10, school: 'physical' })
    console.log('[sim]', 'elusive footwork', {
      evasion: buff?.type === 'buff' ? buff.value : null,
      before: ready,
      once,
      twice,
      later: fight.state.hero.cooldowns['smoke-step'],
    })
    expect(plainBuff).toMatchObject({ value: 30 })
    expect(buff).toMatchObject({ value: 45, until: 'nextAction' })
    expect(fight.state.hero.evasionBonus).toBe(45)
    expect(once).toBe(ready - 1000)
    expect(twice).toBe(once)
    expect(fight.state.hero.cooldowns['smoke-step']).toBe((once ?? ready) - 1000)
  })

  it('gives the first direct-damage action after Smoke Step +30% damage and +20 critical chance', () => {
    const fight = open({
      nodes: [NODE_AMBUSH],
      equipped: ['smoke-step', 'mark-for-death', 'shadow-cut'],
      rows: [{ skillId: 'smoke-step' }],
    })
    useSkill(fight.state, fight.defs, 'smoke-step')
    useSkill(fight.state, fight.defs, 'mark-for-death')
    const baseCrit = fight.state.hero.critChance
    useSkill(fight.state, fight.defs, 'shadow-cut')
    const first = skillActions(fight.state, 'shadow-cut')[0]
    if (first?.type !== 'action') throw new Error('missing ambush attack')
    const hit = damagesAt(fight.state, first.timeMs)[0]
    expect(fight.state.hero.critChance).toBeCloseTo(baseCrit, 10)
    useSkill(fight.state, fight.defs, 'shadow-cut')
    const second = skillActions(fight.state, 'shadow-cut')[1]
    if (second?.type !== 'action') throw new Error('missing later attack')
    const later = damagesAt(fight.state, second.timeMs)[0]
    console.log('[sim]', 'ambush', {
      outgoing: hit?.type === 'damage' ? hit.outgoingModifier : null,
      critChance: hit?.type === 'damage' ? hit.critChance : null,
      later: later?.type === 'damage' ? later.outgoingModifier : null,
    })
    expect(hit).toMatchObject({ type: 'damage', outgoingModifier: 1.3 })
    if (hit?.type !== 'damage') throw new Error('missing ambush hit')
    expect(hit.critChance).toBeCloseTo(Math.min(1, baseCrit + 0.2), 10)
    expect(later).toMatchObject({ type: 'damage', outgoingModifier: 1 })
    if (later?.type === 'damage') expect(later.critChance).toBeCloseTo(baseCrit, 10)
  })

  it('grants Veil from Smoke Step, extends it on Evasion, and renews it once', () => {
    const fight = open({
      nodes: [NODE_GHOST],
      equipped: ['smoke-step', 'shadow-cut'],
      rows: [{ skillId: 'smoke-step' }],
    })
    useSkill(fight.state, fight.defs, 'smoke-step')
    const veil = fight.state.log.find((event) => event.type === 'buff' && event.until === 'duration')
    if (veil?.type !== 'buff' || veil.expiresMs === undefined) throw new Error('missing veil')
    expect(veil.value).toBe(50)
    expect(veil.expiresMs - veil.timeMs).toBe(4000)
    expect(fight.state.hero.evasionBonus).toBe(30)
    const taken = assassinClass.damageTaken
    if (taken === undefined) throw new Error('assassin damageTaken is missing')
    taken(fight.state, { hpLost: 0, hpBefore: fight.state.hero.hp, kind: 'miss', timeMs: veil.timeMs + 10, school: 'physical' })
    const extended = fight.state.hero.timedEvasionExpiresMs
    expect(extended).toBe(veil.expiresMs + 1000)
    mark(fight.state)
    fight.state.hero.critChance = 1
    useSkill(fight.state, fight.defs, 'shadow-cut')
    const first = skillActions(fight.state, 'shadow-cut')[0]
    if (first?.type !== 'action') throw new Error('missing veiled attack')
    const hit = damagesAt(fight.state, first.timeMs)[0]
    expect(fight.state.hero.timedEvasion).toBe(50)
    const renewed = fight.state.log.filter((event) => event.type === 'buff' && event.until === 'duration')
    useSkill(fight.state, fight.defs, 'shadow-cut')
    const second = skillActions(fight.state, 'shadow-cut')[1]
    if (second?.type !== 'action') throw new Error('missing renewed attack')
    const follow = damagesAt(fight.state, second.timeMs)[0]
    const veils = fight.state.log.filter((event) => event.type === 'buff' && event.until === 'duration')
    console.log('[sim]', 'ghost', {
      evasion: veil.value,
      durationMs: veil.expiresMs - veil.timeMs,
      extended,
      first: hit?.type === 'damage' ? hit.outgoingModifier : null,
      renewed: follow?.type === 'damage' ? follow.outgoingModifier : null,
      veils: veils.length,
    })
    expect(hit).toMatchObject({ type: 'damage', outgoingModifier: 1.4 })
    expect(follow).toMatchObject({ type: 'damage', outgoingModifier: 1.4 })
    expect(renewed).toHaveLength(2)
    expect(veils).toHaveLength(2)
    expect(fight.state.hero.timedEvasion).toBe(0)
  })

  it('unlocks Venom Edge without changing Poison numbers', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('venom-edge')
    const progress = learned(['Venom Edge'])
    expect(progress.learnedSkillIds).toEqual(['venom-edge'])
    expect(authored('venom-edge').effects[0]).toMatchObject({ coefficient: 0.9 })
    expect(authored('venom-edge').effects[1]).toMatchObject({ statusId: 'poison', coefficient: 0.12 })

    const fight = open({
      nodes: [nodeId('Venom Edge')],
      equipped: ['venom-edge'],
      rows: [{ skillId: 'venom-edge' }],
    })
    const enemy = fight.state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    const { skill, effect } = poisonEffect()
    for (let count = 0; count < 6; count += 1) {
      tryApplyStatus({
        state: fight.state,
        defs: fight.defs,
        source: fight.state.hero,
        target: enemy,
        skill,
        effect,
        timeMs: 1000 + count,
        applyingHit: true,
        hpDamageDealt: 10,
        roll: 0,
      })
    }
    expect(enemy.statuses.poison?.stacks).toHaveLength(5)
    expect(enemy.statuses.poison?.expiresMs).toBe(1005 + 8000)
  })

  it('raises Poison cap to 7, duration to 10 seconds, and application Potency by 10', () => {
    const fight = open({ nodes: [NODE_POTENT_TOXINS] })
    const enemy = fight.state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    const { skill, effect } = poisonEffect()
    for (let count = 0; count < 8; count += 1) {
      tryApplyStatus({
        state: fight.state,
        defs: fight.defs,
        source: fight.state.hero,
        target: enemy,
        skill,
        effect,
        timeMs: 1000 + count,
        applyingHit: true,
        hpDamageDealt: 10,
        roll: 0,
      })
    }
    const attempt = fight.state.log.filter((event) => event.type === 'statusAttempt' && event.statusId === 'poison').at(-1)
    const bossFight = open({
      nodes: [NODE_POTENT_TOXINS],
      enemies: [dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'boss', 'Boss', true)],
    })
    const boss = bossFight.state.enemies[0]
    if (boss === undefined) throw new Error('missing boss')
    tryApplyStatus({
      state: bossFight.state,
      defs: bossFight.defs,
      source: bossFight.state.hero,
      target: boss,
      skill,
      effect,
      timeMs: 2000,
      applyingHit: true,
      hpDamageDealt: 10,
      roll: 0,
    })
    console.log('[sim]', 'potent toxins', {
      stacks: enemy.statuses.poison?.stacks.length,
      durationMs: (enemy.statuses.poison?.expiresMs ?? 0) - 1007,
      potency: attempt?.type === 'statusAttempt' ? attempt.potency : null,
      bossStacks: boss.statuses.poison?.stacks.length,
      bossDurationMs: (boss.statuses.poison?.expiresMs ?? 0) - 2000,
    })
    expect(enemy.statuses.poison?.stacks).toHaveLength(7)
    expect(enemy.statuses.poison?.expiresMs).toBe(1007 + 10_000)
    expect(attempt).toMatchObject({
      type: 'statusAttempt',
      potency: fight.state.hero.intellect + fight.state.hero.statusPotency + 10,
    })
    expect(boss.boss).toBe(true)
    expect(boss.statuses.poison?.stacks).toHaveLength(1)
    expect(boss.statuses.poison?.expiresMs).toBe(2000 + 5000)
    for (let count = 0; count < 4; count += 1) {
      tryApplyStatus({
        state: bossFight.state,
        defs: bossFight.defs,
        source: bossFight.state.hero,
        target: boss,
        skill,
        effect,
        timeMs: 3000 + count,
        applyingHit: true,
        hpDamageDealt: 10,
        roll: 0,
      })
    }
    expect(boss.statuses.poison?.stacks).toHaveLength(4)
  })

  it('unlocks Fan of Knives without adding Poison or changing its damage', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('fan-of-knives')
    const progress = learned(['Venom Edge', 'Potent Toxins', 'Fan of Knives'])
    expect(progress.learnedSkillIds).toContain('fan-of-knives')
    expect(authored('fan-of-knives').effects).toEqual([{ kind: 'damage', school: 'physical', coefficient: 0.7 }])

    const enemies = [
      dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }),
      dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'other', 'Other'),
    ]
    const fight = open({
      nodes: [nodeId('Fan of Knives')],
      equipped: ['fan-of-knives'],
      rows: [{ skillId: 'fan-of-knives' }],
      enemies,
    })
    useSkill(fight.state, fight.defs, 'fan-of-knives')
    const action = skillActions(fight.state, 'fan-of-knives')[0]
    if (action?.type !== 'action') throw new Error('missing fan')
    const hits = damagesAt(fight.state, action.timeMs)
    expect(hits).toHaveLength(2)
    expect(hits[0]).toMatchObject({ coefficient: 0.7, outgoingModifier: 1 })
    expect(fight.state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'poison')).toBe(false)
  })

  it('grants one Advantage when Poison is applied to the Marked target and none from ticks', () => {
    const enemy = dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 })
    let applied: { state: CombatState; defs: GameDefs } | null = null
    for (let seed = 1; seed <= 30; seed += 1) {
      const fight = open({
        nodes: [NODE_TOXIC_OPPORTUNITY],
        equipped: ['venom-edge'],
        rows: [{ skillId: 'venom-edge' }],
        enemies: [enemy],
        seed,
      })
      fight.state.hero.critChance = 0
      mark(fight.state)
      until(fight.state, fight.defs, (state) => (state.enemies[0]?.statuses.poison?.stacks.length ?? 0) > 0)
      if ((fight.state.enemies[0]?.statuses.poison?.stacks.length ?? 0) > 0) {
        applied = fight
        break
      }
    }
    if (applied === null) throw new Error('poison did not apply')
    const gains = resources(applied.state, 'poison')
    const stacksAfter = applied.state.hero.classResource
    const poisoned = applied.state.enemies[0]
    if (poisoned?.statuses.poison === undefined || poisoned.statuses.poison === null) throw new Error('missing poison')
    applied.state.hero.nextReadyMs = applied.state.timeMs + 60_000
    poisoned.nextReadyMs = applied.state.timeMs + 60_000
    poisoned.statuses.poison.nextTickMs = applied.state.timeMs + 10
    until(applied.state, applied.defs, (state) => state.log.some((event) => event.type === 'statusTick' && event.statusId === 'poison'))
    console.log('[sim]', 'toxic opportunity', {
      gains: gains.length,
      stacks: applied.state.hero.classResource,
      afterTick: applied.state.hero.classResource,
    })
    expect(gains).toHaveLength(1)
    expect(applied.state.hero.classResource).toBe(stacksAfter)

    const crit = open({
      nodes: [NODE_TOXIC_OPPORTUNITY],
      equipped: ['venom-edge'],
      rows: [{ skillId: 'venom-edge' }],
      seed: applied.state.seed,
    })
    crit.state.hero.critChance = 1
    mark(crit.state)
    useSkill(crit.state, crit.defs, 'venom-edge')
    const action = skillActions(crit.state, 'venom-edge')[0]
    if (action?.type !== 'action') throw new Error('missing venom')
    const atAction = crit.state.log.filter((event) => event.type === 'resource' && event.timeMs === action.timeMs)
    expect(atAction).toHaveLength(1)
    expect(atAction[0]).toMatchObject({ reason: 'critical' })
  })

  it('freezes Poison on the Marked target and spreads half its stacks on death', () => {
    const fight = open({ nodes: [NODE_TOXIC_SOVEREIGN], equipped: ['shadow-cut'] })
    const enemy = fight.state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    const { skill, effect } = poisonEffect()
    tryApplyStatus({
      state: fight.state,
      defs: fight.defs,
      source: fight.state.hero,
      target: enemy,
      skill,
      effect,
      timeMs: 0,
      applyingHit: true,
      hpDamageDealt: 10,
      roll: 0,
    })
    mark(fight.state, enemy)
    const started = enemy.statuses.poison?.expiresMs
    if (started === undefined) throw new Error('missing poison')
    fight.state.hero.nextReadyMs = 60_000
    enemy.nextReadyMs = 60_000
    while (fight.state.timeMs < 3000 && fight.state.outcome === 'ongoing') stepCombat(fight.state, fight.defs)
    expect(enemy.statuses.poison?.expiresMs).toBe(started + fight.state.timeMs)

    const pack = [
      dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'marked', 'Marked'),
      dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'open', 'Open'),
      dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'full', 'Full'),
    ]
    const spread = open({ nodes: [NODE_TOXIC_SOVEREIGN], equipped: ['shadow-cut'], enemies: pack })
    const markedEnemy = spread.state.enemies[0]
    const openEnemy = spread.state.enemies[1]
    const fullEnemy = spread.state.enemies[2]
    if (markedEnemy === undefined || openEnemy === undefined || fullEnemy === undefined) throw new Error('missing pack')
    const stacks = [0, 1, 2, 3, 4].map(() => snapshot(spread.state))
    markedEnemy.statuses.poison = {
      name: 'Poison',
      stacks,
      expiresMs: 8000,
      tickMs: 2000,
      nextTickMs: 2000,
    }
    fullEnemy.statuses.poison = {
      name: 'Poison',
      stacks: [0, 1, 2, 3].map(() => snapshot(spread.state)),
      expiresMs: 8000,
      tickMs: 2000,
      nextTickMs: 2000,
    }
    mark(spread.state, markedEnemy)
    markedEnemy.hp = 1
    useSkill(spread.state, spread.defs, 'shadow-cut')
    console.log('[sim]', 'toxic sovereign', {
      heldMs: (enemy.statuses.poison?.expiresMs ?? 0) - started,
      spread: openEnemy.statuses.poison?.stacks.length,
      capped: fullEnemy.statuses.poison?.stacks.length,
    })
    expect(openEnemy.statuses.poison?.stacks).toHaveLength(2)
    expect(fullEnemy.statuses.poison?.stacks).toHaveLength(5)
    expect(spread.state.enemies[0]?.alive).toBe(false)
  })

  it('unlocks Mark for Death without making Mark permanent', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('mark-for-death')
    const progress = learned(['Mark for Death'])
    expect(progress.learnedSkillIds).toEqual(['mark-for-death'])
    expect(authored('mark-for-death').effects[0]).toMatchObject({ statusId: 'mark', durationSeconds: 8 })

    const fight = open({
      nodes: [nodeId('Mark for Death')],
      equipped: ['mark-for-death'],
      rows: [{ skillId: 'mark-for-death' }],
    })
    useSkill(fight.state, fight.defs, 'mark-for-death')
    const enemy = fight.state.enemies[0]
    const expires = enemy?.statuses.mark?.expiresMs
    if (enemy === undefined || expires === undefined || expires === null) throw new Error('mark did not expire on a timer')
    enemy.nextReadyMs = expires + 60_000
    fight.state.hero.nextReadyMs = expires + 60_000
    while (fight.state.timeMs <= expires && fight.state.outcome === 'ongoing') stepCombat(fight.state, fight.defs)
    expect(enemy.statuses.mark).toBeNull()
  })

  it('adds 15% direct damage against the Marked target and 25% more Mark progress', () => {
    const fight = open({
      nodes: [NODE_EXPLOIT_WEAKNESS],
      equipped: ['shadow-cut', 'fan-of-knives'],
      rows: [{ skillId: 'shadow-cut' }],
      spirit: 0,
      enemies: [
        dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }),
        dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'other', 'Other'),
      ],
    })
    mark(fight.state, fight.state.enemies[0])
    useSkill(fight.state, fight.defs, 'shadow-cut')
    const cut = skillActions(fight.state, 'shadow-cut')[0]
    if (cut?.type !== 'action') throw new Error('missing shadow cut')
    const markedHit = damagesAt(fight.state, cut.timeMs)[0]
    const markGain = resources(fight.state, 'mark')[0]
    useSkill(fight.state, fight.defs, 'fan-of-knives')
    const fan = skillActions(fight.state, 'fan-of-knives')[0]
    if (fan?.type !== 'action') throw new Error('missing fan')
    const hits = damagesAt(fight.state, fan.timeMs)
    const markedId = fight.state.enemies[0]?.id
    const markedFan = hits.find((event) => event.type === 'damage' && event.targetId === markedId)
    const otherFan = hits.find((event) => event.type === 'damage' && event.targetId !== markedId)
    const basic = open({ nodes: [NODE_EXPLOIT_WEAKNESS], spirit: 0 })
    mark(basic.state)
    basic.state.hero.critChance = 0
    const resolved = assassinClass.actionResolved
    if (resolved === undefined) throw new Error('assassin actionResolved is missing')
    resolved(basic.state, { kind: 'basicAttack', hit: true, crit: false, targetId: basic.state.enemies[0]?.id }, 1000)
    console.log('[sim]', 'exploit weakness', {
      outgoing: markedHit?.type === 'damage' ? markedHit.outgoingModifier : null,
      coefficient: markedHit?.type === 'damage' ? markedHit.coefficient : null,
      advantage: markGain?.type === 'resource' ? markGain.multiplier : null,
      fanMarked: markedFan?.type === 'damage' ? markedFan.outgoingModifier : null,
      fanOther: otherFan?.type === 'damage' ? otherFan.outgoingModifier : null,
    })
    expect(markedHit).toMatchObject({ type: 'damage', coefficient: 1.1, outgoingModifier: 1.15 })
    expect(markGain).toMatchObject({ type: 'resource', base: 1, multiplier: spiritResourceFactor(0) * 1.25 })
    expect(markedFan).toMatchObject({ outgoingModifier: 1.15 })
    expect(otherFan).toMatchObject({ outgoingModifier: 1 })
    expect(resources(basic.state, 'mark')).toHaveLength(0)
    expect(basic.state.hero.classResource).toBe(0)
  })

  it('unlocks Execute without making it fatal', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('execute')
    const progress = learned(['Mark for Death', 'Exploit Weakness', 'Execute'])
    expect(progress.learnedSkillIds).toContain('execute')
    expect(authored('execute').tags).toContain(EXECUTE_TAG)
    expect(authored('execute').effects[0]).toMatchObject({ coefficient: 1 })

    const enemy = dummy({ maxHp: 10_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1 })
    const fight = open({
      nodes: [nodeId('Execute')],
      equipped: ['execute'],
      rows: [{ skillId: 'execute' }],
      enemies: [enemy],
    })
    const target = fight.state.enemies[0]
    if (target === undefined) throw new Error('missing enemy')
    target.hp = 300_000
    fight.state.hero.classResource = 1
    fight.state.hero.critChance = 0
    useSkill(fight.state, fight.defs, 'execute')
    const action = skillActions(fight.state, 'execute')[0]
    if (action?.type !== 'action') throw new Error('missing execute')
    const hit = damagesAt(fight.state, action.timeMs)[0]
    const expected = executeCoefficient(1, (target.maxHp - 300_000) / target.maxHp)
    expect(hit).toMatchObject({ type: 'damage', coefficient: expected })
    expect(target.alive).toBe(true)
    expect(target.hp).toBeGreaterThan(0)
  })

  it('resets Mark for Death and leaves at least 2 Advantage after the Marked target dies', () => {
    const pack = [
      dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'marked', 'Marked'),
      dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 }, 'other', 'Other'),
    ]
    const low = open({
      nodes: [NODE_RELENTLESS],
      equipped: ['shadow-cut'],
      rows: [{ skillId: 'shadow-cut' }],
      spirit: 0,
      enemies: pack,
    })
    mark(low.state)
    low.state.hero.critChance = 0
    low.state.hero.classResource = 0
    low.state.enemies[0]!.hp = 1
    low.state.hero.cooldowns['mark-for-death'] = low.state.timeMs + 50_000
    useSkill(low.state, low.defs, 'shadow-cut')

    const high = open({
      nodes: [NODE_RELENTLESS],
      equipped: ['shadow-cut'],
      spirit: 0,
      enemies: pack,
    })
    mark(high.state)
    high.state.hero.critChance = 0
    high.state.hero.classResource = 4
    high.state.enemies[0]!.hp = 1
    useSkill(high.state, high.defs, 'shadow-cut')
    console.log('[sim]', 'relentless', {
      low: low.state.hero.classResource,
      cooldown: low.state.hero.cooldowns['mark-for-death'],
      high: high.state.hero.classResource,
    })
    expect(low.state.hero.classResource).toBe(2)
    expect(low.state.hero.cooldowns['mark-for-death']).toBeUndefined()
    expect(high.state.hero.classResource).toBe(5)
    expect(resources(low.state, 'relentless')).toHaveLength(1)
  })

  it('keeps Mark until death and executes ordinary enemies but not bosses', () => {
    const lasting = open({
      nodes: [NODE_DEATH_SENTENCE],
      equipped: ['mark-for-death', 'shadow-cut'],
      rows: [{ skillId: 'mark-for-death' }],
    })
    useSkill(lasting.state, lasting.defs, 'mark-for-death')
    const marked = lasting.state.enemies[0]
    if (marked === undefined) throw new Error('missing enemy')
    expect(marked.statuses.mark?.expiresMs).toBeNull()
    const start = lasting.state.timeMs
    lasting.state.hero.nextReadyMs = start + 60_000
    marked.nextReadyMs = start + 60_000
    while (lasting.state.timeMs < start + 10_000 && lasting.state.outcome === 'ongoing') {
      stepCombat(lasting.state, lasting.defs)
    }
    expect(marked.statuses.mark?.expiresMs).toBeNull()
    marked.hp = 1
    useSkill(lasting.state, lasting.defs, 'shadow-cut')
    expect(marked.statuses.mark).toBeNull()
    expect(lasting.state.log.some((event) => event.type === 'statusCleared' && event.reason === 'death')).toBe(true)

    const enemy = dummy({ maxHp: 10_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1 })
    const boss = dummy({ maxHp: 10_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1 }, 'boss', 'Boss', true)
    const fatal = open({
      nodes: [NODE_DEATH_SENTENCE],
      equipped: ['execute'],
      rows: [{ skillId: 'execute' }],
      enemies: [enemy],
      seed: 3,
    })
    const survivor = open({
      nodes: [NODE_DEATH_SENTENCE],
      equipped: ['execute'],
      rows: [{ skillId: 'execute' }],
      enemies: [enemy],
      seed: 3,
    })
    const bossFight = open({
      nodes: [NODE_DEATH_SENTENCE],
      equipped: ['execute'],
      rows: [{ skillId: 'execute' }],
      enemies: [boss],
      seed: 3,
    })
    const plainBoss = open({
      equipped: ['execute'],
      rows: [{ skillId: 'execute' }],
      enemies: [boss],
      seed: 3,
    })
    for (const fight of [fatal, survivor, bossFight, plainBoss]) {
      const target = fight.state.enemies[0]
      if (target === undefined) throw new Error('missing target')
      target.hp = fight === survivor ? 500_000 : 300_000
      fight.state.hero.classResource = fight === bossFight || fight === plainBoss ? 5 : 1
      fight.state.hero.critChance = 0
      useSkill(fight.state, fight.defs, 'execute')
    }
    const fatalTarget = fatal.state.enemies[0]
    const liveTarget = survivor.state.enemies[0]
    const bossTarget = bossFight.state.enemies[0]
    const bossHit = bossFight.state.log.find((event) => event.type === 'damage')
    const plainHit = plainBoss.state.log.find((event) => event.type === 'damage')
    console.log('[sim]', 'death sentence', {
      fatalHp: fatalTarget?.hp,
      survivorHp: liveTarget?.hp,
      bossHp: bossTarget?.hp,
      bossDamage: bossHit?.type === 'damage' ? bossHit.afterIncoming : null,
      plainDamage: plainHit?.type === 'damage' ? plainHit.afterIncoming : null,
    })
    expect(fatalTarget?.alive).toBe(false)
    expect(fatalTarget?.hp).toBe(0)
    expect(liveTarget?.alive).toBe(true)
    expect(bossTarget?.alive).toBe(true)
    expect(bossTarget?.hp).toBeGreaterThan(0)
    if (bossHit?.type !== 'damage' || plainHit?.type !== 'damage') throw new Error('missing boss execute')
    expect(bossHit.coefficient).toBeCloseTo(plainHit.coefficient, 8)
    expect(bossHit.afterIncoming / plainHit.afterIncoming).toBeCloseTo(1.5, 8)
  })
})
