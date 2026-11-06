import { useState, type ReactNode } from 'react'

import { itemName } from '../../content/items.ts'
import { PLACES, dealsIn, placeTable, type PlaceDef, type PlaceId } from '../../content/places.ts'
import { MATERIAL_SELL_PRICE, itemSellPrice, repairCost, shopStock } from '../../content/shop.ts'
import { SUPPLIES } from '../../content/supplies.ts'
import { selectedHero } from '../../persist/character.ts'
import { recipePrice, recipesForSale } from '../../persist/crafting.ts'
import { wearerOf } from '../../persist/equipment.ts'
import { purseOf, type SaveData } from '../../persist/save.ts'
import { repairAllCost } from '../../persist/town.ts'
import { ITEM_MODIFIERS, appliesToText, type ItemInstance } from '../../sim/economy.ts'
import { SUPPLY_SLOT_COUNT } from '../../sim/expedition.ts'
import { Help } from '../Help.tsx'
import { Row } from '../Row.tsx'
import {
  buyItemFromUi,
  buyRecipeFromUi,
  brewSupplyFromUi,
  buySupplyFromUi,
  devTownTools,
  payDebtFromUi,
  repairAllFromUi,
  repairOneFromUi,
  sellItemFromUi,
  sellMaterialFromUi,
  useSaveStatus,
} from '../store.ts'
import { Contracts } from './Contracts.tsx'
import { Craft } from './Craft.tsx'

export { PLACES, type PlaceId }

/** Messages for one place: the last success, or the last problem. */
function useMessages(): { run: (problem: string | null, done: string) => void; messages: ReactNode } {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }
  return {
    run,
    messages: (
      <>
        {message !== null ? <p data-testid="town-message">{message}</p> : null}
        {error !== null ? <p role="alert">{error}</p> : null}
      </>
    ),
  }
}

/** The hero's purse line, shown on every place. */
function PurseLine({ save }: { save: SaveData }) {
  const hero = selectedHero(save)
  return (
    <>
      <p>
        {hero === null ? '' : `${hero.name}'s `}gold: <strong data-testid="gold">{purseOf(save).gold}</strong>. Debt:{' '}
        <strong data-testid="debt">{purseOf(save).debt}</strong>.
        <Help label="About your purse">Gold, materials, and items belong to each hero. Recipes and the map are shared by all your heroes.</Help>
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
      {save.expedition !== null ? <p>Greyhaven is closed while an expedition is running.</p> : null}
    </>
  )
}

