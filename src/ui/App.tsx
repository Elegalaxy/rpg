import { useEffect, useState } from 'react'

import { xpToNextLevel } from '../sim/stats.ts'
import { selectedHero } from '../persist/character.ts'
import { statLines, statsFor } from '../persist/equipment.ts'
import { nextHint, type Tab } from '../persist/guidance.ts'
import { purseOf, type SaveData } from '../persist/save.ts'
import { scenarios } from '../content/scenarios.ts'
import type { CombatState } from '../sim/types.ts'

import { Attributes } from './character/Attributes.tsx'
import { CreateHero } from './character/CreateHero.tsx'
import { Loadout } from './character/Loadout.tsx'
import { Roster } from './character/Roster.tsx'
import { Rules } from './character/Rules.tsx'
import { SkillWeb } from './character/SkillWeb.tsx'
import { Equipment } from './town/Equipment.tsx'
import { Legacy } from './character/Legacy.tsx'
import { PLACES, Town, type PlaceId } from './town/Town.tsx'
import { CombatPanel } from './combat/CombatPanel.tsx'
import { PALETTES, applyPalette, applyTheme, storedPalette, storedTheme, type PaletteChoice, type ThemeChoice } from './theme.ts'
import { debugLog } from './debug.ts'
import { LogPanel } from './log/LogPanel.tsx'
import { ExpeditionPanel } from './map/ExpeditionPanel.tsx'
import { MapView } from './map/MapView.tsx'
import { OutcomeCard } from './log/OutcomeCard.tsx'
import {
  PLAYBACK_SPEEDS,
  restart,
  randomSeed,
  selectScenario,
  setSeedText,
  setSpeed,
  startCombatLoop,
  startTownLoop,
  startExpeditionLoop,
  startNewGame,
  chooseHero,
  togglePause,
  useCombatStore,
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

const TABS: { id: Tab; label: string }[] = [
  { id: 'heroes', label: 'Hero' },
  { id: 'town', label: 'Town' },
  { id: 'map', label: 'Map' },
  { id: 'roster', label: 'Roster' },
  { id: 'combat', label: 'Combat viewer' },
]

type HeroPart = 'overview' | 'skills' | 'combat' | 'gear' | 'legacy'

const HERO_PARTS: { id: HeroPart; label: string }[] = [
  { id: 'overview', label: 'Attributes' },
  { id: 'skills', label: 'Skills' },
  { id: 'combat', label: 'Combat setup' },
  { id: 'gear', label: 'Gear' },
  { id: 'legacy', label: 'Legacy' },
]

const TOWN_PARTS: { id: PlaceId; label: string }[] = PLACES.map((place) => ({ id: place.id, label: place.name }))

/** A second row of buttons inside a tab, so one screen shows one job. */
function SubTabs<T extends string>({
  tabs,
  current,
  onPick,
}: {
  tabs: { id: T; label: string }[]
  current: T
  onPick: (id: T) => void
}) {
  return (
    <nav className="subtabs" aria-label="Sections">
      {tabs.map((entry) => (
        <button key={entry.id} type="button" aria-pressed={current === entry.id} onClick={() => onPick(entry.id)}>
          {entry.label}
        </button>
      ))}
    </nav>
  )
}

function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice>(storedTheme)
  const [palette, setPalette] = useState<PaletteChoice>(storedPalette)
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
  const hero = selectedHero(save)
  const hint = nextHint(save)
  const stats = hero === null ? null : statsFor(hero)
  const need = hero === null ? 1 : xpToNextLevel(hero.progress.level)
  return (
    <header aria-label="Status">
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
        <span>
          Gold {purseOf(save).gold}
          {purseOf(save).debt > 0 ? ` · Debt ${purseOf(save).debt}` : ''}
        </span>
      </div>
      {hero !== null ? (
        <div className="xp-row" title={`${hero.progress.xp} / ${need} XP to level ${hero.progress.level + 1}`}>
          <span>Lv {hero.progress.level}</span>
          <progress max={need} value={hero.progress.xp} aria-label="XP to the next level" />
          <span>
            {hero.progress.xp} / {need} XP
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
      <p data-testid="next-hint">
        Next: {hint.text}{' '}
        <button type="button" onClick={() => onGo(hint.tab)}>
          Go
        </button>
      </p>
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
        {PLAYBACK_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={view.speed === speed}
            onClick={() => setSpeed(speed)}
          >
            {speed}×
          </button>
        ))}
      </div>
      <CombatPanel combat={view.combat} queueError={view.queueError} />
      <OutcomeCard combat={view.combat} />
      <LogPanel log={view.combat.log} />
    </>
  )
}

function App() {
  const [tab, setTab] = useState<Tab>('heroes')
  const [heroPart, setHeroPart] = useState<HeroPart>('overview')
  const [townPart, setTownPart] = useState<PlaceId>('weaponsmith')
  const saved = useSaveStatus()

  useEffect(() => {
    debugLog('[ui]', 'app mounted')
    const stopCombat = startCombatLoop()
    const stopExpedition = startExpeditionLoop()
    const stopTown = startTownLoop()
    return () => {
      stopCombat()
      stopExpedition()
      stopTown()
    }
  }, [])

  return (
    <>
      <div className="topbar">
        <h1>RPG</h1>
        <ThemeSwitch />
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
          <CreateHero />
        </section>
      ) : (
        <>
          <div className="shell">
            <aside className="sidebar">
              <Header save={saved.save} onGo={setTab} />
              <nav aria-label="Main">
                {TABS.map((entry) => (
                  <button key={entry.id} type="button" aria-pressed={tab === entry.id} onClick={() => setTab(entry.id)}>
                    {entry.label}
                  </button>
                ))}
              </nav>
            </aside>
            <main className="content">
              {tab === 'heroes' ? (
                <>
                  <SubTabs tabs={HERO_PARTS} current={heroPart} onPick={setHeroPart} />
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
                </>
              ) : null}
              {tab === 'roster' ? (
                <>
                  <Roster />
                  <CreateHero />
                </>
              ) : null}
              {tab === 'town' ? (
                <>
                  <SubTabs tabs={TOWN_PARTS} current={townPart} onPick={setTownPart} />
                  <Town place={townPart} />
                </>
              ) : null}
              {tab === 'map' ? (
                <>
                  <MapView />
                  <ExpeditionPanel />
                </>
              ) : null}
              {tab === 'combat' ? <CombatViewer /> : null}
            </main>
          </div>
        </>
      )}
    </>
  )
}

export default App
