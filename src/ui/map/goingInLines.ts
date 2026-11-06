import { itemBase, itemName } from '../../content/items.ts'
import { countNames } from '../town/groupItems.ts'
import { supplyName } from '../../content/supplies.ts'
import { skillName } from '../../persist/loadout.ts'
import type { SavedHero } from '../../persist/save.ts'
import { EQUIPMENT_SLOT_IDS, gearGaps, type ItemInstance } from '../../sim/economy.ts'

export type GoTo = { tab: 'heroes' | 'town'; heroPart?: 'combat' | 'gear' }

export type Line = { label: string; text: string; warn?: string; edit?: { to: GoTo; label: string } }

/** Worn pieces that are broken or nearly so. */
function weakPieces(hero: SavedHero): { broken: ItemInstance[]; worn: ItemInstance[] } {
  const pieces = EQUIPMENT_SLOT_IDS.flatMap((slot) => {
    const item = hero.equipment[slot]
    return item === null ? [] : [item]
  })
  return {
    broken: pieces.filter((item) => item.durability === 0),
    worn: pieces.filter((item) => item.durability > 0 && item.durability < item.maxDurability * 0.3),
  }
}

/** The lines of the pre-flight summary, kept apart from the markup so they can be tested. */
export function goingInLines(hero: SavedHero): Line[] {
  const loadout = hero.progress.loadout
  const unequipped = hero.progress.learnedSkillIds.filter((id) => !loadout.includes(id)).length
  const gaps = gearGaps(hero.equipment, itemBase)
  const { broken, worn } = weakPieces(hero)
  const gearWarn =
    gaps.length > 0
      ? `Empty slots: ${gaps.length}. The hero cannot start until they are filled.`
      : broken.length > 0
        ? `Broken: ${broken.map(itemName).join(', ')}. Broken gear does nothing.`
        : worn.length > 0
          ? `Nearly worn out: ${worn.map(itemName).join(', ')}.`
          : undefined
  const packed = hero.packedSupplies
  return [
    {
      label: 'Skills',
      text: loadout.map(skillName).join(', '),
      warn: unequipped > 0 ? `${unequipped} learned skill${unequipped === 1 ? '' : 's'} not equipped.` : undefined,
      edit: { to: { tab: 'heroes', heroPart: 'combat' }, label: 'Edit loadout' },
    },
    {
      label: 'Rules',
      text: `${hero.priorityRows.length} priority rule${hero.priorityRows.length === 1 ? '' : 's'}`,
      edit: { to: { tab: 'heroes', heroPart: 'combat' }, label: 'Edit rules' },
    },
    {
      label: 'Gear',
      text: gaps.length > 0 ? 'Incomplete' : broken.length + worn.length > 0 ? 'Needs repair' : 'Ready',
      warn: gearWarn,
      edit: { to: { tab: 'heroes', heroPart: 'gear' }, label: 'Edit gear' },
    },
    {
      label: 'Supplies',
      text: packed.length === 0 ? 'Nothing packed' : countNames(packed.map(supplyName)).map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', '),
      warn: packed.length === 0 ? 'Packing a Healing Draught or two makes elites much easier.' : undefined,
    },
    {
      label: 'Retreat',
      text: hero.retreatAtMost === null ? 'Never' : `At ${Math.round(hero.retreatAtMost * 100)}% HP`,
    },
  ]
}

