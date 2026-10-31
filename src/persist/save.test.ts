import { describe, expect, it } from 'vitest'

import { referenceHeroAtLevel } from '../content/heroes.ts'
import { gameDefs, referenceLoadoutFor } from '../content/scenarios.ts'
import { createExpedition, SPLINTERED_ROAD_ID, stepExpedition, type ExpeditionBlueprint } from '../sim/expedition.ts'
import { createProgress } from '../sim/progression.ts'
import type { GameDefs } from '../sim/types.ts'

import {
  CORRUPT_KEY_PREFIX,
  MAX_SLOTS,
  SAVE_KEY,
  SLOT_MILESTONES,
  STARTING_SLOTS,
  clearSave,
  loadSave,
  newSave,
  parseSave,
  reachMilestone,
  serializeSave,
  writeSave,
  type SaveData,
  type StorageLike,
} from './save.ts'

const DUMMY = 'dummy-standard-20'

function fakeStorage(options?: { failWrites?: boolean }): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (options?.failWrites === true) throw new Error('QuotaExceededError')
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

function withHero(): SaveData {
  const save = newSave()
  save.account = { gold: 40, materials: { shard: 8, hide: 3 }, recipes: ['patch'], discoveries: ['splintered-road'], slots: 3, milestones: ['first-return'] }
  save.heroes.push({
    id: 'hero-1',
    name: 'Ash',
    classId: 'warrior',
    progress: createProgress('human', { strength: 13, vitality: 12, agility: 9, intellect: 8, spirit: 8 }),
    priorityRows: [{ skillId: 'driving-blow' }],
    vow: null,
    curse: null,
    preparedSpells: [],
    defeatedEnemyIds: ['rootmaw-stalker'],
    clearedNodeIds: ['splintered-road'],
    retreatAtMost: 0.4,
    specialAmmo: 0,
  })
  save.selectedHeroId = 'hero-1'
  return save
}

function roadFor(defs: GameDefs): ExpeditionBlueprint {
  const dummy = defs.enemies[DUMMY]
  if (dummy === undefined) throw new Error('missing dummy')
  defs.enemies[DUMMY] = { ...dummy, level: 10, levelMin: 10, levelMax: 10 }
  const hero = referenceHeroAtLevel('warrior', 10)
  const loadout = referenceLoadoutFor('warrior')
  const fight = (id: string) => ({ id, enemies: [{ defId: DUMMY, slot: 0, level: 10 }] })
  return {
    id: SPLINTERED_ROAD_ID,
    opening: [fight('one'), fight('two'), fight('three')],
    draw: [fight('one')],
    travelGapMs: 2000,
    retreatThresholds: [],
    hero: {
      id: hero.id,
      name: loadout.heroName,
      level: hero.level,
      classId: 'warrior',
      attributes: hero.attributes,
      gear: hero.gear,
      equippedSkillIds: [...loadout.equippedSkillIds],
      priorityRows: loadout.priorityRows,
      ...(loadout.startingResource !== undefined ? { startingResource: loadout.startingResource } : {}),
    },
  }
}

