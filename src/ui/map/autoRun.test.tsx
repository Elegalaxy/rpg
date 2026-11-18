import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { contracts } from '../../content/contracts.ts'
import { contractFitsRoute } from '../../persist/autoContracts.ts'
import { routes } from '../../content/world.ts'
import { selectedHero } from '../../persist/character.ts'
import { createHero } from '../../persist/roster.ts'
import { runOffline } from '../../persist/offline.ts'
import { contractFor, newSave, parseSave, serializeSave, type SaveData, type SavedHero } from '../../persist/save.ts'
import { advanceExpedition, commitSave, expeditionWaiting, getAutoNotice, getSaveStatus, pushOnFromUi, setAutoRunFromUi, startExpeditionFromUi } from '../store.ts'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'

/** Start a Road run for a level 40 Warrior (wins every fight) with the given hero settings. */
function startRun(patch: Partial<SavedHero>) {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  const cleared = patch.clearedNodeIds ?? [...(routes['splintered-road']?.nodeIds ?? [])]
  const heroes = made.save.heroes.map((hero) => ({ ...hero, clearedNodeIds: cleared, progress: { ...hero.progress, level: 40, attributes }, ...patch }))
  commitSave({ ...made.save, heroes }, 'test', false)
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
    array[0] = 5
    return array
  }) as never)
  setAutoRunFromUi(patch.autoRun === true) // restarts the session count
  expect(startExpeditionFromUi('splintered-road')).toBeNull()
  const run = getSaveStatus().save.expedition
  if (run === null) throw new Error('no run')
  return run
}

function play(done: () => boolean): void {
  for (let steps = 0; steps < 400_000 && !done(); steps += 50) advanceExpedition(50)
}

const hero = () => selectedHero(getSaveStatus().save)

