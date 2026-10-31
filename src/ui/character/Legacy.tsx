import { useState } from 'react'

import { itemName } from '../../content/items.ts'
import { selectedHero } from '../../persist/character.ts'
import {
  ATTRIBUTE_SEED_COST,
  ATTRIBUTE_SEED_MAX,
  MASTERY_MAX,
  SECOND_HEIRLOOM_COST,
  attributeSeedTotal,
  heirloomAllowance,
  legacyPreview,
  masteryRank,
  reincarnationBlock,
  skillSeedCost,
} from '../../persist/reincarnation.ts'
import { EQUIPMENT_SLOT_IDS } from '../../sim/economy.ts'
import { buyPurchaseFromUi, devLegacyTools, reincarnateFromUi, useSaveStatus } from '../store.ts'

const ATTRIBUTES = ['strength', 'vitality', 'agility', 'intellect', 'spirit'] as const

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
  const skillCost = skillSeedCost(hero.purchases)
  const candidates = [
    ...EQUIPMENT_SLOT_IDS.flatMap((slot) => (hero.equipment[slot] === null ? [] : [hero.equipment[slot]!])),
    ...save.account.archive.filter((item) => item.heirloom === undefined || item.heirloom.heroId === hero.id),
  ]

  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }

  return (
    <section aria-label="Legacy">
      <h2>Legacy — {hero.name}</h2>
      <p>
        Legacy: <strong data-testid="legacy">{hero.legacy}</strong>. Lives completed: {hero.lives}. Mastery rank:{' '}
        <strong data-testid="mastery">{masteryRank(hero)}</strong> of {MASTERY_MAX} (+{masteryRank(hero) * 2}% ordinary XP).
        {import.meta.env.DEV ? (
          <>
            {' '}
            <button type="button" onClick={() => devLegacyTools('bossLoss')}>
              Dev: mark a boss loss
            </button>{' '}
            <button type="button" onClick={() => devLegacyTools('legacy')}>
              Dev: +40 Legacy
            </button>
          </>
        ) : null}
      </p>

      <h3>Purchases</h3>
      <ul>
        <li>
          Attribute Seed ({ATTRIBUTE_SEED_COST} Legacy each, {attributeSeedTotal(hero.purchases)} of {ATTRIBUTE_SEED_MAX} bought):{' '}
          {ATTRIBUTES.map((attribute) => (
            <button key={attribute} type="button" aria-label={`Buy ${attribute} seed`} onClick={() => run(buyPurchaseFromUi('attribute', attribute), `Bought a ${attribute} seed.`)}>
              +1 {attribute} ({hero.purchases.attributeSeeds[attribute]})
            </button>
          ))}
        </li>
        <li>
          Skill Point Seed ({hero.purchases.skillSeeds} of 3 bought, next {skillCost === null ? 'none' : `${skillCost} Legacy`}){' '}
          <button type="button" disabled={skillCost === null} onClick={() => run(buyPurchaseFromUi('skill'), 'Bought a skill point seed.')}>
            Buy
          </button>
        </li>
        <li>
          Second Heirloom ({SECOND_HEIRLOOM_COST} Legacy, {hero.purchases.secondHeirloom ? 'bought' : 'not bought'}){' '}
          <button type="button" disabled={hero.purchases.secondHeirloom} onClick={() => run(buyPurchaseFromUi('heirloom'), 'Bought the Second Heirloom.')}>
            Buy
          </button>
        </li>
      </ul>

      <h3>Reincarnate</h3>
      {block !== null ? (
        <p data-testid="reincarnation-block">{block}</p>
      ) : (
        <div>
          <p>
            Reincarnating resets level, XP, attributes, the skill web, this hero's world progress and Echo ranks, and the account's contracts. Mastery, purchases,
            Legacy, discoveries, recipes, crafting, gold, materials, and the archive stay. Your worn gear goes to the archive.
          </p>
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
