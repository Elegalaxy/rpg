import { describe, expect, it } from 'vitest'

import { comboDefs, comboNodeIds, comboPairs, comboSetup } from './combos.ts'
import { createCombat, stepCombat } from '../sim/combat.ts'
import { grantClassResource } from '../sim/classes/resources.ts'
import { SPLINTERED_ROAD_ID, createExpedition, hpRegenPerSecond, rescueFee } from '../sim/expedition.ts'
import type { ExpeditionBlueprint } from '../sim/expedition.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import {
  allocateRacialNode,
  createProgress,
  grantLegacySkillPoint,
  renaissanceActive,
  setAttachment,
  xpFromEnemies,
  type HeroRace,
} from '../sim/progression.ts'
import { apexOutputFactor, ferocityTier, longHuntRegenFactor } from '../sim/races/beastfolk.ts'
import { clarityActive, FOCUS_MAX, elfRace, focusResourceMultiplier } from '../sim/races/elf.ts'
import { humanOrdinaryXp } from '../sim/races/human.ts'
import {
  APEX_CRIT_DAMAGE,
  APEX_HEALING,
  CLARITY_COOLDOWN,
  CURSE_GRAVE_PATIENCE,
  CURSE_HOLLOW_HUNGER,
  CURSE_SOUL_DEBT,
  FLOW_BONUS_CAP,
  FOCUS_GAIN_NODE,
  FOCUS_LOSS_NODE,
  FORESIGHT_EVASION,
  HOLLOW_HEALING_RECEIVED,
  HOLLOW_POWER,
  NODE_BEAST_APEX_INSTINCT,
  NODE_BEAST_BLOOD_SCENT,
  NODE_BEAST_LONG_HUNT,
  NODE_BEAST_THICK_HIDE,
  NODE_ELF_EFFICIENT_FLOW,
  NODE_ELF_FOCUSED_MIND,
  NODE_ELF_FORESIGHT,
  NODE_ELF_PERFECT_CLARITY,
  NODE_HUMAN_CROSS_TRAINING,
  NODE_HUMAN_FLEXIBLE_ROUTE,
  NODE_HUMAN_QUICK_STUDY,
  NODE_HUMAN_RENAISSANCE,
  NODE_UNDEAD_CURSEBOUND,
  NODE_UNDEAD_DEATHLY_PRECISION,
  NODE_UNDEAD_PATIENT_KILLER,
  NODE_UNDEAD_SOUL_HARVEST,
  PRECISION_CRIT,
  RENAISSANCE_CONSISTENCY,
  RENAISSANCE_HP,
  RENAISSANCE_POWER,
  SOUL_CAP,
  SOUL_DEBT_FEE,
  THICK_HIDE_HP,
  THICK_HIDE_REGEN,
  soulsOf,
} from '../sim/races/racialNodes.ts'
import { undeadRace } from '../sim/races/undead.ts'
import { deriveHeroStats } from '../sim/stats.ts'
import type { ClassAction, CombatSetup, CombatState, GameDefs } from '../sim/types.ts'

import { classWebs } from '../content/webs/index.ts'
import { racialWebs } from '../content/webs/racial.ts'

const DUMMY = 'dummy-standard-20'
const HUMAN = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }

type Fight = {
  race: HeroRace
  classId?: (typeof HERO_CLASSES)[number]
  nodes?: readonly string[]
  focus?: number
  ferocity?: number
  souls?: number
  curse?: string
  hp?: number
  enemies?: number
  enemy?: { maxHp?: number; power?: number }
  seed?: number
  renaissance?: boolean
}

