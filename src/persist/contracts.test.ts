import { describe, expect, it } from 'vitest'

import { BOARD_SIZE, MAX_ACTIVE_CONTRACTS, contractList, contracts, rewardFor, rollContract, targetKey, type ContractDef } from '../content/contracts.ts'
import { createRng, nextFloat } from '../sim/rng.ts'
import { encounters } from '../content/encounters.ts'
import { enemies } from '../content/enemies.ts'
import { gameDefs } from '../content/scenarios.ts'
import { nodes } from '../content/world.ts'
import { stepExpedition } from '../sim/expedition.ts'
import { awardXp, xpFromEnemies } from '../sim/progression.ts'
import { humanOrdinaryXp } from '../sim/races/human.ts'

import { selectedHero } from './character.ts'
import { abandonContract, acceptContract, addContractProgress, collectContract, isComplete, unitsFrom } from './contracts.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData, purseOf, updatePurse } from './save.ts'
import { outcomeSummary, settleExpedition } from './world.ts'

/** A new hero whose board holds the six old fixed contracts, so tests can name them. */
function heroSave(race: 'human' | 'elf' = 'human'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race, classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return updatePurse(made.save, { board: contractList.map((def) => ({ ...def })) })
}

function ok(result: { ok: true; save: SaveData } | { ok: false; reason: string }): SaveData {
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function withRun(save: SaveData, routeId: string) {
  return { ...save, expedition: startExpedition(hero(save), routeId, 1) }
}

function victories(save: SaveData, count: number): SaveData {
  const run = save.expedition!
  run.history = run.opening.slice(0, count).map((encounter, index) => ({
    index,
    encounterId: encounter.id,
    seed: index,
    outcome: 'victory' as const,
    durationMs: 1000,
  }))
  return save
}

describe('the contract board', () => {
  it('keeps the six old fixed contracts, with their rewards, for saves that hold one', () => {
    expect(contractList.map((def) => def.id)).toEqual([
      'cull-the-pack',
      'clear-the-shards',
      'hunt-deserters',
      'thicket-sweep',
      'bastion-patrol',
      'break-the-elite',
    ])
    expect(rewardFor(6, 6, 'hide')).toEqual({ xp: 61, gold: 36, materialId: 'hide', materialQuantity: 3 })
    expect(contracts['clear-the-shards']!.reward).toEqual({ xp: 53, gold: 24, materialId: 'shard', materialQuantity: 4 })
    expect(contracts['hunt-deserters']!.reward).toEqual({ xp: 31, gold: 18, materialId: 'scrap', materialQuantity: 2 })
    expect(contracts['thicket-sweep']!.reward).toEqual({ xp: 60, gold: 40, materialId: 'hide', materialQuantity: 2 })
    expect(contracts['bastion-patrol']!.reward).toEqual({ xp: 70, gold: 48, materialId: 'shard', materialQuantity: 2 })
    expect(contracts['break-the-elite']!.reward).toEqual({ xp: 20, gold: 14, materialId: 'scrap', materialQuantity: 1 })
    expect(rewardFor(3, 1, 'scrap').materialQuantity).toBe(2)
    expect(rewardFor(4, 1, 'scrap').materialQuantity).toBe(2)
  })

  it('names only enemies, encounters, and nodes that exist', () => {
    const encounterEnemies = new Set(Object.values(encounters).flatMap((encounter) => encounter.members.map((member) => member.enemyId)))
    for (const def of contractList) {
      const target = def.target
      if (target.kind === 'kill') {
        expect(enemies[target.enemyId], def.id).toBeDefined()
        expect(encounterEnemies.has(target.enemyId), def.id).toBe(true)
      } else if (target.kind === 'fights') {
        expect(nodes[target.nodeId]?.encounterIds.length, def.id).toBeGreaterThan(0)
      } else {
        for (const id of target.encounterIds) expect(encounters[id], def.id).toBeDefined()
      }
      expect(def.count).toBeGreaterThan(0)
    }
  })
})

describe('taking and collecting', () => {
  it('accepts up to three, refuses a repeat, and lets one be abandoned', () => {
    let save = heroSave()
    save = ok(acceptContract(save, 'cull-the-pack'))
    expect(acceptContract(save, 'cull-the-pack')).toEqual({ ok: false, reason: 'You already have that contract.' })
    save = ok(acceptContract(save, 'clear-the-shards'))
    save = ok(acceptContract(save, 'hunt-deserters'))
    expect(purseOf(save).contracts).toHaveLength(MAX_ACTIVE_CONTRACTS)
    expect(acceptContract(save, 'thicket-sweep')).toEqual({ ok: false, reason: 'You can have at most 3 contracts at once.' })
    expect(acceptContract(save, 'nothing')).toEqual({ ok: false, reason: 'That contract is not on the board.' })
    const fewer = ok(abandonContract(save, 'clear-the-shards'))
    expect(purseOf(fewer).contracts.map((entry) => entry.contractId)).toEqual(['cull-the-pack', 'hunt-deserters'])
    expect(abandonContract(fewer, 'clear-the-shards')).toEqual({ ok: false, reason: 'You do not have that contract.' })
    expect(() => assertSaveData(save)).not.toThrow()
  })

  it('pays gold, materials, and XP to the collecting hero, then frees the contract', () => {
    let save = ok(acceptContract(heroSave(), 'hunt-deserters'))
    expect(collectContract(save, 'hero-1', 'hunt-deserters')).toEqual({
      ok: false,
      reason: 'Hunt Deserters is not finished: 0 of 3.',
    })
    save = updatePurse(save, { contracts: [{ contractId: 'hunt-deserters', progress: 3 }] })
    expect(isComplete(purseOf(save).contracts[0]!, contracts['hunt-deserters'])).toBe(true)
    const paid = ok(collectContract(save, 'hero-1', 'hunt-deserters'))
    expect(purseOf(paid).gold).toBe(18)
    expect(purseOf(paid).materials).toEqual({ scrap: 2 })
    expect(purseOf(paid).contracts).toEqual([])
    expect(hero(paid).progress).toEqual(awardXp(hero(save).progress, 31))
    expect(purseOf(paid).board.some((entry) => entry.id === 'hunt-deserters')).toBe(false)
    expect(acceptContract(paid, 'hunt-deserters')).toEqual({ ok: false, reason: 'That contract is not on the board.' })
    expect(collectContract(save, 'nobody', 'hunt-deserters')).toEqual({ ok: false, reason: 'Select a hero to collect the reward.' })
    expect(() => assertSaveData(paid)).not.toThrow()
    expect(parseSave(serializeSave(paid)).ok).toBe(true)
  })

  it('is closed while an expedition runs', () => {
    const save = withRun(heroSave(), 'splintered-road')
    const shut = { ok: false, reason: 'The contract board is closed while an expedition is running.' }
    expect(acceptContract(save, 'cull-the-pack')).toEqual(shut)
    expect(abandonContract(save, 'cull-the-pack')).toEqual(shut)
    expect(collectContract(save, 'hero-1', 'cull-the-pack')).toEqual(shut)
  })

  it('rejects a bad contract list in a save', () => {
    const save = ok(acceptContract(heroSave(), 'cull-the-pack'))
    const raw = JSON.parse(serializeSave(save)) as { heroes: { purse: { contracts: Record<string, unknown>[] } }[] }
    raw.heroes[0]!.purse.contracts[0]!.contractId = 'nothing'
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false, reason: expect.stringMatching(/contract id is unknown/) })
    raw.heroes[0]!.purse.contracts[0]!.contractId = 'cull-the-pack'
    raw.heroes[0]!.purse.contracts[0]!.progress = 99
    expect(parseSave(JSON.stringify(raw))).toMatchObject({ ok: false, reason: expect.stringMatching(/past its target/) })
  })
})

