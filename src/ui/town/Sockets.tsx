import { useState } from 'react'

import { itemBase, itemName } from '../../content/items.ts'
import { selectedHero } from '../../persist/character.ts'
import {
  INFUSE_MATERIAL_COST,
  MATERIAL_QUALITY,
  SOCKET_MATERIALS,
  SOCKET_MATERIAL_COST,
  SOCKET_MIN_HERO_LEVEL,
  CRAFT_MS,
  infuseCheck,
  infuseGold,
  socketCheck,
  socketGold,
  socketTargets,
} from '../../persist/crafting.ts'
import { purseOf } from '../../persist/save.ts'
import { ITEM_MODIFIERS, modifierFits, modifierRankAt, rankName, type EquipmentSlotId, type ItemInstance } from '../../sim/economy.ts'
import { Collapsible } from '../Collapsible.tsx'
import { Help } from '../Help.tsx'
import { ShopRow, Tag } from '../Kit.tsx'
import { queueInfuseFromUi, queueSocketFromUi, useSaveStatus } from '../store.ts'
import { groupItems } from './groupItems.ts'

const MATERIALS = Object.keys(MATERIAL_QUALITY)

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

/** The modifier names on an item, then an empty socket when there is room for a second one. */
function modifierLine(item: ItemInstance): string {
  const names = item.modifiers.map((id, index) => {
    const rank = modifierRankAt(item, index)
    return `${ITEM_MODIFIERS[id]?.name ?? id}${rank > 1 ? ` ${rankName(rank)}` : ''}`
  })
  if (item.socketed === true && names.length < 2) names.push('empty socket')
  return names.length === 0 ? 'None' : names.join(' + ')
}

