import { contractTrack, type ContractTrackRow } from '../../persist/contracts.ts'
import { Tag } from '../Kit.tsx'
import { useSaveStatus } from '../store.ts'
import { useNarrow } from '../useNarrow.ts'

function shownOf(row: ContractTrackRow): number {
  return Math.min(row.progress + row.pending, row.count)
}

/** One line for a phone: how many contracts, how many done, and what this run added. */
export function contractSummary(rows: readonly ContractTrackRow[]): string {
  if (rows.length === 0) return 'none accepted'
  const done = rows.filter((row) => shownOf(row) >= row.count).length
  const pending = rows.reduce((sum, row) => sum + row.pending, 0)
  return [`${rows.length} active`, done > 0 ? `${done} done` : null, pending > 0 ? `+${pending} this run` : null].filter((part) => part !== null).join(' · ')
}

/** Compact list of the selected hero's contracts, with live run units counted toward the bar. Folds to one line on a phone. */
export function ContractTrack() {
  const { save } = useSaveStatus()
  const narrow = useNarrow()
  const rows = contractTrack(save, save.expedition)
  const body =
    rows.length === 0 ? (
      <p className="muted">None accepted. Take work at the Contract Board.</p>
    ) : (
      <ul className="contract-track-list">
        {rows.map((row) => {
          const shown = shownOf(row)
          const done = shown >= row.count
          return (
            <li key={row.contractId} className={`contract-track-row${done ? ' contract-done' : ''}`} data-testid={`contract-track-${row.contractId}`}>
              <strong title={row.description}>{row.label}</strong>
              <span className="contract-track-meta">
                <span className="progress-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round((shown / row.count) * 100)}%` }} />
                </span>
                <span>
                  {shown}/{row.count}
                </span>
                {row.pending > 0 ? <Tag kind="good">+{row.pending} this run</Tag> : null}
                {done ? <Tag kind="good">Done</Tag> : null}
              </span>
            </li>
          )
        })}
      </ul>
    )
  if (narrow) {
    return (
      <details className="contract-track contract-fold" data-testid="contract-track">
        <summary>
          Contracts <span className="contract-fold-summary">{contractSummary(rows)}</span>
        </summary>
        {body}
      </details>
    )
  }
  return (
    <section className="contract-track" aria-label="Current contracts" data-testid="contract-track">
      <h4>Contracts</h4>
      {body}
    </section>
  )
}
