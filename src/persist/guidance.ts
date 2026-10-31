// Plain-language hint for what a player can do next. Pure: reads the save, changes nothing.

import { gearGaps } from '../sim/economy.ts'
import { itemBase } from '../content/items.ts'
import { routes } from '../content/world.ts'

import { selectedHero } from './character.ts'
import { canStartRoute } from './world.ts'
import type { SaveData } from './save.ts'

export type Tab = 'heroes' | 'town' | 'map' | 'combat'

export type Hint = { tab: Tab; text: string }

/** The route a hero should try next: the first unlocked route they have not finished, in world order. */
function nextRouteId(save: SaveData): string | null {
  const hero = selectedHero(save)
  if (hero === null) return null
  const order = ['splintered-road', 'withered-grove', 'fallen-bastion', 'fracture-via-grove', 'fracture-via-bastion']
  for (const id of order) {
    if (routes[id] === undefined) continue
    if (!canStartRoute(save, id).ok) continue
    return id
  }
  return null
}

export function nextHint(save: SaveData): Hint {
  const hero = selectedHero(save)
  if (hero === null) {
    return save.heroes.length === 0
      ? { tab: 'heroes', text: 'Create your first hero.' }
      : { tab: 'heroes', text: 'Select a hero from the roster.' }
  }
  if (save.expedition !== null) return { tab: 'map', text: `${hero.name} is out on an expedition. Watch it on the Map.` }
  if (hero.progress.unspentAttributePoints > 0 || hero.progress.unspentSkillPoints > 0) {
    return { tab: 'heroes', text: 'You have unspent points. Spend them on Attributes or the Skill web.' }
  }
  if (gearGaps(hero.equipment, itemBase).length > 0) return { tab: 'town', text: 'Buy or equip gear for every slot.' }
  if (hero.bossLossThisLife) return { tab: 'heroes', text: 'A boss beat you. You can reincarnate on the Heroes tab, or rebuild and try again.' }
  const next = nextRouteId(save)
  if (next === null) return { tab: 'town', text: 'Visit the Town to repair, take a contract, or craft.' }
  return { tab: 'map', text: 'Choose a route on the Map and start an expedition.' }
}