/** A weaponsmith, armorer, or jeweler: buy, sell, repair, then craft and upgrade, all limited to the shop's kind of item. */
function GearShop({ place }: { place: PlaceDef }) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const { run, messages } = useMessages()
  const closed = save.expedition !== null
  const mine = (item: ItemInstance) => dealsIn(place, item.baseId)
  if (hero === null) return <p>Select a hero to trade here.</p>
  const gold = purseOf(save).gold
  const worn = Object.values(hero.equipment).filter((item): item is ItemInstance => item !== null && mine(item))
  const archived = purseOf(save).archive.filter(mine)
  const damaged = [...worn, ...archived].filter((item) => item.durability < item.maxDurability)
  const repairAllPrice = repairAllCost(hero, mine)
  return (
    <>
      <h3>Buy</h3>
      <ul className="rows">
        {shopStock(hero.progress.level, wearerOf(hero))
          .filter((entry) => dealsIn(place, entry.baseId))
          .map((entry) => (
            <Row
              key={entry.baseId}
              actions={
                <button
                  type="button"
                  className="btn-primary"
                  disabled={closed || gold < entry.price}
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

      <h3>Sell</h3>
      {worn.length + archived.length === 0 ? <p>You have nothing of this kind to sell.</p> : null}
      <ul className="rows">
        {worn.map((item) => (
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
            Worn: {itemName(item)}, item level {item.itemLevel} — sells for {itemSellPrice(item)} gold
          </Row>
        ))}
        {archived.map((item) => (
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

      <h3>Repair</h3>
      {damaged.length === 0 ? <p>Nothing of this kind is damaged.</p> : null}
      <ul className="rows">
        {damaged.map((item) => (
          <Row
            key={item.id}
            actions={
              <button
                type="button"
                className="btn-good"
                disabled={closed || gold < repairCost(item)}
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
      {repairAllPrice > 0 ? (
        <button type="button" className="btn-good" disabled={closed || gold < repairAllPrice} onClick={() => run(repairAllFromUi(mine), 'Repaired everything worn of this kind.')}>
          Repair everything worn here ({repairAllPrice} gold)
        </button>
      ) : null}
      {messages}

      <Craft accepts={(baseId) => dealsIn(place, baseId)} />
    </>
  )
}

function PotionShop() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const { run, messages } = useMessages()
  const closed = save.expedition !== null
  const gold = purseOf(save).gold
  return (
    <>
      <p>
        "Pack up to {SUPPLY_SLOT_COUNT} before you set out. Whatever you don't use, you bring home."
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
                    disabled={closed || hero === null || gold < supply.price}
                    aria-label={`Buy 1 ${supply.name}`}
                    onClick={() => run(buySupplyFromUi(supply.id, 1), `Bought 1 ${supply.name}.`)}
                  >
                    Buy 1
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={closed || hero === null || gold < supply.price * SUPPLY_SLOT_COUNT}
                    aria-label={`Buy ${SUPPLY_SLOT_COUNT} ${supply.name}`}
                    onClick={() => run(buySupplyFromUi(supply.id, SUPPLY_SLOT_COUNT), `Bought ${SUPPLY_SLOT_COUNT} ${supply.name}s.`)}
                  >
                    Buy {SUPPLY_SLOT_COUNT}
                  </button>
                  <button
                    type="button"
                    className="btn-good"
                    disabled={
                      closed ||
                      hero === null ||
                      gold < supply.brew.gold ||
                      (purseOf(save).materials[supply.brew.materialId] ?? 0) < supply.brew.quantity
                    }
                    aria-label={`Brew 1 ${supply.name}`}
                    onClick={() => run(brewSupplyFromUi(supply.id, 1), `Brewed 1 ${supply.name}.`)}
                  >
                    Brew 1
                  </button>
                </>
              }
            >
              <strong>{supply.name}</strong> — {supply.effect} Buy for {supply.price} gold, or brew from {supply.brew.quantity} {supply.brew.materialId} and{' '}
              {supply.brew.gold} gold. You have <span data-testid={`stash-${supply.id}`}>{owned}</span>.
            </Row>
          )
        })}
      </ul>
      {messages}
    </>
  )
}

function TradingPost() {
  const { save } = useSaveStatus()
  const { run, messages } = useMessages()
  const closed = save.expedition !== null
  const materials = Object.entries(purseOf(save).materials)
  return (
    <>
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
      {messages}
    </>
  )
}

function Enchanter() {
  const { save } = useSaveStatus()
  const { run, messages } = useMessages()
  const closed = save.expedition !== null
  const forSale = recipesForSale(save)
  return (
    <>
      <p>
        {forSale.length === 0 ? 'You know every recipe.' : 'Recipes for sale'}
        <Help label="About recipes">A recipe lets every hero craft gear with that modifier at the matching shop.</Help>
      </p>
      <ul className="rows">
        {forSale.map((entry) => {
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
              <strong>{modifier.name}</strong> — {modifier.text}, on {appliesToText(modifier)}. Needs hero level {modifier.minLevel}.{' '}
              {recipePrice(entry.modifierId)} gold
            </Row>
          )
        })}
      </ul>
      {messages}
    </>
  )
}

function Bank() {
  const { save } = useSaveStatus()
  const { run, messages } = useMessages()
  const [pay, setPay] = useState('')
  const closed = save.expedition !== null
  const debt = purseOf(save).debt
  return (
    <>
      {debt === 0 ? (
        <p>You owe nothing.</p>
      ) : (
        <div className="controls">
          <p>
            You owe {debt} gold from rescue fees.
            <Help label="About debt">Debt blocks nothing. Pay it when you can.</Help>
          </p>
          <label>
            Pay{' '}
            <input aria-label="Debt payment" value={pay} inputMode="numeric" size={5} onChange={(event) => setPay(event.target.value)} />
          </label>{' '}
          <button
            type="button"
            className="btn-good"
            disabled={closed}
            onClick={() => {
              run(payDebtFromUi(Number(pay.trim())), `Paid ${Math.min(Number(pay.trim()), debt)} gold of debt.`)
              setPay('')
            }}
          >
            Pay debt
          </button>
        </div>
      )}
      {messages}
    </>
  )
}

/** One of Greyhaven's places. */
export function Town({ place: id }: { place: PlaceId }) {
  const { save } = useSaveStatus()
  const place = placeTable[id]
  return (
    <section aria-label={place.name}>
      <h2>{place.name}</h2>
      <p>{place.blurb}</p>
      <PurseLine save={save} />
      {place.gear !== undefined ? <GearShop place={place} /> : null}
      {id === 'potion-shop' ? <PotionShop /> : null}
      {id === 'trading-post' ? <TradingPost /> : null}
      {id === 'enchanter' ? <Enchanter /> : null}
      {id === 'contract-board' ? <Contracts /> : null}
      {id === 'bank' ? <Bank /> : null}
    </section>
  )
}