describe('progress from expeditions', () => {
  it('counts kills, node fights, and elites from won fights only', () => {
    const save = victories(withRun(heroSave(), 'fracture-via-grove'), 5)
    const run = save.expedition!
    expect(unitsFrom(run, contracts['cull-the-pack']!)).toBe(2)
    expect(unitsFrom(run, contracts['clear-the-shards']!)).toBe(2)
    expect(unitsFrom(run, contracts['hunt-deserters']!)).toBe(1)
    expect(unitsFrom(run, contracts['thicket-sweep']!)).toBe(2)
    expect(unitsFrom(run, contracts['bastion-patrol']!)).toBe(0)
    expect(unitsFrom(run, contracts['break-the-elite']!)).toBe(1)
    run.history[4]!.outcome = 'defeat'
    run.history[1]!.outcome = 'retreat'
    expect(unitsFrom(run, contracts['cull-the-pack']!)).toBe(0)
    expect(unitsFrom(run, contracts['break-the-elite']!)).toBe(0)
    expect(unitsFrom(run, contracts['thicket-sweep']!)).toBe(1)
  })

  it('adds progress when an expedition is settled, never past the target, and even after a defeat', () => {
    let save = heroSave()
    for (const id of ['cull-the-pack', 'break-the-elite', 'thicket-sweep']) save = ok(acceptContract(save, id))
    save = victories(withRun(save, 'fracture-via-grove'), 5)
    save.expedition!.outcome = 'defeat'
    save.expedition!.history.push({ index: 5, encounterId: 'fractured-warden', seed: 9, outcome: 'defeat', durationMs: 1 })
    const settled = settleExpedition(save)
    const progress = Object.fromEntries(purseOf(settled).contracts.map((entry) => [entry.contractId, entry.progress]))
    expect(progress).toEqual({ 'cull-the-pack': 2, 'break-the-elite': 1, 'thicket-sweep': 2 })
    const again = addContractProgress(addContractProgress(settled, save.expedition!), save.expedition!)
    expect(purseOf(again).contracts.find((entry) => entry.contractId === 'break-the-elite')?.progress).toBe(1)
    expect(purseOf(again).contracts.find((entry) => entry.contractId === 'cull-the-pack')?.progress).toBe(6)
    expect(() => assertSaveData(again)).not.toThrow()
  })

  it('adds progress only to contracts that are active', () => {
    const save = victories(withRun(heroSave(), 'splintered-road'), 3)
    expect(addContractProgress(save, save.expedition!)).toBe(save)
  })
})