/** Open socket and Infuse: a second modifier for gold and materials, for worn and archive items. */
export function Sockets({ accepts = () => true }: { accepts?: (baseId: string) => boolean }) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [socketMaterial, setSocketMaterial] = useState<{ [itemId: string]: string }>({})
  const [infuseMaterial, setInfuseMaterial] = useState<{ [itemId: string]: string }>({})
  const [infuseModifier, setInfuseModifier] = useState<{ [itemId: string]: string }>({})
  const [error, setError] = useState<string | null>(null)
  if (hero === null) return null
  const owned = purseOf(save).materials
  const targets = socketTargets(hero).filter((entry) => accepts(entry.item.baseId))
  const rows = [
    ...targets.filter((entry) => entry.slot !== null).map((entry) => ({ ...entry, count: 1 })),
    ...groupItems(targets.filter((entry) => entry.slot === null).map((entry) => entry.item)).map(({ item, count }) => ({ item, slot: null, count })),
  ]
  const unlocked = hero.progress.level >= SOCKET_MIN_HERO_LEVEL
  const socketMaterialFor = (item: ItemInstance): string =>
    socketMaterial[item.id] ?? SOCKET_MATERIALS.find((id) => (owned[id] ?? 0) >= SOCKET_MATERIAL_COST) ?? SOCKET_MATERIALS[0] ?? 'riftglass'
  const infuseMaterialFor = (item: ItemInstance): string =>
    infuseMaterial[item.id] ?? MATERIALS.find((id) => (owned[id] ?? 0) >= INFUSE_MATERIAL_COST) ?? MATERIALS[0] ?? 'scrap'
  const modifiersFor = (item: ItemInstance): string[] =>
    save.account.recipes.filter((id) => {
      const modifier = ITEM_MODIFIERS[id]
      const base = itemBase(item.baseId)
      return modifier !== undefined && base !== undefined && !item.modifiers.includes(id) && modifierFits(modifier, base)
    })

  return (
    <>
      <h4>
        Sockets and infusing
        <Help label="About sockets">
          An item holds one modifier. Open a socket (hero level {SOCKET_MIN_HERO_LEVEL} and up) and Infuse a second, different one from a recipe you know. Infusing again replaces the second modifier. Both jobs take {CRAFT_MS / 1000} s in the crafting queue, and a socket stays when the item is upgraded.
        </Help>
      </h4>
      {!unlocked ? (
        <p data-testid="socket-locked">
          Sockets unlock at hero level {SOCKET_MIN_HERO_LEVEL}. This hero is level {hero.progress.level}.
        </p>
      ) : rows.length === 0 ? (
        <p>Nothing of this kind to socket.</p>
      ) : (
        <Collapsible testId="socket-list" persistKey="craft-sockets-open" summary={<strong>{rows.length} {rows.length === 1 ? 'item' : 'items'} to socket or infuse</strong>}>
          <ul className="shop-rows" aria-label="Sockets">
            {rows.map(({ item, slot, count }) => {
              const socketed = item.socketed === true
              const gem = socketMaterialFor(item)
              const mat = infuseMaterialFor(item)
              const options = modifiersFor(item)
              const pickedModifier = infuseModifier[item.id] !== undefined && options.includes(infuseModifier[item.id] ?? '') ? (infuseModifier[item.id] ?? '') : (options[0] ?? '')
              const socketBlock = socketCheck(save, hero, item, gem)
              const infuseBlock = pickedModifier === '' ? 'No recipe you know fits this item as a second modifier.' : infuseCheck(save, hero, item, pickedModifier, mat)
              const second = item.modifiers.length >= 2
              return (
                <ShopRow
                  key={item.id}
                  testId="socket-row"
                  name={
                    <>
                      {itemName(item)}
                      {count > 1 ? ` ×${count}` : ''} {slot === null ? null : <Tag kind="info">Worn ({SLOT_NAMES[slot]})</Tag>}
                    </>
                  }
                  effect={
                    <dl className="upgrade-facts">
                      <dt>Item level</dt>
                      <dd>{item.itemLevel}</dd>
                      <dt>Modifiers</dt>
                      <dd data-testid="socket-modifiers">{modifierLine(item)}</dd>
                      <dt>Time</dt>
                      <dd>{CRAFT_MS / 1000} s</dd>
                    </dl>
                  }
                  note={!socketed ? (socketBlock ?? undefined) : (infuseBlock ?? undefined)}
                  costs={
                    !socketed
                      ? [[{ kind: 'mat', amount: SOCKET_MATERIAL_COST, label: gem }, { kind: 'gold', amount: socketGold(item.itemLevel) }]]
                      : [[{ kind: 'mat', amount: INFUSE_MATERIAL_COST, label: mat }, { kind: 'gold', amount: infuseGold(item.itemLevel) }]]
                  }
                  actions={
                    !socketed ? (
                      <div className="upgrade-actions">
                        <select
                          className="craft-select upgrade-select"
                          aria-label={`Socket material for ${item.id}`}
                          value={gem}
                          onChange={(event) => setSocketMaterial({ ...socketMaterial, [item.id]: event.target.value })}
                        >
                          {SOCKET_MATERIALS.map((id) => (
                            <option key={id} value={id}>
                              {id} (have {owned[id] ?? 0})
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn-primary" disabled={socketBlock !== null} aria-label={`Open socket ${item.id}`} onClick={() => setError(queueSocketFromUi(item.id, gem))}>
                          Open socket
                        </button>
                      </div>
                    ) : (
                      <div className="upgrade-actions">
                        <select
                          className="craft-select upgrade-select"
                          aria-label={`Second modifier for ${item.id}`}
                          value={pickedModifier}
                          onChange={(event) => setInfuseModifier({ ...infuseModifier, [item.id]: event.target.value })}
                        >
                          {options.map((id) => (
                            <option key={id} value={id}>
                              {ITEM_MODIFIERS[id]?.name} ({ITEM_MODIFIERS[id]?.text})
                            </option>
                          ))}
                        </select>
                        <select
                          className="craft-select upgrade-select"
                          aria-label={`Infuse material for ${item.id}`}
                          value={mat}
                          onChange={(event) => setInfuseMaterial({ ...infuseMaterial, [item.id]: event.target.value })}
                        >
                          {MATERIALS.map((id) => (
                            <option key={id} value={id}>
                              {id} (have {owned[id] ?? 0})
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn-primary" disabled={infuseBlock !== null} aria-label={`Infuse ${item.id}`} onClick={() => setError(queueInfuseFromUi(item.id, pickedModifier, mat))}>
                          {second ? 'Re-infuse' : 'Infuse'}
                        </button>
                      </div>
                    )
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
