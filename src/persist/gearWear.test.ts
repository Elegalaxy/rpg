import { describe, expect, it } from 'vitest'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { runOffline } from './offline.ts'
import { createHero } from './roster.ts'
import { newSave, type SaveData } from './save.ts'
import { routes } from '../content/world.ts'
import { gearWearOf, outcomeStats, outcomeSummary, settleExpedition } from './world.ts'
import type { ExpeditionState } from '../sim/expedition.ts'

function withHero(): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

const NORMAL = 'wolf-pair'
const ELITE = 'rootmaw-fight'
const BOSS = 'warden-fight'

/** A run with `wins` plain victories, then the listed extra fights, as a settled-ready state. */
function run(save: SaveData, outcome: 'returned' | 'defeat', wins: number, extra: ('elite' | 'boss' | 'loss')[] = []): SaveData {
  const hero = selectedHero(save)!
  const expedition: ExpeditionState = startExpedition(hero, 'splintered-road', 1)
  expedition.opening = [
    { id: NORMAL, enemies: [{ defId: 'wolf' } as never] },
    { id: ELITE, enemies: [{ defId: 'rootmaw-stalker' } as never] },
    { id: BOSS, enemies: [{ defId: 'fractured-warden' } as never] },
  ]
  expedition.draw = []
  expedition.outcome = outcome
  const history: ExpeditionState['history'] = []
  const add = (encounterId: string, result: 'victory' | 'defeat') =>
    history.push({ index: history.length, encounterId, seed: 1, outcome: result, durationMs: 1 })
  for (let i = 0; i < wins; i++) add(NORMAL, 'victory')
  for (const kind of extra) add(kind === 'elite' ? ELITE : kind === 'boss' ? BOSS : NORMAL, kind === 'loss' ? 'defeat' : 'victory')
  expedition.history = history
  if (outcome === 'defeat') for (const entry of expedition.equipment) entry.durability -= 10
  return { ...save, expedition }
}

function mainHand(save: SaveData): number {
  return selectedHero(save)!.equipment.mainHand!.durability
}

describe('gear wear at settle', () => {
  it('floors the whole run: 2 wins = 0, 3 = 1, 25 = 8', () => {
    for (const [wins, loss] of [[0, 0], [2, 0], [3, 1], [5, 1], [6, 2], [25, 8]] as const) {
      const settled = settleExpedition(run(withHero(), 'returned', wins), 1)
      expect(mainHand(settled)).toBe(100 - loss)
    }
  })

  it('counts an elite or boss win as 2 fights', () => {
    expect(gearWearOf(run(withHero(), 'returned', 2, ['elite']).expedition!)).toBe(1)
    expect(gearWearOf(run(withHero(), 'returned', 1, ['boss']).expedition!)).toBe(1)
    expect(gearWearOf(run(withHero(), 'returned', 0, ['elite', 'boss']).expedition!)).toBe(1)
    expect(gearWearOf(run(withHero(), 'returned', 2, ['elite', 'elite']).expedition!)).toBe(2)
    expect(gearWearOf(run(withHero(), 'returned', 1, ['elite']).expedition!)).toBe(1)
  })

  it('a lost fight is not a win and earns no wear on its own', () => {
    expect(gearWearOf(run(withHero(), 'defeat', 0, ['loss']).expedition!)).toBe(0)
  })

  it('stacks with the flat defeat loss of 10', () => {
    const settled = settleExpedition(run(withHero(), 'defeat', 6, ['loss']), 1)
    expect(mainHand(settled)).toBe(100 - 10 - 2)
  })

  it('applies to a run that ended by retreat or escape (a safe return)', () => {
    const save = run(withHero(), 'returned', 3)
    save.expedition!.history.push({ index: 3, encounterId: NORMAL, seed: 1, outcome: 'retreat', durationMs: 1 })
    expect(mainHand(settleExpedition(save, 1))).toBe(99)
  })

  it('stops at 0 and disables the piece', () => {
    const save = withHero()
    const hero = selectedHero(save)!
    const low = { ...hero, equipment: { ...hero.equipment, mainHand: { ...hero.equipment.mainHand!, durability: 2 } } }
    const prepared = { ...save, heroes: save.heroes.map((entry) => (entry.id === hero.id ? low : entry)) }
    const settled = settleExpedition(run(prepared, 'returned', 12), 1)
    expect(mainHand(settled)).toBe(0)
    expect(selectedHero(settled)!.equipment.head!.durability).toBe(96)
  })

  it('shows the wear on the summary and the card data, and nothing for a run with no wins', () => {
    const wornRun = run(withHero(), 'returned', 6).expedition!
    expect(outcomeSummary(wornRun).lines).toContain('Gear wear: -2 durability on each worn piece.')
    expect(outcomeStats(wornRun).gearWear).toBe(2)
    expect(outcomeStats(wornRun).gear.every((piece) => piece.durability === 98)).toBe(true)
    const none = run(withHero(), 'returned', 2).expedition!
    expect(outcomeSummary(none).lines.some((line) => line.startsWith('Gear wear'))).toBe(false)
  })

  it('wears gear on an away run, which settles through the same code', () => {
    const save = withHero()
    const hero = selectedHero(save)!
    const route = routes['splintered-road']!
    const ready = { ...hero, awayRouteId: route.id, clearedNodeIds: [...route.nodeIds], repeatRoute: true, stopAfterFights: 9, pushOnHpPercent: 0 }
    const away = { ...save, lastSeenAt: 1_000_000, heroes: save.heroes.map((entry) => (entry.id === hero.id ? ready : entry)) }
    const { save: after, summary } = runOffline(away, 30 * 60_000, false)
    const fights = summary.heroes.reduce((total, entry) => total + entry.fightsWon, 0)
    expect(fights).toBeGreaterThanOrEqual(3)
    expect(mainHand(after)).toBeLessThan(100)
  })
})
