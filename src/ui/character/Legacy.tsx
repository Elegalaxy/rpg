import { useState } from 'react'

import { itemName } from '../../content/items.ts'
import { DEEP_POCKETS_COST, DEEP_POCKETS_ROOM } from '../../persist/bag.ts'
import { selectedHero } from '../../persist/character.ts'
import {
  ATTRIBUTE_SEED_COST,
  ATTRIBUTE_SEED_MAX,
  HEAD_START_LEVELS,
  MASTERY_MAX,
  SECOND_HEIRLOOM_COST,
  SKILL_SEED_COSTS,
  attributeSeedTotal,
  headStartCost,
  heirloomAllowance,
  legacyPreview,
  masteryRank,
  nextLifePreview,
  bossFaced,
  reincarnationBlock,
  skillSeedCost,
} from '../../persist/reincarnation.ts'
import { purseOf, type SavedHero } from '../../persist/save.ts'
import { EQUIPMENT_SLOT_IDS } from '../../sim/economy.ts'
import { Help } from '../Help.tsx'
import { GuideLink } from '../guide/GuideLink.tsx'
import { Kpi, KpiRow } from '../Kit.tsx'
import { buyPurchaseFromUi, devLegacyTools, reincarnateFromUi, useSaveStatus } from '../store.ts'

const ATTRIBUTES = ['strength', 'vitality', 'agility', 'intellect', 'spirit'] as const

type PurchaseRow = {
  id: string
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
  const running = save.expedition !== null
  const rank = masteryRank(hero)
  const candidates = [
    ...EQUIPMENT_SLOT_IDS.flatMap((slot) => (hero.equipment[slot] === null ? [] : [hero.equipment[slot]!])),
    ...purseOf(save).archive.filter((item) => item.heirloom === undefined || item.heirloom.heroId === hero.id),
  ]

  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }

  const headStart = headStartCost(hero.purchases)
  const rows: PurchaseRow[] = [
    {
      id: 'attribute',
      name: 'Attribute Seed',
      effect: '+1 to a starting attribute of your choice',
      cost: attributeSeedTotal(hero.purchases) >= ATTRIBUTE_SEED_MAX ? null : ATTRIBUTE_SEED_COST,
      bought: `${attributeSeedTotal(hero.purchases)} of ${ATTRIBUTE_SEED_MAX}`,
      controls: 'attributes',
      buy: () => null,
      done: '',
    },
    {
      id: 'skill',
      name: 'Skill Point Seed',
      effect: '+1 unspent skill point at the start of each life',
      cost: skillSeedCost(hero.purchases),
      bought: `${hero.purchases.skillSeeds} of ${SKILL_SEED_COSTS.length}`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('skill'),
      done: 'Bought a skill point seed.',
    },
    {
      id: 'headStart',
      name: hero.purchases.headStart === 0 ? 'Head Start I' : hero.purchases.headStart === 1 ? 'Head Start II' : 'Head Start',
      effect: `Every life starts at level ${HEAD_START_LEVELS[Math.min(hero.purchases.headStart, HEAD_START_LEVELS.length - 1)]}`,
      cost: headStart,
      bought: `${hero.purchases.headStart} of ${HEAD_START_LEVELS.length}`,
      controls: 'single',
      buy: () => buyPurchaseFromUi('headStart'),
      done: 'Bought a Head Start.',
    },
    {
      id: 'heirloom',
      name: 'Second Heirloom',
      effect: 'Keep one more heirloom',
      cost: hero.purchases.secondHeirloom ? null : SECOND_HEIRLOOM_COST,
      bought: hero.purchases.secondHeirloom ? '1 of 1' : '0 of 1',
      controls: 'single',
      buy: () => buyPurchaseFromUi('heirloom'),
      done: 'Bought the Second Heirloom.',
    },
    {
      id: 'pockets',
      name: 'Deep Pockets',
      effect: `+${DEEP_POCKETS_ROOM} loot bag room`,
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
      <table className="away-table legacy-table" aria-label="Legacy purchases">
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
          {rows.map((row) => {
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
                          onClick={() => run(buyPurchaseFromUi('attribute', attribute), `Bought a ${attribute} seed.`)}
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
          <dd data-testid="next-zones">{next.zones.length === 0 ? 'None yet. Defeat a zone elite.' : next.zones.join(', ')}</dd>
        </div>
      </dl>

      <h3>
        Reincarnate
        <Help label="What reincarnating resets">
          Reincarnating resets level, XP, attributes, the skill web, this hero's world progress and Echo ranks, and this hero's contracts. Mastery, purchases,
          Legacy, discoveries, recipes, crafting, and this hero's gold, materials, and archive stay. Your worn gear goes to the archive. The elites you beat are
          remembered, so the zones they guard stay open.
        </Help>
        <GuideLink id="topic-reincarnation" label="Reincarnation" />
      </h3>
      <p data-testid="boss-faced">{bossFacedText(bossFaced(hero))}</p>
      {block !== null ? (
        <p data-testid="reincarnation-block">{block}</p>
      ) : (
        <div>
          <p data-testid="legacy-preview">
            You would gain {preview.total} Legacy: {preview.fromLevel} from level and XP
            {preview.bonuses.map((bonus) => `, ${bonus.amount} for ${bonus.text.toLowerCase()}`).join('')}.
          </p>
          <label>
            Heirloom (up to {heirloomAllowance(hero)}){' '}
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
            <div role="dialog" aria-label="Confirm reincarnation">
              <p>This cannot be undone. Reincarnate {hero.name}?</p>
              <button
                type="button"
                onClick={() => {
                  run(reincarnateFromUi(heirloom === '' ? null : heirloom), `${hero.name} was reincarnated.`)
                  setConfirming(false)
                }}
              >
                Confirm
              </button>{' '}
              <button type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)}>
              Reincarnate…
            </button>
          )}
        </div>
      )}
      {message !== null ? <p data-testid="legacy-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}

function bossFacedText(faced: ReturnType<typeof bossFaced>): string {
  if (faced === 'lost') return 'Boss faced this life: lost to the Fractured Warden.'
  if (faced === 'won') return 'Boss faced this life: defeated the Fractured Warden.'
  if (faced === 'both') return 'Boss faced this life: lost to and defeated the Fractured Warden.'
  return 'Not yet: face the Fractured Warden. A loss or a victory both count.'
}
