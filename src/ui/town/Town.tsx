import { useState, type ReactNode } from 'react'

import { itemName } from '../../content/items.ts'
import { PLACES, dealsIn, placeTable, type PlaceDef, type PlaceId } from '../../content/places.ts'
import { MATERIAL_SELL_PRICE, itemSellPrice, repairCost, shopStock } from '../../content/shop.ts'
import { SUPPLIES } from '../../content/supplies.ts'
import { selectedHero } from '../../persist/character.ts'
import { recipePrice, recipesForSale } from '../../persist/crafting.ts'
import { purseOf, type SaveData } from '../../persist/save.ts'
import { previewEquip, wearerOf } from '../../persist/equipment.ts'
import { previewBuy, repairAllCost } from '../../persist/town.ts'
import { GearChanges } from './GearChanges.tsx'
import { groupItems } from './groupItems.ts'
import { ITEM_MODIFIERS, appliesToText, type ItemInstance } from '../../sim/economy.ts'
import { SUPPLY_SLOT_COUNT } from '../../sim/expedition.ts'
import { Help } from '../Help.tsx'
import { CostPill, Kpi, KpiRow, Pill, ShopRow, Tag } from '../Kit.tsx'
import {
  buyItemFromUi,
  equipFromUi,
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

/** The hero's purse, shown on every place: gold, debt, and each material side by side. */
function PurseLine({ save }: { save: SaveData }) {
  const hero = selectedHero(save)
  const purse = purseOf(save)
  return (
    <div className="purse">
      <div className="purse-head">
        <strong>{hero === null ? 'Purse' : `${hero.name}'s purse`}</strong>
        <Help label="About your purse">Gold, materials, and items belong to each hero. Recipes and the map are shared by all your heroes.</Help>
        {import.meta.env.DEV ? (
          <>
            <button type="button" onClick={() => devTownTools('gold')}>
              Dev: +500 gold
            </button>
            <button type="button" onClick={() => devTownTools('wear')}>
              Dev: wear gear down
            </button>
          </>
        ) : null}
      </div>
      <KpiRow label="Purse">
        <Kpi compact tone="gold" label="Gold" value={<span data-testid="gold">{purse.gold}</span>} />
        <Kpi compact tone={purse.debt > 0 ? 'bad' : undefined} label="Debt" value={<span data-testid="debt">{purse.debt}</span>} />
        {Object.keys(MATERIAL_SELL_PRICE).map((id) => (
          <Kpi compact key={id} label={id} value={purse.materials[id] ?? 0} />
        ))}
      </KpiRow>
      {save.expedition !== null ? <p>Greyhaven is closed while an expedition is running.</p> : null}
    </div>
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
      <ul className="shop-rows">
        {shopStock(hero.progress.level, wearerOf(hero))
          .filter((entry) => dealsIn(place, entry.baseId))
          .map((entry) => (
            <ShopRow
              key={entry.baseId}
              name={entry.name}
              effect={`Item level ${entry.itemLevel} · Quality 100%`}
              note={<GearChanges preview={previewBuy(save, hero.id, entry.baseId)} empty="No stat change from what you wear." />}
              costs={[[{ kind: 'gold', amount: entry.price }]]}
              actions={
                <button
                  type="button"
                  className="btn-primary"
                  disabled={closed || gold < entry.price}
                  aria-label={`Buy ${entry.baseId}`}
                  onClick={() => run(buyItemFromUi(entry.baseId), `Bought ${entry.name}. Wear it from the list below.`)}
                >
                  Buy
                </button>
              }
            />
          ))}
      </ul>

      <h3>Sell</h3>
      {worn.length + archived.length === 0 ? <p>You have nothing of this kind to sell.</p> : null}
      <ul className="shop-rows">
        {worn.map((item) => (
          <ShopRow
            key={item.id}
            name={itemName(item)}
            owned={1}
            effect={`Worn · Item level ${item.itemLevel}`}
            costs={[[{ kind: 'gold', amount: itemSellPrice(item), prefix: '+' }]]}
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
          />
        ))}
        {groupItems(archived).map(({ item, count }) => (
          <ShopRow
            key={item.id}
            name={itemName(item)}
            owned={count > 1 ? count : undefined}
            effect={`Archive · Item level ${item.itemLevel} · Quality ${Math.round(item.quality * 100)}%`}
            note={<GearChanges preview={previewEquip(save, hero.id, item.id)} empty="No stat change from what you wear." />}
            costs={[[{ kind: 'gold', amount: itemSellPrice(item), prefix: '+' }]]}
            actions={
              <>
                <button type="button" className="btn-good" disabled={closed} aria-label={`Wear ${item.id}`} onClick={() => run(equipFromUi(item.id, null), `Put on ${itemName(item)}.`)}>
                  Wear
                </button>
                <button type="button" className="btn-warn" disabled={closed} aria-label={`Sell ${item.id}`} onClick={() => run(sellItemFromUi(item.id), `Sold ${itemName(item)}.`)}>
                  Sell
                </button>
              </>
            }
          />
        ))}
      </ul>

      <h3>Repair</h3>
      {damaged.length === 0 ? <p>Nothing of this kind is damaged.</p> : null}
      <ul className="shop-rows">
        {groupItems(damaged).map(({ item, count }) => (
          <ShopRow
            key={item.id}
            name={itemName(item)}
            owned={count > 1 ? count : undefined}
            effect={item.durability === 0 ? `Broken · ${item.durability}/${item.maxDurability}` : `Durability ${item.durability}/${item.maxDurability}`}
            costs={[[{ kind: 'gold', amount: repairCost(item) }]]}
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
          />
        ))}
      </ul>
      {repairAllPrice > 0 ? (
        <button type="button" className="btn-good" disabled={closed || gold < repairAllPrice} onClick={() => run(repairAllFromUi(mine), 'Repaired everything worn of this kind.')}>
          Repair everything worn here <Tag kind="gold">{repairAllPrice} gold</Tag>
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
  const purse = purseOf(save)
  const gold = purse.gold
  return (
    <>
      <p>
        "Pack up to {SUPPLY_SLOT_COUNT} before you set out. Whatever you don't use, you bring home."
      </p>
      <ul className="supply-cards">
        {SUPPLIES.map((supply) => {
          const owned = purse.supplies[supply.id] ?? 0
          const haveMaterial = purse.materials[supply.brew.materialId] ?? 0
          const missingMaterial = Math.max(0, supply.brew.quantity - haveMaterial)
          const missingBrewGold = Math.max(0, supply.brew.gold - gold)
          const brewShort =
            missingMaterial > 0
              ? `Need ${missingMaterial} more ${supply.brew.materialId}`
              : missingBrewGold > 0
                ? `Need ${missingBrewGold} more gold`
                : null
          const buyShort = gold < supply.price ? `Need ${supply.price - gold} more gold` : null
          return (
            <ShopCardRow key={supply.id}>
              <div className="supply-head">
                <strong>{supply.name}</strong>
                <Pill kind="owned" title="You own this many">
                  ×<span data-testid={`stash-${supply.id}`}>{owned}</span> owned
                </Pill>
                <span className="supply-effect">{supply.effect}</span>
              </div>
              <div className="supply-options">
                <div className="supply-option">
                  <span className="supply-option-title">Buy with gold</span>
                  <span className="supply-option-cost">
                    <CostPill cost={{ kind: 'gold', amount: supply.price }} /> each
                  </span>
                  <span className="button-row">
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
                      Buy {SUPPLY_SLOT_COUNT} <small>({supply.price * SUPPLY_SLOT_COUNT} gold)</small>
                    </button>
                  </span>
                  {buyShort !== null ? <small className="supply-option-note">{buyShort}</small> : null}
                </div>
                <div className="supply-option">
                  <span className="supply-option-title">Brew from materials</span>
                  <span className="supply-option-cost">
                    <Tag kind={missingMaterial > 0 ? 'bad' : 'mat'} title={`You have ${haveMaterial}`}>
                      {supply.brew.quantity} {supply.brew.materialId} <small>(have {haveMaterial})</small>
                    </Tag>
                    +
                    <CostPill cost={{ kind: 'gold', amount: supply.brew.gold }} />
                  </span>
                  <span className="button-row">
                    <button
                      type="button"
                      className="btn-good"
                      disabled={closed || hero === null || brewShort !== null}
                      aria-label={`Brew 1 ${supply.name}`}
                      onClick={() => run(brewSupplyFromUi(supply.id, 1), `Brewed 1 ${supply.name}.`)}
                    >
                      Brew 1
                    </button>
                  </span>
                  {brewShort !== null ? <small className="supply-option-note">{brewShort}</small> : null}
                </div>
              </div>
            </ShopCardRow>
          )
        })}
      </ul>
      {messages}
    </>
  )
}

function ShopCardRow({ children }: { children: ReactNode }) {
  return <li className="supply-card">{children}</li>
}

function TradingPost() {
  const { save } = useSaveStatus()
  const { run, messages } = useMessages()
  const closed = save.expedition !== null
  const materials = Object.entries(purseOf(save).materials)
  return (
    <>
      {materials.length === 0 ? <p>You have no materials.</p> : null}
      <ul className="shop-rows">
        {materials.map(([id, quantity]) => (
          <ShopRow
            key={id}
            name={id.charAt(0).toUpperCase() + id.slice(1)}
            owned={quantity}
            effect="Crafting material"
            costs={[[{ kind: 'gold', amount: MATERIAL_SELL_PRICE[id] ?? 0, prefix: '+' }]]}
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
          />
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
  const heroLevel = selectedHero(save)?.progress.level ?? 1
  return (
    <>
      <p>
        {forSale.length === 0 ? 'You know every recipe.' : 'Recipes for sale'}
        <Help label="About recipes">A recipe lets every hero craft gear with that modifier at the matching shop.</Help>
      </p>
      <ul className="shop-rows">
        {forSale.map((entry) => {
          const modifier = ITEM_MODIFIERS[entry.modifierId]
          if (modifier === undefined) return null
          return (
            <ShopRow
              key={entry.modifierId}
              name={modifier.name}
              effect={`${modifier.text} · ${appliesToText(modifier)}`}
              costs={[[{ kind: 'gold', amount: recipePrice(entry.modifierId) }]]}
              note={<Tag kind="info">Needs level {modifier.minLevel}</Tag>}
              actions={
                <button
                  type="button"
                  className="btn-primary"
                  disabled={closed || purseOf(save).gold < recipePrice(entry.modifierId) || heroLevel < modifier.minLevel}
                  title={heroLevel < modifier.minLevel ? `Needs hero level ${modifier.minLevel}` : undefined}
                  aria-label={`Learn ${modifier.name} recipe`}
                  onClick={() => run(buyRecipeFromUi(entry.modifierId), `Learned the ${modifier.name} recipe.`)}
                >
                  Learn
                </button>
              }
            />
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
