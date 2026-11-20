import { debugLog } from '../debug.ts'

import { itemName } from '../../content/items.ts'
import { supplyTable } from '../../content/supplies.ts'
import { DEEP_POCKETS_COST, DEEP_POCKETS_ROOM } from '../../persist/bag.ts'
import { STOCKPILE_COSTS, STOCKPILE_PERCENTS, carryOver, type CarryLine, type CarryOver } from '../../persist/carryOver.ts'
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
  SECOND_HEIRLOOM_COST,
  SKILL_SEED_COSTS,
  attributeSeedTotal,
  headStartCost,
  skillSeedCost,
  type LegacyPreview,
  type NextLife,
  type PurchaseKind,
} from '../../persist/reincarnation.ts'
import type { SetupStats } from '../../persist/pastSetup.ts'
import type { HeroPurchases, SavedHero } from '../../persist/save.ts'
import { LOADOUT_SLOT_COUNT, MAX_LOADOUT_SLOTS } from '../../sim/progression.ts'
import type { ItemInstance } from '../../sim/economy.ts'
import { Collapsible } from '../Collapsible.tsx'
import { Tag } from '../Kit.tsx'

export type AttributeKey = keyof HeroPurchases['attributeSeeds']

export const ATTRIBUTES: readonly AttributeKey[] = ['strength', 'vitality', 'agility', 'intellect', 'spirit']

export type PurchaseGroup = 'life' | 'carry'

export const PURCHASE_GROUPS: { id: PurchaseGroup; title: string }[] = [
  { id: 'life', title: 'Each new life' },
  { id: 'carry', title: 'What carries over' },
]

export const ROMAN = ['I', 'II', 'III'] as const

/** The name of a tiered purchase: the next tier to buy, or the bare name once every tier is bought. */
export function tierName(base: string, bought: number, tiers: number): string {
  return bought < tiers ? `${base} ${ROMAN[bought]}` : base
}

export function num(value: number): string {
  return value.toLocaleString('en-US')
}

export type PurchaseRow = {
  id: string
  kind: PurchaseKind
  group: PurchaseGroup
  name: string
  /** The core sentence: what the purchase does. */
  effect: string
  /** What buying it now also does to the current life. Shown only when purchases apply now. */
  nowNote: string
  /** The next price, or null when nothing is left to buy. */
  cost: number | null
  bought: string
  controls: 'single' | 'attributes'
  /** Shown after a successful buy in the Legacy tab. */
  done: string
}