function open(fight: Fight): { state: CombatState; defs: GameDefs } {
  const classId = fight.classId ?? 'warrior'
  const pair = { race: fight.race, classId, pairIndex: 0 }
  const setup = comboSetup(pair)
  const defs = comboDefs()
  const dummy = defs.enemies[DUMMY]
  if (dummy === undefined) throw new Error('missing dummy')
  defs.enemies[DUMMY] = {
    ...dummy,
    overrides: { maxHp: fight.enemy?.maxHp ?? 1_000_000, power: fight.enemy?.power ?? 1, actionTime: 600, armor: 0, resistance: 0, evasion: 0 },
  }
  const enemies: CombatSetup['enemies'][number][] = []
  for (let slot = 0; slot < (fight.enemies ?? 1); slot += 1) enemies.push({ defId: DUMMY, slot, level: 10 })
  const hero = {
    ...setup.hero,
    allocatedNodeIds: fight.nodes,
    ...(fight.focus !== undefined ? { startingFocus: fight.focus } : {}),
    ...(fight.ferocity !== undefined ? { ferocityProgress: fight.ferocity } : {}),
    ...(fight.souls !== undefined ? { startingSouls: fight.souls } : {}),
    ...(fight.curse !== undefined ? { curse: fight.curse } : {}),
    ...(fight.hp !== undefined ? { startingHp: fight.hp } : {}),
    ...(fight.renaissance !== undefined ? { renaissance: fight.renaissance } : {}),
  }
  return { state: createCombat({ hero, enemies }, defs, fight.seed ?? 1), defs }
}

function nodeId(race: HeroRace, name: string): string {
  const node = racialWebs[race].nodes.find((entry) => entry.name === name)
  if (node === undefined) throw new Error(`missing ${race} node ${name}`)
  return node.id
}

function basicAction(hit = true): ClassAction {
  return { kind: 'basicAttack', hit, crit: false }
}

function hit(state: CombatState, hpLost: number) {
  return { kind: 'hit' as const, hpLost, hpBefore: state.hero.hp, timeMs: state.timeMs + 5, school: 'physical' as const }
}

function runUntilDone(state: CombatState, defs: GameDefs): void {
  let steps = 0
  while (state.outcome === 'ongoing' && steps < 20_000) {
    stepCombat(state, defs)
    steps += 1
  }
}

function raceLines(state: CombatState): string[] {
  return state.log.flatMap((event) => (event.type === 'race' ? [event.text] : []))
}

describe('racial webs', () => {
  it('give every race one line of four nodes, none a keystone', () => {
    for (const race of ['human', 'elf', 'beastfolk', 'undead'] as const) {
      const web = racialWebs[race]
      expect(web.nodes).toHaveLength(4)
      expect(web.nodes.map((node) => node.index)).toEqual([1, 2, 3, 4])
      expect(web.nodes.every((node) => !node.keystone && node.cost === 1)).toBe(true)
      expect(web.nodes[0]?.requires).toBeNull()
      expect(web.nodes[3]?.requires).toBe(web.nodes[2]?.id)
    }
  })

  it('spend ordinary skill points in order and refuse another race', () => {
    const web = racialWebs.elf
    const first = web.nodes[0]!
    const second = web.nodes[1]!
    let progress = createProgress('elf', HUMAN)
    expect(() => allocateRacialNode(progress, web, first.id)).toThrow(/not enough skill points/)
    progress = grantLegacySkillPoint(grantLegacySkillPoint(progress))
    expect(() => allocateRacialNode(progress, web, second.id)).toThrow(/requires/)
    progress = allocateRacialNode(progress, web, first.id)
    progress = allocateRacialNode(progress, web, second.id)
    expect(progress.allocatedNodeIds).toEqual([first.id, second.id])
    expect(progress.legacySkillPoints).toBe(0)
    const human = grantLegacySkillPoint(createProgress('human', HUMAN))
    expect(() => allocateRacialNode(human, web, first.id)).toThrow(/cannot take elf/)
  })
})

