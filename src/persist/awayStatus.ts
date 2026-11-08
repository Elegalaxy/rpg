import { routes } from '../content/world.ts'
import { bagRoomLeft, lootCapacityOf } from '../sim/expedition.ts'

import type { SavedHero } from './save.ts'

export type AwayStatus = { kind: 'running' | 'returned' | 'defeat'; text: string }

/** What a hero who is not selected is doing in the background, or null when it has no away run. */
export function awayStatusOf(hero: SavedHero): AwayStatus | null {
  const run = hero.awayRun
  if (run === null) return null
  if (run.outcome === 'defeat') return { kind: 'defeat', text: 'Defeated, open the Map' }
  if (run.outcome === 'returned') return { kind: 'returned', text: 'Back in town, open the Map' }
  const fights = run.history.filter((entry) => entry.outcome === 'victory').length
  const capacity = lootCapacityOf(run)
  const route = routes[run.id]?.name ?? run.id
  return { kind: 'running', text: `Away: ${route}, ${fights} ${fights === 1 ? 'fight' : 'fights'}, bag ${capacity - bagRoomLeft(run)}/${capacity}` }
}
