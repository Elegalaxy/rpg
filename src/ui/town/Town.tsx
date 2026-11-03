import { useState } from 'react'
import { purseOf } from '../../persist/save.ts'

import { itemName } from '../../content/items.ts'
import { recipePrice, recipesForSale } from '../../persist/crafting.ts'
import { ITEM_MODIFIERS, appliesToText } from '../../sim/economy.ts'
import { Row } from '../Row.tsx'
import { MATERIAL_SELL_PRICE, itemSellPrice, repairCost, shopStock } from '../../content/shop.ts'
import { wearerOf } from '../../persist/equipment.ts'
import { selectedHero } from '../../persist/character.ts'
import { repairAllCost } from '../../persist/town.ts'
import { SUPPLIES } from '../../content/supplies.ts'
import { SUPPLY_SLOT_COUNT } from '../../sim/expedition.ts'
import {
  buyItemFromUi,
  buySupplyFromUi,
  buyRecipeFromUi,
  devTownTools,
  payDebtFromUi,
  repairAllFromUi,
  repairOneFromUi,
  sellItemFromUi,
  sellMaterialFromUi,
  useSaveStatus,
} from '../store.ts'

export type TownPart = 'shop' | 'sell' | 'repair'

export function Town({ part }: { part: TownPart }) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pay, setPay] = useState('')
  const closed = save.expedition !== null

  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }

  const materials = Object.entries(purseOf(save).materials)
  const damaged = [
    ...Object.values(hero?.equipment ?? {}).flatMap((item) => (item !== null && item.durability < item.maxDurability ? [item] : [])),
    ...purseOf(save).archive.filter((item) => item.durability < item.maxDurability),
  ]
  return (
    <section aria-label="Town">
      <h2>Greyhaven</h2>
      <p>
        {hero === null ? '' : `${hero.name}'s `}gold: <strong data-testid="gold">{purseOf(save).gold}</strong>. Debt: <strong data-testid="debt">{purseOf(save).debt}</strong>. Gold, materials, and items belong to each hero; recipes and the map are shared.
        {import.meta.env.DEV ? (
          <>
            {' '}
            <button type="button" onClick={() => devTownTools('gold')}>
              Dev: +500 gold
            </button>{' '}
            <button type="button" onClick={() => devTownTools('wear')}>
              Dev: wear gear down
            </button>
          </>
        ) : null}
      </p>
      {closed ? <p>The town is closed while an expedition is running.</p> : null}

      {part === 'sell' ? (
        <>
      <h3>Sell materials</h3>
      {materials.length === 0 ? <p>You have no materials.</p> : null}
      <ul className="rows">
        {materials.map(([id, quantity]) => (
          <Row
            key={id}
            actions={
              <>
                <button type="button" className="btn-warn" disabled={closed} aria-label={`Sell 1 ${id}`} onClick={() => run(sellMaterialFromUi(id, 1), `Sold 1 ${id}.`)}>
                  Sell 1
                </button>
                <button
                  type="button"
                  className="btn-warn"
                  disabled={closed}
                  aria-label={`Sell all ${id}`}
                  onClick={() => run(sellMaterialFromUi(id, quantity), `Sold ${quantity} ${id}.`)}
                >
                  Sell all
                </button>
              </>
            }
          >
            {quantity} {id} ({MATERIAL_SELL_PRICE[id] ?? 0} gold each)
          </Row>
        ))}
      </ul>

      <h3>Worn gear</h3>
      {hero === null ? <p>Select a hero to see what they wear.</p> : null}
      <ul className="rows">
        {hero === null
          ? null
          : Object.values(hero.equipment).flatMap((item) =>
              item === null
                ? []
                : [
                    <Row
                      key={item.id}
                      actions={
                        <button
                          type="button"
                          className="btn-warn"
                          disabled={closed}
                          aria-label={`Sell worn ${item.id}`}
                          onClick={() => run(sellItemFromUi(item.id), `Sold ${itemName(item)}. Fill the slot before the next expedition.`)}
                        >
                          Sell
                        </button>
                      }
                    >
                      {itemName(item)}, item level {item.itemLevel} — sells for {itemSellPrice(item)} gold
                    </Row>,
                  ],
            )}
      </ul>

      <h3>Archive</h3>
      {purseOf(save).archive.length === 0 ? <p>The archive is empty.</p> : null}
      <ul className="rows">
        {purseOf(save).archive.map((item) => (
          <Row
            key={item.id}
            actions={
              <button type="button" className="btn-warn" disabled={closed} aria-label={`Sell ${item.id}`} onClick={() => run(sellItemFromUi(item.id), `Sold ${itemName(item)}.`)}>
                Sell
              </button>
            }
          >
            {itemName(item)}, item level {item.itemLevel}, quality {Math.round(item.quality * 100)}% — sells for {itemSellPrice(item)} gold
          </Row>
        ))}
      </ul>

        </>
      ) : null}
      {part === 'shop' ? (
        <>
      <h3>Shop</h3>
      {hero === null ? (
        <p>Select a hero to see what the shop has at their level.</p>
      ) : (
        <ul className="rows">
          {shopStock(hero.progress.level, wearerOf(hero)).map((entry) => (
            <Row
              key={entry.baseId}
              actions={
                <button
                  type="button"
                  className="btn-primary"
                  disabled={closed || purseOf(save).gold < entry.price}
                  aria-label={`Buy ${entry.baseId}`}
                  onClick={() => run(buyItemFromUi(entry.baseId), `Bought ${entry.name}.`)}
                >
                  Buy
                </button>
              }
            >
              {entry.name}, item level {entry.itemLevel}, quality 100% — {entry.price} gold
            </Row>
          ))}
        </ul>
      )}

      <h3>Supplies</h3>
      <p>
        Pack up to {SUPPLY_SLOT_COUNT} in the expedition preparation. A priority rule drinks a Healing Draught or an Antidote; a Smoke
        Bomb is used by the next escape roll. Unused supplies come back after the run.
      </p>
      <ul className="rows">
        {SUPPLIES.map((supply) => {
          const owned = purseOf(save).supplies[supply.id] ?? 0
          return (
            <Row
              key={supply.id}
              actions={
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={closed || hero === null || purseOf(save).gold < supply.price}
                    aria-label={`Buy 1 ${supply.name}`}
                    onClick={() => run(buySupplyFromUi(supply.id, 1), `Bought 1 ${supply.name}.`)}
                  >
                    Buy 1
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={closed || hero === null || purseOf(save).gold < supply.price * SUPPLY_SLOT_COUNT}
                    aria-label={`Buy ${SUPPLY_SLOT_COUNT} ${supply.name}`}
                    onClick={() => run(buySupplyFromUi(supply.id, SUPPLY_SLOT_COUNT), `Bought ${SUPPLY_SLOT_COUNT} ${supply.name}s.`)}
                  >
                    Buy {SUPPLY_SLOT_COUNT}
                  </button>
                </>
              }
            >
              <strong>{supply.name}</strong> — {supply.effect} {supply.price} gold. You have <span data-testid={`stash-${supply.id}`}>{owned}</span>.
            </Row>
          )
        })}
      </ul>

      <h3>Recipes</h3>
      {recipesForSale(save).length === 0 ? <p>You know every recipe.</p> : <p>A recipe lets you craft gear with that modifier. It is learned once for the whole account.</p>}
      <ul className="rows">
        {recipesForSale(save).map((entry) => {
          const modifier = ITEM_MODIFIERS[entry.modifierId]
          if (modifier === undefined) return null
          return (
            <Row
              key={entry.modifierId}
              actions={
                <button
                  type="button"
                  className="btn-primary"
                  disabled={closed || purseOf(save).gold < recipePrice(entry.modifierId)}
                  aria-label={`Learn ${modifier.name} recipe`}
                  onClick={() => run(buyRecipeFromUi(entry.modifierId), `Learned the ${modifier.name} recipe.`)}
                >
                  Learn
                </button>
              }
            >
              <strong>{modifier.name}</strong> — {modifier.text}, on {appliesToText(modifier)}. Needs hero level {modifier.minLevel}. {recipePrice(entry.modifierId)} gold
            </Row>
          )
        })}
      </ul>

        </>
      ) : null}
      {part === 'repair' ? (
        <>
      <h3>Repair</h3>
      {damaged.length === 0 ? <p>Nothing is damaged.</p> : null}
      <ul className="rows">
        {damaged.map((item) => (
          <Row
            key={item.id}
            actions={
              <button
                type="button"
                className="btn-good"
                disabled={closed || purseOf(save).gold < repairCost(item)}
                aria-label={`Repair ${item.id}`}
                onClick={() => run(repairOneFromUi(item.id), `Repaired ${itemName(item)}.`)}
              >
                Repair
              </button>
            }
          >
            {itemName(item)} {item.durability}/{item.maxDurability}
            {item.durability === 0 ? ' (disabled)' : ''} — {repairCost(item)} gold
          </Row>
        ))}
      </ul>
      {hero !== null && repairAllCost(hero) > 0 ? (
        <button type="button" className="btn-good" disabled={closed || purseOf(save).gold < repairAllCost(hero)} onClick={() => run(repairAllFromUi(), 'Repaired everything equipped.')}>
          Repair everything equipped ({repairAllCost(hero)} gold)
        </button>
      ) : null}

      <h3>Debt</h3>
      {purseOf(save).debt === 0 ? (
        <p>You owe nothing.</p>
      ) : (
        <div className="controls">
          <label>
            Pay{' '}
            <input aria-label="Debt payment" value={pay} inputMode="numeric" size={5} onChange={(event) => setPay(event.target.value)} />
          </label>{' '}
          <button
            type="button"
            className="btn-good"
            disabled={closed}
            onClick={() => {
              run(payDebtFromUi(Number(pay.trim())), `Paid ${Math.min(Number(pay.trim()), purseOf(save).debt)} gold of debt.`)
              setPay('')
            }}
          >
            Pay debt
          </button>
        </div>
      )}
        </>
      ) : null}
      {message !== null ? <p data-testid="town-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
