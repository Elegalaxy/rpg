import { implicitText, itemName } from '../../content/items.ts'
import { previewEquip } from '../../persist/equipment.ts'
import { SELL_GROUP_LABELS, SELL_GROUP_ORDER, badgeGroup, heirloomSellBlock, isUnique, needsSellConfirm, sellGroup, UNIQUE_SELL_WARNING, type SellGroup } from '../../persist/sellSafety.ts'
import type { SaveData, SavedHero } from '../../persist/save.ts'
import { sellPriceFor } from '../../persist/town.ts'
import type { ItemInstance } from '../../sim/economy.ts'
import { ImplicitLine, ShopRow, Tag } from '../Kit.tsx'
import { equipFromUi, sellItemFromUi } from '../store.ts'

import { GearChanges } from './GearChanges.tsx'
import { UniqueLines, UniqueTag } from './UniqueLines.tsx'
import { SellButton } from './SellButton.tsx'
import { groupItems } from './groupItems.ts'

type Entry = { item: ItemInstance; worn: boolean; count: number }

/** The badge for a group. Colour is never the only signal: each says its name. */
function GroupBadge({ group }: { group: SellGroup }) {
  if (group === 'worn') return <Tag kind="good">Worn</Tag>
  if (group === 'heirloom') {
    return (
      <Tag kind="info" title="Kept through every life. It can be sold once your level reaches the level it was kept at.">
        Heirloom
      </Tag>
    )
  }
  if (group === 'earlier') {
    return (
      <Tag kind="info" title="Gear from an earlier life sells for only the share your reincarnation carries over.">
        Earlier life
      </Tag>
    )
  }
  return <Tag kind="plain">Current life</Tag>
}

/**
 * The Sell job of a gear shop (Step 13.44): worn gear and the archive in headed groups, riskiest first, with a badge on every
 * row. Risky pieces ask twice. An heirloom stays disabled until the hero reaches the level it was kept at.
 */
export function SellList({
  save,
  hero,
  worn,
  archived,
  closed,
  run,
  armedId,
}: {
  save: SaveData
  hero: SavedHero
  worn: readonly ItemInstance[]
  archived: readonly ItemInstance[]
  closed: boolean
  run: (problem: string | null, done: string) => void
  /** Renders this piece's button already armed (tests). */
  armedId?: string
}) {
  const earlier = new Set(hero.pastLifeItemIds ?? [])
  const entries: Entry[] = [
    ...worn.map((item) => ({ item, worn: true, count: 1 })),
    ...groupItems(archived, (item) => `${earlier.has(item.id) ? 'earlier' : ''}${item.heirloom === undefined ? '' : 'heirloom'}`).map(({ item, count }) => ({ item, worn: false, count })),
  ]
  if (entries.length === 0) return <p>You have nothing of this kind to sell.</p>
  return (
    <>
      {SELL_GROUP_ORDER.map((group) => {
        const rows = entries.filter((entry) => sellGroup(entry.item, entry.worn, earlier) === group)
        if (rows.length === 0) return null
        return (
          <section key={group} aria-label={SELL_GROUP_LABELS[group]}>
            <h4 className="sell-group">
              {SELL_GROUP_LABELS[group]} <span className="muted">({rows.reduce((sum, row) => sum + row.count, 0)})</span>
            </h4>
            <ul className="shop-rows">
              {rows.map(({ item, worn: isWorn, count }) => {
                const own = badgeGroup(item, earlier)
                const blockedReason = heirloomSellBlock(item, hero.progress.level)
                const confirm = needsSellConfirm(item, earlier)
                const price = sellPriceFor(hero, item)
                return (
                  <ShopRow
                    key={item.id}
                    name={
                      <>
                        {itemName(item)} <UniqueTag item={item} /> {isWorn ? <Tag kind="good">Worn</Tag> : null}
                        {own !== 'current' || !isWorn ? <GroupBadge group={own} /> : null}
                      </>
                    }
                    owned={count > 1 ? count : undefined}
                    effect={
                      <>
                        {`${isWorn ? 'Worn' : 'Archive'} · Item level ${item.itemLevel} · Quality ${Math.round(item.quality * 100)}%`}
                        {implicitText(item.baseId, item.itemLevel) === null ? null : <ImplicitLine text={implicitText(item.baseId, item.itemLevel) ?? ''} />}
                        <UniqueLines item={item} />
                      </>
                    }
                    note={
                      isWorn ? (
                        blockedReason ?? (confirm ? 'Asks you to confirm before it sells.' : undefined)
                      ) : (
                        <>
                          <GearChanges preview={previewEquip(save, hero.id, item.id)} empty="No stat change from what you wear." />
                          {blockedReason !== null ? <> {blockedReason}</> : confirm ? ' Asks you to confirm before it sells.' : null}
                        </>
                      )
                    }
                    costs={blockedReason !== null ? [] : [[{ kind: 'gold', amount: price, prefix: '+' }]]}
                    actions={
                      <>
                        {isWorn ? null : (
                          <button type="button" className="btn-good" disabled={closed} aria-label={`Wear ${item.id}`} onClick={() => run(equipFromUi(item.id, null), `Put on ${itemName(item)}.`)}>
                            Wear
                          </button>
                        )}
                        <SellButton
                          price={price}
                          needsConfirm={confirm}
                          disabled={closed}
                          blockedReason={blockedReason}
                          label={isWorn ? `Sell worn ${item.id}` : `Sell ${item.id}`}
                          confirmLabel={`Confirm sell ${isWorn ? 'worn ' : ''}${item.id} for ${price} gold${isUnique(item) ? `. ${UNIQUE_SELL_WARNING}` : ''}`}
                          initialArmed={armedId === item.id}
                          onSell={() => run(sellItemFromUi(item.id), isWorn ? `Sold ${itemName(item)}. Fill the slot before the next expedition.` : `Sold ${itemName(item)}.`)}
                        />
                      </>
                    }
                  />
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}
