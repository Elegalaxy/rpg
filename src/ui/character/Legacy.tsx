import { useState } from 'react'

import { itemBase, itemName } from '../../content/items.ts'
import { supplyTable } from '../../content/supplies.ts'
import { DEEP_POCKETS_COST, DEEP_POCKETS_ROOM } from '../../persist/bag.ts'
import { STOCKPILE_COSTS, STOCKPILE_PERCENTS, carrySummary, type CarryLine } from '../../persist/carryOver.ts'
import { selectedHero } from '../../persist/character.ts'
import {
  ATTRIBUTE_SEED_COST,
  ATTRIBUTE_SEED_MAX,
  ARTISAN_COSTS,
  ARTISAN_TOKENS,
  HEAD_START_LEVELS,
  LONG_MEMORY_COSTS,
  LONG_MEMORY_LEVELS,
  FIFTH_SLOT_COST,
  THIRD_HEIRLOOM_COST,
  MASTERY_MAX,
  SECOND_HEIRLOOM_COST,
  SKILL_SEED_COSTS,
  attributeSeedTotal,
  headStartCost,
  claimableItems,
  freeHeirloomSlots,
  heirloomAllowance,
  legacyPreview,
  masteryRank,
  nextLifePreview,
  bossFaced,
  reincarnationBlock,
  skillSeedCost,
  type LegacyPreview,
} from '../../persist/reincarnation.ts'
import { purseOf, type SavedHero } from '../../persist/save.ts'
import { LOADOUT_SLOT_COUNT, MAX_LOADOUT_SLOTS } from '../../sim/progression.ts'
import { EQUIPMENT_SLOT_IDS, slotsFor, type ItemInstance } from '../../sim/economy.ts'
import { Collapsible } from '../Collapsible.tsx'
import { Help } from '../Help.tsx'
import { GuideLink } from '../guide/GuideLink.tsx'
import { Kpi, KpiRow, Tag } from '../Kit.tsx'
import { buyPurchaseFromUi, claimHeirloomFromUi, devLegacyTools, reincarnateFromUi, useSaveStatus } from '../store.ts'

const ATTRIBUTES = ['strength', 'vitality', 'agility', 'intellect', 'spirit'] as const

const PURCHASE_GROUPS: { id: PurchaseGroup; title: string }[] = [
  { id: 'life', title: 'Each new life' },
  { id: 'carry', title: 'What carries over' },
]

const ROMAN = ['I', 'II', 'III'] as const

/** The name of a tiered purchase: the next tier to buy, or the bare name once every tier is bought. */
function tierName(base: string, bought: number, tiers: number): string {
  return bought < tiers ? `${base} ${ROMAN[bought]}` : base
}

function num(value: number): string {
  return value.toLocaleString('en-US')
}

type PurchaseGroup = 'life' | 'carry'

type PurchaseRow = {
  id: string
  group: PurchaseGroup
  name: string
  effect: string
  /** The next price, or null when nothing is left to buy. */
  cost: number | null
  bought: string
  controls: 'single' | 'attributes'
  buy: () => string | null
  done: string
}

/** Why a purchase cannot be bought right now, or null. The reason shows next to the button. */
function whyNot(row: PurchaseRow, hero: SavedHero, running: boolean): string | null {
  if (row.cost === null) return 'All bought.'
  if (running) return 'Finish the expedition first.'
  if (hero.legacy < row.cost) return `Needs ${row.cost - hero.legacy} more Legacy.`
  return null
}