/** The nine purchase rows for a hero. `carryPercent` is the share a reincarnation would keep right now. */
export function purchaseRows(hero: SavedHero, carryPercent: number): PurchaseRow[] {
  const stockpileBought = hero.purchases.stockpile ?? 0
  const artisanBought = hero.purchases.artisan ?? 0
  const memoryBought = hero.purchases.longMemory ?? 0
  const heirloomBought = (hero.purchases.secondHeirloom ? 1 : 0) + (hero.purchases.thirdHeirloom === true ? 1 : 0)
  const artisanTokens = ARTISAN_TOKENS[Math.min(artisanBought, ARTISAN_TOKENS.length - 1)]
  return [
    {
      id: 'attribute',
      kind: 'attribute',
      group: 'life',
      name: 'Attribute Seed',
      effect: '+1 to an attribute of your choice',
      nowNote: 'Applies now and every later life',
      cost: attributeSeedTotal(hero.purchases) >= ATTRIBUTE_SEED_MAX ? null : ATTRIBUTE_SEED_COST,
      bought: `${attributeSeedTotal(hero.purchases)} of ${ATTRIBUTE_SEED_MAX}`,
      controls: 'attributes',
      done: '',
    },
    {
      id: 'skill',
      kind: 'skill',
      group: 'life',
      name: 'Skill Point Seed',
      effect: '+1 unspent skill point',
      nowNote: 'Applies now and every later life',
      cost: skillSeedCost(hero.purchases),
      bought: `${hero.purchases.skillSeeds} of ${SKILL_SEED_COSTS.length}`,
      controls: 'single',
      done: 'Bought a skill point seed. The point is added now.',
    },
    {
      id: 'fifthSlot',
      kind: 'fifthSlot',
      group: 'life',
      name: 'Fifth Skill Slot',
      effect: `One more skill in your loadout (${MAX_LOADOUT_SLOTS} instead of ${LOADOUT_SLOT_COUNT})`,
      nowNote: 'Applies now and every later life',
      cost: hero.purchases.fifthSlot === true ? null : FIFTH_SLOT_COST,
      bought: `${hero.purchases.fifthSlot === true ? 1 : 0} of 1`,
      controls: 'single',
      done: 'Bought the fifth skill slot. Pick a fifth skill in the Loadout.',
    },
    {
      id: 'headStart',
      kind: 'headStart',
      group: 'life',
      name: tierName('Head Start', hero.purchases.headStart, HEAD_START_LEVELS.length),
      effect: `Start at level ${HEAD_START_LEVELS[Math.min(hero.purchases.headStart, HEAD_START_LEVELS.length - 1)]}`,
      nowNote: 'Raises you to it now if you are lower, and every later life starts there',
      cost: headStartCost(hero.purchases),
      bought: `${hero.purchases.headStart} of ${HEAD_START_LEVELS.length}`,
      controls: 'single',
      done: 'Bought a Head Start. Your level is raised now if it was lower.',
    },
    {
      id: 'memory',
      kind: 'memory',
      group: 'life',
      name: tierName('Long Memory', memoryBought, LONG_MEMORY_COSTS.length),
      effect: `Recall doubles run XP until ${LONG_MEMORY_LEVELS[Math.min(memoryBought, LONG_MEMORY_LEVELS.length - 1)]} levels above your peak level`,
      nowNote: 'Applies now once you have a peak, and every later life',
      cost: LONG_MEMORY_COSTS[memoryBought] ?? null,
      bought: `${memoryBought} of ${LONG_MEMORY_COSTS.length}`,
      controls: 'single',
      done: 'Bought Long Memory. Recall reaches higher now.',
    },
    {
      id: 'artisan',
      kind: 'artisan',
      group: 'life',
      name: tierName('Artisan’s Favor', artisanBought, ARTISAN_COSTS.length),
      effect: `Each new life starts with ${artisanTokens} free upgrade ${artisanTokens === 1 ? 'token' : 'tokens'}, and they stack across lives`,
      nowNote: 'Gives 1 token now',
      cost: ARTISAN_COSTS[artisanBought] ?? null,
      bought: `${artisanBought} of ${ARTISAN_COSTS.length}`,
      controls: 'single',
      done: 'Bought Artisan’s Favor. You have a free upgrade token now.',
    },
    {
      id: 'stockpile',
      kind: 'stockpile',
      group: 'carry',
      name: tierName('Stockpile', stockpileBought, STOCKPILE_COSTS.length),
      effect: `Reincarnating keeps ${STOCKPILE_PERCENTS[Math.min(stockpileBought, STOCKPILE_PERCENTS.length - 1)]}% of your gold, materials and supplies (now ${carryPercent}%), and earlier-life gear sells for the same share`,
      nowNote: 'Applies now',
      cost: STOCKPILE_COSTS[stockpileBought] ?? null,
      bought: `${stockpileBought} of ${STOCKPILE_COSTS.length}`,
      controls: 'single',
      done: 'Bought a Stockpile. The carried share is higher now.',
    },
    {
      id: 'heirloom',
      kind: 'heirloom',
      group: 'carry',
      name: heirloomBought === 0 ? 'Second Heirloom' : heirloomBought === 1 ? 'Third Heirloom' : 'Heirloom slots',
      effect: 'Keep one more heirloom',
      nowNote: 'Use it right away on an item you own, or choose at your next reincarnation',
      cost: heirloomBought === 0 ? SECOND_HEIRLOOM_COST : heirloomBought === 1 ? THIRD_HEIRLOOM_COST : null,
      bought: `${heirloomBought} of 2`,
      controls: 'single',
      done: 'Bought an heirloom slot. Use it now on an item you own, or at your next reincarnation.',
    },
    {
      id: 'pockets',
      kind: 'pockets',
      group: 'carry',
      name: 'Deep Pockets',
      effect: `+${DEEP_POCKETS_ROOM} loot bag room`,
      nowNote: 'Applies now and every later life',
      cost: hero.purchases.deepPockets ? null : DEEP_POCKETS_COST,
      bought: hero.purchases.deepPockets ? '1 of 1' : '0 of 1',
      controls: 'single',
      done: 'Bought Deep Pockets.',
    },
  ]
}

/** The effect text a row shows: with the now-note when purchases apply now, with the new-life note when planned. */
export function rowText(row: PurchaseRow, mode: 'now' | 'plan'): string {
  if (mode === 'now') return `${row.effect}. ${row.nowNote}`
  return row.kind === 'heirloom' ? `${row.effect}. Pick it below` : `${row.effect}. From the new life on`
}

/** Why a purchase cannot be bought right now, or null. The reason shows next to the button. */
export function whyNot(row: PurchaseRow, hero: SavedHero, blockedReason: string | null): string | null {
  if (row.cost === null) return 'All bought.'
  if (blockedReason !== null) return blockedReason
  if (hero.legacy < row.cost) return `Needs ${row.cost - hero.legacy} more Legacy.`
  return null
}

