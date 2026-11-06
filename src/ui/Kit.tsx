import type { ReactNode } from 'react'

/** Small building blocks for scannable screens: pills, stat cards, durability bars, and shop rows. */

export type PillKind = 'gold' | 'mat' | 'owned' | 'good' | 'bad' | 'info'

/** A short coloured label. Gold is amber, materials are slate, and the rest follow the game's colours. */
export function Pill({ kind, children, title, testId }: { kind: PillKind; children: ReactNode; title?: string; testId?: string }) {
  return (
    <span className={`pill pill-${kind}`} title={title} data-testid={testId}>
      {children}
    </span>
  )
}

export type Cost = { kind: 'gold' | 'mat'; amount: number; label?: string; prefix?: string }

/** A cost as a pill: "15 gold" in amber, or "3 hide" in slate. */
export function CostPill({ cost }: { cost: Cost }) {
  return cost.kind === 'gold' ? (
    <Pill kind="gold" title="Gold">
      {cost.prefix}
      {cost.amount} gold
    </Pill>
  ) : (
    <Pill kind="mat" title="Materials">
      {cost.amount} {cost.label}
    </Pill>
  )
}

/** A big number with a small muted label. */
export function Kpi({
  label,
  value,
  note,
  tone,
  testId,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: 'good' | 'bad' | 'warn'
  testId?: string
}) {
  return (
    <div className={`kpi${tone === undefined ? '' : ` kpi-${tone}`}`} data-testid={testId}>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-label">{label}</span>
      {note === undefined ? null : <small className="kpi-note">{note}</small>}
    </div>
  )
}

export function KpiRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="kpi-row" role="group" aria-label={label}>
      {children}
    </div>
  )
}

export type DurabilityPiece = { label: string; durability: number; max: number; disabled: boolean }

/** A compact grid of pieces, each with a name and a bar that shrinks as it wears. */
export function DurabilityGrid({ pieces, label }: { pieces: readonly DurabilityPiece[]; label: string }) {
  return (
    <ul className="durability-grid" aria-label={label}>
      {pieces.map((piece) => {
        const fraction = piece.max <= 0 ? 0 : piece.durability / piece.max
        const tone = piece.disabled ? 'bad' : fraction >= 0.6 ? 'good' : fraction >= 0.3 ? 'warn' : 'bad'
        return (
          <li key={piece.label} className={`durability durability-${tone}`} title={`${piece.label}: ${piece.durability}/${piece.max}`}>
            <span className="durability-name">{piece.label}</span>
            <span className="durability-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(fraction * 100)}%` }} />
            </span>
            <span className="durability-value">{piece.disabled ? 'Broken' : `${piece.durability}/${piece.max}`}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * One shop line: name with an owned badge, a muted effect, the cost pills, and the buttons.
 * Cost groups are shown side by side with a muted "or" between them.
 */
export function ShopRow({
  name,
  owned,
  ownedTestId,
  effect,
  costs,
  pills,
  actions,
  testId,
  note,
}: {
  name: ReactNode
  owned?: number
  ownedTestId?: string
  effect?: ReactNode
  costs?: readonly (readonly Cost[])[]
  /** Extra pills after the costs, such as rewards or progress. */
  pills?: ReactNode
  actions?: ReactNode
  testId?: string
  note?: ReactNode
}) {
  return (
    <li className="shop-row" data-testid={testId}>
      <div className="shop-name">
        <strong>{name}</strong>
        {owned !== undefined && owned > 0 ? (
          <Pill kind="owned" title="You own this many">
            ×<span data-testid={ownedTestId}>{owned}</span>
          </Pill>
        ) : ownedTestId !== undefined ? (
          <span hidden data-testid={ownedTestId}>
            0
          </span>
        ) : null}
      </div>
      <div className="shop-effect">
        {effect}
        {note === undefined ? null : <small className="row-note">{note}</small>}
      </div>
      <div className="shop-costs">
        {(costs ?? []).map((group, index) => (
          <span className="cost-group" key={index}>
            {index > 0 ? <small className="cost-or">or</small> : null}
            {group.map((cost, at) => (
              <CostPill key={at} cost={cost} />
            ))}
          </span>
        ))}
        {pills}
      </div>
      <div className="shop-actions">{actions}</div>
    </li>
  )
}
