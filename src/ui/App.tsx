import { useEffect } from 'react'

import { scenarios } from '../content/scenarios.ts'
import type { CombatState } from '../sim/types.ts'

import { Attributes } from './character/Attributes.tsx'
import { CreateHero } from './character/CreateHero.tsx'
import { Loadout } from './character/Loadout.tsx'
import { Roster } from './character/Roster.tsx'
import { Rules } from './character/Rules.tsx'
import { SkillWeb } from './character/SkillWeb.tsx'
import { CombatPanel } from './combat/CombatPanel.tsx'
import { debugLog } from './debug.ts'
import { LogPanel } from './log/LogPanel.tsx'
import { OutcomeCard } from './log/OutcomeCard.tsx'
import {
  PLAYBACK_SPEEDS,
  restart,
  randomSeed,
  selectScenario,
  setSeedText,
  setSpeed,
  startCombatLoop,
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

function App() {
  const view = useCombatStore()
  const saved = useSaveStatus()

  useEffect(() => {
    debugLog('[ui]', 'app mounted')
    return startCombatLoop()
  }, [])

  return (
    <>
      <h1>RPG – dev build</h1>
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
      <Roster />
      <CreateHero />
      <Attributes />
      <SkillWeb />
      <Loadout />
      <Rules />
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

export default App
