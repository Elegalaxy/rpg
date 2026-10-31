import { useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  RETREAT_MAX_PERCENT,
  RETREAT_MIN_PERCENT,
  canPickCurse,
  checkPreparation,
  draftFor,
  quiverLimit,
  type PreparationDraft,
} from '../../persist/preparation.ts'
import type { SavedHero } from '../../persist/save.ts'
import { outcomeSummary } from '../../persist/world.ts'
import { CLERIC_VOWS } from '../../sim/classes/cleric.ts'
import { LOOT_CAPACITY, MOMENTUM_CAP, SUPPLY_SLOT_COUNT, type ExpeditionState } from '../../sim/expedition.ts'
import { CURSES } from '../../sim/races/racialNodes.ts'
import { CombatPanel } from '../combat/CombatPanel.tsx'
import { LogPanel } from '../log/LogPanel.tsx'
import {
  pushOnFromUi,
  returnFromUi,
  savePreparationFromUi,
  settleExpeditionFromUi,
  expeditionWaiting,
  useSaveStatus,
} from '../store.ts'

const VOW_LABELS: { [vow: string]: string } = { zeal: 'Zeal', endurance: 'Endurance', temperance: 'Temperance' }
const CURSE_LABELS: { [curse: string]: string } = {
  'hollow-hunger': 'Hollow Hunger',
  'grave-patience': 'Grave Patience',
  'soul-debt': 'Soul Debt',
}

