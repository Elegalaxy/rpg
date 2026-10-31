import { useEffect, useState } from 'react'

import { selectedHero } from '../persist/character.ts'
import { nextHint, type Tab } from '../persist/guidance.ts'
import type { SaveData } from '../persist/save.ts'
import { scenarios } from '../content/scenarios.ts'
import type { CombatState } from '../sim/types.ts'

import { Attributes } from './character/Attributes.tsx'
import { CreateHero } from './character/CreateHero.tsx'
import { Loadout } from './character/Loadout.tsx'
import { Roster } from './character/Roster.tsx'
import { Rules } from './character/Rules.tsx'
import { SkillWeb } from './character/SkillWeb.tsx'
import { Equipment } from './town/Equipment.tsx'
import { Contracts } from './town/Contracts.tsx'
import { Craft } from './town/Craft.tsx'
import { Legacy } from './character/Legacy.tsx'
import { Town } from './town/Town.tsx'
import { CombatPanel } from './combat/CombatPanel.tsx'
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
  { id: 'heroes', label: 'Heroes' },
  { id: 'town', label: 'Town' },
  { id: 'map', label: 'Map' },
  { id: 'combat', label: 'Combat viewer' },
]

function Header({ save, onGo }: { save: SaveData; onGo: (tab: Tab) => void }) {
  const hero = selectedHero(save)
  const hint = nextHint(save)
  return (
    <header aria-label="Status">
      <p>
        {hero === null ? 'No hero selected' : `${hero.name} — level ${hero.progress.level}`} · Gold {save.account.gold}
        {save.account.debt > 0 ? ` · Debt ${save.account.debt}` : ''}
      </p>
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
      <div>
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
      <div>
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
      <div>
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
      <h1>RPG</h1>
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
          <Header save={saved.save} onGo={setTab} />
          <nav aria-label="Main">
            {TABS.map((entry) => (
              <button key={entry.id} type="button" aria-pressed={tab === entry.id} onClick={() => setTab(entry.id)}>
                {entry.label}
              </button>
            ))}
          </nav>
          {tab === 'heroes' ? (
            <>
              <Roster />
              <CreateHero />
              <Attributes />
              <SkillWeb />
              <Loadout />
              <Rules />
              <Equipment />
              <Legacy />
            </>
          ) : null}
          {tab === 'town' ? (
            <>
              <Town />
              <Contracts />
              <Craft />
            </>
          ) : null}
          {tab === 'map' ? (
            <>
              <MapView />
              <ExpeditionPanel />
            </>
          ) : null}
        </>
      )}
      {tab === 'combat' ? <CombatViewer /> : null}
    </>
  )
}

export default App
