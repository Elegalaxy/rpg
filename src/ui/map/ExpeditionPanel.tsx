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
import { routes } from '../../content/world.ts'
import { countNames } from '../town/groupItems.ts'
import { outcomeStats } from '../../persist/world.ts'
import { CLERIC_VOWS } from '../../sim/classes/cleric.ts'
import { LOOT_CAPACITY, MOMENTUM_CAP, SUPPLY_SLOT_COUNT, type ExpeditionState } from '../../sim/expedition.ts'
import { CURSES } from '../../sim/races/racialNodes.ts'
import { SUPPLIES, supplyName } from '../../content/supplies.ts'
import { Help } from '../Help.tsx'
import { DurabilityGrid, Kpi, KpiRow, Tag } from '../Kit.tsx'
import { Row } from '../Row.tsx'
import { FightView } from '../combat/FightView.tsx'
import {
  pushOnFromUi,
  returnFromUi,
  setAutoEscapeFromUi,
  savePreparationFromUi,
  settleExpeditionFromUi,
  settleAndRepeatFromUi,
  expeditionWaiting,
  getDiscoveryNotices,
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
      <fieldset className="away-box">
        <legend>While you are away</legend>
        <p className="muted">
          Your run keeps going when you close the page or hide the tab, for up to 8 hours. These two settings decide what the hero does between fights while
          you are not watching.
        </p>
        <div className="controls">
          <label>
            Push on while HP is at least (%){' '}
            <input
              aria-label="Push on percent"
              value={draft.pushOnPercent}
              inputMode="numeric"
              size={4}
              onChange={(event) => patch({ pushOnPercent: event.target.value })}
            />
          </label>
        </div>
        <div className="controls">
          <label>
            Start a run when I leave{' '}
            <select aria-label="Away route" value={draft.awayRouteId} onChange={(event) => patch({ awayRouteId: event.target.value })}>
              <option value="">Never (only continue a run I started)</option>
              {Object.values(routes).map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                  {route.nodeIds.every((id) => id === 'greyhaven' || hero.clearedNodeIds.includes(id)) ? '' : ' (not cleared yet)'}
                </option>
              ))}
            </select>
          </label>
          <Help label="About starting while away">
            If you have no run when you close the page or hide the tab (for at least 5 seconds), the hero starts this route on its own, using the packed
            supplies and carried gold below. The route must be one the hero has cleared.
          </Help>
        </div>
        <div className="controls">
          <label>
            <input type="checkbox" checked={draft.repeatRoute} onChange={(event) => patch({ repeatRoute: event.target.checked })} />
            Run a cleared route again
          </label>
        </div>
        <p data-testid="away-plan">
          <strong>What will happen:</strong>{' '}
          {draft.awayRouteId === ''
            ? 'If you have no run when you leave, nothing starts. If a run is out, after each fight'
            : `If you have no run when you leave, the hero starts ${routes[draft.awayRouteId]?.name ?? 'that route'}. After each fight`}{' '} the hero {draft.pushOnPercent.trim() === '' ? 'pushes on' : `pushes on if HP is at least ${draft.pushOnPercent}%`}{' '}
          and the bag has room, otherwise walks home.{' '}
          {draft.repeatRoute
            ? 'Back in town it runs the same route again, repacking your chosen supplies from the stash, as long as every node of the route is cleared.'
            : 'Back in town it stops and waits for you.'}
        </p>
        <ul className="away-facts">
          <li>Your retreat setting still applies in every fight.</li>
          <li>It stops for good on a defeat, when the packed supplies run out, or after 8 hours.</li>
          <li>Fights won while away give half the loot and gold. XP, contracts and discoveries are not reduced.</li>
          <li>Only the selected hero runs. Other heroes rest, but every hero keeps crafting.</li>
        </ul>
      </fieldset>
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

const SLOT_LABELS: { [slot: string]: string } = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  feet: 'Feet',
  accessory0: 'Accessory 1',
  accessory1: 'Accessory 2',
}