describe('Auto run in a live run', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('is off by default: the run waits for the player at the hold', () => {
    const run = startRun({ repeatRoute: false })
    expect(hero()?.autoRun).not.toBe(true)
    play(() => expeditionWaiting() || run.outcome !== 'ongoing')
    expect(expeditionWaiting()).toBe(true)
    const fights = run.history.length
    play(() => false)
    expect(run.history).toHaveLength(fights)
  }, 120_000)

  it('pushes on by itself while HP is high, and shows the run bar state', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1 })
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Auto run on')
    play(() => run.history.length >= 2 || run.outcome !== 'ongoing')
    expect(run.history.length).toBeGreaterThanOrEqual(2)
    expect(expeditionWaiting() && run.history.length < 2).toBe(false)
  }, 120_000)

  it('walks home when HP is below the push-on floor', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 100 })
    play(() => run.outcome !== 'ongoing')
    expect(run.outcome).toBe('returned')
    expect(run.history).toHaveLength(1)
    expect(hero()?.autoRun).toBe(true)
  }, 120_000)

  it('respects the per-run stop after fights', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1, stopAfterFights: 2 })
    play(() => run.outcome !== 'ongoing')
    expect(run.history).toHaveLength(2)
    expect(run.outcome).toBe('returned')
  }, 120_000)

  it('stops at the session limit, switches itself off and starts no repeat', () => {
    const run = startRun({ autoRun: true, repeatRoute: true, pushOnHpPercent: 1, autoRunMaxFights: 2 })
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Auto run: fight 0 / 2')
    play(() => run.outcome !== 'ongoing')
    expect(run.history).toHaveLength(2)
    expect(hero()?.autoRun).toBe(false)
    expect(getSaveStatus().save.expedition).toBe(run)
  }, 120_000)

  it('reruns the route on its own, even uncleared and with repeat off, and counts fights across reruns', () => {
    const first = startRun({ autoRun: true, repeatRoute: false, clearedNodeIds: [], pushOnHpPercent: 1, stopAfterFights: 1, autoRunMaxFights: 3 })
    play(() => getSaveStatus().save.expedition !== first)
    const second = getSaveStatus().save.expedition
    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    expect(second?.history).toHaveLength(0)
    expect(hero()?.autoRun).toBe(true)
    // Three fights in all: two more runs of one fight, then it stops.
    const runs = new Set([first, second])
    play(() => {
      const now = getSaveStatus().save.expedition
      if (now !== null) runs.add(now)
      return hero()?.autoRun === false
    })
    expect(hero()?.autoRun).toBe(false)
    expect(runs.size).toBe(3)
    expect(getSaveStatus().save.expedition?.history).toHaveLength(1)
  }, 240_000)

  it('stops and switches off on a defeat, starting nothing', () => {
    const weak = { strength: 1, vitality: 1, agility: 1, intellect: 1, spirit: 1 }
    const run = startRun({ autoRun: true, repeatRoute: true, retreatAtMost: null, pushOnHpPercent: 1 })
    const heroes = getSaveStatus().save.heroes.map((entry) => ({ ...entry, progress: { ...entry.progress, level: 1, attributes: weak } }))
    expect(heroes.length).toBe(1)
    // A fresh weak hero cannot survive the Road without retreating.
    commitSave({ ...getSaveStatus().save, heroes, expedition: null }, 'test', false)
    expect(startExpeditionFromUi('splintered-road')).toBeNull()
    const doomed = getSaveStatus().save.expedition
    expect(doomed).not.toBeNull()
    expect(run).not.toBe(doomed)
    play(() => doomed?.outcome !== 'ongoing')
    expect(doomed?.outcome).toBe('defeat')
    expect(hero()?.autoRun).toBe(false)
    expect(getSaveStatus().save.expedition).toBe(doomed)
    expect(getAutoNotice()).toContain('defeated')
  }, 120_000)

  it('stops and says why when the rerun cannot start', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1, stopAfterFights: 1, packedSupplies: ['healing-draught'] })
    play(() => getSaveStatus().save.expedition !== run)
    expect(getSaveStatus().save.expedition).toBeNull()
    expect(hero()?.autoRun).toBe(false)
    expect(getAutoNotice()).toContain('packed supplies')
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Auto run stopped')
  }, 120_000)

  it('switches off and names the piece when a worn piece is at 0 durability at the rerun', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1, stopAfterFights: 1 })
    const piece = run.equipment[0]!
    piece.durability = 0
    piece.disabled = true
    play(() => getSaveStatus().save.expedition !== run)
    expect(getSaveStatus().save.expedition).toBeNull()
    expect(hero()?.autoRun).toBe(false)
    expect(getAutoNotice()).toMatch(/Auto run stopped: .+ is at 0 durability\. Repair it\./)
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('at 0 durability')
  }, 120_000)

  it('can be switched off mid-run to take manual control, and Push on still works', () => {
    const run = startRun({ autoRun: true, repeatRoute: false, pushOnHpPercent: 1 })
    setAutoRunFromUi(false)
    expect(hero()?.autoRun).toBe(false)
    play(() => expeditionWaiting() || run.outcome !== 'ongoing')
    expect(expeditionWaiting()).toBe(true)
    pushOnFromUi()
    expect(expeditionWaiting()).toBe(false)
  }, 120_000)
})

