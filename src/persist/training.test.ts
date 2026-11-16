import { describe, expect, it } from 'vitest'

import { xpToNextLevel } from '../sim/stats.ts'

import { selectedHero } from './character.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, updatePurse, type SaveData } from './save.ts'
import { MAX_DRILLS_PER_LEVEL } from './save.ts'
import { reincarnationBlock } from './reincarnation.ts'
import { DRILL_BOOST_LEVEL, DRILL_MS, advanceTraining, drillInfo, drillPrice, drillXp, drillsQueued, heroAway, trainHero, withXp } from './training.ts'
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

/** Let `ms` pass at home. */
function wait(save: SaveData, ms: number): SaveData {
  return advanceTraining(save, ms).save
}

describe('trainer drills', () => {
  it('gives a fifth of the level from level 10 (a tenth below): 701 XP at level 17', () => {
    expect(xpToNextLevel(17)).toBe(3505)
    expect(drillXp(17)).toBe(701)
    const after = wait(train(hero17()), DRILL_MS)
    expect(selectedHero(after)!.progress.xp).toBe(701)
    expect(selectedHero(after)!.progress.level).toBe(17)
  })

  it('gives a tenth below level 10', () => {
    expect(DRILL_BOOST_LEVEL).toBe(10)
    expect(drillXp(9)).toBe(Math.round(xpToNextLevel(9) * 0.1))
    expect(drillXp(10)).toBe(Math.round(xpToNextLevel(10) * 0.2))
    expect(drillXp(1)).toBeGreaterThanOrEqual(1)
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
    expect(hero.progress.xp).toBe(0)
    expect(drillsQueued(hero)).toBe(3)
    expect(selectedHero(wait(save, DRILL_MS * 3))!.progress.xp).toBe(2103)
    expect(drillInfo(hero).left).toBe(0)
    const refused = trainHero(updatePurse(save, { gold: 99_999 }), 'hero-1')
    expect(refused).toEqual({ ok: false, reason: expect.stringContaining('Three drills already queued') })
  })

  it('refuses without enough gold and says what it costs', () => {
    expect(trainHero(hero17(100), 'hero-1')).toEqual({ ok: false, reason: 'The next drill costs 680 gold. You have 100.' })
  })

  it('resets the count when a drill or any other XP raises the level, with the normal level-up points', () => {
    const base = hero17()
    const near: SaveData = { ...base, heroes: base.heroes.map((hero) => ({ ...hero, drillsThisLevel: 2, progress: { ...hero.progress, xp: 3400 } })) }
    const before = selectedHero(near)!
    const after = selectedHero(wait(train(near), DRILL_MS))!
    expect(after.progress.level).toBe(18)
    expect(after.progress.xp).toBe(3400 + 701 - 3505)
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
    const trained = train(train(hero17()))
    const parsed = parseSave(serializeSave(trained))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(selectedHero(parsed.data)!.drillsThisLevel).toBe(2)
    expect(selectedHero(parsed.data)!.training).toEqual({ remainingMs: DRILL_MS, queue: [{ xp: 701 }, { xp: 701 }] })
    const raw = JSON.parse(serializeSave(trained)) as { heroes: Record<string, unknown>[] }
    delete raw.heroes[0]!.drillsThisLevel
    delete raw.heroes[0]!.training
    const legacy = parseSave(JSON.stringify(raw))
    if (!legacy.ok) throw new Error(legacy.reason)
    expect(selectedHero(legacy.data)!.drillsThisLevel).toBe(0)
    expect(selectedHero(legacy.data)!.training).toBeUndefined()
    raw.heroes[0]!.drillsThisLevel = 4
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
    raw.heroes[0]!.drillsThisLevel = 0
    for (const bad of [
      { remainingMs: 0, queue: [{ xp: 5 }] },
      { remainingMs: DRILL_MS + 1, queue: [{ xp: 5 }] },
      { remainingMs: 1.5, queue: [{ xp: 5 }] },
      { remainingMs: 100, queue: [] },
      { remainingMs: 100, queue: [{ xp: 5 }, { xp: 5 }, { xp: 5 }, { xp: 5 }] },
      { remainingMs: 100, queue: [{ xp: 0 }] },
      { remainingMs: 100, queue: [{ xp: 1.5 }] },
    ]) {
      raw.heroes[0]!.training = bad
      expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
    }
    raw.heroes[0]!.training = { remainingMs: 100, queue: [{ xp: 5 }] }
    expect(parseSave(JSON.stringify(raw)).ok).toBe(true)
    expect(() => assertSaveData(legacy.data)).not.toThrow()
  })
  it('adds the XP only when the 45 seconds are over, and pays gold and the count at once', () => {
    const queued = train(hero17())
    const hero = selectedHero(queued)!
    expect(hero.purse.gold).toBe(10_000 - 680)
    expect(hero.drillsThisLevel).toBe(1)
    expect(hero.progress.xp).toBe(0)
    expect(hero.training).toEqual({ remainingMs: DRILL_MS, queue: [{ xp: 701 }] })
    const mid = wait(queued, DRILL_MS - 1)
    expect(selectedHero(mid)!.progress.xp).toBe(0)
    expect(selectedHero(mid)!.training!.remainingMs).toBe(1)
    const done = advanceTraining(mid, 1)
    expect(selectedHero(done.save)!.progress.xp).toBe(701)
    expect(selectedHero(done.save)!.training).toBeUndefined()
    expect(done.finished).toHaveLength(1)
    expect(done.finished[0]!.text).toContain('+701 XP')
  })

  it('runs queued drills in order, passing leftover time on, and prices queued ones in', () => {
    let save = train(hero17())
    save = train(save)
    expect(selectedHero(save)!.purse.gold).toBe(10_000 - 680 - 1360)
    expect(selectedHero(save)!.training!.queue).toHaveLength(2)
    const half = wait(save, DRILL_MS + 10_000)
    expect(selectedHero(half)!.progress.xp).toBe(701)
    expect(selectedHero(half)!.training).toEqual({ remainingMs: DRILL_MS - 10_000, queue: [{ xp: 701 }] })
    expect(selectedHero(wait(half, DRILL_MS - 10_000))!.progress.xp).toBe(1402)
  })

  it('refuses a fourth queued drill with its own text, and the cap counts queued drills', () => {
    let save = hero17(100_000)
    for (let n = 0; n < 3; n += 1) save = train(save)
    expect(trainHero(save, 'hero-1')).toEqual({ ok: false, reason: 'Three drills already queued. Wait for one to finish.' })
    expect(selectedHero(save)!.drillsThisLevel).toBe(3)
  })

  it('pauses while the hero is away and resumes at home', () => {
    const queued = train(hero17())
    const started = beginExpedition(queued, SPLINTERED_ROAD_ID, 1)
    if (!started.ok) throw new Error(started.reason)
    expect(heroAway(started.save, selectedHero(started.save)!)).toBe(true)
    const paused = wait(started.save, DRILL_MS * 2)
    expect(selectedHero(paused)!.progress.xp).toBe(0)
    expect(selectedHero(paused)!.training!.remainingMs).toBe(DRILL_MS)
    const home: SaveData = { ...paused, expedition: null }
    expect(selectedHero(wait(home, DRILL_MS))!.progress.xp).toBe(701)
  })

  it('keeps the fixed XP of later drills when an earlier one levels the hero up', () => {
    const base = hero17()
    const near: SaveData = { ...base, heroes: base.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, xp: 3400 } })) }
    let save = train(train(near))
    expect(selectedHero(save)!.drillsThisLevel).toBe(2)
    save = wait(save, DRILL_MS)
    const hero = selectedHero(save)!
    expect(hero.progress.level).toBe(18)
    expect(hero.drillsThisLevel).toBe(0)
    expect(hero.training!.queue).toEqual([{ xp: 701 }])
    const last = selectedHero(wait(save, DRILL_MS))!
    expect(last.progress.xp).toBe(3400 + 701 - 3505 + 701)
    expect(last.drillsThisLevel).toBe(0)
  })

  it('blocks reincarnation while a drill is queued', () => {
    const base = hero17()
    const lost: SaveData = { ...base, heroes: base.heroes.map((hero) => ({ ...hero, bossLossThisLife: true })) }
    expect(reincarnationBlock(lost, selectedHero(lost)!)).toBeNull()
    const queued = train(lost)
    expect(reincarnationBlock(queued, selectedHero(queued)!)).toContain('drills are queued')
  })
})