describe('human nodes', () => {
  it('Quick Study raises the ordinary XP bonus from 5% to 8%', () => {
    expect(nodeId('human', 'Quick Study')).toBe(NODE_HUMAN_QUICK_STUDY)
    const members = [{ xp: 100, level: 10, summon: false }]
    const plain = humanOrdinaryXp(10, 20, members)
    const noded = humanOrdinaryXp(10, 20, members, [NODE_HUMAN_QUICK_STUDY])
    expect(plain).toBe(xpFromEnemies(10, 20, members, 1.05))
    expect(noded).toBe(xpFromEnemies(10, 20, members, 1.08))
    expect(noded).toBeGreaterThan(plain)
    expect(humanOrdinaryXp(10, 20, members, [NODE_HUMAN_CROSS_TRAINING])).toBe(plain)
  })

  it('Cross-Training removes the 10% off-preference penalty from equipment', () => {
    expect(nodeId('human', 'Cross-Training')).toBe(NODE_HUMAN_CROSS_TRAINING)
    const mage = comboSetup({ race: 'human', classId: 'mage', pairIndex: 0 }).hero
    const heavy = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
      id: `heavy-${slot}`,
      slot,
      category: 'heavy' as const,
      itemLevel: 10,
      quality: 1,
    })
    const gear = { ...mage.gear, head: heavy('head'), chest: heavy('chest'), hands: heavy('hands'), feet: heavy('feet') }
    const input = { level: 10, classId: 'mage' as const, attributes: mage.attributes, gear }
    const plain = deriveHeroStats(input)
    const trained = deriveHeroStats({ ...input, racialNodeIds: [NODE_HUMAN_CROSS_TRAINING] })
    expect(plain.armor / trained.armor).toBeCloseTo(0.9, 10)
    expect(plain.resistance / trained.resistance).toBeCloseTo(0.9, 10)
    expect(trained.magicalPower).toBe(plain.magicalPower)
  })

  it('Flexible Route is takeable and changes no combat number while attachment stays closed', () => {
    expect(nodeId('human', 'Flexible Route')).toBe(NODE_HUMAN_FLEXIBLE_ROUTE)
    const mage = comboSetup({ race: 'human', classId: 'mage', pairIndex: 0 }).hero
    const input = { level: 10, classId: 'mage' as const, attributes: mage.attributes, gear: mage.gear }
    expect(deriveHeroStats({ ...input, racialNodeIds: [NODE_HUMAN_FLEXIBLE_ROUTE] })).toEqual(deriveHeroStats(input))
    const progress = createProgress('human', HUMAN)
    expect(() => setAttachment(progress, 0, NODE_HUMAN_FLEXIBLE_ROUTE)).toThrow(/no racial node can be attached yet/)
  })

  it('Renaissance needs two nodes in every class cluster, then adds 8% Power, 8% HP, and 10 Consistency', () => {
    expect(nodeId('human', 'Renaissance')).toBe(NODE_HUMAN_RENAISSANCE)
    const web = classWebs.warrior
    const clusters = [...new Set(web.nodes.map((node) => node.cluster))]
    const take = (count: number) => web.nodes.filter((node) => node.index <= count).map((node) => node.id)
    expect(clusters).toHaveLength(3)
    expect(renaissanceActive(take(2), web)).toBe(true)
    expect(renaissanceActive(take(1), web)).toBe(false)
    expect(renaissanceActive(web.nodes.filter((node) => node.cluster === clusters[0]).map((node) => node.id), web)).toBe(false)
    const ids = [...take(2), NODE_HUMAN_RENAISSANCE]
    const plain = open({ race: 'human' })
    const on = open({ race: 'human', nodes: ids, renaissance: true })
    const off = open({ race: 'human', nodes: ids, renaissance: false })
    expect(on.state.hero.physicalPower / plain.state.hero.physicalPower).toBeCloseTo(RENAISSANCE_POWER, 10)
    expect(on.state.hero.maxHp / plain.state.hero.maxHp).toBeCloseTo(RENAISSANCE_HP, 10)
    expect(on.state.hero.consistency).toBe(RENAISSANCE_CONSISTENCY)
    expect(off.state.hero.physicalPower).toBe(plain.state.hero.physicalPower)
    expect(off.state.hero.consistency).toBe(0)
  })
})

