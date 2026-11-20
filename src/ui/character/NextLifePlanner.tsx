import { useState } from 'react'

import { itemName } from '../../content/items.ts'
import { carryOver, carrySummary } from '../../persist/carryOver.ts'
import {
  MASTERY_MAX,
  heirloomAllowance,
  masteryRank,
  nextLifePreview,
  reincarnationBlock,
  stageNextLife,
  type PlannedPurchase,
} from '../../persist/reincarnation.ts'
import type { SaveData, SavedHero } from '../../persist/save.ts'

import { EQUIPMENT_SLOT_IDS, type ItemInstance } from '../../sim/economy.ts'
import { Kpi, KpiRow } from '../Kit.tsx'
import { reincarnateFromUi } from '../store.ts'

import { CarryFacts, HeirloomPickers, NextLifeFacts, PurchaseTables, gainLines, purchaseRows, type AttributeKey } from './legacyParts.tsx'

const RESETS = 'Level, attributes, skill web, contracts, world progress and Echo ranks'

/** The label of one planned purchase, as the row would have named it just before it was bought. */
function plannedLabel(hero: SavedHero, plan: readonly PlannedPurchase[], index: number): string {
  const item = plan[index]
  if (item === undefined) return ''
  const before = stageNextLife(hero, plan.slice(0, index))
  if (!before.ok) return item.kind
  const row = purchaseRows(before.hero, carryOver(before.hero).percent).find((entry) => entry.kind === item.kind)
  const name = row?.name ?? item.kind
  return item.attribute === undefined ? name : `${name} (+1 ${item.attribute})`
}

