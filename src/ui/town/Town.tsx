import { useState } from 'react'

import { itemName } from '../../content/items.ts'
import { recipePrice, recipesForSale } from '../../persist/crafting.ts'
import { ITEM_MODIFIERS } from '../../sim/economy.ts'
import { Row } from '../Row.tsx'
import { MATERIAL_SELL_PRICE, itemSellPrice, repairCost, shopStock } from '../../content/shop.ts'
import { wearerOf } from '../../persist/equipment.ts'
import { selectedHero } from '../../persist/character.ts'
import { repairAllCost } from '../../persist/town.ts'
import {
  buyItemFromUi,
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

  const materials = Object.entries(save.account.materials)
  const damaged = [
    ...Object.values(hero?.equipment ?? {}).flatMap((item) => (item !== null && item.durability < item.maxDurability ? [item] : [])),
    ...save.account.archive.filter((item) => item.durability < item.maxDurability),
  ]
  return (
    <section aria-label="Town">
      <h2>Greyhaven</h2>
      <p>
        Gold: <strong data-testid="gold">{save.account.gold}</strong>. Debt: <strong data-testid="debt">{save.account.debt}</strong>.
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
      {save.account.archive.length === 0 ? <p>The archive is empty.</p> : null}
      <ul className="rows">
        {save.account.archive.map((item) => (
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
                  disabled={closed || save.account.gold < entry.price}
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
      <p>The shop sells no supplies yet. No consumable exists.</p>

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
                  disabled={closed || save.account.gold < recipePrice(entry.modifierId)}
                  aria-label={`Learn ${modifier.name} recipe`}
                  onClick={() => run(buyRecipeFromUi(entry.modifierId), `Learned the ${modifier.name} recipe.`)}
                >
                  Learn
                </button>
              }
            >
              <strong>{modifier.name}</strong> — {modifier.text}. Needs hero level {modifier.minLevel}. {recipePrice(entry.modifierId)} gold
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
                disabled={closed || save.account.gold < repairCost(item)}
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
        <button type="button" className="btn-good" disabled={closed || save.account.gold < repairAllCost(hero)} onClick={() => run(repairAllFromUi(), 'Repaired everything equipped.')}>
          Repair everything equipped ({repairAllCost(hero)} gold)
        </button>
      ) : null}

      <h3>Debt</h3>
      {save.account.debt === 0 ? (
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
              run(payDebtFromUi(Number(pay.trim())), `Paid ${Math.min(Number(pay.trim()), save.account.debt)} gold of debt.`)
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