describe('elf nodes', () => {
  it('Focused Mind gains 15 Focus per success and loses 25% less to damage', () => {
    expect(nodeId('elf', 'Focused Mind')).toBe(NODE_ELF_FOCUSED_MIND)
    const plain = open({ race: 'elf' })
    const noded = open({ race: 'elf', nodes: [NODE_ELF_FOCUSED_MIND] })
    elfRace.actionResolved?.(plain.state, basicAction(), 100)
    elfRace.actionResolved?.(noded.state, basicAction(), 100)
    expect(plain.state.hero.raceState.focus).toBe(10)
    expect(noded.state.hero.raceState.focus).toBe(FOCUS_GAIN_NODE)
    const loss = 0.1 * noded.state.hero.maxHp
    noded.state.hero.raceState.focus = 50
    plain.state.hero.raceState.focus = 50
    elfRace.damageTaken?.(noded.state, hit(noded.state, loss))
    elfRace.damageTaken?.(plain.state, hit(plain.state, 0.1 * plain.state.hero.maxHp))
    expect(50 - (plain.state.hero.raceState.focus as number)).toBeCloseTo(20, 6)
    expect(50 - (noded.state.hero.raceState.focus as number)).toBeCloseTo(20 * FOCUS_LOSS_NODE, 6)
  })

  it('Efficient Flow lifts the Focus resource-generation cap from +10% to +20%', () => {
    expect(nodeId('elf', 'Efficient Flow')).toBe(NODE_ELF_EFFICIENT_FLOW)
    expect(focusResourceMultiplier(100)).toBeCloseTo(1.1, 10)
    expect(focusResourceMultiplier(100, true)).toBeCloseTo(1 + FLOW_BONUS_CAP, 10)
    expect(focusResourceMultiplier(50, true)).toBeCloseTo(1.1, 10)
    const plain = open({ race: 'elf', focus: 100 })
    const noded = open({ race: 'elf', focus: 100, nodes: [NODE_ELF_EFFICIENT_FLOW] })
    grantClassResource(plain.state, 10, 10, 'test')
    grantClassResource(noded.state, 10, 10, 'test')
    const gained = (state: CombatState) => state.log.filter((event) => event.type === 'resource' && event.reason === 'test').at(-1)
    const a = gained(plain.state)
    const b = gained(noded.state)
    if (a?.type !== 'resource' || b?.type !== 'resource') throw new Error('missing resource event')
    expect(b.multiplier / a.multiplier).toBeCloseTo(1.2 / 1.1, 10)
  })

  it('Foresight adds 10 Evasion while Focus is 75 or more', () => {
    expect(nodeId('elf', 'Foresight')).toBe(NODE_ELF_FORESIGHT)
    const plain = open({ race: 'elf', focus: 80 })
    const low = open({ race: 'elf', focus: 74, nodes: [NODE_ELF_FORESIGHT] })
    const high = open({ race: 'elf', focus: 80, nodes: [NODE_ELF_FORESIGHT] })
    expect(high.state.hero.evasion - plain.state.hero.evasion).toBe(FORESIGHT_EVASION)
    expect(low.state.hero.evasion).toBe(plain.state.hero.evasion)
    high.state.hero.raceState.focus = 60
    elfRace.damageTaken?.(high.state, hit(high.state, 1))
    expect(high.state.hero.evasion).toBe(plain.state.hero.evasion)
    elfRace.actionResolved?.(high.state, basicAction(), 200)
    elfRace.actionResolved?.(high.state, basicAction(), 300)
    expect(high.state.hero.evasion - plain.state.hero.evasion).toBe(FORESIGHT_EVASION)
  })

  it('Perfect Clarity at 100 Focus rolls 95%-100%, adds 10 points of cooldown reduction, and loses all Focus to damage', () => {
    expect(nodeId('elf', 'Perfect Clarity')).toBe(NODE_ELF_PERFECT_CLARITY)
    const plain = open({ race: 'elf', focus: FOCUS_MAX })
    const noded = open({ race: 'elf', focus: FOCUS_MAX, nodes: [NODE_ELF_PERFECT_CLARITY] })
    expect(clarityActive(noded.state.hero)).toBe(true)
    expect(noded.state.hero.cooldownReduction - plain.state.hero.cooldownReduction).toBeCloseTo(CLARITY_COOLDOWN, 10)
    const swing = (fight: { state: CombatState; defs: GameDefs }) => {
      let steps = 0
      while (fight.state.outcome === 'ongoing' && steps < 2000) {
        stepCombat(fight.state, fight.defs)
        const damage = fight.state.log.find((event) => event.type === 'damage' && event.actorId === fight.state.hero.id)
        if (damage?.type === 'damage') return damage
        steps += 1
      }
      throw new Error('no hero hit')
    }
    const clear = swing(noded)
    expect(clear.damageFloor).toBeCloseTo(0.95, 10)
    expect(swing(plain).damageFloor).toBeLessThan(0.95)
    elfRace.damageTaken?.(noded.state, hit(noded.state, 1))
    expect(noded.state.hero.raceState.focus).toBe(0)
    expect(clarityActive(noded.state.hero)).toBe(false)
    expect(noded.state.hero.cooldownReduction).toBeCloseTo(plain.state.hero.cooldownReduction, 10)
  })
})