describe('Auto run in the endless mode (Step 13.26)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does not walk home for the HP floor, the fight order or a full bag', () => {
    const run = startRun({ autoRun: true, autoRunMode: 'endless', repeatRoute: false, pushOnHpPercent: 100, stopAfterFights: 1, bagFullOrder: 'home' })
    play(() => run.history.length >= 4 || run.outcome !== 'ongoing')
    expect(run.history.length).toBeGreaterThanOrEqual(4)
    expect(run.outcome).toBe('ongoing')
    run.unsecured = [{ materialId: 'hide', quantity: run.lootCapacity ?? 26 }]
    const fights = run.history.length
    play(() => run.history.length >= fights + 2 || run.outcome !== 'ongoing')
    expect(run.history.length).toBeGreaterThanOrEqual(fights + 2)
    expect(run.outcome).toBe('ongoing')
  }, 240_000)

  it('repeats the route after a retreat ends the run', () => {
    const run = startRun({ autoRun: true, autoRunMode: 'endless', repeatRoute: false, pushOnHpPercent: 100 })
    play(() => expeditionWaiting() || run.history.length >= 1)
    run.retreatThresholds = [{ kind: 'hpFraction', atMost: 0.5 }]
    run.hero.hp = Math.floor(run.hero.maxHp * 0.3)
    play(() => getSaveStatus().save.expedition !== run)
    const next = getSaveStatus().save.expedition
    expect(next).not.toBeNull()
    expect(next).not.toBe(run)
    expect(run.outcome).toBe('returned')
    expect(hero()?.autoRun).toBe(true)
  }, 240_000)

  it('stops at the total fight limit like the repeat mode', () => {
    const run = startRun({ autoRun: true, autoRunMode: 'endless', repeatRoute: true, pushOnHpPercent: 100, autoRunMaxFights: 3 })
    play(() => run.outcome !== 'ongoing')
    expect(run.history).toHaveLength(3)
    expect(hero()?.autoRun).toBe(false)
  }, 240_000)

  it('stops and switches off on a defeat', () => {
    const run = startRun({ autoRun: true, autoRunMode: 'endless', repeatRoute: true, retreatAtMost: null })
    run.retreatThresholds = []
    run.heroTemplate.attributes = { strength: 1, vitality: 1, agility: 1, intellect: 1, spirit: 1 }
    run.hero.maxHp = 20
    run.hero.hp = 1
    play(() => run.outcome !== 'ongoing')
    expect(run.outcome).toBe('defeat')
    expect(hero()?.autoRun).toBe(false)
    expect(getAutoNotice()).toContain('defeated')
  }, 120_000)

  it('plays the same fights live and in the away replay', () => {
    const settings = { autoRun: true, autoRunMode: 'endless' as const, repeatRoute: false, pushOnHpPercent: 100, stopAfterFights: 1, autoRunMaxFights: 5 }
    const run = startRun(settings)
    const away = JSON.parse(JSON.stringify(getSaveStatus().save)) as SaveData
    play(() => run.outcome !== 'ongoing')
    const live = run.history.map((entry) => entry.encounterId)
    const replay = runOffline(away, 30 * 60_000, true)
    const heroAway = replay.summary.heroes[0]
    expect(live).toHaveLength(5)
    expect(replay.save.expedition?.history.map((entry) => entry.encounterId)).toEqual(live)
    expect(heroAway?.stopped).toBe('autoLimit')
    expect(replay.save.heroes[0]?.autoRun).toBe(false)
    expect(hero()?.autoRun).toBe(false)
  }, 240_000)
})

describe('Auto run in the save', () => {
  it('survives a save and reload', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const heroes = made.save.heroes.map((entry) => ({ ...entry, autoRun: true, autoRunMaxFights: 100 }))
    const parsed = parseSave(serializeSave({ ...made.save, heroes }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.heroes[0]).toMatchObject({ autoRun: true, autoRunMaxFights: 100 })
  })

  it('saves and loads the keep-going bag order', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    const heroes = made.save.heroes.map((entry) => ({ ...entry, bagFullOrder: 'keep' as const }))
    const parsed = parseSave(serializeSave({ ...made.save, heroes }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.heroes[0]?.bagFullOrder).toBe('keep')
  })

  it('loads a save without the fields and refuses bad values', () => {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    expect(parseSave(serializeSave(made.save)).ok).toBe(true)
    for (const bad of [{ autoRunMaxFights: 0 }, { autoRunMaxFights: 10000 }, { autoRunMaxFights: 1.5 }, { autoRun: 'yes' }, { bagFullOrder: 'forever' }]) {
      const heroes = made.save.heroes.map((entry) => ({ ...entry, ...bad }))
      expect(parseSave(JSON.stringify({ ...made.save, heroes })).ok).toBe(false)
    }
  })
})

describe('the shared hold decision', () => {
  it('gives the same verdict order live and away: fights, HP, bag, then push', async () => {
    const { decideHold } = await import('../../persist/world.ts')
    const run = { history: [{}, {}], hero: { hp: 50, maxHp: 100 }, unsecured: [], lootCapacity: 26 } as never
    const orders = { stopAfterFights: null, pushOnHpPercent: 50, bagFullOrder: 'home' as const }
    expect(decideHold(run, orders)).toBe('push')
    expect(decideHold(run, { ...orders, pushOnHpPercent: 51 })).toBe('hp')
    expect(decideHold(run, { ...orders, stopAfterFights: 2, pushOnHpPercent: 51 })).toBe('fights')
  })

  it('keeps going with a full bag under the keep order, while the other stop rules still win', async () => {
    const { decideHold } = await import('../../persist/world.ts')
    const full = { history: [{}, {}], hero: { hp: 50, maxHp: 100 }, unsecured: [{ materialId: 'hide', quantity: 26 }], lootCapacity: 26 } as never
    const orders = { stopAfterFights: null, pushOnHpPercent: 50, bagFullOrder: 'home' as const }
    expect(decideHold(full, orders)).toBe('bag')
    expect(decideHold(full, { ...orders, bagFullOrder: 'ask' })).toBe('ask')
    expect(decideHold(full, { ...orders, bagFullOrder: 'keep' })).toBe('push')
    expect(decideHold(full, { ...orders, bagFullOrder: 'keep', pushOnHpPercent: 51 })).toBe('hp')
    expect(decideHold(full, { ...orders, bagFullOrder: 'keep', stopAfterFights: 2 })).toBe('fights')
  })
})

