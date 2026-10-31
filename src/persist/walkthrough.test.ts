import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { enemies } from '../content/enemies.ts'
import { routes } from '../content/world.ts'
import { returnToTown, stepExpedition } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { nextHint } from './guidance.ts'
import { createHero } from './roster.ts'
import { newSave, type SaveData } from './save.ts'
import { beginExpedition, canStartRoute, fightNodeIds, recordProgress, settleExpedition } from './world.ts'

const defs = gameDefs()

/** Fight until the whole route has been fought, then walk home, pushing on after every fight like the player would. */
function playOut(save: SaveData): SaveData {
  const expedition = save.expedition
  const route = routes[expedition?.id ?? '']
  if (expedition === null || route === undefined) throw new Error('no expedition')
  const fights = fightNodeIds(route).length
  for (let steps = 0; expedition.outcome === 'ongoing' && steps < 50_000_000; steps += 1) {
    if (expedition.history.length >= fights && !expedition.returning && expedition.phase === 'travel' && expedition.combat === null) {
      returnToTown(expedition)
      continue
    }
    stepExpedition(expedition, defs)
  }
  return settleExpedition(recordProgress(save))
}

function strongHero(): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)
  if (hero === null) throw new Error('no hero')
  const attributes = { strength: 400, vitality: 400, agility: 100, intellect: 10, spirit: 100 }
  return {
    ...made.save,
    heroes: made.save.heroes.map((entry) =>
      entry.id === hero.id ? { ...entry, progress: { ...entry.progress, level: 40, attributes } } : entry,
    ),
  }
}

describe('a new game can reach the Warden through ordinary play', () => {
  it('opens each route from the one before and ends at a Warden fight with no dev tools', () => {
    let save = strongHero()
    expect(nextHint(newSave()).text).toContain('Create your first hero')
    expect(canStartRoute(save, 'splintered-road').ok).toBe(true)

    for (const routeId of ['splintered-road', 'withered-grove', 'fallen-bastion']) {
      const started = beginExpedition(save, routeId, 5)
      if (!started.ok) throw new Error(`${routeId}: ${started.reason}`)
      save = playOut(started.save)
      expect(save.expedition).toBeNull()
    }

    const route = 'fracture-via-grove'
    const check = canStartRoute(save, route)
    expect(check).toEqual({ ok: true })
    const started = beginExpedition(save, route, 5)
    if (!started.ok) throw new Error(started.reason)
    const bossFights = started.save.expedition?.opening.filter((fight) => fight.enemies.some((enemy) => enemies[enemy.defId]?.boss === true))
    expect(bossFights?.length).toBeGreaterThan(0)
  }, 120_000)
})
