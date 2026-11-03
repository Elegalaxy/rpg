import { useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  RETREAT_MAX_PERCENT,
  RETREAT_MIN_PERCENT,
  canPickCurse,
  checkPreparation,
  clampToStash,
  draftFor,
  packedCounts,
  quiverLimit,
  stepPacked,
  type PreparationDraft,
} from '../../persist/preparation.ts'
import type { SavedHero } from '../../persist/save.ts'
import { outcomeSummary } from '../../persist/world.ts'
import { CLERIC_VOWS } from '../../sim/classes/cleric.ts'
import { LOOT_CAPACITY, MOMENTUM_CAP, SUPPLY_SLOT_COUNT, type ExpeditionState } from '../../sim/expedition.ts'
import { CURSES } from '../../sim/races/racialNodes.ts'
import { SUPPLIES, supplyName } from '../../content/supplies.ts'
import { Help } from '../Help.tsx'
import { Row } from '../Row.tsx'
import { FightView } from '../combat/FightView.tsx'
import {
  pushOnFromUi,
  returnFromUi,
  savePreparationFromUi,
  settleExpeditionFromUi,
  settleAndRepeatFromUi,
  expeditionWaiting,
  getFinishedFights,
  TRAVEL_SPEEDUP,
  useSaveStatus,
} from '../store.ts'

const VOW_LABELS: { [vow: string]: string } = { zeal: 'Zeal', endurance: 'Endurance', temperance: 'Temperance' }
const CURSE_LABELS: { [curse: string]: string } = {
  'hollow-hunger': 'Hollow Hunger',
  'grave-patience': 'Grave Patience',
  'soul-debt': 'Soul Debt',
}

