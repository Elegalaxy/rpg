import { useEffect, useState } from 'react'

import { applyAccess, storedAccess, type AccessChoice } from './access.ts'
import { applySound, storedSound, type SoundChoice } from './sound.ts'
import { useCount } from './useCount.ts'

import { xpToNextLevel } from '../sim/stats.ts'
import { selectedHero } from '../persist/character.ts'
import { statLines, statsFor } from '../persist/equipment.ts'
import { nextHint, type Tab } from '../persist/guidance.ts'
import { tutorialMark } from '../persist/tutorial.ts'
import { GoldLine } from './GoldLine.tsx'
import { contractFor, purseOf, type SaveData } from '../persist/save.ts'
import { isComplete } from '../persist/contracts.ts'
import { PLACES as PLACE_LIST, dealsIn, type PlaceDef } from '../content/places.ts'
import { scenarios } from '../content/scenarios.ts'
import type { CombatState } from '../sim/types.ts'
import { CHANGELOG_SECTIONS, changelogKey } from './whatsNew/changelog.ts'
import { WhatsNew } from './whatsNew/WhatsNew.tsx'
import { Guide } from './guide/Guide.tsx'
import { useGuideTarget } from './guide/guideNav.ts'
import { readSeen, writeSeen } from './whatsNew/seen.ts'

import { Attributes } from './character/Attributes.tsx'
import { CreateHero } from './character/CreateHero.tsx'
import { Loadout } from './character/Loadout.tsx'
import { Roster } from './character/Roster.tsx'
import { SavePanel } from './character/SavePanel.tsx'
import { Rules } from './character/Rules.tsx'
import { SkillWeb } from './character/SkillWeb.tsx'
import { Equipment } from './town/Equipment.tsx'
import { Legacy } from './character/Legacy.tsx'
import { AwayPanel } from './AwayPanel.tsx'
import { RunDock } from './RunDock.tsx'
import { PhoneNav } from './PhoneNav.tsx'
import { useNarrow } from './useNarrow.ts'
import { dockVisible } from './runDockState.ts'
import { Help } from './Help.tsx'
import { MASTERY_HELP } from './masteryHelp.ts'
import { newRecipeIds, useSeenRecipes } from './town/enchanterSeen.ts'
import { PLACES, Town, type PlaceId } from './town/Town.tsx'
import { PlacePicker } from './town/PlacePicker.tsx'
import { Notices } from './Notices.tsx'
import { CombatPanel } from './combat/CombatPanel.tsx'
import { PALETTES, applyPalette, applyTheme, storedPalette, storedTheme, type PaletteChoice, type ThemeChoice } from './theme.ts'
import { debugLog } from './debug.ts'
import { LogPanel } from './log/LogPanel.tsx'
import { ExpeditionPanel } from './map/ExpeditionPanel.tsx'
import { MapView } from './map/MapView.tsx'
import { Coach } from './tutorial/Coach.tsx'
import { OutcomeCard } from './log/OutcomeCard.tsx'
import {
  MASTERED_SPEED,
  PLAYBACK_SPEEDS,
  masteredSpeedAllowed,
  restart,
  randomSeed,
  selectScenario,
  setSeedText,
  setSpeed,
  startCombatLoop,
  startOfflineWatch,
  startTownLoop,
  startExpeditionLoop,
  startNewGame,
  chooseHero,
  togglePause,
  useCombatStore,
  clearUnseenCrafts,
  clearUnseenDiscoveries,
  getUnseenCrafts,
  getUnseenDiscoveries,
  useSaveStatus,
} from './store.ts'

const scenarioIds = Object.keys(scenarios)

function shownTimeMs(combat: CombatState): number {
  if (combat.outcome === 'ongoing') return combat.timeMs
  for (let index = combat.log.length - 1; index >= 0; index -= 1) {
    const event = combat.log[index]
    if (event !== undefined && event.type === 'encounterEnd') return event.timeMs
  }
  return combat.timeMs
}

type AppTab = Tab | 'whatsnew' | 'guide'

const TABS: { id: AppTab; label: string }[] = [
  { id: 'heroes', label: 'Hero' },
  { id: 'town', label: 'Town' },
  { id: 'map', label: 'Map' },
  { id: 'roster', label: 'Roster' },
  { id: 'combat', label: 'Combat viewer' },
  { id: 'whatsnew', label: "What's new" },
  { id: 'guide', label: 'Guide' },
]

