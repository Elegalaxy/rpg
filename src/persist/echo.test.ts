import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { stepExpedition, type ExpeditionState } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { blueprintForHero, startExpedition } from './expeditionSetup.ts'
import { checkPreparation, draftFor } from './preparation.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, type SaveData } from './save.ts'
import { bossFaced, reincarnate, reincarnationBlock } from './reincarnation.ts'
import { bossVictoryRanks, climbEchoDuringRun, outcomeSummary, routeInfo, settleExpedition } from './world.ts'

function heroSave(echoRank = 0, fightRank = 0): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return { ...made.save, heroes: made.save.heroes.map((hero) => ({ ...hero, echoRank, fightRank })) }
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function gateRun(save: SaveData): ExpeditionState {
  return startExpedition(hero(save), 'fracture-via-grove', 1)
}

function wardenIndex(run: ExpeditionState): number {
  return run.opening.length - 1
}

describe('the Fractured Warden at an Echo rank', () => {
  it('puts the hero chosen rank on the boss and nothing else', () => {
    const run = gateRun(heroSave(3, 2))
    const warden = run.opening[wardenIndex(run)]!.enemies[0]!
    expect(warden).toMatchObject({ defId: 'fractured-warden', rank: 2 })
    const others = run.opening.slice(0, wardenIndex(run)).flatMap((fight) => fight.enemies)
    expect(others.every((enemy) => enemy.rank === undefined)).toBe(true)
    expect(blueprintForHero(hero(heroSave(3, 0)), 'fracture-via-grove').opening.at(-1)!.enemies[0]!.rank).toBe(0)
  })

  it('reaches the fight: the Warden enters combat at that rank with the 1.12 multiplier', () => {
    const defs = gameDefs()
    const stats = (rank: number) => {
      const run = gateRun(heroSave(5, rank))
      run.encounterIndex = wardenIndex(run)
      run.phase = 'travel'
      run.travelMs = run.travelGapMs - 10
      stepExpedition(run, defs)
      stepExpedition(run, defs)
      const warden = run.combat?.enemies[0]
      if (warden === undefined) throw new Error('no fight started')
      return { rank: warden.rank, maxHp: warden.maxHp, power: warden.power, armor: warden.armor }
    }
    const base = stats(0)
    const third = stats(3)
    expect(base.rank).toBe(0)
    expect(third.rank).toBe(3)
    expect(third.maxHp / base.maxHp).toBeCloseTo(1.12 ** 3, 2)
    expect(third.power / base.power).toBeCloseTo(1.12 ** 3, 1)
    expect(third.armor / base.armor).toBeCloseTo(1.12 ** 3, 1)
  })

  it('lets a hero choose a rank from 0 up to the rank unlocked, and snaps a higher number to that rank', () => {
    const saved = hero(heroSave(2, 0))
    expect(draftFor(saved).fightRank).toBe('0')
    expect(checkPreparation(saved, { ...draftFor(saved), fightRank: '2' })).toMatchObject({ ok: true, hero: { fightRank: 2 } })
    expect(checkPreparation(saved, { ...draftFor(saved), fightRank: '3' })).toMatchObject({ ok: true, hero: { fightRank: 2 } })
    expect(checkPreparation(saved, { ...draftFor(saved), fightRank: '99' })).toMatchObject({ ok: true, hero: { fightRank: 2 } })
    expect(checkPreparation(saved, { ...draftFor(saved), fightRank: '-1' }).ok).toBe(false)
    expect(checkPreparation(saved, { ...draftFor(saved), fightRank: '1.5' }).ok).toBe(false)
    expect(checkPreparation(saved, { ...draftFor(saved), fightRank: '' }).ok).toBe(false)
  })
})