describe('experience from fights', () => {
  function playFirstFight(race: 'human' | 'elf', seed: number) {
    const base = heroSave(race)
    const run = startExpedition(hero(base), 'splintered-road', seed)
    const defs = gameDefs()
    let members: { xp: number; level: number; summon: boolean }[] = []
    let guard = 0
    while (run.history.length === 0 && run.outcome === 'ongoing' && guard < 100_000) {
      stepExpedition(run, defs)
      if (run.combat !== null && members.length === 0) {
        members = run.combat.enemies.map((enemy) => ({ xp: enemy.xp, level: enemy.level, summon: enemy.summon }))
      }
      guard += 1
    }
    return { base, run, members }
  }

  it('awards the encounter XP for a won fight, with the Human bonus, and adds it at settle', () => {
    let proved = false
    for (let seed = 1; seed < 60 && !proved; seed += 1) {
      const { base, run, members } = playFirstFight('human', seed)
      if (run.history[0]?.outcome !== 'victory') continue
      proved = true
      const spirit = hero(base).progress.attributes.spirit
      expect(run.xpEarned).toBe(humanOrdinaryXp(1, spirit, members, []))
      expect(run.xpEarned).toBeGreaterThan(xpFromEnemies(1, spirit, members) - 1)
      const save = { ...base, expedition: run }
      run.outcome = 'returned'
      const settled = settleExpedition(save)
      expect(hero(settled).progress).toEqual(awardXp(hero(base).progress, run.xpEarned ?? 0))
      expect(run.xpEarned ?? 0).toBeGreaterThan(0)
      expect(outcomeSummary(run).lines).toContain(`Experience earned: ${run.xpEarned}.`)
    }
    expect(proved).toBe(true)
  })

  it('gives a non-Human the plain encounter XP and keeps XP after a defeat', () => {
    let proved = false
    for (let seed = 1; seed < 80 && !proved; seed += 1) {
      const { base, run, members } = playFirstFight('elf', seed)
      if (run.history[0]?.outcome !== 'victory') continue
      proved = true
      expect(run.xpEarned).toBe(xpFromEnemies(1, hero(base).progress.attributes.spirit, members))
      run.outcome = 'defeat'
      run.history.push({ index: 1, encounterId: 'wolf-pair', seed: 2, outcome: 'defeat', durationMs: 1 })
      const settled = settleExpedition({ ...base, expedition: run })
      expect(hero(settled).progress).toEqual(awardXp(hero(base).progress, run.xpEarned ?? 0))
      expect(run.xpEarned ?? 0).toBeGreaterThan(0)
    }
    expect(proved).toBe(true)
  })

  it('adds no experience line when none was earned', () => {
    const run = startExpedition(hero(heroSave()), 'splintered-road', 1)
    run.outcome = 'returned'
    expect(outcomeSummary(run).lines.some((line) => line.startsWith('Experience earned'))).toBe(false)
  })
})