const PHONE_MAIN: AppTab[] = ['map', 'town', 'heroes']
const PHONE_TABS = PHONE_MAIN.map((id) => TABS.find((entry) => entry.id === id)!)
const PHONE_MORE = TABS.filter((entry) => !PHONE_MAIN.includes(entry.id))

type HeroPart = 'overview' | 'skills' | 'combat' | 'gear' | 'legacy'

const HERO_PARTS: { id: HeroPart; label: string }[] = [
  { id: 'overview', label: 'Attributes' },
  { id: 'skills', label: 'Skills' },
  { id: 'combat', label: 'Combat setup' },
  { id: 'gear', label: 'Gear' },
  { id: 'legacy', label: 'Legacy' },
]

const TOWN_PARTS: { id: PlaceId; label: string }[] = [
  ...PLACES.filter((place) => place.id === 'contract-board'),
  ...PLACES.filter((place) => place.id !== 'contract-board'),
].map((place) => ({ id: place.id, label: place.name }))

/** A second row of buttons inside a tab, so one screen shows one job. */
/** A small count pill on a tab: something is waiting there. */
function Badge({ count, what }: { count: number; what: string }) {
  if (count < 1) return null
  return (
    <span className="badge" role="status" aria-label={`${count} ${what}`}>
      {count}
    </span>
  )
}

function SubTabs<T extends string>({
  tabs,
  current,
  onPick,
  badges = {},
}: {
  tabs: { id: T; label: string }[]
  current: T
  onPick: (id: T) => void
  badges?: { [id: string]: { count: number; what: string } }
}) {
  return (
    <nav className="subtabs" aria-label="Sections">
      {tabs.map((entry) => (
        <button key={entry.id} type="button" aria-pressed={current === entry.id} onClick={() => onPick(entry.id)}>
          {entry.label}
          {badges[entry.id] === undefined ? null : <Badge count={badges[entry.id]!.count} what={badges[entry.id]!.what} />}
        </button>
      ))}
    </nav>
  )
}