export function NextLifePlanner({
  save,
  hero,
  onBack,
  onDone,
  initialPlan = [],
  initialPicks,
  initialConfirming = false,
}: {
  save: SaveData
  hero: SavedHero
  onBack: () => void
  onDone: (message: string) => void
  initialPlan?: readonly PlannedPurchase[]
  initialPicks?: string[]
  initialConfirming?: boolean
}) {
  const candidates: ItemInstance[] = [
    ...EQUIPMENT_SLOT_IDS.flatMap((slot) => (hero.equipment[slot] === null ? [] : [hero.equipment[slot]!])),
    ...hero.purse.archive.filter((item) => item.heirloom === undefined || item.heirloom.heroId === hero.id),
  ]
  const [plan, setPlan] = useState<readonly PlannedPurchase[]>(initialPlan)
  const [picks, setPicks] = useState<string[]>(
    () => initialPicks ?? candidates.filter((item) => item.heirloom?.heroId === hero.id).map((item) => item.id),
  )
  const [confirming, setConfirming] = useState(initialConfirming)
  const [error, setError] = useState<string | null>(null)

  // A plan that no longer works (the hero changed under it) is dropped, and the reason shows.
  const attempt = stageNextLife(hero, plan)
  const planReason = attempt.ok ? null : attempt.reason
  const activePlan = attempt.ok ? plan : []
  const staged = attempt.ok ? attempt : stageNextLife(hero, [])
  if (!staged.ok) return null
  const planned = staged.hero
  const next = nextLifePreview(planned, save.account.discoveries)
  const allowance = heirloomAllowance(planned)
  const shownPicks = Array.from({ length: allowance }, (_, index) => picks[index] ?? '')
  const block = reincarnationBlock(save, hero)
  const pieces = EQUIPMENT_SLOT_IDS.filter((slot) => hero.equipment[slot] !== null).length + hero.purse.archive.length
  const rankNow = masteryRank(hero)
  const rankNext = masteryRank({ ...hero, lives: hero.lives + 1 })
  const chosenNames = shownPicks.flatMap((id) => {
    const item = candidates.find((entry) => entry.id === id)
    return item === undefined ? [] : [itemName(item)]
  })
  const lifeNumber = hero.lives + 2

  function add(kind: PlannedPurchase['kind'], attribute?: AttributeKey): void {
    const item: PlannedPurchase = attribute === undefined ? { kind } : { kind, attribute }
    const tried = stageNextLife(hero, [...activePlan, item])
    if (!tried.ok) {
      setError(tried.reason)
      return
    }
    setError(null)
    setPlan([...activePlan, item])
  }

  function begin(): void {
    const problem = reincarnateFromUi(
      shownPicks.filter((id) => id !== ''),
      activePlan,
    )
    if (problem === null) {
      onDone(`${hero.name} began life ${lifeNumber}.`)
      return
    }
    setError(problem)
    setConfirming(false)
  }

  return (
    <section aria-label="Next life" className="legacy-plan">
      <h2>Between lives — {hero.name}</h2>
      <p className="legacy-hint">Nothing changes until you begin the new life.</p>
      <p>
        <button type="button" onClick={onBack}>
          Back to this life
        </button>
      </p>

      <h3>1. This life ends</h3>
      <KpiRow label="This life">
        <Kpi label="Legacy earned" value={<span data-testid="plan-earned">+{staged.gained.total}</span>} tone="gold" />
        <Kpi
          label="Legacy to spend"
          value={<span data-testid="plan-legacy">{planned.legacy}</span>}
          note={staged.spent > 0 ? `${staged.spent} planned` : `${hero.legacy} banked`}
          tone="gold"
        />
        <Kpi label="Level reached" value={hero.progress.level} />
        <Kpi label="Lives" value={`${hero.lives} → ${hero.lives + 1}`} />
        <Kpi label="Mastery" value={`${rankNow} → ${rankNext}`} note={`of ${MASTERY_MAX} · +${rankNext * 2}% ordinary XP`} />
      </KpiRow>
      <div className="legacy-gain" data-testid="legacy-preview">
        <table className="legacy-breakdown" aria-label="Where this Legacy comes from">
          <tbody>
            {gainLines(staged.gained).map((line) => (
              <tr key={line.text}>
                <td className="num">+{line.amount}</td>
                <th scope="row">{line.text}</th>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>2. Spend Legacy</h3>
      <p className="legacy-hint">Stockpile, heirloom slots and Head Start change what you keep. Buy them here, before the new life starts.</p>
      <PurchaseTables hero={planned} mode="plan" blockedReason={null} onBuy={(row, attribute) => add(row.kind, attribute)} />
      {activePlan.length > 0 ? (
        <div className="legacy-plan-list" data-testid="plan-list">
          <p>
            Planned: {activePlan.map((_, index) => plannedLabel(hero, activePlan, index)).join(', ')} ({staged.spent} Legacy)
          </p>
          <div className="legacy-plan-actions">
            <button
              type="button"
              onClick={() => {
                setError(null)
                setPlan(activePlan.slice(0, -1))
              }}
            >
              Undo last
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setPlan([])
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <h3>3. What you keep</h3>
      <CarryFacts carry={next.carry} tokensNow={hero.freeUpgrades ?? 0} tokensNext={next.tokens} pieces={pieces} resets={RESETS} />
      <NextLifeFacts next={next} />

      <h3>4. Heirlooms</h3>
      <HeirloomPickers allowance={allowance} candidates={candidates} picks={shownPicks} onChange={setPicks} />

      <div className="legacy-plan-actions">
        {block !== null ? (
          <>
            <p data-testid="reincarnation-block">{block}</p>
            <button type="button" className="btn-primary" disabled>
              Begin new life…
            </button>
          </>
        ) : confirming ? (
          <div className="legacy-confirm" role="dialog" aria-label="Confirm new life">
            <p>
              This cannot be undone. {hero.name} starts life {lifeNumber} at level {next.startLevel}.
            </p>
            <p>
              Spends {staged.spent} Legacy, {planned.legacy} left.
            </p>
            <p data-testid="confirm-carry">{carrySummary(next.carry)}</p>
            <p>Heirlooms: {chosenNames.length === 0 ? 'none' : chosenNames.join(', ')}</p>
            <div className="legacy-plan-actions">
              <button type="button" className="btn-primary" onClick={begin}>
                Begin new life
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setConfirming(true)}>
            Begin new life…
          </button>
        )}
        <button type="button" onClick={onBack}>
          Back to this life
        </button>
      </div>
      {planReason !== null ? <p role="alert">{planReason}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