describe('the Auto run mode on the preparation screen (Step 13.26)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function prepare(patch: Partial<SavedHero>): string {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    commitSave({ ...made.save, heroes: made.save.heroes.map((entry) => ({ ...entry, ...patch })) }, 'test', false)
    return renderToStaticMarkup(<ExpeditionPanel />)
  }

  it('shows the select disabled with a reason while Auto run is off', () => {
    const html = prepare({ autoRun: false })
    expect(html).toMatch(/<select[^>]*aria-label="Auto run mode"[^>]*disabled/)
    expect(html).toContain('Turn on Auto run to choose what happens when the route ends.')
    expect(html).toContain('Repeat the route')
    expect(html).toContain('Climb Echo ranks through the Bastion')
  })

  it('says loot is lost in the endless mode and warns when no retreat level is set', () => {
    const html = prepare({ autoRun: true, autoRunMode: 'endless', retreatAtMost: null })
    expect(html).not.toMatch(/<select[^>]*aria-label="Auto run mode"[^>]*disabled/)
    expect(html).toContain('Loot that does not fit the bag is lost.')
    expect(html).toContain('auto-run-endless-warning')
    expect(html).toContain('can only end by defeat or the total fight limit')
  })

  it('has no warning with a retreat level, or in the repeat mode', () => {
    expect(prepare({ autoRun: true, autoRunMode: 'endless', retreatAtMost: 0.4 })).not.toContain('auto-run-endless-warning')
    expect(prepare({ autoRun: true, autoRunMode: 'repeat', retreatAtMost: null })).not.toContain('auto-run-endless-warning')
  })

  it('shows the contracts checkbox, disabled with a reason while Auto run is off', () => {
    const off = prepare({ autoRun: false })
    expect(off).toMatch(/<input[^>]*aria-label="Auto run contracts"[^>]*disabled/)
    expect(off).toContain('Turn on Auto run to hand in and take contracts at home.')
    expect(prepare({ autoRun: true, autoContracts: true })).toMatch(/<input[^>]*aria-label="Auto run contracts"[^>]*checked/)
  })

  it('tags the run dock Auto · endless', async () => {
    const { RunDock } = await import('../RunDock.tsx')
    const html = (patch: Partial<SavedHero>) => {
      prepare(patch)
      const run = startRun(patch)
      expect(run).not.toBeNull()
      return renderToStaticMarkup(<RunDock onOpenMap={() => undefined} />)
    }
    expect(html({ autoRun: true, autoRunMode: 'endless' })).toContain('Auto · endless')
    expect(html({ autoRun: true })).not.toContain('Auto · endless')
  })
})

describe('Auto run contracts at home (Step 13.26)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const offers = [contracts['cull-the-pack']!, contracts['thicket-sweep']!]

  function withBoard(on: boolean) {
    const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
    if (!made.ok) throw new Error(made.reason)
    return startRun({ autoRun: true, autoContracts: on, repeatRoute: false, pushOnHpPercent: 1, stopAfterFights: 1, autoRunMaxFights: 2, purse: { ...made.save.heroes[0]!.purse, board: offers } })
  }

  it('takes a fitting offer at home when on, and the same offline', () => {
    const first = withBoard(true)
    const away = JSON.parse(JSON.stringify(getSaveStatus().save)) as SaveData
    play(() => getSaveStatus().save.expedition !== first)
    const live = hero()!.purse.contracts.map((entry) => entry.contractId)
    const purse = hero()!.purse
    expect(live.length).toBeGreaterThan(0)
    for (const entry of purse.contracts) expect(contractFitsRoute(contractFor(purse, entry.contractId)!, 'splintered-road')).toBe(true)
    const replay = runOffline(away, 30 * 60_000, true)
    expect(selectedHero(replay.save)!.purse.contracts.map((entry) => entry.contractId)).toEqual(live)
  }, 240_000)

  it('takes nothing when off', () => {
    const first = withBoard(false)
    play(() => getSaveStatus().save.expedition !== first)
    expect(hero()!.purse.contracts).toHaveLength(0)
  }, 240_000)
})