/** The purchase tables, one per group. `now` buys on the spot; `plan` stages a purchase for the next life. */
export function PurchaseTables({
  hero,
  mode,
  blockedReason,
  onBuy,
}: {
  hero: SavedHero
  mode: 'now' | 'plan'
  blockedReason: string | null
  onBuy: (row: PurchaseRow, attribute?: AttributeKey) => void
}) {
  const rows = purchaseRows(hero, carryOver(hero).percent)
  const verb = mode === 'now' ? 'Buy' : 'Plan'
  return (
    <>
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
                <th scope="col">{verb}</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) => row.group === group.id)
                .map((row) => {
                  const why = whyNot(row, hero, blockedReason)
                  return (
                    <tr key={row.id} data-testid={`purchase-${row.id}`}>
                      <th scope="row">{row.name}</th>
                      <td>{rowText(row, mode)}</td>
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
                                aria-label={`${verb} ${attribute} seed`}
                                onClick={() => onBuy(row, attribute)}
                              >
                                +1 {attribute} ({hero.purchases.attributeSeeds[attribute]})
                              </button>
                            ))}
                          </span>
                        ) : (
                          <button type="button" disabled={why !== null} aria-label={`${verb} ${row.name}`} onClick={() => onBuy(row)}>
                            {mode === 'now' ? 'Buy' : 'Add'}
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
    </>
  )
}

/** Start level, Recall and remembered zones for the next life. */
export function NextLifeFacts({ next }: { next: NextLife }) {
  return (
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
  )
}

/** What a reincarnation carries over, with the two stock tables and the line about what is lost. */
export function CarryFacts({
  carry,
  tokensNow,
  tokensNext,
  pieces,
  resets,
  setup,
}: {
  carry: CarryOver
  tokensNow: number
  tokensNext: number
  pieces: number
  resets?: string
  /** What the combat setup keeps (Step 13.37). */
  setup?: SetupStats
}) {
  return (
    <>
      <h4 className="legacy-group">Carries over</h4>
      <dl className="legacy-facts" data-testid="carry-over">
        <div>
          <dt>Gold</dt>
          <dd data-testid="carry-gold">{`${num(carry.gold.now)} → ${num(carry.gold.kept)}`}</dd>
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
          <dd data-testid="carry-tokens">{`${tokensNow} → ${tokensNext}`}</dd>
        </div>
        <div>
          <dt>Gear</dt>
          <dd data-testid="carry-gear">{`All ${pieces} pieces kept`}</dd>
        </div>
        <div>
          <dt>Earlier-life gear</dt>
          <dd data-testid="carry-sell">{`Sells at ${carry.percent}%`}</dd>
        </div>
        {setup === undefined ? null : (
          <div>
            <dt>Combat setup</dt>
            <dd data-testid="carry-setup">
              {`Kept: ${setup.rules} ${setup.rules === 1 ? 'rule' : 'rules'}, ${setup.stacks} ${setup.stacks === 1 ? 'stack' : 'stacks'}, preparation`}
              {setup.waitingRules > 0 ? (
                <>
                  {' '}
                  <small>{`(${setup.waitingRules} ${setup.waitingRules === 1 ? 'waits' : 'wait'} until ${setup.waitingRules === 1 ? 'its skill is' : 'their skills are'} relearned)`}</small>
                </>
              ) : null}
            </dd>
          </div>
        )}
        {resets === undefined ? null : (
          <div>
            <dt>Resets</dt>
            <dd data-testid="carry-resets">{resets}</dd>
          </div>
        )}
      </dl>
      <Collapsible summary={`Materials (${carry.materials.length})`} testId="carry-materials">
        <StockTable lines={carry.materials} label="Materials" nameOf={(id) => id} />
      </Collapsible>
      <Collapsible summary={`Supplies (${carry.supplies.length})`} testId="carry-supplies">
        <StockTable lines={carry.supplies} label="Supplies" nameOf={(id) => supplyTable[id]?.name ?? id} />
      </Collapsible>
      <p className="legacy-lost">The rest is lost. Spend gold and materials on gear before you go.</p>
    </>
  )
}

/** One select per heirloom slot. Controlled: `picks` has one entry per slot, '' for none. No item is picked twice. */
export function HeirloomPickers({
  allowance,
  candidates,
  picks,
  onChange,
}: {
  allowance: number
  candidates: ItemInstance[]
  picks: string[]
  onChange: (picks: string[]) => void
}) {
  function choose(index: number, value: string): void {
    const next = picks.map((pick, at) => (at === index ? value : pick === value && value !== '' ? '' : pick))
    debugLog('[ui]', 'heirloom picks', { allowance, picks: next })
    onChange(next)
  }
  return (
    <div className="legacy-heirlooms">
      {picks.map((value, index) => (
        <label key={index}>
          {allowance === 1 ? 'Heirloom' : `Heirloom ${index + 1} of ${allowance}`}
          <select aria-label={allowance === 1 ? 'Heirloom' : `Heirloom ${index + 1}`} value={value} onChange={(event) => choose(index, event.target.value)}>
            <option value="">None</option>
            {candidates
              .filter((item) => item.id === value || !picks.includes(item.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {itemName(item)} (item level {item.itemLevel})
                </option>
              ))}
          </select>
        </label>
      ))}
    </div>
  )
}

/** One scannable line of the Legacy preview. Echo ranks collapse into a single range. */
export function gainLines(preview: LegacyPreview): { amount: number; text: string }[] {
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
export function StockTable({ lines, label, nameOf }: { lines: CarryLine[]; label: string; nameOf: (id: string) => string }) {
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
