import type { SupplyDef } from '../../content/supplies.ts'
import { SUPPLY_SLOT_COUNT } from '../../sim/expedition.ts'
import { CostPill, Pill, Tag } from '../Kit.tsx'

export type SupplyCardProps = {
  supply: SupplyDef
  owned: number
  /** Units of the brew material the hero carries. */
  haveMaterial: number
  gold: number
  /** Town services are closed (an expedition is running). */
  closed: boolean
  heroSelected: boolean
  /** Why the supply cannot be brewed yet, or null when it is open. */
  lock: string | null
  onBuy: (quantity: number) => void
  onBrew: () => void
}

/** One Potion Shop card: what the supply does, buying it (when sold), and brewing it. */
export function SupplyCard({ supply, owned, haveMaterial, gold, closed, heroSelected, lock, onBuy, onBrew }: SupplyCardProps) {
  const missingMaterial = Math.max(0, supply.brew.quantity - haveMaterial)
  const missingBrewGold = Math.max(0, supply.brew.gold - gold)
  const brewShort =
    missingMaterial > 0 ? `Need ${missingMaterial} more ${supply.brew.materialId}` : missingBrewGold > 0 ? `Need ${missingBrewGold} more gold` : null
  const price = supply.price
  return (
    <li className="supply-card">
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
          {price === null ? (
            <span className="supply-option-cost">
              <Tag kind="info" title="Greyhaven does not sell this. Brew it instead.">
                Brew only
              </Tag>
            </span>
          ) : (
            <>
              <span className="supply-option-cost">
                <CostPill cost={{ kind: 'gold', amount: price }} /> each
              </span>
              <span className="button-row">
                <button type="button" className="btn-primary" disabled={closed || !heroSelected || gold < price} aria-label={`Buy 1 ${supply.name}`} onClick={() => onBuy(1)}>
                  Buy 1
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={closed || !heroSelected || gold < price * SUPPLY_SLOT_COUNT}
                  aria-label={`Buy ${SUPPLY_SLOT_COUNT} ${supply.name}`}
                  onClick={() => onBuy(SUPPLY_SLOT_COUNT)}
                >
                  Buy {SUPPLY_SLOT_COUNT} <small>({price * SUPPLY_SLOT_COUNT} gold)</small>
                </button>
              </span>
              {gold < price ? <small className="supply-option-note">{`Need ${price - gold} more gold`}</small> : null}
            </>
          )}
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
              disabled={closed || !heroSelected || lock !== null || brewShort !== null}
              title={lock ?? undefined}
              aria-label={`Brew 1 ${supply.name}`}
              onClick={onBrew}
            >
              Brew 1
            </button>
          </span>
          {lock !== null ? (
            <small className="supply-option-note">
              <Tag kind="bad">Locked</Tag> <span data-testid={`supply-lock-${supply.id}`}>{lock}</span>
            </small>
          ) : brewShort !== null ? (
            <small className="supply-option-note">{brewShort}</small>
          ) : null}
        </div>
      </div>
    </li>
  )
}