describe('save', () => {
  it('round trips an empty game and a game with a hero', () => {
    for (const save of [newSave(), withHero()]) {
      const parsed = parseSave(serializeSave(save))
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(parsed.data).toEqual(save)
    }
    const storage = fakeStorage()
    const logs: string[] = []
    const written = writeSave(storage, withHero(), (message) => logs.push(message))
    expect(written.ok).toBe(true)
    expect(storage.data.has(SAVE_KEY)).toBe(true)
    const loaded = loadSave(storage, 5, (message) => logs.push(message))
    expect(loaded.kind).toBe('loaded')
    if (loaded.kind === 'loaded' && written.ok) {
      expect(loaded.data).toEqual(withHero())
      expect(loaded.bytes).toBe(written.bytes)
    }
    expect(logs).toEqual(['saved', 'loaded'])
  })

  it('treats a missing entry as an empty start', () => {
    expect(loadSave(fakeStorage(), 1)).toEqual({ kind: 'empty' })
  })

  it('copies an unknown version to a corrupt key and leaves the original', () => {
    const storage = fakeStorage()
    const raw = JSON.stringify({ ...newSave(), version: 2 })
    storage.data.set(SAVE_KEY, raw)
    const result = loadSave(storage, 1234)
    expect(result).toMatchObject({ kind: 'corrupt', backupKey: `${CORRUPT_KEY_PREFIX}1234` })
    if (result.kind === 'corrupt') expect(result.reason).toMatch(/unknown save version 2/)
    expect(storage.data.get(`${CORRUPT_KEY_PREFIX}1234`)).toBe(raw)
    expect(storage.data.get(SAVE_KEY)).toBe(raw)
  })

  it('copies malformed JSON to a corrupt key', () => {
    const storage = fakeStorage()
    storage.data.set(SAVE_KEY, '{"version": 1, "acc')
    const result = loadSave(storage, 99)
    expect(result).toMatchObject({ kind: 'corrupt', reason: 'the save is not valid JSON' })
    expect(storage.data.get(`${CORRUPT_KEY_PREFIX}99`)).toBe('{"version": 1, "acc')
  })

  it('rejects a bad shape with a readable reason', () => {
    const missingHero = { ...withHero(), selectedHeroId: 'nobody' }
    expect(parseSave(JSON.stringify(missingHero))).toMatchObject({ ok: false, reason: expect.stringMatching(/selected hero/) })
    const badGold = withHero()
    badGold.account.gold = -1
    expect(parseSave(JSON.stringify(badGold))).toMatchObject({ ok: false, reason: expect.stringMatching(/gold/) })
    const badClass = JSON.parse(JSON.stringify(withHero())) as SaveData
    ;(badClass.heroes[0] as { classId: string }).classId = 'bard'
    expect(parseSave(JSON.stringify(badClass))).toMatchObject({ ok: false, reason: expect.stringMatching(/unknown class/) })
    const tooMany = withHero()
    tooMany.account.slots = 6
    expect(parseSave(JSON.stringify(tooMany))).toMatchObject({ ok: false, reason: expect.stringMatching(/slots must be from 2 through 5/) })
    const tooFew = withHero()
    tooFew.account.slots = 1
    expect(parseSave(JSON.stringify(tooFew))).toMatchObject({ ok: false, reason: expect.stringMatching(/slots must be from 2 through 5/) })
    expect(newSave().account.slots).toBe(STARTING_SLOTS)
    expect(SLOT_MILESTONES).toHaveLength(MAX_SLOTS - STARTING_SLOTS)
    const twice = withHero()
    twice.heroes.push(twice.heroes[0]!)
    expect(parseSave(JSON.stringify(twice))).toMatchObject({ ok: false, reason: expect.stringMatching(/duplicated/) })
    expect(parseSave('[]')).toMatchObject({ ok: false })
    expect(parseSave('null')).toMatchObject({ ok: false })
  })

  it('keeps the old entry and reports a failed write', () => {
    const storage = fakeStorage({ failWrites: true })
    storage.data.set(SAVE_KEY, serializeSave(newSave()))
    const result = writeSave(storage, withHero())
    expect(result).toEqual({ ok: false, reason: 'QuotaExceededError' })
    expect(storage.data.get(SAVE_KEY)).toBe(serializeSave(newSave()))
    const invalid = writeSave(fakeStorage(), { ...newSave(), selectedHeroId: 'x' })
    expect(invalid.ok).toBe(false)
  })

  it('clears the live save and keeps corrupt copies', () => {
    const storage = fakeStorage()
    storage.data.set(SAVE_KEY, 'junk')
    loadSave(storage, 7)
    clearSave(storage)
    expect(storage.data.has(SAVE_KEY)).toBe(false)
    expect(storage.data.get(`${CORRUPT_KEY_PREFIX}7`)).toBe('junk')
  })

  it('resumes an active expedition from the save with an identical continuation', () => {
    const defs = gameDefs()
    const blueprint = roadFor(defs)
    const live = createExpedition(blueprint, 7)
    let guard = 0
    while (live.phase !== 'combat' && guard < 5000) {
      stepExpedition(live, defs)
      guard += 1
    }
    for (let step = 0; step < 300; step += 1) stepExpedition(live, defs)
    expect(live.phase).toBe('combat')
    expect(live.outcome).toBe('ongoing')

    const save = withHero()
    save.expedition = live
    const storage = fakeStorage()
    expect(writeSave(storage, save).ok).toBe(true)
    const loaded = loadSave(storage, 1)
    if (loaded.kind !== 'loaded' || loaded.data.expedition === null) throw new Error('the expedition was not restored')
    const resumed = loaded.data.expedition
    expect(resumed).toEqual(live)

    const resumedDefs = gameDefs()
    roadFor(resumedDefs)
    for (let step = 0; step < 6000 && live.outcome === 'ongoing'; step += 1) {
      stepExpedition(live, defs)
      stepExpedition(resumed, resumedDefs)
    }
    expect(live.history.length).toBeGreaterThan(0)
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(live))
  })

  it('rejects a broken expedition inside an otherwise valid save', () => {
    const defs = gameDefs()
    const live = createExpedition(roadFor(defs), 3)
    const broken = JSON.parse(JSON.stringify(live)) as Record<string, unknown>
    delete broken.history
    const save = JSON.parse(serializeSave(newSave())) as Record<string, unknown>
    save.expedition = broken
    expect(parseSave(JSON.stringify(save))).toMatchObject({ ok: false, reason: expect.stringMatching(/history/) })
  })
})

describe('world record in the save', () => {
  it('starts knowing the town and the road, and fills the lists for an older save', () => {
    expect(newSave().account.discoveries).toEqual(['node:greyhaven', 'node:splintered-road'])
    const older = JSON.parse(serializeSave(withHero())) as Record<string, unknown>
    const account = older.account as Record<string, unknown>
    delete account.milestones
    const hero = (older.heroes as Record<string, unknown>[])[0]!
    delete hero.defeatedEnemyIds
    delete hero.clearedNodeIds
    const parsed = parseSave(JSON.stringify(older))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.account.milestones).toEqual([])
      expect(parsed.data.heroes[0]?.defeatedEnemyIds).toEqual([])
    }
  })

  it('opens a slot the first time a milestone is reached, and only then', () => {
    const account = newSave().account
    const first = reachMilestone(account, 'first-return')
    expect(first.slots).toBe(3)
    expect(first.milestones).toEqual(['first-return'])
    expect(reachMilestone(first, 'first-return')).toBe(first)
    const all = reachMilestone(reachMilestone(first, 'first-reincarnation'), 'first-warden-defeat')
    expect(all.slots).toBe(MAX_SLOTS)
    expect(parseSave(serializeSave({ ...newSave(), account: all })).ok).toBe(true)
  })
})
