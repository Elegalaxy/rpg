import { useEffect } from 'react'

import { formatEvent, summarizeDefeat } from '../../sim/log.ts'
import type { ActorStatuses, CombatState, EncounterEndEvent, LogEvent } from '../../sim/types.ts'

import './log.css'

const STATUS_KEYS = ['bleed', 'poison', 'burn', 'chill', 'mark', 'expose'] as const

function lastEncounterEnd(log: readonly LogEvent[]): EncounterEndEvent | null {
  for (let index = log.length - 1; index >= 0; index -= 1) {
    const event = log[index]
    if (event !== undefined && event.type === 'encounterEnd') return event
  }
  return null
}

function HeroStatuses({ statuses }: { statuses: ActorStatuses }) {
  const active = STATUS_KEYS.flatMap((key) => {
    const status = statuses[key]
    if (status === null) return []
    return [{ key, status }]
  })
  if (active.length === 0) return <p>No hero statuses.</p>
  return (
    <ul className="outcome-statuses">
      {active.map(({ key, status }) => (
        <li key={key}>
          <p>{status.name}</p>
          <pre className="log-payload">{JSON.stringify(status, null, 2)}</pre>
        </li>
      ))}
    </ul>
  )
}

function DefeatCard({ combat }: { combat: CombatState }) {
  const summary = summarizeDefeat(combat)
  return (
    <section className="outcome-card" aria-label="Outcome">
      <h2>{combat.outcome}</h2>
      <h3>Cause chain</h3>
      {summary.hpLoss.length === 0 ? <p>No HP-loss events.</p> : null}
      <ol className="outcome-chain">
        {summary.hpLoss.map((event, index) => (
          <li key={`${event.type}:${event.timeMs}:${index}`}>{formatEvent(event)}</li>
        ))}
      </ol>
      <h3>Hero statuses</h3>
      <HeroStatuses statuses={summary.statuses} />
    </section>
  )
}

function FinishedCard({ combat }: { combat: CombatState }) {
  const end = lastEncounterEnd(combat.log)
  useEffect(() => {
    if (end !== null) return
    console.error('[ui] finished fight has no encounter-end event', { outcome: combat.outcome })
  }, [end, combat.outcome])

  return (
    <section className="outcome-card" aria-label="Outcome">
      <h2>{combat.outcome}</h2>
      {end === null ? <p role="alert">Encounter-end event is missing.</p> : <p>{formatEvent(end)}</p>}
    </section>
  )
}

export function OutcomeCard({ combat }: { combat: CombatState }) {
  if (combat.outcome === 'ongoing') return null
  if (combat.outcome === 'defeat') return <DefeatCard combat={combat} />
  return <FinishedCard combat={combat} />
}