export function Legacy() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [heirloom, setHeirloom] = useState('')
  const [claim, setClaim] = useState('')
  const [confirming, setConfirming] = useState(false)
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

  const block = reincarnationBlock(save, hero)
  const preview = legacyPreview(hero)
  const next = nextLifePreview(hero, save.account.discoveries)
  const carry = next.carry
  const running = save.expedition !== null
  const pieces = EQUIPMENT_SLOT_IDS.filter((slot) => hero.equipment[slot] !== null).length + purseOf(save).archive.length
  const rank = masteryRank(hero)
  const candidates = [
    ...EQUIPMENT_SLOT_IDS.flatMap((slot) => (hero.equipment[slot] === null ? [] : [hero.equipment[slot]!])),
    ...purseOf(save).archive.filter((item) => item.heirloom === undefined || item.heirloom.heroId === hero.id),
  ]

  const freeSlots = freeHeirloomSlots(hero)
  const claimable = claimableItems(hero)

  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }

  const headStart = headStartCost(hero.purchases)
  const stockpileBought = hero.purchases.stockpile ?? 0
  const artisanBought = hero.purchases.artisan ?? 0
  const memoryBought = hero.purchases.longMemory ?? 0
  const heirloomBought = (hero.purchases.secondHeirloom ? 1 : 0) + (hero.purchases.thirdHeirloom === true ? 1 : 0)
  const artisanTokens = ARTISAN_TOKENS[Math.min(artisanBought, ARTISAN_TOKENS.length - 1)]
  const rows: PurchaseRow[] = [
    {
      id: 'attribute',
      group: 'life',
      name: 'Attribute Seed',
      effect: '+1 to an attribute of your choice. Applies now and every later life',
      cost: attributeSeedTotal(hero.purchases) >= ATTRIBUTE_SEED_MAX ? null : ATTRIBUTE_SEED_COST,
      bought: `${attributeSeedTotal(hero.purchases)} of ${ATTRIBUTE_SEED_MAX}`,
      controls: 'attributes',
      buy: () => null,
      done: '',
    },
    {
      id: 'skill',
      group: 'life',
      name: 'Skill Point Seed',
      effect: '+1 unspent skill point. Applies now and every later life',
      cost: skillSeedCost(hero.purchases),
      bought: `${hero.purchases.skillSeeds} of ${SKILL_SEED_COSTS.length}`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('skill'),
      done: 'Bought a skill point seed. The point is added now.',
    },
    {
      id: 'fifthSlot',
      group: 'life',
      name: 'Fifth Skill Slot',
      effect: `One more skill in your loadout (${MAX_LOADOUT_SLOTS} instead of ${LOADOUT_SLOT_COUNT}). Applies now and every later life`,
      cost: hero.purchases.fifthSlot === true ? null : FIFTH_SLOT_COST,
      bought: `${hero.purchases.fifthSlot === true ? 1 : 0} of 1`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('fifthSlot'),
      done: 'Bought the fifth skill slot. Pick a fifth skill in the Loadout.',
    },
    {
      id: 'headStart',
      group: 'life',
      name: tierName('Head Start', hero.purchases.headStart, HEAD_START_LEVELS.length),
      effect: `Start at level ${HEAD_START_LEVELS[Math.min(hero.purchases.headStart, HEAD_START_LEVELS.length - 1)]}. Raises you to it now if you are lower, and every later life starts there`,
      cost: headStart,
      bought: `${hero.purchases.headStart} of ${HEAD_START_LEVELS.length}`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('headStart'),
      done: 'Bought a Head Start. Your level is raised now if it was lower.',
    },
    {
      id: 'memory',
      group: 'life',
      name: tierName('Long Memory', memoryBought, LONG_MEMORY_COSTS.length),
      effect: `Recall doubles run XP until ${LONG_MEMORY_LEVELS[Math.min(memoryBought, LONG_MEMORY_LEVELS.length - 1)]} levels above your peak level. Applies now once you have a peak, and every later life`,
      cost: LONG_MEMORY_COSTS[memoryBought] ?? null,
      bought: `${memoryBought} of ${LONG_MEMORY_COSTS.length}`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('memory'),
      done: 'Bought Long Memory. Recall reaches higher now.',
    },
    {
      id: 'artisan',
      group: 'life',
      name: tierName('Artisan\u2019s Favor', artisanBought, ARTISAN_COSTS.length),
      effect: `Each new life starts with ${artisanTokens} free upgrade ${artisanTokens === 1 ? 'token' : 'tokens'}, and they stack across lives. Gives 1 token now`,
      cost: ARTISAN_COSTS[artisanBought] ?? null,
      bought: `${artisanBought} of ${ARTISAN_COSTS.length}`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('artisan'),
      done: 'Bought Artisan\u2019s Favor. You have a free upgrade token now.',
    },
    {
      id: 'stockpile',
      group: 'carry',
      name: tierName('Stockpile', stockpileBought, STOCKPILE_COSTS.length),
      effect: `Reincarnating keeps ${STOCKPILE_PERCENTS[Math.min(stockpileBought, STOCKPILE_PERCENTS.length - 1)]}% of your gold, materials and supplies (now ${next.carry.percent}%), and earlier-life gear sells for the same share. Applies now`,
      cost: STOCKPILE_COSTS[stockpileBought] ?? null,
      bought: `${stockpileBought} of ${STOCKPILE_COSTS.length}`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('stockpile'),
      done: 'Bought a Stockpile. The carried share is higher now.',
    },
    {
      id: 'heirloom',
      group: 'carry',
      name: heirloomBought === 0 ? 'Second Heirloom' : heirloomBought === 1 ? 'Third Heirloom' : 'Heirloom slots',
      effect: 'Keep one more heirloom. Use it right away on an item you own, or choose at your next reincarnation',
      cost: heirloomBought === 0 ? SECOND_HEIRLOOM_COST : heirloomBought === 1 ? THIRD_HEIRLOOM_COST : null,
      bought: `${heirloomBought} of 2`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('heirloom'),
      done: 'Bought an heirloom slot. Use it now on an item you own, or at your next reincarnation.',
    },
    {
      id: 'pockets',
      group: 'carry',
      name: 'Deep Pockets',
      effect: `+${DEEP_POCKETS_ROOM} loot bag room. Applies now and every later life`,
      cost: hero.purchases.deepPockets ? null : DEEP_POCKETS_COST,
      bought: hero.purchases.deepPockets ? '1 of 1' : '0 of 1',
      controls: 'single',
      buy: () => buyPurchaseFromUi('pockets'),
      done: 'Bought Deep Pockets.',
    },
  ]

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
      {PURCHASE_GROUPS.map((group) => (
        <div key={group.id}>
      <h4 className="legacy-group">{group.title}</h4>
      <table className="away-table legacy-table" aria-label={`Legacy purchases: ${group.title}`}>
        <thead>
          <tr>
            <th scope="col">Purchase</th>
            <th scope="col">Effect</th>
            <th scope="col" className="num">
              Cost
            </th>
            <th scope="col" className="num">
              Bought
            </th>
            <th scope="col">Buy</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter((row) => row.group === group.id).map((row) => {
            const why = whyNot(row, hero, running)
            return (
              <tr key={row.id} data-testid={`purchase-${row.id}`}>
                <th scope="row">{row.name}</th>
                <td>{row.effect}</td>
                <td className="num">{row.cost === null ? '—' : `${row.cost} Legacy`}</td>
                <td className="num">{row.bought}</td>
                <td>
                  {row.controls === 'attributes' ? (
                    <span className="legacy-buttons">
                      {ATTRIBUTES.map((attribute) => (
                        <button
                          key={attribute}
                          type="button"
                          disabled={why !== null}
                          aria-label={`Buy ${attribute} seed`}
                          onClick={() => run(buyPurchaseFromUi('attribute', attribute), `Bought a ${attribute} seed. It is added to this life now.`)}
                        >
                          +1 {attribute} ({hero.purchases.attributeSeeds[attribute]})
                        </button>
                      ))}
                    </span>
                  ) : (
                    <button type="button" disabled={why !== null} aria-label={`Buy ${row.name}`} onClick={() => run(row.buy(), row.done)}>
                      Buy
                    </button>
                  )}
                  {why !== null ? (
                    <small className="legacy-why" data-testid={`why-${row.id}`}>
                      {why}
                    </small>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
        </div>
      ))}

      <h3>Next life</h3>
      <dl className="legacy-facts" data-testid="next-life">
        <div>
          <dt>Starts at</dt>
          <dd data-testid="next-start">
            level {next.startLevel}
            {next.startLevel > 1 ? ` (${next.attributePoints} attribute points and ${next.skillPoints} skill ${next.skillPoints === 1 ? 'point' : 'points'} unspent)` : ''}
          </dd>
        </div>
        <div>
          <dt>Recall</dt>
          <dd data-testid="next-recall">
            {next.recallUntil === null ? 'Nothing to recall yet. It follows the highest level you reach.' : `Doubles run XP until level ${next.recallUntil}.`}
          </dd>
        </div>
        <div>
          <dt>Remembered zones</dt>
          <dd className="legacy-zones" data-testid="next-zones">
            {next.zones.length === 0
              ? 'None yet. Defeat a zone elite.'
              : next.zones.map((zone) => (
                  <Tag key={zone} kind="info">
                    {zone}
                  </Tag>
                ))}
          </dd>
        </div>
      </dl>

      <h4 className="legacy-group">Carries over</h4>
      <dl className="legacy-facts" data-testid="carry-over">
        <div>
          <dt>Gold</dt>
          <dd data-testid="carry-gold">
            {`${num(carry.gold.now)} → ${num(carry.gold.kept)}`}
          </dd>
        </div>
        {carry.debt.now > 0 ? (
          <div>
            <dt>Debt</dt>
            <dd data-testid="carry-debt">
              {`${num(carry.debt.now)} → ${num(carry.debt.kept)}`} <small>{`(${num(carry.debtPaid)} paid from gold first)`}</small>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Free upgrade tokens</dt>
          <dd data-testid="carry-tokens">
            {`${hero.freeUpgrades ?? 0} → ${next.tokens}`}
          </dd>
        </div>
        <div>
          <dt>Gear</dt>
          <dd data-testid="carry-gear">{`All ${pieces} pieces kept`}</dd>
        </div>
        <div>
          <dt>Earlier-life gear</dt>
          <dd data-testid="carry-sell">{`Sells at ${carry.percent}%`}</dd>
        </div>
      </dl>
      <Collapsible summary={`Materials (${carry.materials.length})`} testId="carry-materials">
        <StockTable lines={carry.materials} label="Materials" nameOf={(id) => id} />
      </Collapsible>
      <Collapsible summary={`Supplies (${carry.supplies.length})`} testId="carry-supplies">
        <StockTable lines={carry.supplies} label="Supplies" nameOf={(id) => supplyTable[id]?.name ?? id} />
      </Collapsible>
      <p className="legacy-lost">The rest is lost. Spend gold and materials on gear before you go.</p>

      {freeSlots > 0 && claimable.length > 0 ? (
        <div className="legacy-claim" data-testid="heirloom-claim">
          <h3>Heirloom slot free</h3>
          <p className="legacy-hint">
            {freeSlots} free. Make an item you own an heirloom now: it works at your level at once and is kept when you reincarnate.
          </p>
          <div className="legacy-act">
            <label>
              Item
              <select aria-label="Item to make an heirloom" value={claim} onChange={(event) => setClaim(event.target.value)}>
                <option value="">Choose an item</option>
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
              disabled={claim === '' || running}
              onClick={() => {
                run(claimHeirloomFromUi(claim), 'The item is now an heirloom.')
                setClaim('')
              }}
            >
              Make heirloom now
            </button>
            {running ? <small className="legacy-hint">Finish the expedition first.</small> : null}
          </div>
        </div>
      ) : null}

      <h3>
        Reincarnate
        <Help label="What reincarnating resets">
          Reincarnating resets level, XP, attributes, the skill web, this hero's world progress and Echo ranks, and this hero's contracts. Only a share of
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
            <label>
              Heirloom
              <small>Up to {heirloomAllowance(hero)}</small>
              <select aria-label="Heirloom" value={heirloom} onChange={(event) => setHeirloom(event.target.value)}>
                <option value="">None</option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {itemName(item)} (item level {item.itemLevel})
                  </option>
                ))}
              </select>
            </label>
            {confirming ? (
              <div className="legacy-confirm" role="dialog" aria-label="Confirm reincarnation">
                <p>This cannot be undone. Reincarnate {hero.name}?</p>
                <p data-testid="confirm-carry">
                  {carrySummary(carry)}
                </p>
                <p className="legacy-hint">Spend gold and materials on gear before you go.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    run(reincarnateFromUi(heirloom === '' ? null : heirloom), `${hero.name} was reincarnated.`)
                    setConfirming(false)
                  }}
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setConfirming(true)}>
                Reincarnate…
              </button>
            )}
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

/** One scannable line of the Legacy preview. Echo ranks collapse into a single range. */
function gainLines(preview: LegacyPreview): { amount: number; text: string }[] {
  const lines: { amount: number; text: string }[] = [{ amount: preview.fromLevel, text: 'Level and XP' }]
  const ranks = preview.bonuses.filter((bonus) => bonus.id.startsWith('rank:'))
  for (const bonus of preview.bonuses) {
    if (!bonus.id.startsWith('rank:')) lines.push({ amount: bonus.amount, text: bonus.text })
  }
  if (ranks.length === 1) {
    const only = ranks[0]
    if (only !== undefined) lines.push({ amount: only.amount, text: only.text })
  } else if (ranks.length > 1) {
    const numbers = ranks.map((bonus) => Number(bonus.id.slice('rank:'.length))).sort((a, b) => a - b)
    lines.push({
      amount: ranks.reduce((sum, bonus) => sum + bonus.amount, 0),
      text: `Echo ranks ${numbers[0]}–${numbers[numbers.length - 1]} first unlocked`,
    })
  }
  return lines
}

/** What a stack list carries over: now and next life, right aligned with thousands separators. */
function StockTable({ lines, label, nameOf }: { lines: CarryLine[]; label: string; nameOf: (id: string) => string }) {
  if (lines.length === 0) return <p>None.</p>
  return (
    <table className="legacy-stock" aria-label={`${label} that carry over`}>
      <thead>
        <tr>
          <th scope="col">{label.slice(0, -1)}</th>
          <th scope="col" className="num">
            Now
          </th>
          <th scope="col" className="num">
            Next life
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id}>
            <th scope="row">{nameOf(line.id)}</th>
            <td className="num">{num(line.now)}</td>
            <td className="num">{num(line.kept)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
