import { describe, expect, it } from 'vitest'

import { newItem } from '../content/items.ts'
import { racialStartingAttributes } from '../content/heroes.ts'
import { gameDefs } from '../content/scenarios.ts'
import { classWebs } from '../content/webs/index.ts'
import { legacyFromProgress, awardXp, xpFromEnemies, createProgress } from '../sim/progression.ts'
import { stepExpedition } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { collectContract } from './contracts.ts'
import { equipFromArchive } from './equipment.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import {
  ATTRIBUTE_SEED_COST,
  SECOND_HEIRLOOM_COST,
  SKILL_SEED_COSTS,
  bonusesDue,
  buyPurchase,
  heirloomLevel,
  legacyPreview,
  masteryRank,
  masteryXpFactor,
  reincarnate,
  reincarnationBlock,
  scaleHeirlooms,
} from './reincarnation.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData } from './save.ts'
import { settleExpedition } from './world.ts'

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
  const withWork: SaveData = {
    ...save,
    account: {
      ...save.account,
      gold: 77,
      materials: { shard: 5 },
      recipes: ['keen', 'precise', 'nimble'],
      discoveries: [...save.account.discoveries, 'node:withered-grove'],
      contracts: [{ contractId: 'cull-the-pack', progress: 2 }],
      archive: [newItem('spare', 'weapon-bow', 1, 1.07)],
    },
    heroes: save.heroes.map((h) => ({
      ...h,
      progress,
      craftXp: 9,
      bossLossThisLife: true,
      echoRank: 2,
      fightRank: 1,
      defeatedEnemyIds: ['rootmaw-stalker', 'echo-knight', 'fractured-warden'],
      clearedNodeIds: ['splintered-road', 'withered-grove'],
      priorityRows: [{ skillId: 'cleave' }],
    })),
  }
  return withWork
}

describe('eligibility and currency', () => {
  it('needs a boss loss this life and no running expedition', () => {
    const fresh = heroSave()
    expect(reincarnationBlock(fresh, hero(fresh))).toMatch(/Lose to a boss first/)
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
  })

  it('resets personal world gates, Echo ranks, the boss loss flag, and the account contracts', () => {
    const save = after()
    const next = hero(save)
    expect(next.defeatedEnemyIds).toEqual([])
    expect(next.clearedNodeIds).toEqual([])
    expect([next.echoRank, next.fightRank, next.bossLossThisLife]).toEqual([0, 0, false])
    expect(save.account.contracts).toEqual([])
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
    expect(save.account.gold).toBe(77)
    expect(save.account.materials).toEqual({ shard: 5 })
    expect(save.account.archive.find((item) => item.id === 'spare')).toEqual(before.account.archive[0])
    expect(next.vow).toBe(hero(before).vow)
    expect(next.name).toBe('Ash')
  })

  it('archives all worn gear and gives fresh starter gear with new ids', () => {
    const before = veteran()
    const save = ok(reincarnate(before, 'hero-1', null))
    const worn = Object.values(hero(before).equipment).map((item) => item!.id)
    const archived = save.account.archive.map((item) => item.id)
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
    const level7 = { ...strong, account: { ...strong.account, archive: [newItem('blade', 'weapon-one-handed', 7, 1.09)] } }
    const next = ok(reincarnate(level7, 'hero-1', 'blade'))
    const blade = next.account.archive.find((item) => item.id === 'blade')!
    expect(blade.heirloom).toEqual({ heroId: 'hero-1', cap: 7 })
    expect(blade.itemLevel).toBe(1)
    expect(blade.quality).toBe(1.09)
  })

  it('grows with the hero up to its cap, and no further', () => {
    const lost = veteran()
    const level7 = { ...lost, account: { ...lost.account, archive: [newItem('blade', 'weapon-one-handed', 7, 1.09)] } }
    let save = ok(reincarnate(level7, 'hero-1', 'blade'))
    const at = (level: number) => {
      save = { ...save, heroes: save.heroes.map((h) => ({ ...h, progress: { ...h.progress, level } })) }
      save = scaleHeirlooms(save, 'hero-1')
      return save.account.archive.find((item) => item.id === 'blade')!.itemLevel
    }
    expect([at(1), at(4), at(7), at(12)]).toEqual([1, 4, 7, 7])
    expect(heirloomLevel(newItem('x', 'weapon-bow', 9), 3)).toBe(3)
    expect(heirloomLevel({ ...newItem('x', 'weapon-bow', 1), heirloom: { heroId: 'h', cap: 6 } }, 20)).toBe(6)
  })

  it('can be equipped by its hero at the scaled level, and by no one else', () => {
    const lost = veteran()
    const save = ok(reincarnate({ ...lost, account: { ...lost.account, archive: [newItem('blade', 'weapon-one-handed', 7)] } }, 'hero-1', 'blade'))
    const equipped = ok(equipFromArchive(save, 'hero-1', 'blade'))
    expect(hero(equipped).equipment.mainHand?.id).toBe('blade')
    expect(hero(equipped).equipment.mainHand?.itemLevel).toBe(1)
    const other = createHero(save, { name: 'Cinder', race: 'elf', classId: 'mage' })
    if (!other.ok) throw new Error(other.reason)
    const shared = { ...other.save, account: { ...other.save.account, slots: 3 } }
    expect(equipFromArchive(shared, 'hero-2', 'blade')).toEqual({ ok: false, reason: "That is another hero's heirloom." })
  })

  it('keeps one heirloom, or two with the Second Heirloom, and releases an older one at its cap', () => {
    const lost = veteran()
    const first = ok(reincarnate({ ...lost, account: { ...lost.account, archive: [newItem('a', 'weapon-bow', 5)] } }, 'hero-1', 'a'))
    const armed = { ...first, account: { ...first.account, archive: [...first.account.archive, newItem('b', 'weapon-dagger', 6)] }, heroes: first.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    const one = ok(reincarnate(armed, 'hero-1', 'b'))
    const flagged = (save: SaveData) => save.account.archive.filter((item) => item.heirloom !== undefined).map((item) => item.id).sort()
    expect(flagged(one)).toEqual(['b'])
    expect(one.account.archive.find((item) => item.id === 'a')).toMatchObject({ itemLevel: 5 })
    expect(one.account.archive.find((item) => item.id === 'a')?.heirloom).toBeUndefined()
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
    let save = ok(reincarnate({ ...lost, account: { ...lost.account, archive: [newItem('blade', 'weapon-one-handed', 9)] } }, 'hero-1', 'blade'))
    save = { ...save, account: { ...save.account, contracts: [{ contractId: 'hunt-deserters', progress: 3 }] } }
    const collected = ok(collectContract(save, 'hero-1', 'hunt-deserters'))
    const level = hero(collected).progress.level
    expect(collected.account.archive.find((item) => item.id === 'blade')?.itemLevel).toBe(Math.min(level, 9))
    const run = startExpedition(hero(collected), 'splintered-road', 1)
    run.outcome = 'returned'
    run.xpEarned = 400
    const settled = settleExpedition({ ...collected, expedition: run })
    const now = hero(settled).progress.level
    expect(now).toBeGreaterThan(level)
    expect(settled.account.archive.find((item) => item.id === 'blade')?.itemLevel).toBe(Math.min(now, 9))
  })
})
