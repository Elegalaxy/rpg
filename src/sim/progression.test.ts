import { describe, expect, it } from 'vitest'

import { cumulativeXpToReachLevel, xpToNextLevel } from './stats.ts'
import {
  HERO_RACES,
  allocateAttribute,
  allocateNode,
  awardXp,
  createProgress,
  grantLegacySkillPoint,
  previewAllocation,
  setAttachment,
  setLoadout,
  xpFromEnemies,
  type HeroProgress,
  type SkillWeb,
} from './progression.ts'

const human = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }

function fresh(race: HeroProgress['race'] = 'human'): HeroProgress {
  return createProgress(race, human)
}

describe('hero progression', () => {
  it('starts at level 1 with the racial base already spent', () => {
    const started = HERO_RACES.map((race) => createProgress(race, human))
    console.log('[sim]', 'create progress', started.map((progress) => progress.race))
    for (const progress of started) {
      expect(progress.level).toBe(1)
      expect(progress.xp).toBe(0)
      expect(progress.unspentAttributePoints).toBe(0)
      expect(progress.unspentSkillPoints).toBe(0)
      expect(progress.attributes).toEqual(human)
    }
    expect(cumulativeXpToReachLevel(20)).toBe(33567)
    expect(() => createProgress('human', { ...human, vitality: -1 })).toThrow(/vitality/)
    expect(() => createProgress('human', { ...human, strength: 10.5 })).toThrow(/strength/)
    expect(() => createProgress('orc' as 'human', human)).toThrow(/unknown race/)
  })

  it('levels up from the existing XP curve and grants points on the new level', () => {
    const level1Cost = xpToNextLevel(1)
    const level2Cost = xpToNextLevel(2)
    const reached2 = awardXp(fresh(), level1Cost)
    const reached3 = awardXp(fresh(), level1Cost + level2Cost)
    const toLevel6 = cumulativeXpToReachLevel(6)
    const reached6 = awardXp(fresh(), toLevel6)
    const untouched = fresh()
    const zero = awardXp(untouched, 0)
    console.log('[sim]', 'level up', {
      level1Cost,
      reached2,
      level2Cost,
      reached3,
      toLevel6,
      reached6,
      zero,
    })
    expect(level1Cost).toBe(50)
    expect(reached2).toMatchObject({ level: 2, xp: 0, unspentAttributePoints: 2, unspentSkillPoints: 0 })
    expect(reached3).toMatchObject({ level: 3, xp: 0, unspentAttributePoints: 4, unspentSkillPoints: 1 })
    expect(reached6.level).toBe(6)
    expect(reached6.xp).toBe(0)
    expect(reached6.unspentSkillPoints).toBe(2)
    expect(reached6.unspentAttributePoints).toBe(10)
    expect(zero).toEqual(untouched)
    expect(untouched).toEqual(fresh())
  })

  it('rejects a broken progress record', () => {
    const progress = fresh()
    console.log('[sim]', 'reject progress', { level: progress.level, xp: progress.xp })
    expect(() => awardXp({ ...progress, level: 0 }, 1)).toThrow(/level/)
    expect(() => awardXp({ ...progress, level: -2 }, 1)).toThrow(/level/)
    expect(() => awardXp({ ...progress, xp: -1 }, 1)).toThrow(/xp/)
    expect(() => awardXp({ ...progress, unspentAttributePoints: -1 }, 1)).toThrow(/unspent attribute/)
    expect(() => awardXp({ ...progress, unspentSkillPoints: -1 }, 1)).toThrow(/unspent skill/)
    expect(() =>
      awardXp({ ...progress, attributes: { ...progress.attributes, agility: -1 } }, 1),
    ).toThrow(/agility/)
    expect(() => awardXp(progress, -5)).toThrow(/xp award/)
    expect(() => awardXp(progress, 1.5)).toThrow(/xp award/)
  })

  it('spends unspent attribute points and rejects illegal spends', () => {
    const leveled = awardXp(fresh(), 50)
    const spent = allocateAttribute(leveled, 'strength', 1)
    console.log('[sim]', 'allocate', {
      before: { strength: leveled.attributes.strength, pool: leveled.unspentAttributePoints },
      after: { strength: spent.attributes.strength, pool: spent.unspentAttributePoints },
    })
    expect(leveled.unspentAttributePoints).toBe(2)
    expect(spent.attributes.strength).toBe(11)
    expect(spent.unspentAttributePoints).toBe(1)
    expect(spent.attributes.vitality).toBe(10)
    expect(leveled.attributes.strength).toBe(10)
    expect(() => allocateAttribute(leveled, 'strength', 0)).toThrow(/positive integer/)
    expect(() => allocateAttribute(leveled, 'strength', 1.5)).toThrow(/positive integer/)
    expect(() => allocateAttribute(leveled, 'strength', -1)).toThrow(/positive integer/)
    expect(() => allocateAttribute(leveled, 'power', 1)).toThrow(/unknown attribute/)
    expect(() => allocateAttribute(leveled, 'strength', 3)).toThrow(/exceeds/)
  })

  it('scales enemy XP by level gap and Spirit, then rounds once', () => {
    const equal = xpFromEnemies(4, 0, [{ xp: 15, level: 4, summon: false }])
    const heroAbove = xpFromEnemies(8, 0, [{ xp: 100, level: 3, summon: false }])
    const aboveFactor = Math.max(0.1, 0.75 ** 5)
    const enemyAbove = xpFromEnemies(2, 0, [{ xp: 100, level: 8, summon: false }])
    const higherRaw = 1 + 0.05 * 6
    const spirited = xpFromEnemies(5, 50, [{ xp: 100, level: 5, summon: false }])
    const spiritFactor = 1 + (0.1 * 50) / (50 + 50)
    const pair = xpFromEnemies(1, 0, [
      { xp: 10, level: 1, summon: false },
      { xp: 10, level: 1, summon: false },
    ])
    const six = xpFromEnemies(
      3,
      0,
      [0, 1, 2, 3, 4, 5].map(() => ({ xp: 10, level: 3, summon: false })),
    )
    const capped = Math.round(60 * (1 - 0.2))
    const uncapped = Math.round(60 * (1 - 0.25))
    const withSummon = xpFromEnemies(4, 0, [
      { xp: 15, level: 4, summon: false },
      { xp: 100, level: 9, summon: true },
    ])
    const pairAndSummon = xpFromEnemies(1, 0, [
      { xp: 10, level: 1, summon: false },
      { xp: 99, level: 9, summon: true },
      { xp: 10, level: 1, summon: false },
    ])
    const onlySummon = xpFromEnemies(1, 0, [{ xp: 40, level: 3, summon: true }])
    const pairAbove = xpFromEnemies(10, 0, [
      { xp: 100, level: 5, summon: false },
      { xp: 100, level: 5, summon: false },
    ])
    console.log('[sim]', 'encounter xp', {
      equal,
      heroAbove,
      aboveFactor,
      enemyAbove,
      higherRaw,
      spirited,
      spiritFactor,
      pair,
      six,
      capped,
      uncapped,
      withSummon,
      pairAndSummon,
      onlySummon,
      pairAbove,
    })
    expect(equal).toBe(15)
    expect(heroAbove).toBe(Math.round(100 * aboveFactor))
    expect(heroAbove).toBe(24)
    expect(higherRaw).toBeCloseTo(1.3, 10)
    expect(enemyAbove).toBe(Math.round(100 * 1.25))
    expect(enemyAbove).toBe(125)
    expect(spiritFactor).toBeCloseTo(1.05, 10)
    expect(spirited).toBe(105)
    expect(pair).toBe(19)
    expect(six).toBe(48)
    expect(capped).toBe(48)
    expect(uncapped).toBe(45)
    expect(withSummon).toBe(15)
    expect(pairAndSummon).toBe(19)
    expect(onlySummon).toBe(0)
    expect(pairAbove).toBe(45)
    expect(() => xpFromEnemies(0, 0, [{ xp: 10, level: 1, summon: false }])).toThrow(/hero level/)
    expect(() => xpFromEnemies(-1, 0, [{ xp: 10, level: 1, summon: false }])).toThrow(/hero level/)
    expect(() => xpFromEnemies(1, -1, [{ xp: 10, level: 1, summon: false }])).toThrow(/spirit/)
    expect(() => xpFromEnemies(1, 0, [{ xp: -5, level: 1, summon: false }])).toThrow(/enemy xp/)
    expect(() => xpFromEnemies(1, 0, [{ xp: 10, level: 0, summon: false }])).toThrow(/enemy level/)
    expect(() => xpFromEnemies(1, 0, [{ xp: 10, level: -2, summon: false }])).toThrow(/enemy level/)
  })
})

