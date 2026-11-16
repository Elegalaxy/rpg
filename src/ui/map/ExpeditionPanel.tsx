import { useEffect, useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  AUTO_RUN_MAX,
  AUTO_RUN_MIN,
  STOP_AFTER_MAX,
  STOP_AFTER_MIN,
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
import { REPEAT_LIMITS, type SavedHero } from '../../persist/save.ts'
import { routes } from '../../content/world.ts'
import { supplyLock } from '../../persist/crafting.ts'
import { countNames } from '../town/groupItems.ts'
import { outcomeStats } from '../../persist/world.ts'
import { pendingContractProgress } from '../../persist/contracts.ts'
import { CLERIC_VOWS } from '../../sim/classes/cleric.ts'
import { MOMENTUM_CAP, SUPPLY_SLOT_COUNT, bagIsFull, hpRegenRate, lootCapacityOf, safePouch, type ExpeditionState } from '../../sim/expedition.ts'
import { CURSES } from '../../sim/races/racialNodes.ts'
import { SUPPLIES, supplyName } from '../../content/supplies.ts'
import { Collapsible } from '../Collapsible.tsx'
import { Help } from '../Help.tsx'
import { HoldActions } from '../HoldActions.tsx'
import { DurabilityGrid, Kpi, KpiRow, Tag } from '../Kit.tsx'
import { Row } from '../Row.tsx'
import { FightView } from '../combat/FightView.tsx'
import {
  escapeNowFromUi,
  setAutoEscapeFromUi,
  setAutoRunFromUi,
  getAutoFights,
  getAutoNotice,
  savePreparationFromUi,
  setPreparationProblem,
  settleExpeditionFromUi,
  settleAndRepeatFromUi,
  expeditionWaiting,
  getDiscoveryNotices,
  getFinishedFights,
  travelSpeedup,
  useSaveStatus,
} from '../store.ts'

const VOW_LABELS: { [vow: string]: string } = { zeal: 'Zeal', endurance: 'Endurance', temperance: 'Temperance' }
const CURSE_LABELS: { [curse: string]: string } = {
  'hollow-hunger': 'Hollow Hunger',
  'grave-patience': 'Grave Patience',
  'soul-debt': 'Soul Debt',
}

function PreparationForm({ hero }: { hero: SavedHero }) {
  const status = useSaveStatus()
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

  // Every change is saved as soon as it is valid, so Start never runs on stale settings. A draft that is not valid yet blocks Start.
  useEffect(() => () => setPreparationProblem(null), [])

  function patch(next: Partial<PreparationDraft>): void {
    const changed = { ...draft, ...next }
    setDraft(changed)
    const check = checkPreparation(hero, changed)
    if (!check.ok) {
      setSaved(false)
      setProblems([])
      setPreparationProblem('Unsaved changes: fix the preparation first (see the problems listed).')
      return
    }
    const refused = savePreparationFromUi(changed)
    setProblems(refused)
    setSaved(refused.length === 0)
    setPreparationProblem(refused.length === 0 ? null : 'Unsaved changes: the preparation was refused.')
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
        <Help label="About carried gold">
          The rest of your gold stays deposited and safe. Carried gold pays the rescue fee after a defeat. While a run is out your purse shows 0: the run panel
          lists what you carry and what is banked.
        </Help>
      </div>
      <fieldset className="away-box" data-testid="auto-run-box">
        <legend>Auto run</legend>
        {getAutoNotice() === null ? null : (
          <p className="muted" role="status" data-testid="auto-run-notice">
            {getAutoNotice()}
          </p>
        )}
        <div className="controls">
          <label>
            <input type="checkbox" aria-label="Auto run" checked={draft.autoRun === true} onChange={(event) => patch({ autoRun: event.target.checked })} />
            Auto run: keeps pushing on and reruns this route
          </label>
          <label>
            Stop after total fights{' '}
            <input
              aria-label="Auto run fight limit"
              value={draft.autoRunMaxFights ?? ''}
              inputMode="numeric"
              size={5}
              placeholder="No limit"
              onChange={(event) => patch({ autoRunMaxFights: event.target.value })}
            />
          </label>
          <Help label="About Auto run">
            While on, the hero decides after each fight the way it does while you are away: it walks home when the fight limit or the push-on HP below is reached or
            the bag is nearly full (or waits, if the bag order below says so), otherwise it pushes on. When a run ends safely, the same route starts again by itself,
            on any route you can start (cleared or not). A defeat, a refused start or a missing supply stops it. The total fight limit ({AUTO_RUN_MIN} to {AUTO_RUN_MAX}, empty for none) counts fights since
            Auto run was switched on, over repeated runs; at the limit the hero walks home and Auto run switches itself off. You can switch it off at any moment.
          </Help>
        </div>
      </fieldset>
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
            Stop after fights{' '}
            <input
              aria-label="Stop after fights"
              value={draft.stopAfterFights ?? ''}
              inputMode="numeric"
              size={4}
              placeholder="No limit"
              onChange={(event) => patch({ stopAfterFights: event.target.value })}
            />
          </label>
          <Help label="About the fight limit">
            {STOP_AFTER_MIN} to {STOP_AFTER_MAX}. Empty means no limit. After this many fights in one run the hero walks home and secures the loot instead of pushing on. It also
            applies while you watch. A repeated run starts counting again.
          </Help>
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
            When the bag is nearly full{' '}
            <select aria-label="Bag full order" value={draft.bagFullOrder} onChange={(event) => patch({ bagFullOrder: event.target.value === 'ask' ? 'ask' : event.target.value === 'keep' ? 'keep' : 'home' })}>
              <option value="home">Walk home</option>
              <option value="ask">Hold and wait for me</option>
              <option value="keep">Keep going (loot that does not fit is lost)</option>
            </select>
          </label>
          <Help label="About a full bag">
            The bag counts as full when fewer than 4 room is free. Walk home returns and secures the loot. Hold and wait stops the run at that point, also while you
            are away, until you come back and choose. Keep going ignores a full bag and pushes on: gold, XP and momentum still count, but loot that does not fit is lost.
          </Help>
        </div>
        <div className="controls">
          <label>
            <input type="checkbox" checked={draft.repeatRoute} onChange={(event) => patch({ repeatRoute: event.target.checked })} />
            Run a cleared route again
          </label>
          <label>
            Run limit{' '}
            <select aria-label="Run limit" value={draft.repeatLimit} onChange={(event) => patch({ repeatLimit: Number(event.target.value) })}>
              {REPEAT_LIMITS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit === 0 ? 'No limit' : `${limit} ${limit === 1 ? 'run' : 'runs'}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p data-testid="away-plan">
          <strong>What will happen:</strong>{' '}
          {draft.awayRouteId === ''
            ? 'If you have no run when you leave, nothing starts. If a run is out, after each fight'
            : `If you have no run when you leave, the hero starts ${routes[draft.awayRouteId]?.name ?? 'that route'}. After each fight`}{' '} the hero {draft.pushOnPercent.trim() === '' ? 'pushes on' : `pushes on if HP is at least ${draft.pushOnPercent}%`}{' '}
          {draft.bagFullOrder === 'keep' ? '' : 'and the bag is not nearly full, '}otherwise {draft.bagFullOrder === 'ask' ? 'waits for you with the run held' : 'walks home'}.{' '}
          {(draft.stopAfterFights ?? '').trim() === '' ? '' : `A run walks home after ${draft.stopAfterFights?.trim()} fights. `}
          {draft.repeatRoute
            ? 'Back in town it runs the same route again, repacking your chosen supplies from the stash, as long as every node of the route is cleared.'
            : 'Back in town it stops and waits for you.'}
        </p>
        <ul className="away-facts">
          <li>Your retreat setting still applies in every fight.</li>
          <li>It stops for good on a defeat, when the packed supplies run out, or after 8 hours.</li>
          <li>Fights won while away give half the loot and gold. XP, contracts and discoveries are not reduced.</li>
          <li>Heroes you did not select run their own away route too, and heroes without one rest. Every hero keeps crafting.</li>
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
          {SUPPLIES.filter((supply) => (hero.purse.supplies[supply.id] ?? 0) > 0 || supplyLock(status.save, supply.id) === null).map((supply) => {
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
                <small className="row-note">{owned === 0 ? (supply.price === null ? 'None in your stash. Brew some at the Potion Shop.' : 'None in your stash. Buy some at the Potion Shop.') : `${owned} in your stash.`}</small>
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
      <p className="prep-status" role="status" data-testid="prep-status">
        {!checked.ok ? <Tag kind="bad">Unsaved changes. Start is blocked until the problems above are fixed.</Tag> : saved ? 'Preparation saved. Changes save automatically.' : 'Changes save automatically.'}
      </p>
    </section>
  )
}

/**
 * The fight area of a run. It follows the live fight, and the same view then stays on the fight that
 * just ended, so the result never snaps away. Chips above it open any earlier fight of the run.
 */
function FightArea({ live, escapePending, expedition }: { live: ExpeditionState['combat']; escapePending: boolean; expedition: ExpeditionState }) {
  const fights = getFinishedFights()
  // Fights played while the page was closed have no kept log. Their chips say so instead of vanishing.
  const unplayed = expedition.history.filter((entry) => !fights.some((fight) => fight.fight === entry.index + 1))
  const retreatedFights = new Set(expedition.history.filter((entry) => entry.outcome === 'retreat').map((entry) => entry.index + 1))
  const [chosen, setChosen] = useState<number | 'follow'>('follow')
  const latest = fights[fights.length - 1]
  const picked = chosen === 'follow' ? undefined : fights.find((entry) => entry.fight === chosen)
  const showLive = live !== null && picked === undefined
  if (live === null && fights.length === 0 && unplayed.length === 0) return null
  const shown = picked ?? (showLive ? undefined : latest)
  return (
    <section aria-label="Fights">
      <div className="fight-tabs" role="group" aria-label="Fights of this run">
        {unplayed.map((entry) => (
          <button
            key={`away-${entry.index}`}
            type="button"
            className={entry.outcome === 'victory' ? 'btn-good' : 'btn-danger'}
            disabled
            title="This fight was played on an AFK run, so there is no log to replay."
          >
            Fight {entry.index + 1} · AFK run{entry.outcome === 'retreat' ? ' · ↩ Escaped' : ''}
          </button>
        ))}
        {fights.map((entry) => (
          <button
            key={entry.fight}
            type="button"
            className={entry.combat.outcome === 'victory' ? 'btn-good' : 'btn-danger'}
            aria-pressed={shown !== undefined && shown.fight === entry.fight}
            onClick={() => setChosen(entry.fight)}
          >
            Fight {entry.fight}
            {retreatedFights.has(entry.fight) ? ' · ↩ Escaped' : ''}
          </button>
        ))}
        {live !== null ? (
          <button type="button" className="btn-primary" aria-pressed={showLive} onClick={() => setChosen('follow')}>
            Live
          </button>
        ) : null}
      </div>
      {showLive && live !== null ? (
        <FightView
          combat={live}
          title={`Fight ${expedition.encounterIndex + 1}`}
          onEscapeNow={escapeNowFromUi}
          escapePending={escapePending}
        />
      ) : null}
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

/** The pinned strip of a run: what is happening, Push on / Return, and Auto-escape. It stays in view while the fight scrolls. */
function RunBar({ expedition }: { expedition: ExpeditionState }) {
  const waiting = expeditionWaiting()
  const { save } = useSaveStatus()
  const limit = selectedHero(save)?.stopAfterFights ?? null
  // The fight being fought or walked to; between fights and on the way home it is the fight that just ended.
  const fightNumber = Math.min(expedition.history.length + (waiting || expedition.returning ? 0 : 1), limit ?? 0)
  const hero = selectedHero(save)
  const autoOn = hero?.autoRun === true
  const autoMax = hero?.autoRunMaxFights ?? null
  const autoFights = getAutoFights()
  return (
    <div className="run-bar" role="group" aria-label="Run controls">
      <div className="run-bar-status">
        {waiting ? (
          <p className="run-bar-text" data-testid="travel-status">
            <strong>The fight is over.</strong>
            <Help label="Push on or return">
              Pushing on adds momentum and loot but risks everything you carry. Returning secures what you carry and clears momentum.
            </Help>
          </p>
        ) : (
          <p className="run-bar-text" data-testid="travel-status">
            {expedition.phase === 'combat'
              ? `Fight ${expedition.encounterIndex + 1} is under way.`
              : expedition.returning
                ? 'Walking back to Greyhaven.'
                : `Walking to the next fight: ${Math.floor(expedition.travelMs / 1000)} of ${Math.floor(expedition.travelGapMs / 1000)} s (${travelSpeedup()}× faster).`}
          </p>
        )}
      </div>
      {limit === null ? null : (
        <p className="run-bar-limit" data-testid="fight-limit">
          Fight {fightNumber} / {limit}
        </p>
      )}
      {autoOn ? (
        <p className="run-bar-limit" data-testid="auto-run-status">
          {autoMax === null ? 'Auto run on' : `Auto run: fight ${Math.min(autoFights, autoMax)} / ${autoMax}`}
        </p>
      ) : null}
      <div className="run-bar-actions">
        <HoldActions waiting={waiting} whyDisabled="Available once the fight is over." />
        {expedition.outcome === 'ongoing' ? (
          <span className="run-bar-escape">
            <button type="button" data-testid="auto-run-toggle" aria-pressed={autoOn} onClick={() => setAutoRunFromUi(!autoOn)}>
              Auto run: {autoOn ? 'On' : 'Off'}
            </button>
            <Help label="About Auto run">
              When on, the hero pushes on or walks home after each fight by your standing orders, and reruns this route after each safe return. Switch it off to take over; Push on and Return
              always work.
            </Help>
          </span>
        ) : null}
        {expedition.retreatThresholds.length > 0 && expedition.outcome === 'ongoing' ? (
          <span className="run-bar-escape">
            <button type="button" aria-pressed={expedition.autoEscapeOff !== true} onClick={() => setAutoEscapeFromUi(expedition.autoEscapeOff === true)}>
              Auto-escape: {expedition.autoEscapeOff === true ? 'Off' : 'On'}
            </button>
            <Help label="About auto-escape">
              When on, the hero tries to escape once HP falls to your retreat setting. Switch it off to fight on; it also stops a pending retry.
            </Help>
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** One row of the numbers that matter at a glance. Everything else is under Run details. */
function RunHeadline({ expedition }: { expedition: ExpeditionState }) {
  const carried = expedition.unsecured.reduce((sum, stack) => sum + stack.quantity, 0)
  const resource = expedition.hero
  const hpFraction = resource.maxHp > 0 ? resource.hp / resource.maxHp : 0
  return (
    <KpiRow label="Run status">
      <Kpi label="HP" value={`${Math.round(resource.hp)}/${Math.round(resource.maxHp)}`} tone={hpFraction < 0.4 ? 'bad' : hpFraction < 0.7 ? 'warn' : 'good'} />
      <Kpi label="Fights won" value={expedition.history.filter((entry) => entry.outcome === 'victory').length} />
      <Kpi label="Loot bag" value={`${carried}/${lootCapacityOf(expedition)}`} testId="loot-bag" note={bagIsFull(expedition) ? (carried >= lootCapacityOf(expedition) ? 'Full' : 'Nearly full') : undefined} tone={bagIsFull(expedition) ? 'warn' : undefined} />
      <Kpi label="Carried gold" value={`${expedition.carriedGold} g`} tone="gold" testId="gold-carried" />
    </KpiRow>
  )
}

/** Everything that is not needed to watch the fight, folded away. */
function RunDetails({ expedition }: { expedition: ExpeditionState }) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const pendingContracts = pendingContractProgress(save, expedition)
  const runGold = expedition.carriedGold - (expedition.startGold ?? 0)
  // A leg whose fights drop no materials (before the route's last zone) still drops gold.
  const legFight = expedition.current ?? expedition.opening[expedition.encounterIndex] ?? null
  const legEnemies = legFight === null ? [] : legFight.enemies
  const goldOnly = legEnemies.length > 0 && legEnemies.every((enemy) => enemy.materialId === undefined) && legEnemies.some((enemy) => (enemy.gold ?? 0) > 0)
  const pouch = safePouch(expedition.unsecured)
  const resource = expedition.hero
  // During a fight the carried supplies change at once; the run's own slots catch up when the fight ends.
  const fight = expedition.combat
  const held = fight !== null ? fight.hero.supplies.map(supplyName) : expedition.supplySlots.flatMap((slot) => (slot === null ? [] : [supplyName(slot.id)]))
  const usedNow = fight === null ? [] : fight.log.flatMap((event) => (event.type === 'supplyUse' && event.actorId === fight.hero.id ? [event.supplyId] : []))
  const usedIds = [...expedition.consumedSupplyIds, ...usedNow]
  return (
    <Collapsible summary="Run details" persistKey="rpg.runDetailsOpen" testId="run-details">
      <KpiRow label="Run numbers">
        <Kpi label="Banked gold" value={`${expedition.depositedGold} g`} testId="gold-banked" />
        <Kpi
          label="Run gold"
          value={`${runGold >= 0 ? '+' : '−'}${Math.abs(runGold)} g`}
          tone={runGold > 0 ? 'good' : undefined}
          testId="gold-run"
          note={goldOnly ? 'Gold only on this leg' : undefined}
        />
        <Kpi label="Momentum" value={`${expedition.momentum}/${MOMENTUM_CAP}`} testId="momentum" />
        {resource.classResourceId.length > 0 ? (
          <Kpi label={resource.classResourceId} value={`${Math.round(resource.classResource)}/${resource.classResourceMax}`} />
        ) : null}
        <Kpi label="Regen" value={`+${Math.round(hpRegenRate(expedition) * 100) / 100}/s`} note="HP between fights" />
      </KpiRow>
      <p className="muted" data-testid="standing-orders">
        <strong>Standing orders:</strong> push on at {hero?.pushOnHpPercent ?? '?'}% HP or more, {typeof hero?.stopAfterFights === 'number' ? `stop after ${hero.stopAfterFights} ${hero.stopAfterFights === 1 ? 'fight' : 'fights'}` : 'no fight limit'}, repeat {hero?.repeatRoute === true ? 'on' : 'off'}.{' '}
        {hero?.autoRun === true ? 'Applies live while Auto run is on, and while you are away.' : 'Applies only while you are away (Auto run is off); the fight limit applies live too.'}
        <Help label="About standing orders">
          Push on and repeat apply when you are away, and live while Auto run is on; the fight limit applies while you watch too. Carried gold is with you and pays the rescue fee; banked gold is safe in town and the purse reads 0 meanwhile.
        </Help>
      </p>
      {pendingContracts.length > 0 ? (
        <ul className="muted" data-testid="pending-contracts" aria-label="Contract progress this run">
          {pendingContracts.map((entry) => (
            <li key={entry.contractId}>
              {entry.name}: <Tag kind="good">+{entry.pending} pending this run</Tag> ({entry.progress}/{entry.count} banked)
            </li>
          ))}
        </ul>
      ) : null}
      <div className="pill-lines">
        <div className="pill-line" data-testid="unsecured" title="Lost if you are defeated, except the safe pouch">
          <small className="pill-label">Carrying</small>
          <span className="pill-row">{lootPills(expedition.unsecured, 'nothing yet')}</span>
        </div>
        <div className="pill-line" data-testid="safe-pouch" title="The most valuable 5 you carry. Kept if you are defeated.">
          <small className="pill-label">Safe pouch</small>
          <span className="pill-row">
            {pouch.length === 0 ? (
              <span className="muted-inline">nothing yet</span>
            ) : (
              pouch.map((stack) => (
                <Tag key={stack.materialId} kind="good">
                  Safe {stack.quantity} {stack.materialId}
                </Tag>
              ))
            )}
          </span>
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
    </Collapsible>
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
  if (defeated) notes.push(stats.defeatedIn === null ? 'You were defeated.' : `You were defeated in fight ${stats.defeatedIn}. Loot outside the safe pouch was destroyed.`)
  if (stats.gearWear > 0) notes.push(`Gear wear: -${stats.gearWear} durability on each worn piece.`)
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
            {stats.pouchSaved.map((stack) => (
              <Tag key={`pouch-${stack.materialId}`} kind="good" title="Saved by the safe pouch">
                Safe pouch {stack.quantity} {stack.materialId}
              </Tag>
            ))}
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
      expedition.outcome === 'ongoing' ? (
        <section aria-label="Expedition" className="run-area">
          <RunBar expedition={expedition} />
          <FightArea live={expedition.combat} escapePending={expedition.escapeNow === true} expedition={expedition} />
          <RunHeadline expedition={expedition} />
          <RunDetails expedition={expedition} />
        </section>
      ) : (
        <>
          <Ended expedition={expedition} />
          <FightArea live={expedition.combat} escapePending={expedition.escapeNow === true} expedition={expedition} />
        </>
      )
    )
  }
  if (hero === null) return null
  return <PreparationForm key={hero.id} hero={hero} />
}