function PreparationForm({ hero }: { hero: SavedHero }) {
  const [draft, setDraft] = useState<PreparationDraft>(() => {
    const start = draftFor(hero)
    return { ...start, supplies: clampToStash(start.supplies, hero.purse.supplies) }
  })
  const [problems, setProblems] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const checked = checkPreparation(hero, draft)
  const limit = quiverLimit(hero)
  const counts = packedCounts(draft.supplies)
  const packedTotal = draft.supplies.filter((id) => id !== '').length

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
      <div className="controls">
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
        <div className="controls">
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
          <Help label="About vows">Your vow is locked for the whole expedition.</Help>
        </div>
      ) : null}
      {canPickCurse(hero) ? (
        <div className="controls">
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
        <div className="controls">
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
      <div className="controls">
        <label>
          Gold to carry{' '}
          <input
            aria-label="Gold to carry"
            value={draft.carryGold}
            inputMode="numeric"
            size={5}
            onChange={(event) => patch({ carryGold: event.target.value })}
          />
        </label>
        <Help label="About carried gold">The rest of your gold stays deposited and safe. Carried gold pays the rescue fee after a defeat.</Help>
      </div>
      {hero.echoRank > 0 ? (
        <div className="controls">
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
          <Help label="About Echo ranks">
            Choose 0 to {hero.echoRank}. Each rank multiplies the boss HP, Power, Armor, and Resistance by 1.12. A victory unlocks the next rank.
          </Help>
        </div>
      ) : null}
      <fieldset className="supply-pack">
        <legend>Pack for the road</legend>
        <p>
          Backpack: <strong data-testid="pack-used">{packedTotal}</strong> of {SUPPLY_SLOT_COUNT} slots.
        </p>
        <ul className="rows">
          {SUPPLIES.map((supply) => {
            const owned = hero.purse.supplies[supply.id] ?? 0
            const count = counts[supply.id] ?? 0
            return (
              <Row
                key={supply.id}
                actions={
                  <span className="stepper">
                    <button
                      type="button"
                      aria-label={`Pack one fewer ${supply.name}`}
                      disabled={count === 0}
                      onClick={() => patch({ supplies: stepPacked(draft.supplies, supply.id, -1, owned) })}
                    >
                      −
                    </button>
                    <output aria-label={`${supply.name} packed`} data-testid={`pack-${supply.id}`}>
                      {count}
                    </output>
                    <button
                      type="button"
                      aria-label={`Pack one more ${supply.name}`}
                      disabled={packedTotal >= SUPPLY_SLOT_COUNT || count >= owned}
                      onClick={() => patch({ supplies: stepPacked(draft.supplies, supply.id, 1, owned) })}
                    >
                      +
                    </button>
                  </span>
                }
              >
                <strong>{supply.name}</strong> — {supply.effect}
                <small className="row-note">{owned === 0 ? 'None in your stash. Buy some at the Potion Shop.' : `${owned} in your stash.`}</small>
              </Row>
            )
          })}
        </ul>
        {packedTotal > 0 ? (
          <button type="button" onClick={() => patch({ supplies: stepPacked([], '', 1, 0) })}>
            Empty the backpack
          </button>
        ) : null}
      </fieldset>
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

/**
 * The fight area of a run. It follows the live fight, and the same view then stays on the fight that
 * just ended, so the result never snaps away. Chips above it open any earlier fight of the run.
 */
function FightArea({ live }: { live: ExpeditionState['combat'] }) {
  const fights = getFinishedFights()
  const [chosen, setChosen] = useState<number | 'follow'>('follow')
  const latest = fights[fights.length - 1]
  const picked = chosen === 'follow' ? undefined : fights.find((entry) => entry.fight === chosen)
  const showLive = live !== null && picked === undefined
  if (live === null && fights.length === 0) return null
  const shown = picked ?? (showLive ? undefined : latest)
  return (
    <section aria-label="Fights">
      <div className="fight-tabs" role="group" aria-label="Fights of this run">
        {fights.map((entry) => (
          <button
            key={entry.fight}
            type="button"
            className={entry.combat.outcome === 'victory' ? 'btn-good' : 'btn-danger'}
            aria-pressed={shown !== undefined && shown.fight === entry.fight}
            onClick={() => setChosen(entry.fight)}
          >
            Fight {entry.fight}
          </button>
        ))}
        {live !== null ? (
          <button type="button" className="btn-primary" aria-pressed={showLive} onClick={() => setChosen('follow')}>
            Live
          </button>
        ) : null}
      </div>
      {showLive && live !== null ? <FightView combat={live} title={`Fight ${fights.length + 1}`} /> : null}
      {shown !== undefined ? <FightView combat={shown.combat} title={`Fight ${shown.fight}: ${encounterLabel(shown.encounterId)}`} /> : null}
    </section>
  )
}

function encounterLabel(id: string): string {
  return id.replace(/-/g, ' ')
}

function lootLine(stacks: readonly { materialId: string; quantity: number }[]): string {
  return stacks.length === 0 ? 'none' : stacks.map((stack) => `${stack.quantity} ${stack.materialId}`).join(', ')
}

function slotLine(expedition: ExpeditionState): string {
  const held = expedition.supplySlots.flatMap((slot) => (slot === null ? [] : [supplyName(slot.id)]))
  return held.length === 0 ? 'none left' : held.join(', ')
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
        <li data-testid="supplies">
          Supplies: {slotLine(expedition)}.
          {expedition.consumedSupplyIds.length > 0 ? ` Used: ${expedition.consumedSupplyIds.map(supplyName).join(', ')}.` : ''}
        </li>
        <li>Fights finished: {expedition.history.length}.</li>
      </ul>
      {waiting ? (
        <div role="group" aria-label="Push on or return">
          <p>
            The fight is over.
            <Help label="Push on or return">
              Pushing on adds momentum and loot but risks everything you carry. Returning secures what you carry and clears momentum.
            </Help>
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
              : `Walking to the next fight: ${Math.floor(expedition.travelMs / 1000)} of ${Math.floor(expedition.travelGapMs / 1000)} seconds (played ${TRAVEL_SPEEDUP}× faster).`}
        </p>
      )}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}

function Ended({ expedition }: { expedition: ExpeditionState }) {
  const summary = outcomeSummary(expedition)
  const [error, setError] = useState<string | null>(null)
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
      </button>{' '}
      <button type="button" onClick={() => setError(settleAndRepeatFromUi())}>
        Return and run this route again
      </button>
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}

export function ExpeditionPanel() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const expedition = save.expedition
  if (expedition !== null) {
    return (
      <>
        {expedition.outcome === 'ongoing' ? <Running expedition={expedition} /> : <Ended expedition={expedition} />}
        <FightArea live={expedition.combat} />
      </>
    )
  }
  if (hero === null) return null
  return <PreparationForm key={hero.id} hero={hero} />
}
