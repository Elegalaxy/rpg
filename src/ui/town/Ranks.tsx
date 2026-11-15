import { useState } from 'react'

import { itemName } from '../../content/items.ts'
import { selectedHero } from '../../persist/character.ts'
import { CRAFT_MS, RANK_MATERIAL_COST, rankCheck, rankGold, rankMaterials, socketTargets } from '../../persist/crafting.ts'
import { purseOf } from '../../persist/save.ts'
import { ITEM_MODIFIERS, MODIFIER_RANK_MAX, modifierRankAt, modifierTextAt, rankName, rankable, type EquipmentSlotId, type ItemInstance } from '../../sim/economy.ts'
import { Collapsible } from '../Collapsible.tsx'
import { Help } from '../Help.tsx'
import { ShopRow, Tag } from '../Kit.tsx'
import { queueRankUpFromUi, useSaveStatus } from '../store.ts'
import { groupItems } from './groupItems.ts'

const SLOT_NAMES: { [slot in EquipmentSlotId]: string } = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  feet: 'Feet',
  accessory0: 'Accessory 1',
  accessory1: 'Accessory 2',
}

/** Rank up: raise one modifier of a worn or stored item from rank I to II to III for gold and materials. */
export function Ranks({ accepts = () => true }: { accepts?: (baseId: string) => boolean }) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [picks, setPicks] = useState<{ [key: string]: string }>({})
  const [error, setError] = useState<string | null>(null)
  if (hero === null) return null
  const owned = purseOf(save).materials
  const targets = socketTargets(hero).filter((entry) => accepts(entry.item.baseId))
  const entries = [
    ...targets.filter((entry) => entry.slot !== null).map((entry) => ({ ...entry, count: 1 })),
    ...groupItems(targets.filter((entry) => entry.slot === null).map((entry) => entry.item)).map(({ item, count }) => ({ item, slot: null, count })),
  ]
  const rows = entries.flatMap(({ item, slot, count }) =>
    item.modifiers.flatMap((id, index) => {
      const modifier = ITEM_MODIFIERS[id]
      return modifier !== undefined && rankable(modifier) ? [{ item, slot, count, index, id }] : []
    }),
  )
  const materialFor = (item: ItemInstance, index: number, toRank: number): string => {
    const options = rankMaterials(toRank)
    const picked = picks[`${item.id}:${index}`]
    if (picked !== undefined && options.includes(picked)) return picked
    return options.find((id) => (owned[id] ?? 0) >= (RANK_MATERIAL_COST[toRank] ?? 0)) ?? options[0] ?? 'scrap'
  }
  return (
    <>
      <h4>
        Modifier ranks
        <Help label="About ranks">
          A modifier starts at rank I. Rank II raises its numbers by 20% and rank III by 40%, for gold by the modifier's level and materials; rank III asks for riftglass, duskiron or cinderite. Each rank-up takes {CRAFT_MS / 1000} s in the crafting queue. The stack cap counts pieces, not ranks.
        </Help>
      </h4>
      {rows.length === 0 ? (
        <p>No modifier of this kind can be ranked up yet.</p>
      ) : (
        <Collapsible testId="rank-list" persistKey="craft-ranks-open" summary={<strong>{rows.length} {rows.length === 1 ? 'modifier' : 'modifiers'} to rank up</strong>}>
          <ul className="shop-rows" aria-label="Ranks">
            {rows.map(({ item, slot, count, index, id }) => {
              const modifier = ITEM_MODIFIERS[id]
              if (modifier === undefined) return null
              const current = modifierRankAt(item, index)
              const maxed = current >= MODIFIER_RANK_MAX
              const toRank = current + 1
              const material = materialFor(item, index, toRank)
              const block = rankCheck(save, hero, item, index, material)
              return (
                <ShopRow
                  key={`${item.id}:${index}`}
                  testId="rank-row"
                  name={
                    <>
                      {modifier.name} {rankName(current)} on {itemName(item)}
                      {count > 1 ? ` ×${count}` : ''} {slot === null ? null : <Tag kind="info">Worn ({SLOT_NAMES[slot]})</Tag>}
                    </>
                  }
                  effect={
                    <dl className="upgrade-facts">
                      <dt>Rank</dt>
                      <dd>{maxed ? `${rankName(current)} (highest)` : `${rankName(current)} → ${rankName(toRank)}`}</dd>
                      <dt>Effect</dt>
                      <dd data-testid="rank-effect">{maxed ? modifierTextAt(modifier, current) : `${modifierTextAt(modifier, current)} → ${modifierTextAt(modifier, toRank)}`}</dd>
                      <dt>Time</dt>
                      <dd>{CRAFT_MS / 1000} s</dd>
                    </dl>
                  }
                  note={block ?? undefined}
                  costs={maxed ? undefined : [[{ kind: 'mat', amount: RANK_MATERIAL_COST[toRank] ?? 0, label: material }, { kind: 'gold', amount: rankGold(id, toRank) }]]}
                  actions={
                    <div className="upgrade-actions">
                      <select
                        className="craft-select upgrade-select"
                        aria-label={`Rank material for ${modifier.name} on ${item.id}`}
                        value={material}
                        disabled={maxed}
                        onChange={(event) => setPicks({ ...picks, [`${item.id}:${index}`]: event.target.value })}
                      >
                        {rankMaterials(toRank).map((option) => (
                          <option key={option} value={option}>
                            {option} (have {owned[option] ?? 0})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={block !== null}
                        aria-label={`Rank up ${modifier.name} on ${item.id}`}
                        onClick={() => setError(queueRankUpFromUi(item.id, index, material))}
                      >
                        {maxed ? 'Highest rank' : `Rank up to ${rankName(toRank)}`}
                      </button>
                    </div>
                  }
                />
              )
            })}
          </ul>
        </Collapsible>
      )}
      {error !== null ? <p role="alert">{error}</p> : null}
    </>
  )
}
