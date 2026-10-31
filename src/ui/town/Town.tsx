import { useState } from 'react'

import { itemName } from '../../content/items.ts'
import { MATERIAL_SELL_PRICE, itemSellPrice, repairCost, shopStock } from '../../content/shop.ts'
import { selectedHero } from '../../persist/character.ts'
import { repairAllCost } from '../../persist/town.ts'
import {
  buyItemFromUi,
  devTownTools,
  payDebtFromUi,
  repairAllFromUi,
  repairOneFromUi,
  sellItemFromUi,
  sellMaterialFromUi,
  useSaveStatus,
} from '../store.ts'

export function Town() {
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

      <h3>Sell materials</h3>
      {materials.length === 0 ? <p>You have no materials.</p> : null}
      <ul>
        {materials.map(([id, quantity]) => (
          <li key={id}>
            {quantity} {id} ({MATERIAL_SELL_PRICE[id] ?? 0} gold each){' '}
            <button type="button" disabled={closed} aria-label={`Sell 1 ${id}`} onClick={() => run(sellMaterialFromUi(id, 1), `Sold 1 ${id}.`)}>
              Sell 1
            </button>{' '}
            <button
              type="button"
              disabled={closed}
              aria-label={`Sell all ${id}`}
              onClick={() => run(sellMaterialFromUi(id, quantity), `Sold ${quantity} ${id}.`)}
            >
              Sell all
            </button>
          </li>
        ))}
      </ul>

      <h3>Archive</h3>
      {save.account.archive.length === 0 ? <p>The archive is empty.</p> : null}
      <ul>
        {save.account.archive.map((item) => (
          <li key={item.id}>
            {itemName(item)}, item level {item.itemLevel}, quality {Math.round(item.quality * 100)}% — sells for {itemSellPrice(item)} gold{' '}
            <button type="button" disabled={closed} aria-label={`Sell ${item.id}`} onClick={() => run(sellItemFromUi(item.id), `Sold ${itemName(item)}.`)}>
              Sell
            </button>
          </li>
        ))}
      </ul>

      <h3>Shop</h3>
      {hero === null ? (
        <p>Select a hero to see what the shop has at their level.</p>
      ) : (
        <ul>
          {shopStock(hero.progress.level).map((entry) => (
            <li key={entry.baseId}>
              {entry.name}, item level {entry.itemLevel}, quality 100% — {entry.price} gold{' '}
              <button
                type="button"
                disabled={closed || save.account.gold < entry.price}
                aria-label={`Buy ${entry.baseId}`}
                onClick={() => run(buyItemFromUi(entry.baseId), `Bought ${entry.name}.`)}
              >
                Buy
              </button>
            </li>
          ))}
        </ul>
      )}
      <p>The shop sells no supplies yet. No consumable exists.</p>

      <h3>Repair</h3>
      {damaged.length === 0 ? <p>Nothing is damaged.</p> : null}
      <ul>
        {damaged.map((item) => (
          <li key={item.id}>
            {itemName(item)} {item.durability}/{item.maxDurability}
            {item.durability === 0 ? ' (disabled)' : ''} — {repairCost(item)} gold{' '}
            <button
              type="button"
              disabled={closed || save.account.gold < repairCost(item)}
              aria-label={`Repair ${item.id}`}
              onClick={() => run(repairOneFromUi(item.id), `Repaired ${itemName(item)}.`)}
            >
              Repair
            </button>
          </li>
        ))}
      </ul>
      {hero !== null && repairAllCost(hero) > 0 ? (
        <button type="button" disabled={closed || save.account.gold < repairAllCost(hero)} onClick={() => run(repairAllFromUi(), 'Repaired everything equipped.')}>
          Repair everything equipped ({repairAllCost(hero)} gold)
        </button>
      ) : null}

      <h3>Debt</h3>
      {save.account.debt === 0 ? (
        <p>You owe nothing.</p>
      ) : (
        <div>
          <label>
            Pay{' '}
            <input aria-label="Debt payment" value={pay} inputMode="numeric" size={5} onChange={(event) => setPay(event.target.value)} />
          </label>{' '}
          <button
            type="button"
            disabled={closed}
            onClick={() => {
              run(payDebtFromUi(Number(pay.trim())), `Paid ${pay.trim()} gold of debt.`)
              setPay('')
            }}
          >
            Pay debt
          </button>
        </div>
      )}
      {message !== null ? <p data-testid="town-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
