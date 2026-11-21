import { purseOf, type SaveData } from '../persist/save.ts'

import { goldTotals } from './goldTotals.ts'
import { useCount } from './useCount.ts'

const money = (value: number): string => value.toLocaleString('en-US')

/** The sidebar gold: the total owned, with a second line on a run that says where it is. */
export function GoldLine({ save }: { save: SaveData }) {
  const gold = goldTotals(save)
  const debt = purseOf(save).debt
  const total = useCount(gold.total)
  const carried = useCount(gold.carried)
  const banked = useCount(gold.banked)
  return (
    <span className="gold-line" data-testid="gold-line">
      <span className="gold-total">
        Gold <span className="gold-num">{money(total)}</span>
        {debt > 0 ? ` · Debt ${money(debt)}` : ''}
      </span>
      {gold.onRun ? (
        <small className="gold-split muted" data-testid="gold-split">
          <span className="gold-num">{money(carried)}</span> carried · <span className="gold-num">{money(banked)}</span> banked
        </small>
      ) : null}
    </span>
  )
}
