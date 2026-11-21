import { useState } from 'react'

import { itemBase, itemName } from '../../content/items.ts'
import { selectedHero } from '../../persist/character.ts'
import {
  MASTERY_MAX,
  claimableItems,
  freeHeirloomSlots,
  heirloomClaimBlock,
  heirloomSlotUse,
  legacyPreview,
  masteryRank,
  nextLifePreview,
  bossFaced,
  reincarnationBlock,
} from '../../persist/reincarnation.ts'
import { purseOf } from '../../persist/save.ts'
import { EQUIPMENT_SLOT_IDS, slotsFor, type ItemInstance } from '../../sim/economy.ts'
import { Help } from '../Help.tsx'
import { GuideLink } from '../guide/GuideLink.tsx'
import { Kpi, KpiRow } from '../Kit.tsx'
import { buyPurchaseFromUi, claimHeirloomFromUi, devLegacyTools, useSaveStatus } from '../store.ts'

import { NextLifePlanner } from './NextLifePlanner.tsx'
import { CarryFacts, NextLifeFacts, PurchaseTables, gainLines } from './legacyParts.tsx'

export function Legacy({ initialPlanning = false }: { initialPlanning?: boolean } = {}) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [claim, setClaim] = useState('')
  const [planningFor, setPlanningFor] = useState<string | null>(() => (initialPlanning && hero !== null ? hero.id : null))
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (hero === null) {
    return (
      <section aria-label="Legacy">
        <h2>Legacy</h2>
        <p>Select a hero to see their Legacy.</p>
      </section>
    )
  }

  if (planningFor === hero.id) {
    return (
      <NextLifePlanner
        key={hero.id}
        save={save}
        hero={hero}
        onBack={() => setPlanningFor(null)}
        onDone={(done) => {
          setPlanningFor(null)
          setError(null)
          setMessage(done)
        }}
      />
    )
  }

  const block = reincarnationBlock(save, hero)
  const preview = legacyPreview(hero)
  const next = nextLifePreview(hero, save.account.discoveries)
  const running = save.expedition !== null
  const pieces = EQUIPMENT_SLOT_IDS.filter((slot) => hero.equipment[slot] !== null).length + purseOf(save).archive.length
  const rank = masteryRank(hero)

  const freeSlots = freeHeirloomSlots(hero)
  const slotUse = heirloomSlotUse(hero)
  const claimable = claimableItems(hero)
  const claimBlock = heirloomClaimBlock(hero, running)
  const canClaim = claimBlock === null

  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }

  return (
    <section aria-label="Legacy">
      <h2>Legacy — {hero.name}</h2>
      <KpiRow label="Legacy summary">
        <Kpi label="Legacy" value={<span data-testid="legacy">{hero.legacy}</span>} tone="gold" />
        <Kpi label="Lives completed" value={hero.lives} />
        <Kpi label="Mastery rank" value={<span data-testid="mastery">{rank}</span>} note={`of ${MASTERY_MAX} · +${rank * 2}% ordinary XP`} />
        <Kpi label="Carried share" value={<span data-testid="carry-percent">{next.carry.percent}%</span>} note="of gold, materials and supplies" />
        <Kpi label="Peak level" value={hero.peakLevel ?? '—'} note={hero.peakLevel === undefined ? 'set at your next reincarnation' : undefined} />
      </KpiRow>
      {import.meta.env.DEV ? (
        <p>
          <button type="button" onClick={() => devLegacyTools('bossLoss')}>
            Dev: mark a boss loss
          </button>{' '}
          <button type="button" onClick={() => devLegacyTools('legacy')}>
            Dev: +40 Legacy
          </button>
        </p>
      ) : null}

      <h3>Purchases</h3>
      <PurchaseTables
        hero={hero}
        mode="now"
        blockedReason={running ? 'Finish the expedition first.' : null}
        onBuy={(row, attribute) => {
          if (row.controls === 'attributes') {
            if (attribute !== undefined) run(buyPurchaseFromUi('attribute', attribute), `Bought a ${attribute} seed. It is added to this life now.`)
            return
          }
          run(buyPurchaseFromUi(row.kind), row.done)
        }}
      />

      <h3>Next life</h3>
      <NextLifeFacts next={next} />
      <CarryFacts carry={next.carry} tokensNow={hero.freeUpgrades ?? 0} tokensNext={next.tokens} pieces={pieces} setup={next.setup} />

      <div className="legacy-claim" data-testid="heirloom-claim">
        <h3>{canClaim ? 'Heirloom slot free' : 'Make an heirloom now'}</h3>
        <KpiRow label="Heirloom slots">
          <Kpi label="Slots owned" value={<span data-testid="heirloom-owned">{slotUse.owned}</span>} />
          <Kpi label="In use" value={<span data-testid="heirloom-used">{slotUse.used}</span>} />
          <Kpi label="Free" value={<span data-testid="heirloom-free">{freeSlots}</span>} tone={freeSlots > 0 ? 'good' : undefined} />
        </KpiRow>
        <p className="legacy-hint">
          Make an item you own an heirloom now: it works at your level at once and is kept when you reincarnate.
        </p>
        {claimBlock !== null ? (
          <p className="legacy-hint" data-testid="heirloom-claim-block">
            {claimBlock}
          </p>
        ) : null}
        <div className="legacy-act">
          <label>
            Item
            <select aria-label="Item to make an heirloom" value={claim} disabled={claimBlock !== null} onChange={(event) => setClaim(event.target.value)}>
              <option value="">{claimable.length === 0 ? 'Nothing to choose' : 'Choose an item'}</option>
              {claimable.map((item) => (
                <option key={item.id} value={item.id}>
                  {itemName(item)} ({slotLabel(item)}, item level {item.itemLevel})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={claim === '' || claimBlock !== null}
            title={claimBlock ?? undefined}
            onClick={() => {
              run(claimHeirloomFromUi(claim), 'The item is now an heirloom.')
              setClaim('')
            }}
          >
            Make heirloom now
          </button>
        </div>
      </div>

      <h3>
        Reincarnate
        <Help label="What reincarnating resets">
          Reincarnating resets level, XP, attributes, the skill web, this hero's world progress and Echo ranks, and this hero's contracts. Rules, stacks and preparation are kept. Only a share of
          this hero's gold, materials and supplies carries over (Stockpile raises it); the rest is lost. Mastery, purchases, Legacy, discoveries, recipes,
          crafting, free upgrade tokens and all gear stay, and your worn gear goes to the archive. Gear from an earlier life sells for only the carried share.
          The elites you beat are remembered, so the zones they guard stay open.
        </Help>
        <GuideLink id="topic-reincarnation" label="Reincarnation" />
      </h3>
      <p data-testid="boss-faced">{bossFacedText(bossFaced(hero))}</p>
      {block !== null ? (
        <p data-testid="reincarnation-block">{block}</p>
      ) : (
        <div className="legacy-reincarnate">
          <div className="legacy-gain" data-testid="legacy-preview">
            <p className="legacy-gain-total">
              <strong>{preview.total}</strong>
              <span>Legacy if you reincarnate now</span>
            </p>
            <table className="legacy-breakdown" aria-label="Where this Legacy comes from">
              <tbody>
                {gainLines(preview).map((line) => (
                  <tr key={line.text}>
                    <td className="num">+{line.amount}</td>
                    <th scope="row">{line.text}</th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legacy-act">
            <p className="legacy-hint">Spend this life's Legacy, choose heirlooms and see what you keep before anything changes.</p>
            <button type="button" className="btn-primary" data-testid="plan-next-life" onClick={() => setPlanningFor(hero.id)}>
              Plan your next life…
            </button>
          </div>
        </div>
      )}
      {message !== null ? <p data-testid="legacy-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}

const CLAIM_SLOT_LABELS: { [slot: string]: string } = {
  mainHand: 'Main hand',
  offHand: 'Off-hand',
  accessory0: 'Accessory',
  accessory1: 'Accessory',
}

function slotLabel(item: ItemInstance): string {
  const base = itemBase(item.baseId)
  if (base === undefined) return 'Item'
  const slot = slotsFor(base)[0] ?? ''
  return CLAIM_SLOT_LABELS[slot] ?? slot.charAt(0).toUpperCase() + slot.slice(1)
}

function bossFacedText(faced: ReturnType<typeof bossFaced>): string {
  if (faced === 'lost') return 'Boss faced this life: lost to the Fractured Warden.'
  if (faced === 'won') return 'Boss faced this life: defeated the Fractured Warden.'
  if (faced === 'both') return 'Boss faced this life: lost to and defeated the Fractured Warden.'
  return 'Not yet: face the Fractured Warden. A loss or a victory both count.'
}