const fixtureWeb: SkillWeb = {
  classId: 'warrior',
  startingSkillIds: ['start-a', 'start-b', 'start-c', 'start-d'],
  nodes: [
    {
      id: 'alpha',
      name: 'Alpha',
      cluster: 'One',
      index: 1,
      cost: 1,
      requires: null,
      keystone: false,
      unlocksSkillId: 'opened',
    },
    {
      id: 'beta',
      name: 'Beta',
      cluster: 'One',
      index: 2,
      cost: 1,
      requires: 'alpha',
      keystone: false,
      unlocksSkillId: 'opened',
    },
    {
      id: 'key-a',
      name: 'Key A',
      cluster: 'One',
      index: 5,
      cost: 1,
      requires: null,
      keystone: true,
      unlocksSkillId: null,
    },
    {
      id: 'key-b',
      name: 'Key B',
      cluster: 'Two',
      index: 5,
      cost: 1,
      requires: null,
      keystone: true,
      unlocksSkillId: 'finisher',
    },
  ],
}

function withSkillPoints(count: number): HeroProgress {
  let progress = fresh()
  let guard = 0
  while (progress.unspentSkillPoints < count) {
    progress = awardXp(progress, xpToNextLevel(progress.level))
    guard += 1
    if (guard > 40) throw new Error(`could not reach ${count} skill points`)
  }
  if (progress.unspentSkillPoints !== count) {
    throw new Error(`reached ${progress.unspentSkillPoints} skill points, wanted ${count}`)
  }
  return progress
}

