import { uniqueSourceName } from '../../content/uniques.ts'
import type { ItemInstance } from '../../sim/economy.ts'
import { uniqueDef, uniqueSignatureText } from '../../sim/uniques.ts'
import { ImplicitLine, Tag } from '../Kit.tsx'

/** The mark on an elite unique's row: text and colour, so the colour is never the only signal. Nothing for any other item. */
export function UniqueTag({ item }: { item: ItemInstance }) {
  if (uniqueDef(item.uniqueId) === undefined) return null
  return (
    <Tag kind="gold" title="A named item an elite pays once. It cannot be earned again if it is sold." testId="unique-tag">
      Unique
    </Tag>
  )
}

/** The signature of a unique as a quiet key-value line (figures scaled to the item's level), and where it came from. Nothing for any other item. */
export function UniqueLines({ item }: { item: ItemInstance }) {
  const def = uniqueDef(item.uniqueId)
  if (def === undefined) return null
  return (
    <>
      <ImplicitLine label="Signature" text={`${def.signatureName}: ${uniqueSignatureText(item)}`} />
      <small className="item-implicit item-from" data-testid="unique-from">
        From the {uniqueSourceName(def)}
      </small>
    </>
  )
}
