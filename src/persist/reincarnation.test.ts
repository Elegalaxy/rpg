import { describe, expect, it } from 'vitest'

import { newItem } from '../content/items.ts'
import { racialStartingAttributes } from '../content/heroes.ts'
import { gameDefs } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { legacyFromProgress, awardXp, xpFromEnemies, createProgress } from '../sim/progression.ts'
import { stepExpedition } from '../sim/expedition.ts'
import { cumulativeXpToReachLevel } from '../sim/stats.ts'

import { selectedHero } from './character.ts'
import { DEEP_POCKETS_COST } from './bag.ts'
import { collectContract } from './contracts.ts'
import { equipFromArchive } from './equipment.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import {
  ATTRIBUTE_SEED_COST,
  HEAD_START_COSTS,
  SECOND_HEIRLOOM_COST,
  SKILL_SEED_COSTS,
  bonusesDue,
  buyPurchase,
  headStartCost,
  headStartLevel,
  heirloomLevel,
  legacyPreview,
  masteryRank,
  masteryXpFactor,
  nextLifePreview,
  recallNeed,
  recallXp,
  reincarnate,
  reincarnationBlock,
  scaleHeirlooms,
} from './reincarnation.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData, purseOf, updatePurse } from './save.ts'
import { outcomeStats, outcomeSummary, settleExpedition } from './world.ts'