describe('beastfolk nodes', () => {
  it('Thick Hide adds 10% maximum HP and 25% out-of-combat regeneration', () => {
    expect(nodeId('beastfolk', 'Thick Hide')).toBe(NODE_BEAST_THICK_HIDE)
    const plain = open({ race: 'beastfolk' })
    const noded = open({ race: 'beastfolk', nodes: [NODE_BEAST_THICK_HIDE] })
    expect(noded.state.hero.maxHp / plain.state.hero.maxHp).toBeCloseTo(THICK_HIDE_HP, 10)
    expect(hpRegenPerSecond(70)).toBe(4)
    expect(hpRegenPerSecond(70, THICK_HIDE_REGEN)).toBe(5)
  })

  it('Blood Scent gives 2 bonus Ferocity progress and heals 5% after a victory below 40% HP', () => {
    expect(nodeId('beastfolk', 'Blood Scent')).toBe(NODE_BEAST_BLOOD_SCENT)
    const finish = (nodes: readonly string[] | undefined) => {
      const fight = open({ race: 'beastfolk', nodes, enemy: { maxHp: 1 }, hp: 10, ferocity: 0 })
      const start = fight.state.hero.hp
      runUntilDone(fight.state, fight.defs)
      expect(fight.state.outcome).toBe('victory')
      return { fight, start }
    }
    const plain = finish(undefined)
    const noded = finish([NODE_BEAST_BLOOD_SCENT])
    expect(plain.fight.state.hero.raceState.ferocity).toBe(2)
    expect(noded.fight.state.hero.raceState.ferocity).toBe(3)
    expect(plain.fight.state.hero.hp).toBe(plain.start)
    expect(noded.fight.state.hero.hp).toBeCloseTo(noded.start + 0.05 * noded.fight.state.hero.maxHp, 6)
    const healthy = open({ race: 'beastfolk', nodes: [NODE_BEAST_BLOOD_SCENT], enemy: { maxHp: 1 } })
    runUntilDone(healthy.state, healthy.defs)
    expect(healthy.state.hero.raceState.ferocity).toBe(1)
  })

  it('Long Hunt adds 5% class-resource generation and regeneration per Ferocity tier', () => {
    expect(nodeId('beastfolk', 'Long Hunt')).toBe(NODE_BEAST_LONG_HUNT)
    const plain = open({ race: 'beastfolk', ferocity: 4 })
    const noded = open({ race: 'beastfolk', ferocity: 4, nodes: [NODE_BEAST_LONG_HUNT] })
    grantClassResource(plain.state, 10, 10, 'test')
    grantClassResource(noded.state, 10, 10, 'test')
    const gained = (state: CombatState) => state.log.filter((event) => event.type === 'resource' && event.reason === 'test').at(-1)
    const a = gained(plain.state)
    const b = gained(noded.state)
    if (a?.type !== 'resource' || b?.type !== 'resource') throw new Error('missing resource event')
    expect(ferocityTier(4)).toBe(2)
    expect(b.multiplier / a.multiplier).toBeCloseTo(1.1, 10)
    expect(longHuntRegenFactor([NODE_BEAST_LONG_HUNT], 4)).toBeCloseTo(1.1, 10)
    expect(longHuntRegenFactor([NODE_BEAST_LONG_HUNT], 0)).toBe(1)
    expect(longHuntRegenFactor([], 6)).toBe(1)
  })

  it('Apex Instinct at tier 3 adds 15 points of crit damage and 15% healing and barrier output', () => {
    expect(nodeId('beastfolk', 'Apex Instinct')).toBe(NODE_BEAST_APEX_INSTINCT)
    const plain = open({ race: 'beastfolk', ferocity: 6 })
    const noded = open({ race: 'beastfolk', ferocity: 6, nodes: [NODE_BEAST_APEX_INSTINCT] })
    const low = open({ race: 'beastfolk', ferocity: 4, nodes: [NODE_BEAST_APEX_INSTINCT] })
    expect(noded.state.hero.critDamage - plain.state.hero.critDamage).toBeCloseTo(APEX_CRIT_DAMAGE, 10)
    expect(low.state.hero.critDamage).toBe(plain.state.hero.critDamage)
    expect(apexOutputFactor(noded.state.hero)).toBe(APEX_HEALING)
    expect(apexOutputFactor(low.state.hero)).toBe(1)
    const ward = (nodes: readonly string[] | undefined) => {
      const fight = open({ race: 'beastfolk', classId: 'cleric', ferocity: 6, nodes })
      fight.state.hero.priorityRows = [{ skillId: 'ward' }]
      fight.state.hero.equippedSkillIds = ['ward']
      fight.state.hero.classResource = 100
      fight.state.hero.nextReadyMs = fight.state.timeMs + 10
      while (fight.state.hero.barrier === 0 && fight.state.timeMs < 5000) stepCombat(fight.state, fight.defs)
      return fight.state.hero.barrier
    }
    expect(ward([NODE_BEAST_APEX_INSTINCT]) / ward(undefined)).toBeCloseTo(APEX_HEALING, 10)
  })
})