describe('unlocking ranks and the loss flag', () => {
  function winWarden(save: SaveData, rank: number) {
    const run = gateRun(save)
    run.history = run.opening.map((fight, index) => ({
      index,
      encounterId: fight.id,
      seed: index,
      outcome: 'victory' as const,
      durationMs: 1,
    }))
    run.opening[wardenIndex(run)]!.enemies[0]!.rank = rank
    run.outcome = 'returned'
    return { ...save, expedition: run }
  }

  it('a victory at rank R unlocks R + 1 and sets the next fight to it', () => {
    const rank0 = winWarden(heroSave(0, 0), 0)
    expect(bossVictoryRanks(rank0.expedition!)).toEqual([0])
    const settled = settleExpedition(rank0)
    expect(hero(settled)).toMatchObject({ echoRank: 1, fightRank: 1, bossLossThisLife: false })
    expect(settled.account.milestones).toContain('first-warden-defeat')
    expect(() => assertSaveData(settled)).not.toThrow()
    const rank3 = settleExpedition(winWarden(heroSave(5, 3), 3))
    expect(hero(rank3)).toMatchObject({ echoRank: 5, fightRank: 3 })
    const top = settleExpedition(winWarden(heroSave(5, 5), 5))
    expect(hero(top)).toMatchObject({ echoRank: 6, fightRank: 6 })
    const lower = settleExpedition(winWarden(heroSave(4, 1), 1))
    expect(hero(lower)).toMatchObject({ echoRank: 4, fightRank: 1 })
  })

  it('a Warden victory unlocks reincarnation like a loss, and a plain elite win does not', () => {
    const fresh = heroSave()
    expect(bossFaced(hero(fresh))).toBeNull()
    expect(reincarnationBlock(fresh, hero(fresh))).toMatch(/Face a boss first/)
    const won = settleExpedition(winWarden(fresh, 0))
    expect(hero(won).bossLossThisLife).toBe(false)
    expect(bossFaced(hero(won))).toBe('won')
    expect(reincarnationBlock(won, hero(won))).toBeNull()
    // a high-rank victory counts too
    const high = settleExpedition(winWarden(heroSave(5, 5), 5))
    expect(reincarnationBlock(high, hero(high))).toBeNull()
    // a plain elite win (no boss in the history) does not
    const road = startExpedition(hero(fresh), 'splintered-road', 1)
    road.history = [{ index: 0, encounterId: road.opening[0]!.id, seed: 1, outcome: 'victory', durationMs: 1 }]
    road.outcome = 'returned'
    const plain = settleExpedition({ ...fresh, expedition: road })
    expect(bossFaced(hero(plain))).toBeNull()
    expect(reincarnationBlock(plain, hero(plain))).not.toBeNull()
    // a loss still unlocks it, and a loss plus a win is both
    const lost = { ...fresh, heroes: fresh.heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    expect(bossFaced(hero(lost))).toBe('lost')
    expect(reincarnationBlock(lost, hero(lost))).toBeNull()
    expect(bossFaced({ bossLossThisLife: true, echoRank: 2 })).toBe('both')
    expect(outcomeSummary(winWarden(fresh, 0).expedition!).lines).toContain('You defeated a boss this life. You can now reincarnate.')
  })

  it('reincarnating after a victory clears the unlock again', () => {
    const won = settleExpedition(winWarden(heroSave(), 0))
    const result = reincarnate(won, hero(won).id, null)
    if (!result.ok) throw new Error(result.reason)
    expect(hero(result.save)).toMatchObject({ echoRank: 0, fightRank: 0, bossLossThisLife: false })
    expect(bossFaced(hero(result.save))).toBeNull()
    expect(reincarnationBlock(result.save, hero(result.save))).not.toBeNull()
  })

  it('an old save without the boss-loss field loads, and a hero with an Echo rank is unlocked', () => {
    const raw = JSON.parse(JSON.stringify(heroSave(2, 1))) as { heroes: Record<string, unknown>[] }
    for (const h of raw.heroes) delete h.bossLossThisLife
    const loaded = parseSave(JSON.stringify(raw))
    if (!loaded.ok) throw new Error(loaded.reason)
    expect(hero(loaded.data).bossLossThisLife).toBe(false)
    expect(reincarnationBlock(loaded.data, hero(loaded.data))).toBeNull()
  })

  it('climbs one Echo rank after a Bastion-gate win while Echo climb is on, and leaves other runs alone', () => {
    function climbing(save: SaveData, routeId: string, rank: number): SaveData {
      const armed = { ...save, heroes: save.heroes.map((entry) => ({ ...entry, autoRun: true, autoRunMode: 'echo' as const })) }
      const run = startExpedition(hero(armed), routeId, 1)
      run.history = run.opening.map((fight, index) => ({ index, encounterId: fight.id, seed: index, outcome: 'victory' as const, durationMs: 1 }))
      const warden = run.opening[wardenIndex(run)]!.enemies[0]!
      warden.rank = rank
      run.outcome = 'returned'
      return settleExpedition({ ...armed, expedition: run })
    }
    expect(hero(climbing(heroSave(5, 1), 'fracture-via-bastion', 1))).toMatchObject({ echoRank: 5, fightRank: 2 })
    expect(hero(climbing(heroSave(1, 1), 'fracture-via-bastion', 1))).toMatchObject({ echoRank: 2, fightRank: 2 })
    expect(hero(climbing(heroSave(5, 1), 'fracture-via-grove', 1))).toMatchObject({ echoRank: 5, fightRank: 1 })
    const retreated = startExpedition(hero(heroSave(5, 1)), 'fracture-via-bastion', 1)
    retreated.outcome = 'returned'
    retreated.history = []
    const armed = { ...heroSave(5, 1), heroes: heroSave(5, 1).heroes.map((entry) => ({ ...entry, autoRun: true, autoRunMode: 'echo' as const })) }
    expect(hero(settleExpedition({ ...armed, expedition: retreated }))).toMatchObject({ echoRank: 5, fightRank: 1 })
  })

  it('counts a Warden won after the opening list, and raises the next Warden in that run', () => {
    const armed = { ...heroSave(6, 6), heroes: heroSave(6, 6).heroes.map((entry) => ({ ...entry, autoRun: true, autoRunMode: 'echo' as const })) }
    const onlyDraw = startExpedition(hero(armed), 'fracture-via-bastion', 1)
    onlyDraw.history = [{ index: onlyDraw.opening.length, encounterId: 'fractured-warden', seed: 1, outcome: 'victory', durationMs: 1 }]
    expect(bossVictoryRanks(onlyDraw)).toEqual([6])
    expect(hero(settleExpedition({ ...armed, expedition: { ...onlyDraw, outcome: 'returned' } }))).toMatchObject({ echoRank: 7, fightRank: 7 })

    const live = startExpedition(hero(armed), 'fracture-via-bastion', 1)
    const at = wardenIndex(live)
    live.history = [{ index: at, encounterId: 'fractured-warden', seed: 1, outcome: 'victory', durationMs: 1 }]
    live.encounterIndex = at + 1
    const climbed = climbEchoDuringRun({ ...armed, expedition: live })
    expect(hero(climbed)).toMatchObject({ echoRank: 7, fightRank: 7 })
    expect(live.opening[at]!.enemies[0]!.rank).toBe(6)
    expect(live.draw[0]!.enemies[0]).toMatchObject({ defId: 'fractured-warden', rank: 7 })
    expect(hero(climbEchoDuringRun(climbed))).toMatchObject({ echoRank: 7, fightRank: 7 })

    live.history.push({ index: live.opening.length, encounterId: 'fractured-warden', seed: 2, outcome: 'victory', durationMs: 1 })
    const again = climbEchoDuringRun(climbed)
    expect(hero(again)).toMatchObject({ echoRank: 8, fightRank: 8 })
    expect(live.history.map((entry) => entry.rank)).toEqual([6, 7])
    expect(live.draw[0]!.enemies[0]!.rank).toBe(8)
  })

  it('does not raise the next Warden while repeating a rank the hero has already unlocked', () => {
    const armed = { ...heroSave(6, 3), heroes: heroSave(6, 3).heroes.map((entry) => ({ ...entry, autoRun: true, autoRunMode: 'repeat' as const })) }
    const live = startExpedition(hero(armed), 'fracture-via-bastion', 1)
    const at = wardenIndex(live)
    live.history = [{ index: at, encounterId: 'fractured-warden', seed: 1, outcome: 'victory', durationMs: 1 }]
    live.encounterIndex = at + 1
    const climbed = climbEchoDuringRun({ ...armed, expedition: live })
    expect(hero(climbed)).toMatchObject({ echoRank: 6, fightRank: 3 })
    expect(live.draw[0]!.enemies[0]!.rank).toBe(3)
  })

  it('says so on the outcome screen', () => {
    const won = winWarden(heroSave(0, 0), 0).expedition!
    expect(outcomeSummary(won).lines).toContain('The Fractured Warden fell at Echo rank 0. Echo rank 1 is unlocked.')
  })

  it('a loss to the boss at any rank sets the loss flag for the hero, and nothing else sets it', () => {
    for (const rank of [0, 2]) {
      const save = heroSave(3, rank)
      const run = gateRun(save)
      run.outcome = 'defeat'
      run.bossLossThisLife = true
      run.history = [{ index: wardenIndex(run), encounterId: 'fractured-warden', seed: 1, outcome: 'defeat', durationMs: 1 }]
      const settled = settleExpedition({ ...save, expedition: run })
      expect(hero(settled).bossLossThisLife).toBe(true)
      expect(hero(settled).echoRank).toBe(3)
      expect(outcomeSummary(run).lines).toContain('A boss defeated you this life. You can now reincarnate.')
    }
    const road = startExpedition(hero(heroSave()), 'splintered-road', 1)
    road.outcome = 'defeat'
    road.history = [{ index: 0, encounterId: 'shardling-pair', seed: 1, outcome: 'defeat', durationMs: 1 }]
    expect(hero(settleExpedition({ ...heroSave(), expedition: road })).bossLossThisLife).toBe(false)
  })

  it('keeps a loss flag already set, and rejects a fight rank above the unlocked rank in a save', () => {
    const flagged = { ...heroSave(), heroes: heroSave().heroes.map((h) => ({ ...h, bossLossThisLife: true })) }
    const run = startExpedition(hero(flagged), 'splintered-road', 1)
    run.outcome = 'returned'
    expect(hero(settleExpedition({ ...flagged, expedition: run })).bossLossThisLife).toBe(true)
    const bad = heroSave(1, 2)
    expect(() => assertSaveData(bad)).toThrow(/fight rank is above/)
  })
})

describe('the boss reveal', () => {
  it('stays hidden until the hero has arrived at the gate, then shows the Warden', () => {
    const save = heroSave()
    expect(routeInfo('fracture-via-grove', save).bossHidden).toBe(true)
    const arrived = { ...save, account: { ...save.account, discoveries: [...save.account.discoveries, 'node:fracture-gate'] } }
    const info = routeInfo('fracture-via-grove', arrived)
    expect(info.bossHidden).toBe(false)
    expect(info.enemyNames.join(' ')).toMatch(/Warden/)
  })
})
