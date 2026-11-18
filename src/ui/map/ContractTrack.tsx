import { contractTrack } from '../../persist/contracts.ts'
import { Tag } from '../Kit.tsx'
import { useSaveStatus } from '../store.ts'

/** Compact list of the selected hero's contracts, with live run units counted toward the bar. */
export function ContractTrack() {
  const { save } = useSaveStatus()
  const rows = contractTrack(save, save.expedition)
  return (
    <section className="contract-track" aria-label="Current contracts" data-testid="contract-track">
      <h4>Contracts</h4>
      {rows.length === 0 ? (
        <p className="muted">None accepted. Take work at the Contract Board.</p>
      ) : (
        <ul className="contract-track-list">
          {rows.map((row) => {
            const shown = Math.min(row.progress + row.pending, row.count)
            const done = shown >= row.count
            return (
              <li key={row.contractId} className={`contract-track-row${done ? ' contract-done' : ''}`} data-testid={`contract-track-${row.contractId}`}>
                <strong title={row.description}>{row.name}</strong>
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
      )}
    </section>
  )
}