function heroSave(race: 'human' | 'elf' = 'human'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race, classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

/** A hero deep into a life, who has lost to a boss, ready to reincarnate. */
function veteran(): SaveData {
  const save = heroSave()
  const progress = awardXp(
    { ...hero(save).progress, allocatedNodeIds: ['warrior-driving-blow'], unspentSkillPoints: 2, unspentAttributePoints: 4 },
    1000,
  )
  const purse = {
    ...save.heroes[0]!.purse,
    gold: 77,
    materials: { shard: 5 },
    contracts: [{ contractId: 'cull-the-pack', progress: 2 }],
    archive: [newItem('spare', 'weapon-bow', 1, 1.07)],
  }
  const withWork: SaveData = {
    ...save,
    account: {
      ...save.account,
      recipes: ['keen', 'precise', 'nimble'],
      discoveries: [...save.account.discoveries, 'node:withered-grove'],
    },
    heroes: save.heroes.map((h) => ({
      ...h,
      purse,
      progress,
      craftXp: 9,
      bossLossThisLife: true,
      echoRank: 2,
      fightRank: 1,
      defeatedEnemyIds: ['rootmaw-stalker', 'echo-knight', 'fractured-warden'],
      clearedNodeIds: ['splintered-road', 'withered-grove'],
      priorityRows: [{ skillId: 'cleave' }],
      ruleStacks: [{ id: 'stack-1', name: 'Pack', when: [], rows: [{ skillId: 'cleave' }] }],
    })),
  }
  return withWork
}

describe('eligibility and currency', () => {
  it('needs a boss faced this life and no running expedition', () => {
    const fresh = heroSave()
    expect(reincarnationBlock(fresh, hero(fresh))).toMatch(/Face a boss first/)
    expect(reincarnate(fresh, 'hero-1', null).ok).toBe(false)
    const lost = veteran()
    expect(reincarnationBlock(lost, hero(lost))).toBeNull()
    const running = { ...lost, expedition: startExpedition(hero(lost), 'splintered-road', 1) }
    expect(reincarnationBlock(running, hero(running))).toBe('Finish the expedition first.')
    expect(reincarnate(lost, 'nobody', null)).toEqual({ ok: false, reason: 'That hero is not on the roster.' })
  })

  it('converts level and XP: 2 x (level - 1) plus a fifth-step share of the XP into the level', () => {
    const at = (level: number, xp: number) => legacyFromProgress({ ...createProgress('human', racialStartingAttributes.human), level, xp })
    expect(at(1, 0)).toBe(0)
    expect(at(1, 49)).toBe(4)
    expect(at(5, 0)).toBe(8)
    expect(at(20, 0)).toBe(38)
    expect(legacyFromProgress(hero(veteran()).progress)).toBeGreaterThan(0)
  })

  it('pays each milestone bonus once, the first time the hero reaches it', () => {
    const lost = veteran()
    const due = bonusesDue(hero(lost))
    expect(due.map((bonus) => [bonus.id, bonus.amount])).toEqual([
      ['elite:rootmaw-stalker', 3],
      ['elite:echo-knight', 3],
      ['boss:fractured-warden', 20],
      ['rank:1', 5],
      ['rank:2', 5],
    ])
    const preview = legacyPreview(hero(lost))
    expect(preview.total).toBe(preview.fromLevel + 36)
    const first = ok(reincarnate(lost, 'hero-1', null))
    expect(hero(first).legacy).toBe(preview.total)
    expect(hero(first).claimedBonuses).toEqual(['elite:rootmaw-stalker', 'elite:echo-knight', 'boss:fractured-warden', 'rank:1', 'rank:2'])
    const again = {
      ...first,
      heroes: first.heroes.map((h) => ({ ...h, bossLossThisLife: true, defeatedEnemyIds: ['echo-knight'], echoRank: 3 })),
    }
    expect(bonusesDue(hero(again)).map((bonus) => bonus.id)).toEqual(['rank:3'])
  })
})

describe('what reincarnation resets', () => {
  const after = () => ok(reincarnate(veteran(), 'hero-1', null))

  it('resets level, XP, attributes, the skill web, and points', () => {
    const next = hero(after())
    expect(next.progress.level).toBe(1)
    expect(next.progress.xp).toBe(0)
    expect(next.progress.attributes).toEqual(racialStartingAttributes.human)
    expect(next.progress.allocatedNodeIds).toEqual([])
    expect(next.progress.unspentAttributePoints).toBe(0)
    expect(next.progress.unspentSkillPoints).toBe(0)
    expect(next.progress.learnedSkillIds).toEqual([...classWebs.warrior.startingSkillIds])
    expect(next.progress.loadout).toEqual([...classWebs.warrior.startingSkillIds])
    expect(next.priorityRows.length).toBeGreaterThan(1)
    expect(next.priorityRows).not.toEqual([{ skillId: 'cleave' }])
    expect(next.ruleStacks).toEqual([])
  })

  it('resets personal world gates, Echo ranks, the boss loss flag, and the account contracts', () => {
    const save = after()
    const next = hero(save)
    expect(next.defeatedEnemyIds).toEqual([])
    expect(next.clearedNodeIds).toEqual([])
    expect([next.echoRank, next.fightRank, next.bossLossThisLife]).toEqual([0, 0, false])
    expect(purseOf(save).contracts).toEqual([])
  })

  it('keeps mastery, purchases, Legacy, discoveries, recipes, crafting experience, gold, materials, and the archive', () => {
    const before = veteran()
    const save = ok(reincarnate(before, 'hero-1', null))
    const next = hero(save)
    expect(next.lives).toBe(1)
    expect(masteryRank(next)).toBe(1)
    expect(next.purchases).toEqual(hero(before).purchases)
    expect(next.legacy).toBeGreaterThan(0)
    expect(save.account.discoveries).toEqual(before.account.discoveries)
    expect(save.account.recipes).toEqual(['keen', 'precise', 'nimble'])
    expect(next.craftXp).toBe(9)
    expect(purseOf(save).gold).toBe(77)
    expect(purseOf(save).materials).toEqual({ shard: 5 })
    expect(purseOf(save).archive.find((item) => item.id === 'spare')).toEqual(purseOf(before).archive[0])
    expect(next.vow).toBe(hero(before).vow)
    expect(next.name).toBe('Ash')
  })

  it('archives all worn gear and gives fresh starter gear with new ids', () => {
    const before = veteran()
    const save = ok(reincarnate(before, 'hero-1', null))
    const worn = Object.values(hero(before).equipment).map((item) => item!.id)
    const archived = purseOf(save).archive.map((item) => item.id)
    for (const id of worn) expect(archived).toContain(id)
    const fresh = Object.values(hero(save).equipment).map((item) => item!.id)
    expect(new Set(fresh).size).toBe(8)
    for (const id of fresh) expect(worn).not.toContain(id)
    expect(fresh[0]).toBe('hero-1-L1-mainHand')
    expect(() => assertSaveData(save)).not.toThrow()
    expect(parseSave(serializeSave(save)).ok).toBe(true)
    const twice = ok(reincarnate({ ...save, heroes: save.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }, 'hero-1', null))
    expect(Object.values(hero(twice).equipment)[0]!.id).toBe('hero-1-L2-mainHand')
    expect(() => assertSaveData(twice)).not.toThrow()
  })

  it('opens the first-reincarnation slot once', () => {
    const save = after()
    expect(save.account.milestones).toContain('first-reincarnation')
    expect(save.account.slots).toBe(3)
    const second = ok(reincarnate({ ...save, heroes: save.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }, 'hero-1', null))
    expect(second.account.slots).toBe(3)
  })
})

describe('the heirloom', () => {
  it('flags the chosen item for its hero, caps it at the level it had, and scales it to level 1', () => {
    const lost = veteran()
    const strong = { ...lost, heroes: lost.heroes.map((h) => ({ ...h, equipment: { ...h.equipment, mainHand: { ...h.equipment.mainHand!, itemLevel: 1, quality: 1.08 } } })) }
    const level7 = updatePurse(strong, { archive: [newItem('blade', 'weapon-one-handed', 7, 1.09)] })
    const next = ok(reincarnate(level7, 'hero-1', 'blade'))
    const blade = purseOf(next).archive.find((item) => item.id === 'blade')!
    expect(blade.heirloom).toEqual({ heroId: 'hero-1', cap: 7 })
    expect(blade.itemLevel).toBe(1)
    expect(blade.quality).toBe(1.09)
  })

  it('grows with the hero up to its cap, and no further', () => {
    const lost = veteran()
    const level7 = updatePurse(lost, { archive: [newItem('blade', 'weapon-one-handed', 7, 1.09)] })
    let save = ok(reincarnate(level7, 'hero-1', 'blade'))
    const at = (level: number) => {
      save = { ...save, heroes: save.heroes.map((h) => ({ ...h, progress: { ...h.progress, level } })) }
      save = scaleHeirlooms(save, 'hero-1')
      return purseOf(save).archive.find((item) => item.id === 'blade')!.itemLevel
    }
    expect([at(1), at(4), at(7), at(12)]).toEqual([1, 4, 7, 7])
    expect(heirloomLevel(newItem('x', 'weapon-bow', 9), 3)).toBe(3)
    expect(heirloomLevel({ ...newItem('x', 'weapon-bow', 1), heirloom: { heroId: 'h', cap: 6 } }, 20)).toBe(6)
  })

  it('can be equipped by its hero at the scaled level, and by no one else', () => {
    const lost = veteran()
    const save = ok(reincarnate(updatePurse(lost, { archive: [newItem('blade', 'weapon-one-handed', 7)] }), 'hero-1', 'blade'))
    const equipped = ok(equipFromArchive(save, 'hero-1', 'blade'))
    expect(hero(equipped).equipment.mainHand?.id).toBe('blade')
    expect(hero(equipped).equipment.mainHand?.itemLevel).toBe(1)
    const other = createHero(save, { name: 'Cinder', race: 'elf', classId: 'mage' })
    if (!other.ok) throw new Error(other.reason)
    const shared = { ...other.save, account: { ...other.save.account, slots: 3 } }
    expect(equipFromArchive(shared, 'hero-2', 'blade')).toEqual({ ok: false, reason: 'That item is not in the archive.' })
  })

  it('keeps one heirloom, or two with the Second Heirloom, and releases an older one at its cap', () => {
    const lost = veteran()
    const first = ok(reincarnate(updatePurse(lost, { archive: [newItem('a', 'weapon-bow', 5)] }), 'hero-1', 'a'))
    const stocked = updatePurse(first, { archive: [...purseOf(first).archive, newItem('b', 'weapon-dagger', 6)] })
    const armed = { ...stocked, heroes: stocked.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    const one = ok(reincarnate(armed, 'hero-1', 'b'))
    const flagged = (save: SaveData) => purseOf(save).archive.filter((item) => item.heirloom !== undefined).map((item) => item.id).sort()
    expect(flagged(one)).toEqual(['b'])
    expect(purseOf(one).archive.find((item) => item.id === 'a')).toMatchObject({ itemLevel: 5 })
    expect(purseOf(one).archive.find((item) => item.id === 'a')?.heirloom).toBeUndefined()
    const second = { ...armed, heroes: armed.heroes.map((h) => ({ ...h, purchases: { ...h.purchases, secondHeirloom: true } })) }
    expect(flagged(ok(reincarnate(second, 'hero-1', 'b')))).toEqual(['a', 'b'])
    expect(reincarnate(lost, 'hero-1', 'nothing')).toEqual({ ok: false, reason: 'That item is not yours to keep.' })
  })
})

describe('purchases', () => {
  const rich = (): SaveData => ({ ...heroSave(), heroes: heroSave().heroes.map((h) => ({ ...h, legacy: 200 })) })

  it('Attribute Seed costs 3, adds one to the starting attribute, and stops at 10', () => {
    let save = rich()
    for (let index = 0; index < 10; index += 1) save = ok(buyPurchase(save, 'hero-1', 'attribute', index < 6 ? 'strength' : 'vitality'))
    expect(hero(save).legacy).toBe(200 - 10 * ATTRIBUTE_SEED_COST)
    expect(hero(save).purchases.attributeSeeds).toMatchObject({ strength: 6, vitality: 4 })
    expect(buyPurchase(save, 'hero-1', 'attribute', 'agility')).toEqual({ ok: false, reason: 'You already have 10 attribute seeds.' })
    expect(buyPurchase(rich(), 'hero-1', 'attribute').ok).toBe(false)
    const lost = { ...save, heroes: save.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    const next = hero(ok(reincarnate(lost, 'hero-1', null)))
    expect(next.progress.attributes.strength).toBe(racialStartingAttributes.human.strength + 6)
    expect(next.progress.attributes.vitality).toBe(racialStartingAttributes.human.vitality + 4)
    expect(next.progress.attributes.agility).toBe(racialStartingAttributes.human.agility)
  })

  it('Deep Pockets costs 15 Legacy, can be bought once, and survives reincarnation', () => {
    expect(DEEP_POCKETS_COST).toBe(15)
    expect(hero(rich()).purchases.deepPockets).toBe(false)
    const bought = ok(buyPurchase(rich(), 'hero-1', 'pockets'))
    expect(hero(bought).legacy).toBe(200 - DEEP_POCKETS_COST)
    expect(hero(bought).purchases.deepPockets).toBe(true)
    expect(buyPurchase(bought, 'hero-1', 'pockets')).toEqual({ ok: false, reason: 'You already have Deep Pockets.' })
    const poor = { ...heroSave(), heroes: heroSave().heroes.map((h) => ({ ...h, legacy: 14 })) }
    expect(buyPurchase(poor, 'hero-1', 'pockets').ok).toBe(false)
    const lost = { ...bought, heroes: bought.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    expect(hero(ok(reincarnate(lost, 'hero-1', null))).purchases.deepPockets).toBe(true)
  })

  it('Skill Point Seed costs 8, 12, then 16, and gives an unallocated point each life', () => {
    expect(SKILL_SEED_COSTS).toEqual([8, 12, 16])
    let save = rich()
    for (let index = 0; index < 3; index += 1) save = ok(buyPurchase(save, 'hero-1', 'skill'))
    expect(hero(save).legacy).toBe(200 - 36)
    expect(buyPurchase(save, 'hero-1', 'skill')).toEqual({ ok: false, reason: 'You already have all 3 skill point seeds.' })
    const lost = { ...save, heroes: save.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    expect(hero(ok(reincarnate(lost, 'hero-1', null))).progress.legacySkillPoints).toBe(3)
  })

  it('Second Heirloom costs 25 and is bought once', () => {
    const save = ok(buyPurchase(rich(), 'hero-1', 'heirloom'))
    expect(hero(save).legacy).toBe(200 - SECOND_HEIRLOOM_COST)
    expect(hero(save).purchases.secondHeirloom).toBe(true)
    expect(buyPurchase(save, 'hero-1', 'heirloom')).toEqual({ ok: false, reason: 'You already have the Second Heirloom.' })
  })

  describe('apply to the current life (Step 13.30)', () => {
    const base = racialStartingAttributes.human
    const lose = (save: SaveData): SaveData => ({ ...save, heroes: save.heroes.map((h) => ({ ...h, bossLossThisLife: true })) })
    const at = (save: SaveData, xp: number): SaveData => ({
      ...save,
      heroes: save.heroes.map((h) => ({ ...h, progress: awardXp(h.progress, xp) })),
    })

    it('Attribute Seed adds one to the current attribute exactly once, and the next life is unchanged', () => {
      const before = hero(rich()).progress
      const save = ok(buyPurchase(rich(), 'hero-1', 'attribute', 'vitality'))
      expect(hero(save).progress.attributes.vitality).toBe(before.attributes.vitality + 1)
      expect(hero(save).progress.attributes.strength).toBe(before.attributes.strength)
      const twice = ok(buyPurchase(save, 'hero-1', 'attribute', 'vitality'))
      expect(hero(twice).progress.attributes.vitality).toBe(before.attributes.vitality + 2)
      expect(hero(ok(reincarnate(lose(save), 'hero-1', null))).progress.attributes.vitality).toBe(base.vitality + 1)
    })

    it('Skill Point Seed adds one skill point now', () => {
      const save = ok(buyPurchase(rich(), 'hero-1', 'skill'))
      expect(hero(save).progress.legacySkillPoints).toBe(1)
      expect(hero(ok(buyPurchase(save, 'hero-1', 'skill'))).progress.legacySkillPoints).toBe(2)
      expect(hero(ok(reincarnate(lose(save), 'hero-1', null))).progress.legacySkillPoints).toBe(1)
    })

    it('Head Start from level 1 raises the hero to that level with unspent points, and II after I needs the difference', () => {
      const first = ok(buyPurchase(rich(), 'hero-1', 'headStart'))
      const fresh = createProgress('human', base, { startingSkillIds: classWebs.warrior.startingSkillIds })
      const expected = awardXp(fresh, cumulativeXpToReachLevel(5))
      expect(hero(first).progress).toMatchObject({
        level: 5,
        xp: expected.xp,
        unspentAttributePoints: expected.unspentAttributePoints,
        unspentSkillPoints: expected.unspentSkillPoints,
      })
      expect(hero(first).progress.unspentAttributePoints).toBeGreaterThan(0)
      const second = ok(buyPurchase(first, 'hero-1', 'headStart'))
      const expectedTen = awardXp(fresh, cumulativeXpToReachLevel(10))
      expect(hero(second).progress).toMatchObject({
        level: 10,
        unspentAttributePoints: expectedTen.unspentAttributePoints,
        unspentSkillPoints: expectedTen.unspentSkillPoints,
      })
    })

    it('Head Start changes nothing now for a hero already at or above its level', () => {
      const high = at(rich(), cumulativeXpToReachLevel(12))
      expect(hero(high).progress.level).toBe(12)
      const bought = ok(buyPurchase(high, 'hero-1', 'headStart'))
      expect(hero(bought).progress).toEqual(hero(high).progress)
      expect(hero(bought).purchases.headStart).toBe(1)
    })

    it('Head Start scales an heirloom to the new level', () => {
      const withHeirloom = updatePurse(rich(), { archive: [{ ...newItem('h', 'weapon-bow', 9), heirloom: { heroId: 'hero-1', cap: 9 } }] })
      const bought = ok(buyPurchase(withHeirloom, 'hero-1', 'headStart'))
      expect(purseOf(bought).archive.find((item) => item.id === 'h')?.itemLevel).toBe(5)
    })

    it('reincarnating after buying mid-life gives the same new life as buying first', () => {
      const early = lose(
        [
          (s: SaveData) => ok(buyPurchase(s, 'hero-1', 'attribute', 'agility')),
          (s: SaveData) => ok(buyPurchase(s, 'hero-1', 'skill')),
          (s: SaveData) => ok(buyPurchase(s, 'hero-1', 'headStart')),
          (s: SaveData) => ok(buyPurchase(s, 'hero-1', 'headStart')),
        ].reduce((s, step) => step(s), rich()),
      )
      const viaRecord: SaveData = {
        ...early,
        heroes: early.heroes.map((h) => ({ ...h, progress: { ...h.progress, level: 1, xp: 0 } })),
      }
      const a = hero(ok(reincarnate(early, 'hero-1', null))).progress
      const b = hero(ok(reincarnate(viaRecord, 'hero-1', null))).progress
      expect(a).toEqual(b)
      expect(a.level).toBe(10)
      expect(a.attributes.agility).toBe(base.agility + 1)
      expect(a.legacySkillPoints).toBe(1)
    })

    it('Second Heirloom and Deep Pockets leave the progress alone', () => {
      const before = hero(rich()).progress
      expect(hero(ok(buyPurchase(rich(), 'hero-1', 'heirloom'))).progress).toEqual(before)
      expect(hero(ok(buyPurchase(rich(), 'hero-1', 'pockets'))).progress).toEqual(before)
    })
  })

  it('refuses a purchase the hero cannot pay for, and during an expedition', () => {
    expect(buyPurchase(heroSave(), 'hero-1', 'skill')).toEqual({ ok: false, reason: 'That costs 8 Legacy. Ash has 0.' })
    const running = { ...rich(), expedition: startExpedition(hero(rich()), 'splintered-road', 1) }
    expect(buyPurchase(running, 'hero-1', 'skill')).toEqual({ ok: false, reason: 'Finish the expedition first.' })
    expect(buyPurchase(rich(), 'nobody', 'skill').ok).toBe(false)
  })
})

describe('mastery', () => {
  it('is the lives completed, up to 10, and adds 2% ordinary XP per rank', () => {
    const base = hero(heroSave())
    expect([0, 3, 10, 15].map((lives) => masteryRank({ ...base, lives }))).toEqual([0, 3, 10, 10])
    expect([0, 5, 10].map(masteryXpFactor)).toEqual([1, 1.1, 1.2])
  })

  function firstWin(lives: number, seed: number) {
    const save = heroSave('elf')
    const heroNow = { ...hero(save), lives }
    const run = startExpedition(heroNow, 'splintered-road', seed)
    const defs = gameDefs()
    let members: { xp: number; level: number; summon: boolean }[] = []
    let guard = 0
    while (run.history.length === 0 && run.outcome === 'ongoing' && guard < 100_000) {
      stepExpedition(run, defs)
      if (run.combat !== null && members.length === 0) members = run.combat.enemies.map((e) => ({ xp: e.xp, level: e.level, summon: e.summon }))
      guard += 1
    }
    return { run, members, spirit: heroNow.progress.attributes.spirit }
  }

  it('raises the XP a won fight gives, and only that', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const plain = firstWin(0, seed)
      if (plain.run.history[0]?.outcome !== 'victory') continue
      const seasoned = firstWin(5, seed)
      expect(seasoned.run.history[0]?.durationMs).toBe(plain.run.history[0]?.durationMs)
      expect(seasoned.run.xpEarned).toBe(xpFromEnemies(1, seasoned.spirit, seasoned.members, 1.1))
      expect(plain.run.xpEarned).toBe(xpFromEnemies(1, plain.spirit, plain.members, 1))
      expect(seasoned.run.xpEarned ?? 0).toBeGreaterThanOrEqual(plain.run.xpEarned ?? 0)
      return
    }
    throw new Error('no winning seed found')
  })

  it('carries over to a settled expedition through the owner of the run', () => {
    const save = heroSave()
    const run = startExpedition(hero(save), 'splintered-road', 1)
    run.outcome = 'returned'
    run.xpEarned = 12
    expect(hero(settleExpedition({ ...save, expedition: run })).progress.xp).toBe(12)
  })
})

describe('heirlooms keep up when the hero levels', () => {
  it('scales after XP from a settled expedition and from a collected contract', () => {
    const lost = veteran()
    let save = ok(reincarnate(updatePurse(lost, { archive: [newItem('blade', 'weapon-one-handed', 9)] }), 'hero-1', 'blade'))
    save = updatePurse(save, { contracts: [{ contractId: 'hunt-deserters', progress: 3 }] })
    const collected = ok(collectContract(save, 'hero-1', 'hunt-deserters'))
    const level = hero(collected).progress.level
    expect(purseOf(collected).archive.find((item) => item.id === 'blade')?.itemLevel).toBe(Math.min(level, 9))
    const run = startExpedition(hero(collected), 'splintered-road', 1)
    run.outcome = 'returned'
    run.xpEarned = 400
    const settled = settleExpedition({ ...collected, expedition: run })
    const now = hero(settled).progress.level
    expect(now).toBeGreaterThan(level)
    expect(purseOf(settled).archive.find((item) => item.id === 'blade')?.itemLevel).toBe(Math.min(now, 9))
  })
  it('pays 3 Legacy once for the first defeat of the Tidebound Colossus', () => {
    const base = veteran()
    const beaten = { ...base, heroes: base.heroes.map((h) => ({ ...h, defeatedEnemyIds: [...h.defeatedEnemyIds, 'tidebound-colossus'] })) }
    const due = bonusesDue(hero(beaten)).find((bonus) => bonus.id === 'elite:tidebound-colossus')
    expect(due).toMatchObject({ amount: 3, text: 'First defeat of the Tidebound Colossus' })
    expect(bonusesDue(hero(base)).some((bonus) => bonus.id === 'elite:tidebound-colossus')).toBe(false)
    const first = ok(reincarnate(beaten, 'hero-1', null))
    expect(hero(first).claimedBonuses).toContain('elite:tidebound-colossus')
    const again = { ...first, heroes: first.heroes.map((h) => ({ ...h, bossLossThisLife: true, defeatedEnemyIds: ['tidebound-colossus'] })) }
    expect(bonusesDue(hero(again)).some((bonus) => bonus.id === 'elite:tidebound-colossus')).toBe(false)
  })
})

describe('Hollowmaw Reaver Legacy bonus', () => {
  it('pays 3 Legacy once for the first defeat of the Hollowmaw Reaver', () => {
    const base = veteran()
    const beaten = { ...base, heroes: base.heroes.map((h) => ({ ...h, defeatedEnemyIds: [...h.defeatedEnemyIds, 'hollowmaw-reaver'] })) }
    const due = bonusesDue(hero(beaten)).find((bonus) => bonus.id === 'elite:hollowmaw-reaver')
    expect(due).toMatchObject({ amount: 3, text: 'First defeat of the Hollowmaw Reaver' })
    expect(bonusesDue(hero(base)).some((bonus) => bonus.id === 'elite:hollowmaw-reaver')).toBe(false)
    const first = ok(reincarnate(beaten, 'hero-1', null))
    expect(hero(first).claimedBonuses).toContain('elite:hollowmaw-reaver')
    const again = { ...first, heroes: first.heroes.map((h) => ({ ...h, bossLossThisLife: true, defeatedEnemyIds: ['hollowmaw-reaver'] })) }
    expect(bonusesDue(hero(again)).some((bonus) => bonus.id === 'elite:hollowmaw-reaver')).toBe(false)
  })
})

describe('Emberwrought Tyrant Legacy bonus', () => {
  it('pays 3 Legacy once for the first defeat of the Emberwrought Tyrant', () => {
    const base = veteran()
    const beaten = { ...base, heroes: base.heroes.map((h) => ({ ...h, defeatedEnemyIds: [...h.defeatedEnemyIds, 'emberwrought-tyrant'] })) }
    const due = bonusesDue(hero(beaten)).find((bonus) => bonus.id === 'elite:emberwrought-tyrant')
    expect(due).toMatchObject({ amount: 3, text: 'First defeat of the Emberwrought Tyrant' })
    expect(bonusesDue(hero(base)).some((bonus) => bonus.id === 'elite:emberwrought-tyrant')).toBe(false)
    const first = ok(reincarnate(beaten, 'hero-1', null))
    expect(hero(first).claimedBonuses).toContain('elite:emberwrought-tyrant')
    const again = { ...first, heroes: first.heroes.map((h) => ({ ...h, bossLossThisLife: true, defeatedEnemyIds: ['emberwrought-tyrant'] })) }
    expect(bonusesDue(hero(again)).some((bonus) => bonus.id === 'elite:emberwrought-tyrant')).toBe(false)
  })
})

describe('Recall XP (Step 13.18)', () => {
  function recalling(level: number, peak: number | undefined, xpInto = 0) {
    const base = hero(heroSave())
    const progress = awardXp(base.progress, cumulativeXpToReachLevel(level) + xpInto)
    return { ...base, progress, peakLevel: peak }
  }

  it('gives plain XP to a hero with no peak, a fresh hero, or a hero at or above the peak', () => {
    expect(recallXp(recalling(1, undefined), 500)).toBe(500)
    expect(recallXp(recalling(5, 5), 500)).toBe(500)
    expect(recallXp(recalling(8, 5), 500)).toBe(500)
    expect(recallNeed(recalling(1, undefined))).toBe(0)
  })

  it('doubles XP while all of it stays below the peak', () => {
    const fresh = recalling(1, 10)
    expect(recallNeed(fresh)).toBe(cumulativeXpToReachLevel(10))
    expect(recallXp(fresh, 100)).toBe(200)
    expect(recallXp(fresh, 0)).toBe(0)
  })

  it('doubles only the part that reaches the peak', () => {
    const near = recalling(4, 5, 10)
    const need = cumulativeXpToReachLevel(5) - (cumulativeXpToReachLevel(4) + 10)
    expect(recallNeed(near)).toBe(need)
    expect(recallXp(near, need / 2)).toBe(need)
    const xp = need + 100
    expect(recallXp(near, xp)).toBe(need + (xp - Math.ceil(need / 2)))
    expect(recallXp(near, xp)).toBeGreaterThan(xp)
    expect(recallXp(near, xp)).toBeLessThan(2 * xp)
  })

  it('records the peak at reincarnation and keeps the highest one', () => {
    const first = ok(reincarnate(veteran(), 'hero-1', null))
    const reached = hero(veteran()).progress.level
    expect(hero(first).peakLevel).toBe(reached)
    const lower = { ...first, heroes: first.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    const second = ok(reincarnate(lower, 'hero-1', null))
    expect(hero(second).peakLevel).toBe(reached)
    expect(() => assertSaveData(parseSave(serializeSave(second)).ok ? second : first)).not.toThrow()
  })

  it('settles a run with Recall and reports it in the summary and stats', () => {
    const reborn = ok(reincarnate(veteran(), 'hero-1', null))
    const started = startExpedition(hero(reborn), 'splintered-road', 1)
    const expedition = { ...started, outcome: 'returned' as const, xpEarned: 100 }
    const withRun = { ...reborn, expedition }
    const stats = outcomeStats(expedition, hero(withRun))
    expect(stats).toMatchObject({ xp: 200, recall: 100 })
    expect(outcomeSummary(expedition, hero(withRun)).lines).toContain('Experience earned: 200 (Recall +100).')
    expect(outcomeSummary(expedition).lines).toContain('Experience earned: 100.')
    const settled = settleExpedition(withRun)
    expect(hero(settled).progress.xp + cumulativeXpToReachLevel(hero(settled).progress.level)).toBe(
      hero(reborn).progress.xp + cumulativeXpToReachLevel(hero(reborn).progress.level) + 200,
    )
  })
})

describe('Head Start (Step 13.18)', () => {
  function rich(): SaveData {
    const base = veteran()
    return { ...base, heroes: base.heroes.map((h) => ({ ...h, legacy: 100 })) }
  }

  it('sells tier I for 20 Legacy and tier II for 35, in order, and nothing past that', () => {
    let save = rich()
    expect(hero(save).purchases.headStart).toBe(0)
    save = ok(buyPurchase(save, 'hero-1', 'headStart'))
    expect(hero(save).purchases.headStart).toBe(1)
    expect(hero(save).legacy).toBe(100 - HEAD_START_COSTS[0]!)
    save = ok(buyPurchase(save, 'hero-1', 'headStart'))
    expect(hero(save).purchases.headStart).toBe(2)
    expect(hero(save).legacy).toBe(100 - HEAD_START_COSTS[0]! - HEAD_START_COSTS[1]!)
    const third = buyPurchase(save, 'hero-1', 'headStart')
    expect(third.ok).toBe(false)
    expect(headStartCost(hero(save).purchases)).toBeNull()
  })

  it('refuses a tier the hero cannot afford, so tier II cannot be bought before I', () => {
    const poor = { ...rich(), heroes: rich().heroes.map((h) => ({ ...h, legacy: 30 })) }
    const first = ok(buyPurchase(poor, 'hero-1', 'headStart'))
    expect(hero(first).legacy).toBe(10)
    const second = buyPurchase(first, 'hero-1', 'headStart')
    expect(second.ok ? '' : second.reason).toMatch(/35 Legacy/)
  })

  it('starts the next life at level 5 or 10 with the points of those levels unspent', () => {
    expect(hero(ok(reincarnate(rich(), 'hero-1', null))).progress.level).toBeGreaterThan(0)
    const none = hero(ok(reincarnate(rich(), 'hero-1', null)))
    expect(none.progress).toMatchObject({ level: 1, xp: 0, unspentAttributePoints: 0, unspentSkillPoints: 0 })
    for (const [tier, level] of [[1, 5], [2, 10]] as const) {
      const base = rich()
      const bought = { ...base, heroes: base.heroes.map((h) => ({ ...h, purchases: { ...h.purchases, headStart: tier, skillSeeds: 1 } })) }
      const started = hero(ok(reincarnate(bought, 'hero-1', null)))
      expect(headStartLevel(started.purchases)).toBe(level)
      expect(started.progress.level).toBe(level)
      expect(started.progress.xp).toBe(0)
      expect(started.progress.unspentAttributePoints).toBe((level - 1) * 2)
      expect(started.progress.unspentSkillPoints).toBe(Math.floor(level / 3))
      expect(started.progress.legacySkillPoints).toBe(1)
      expect(started.progress.allocatedNodeIds).toEqual([])
    }
  })

  it('counts head start levels toward Legacy-from-level and fills a missing field on old saves', () => {
    const base = rich()
    const bought = { ...base, heroes: base.heroes.map((h) => ({ ...h, purchases: { ...h.purchases, headStart: 2 }, bossLossThisLife: true, defeatedEnemyIds: [] })) }
    const reborn = ok(reincarnate(bought, 'hero-1', null))
    const again = { ...reborn, heroes: reborn.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    expect(legacyPreview(hero(again)).fromLevel).toBe(legacyFromProgress(hero(again).progress))
    expect(legacyPreview(hero(again)).fromLevel).toBeGreaterThanOrEqual(2 * (10 - 1))
    const raw = JSON.parse(serializeSave(reborn))
    delete raw.heroes[0].purchases.headStart
    const parsed = parseSave(JSON.stringify(raw))
    expect(parsed.ok && hero(parsed.data).purchases.headStart).toBe(0)
    raw.heroes[0].purchases.headStart = 3
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
  })
})

describe('nextLifePreview (Step 13.18)', () => {
  it('names the remembered zones, the Recall level and the start level', () => {
    const base = veteran()
    const bought = {
      ...base,
      account: { ...base.account, discoveries: [...base.account.discoveries, 'node:drowned-causeway'] },
      heroes: base.heroes.map((h) => ({ ...h, purchases: { ...h.purchases, headStart: 1 } })),
    }
    const next = nextLifePreview(hero(bought), bought.account.discoveries)
    expect(next.zones).toEqual(['Drowned Causeway'])
    expect(next.startLevel).toBe(5)
    expect(next).toMatchObject({ attributePoints: 8, skillPoints: 1 })
    // The peak (this life's level) is not above a level 5 start, so there is nothing to recall.
    expect(next.recallUntil).toBeNull()
    const plain = nextLifePreview(hero(base), base.account.discoveries)
    expect(plain.startLevel).toBe(1)
    expect(plain.recallUntil).toBe(hero(base).progress.level)
    expect(nextLifePreview(hero(heroSave()), []).recallUntil).toBeNull()
  })
})