function PreparationForm({ hero }: { hero: SavedHero }) {
  const [draft, setDraft] = useState<PreparationDraft>(() => draftFor(hero))
  const [problems, setProblems] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const checked = checkPreparation(hero, draft)
  const limit = quiverLimit(hero)

  function patch(next: Partial<PreparationDraft>): void {
    setDraft({ ...draft, ...next })
    setSaved(false)
    setProblems([])
  }

  function save(): void {
    const result = savePreparationFromUi(draft)
    setProblems(result)
    setSaved(result.length === 0)
  }

  return (
    <section aria-label="Preparation">
      <h3>Preparation — {hero.name}</h3>
      <div>
        <label>
          Retreat when HP is at most (%){' '}
          <input
            aria-label="Retreat threshold percent"
            value={draft.retreatPercent}
            inputMode="numeric"
            size={4}
            onChange={(event) => patch({ retreatPercent: event.target.value })}
          />
        </label>{' '}
        <small>
          {RETREAT_MIN_PERCENT} to {RETREAT_MAX_PERCENT}. Empty never retreats.
        </small>
      </div>
      {hero.classId === 'cleric' ? (
        <div>
          <label>
            Vow{' '}
            <select aria-label="Vow" value={draft.vow} onChange={(event) => patch({ vow: event.target.value })}>
              {CLERIC_VOWS.map((vow) => (
                <option key={vow} value={vow}>
                  {VOW_LABELS[vow]}
                </option>
              ))}
            </select>
          </label>{' '}
          <small>Locked for the whole expedition.</small>
        </div>
      ) : null}
      {canPickCurse(hero) ? (
        <div>
          <label>
            Curse{' '}
            <select aria-label="Curse" value={draft.curse} onChange={(event) => patch({ curse: event.target.value })}>
              <option value="">None</option>
              {CURSES.map((curse) => (
                <option key={curse} value={curse}>
                  {CURSE_LABELS[curse]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {hero.classId === 'ranger' ? (
        <div>
          <label>
            Special arrows in the quiver{' '}
            <input
              aria-label="Special arrows"
              value={draft.specialAmmo}
              inputMode="numeric"
              size={3}
              onChange={(event) => patch({ specialAmmo: event.target.value })}
            />
          </label>{' '}
          <small>0 to {limit}.</small>
        </div>
      ) : null}
      <div>
        <label>
          Gold to carry{' '}
          <input
            aria-label="Gold to carry"
            value={draft.carryGold}
            inputMode="numeric"
            size={5}
            onChange={(event) => patch({ carryGold: event.target.value })}
          />
        </label>{' '}
        <small>The rest of your gold stays deposited and safe. Carried gold pays the rescue fee after a defeat.</small>
      </div>
      {hero.echoRank > 0 ? (
        <div>
          <label>
            Fractured Warden Echo rank{' '}
            <input
              aria-label="Echo rank"
              value={draft.fightRank}
              inputMode="numeric"
              size={3}
              onChange={(event) => patch({ fightRank: event.target.value })}
            />
          </label>{' '}
          <small>
            0 to {hero.echoRank}. Each rank multiplies the boss HP, Power, Armor, and Resistance by 1.12. A victory unlocks the next rank.
          </small>
        </div>
      ) : null}
      <p>Supplies: {SUPPLY_SLOT_COUNT} slots, all empty. No consumable exists yet.</p>
      <button type="button" disabled={!checked.ok} onClick={save}>
        Save preparation
      </button>
      {!checked.ok ? (
        <ul role="alert" aria-label="Preparation problems">
          {checked.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {problems.length > 0 ? (
        <ul role="alert">
          {problems.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {saved ? <p>Preparation saved.</p> : null}
    </section>
  )
}

function lootLine(stacks: readonly { materialId: string; quantity: number }[]): string {
  return stacks.length === 0 ? 'none' : stacks.map((stack) => `${stack.quantity} ${stack.materialId}`).join(', ')
}

function Running({ expedition }: { expedition: ExpeditionState }) {
  const [error, setError] = useState<string | null>(null)
  const waiting = expeditionWaiting()
  const carried = expedition.unsecured.reduce((sum, stack) => sum + stack.quantity, 0)
  const resource = expedition.hero
  return (
    <section aria-label="Expedition">
      <h3>Expedition</h3>
      <ul>
        <li>
          HP {Math.round(resource.hp)} / {Math.round(resource.maxHp)}.{' '}
          {resource.classResourceId.length > 0
            ? `${resource.classResourceId} ${Math.round(resource.classResource)} / ${resource.classResourceMax}.`
            : ''}
        </li>
        <li data-testid="momentum">
          Momentum {expedition.momentum} of {MOMENTUM_CAP}
        </li>
        <li data-testid="unsecured">
          Unsecured loot ({carried} of {LOOT_CAPACITY}): {lootLine(expedition.unsecured)}. Lost if you are defeated or retreat.
        </li>
        <li>Secured loot: {lootLine(expedition.secured)}.</li>
        <li>Fights finished: {expedition.history.length}.</li>
      </ul>
      {waiting ? (
        <div role="group" aria-label="Push on or return">
          <p>
            The fight is over. Pushing on adds momentum and loot but risks everything you carry. Returning secures what you
            carry and clears momentum.
          </p>
          <button type="button" onClick={pushOnFromUi}>
            Push on
          </button>{' '}
          <button type="button" onClick={() => setError(returnFromUi())}>
            Return to town
          </button>
        </div>
      ) : (
        <p data-testid="travel-status">
          {expedition.phase === 'combat'
            ? `Fight ${expedition.encounterIndex + 1} is under way.`
            : expedition.returning
              ? 'Walking back to Greyhaven.'
              : `Walking to the next fight: ${Math.floor(expedition.travelMs / 1000)} of ${Math.floor(expedition.travelGapMs / 1000)} seconds.`}
        </p>
      )}
      {error !== null ? <p role="alert">{error}</p> : null}
      {expedition.combat !== null ? (
        <>
          <CombatPanel combat={expedition.combat} queueError={null} />
          <LogPanel log={expedition.combat.log} />
        </>
      ) : null}
    </section>
  )
}

function Ended({ expedition }: { expedition: ExpeditionState }) {
  const summary = outcomeSummary(expedition)
  return (
    <section aria-label="Expedition outcome">
      <h3 data-testid="expedition-ended">{summary.title}</h3>
      <ul>
        {summary.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button type="button" onClick={settleExpeditionFromUi}>
        Return to town
      </button>
    </section>
  )
}

export function ExpeditionPanel() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const expedition = save.expedition
  if (expedition !== null) {
    return expedition.outcome === 'ongoing' ? <Running expedition={expedition} /> : <Ended expedition={expedition} />
  }
  if (hero === null) return null
  return <PreparationForm key={hero.id} hero={hero} />
}