describe('skill allocation', () => {
  it('rejects a skipped node, a second keystone, and a missing point', () => {
    const broke = fresh()
    const one = withSkillPoints(1)
    const two = withSkillPoints(2)
    console.log('[sim]', 'illegal allocation', {
      points: broke.unspentSkillPoints,
      legacy: broke.legacySkillPoints,
      one: one.unspentSkillPoints,
      two: two.unspentSkillPoints,
    })
    expect(() => allocateNode(one, fixtureWeb, 'beta')).toThrow(/requires alpha/)
    expect(one.allocatedNodeIds).toEqual([])
    expect(() => allocateNode(broke, fixtureWeb, 'alpha')).toThrow(/not enough skill points/)
    expect(broke).toEqual(fresh())
    const firstKey = allocateNode(two, fixtureWeb, 'key-a')
    expect(firstKey.allocatedNodeIds).toEqual(['key-a'])
    expect(two.allocatedNodeIds).toEqual([])
    expect(() => allocateNode(firstKey, fixtureWeb, 'key-b')).toThrow(/another keystone/)
    expect(() => allocateNode(one, fixtureWeb, 'missing')).toThrow(/unknown node/)
    expect(() => previewAllocation(one, fixtureWeb, 'missing')).toThrow(/unknown node/)
  })

  it('rejects an already allocated node without spending again', () => {
    const ready = withSkillPoints(1)
    const taken = allocateNode(ready, fixtureWeb, 'alpha')
    console.log('[sim]', 'repeat node', {
      before: ready.allocatedNodeIds,
      after: taken.allocatedNodeIds,
      points: taken.unspentSkillPoints,
      learned: taken.learnedSkillIds,
    })
    expect(taken).not.toBe(ready)
    expect(taken.allocatedNodeIds).toEqual(['alpha'])
    expect(taken.unspentSkillPoints).toBe(0)
    expect(taken.learnedSkillIds).toEqual(['opened'])
    expect(ready.allocatedNodeIds).toEqual([])
    expect(ready.unspentSkillPoints).toBe(1)
    expect(() => allocateNode(taken, fixtureWeb, 'alpha')).toThrow(/already allocated/)
    expect(taken.allocatedNodeIds).toEqual(['alpha'])
    expect(taken.unspentSkillPoints).toBe(0)
    expect(taken.learnedSkillIds).toEqual(['opened'])
  })

  it('spends legacy points only after ordinary points and learns a skill once', () => {
    const ready = grantLegacySkillPoint(withSkillPoints(1))
    const first = allocateNode(ready, fixtureWeb, 'alpha')
    const second = allocateNode(first, fixtureWeb, 'beta')
    console.log('[sim]', 'spend order', {
      before: { ordinary: ready.unspentSkillPoints, legacy: ready.legacySkillPoints },
      afterFirst: {
        ordinary: first.unspentSkillPoints,
        legacy: first.legacySkillPoints,
        learned: first.learnedSkillIds,
      },
      afterSecond: {
        ordinary: second.unspentSkillPoints,
        legacy: second.legacySkillPoints,
        learned: second.learnedSkillIds,
      },
    })
    expect(ready.unspentSkillPoints).toBe(1)
    expect(ready.legacySkillPoints).toBe(1)
    expect(ready.allocatedNodeIds).toEqual([])
    expect(first.unspentSkillPoints).toBe(0)
    expect(first.legacySkillPoints).toBe(1)
    expect(first.learnedSkillIds).toEqual(['opened'])
    expect(second.unspentSkillPoints).toBe(0)
    expect(second.legacySkillPoints).toBe(0)
    expect(second.learnedSkillIds).toEqual(['opened'])
    expect(second.allocatedNodeIds).toEqual(['alpha', 'beta'])
    const kept = awardXp(second, 0)
    expect(kept.allocatedNodeIds).toEqual(['alpha', 'beta'])
    expect(kept.learnedSkillIds).toEqual(['opened'])
    expect(kept.legacySkillPoints).toBe(0)
  })

  it('rejects an illegal loadout and any racial attachment', () => {
    const started = createProgress('human', human, {
      startingSkillIds: ['a', 'b', 'c', 'd'],
    })
    console.log('[sim]', 'starting loadout', {
      learned: started.learnedSkillIds,
      loadout: started.loadout,
      slots: started.attachmentSlots,
    })
    expect(started.learnedSkillIds).toEqual(['a', 'b', 'c', 'd'])
    expect(started.loadout).toEqual(['a', 'b', 'c', 'd'])
    expect(started.allocatedNodeIds).toEqual([])
    expect(started.legacySkillPoints).toBe(0)
    expect(started.attachmentSlots).toEqual([null, null])
    expect(() => createProgress('human', human, { startingSkillIds: ['a', 'b', 'c'] })).toThrow(/starting skill/)
    expect(() => setLoadout(started, [])).toThrow(/1 to 4/)
    expect(() => setLoadout(started, ['a', 'b', 'c', 'd', 'a'])).toThrow(/1 to 4/)
    expect(() => setLoadout(started, ['a', 'a'])).toThrow(/duplicate/)
    expect(() => setLoadout(started, ['a', ''])).toThrow(/empty/)
    expect(() => setLoadout(started, ['nope'])).toThrow(/unlearned/)
    const swapped = setLoadout(started, ['d', 'c', 'b'])
    expect(swapped.loadout).toEqual(['d', 'c', 'b'])
    expect(started.loadout).toEqual(['a', 'b', 'c', 'd'])
    expect(() => setAttachment(started, 0, 'human-quick-study')).toThrow(
      'no racial node can be attached yet',
    )
    expect(() => setAttachment(started, 2, 'human-quick-study')).toThrow(/slot must be 0 or 1/)
    expect(started.attachmentSlots).toEqual([null, null])
  })

  it('previews a blocked keystone without changing progress', () => {
    const ready = withSkillPoints(2)
    const legal = previewAllocation(ready, fixtureWeb, 'alpha')
    const taken = allocateNode(ready, fixtureWeb, 'key-a')
    const blocked = previewAllocation(taken, fixtureWeb, 'key-b')
    console.log('[sim]', blocked)
    expect(legal).toEqual({
      cost: 1,
      canTake: true,
      missingRequirementId: null,
      unlocksSkillId: 'opened',
      blockedKeystoneIds: [],
      reasons: [],
    })
    expect(blocked).toEqual({
      cost: 1,
      canTake: false,
      missingRequirementId: null,
      unlocksSkillId: 'finisher',
      blockedKeystoneIds: ['key-a'],
      reasons: ['another keystone is allocated'],
    })
    expect(ready.allocatedNodeIds).toEqual([])
    expect(ready.unspentSkillPoints).toBe(2)
    expect(taken.unspentSkillPoints).toBe(1)
    expect(taken.allocatedNodeIds).toEqual(['key-a'])
  })
})