describe('undead nodes', () => {
  function stillnessReady(fight: { state: CombatState }, nodes: boolean): void {
    void nodes
    fight.state.hero.raceState.stillness = 3
  }

  it('Patient Killer makes spent Stillness give +30 Accuracy, +20% damage, and +15 points of minimum roll', () => {
    expect(nodeId('undead', 'Patient Killer')).toBe(NODE_UNDEAD_PATIENT_KILLER)
    const plain = open({ race: 'undead' })
    const noded = open({ race: 'undead', nodes: [NODE_UNDEAD_PATIENT_KILLER] })
    stillnessReady(plain, false)
    stillnessReady(noded, true)
    const accuracy = plain.state.hero.accuracy
    undeadRace.actionChosen?.(plain.state, basicAction(), 100)
    undeadRace.actionChosen?.(noded.state, basicAction(), 100)
    expect(plain.state.hero.accuracy - accuracy).toBe(20)
    expect(noded.state.hero.accuracy - accuracy).toBe(30)
    expect(plain.state.hero.raceState.damageRollFloorBonus).toBe(0.1)
    expect(noded.state.hero.raceState.damageRollFloorBonus).toBe(0.15)
    expect(plain.state.hero.raceState.finalDamageMultiplier).toBe(1.1)
    expect(noded.state.hero.raceState.finalDamageMultiplier).toBe(1.2)
    undeadRace.actionResolved?.(noded.state, basicAction(), 200)
    expect(noded.state.hero.accuracy).toBe(accuracy)
    expect(noded.state.hero.raceState.stillness).toBe(0)
  })

  it('Soul Harvest gains one Soul per kill up to 5 and keeps carried Souls', () => {
    expect(nodeId('undead', 'Soul Harvest')).toBe(NODE_UNDEAD_SOUL_HARVEST)
    const fight = open({ race: 'undead', nodes: [NODE_UNDEAD_SOUL_HARVEST], enemies: 3, enemy: { maxHp: 1 }, souls: 4 })
    expect(soulsOf(fight.state.hero)).toBe(4)
    runUntilDone(fight.state, fight.defs)
    expect(fight.state.outcome).toBe('victory')
    expect(soulsOf(fight.state.hero)).toBe(SOUL_CAP)
    const none = open({ race: 'undead', enemies: 2, enemy: { maxHp: 1 } })
    runUntilDone(none.state, none.defs)
    expect(none.state.hero.raceState.souls).toBeUndefined()
    const single = open({ race: 'undead', nodes: [NODE_UNDEAD_SOUL_HARVEST], enemies: 2, enemy: { maxHp: 1 } })
    runUntilDone(single.state, single.defs)
    expect(soulsOf(single.state.hero)).toBe(2)
  })

  it('Cursebound lets one chosen curse take effect, and the curse does nothing without it', () => {
    expect(nodeId('undead', 'Cursebound')).toBe(NODE_UNDEAD_CURSEBOUND)
    const plain = open({ race: 'undead' })
    const without = open({ race: 'undead', curse: CURSE_HOLLOW_HUNGER })
    const bound = open({ race: 'undead', curse: CURSE_HOLLOW_HUNGER, nodes: [NODE_UNDEAD_CURSEBOUND] })
    expect(without.state.hero.physicalPower).toBe(plain.state.hero.physicalPower)
    expect(bound.state.hero.physicalPower).toBeGreaterThan(plain.state.hero.physicalPower)
    expect(() => open({ race: 'undead', curse: 'bogus' })).toThrow(/curse must be one of/)
  })

  it('Hollow Hunger: +15% Power, -25% healing received, and one Soul heals 10% below 30% HP once', () => {
    const plain = open({ race: 'undead' })
    const fight = open({
      race: 'undead',
      curse: CURSE_HOLLOW_HUNGER,
      nodes: [NODE_UNDEAD_CURSEBOUND, NODE_UNDEAD_SOUL_HARVEST],
      souls: 2,
    })
    const hero = fight.state.hero
    expect(hero.physicalPower / plain.state.hero.physicalPower).toBeCloseTo(HOLLOW_POWER, 10)
    expect(hero.magicalPower / plain.state.hero.magicalPower).toBeCloseTo(HOLLOW_POWER, 10)
    expect(hero.healingPower / plain.state.hero.healingPower).toBeCloseTo(HOLLOW_POWER, 10)
    expect(hero.healingReceived / plain.state.hero.healingReceived).toBeCloseTo(HOLLOW_HEALING_RECEIVED, 10)
    hero.hp = hero.maxHp * 0.2
    undeadRace.damageTaken?.(fight.state, hit(fight.state, 1))
    expect(hero.hp).toBeCloseTo(hero.maxHp * 0.3, 6)
    expect(soulsOf(hero)).toBe(1)
    hero.hp = hero.maxHp * 0.2
    undeadRace.damageTaken?.(fight.state, hit(fight.state, 1))
    expect(hero.hp).toBeCloseTo(hero.maxHp * 0.2, 6)
    expect(soulsOf(hero)).toBe(1)
  })

  it('Grave Patience: 15% slower, Stillness after two actions, and a Soul keeps one progress', () => {
    const plain = open({ race: 'undead' })
    const fight = open({
      race: 'undead',
      curse: CURSE_GRAVE_PATIENCE,
      nodes: [NODE_UNDEAD_CURSEBOUND, NODE_UNDEAD_SOUL_HARVEST],
      souls: 1,
    })
    const hero = fight.state.hero
    expect(hero.baseActionSeconds / plain.state.hero.baseActionSeconds).toBeCloseTo(1 / 0.85, 10)
    expect(hero.actionTimeMs).toBe(Math.round(plain.state.hero.actionTimeMs / 0.85))
    expect(hero.nextReadyMs).toBe(hero.actionTimeMs)
    undeadRace.actionResolved?.(fight.state, basicAction(), 100)
    undeadRace.actionResolved?.(fight.state, basicAction(), 200)
    expect(hero.raceState.stillness).toBe(2)
    expect(raceLines(fight.state).some((line) => line.includes('progress is 2 of 2'))).toBe(true)
    undeadRace.actionChosen?.(fight.state, basicAction(), 300)
    undeadRace.actionResolved?.(fight.state, basicAction(), 300)
    expect(hero.raceState.stillness).toBe(1)
    expect(soulsOf(hero)).toBe(0)
    const dry = open({ race: 'undead', curse: CURSE_GRAVE_PATIENCE, nodes: [NODE_UNDEAD_CURSEBOUND] })
    dry.state.hero.raceState.stillness = 2
    undeadRace.actionChosen?.(dry.state, basicAction(), 300)
    undeadRace.actionResolved?.(dry.state, basicAction(), 300)
    expect(dry.state.hero.raceState.stillness).toBe(0)
  })

  it('Soul Debt: each held Soul adds 3% Power up to 15%, and rescue fees rise 50%', () => {
    const fight = open({
      race: 'undead',
      curse: CURSE_SOUL_DEBT,
      nodes: [NODE_UNDEAD_CURSEBOUND, NODE_UNDEAD_SOUL_HARVEST],
      souls: 5,
    })
    const modifier = undeadRace.outgoingModifiers
    expect(modifier?.(fight.state, { school: 'physical', skill: null })).toBeCloseTo(1.15, 10)
    fight.state.hero.raceState.souls = 2
    expect(modifier?.(fight.state, { school: 'magical', skill: null })).toBeCloseTo(1.06, 10)
    const bare = open({ race: 'undead' })
    expect(undeadRace.outgoingModifiers?.(bare.state, { school: 'physical', skill: null })).toBe(1)
    const road = (curse: string | undefined, nodes: readonly string[]) => {
      const hero = { ...comboSetup({ race: 'undead', classId: 'warrior', pairIndex: 0 }).hero, allocatedNodeIds: nodes, ...(curse !== undefined ? { curse } : {}) }
      const blueprint: ExpeditionBlueprint = {
        id: SPLINTERED_ROAD_ID,
        opening: [{ id: 'fight', enemies: [{ defId: DUMMY, slot: 0, level: 10 }] }],
        draw: [{ id: 'fight', enemies: [{ defId: DUMMY, slot: 0, level: 10 }] }],
        travelGapMs: 1000,
        retreatThresholds: [],
        hero,
      }
      return createExpedition(blueprint, 1)
    }
    expect(rescueFee(road(CURSE_SOUL_DEBT, [NODE_UNDEAD_CURSEBOUND]))).toBe(Math.round(25 * SOUL_DEBT_FEE))
    expect(rescueFee(road(CURSE_SOUL_DEBT, []))).toBe(25)
    expect(rescueFee(road(CURSE_HOLLOW_HUNGER, [NODE_UNDEAD_CURSEBOUND]))).toBe(25)
  })

  it('Deathly Precision spends a Soul on spent Stillness for a top roll and +25 points of crit', () => {
    expect(nodeId('undead', 'Deathly Precision')).toBe(NODE_UNDEAD_DEATHLY_PRECISION)
    const fight = open({ race: 'undead', nodes: [NODE_UNDEAD_SOUL_HARVEST, NODE_UNDEAD_DEATHLY_PRECISION], souls: 2 })
    const hero = fight.state.hero
    const crit = hero.critChance
    hero.raceState.stillness = 3
    undeadRace.actionChosen?.(fight.state, basicAction(), 100)
    expect(soulsOf(hero)).toBe(1)
    expect(hero.raceState.damageRollFloorBonus).toBe(1)
    expect(hero.critChance).toBeCloseTo(crit + PRECISION_CRIT, 10)
    undeadRace.actionResolved?.(fight.state, basicAction(), 200)
    expect(hero.critChance).toBeCloseTo(crit, 10)
    const empty = open({ race: 'undead', nodes: [NODE_UNDEAD_SOUL_HARVEST, NODE_UNDEAD_DEATHLY_PRECISION] })
    empty.state.hero.raceState.stillness = 3
    undeadRace.actionChosen?.(empty.state, basicAction(), 100)
    expect(empty.state.hero.raceState.damageRollFloorBonus).toBe(0.1)
    expect(empty.state.hero.critChance).toBe(crit)
  })
})

describe('combo builds', () => {
  it('every pair has a legal representative node list', () => {
    for (const pair of comboPairs()) {
      const ids = comboNodeIds(pair)
      const known = new Set([...classWebs[pair.classId].nodes, ...racialWebs[pair.race].nodes].map((node) => node.id))
      expect(ids.every((id) => known.has(id))).toBe(true)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.filter((id) => classWebs[pair.classId].nodes.find((node) => node.id === id)?.keystone === true)).toHaveLength(1)
    }
  })
})