describe('the rolled board', () => {
  const ROAD = ['node:greyhaven', 'node:splintered-road']
  const ALL = [...ROAD, 'node:withered-grove', 'node:fallen-bastion']

  function fresh(name = 'Ash'): SaveData {
    const made = createHero(newSave(), { name, race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    return made.save
  }

  function rolls(discoveries: readonly string[], times: number): ContractDef[] {
    const rng = createRng(7)
    const out: ContractDef[] = []
    for (let index = 0; index < times; index += 1) {
      const offer = rollContract(`t-${index}`, discoveries, () => nextFloat(rng))
      if (offer !== null) out.push(offer)
    }
    return out
  }

  it('gives a new hero four different Road offers, the same each time', () => {
    const board = purseOf(fresh()).board
    expect(board).toHaveLength(BOARD_SIZE)
    expect(new Set(board.map((def) => targetKey(def.target))).size).toBe(BOARD_SIZE)
    expect(purseOf(fresh()).board).toEqual(board)
    for (const def of board) {
      expect(def.target.kind === 'kill' ? ['fracture-shardling', 'starved-wolf', 'deserter'] : ['splintered-road']).toContain(
        def.target.kind === 'kill' ? def.target.enemyId : def.target.kind === 'fights' ? def.target.nodeId : 'elite',
      )
    }
  })

  it('rolls counts and rewards inside the decided ranges', () => {
    const offers = rolls(ALL, 400)
    const kinds = new Set(offers.map((def) => def.target.kind))
    expect([...kinds].sort()).toEqual(['encounters', 'fights', 'kill'])
    const monsters = new Set(offers.flatMap((def) => (def.target.kind === 'kill' ? [def.target.enemyId] : [])))
    expect([...monsters].sort()).toEqual(['blight-spider', 'deserter', 'fallen-arbalist', 'fracture-shardling', 'hollow-sentry', 'starved-wolf', 'thornbeast'])
    for (const def of offers) {
      if (def.target.kind === 'kill') {
        const paired = def.target.enemyId === 'fracture-shardling'
        expect(def.count).toBeGreaterThanOrEqual(paired ? 6 : 3)
        expect(def.count).toBeLessThanOrEqual(paired ? 16 : 8)
        if (paired) expect(def.count % 2).toBe(0)
      } else if (def.target.kind === 'fights') {
        expect(def.count).toBeGreaterThanOrEqual(3)
        expect(def.count).toBeLessThanOrEqual(6)
      } else {
        expect(def.count).toBe(1)
      }
      const base = rewardFor(def.count, def.level, def.reward.materialId)
      expect(def.reward.gold).toBeGreaterThanOrEqual(Math.floor(base.gold * 0.8))
      expect(def.reward.gold).toBeLessThanOrEqual(Math.ceil(base.gold * 1.3))
      expect(def.reward.materialQuantity).toBeGreaterThanOrEqual(1)
    }
    const elites = offers.filter((def) => def.target.kind === 'encounters').length
    expect(elites / offers.length).toBeGreaterThan(0.06)
    expect(elites / offers.length).toBeLessThan(0.2)
  })

  it('counts drawn fights past the fixed ones toward a Patrol of the last zone', () => {
    const run = startExpedition(hero(fresh()), 'splintered-road', 1)
    run.history = [0, 1, 2, 3, 4].map((index) => ({ index, encounterId: index < 3 ? run.opening[index]!.id : 'road-mixed', seed: index, outcome: 'victory' as const, durationMs: 1 }))
    expect(unitsFrom(run, { ...contracts['thicket-sweep']!, target: { kind: 'fights', nodeId: 'splintered-road' } })).toBe(5)
  })

  it('offers nothing past the Road until a zone is discovered', () => {
    for (const def of rolls(ROAD, 200)) {
      expect(def.target.kind).not.toBe('encounters')
      if (def.target.kind === 'fights') expect(def.target.nodeId).toBe('splintered-road')
    }
    expect(rollContract('none', [], () => 0.5)).toBeNull()
  })

  it('refills a collected or abandoned slot and rerolls untaken offers on return', () => {
    let save = fresh()
    const [first, second] = purseOf(save).board
    save = ok(acceptContract(save, first!.id))
    const abandoned = ok(abandonContract(save, first!.id))
    expect(purseOf(abandoned).board).toHaveLength(BOARD_SIZE)
    expect(purseOf(abandoned).board.some((def) => def.id === first!.id)).toBe(false)

    save = ok(acceptContract(save, second!.id))
    save = withRun(save, 'splintered-road')
    save.expedition!.outcome = 'returned'
    const settled = settleExpedition(save)
    const board = purseOf(settled).board
    expect(board).toHaveLength(BOARD_SIZE)
    expect(board.map((def) => def.id)).toEqual(expect.arrayContaining([first!.id, second!.id]))
    expect(board.filter((def) => def.id !== first!.id && def.id !== second!.id).every((def) => !purseOf(save).board.some((old) => old.id === def.id))).toBe(true)
    expect(() => assertSaveData(settled)).not.toThrow()
  })

  it('moves a contract held from the old fixed board onto the new board', () => {
    const save = fresh()
    const raw = JSON.parse(serializeSave(save)) as { heroes: Record<string, unknown>[] }
    const purse = raw.heroes[0]!.purse as Record<string, unknown>
    delete purse.board
    delete purse.boardRolls
    purse.contracts = [{ contractId: 'cull-the-pack', progress: 2 }]
    raw.heroes[0]!.updates = ['supply-rules', 'ranger-fade-back']
    const parsed = parseSave(JSON.stringify(raw))
    if (!parsed.ok) throw new Error(parsed.reason)
    const board = purseOf(parsed.data).board
    expect(board[0]).toEqual(contracts['cull-the-pack'])
    expect(board).toHaveLength(BOARD_SIZE)
  })
})
