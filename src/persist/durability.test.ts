import { describe, expect, it } from 'vitest'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { newSave, type SaveData } from './save.ts'
import { routes } from '../content/world.ts'
import { createOffline } from './offline.ts'
import { beginExpedition, canStartRoute, disabledPieces, settleExpedition } from './world.ts'

const NOW = 1_000_000

function withHero(): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

/** A run that was lost: every piece lost 10 durability and the 5-minute rest is owed. */
function lostRun(save: SaveData): SaveData {
  const hero = selectedHero(save)
  if (hero === null) throw new Error('no hero')
  const expedition = startExpedition(hero, 'splintered-road', 1)
  expedition.outcome = 'defeat'
  for (const entry of expedition.equipment) entry.durability -= 10
  expedition.recoveryMs = 5 * 60_000
  return { ...save, expedition }
}

describe('durability carry-through', () => {
  it('starts a run with the durability the saved items have', () => {
    const save = withHero()
    const hero = selectedHero(save)!
    const worn = { ...hero.equipment, mainHand: { ...hero.equipment.mainHand!, durability: 37 } }
    const expedition = startExpedition({ ...hero, equipment: worn }, 'splintered-road', 1)
    expect(expedition.equipment.find((entry) => entry.slot === 'mainHand')?.durability).toBe(37)
    expect(expedition.equipment.find((entry) => entry.slot === 'head')?.durability).toBe(100)
  })

  it('keeps gear at 90 after a lost fight and into the next run', () => {
    const settled = settleExpedition(lostRun(withHero()), NOW)
    const hero = selectedHero(settled)!
    expect(hero.equipment.mainHand?.durability).toBe(90)
    const begun = beginExpedition(settled, 'splintered-road', 2, NOW + 5 * 60_000)
    if (!begun.ok) throw new Error(begun.reason)
    expect(begun.save.expedition!.equipment.every((entry) => entry.durability === 90)).toBe(true)
    // Ending that run without a fight must not heal the gear.
    const again = settleExpedition({ ...begun.save, expedition: { ...begun.save.expedition!, outcome: 'returned' } }, NOW + 6 * 60_000)
    expect(selectedHero(again)!.equipment.mainHand?.durability).toBe(90)
  })

  it('refuses a start while the rest after a defeat is pending, and allows it afterwards', () => {
    const settled = settleExpedition(lostRun(withHero()), NOW)
    expect(selectedHero(settled)!.recoveryUntil).toBe(NOW + 5 * 60_000)
    const early = canStartRoute(settled, 'splintered-road', NOW + 60_000)
    expect(early.ok).toBe(false)
    if (!early.ok) expect(early.reason).toMatch(/recovering.*4 min/)
    expect(canStartRoute(settled, 'splintered-road', NOW + 5 * 60_000).ok).toBe(true)
  })

  it('refuses a start while a piece is disabled and names it', () => {
    const save = withHero()
    const hero = selectedHero(save)!
    const broken = { ...hero, equipment: { ...hero.equipment, head: { ...hero.equipment.head!, durability: 0 } } }
    const next = { ...save, heroes: save.heroes.map((entry) => (entry.id === hero.id ? broken : entry)) }
    expect(disabledPieces(selectedHero(next)!)).toHaveLength(1)
    const check = canStartRoute(next, 'splintered-road', NOW)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toMatch(/Repair first/)
  })

  it('does not start an away run on a disabled piece or during the rest, and says why', () => {
    const save = withHero()
    const hero = selectedHero(save)!
    const route = routes['splintered-road']!
    const ready = {
      ...hero,
      awayRouteId: route.id,
      clearedNodeIds: [...route.nodeIds],
      equipment: { ...hero.equipment, head: { ...hero.equipment.head!, durability: 0 } },
    }
    const broken = { ...save, lastSeenAt: NOW, heroes: save.heroes.map((entry) => (entry.id === hero.id ? ready : entry)) }
    const lane = createOffline(broken, 60_000, false).lanes[0]!
    expect(lane.stopped).toBe('blocked')
    expect(lane.summary.note).toMatch(/Repair first/)
    const resting = { ...broken, heroes: broken.heroes.map((entry) => ({ ...entry, equipment: hero.equipment, recoveryUntil: NOW + 60_000 })) }
    const rest = createOffline(resting, 60_000, false).lanes[0]!
    expect(rest.stopped).toBe('blocked')
    expect(rest.summary.note).toMatch(/recovering/)
  })
})