function lootPills(stacks: readonly { materialId: string; quantity: number }[], empty: string) {
  if (stacks.length === 0) return <span className="muted-inline">{empty}</span>
  return (
    <>
      {stacks.map((stack) => (
        <Tag key={stack.materialId} kind="mat">
          {stack.quantity} {stack.materialId}
        </Tag>
      ))}
    </>
  )
}

function DiscoveredLine() {
  const found = getDiscoveryNotices()
  if (found.length === 0) return null
  return (
    <div className="pill-line" data-testid="discovered">
      <small className="pill-label">Discovered</small>
      <span className="pill-row">
        {found.map((name) => (
          <Tag key={name} kind="good">
            {name}
          </Tag>
        ))}
      </span>
    </div>
  )
}

function Running({ expedition }: { expedition: ExpeditionState }) {
  const [error, setError] = useState<string | null>(null)
  const waiting = expeditionWaiting()
  const carried = expedition.unsecured.reduce((sum, stack) => sum + stack.quantity, 0)
  const resource = expedition.hero
  const hpFraction = resource.maxHp > 0 ? resource.hp / resource.maxHp : 0
  // During a fight the carried supplies change at once; the run's own slots catch up when the fight ends.
  const fight = expedition.combat
  const held = fight !== null ? fight.hero.supplies.map(supplyName) : expedition.supplySlots.flatMap((slot) => (slot === null ? [] : [supplyName(slot.id)]))
  const usedNow = fight === null ? [] : fight.log.flatMap((event) => (event.type === 'supplyUse' && event.actorId === fight.hero.id ? [event.supplyId] : []))
  const usedIds = [...expedition.consumedSupplyIds, ...usedNow]
  return (
    <section aria-label="Expedition">
      <h3>Expedition</h3>
      {waiting ? (
        <div className="callout" role="group" aria-label="Push on or return">
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
        <p className="callout" data-testid="travel-status">
          {expedition.phase === 'combat'
            ? `Fight ${expedition.encounterIndex + 1} is under way.`
            : expedition.returning
              ? 'Walking back to Greyhaven.'
              : `Walking to the next fight: ${Math.floor(expedition.travelMs / 1000)} of ${Math.floor(expedition.travelGapMs / 1000)} seconds (played ${TRAVEL_SPEEDUP}× faster).`}
        </p>
      )}
      {expedition.retreatThresholds.length > 0 && expedition.outcome === 'ongoing' ? (
        <p>
          <button
            type="button"
            aria-pressed={expedition.autoEscapeOff !== true}
            onClick={() => setAutoEscapeFromUi(expedition.autoEscapeOff === true)}
          >
            Auto-escape: {expedition.autoEscapeOff === true ? 'Off' : 'On'}
          </button>
          <Help label="About auto-escape">
            When on, the hero tries to escape once HP falls to your retreat setting. Switch it off to fight on; it also stops a pending retry.
          </Help>
        </p>
      ) : null}
      <KpiRow label="Run status">
        <Kpi label="HP" value={`${Math.round(resource.hp)}/${Math.round(resource.maxHp)}`} tone={hpFraction < 0.4 ? 'bad' : hpFraction < 0.7 ? 'warn' : 'good'} />
        {resource.classResourceId.length > 0 ? (
          <Kpi label={resource.classResourceId} value={`${Math.round(resource.classResource)}/${resource.classResourceMax}`} />
        ) : null}
        <Kpi label="Momentum" value={`${expedition.momentum}/${MOMENTUM_CAP}`} testId="momentum" />
        <Kpi label="Fights won" value={expedition.history.filter((entry) => entry.outcome === 'victory').length} />
        <Kpi label="Loot bag" value={`${carried}/${LOOT_CAPACITY}`} testId="loot-bag" />
      </KpiRow>
      <div className="pill-lines">
        <div className="pill-line" data-testid="unsecured" title="Lost if you are defeated or retreat">
          <small className="pill-label">Carrying</small>
          <span className="pill-row">{lootPills(expedition.unsecured, 'nothing yet')}</span>
        </div>
        <div className="pill-line">
          <small className="pill-label">Secured</small>
          <span className="pill-row">{lootPills(expedition.secured, 'nothing yet')}</span>
        </div>
        <div className="pill-line" data-testid="supplies">
          <small className="pill-label">Supplies</small>
          <span className="pill-row">
            {held.length === 0 ? <span className="muted-inline">none left</span> : null}
            {countNames(held).map(([name, count]) => (
              <Tag key={name} kind="plain">
                {name}
                {count > 1 ? ` ×${count}` : ''}
              </Tag>
            ))}
            {countNames(usedIds.map(supplyName)).map(([name, count]) => (
              <Tag key={`used-${name}`} kind="bad" title="Used up">
                {name}
                {count > 1 ? ` ×${count}` : ''} used
              </Tag>
            ))}
          </span>
        </div>
        <DiscoveredLine />
      </div>
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}

function Ended({ expedition }: { expedition: ExpeditionState }) {
  const stats = outcomeStats(expedition)
  const [error, setError] = useState<string | null>(null)
  const defeated = expedition.outcome === 'defeat'
  const lootTotal = stats.secured.reduce((sum, stack) => sum + stack.quantity, 0)
  const notes: string[] = []
  for (const rank of stats.bossRanks) notes.push(`The Fractured Warden fell at Echo rank ${rank}. Echo rank ${rank + 1} is unlocked.`)
  if (stats.retreatedIn !== null) notes.push(`You retreated in fight ${stats.retreatedIn}. That fight gave no loot or momentum.`)
  if (defeated) notes.push(stats.defeatedIn === null ? 'You were defeated.' : `You were defeated in fight ${stats.defeatedIn}. Unsecured loot was destroyed.`)
  if (stats.bossLoss) notes.push('A boss defeated you this life. You can now reincarnate.')
  return (
    <section aria-label="Expedition outcome">
      <h3 data-testid="expedition-ended">{stats.title}</h3>
      <KpiRow label="Outcome">
        <Kpi label="Fights won" value={stats.fightsWon} />
        <Kpi label="XP earned" value={stats.xp} tone={stats.xp > 0 ? 'good' : undefined} />
        {defeated ? (
          <>
            <Kpi label="Rescue fee" value={`${stats.rescueFee} g`} tone="bad" note={`${stats.carriedGold} g left · debt ${stats.debt}`} />
            <Kpi label="Recovery" value={`${stats.recoveryMinutes} min`} tone="warn" />
          </>
        ) : (
          <>
            <Kpi label="Gold home" value={`${stats.carriedGold} g`} tone="good" />
            <Kpi label="Loot secured" value={lootTotal} />
          </>
        )}
      </KpiRow>
      <div className="pill-lines">
        <div className="pill-line">
          <small className="pill-label">{defeated ? 'Kept' : 'Secured'}</small>
          <span className="pill-row">
            {lootPills(stats.secured, 'nothing')}
            {stats.overflow > 0 ? (
              <Tag kind="bad" title="Did not fit in the bag">
                {stats.overflow} lost
              </Tag>
            ) : null}
          </span>
        </div>
        <DiscoveredLine />
      </div>
      {defeated ? (
        <>
          <h4>Gear after the fall</h4>
          <DurabilityGrid
            label="Gear wear"
            pieces={stats.gear.map((piece) => ({
              label: SLOT_LABELS[piece.slot] ?? piece.slot,
              durability: piece.durability,
              max: piece.maxDurability,
              disabled: piece.disabled,
            }))}
          />
        </>
      ) : null}
      {notes.map((note) => (
        <p key={note} className="muted">
          {note}
        </p>
      ))}
      <div className="button-row">
        <button type="button" className="btn-primary" onClick={settleExpeditionFromUi}>
          Return to town
        </button>
        <button type="button" onClick={() => setError(settleAndRepeatFromUi())}>
          Return and run this route again
        </button>
      </div>
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
