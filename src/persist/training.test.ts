import { describe, expect, it } from 'vitest'

import { xpToNextLevel } from '../sim/stats.ts'

import { selectedHero } from './character.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, updatePurse, type SaveData } from './save.ts'
import { MAX_DRILLS_PER_LEVEL } from './save.ts'
import { drillInfo, drillPrice, drillXp, trainHero, withXp } from './training.ts'
import { beginExpedition } from './world.ts'
import { SPLINTERED_ROAD_ID } from '../sim/expedition.ts'

function hero17(gold = 10_000): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const save: SaveData = { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, level: 17, xp: 0 } })) }
  return updatePurse(save, { gold })
}

function train(save: SaveData): SaveData {
  const result = trainHero(save, 'hero-1')
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

describe('trainer drills', () => {
  it('gives a tenth of the level: 351 XP at level 17', () => {
    expect(xpToNextLevel(17)).toBe(3505)
    expect(drillXp(17)).toBe(351)
    const after = train(hero17())
    expect(selectedHero(after)!.progress.xp).toBe(351)
    expect(selectedHero(after)!.progress.level).toBe(17)
  })

  it('costs level x 40 x n gold for the n-th drill and stops after three', () => {
    expect([1, 2, 3].map((n) => drillPrice(17, n - 1))).toEqual([680, 1360, 2040])
    let save = hero17(680 + 1360 + 2040 + 5)
    save = train(save)
    expect(selectedHero(save)!.purse.gold).toBe(680 + 1360 + 2040 + 5 - 680)
    save = train(save)
    save = train(save)
    const hero = selectedHero(save)!
    expect(hero.purse.gold).toBe(5)
    expect(hero.drillsThisLevel).toBe(MAX_DRILLS_PER_LEVEL)
    expect(hero.progress.xp).toBe(1053)
    expect(drillInfo(hero).left).toBe(0)
    const refused = trainHero(updatePurse(save, { gold: 99_999 }), 'hero-1')
    expect(refused).toEqual({ ok: false, reason: expect.stringContaining('all 3 drills for level 17') })
  })

  it('refuses without enough gold and says what it costs', () => {
    expect(trainHero(hero17(100), 'hero-1')).toEqual({ ok: false, reason: 'The next drill costs 680 gold. You have 100.' })
  })

  it('resets the count when a drill or any other XP raises the level, with the normal level-up points', () => {
    const base = hero17()
    const near: SaveData = { ...base, heroes: base.heroes.map((hero) => ({ ...hero, drillsThisLevel: 2, progress: { ...hero.progress, xp: 3400 } })) }
    const before = selectedHero(near)!
    const after = selectedHero(train(near))!
    expect(after.progress.level).toBe(18)
    expect(after.progress.xp).toBe(3400 + 351 - 3505)
    expect(after.drillsThisLevel).toBe(0)
    expect(after.progress.unspentAttributePoints).toBe(before.progress.unspentAttributePoints + 2)
    expect(after.progress.unspentSkillPoints).toBe(before.progress.unspentSkillPoints + 1)
    const other = withXp({ ...before, drillsThisLevel: 3 }, 200)
    expect(other.progress.level).toBe(18)
    expect(other.drillsThisLevel).toBe(0)
    expect(withXp({ ...before, drillsThisLevel: 3 }, 10).drillsThisLevel).toBe(3)
  })

  it('is refused while the hero is on an expedition', () => {
    const started = beginExpedition(hero17(), SPLINTERED_ROAD_ID, 1)
    if (!started.ok) throw new Error(started.reason)
    const result = trainHero(started.save, 'hero-1')
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('is on an expedition') })
  })

  it('is saved, validated, and defaults to 0 in an old save', () => {
    const trained = train(hero17())
    const parsed = parseSave(serializeSave(trained))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(selectedHero(parsed.data)!.drillsThisLevel).toBe(1)
    const raw = JSON.parse(serializeSave(trained)) as { heroes: Record<string, unknown>[] }
    delete raw.heroes[0]!.drillsThisLevel
    const legacy = parseSave(JSON.stringify(raw))
    if (!legacy.ok) throw new Error(legacy.reason)
    expect(selectedHero(legacy.data)!.drillsThisLevel).toBe(0)
    raw.heroes[0]!.drillsThisLevel = 4
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
    expect(() => assertSaveData(legacy.data)).not.toThrow()
  })
})