function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice>(storedTheme)
  const [palette, setPalette] = useState<PaletteChoice>(storedPalette)
  const [access, setAccess] = useState<AccessChoice>(storedAccess)
  const [sound, setSound] = useState<SoundChoice>(storedSound)
  function changeAccess(next: AccessChoice): void {
    setAccess(next)
    applyAccess(next)
  }
  return (
    <div className="controls">
      <label>
        Style{' '}
        <select
          value={palette}
          onChange={(event) => {
            const next = event.target.value as PaletteChoice
            setPalette(next)
            applyPalette(next)
          }}
        >
          {(Object.keys(PALETTES) as PaletteChoice[]).map((key) => (
            <option key={key} value={key}>
              {PALETTES[key]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mode{' '}
        <select
          value={choice}
          onChange={(event) => {
            const next = event.target.value as ThemeChoice
            setChoice(next)
            applyTheme(next)
          }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        Text{' '}
        <select
          value={access.text}
          onChange={(event) => changeAccess({ ...access, text: event.target.value === 'large' ? 'large' : 'default' })}
        >
          <option value="default">Default</option>
          <option value="large">Large</option>
        </select>
      </label>
      <label>
        Contrast{' '}
        <select
          value={access.contrast}
          onChange={(event) => changeAccess({ ...access, contrast: event.target.value === 'high' ? 'high' : 'default' })}
        >
          <option value="default">Default</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        Motion{' '}
        <select
          value={access.motion}
          onChange={(event) => changeAccess({ ...access, motion: event.target.value === 'reduce' ? 'reduce' : 'system' })}
        >
          <option value="system">System</option>
          <option value="reduce">Reduce</option>
        </select>
      </label>
      <label>
        Sound{' '}
        <select
          value={sound}
          onChange={(event) => {
            const next = event.target.value === 'off' ? 'off' : 'on'
            setSound(next)
            applySound(next)
          }}
        >
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
      </label>
    </div>
  )
}

const HEADER_STATS = ['Maximum HP', 'Physical Power', 'Magical Power', 'Armor', 'Resistance', 'Evasion', 'Critical chance'] as const
const STAT_SHORT: { [label: string]: string } = {
  'Maximum HP': 'HP',
  'Physical Power': 'Phys',
  'Magical Power': 'Magic',
  Armor: 'Armor',
  Resistance: 'Resist',
  Evasion: 'Evade',
  'Critical chance': 'Crit',
}

function Header({ save, onGo }: { save: SaveData; onGo: (tab: Tab) => void }) {
  const [open, setOpen] = useState(false)
  const hero = selectedHero(save)
  const hint = nextHint(save)
  const coaching = tutorialMark(save) !== null
  const stats = hero === null ? null : statsFor(hero)
  const need = hero === null ? 1 : xpToNextLevel(hero.progress.level)
  const xp = useCount(hero?.progress.xp ?? 0)
  const run = save.expedition !== null && save.expedition.outcome === 'ongoing' ? save.expedition : null
  const runHp = run === null ? null : (run.combat?.hero ?? run.hero)
  return (
    <header aria-label="Status" className={open ? 'status-open' : undefined}>
      {hero !== null ? (
        <button type="button" className="status-compact" aria-expanded={open} aria-controls="status-full" onClick={() => setOpen(!open)}>
          <strong className="status-compact-name">
            {hero.name} · L{hero.progress.level}
          </strong>
          {runHp !== null ? (
            <span className="status-compact-hp">
              HP {Math.round(runHp.hp)}/{Math.round(runHp.maxHp)}
            </span>
          ) : null}
          <progress className="status-compact-xp" max={need} value={xp} aria-label={`XP ${hero.progress.xp} of ${need}`} />
          <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      ) : null}
      <div className="status-full" id="status-full">
      <div className="status-row">
        <select
          aria-label="Selected hero"
          value={hero?.id ?? ''}
          disabled={save.expedition !== null}
          onChange={(event) => chooseHero(event.target.value)}
        >
          {hero === null ? <option value="">No hero selected</option> : null}
          {save.heroes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} (L{entry.progress.level} {entry.classId})
            </option>
          ))}
        </select>
        <GoldLine save={save} />
      </div>
      {hero !== null ? (
        <div className="xp-row" title={`${hero.progress.xp} / ${need} XP to level ${hero.progress.level + 1}`}>
          <span>Lv {hero.progress.level}</span>
          <progress max={need} value={xp} aria-label="XP to the next level" />
          <span>
            {xp} / {need} XP
          </span>
        </div>
      ) : null}
      {stats !== null ? (
        <ul className="stat-chips" aria-label="Hero stats">
          {statLines(stats)
            .filter((line) => (HEADER_STATS as readonly string[]).includes(line.label))
            .map((line) => (
              <li key={line.label}>
                <small>{STAT_SHORT[line.label] ?? line.label}</small> {Math.round(line.value * 10) / 10}
                {line.unit}
              </li>
            ))}
        </ul>
      ) : null}
      {coaching ? null : (
        <div className="callout" data-testid="next-hint">
          <span>
            <strong>Next:</strong> {hint.text}
          </span>
          <button type="button" className="btn-primary" onClick={() => onGo(hint.tab)}>
            Go
          </button>
        </div>
      )}
      </div>
    </header>
  )
}

export function CombatViewer() {
  const view = useCombatStore()
  return (
    <>
      <p>
        {view.combat.outcome} at {shownTimeMs(view.combat)} ms
      </p>
      <div className="controls">
        <label htmlFor="rpg-scenario">Scenario</label>{' '}
        <select
          id="rpg-scenario"
          value={view.scenarioId}
          onChange={(event) => selectScenario(event.target.value)}
        >
          {scenarioIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div className="controls">
        <label htmlFor="rpg-seed">Seed</label>{' '}
        <input
          id="rpg-seed"
          value={view.seedText}
          onChange={(event) => setSeedText(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {view.seedError !== null ? <p role="alert">{view.seedError}</p> : null}
      <div className="controls">
        <button type="button" onClick={restart}>
          Restart
        </button>{' '}
        <button type="button" onClick={randomSeed}>
          New seed
        </button>{' '}
        <button type="button" onClick={togglePause}>
          {view.paused ? 'Resume' : 'Pause'}
        </button>{' '}
        {PLAYBACK_SPEEDS.map((speed) => {
          const locked = speed === MASTERED_SPEED && !masteredSpeedAllowed()
          return (
            <button
              key={speed}
              type="button"
              aria-pressed={view.speed === speed}
              disabled={locked}
              title={locked ? 'Return safely 10 times to unlock' : undefined}
              onClick={() => setSpeed(speed)}
            >
              {speed}×
            </button>
          )
        })}
        {!masteredSpeedAllowed() ? (
          <small className="muted-inline">
            {' '}
            8× unlocks after 10 safe returns on a route. <Help label="About mastery">{MASTERY_HELP}</Help>
          </small>
        ) : null}
      </div>
      <CombatPanel combat={view.combat} queueError={view.queueError} />
      <OutcomeCard combat={view.combat} />
      <LogPanel log={view.combat.log} />
    </>
  )
}

function App() {
  const [tab, setTab] = useState<AppTab>('heroes')
  const [welcomeGuide, setWelcomeGuide] = useState(false)
  const guideTarget = useGuideTarget()
  const guideNonce = guideTarget?.nonce
  const latestKey = changelogKey(CHANGELOG_SECTIONS)
  const [seenKey, setSeenKey] = useState<string | null>(readSeen)
  const [heroPart, setHeroPart] = useState<HeroPart>('overview')
  const [townPart, setTownPart] = useState<PlaceId>('contract-board')
  const saved = useSaveStatus()
  const purse = purseOf(saved.save)
  const finishedContracts = purse.contracts.filter((entry) => isComplete(entry, contractFor(purse, entry.contractId))).length
  const unseenCrafts = getUnseenCrafts()
  const newRecipes = newRecipeIds(saved.save, useSeenRecipes()).length
  const unseenDiscoveries = getUnseenDiscoveries()
  const chosenHero = selectedHero(saved.save)
  const attributePoints = chosenHero?.progress.unspentAttributePoints ?? 0
  const skillPoints = chosenHero === null ? 0 : chosenHero.progress.unspentSkillPoints + chosenHero.progress.legacySkillPoints
  const docked = dockVisible(saved.save, tab)
  const openShop = tab === 'town' ? PLACE_LIST.find((place) => place.id === townPart && place.gear !== undefined) : undefined
  const craftsAt = (place: PlaceDef) => unseenCrafts.filter((baseId) => dealsIn(place, baseId)).length
  const narrow = useNarrow()
  const townBadges = {
    'contract-board': { count: finishedContracts, what: 'finished contracts to collect' },
    enchanter: { count: newRecipes, what: 'new recipes to learn' },
    ...Object.fromEntries(
      PLACE_LIST.filter((place) => place.gear !== undefined).map((place) => [place.id, { count: craftsAt(place), what: 'finished crafts' }]),
    ),
  }

  function tabBadge(id: AppTab) {
    if (id === 'town') return <Badge count={finishedContracts + unseenCrafts.length + newRecipes} what="things waiting in town" />
    if (id === 'map') return <Badge count={unseenDiscoveries} what="new places discovered" />
    if (id === 'heroes') return <Badge count={attributePoints + skillPoints} what="unspent points" />
    if (id === 'whatsnew' && seenKey !== latestKey && tab !== 'whatsnew') {
      return (
        <span className="badge" role="status">
          new
        </span>
      )
    }
    return null
  }

  useEffect(() => {
    if (openShop !== undefined && craftsAt(openShop) > 0) clearUnseenCrafts(openShop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openShop, unseenCrafts])

  useEffect(() => {
    if (guideNonce !== undefined) {
      setTab('guide')
      setWelcomeGuide(true)
    }
  }, [guideNonce])
  useEffect(() => {
    if (tab === 'map' && unseenDiscoveries > 0) clearUnseenDiscoveries()
  }, [tab, unseenDiscoveries])
  useEffect(() => {
    if (tab === 'whatsnew' && seenKey !== latestKey) {
      writeSeen(latestKey)
      setSeenKey(latestKey)
    }
  }, [tab, seenKey, latestKey])

  useEffect(() => {
    debugLog('[ui]', 'app mounted')
    const stopCombat = startCombatLoop()
    const stopExpedition = startExpeditionLoop()
    const stopTown = startTownLoop()
    const stopWatch = startOfflineWatch()
    return () => {
      stopCombat()
      stopExpedition()
      stopTown()
      stopWatch()
    }
  }, [])

  return (
    <>
      <Coach onShowMap={() => setTab('map')} />
      <div className="topbar">
        <h1>RPG</h1>
        {narrow ? null : <ThemeSwitch />}
      </div>
      {saved.loadError !== null ? (
        <div role="alert">
          <p>
            The saved game could not be read: {saved.loadError}.
            {saved.backupKey !== null ? ` A copy was kept as ${saved.backupKey}.` : ''}
          </p>
          <button type="button" onClick={startNewGame}>
            Start a new game
          </button>
        </div>
      ) : null}
      {saved.writeError !== null ? <p role="alert">The game could not be saved: {saved.writeError}</p> : null}
      {saved.save.heroes.length === 0 ? (
        <section aria-label="Welcome">
          <h2>Welcome</h2>
          <p>
            Lead a hero out of Greyhaven along the Splintered Road, gather loot, and grow strong enough to face the Fractured Warden at the
            Fracture Gate. Fights play out by themselves from the rules you set. Start by creating a hero.
          </p>
          {welcomeGuide ? (
            <>
              <button type="button" onClick={() => setWelcomeGuide(false)}>
                Back to hero creation
              </button>
              <Guide target={guideTarget} />
            </>
          ) : (
            <>
              <p>
                <button type="button" onClick={() => setWelcomeGuide(true)}>
                  Read the guide
                </button>
              </p>
              <CreateHero />
            </>
          )}
        </section>
      ) : (
        <>
          <div className={`shell${docked ? ' shell-docked' : ''}`}>
            <aside className="sidebar">
              <Header key={tab} save={saved.save} onGo={setTab} />
              {narrow ? null : (
                <nav aria-label="Main">
                  {TABS.map((entry) => (
                    <button key={entry.id} type="button" aria-pressed={tab === entry.id} onClick={() => setTab(entry.id)}>
                      {entry.label}
                      {tabBadge(entry.id)}
                    </button>
                  ))}
                </nav>
              )}
            </aside>
            <main className="content">
              <AwayPanel />
              <div key={tab} className="screen-in">
              {tab === 'heroes' ? (
                <>
                  <SubTabs
                    tabs={HERO_PARTS}
                    current={heroPart}
                    onPick={setHeroPart}
                    badges={{
                      overview: { count: attributePoints, what: 'unspent attribute points' },
                      skills: { count: skillPoints, what: 'unspent skill points' },
                    }}
                  />
                  <div key={heroPart} className="screen-in">
                  {heroPart === 'overview' ? <Attributes /> : null}
                  {heroPart === 'skills' ? <SkillWeb /> : null}
                  {heroPart === 'combat' ? (
                    <>
                      <Loadout />
                      <Rules />
                    </>
                  ) : null}
                  {heroPart === 'gear' ? <Equipment /> : null}
                  {heroPart === 'legacy' ? <Legacy /> : null}
                  </div>
                </>
              ) : null}
              {tab === 'roster' ? (
                <>
                  <Roster />
                  <CreateHero />
                  <SavePanel />
                </>
              ) : null}
              {tab === 'town' ? (
                <>
                  {narrow ? (
                    <PlacePicker places={TOWN_PARTS} current={townPart} onPick={setTownPart} badges={townBadges} />
                  ) : (
                    <SubTabs tabs={TOWN_PARTS} current={townPart} onPick={setTownPart} badges={townBadges} />
                  )}
                  <div key={townPart} className="screen-in">
                    <Town place={townPart} />
                  </div>
                </>
              ) : null}
              {tab === 'map' ? (
                <>
                  {narrow && saved.save.expedition !== null ? <ExpeditionPanel /> : null}
                  <MapView
                    onGo={(to) => {
                      if (to.heroPart !== undefined) setHeroPart(to.heroPart)
                      setTab(to.tab)
                    }}
                  />
                  {narrow && saved.save.expedition !== null ? null : <ExpeditionPanel />}
                </>
              ) : null}
              {tab === 'combat' ? <CombatViewer /> : null}
              {tab === 'whatsnew' ? <WhatsNew /> : null}
              {tab === 'guide' ? <Guide target={guideTarget} /> : null}
              </div>
            </main>
            {docked ? <RunDock onOpenMap={() => setTab('map')} /> : null}
            {narrow ? (
              <PhoneNav main={PHONE_TABS} more={PHONE_MORE} current={tab} onPick={setTab} badge={tabBadge} moreBadge={tabBadge('whatsnew')} extra={<ThemeSwitch />} />
            ) : null}
          </div>
          <Notices
            onGo={(to) => {
              if (to.tab === 'heroes') setHeroPart(to.heroPart)
              if (to.tab === 'town') setTownPart(to.place)
              setTab(to.tab)
            }}
          />
        </>
      )}
    </>
  )
}

export default App
