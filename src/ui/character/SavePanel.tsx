import { useState } from 'react'

import { Help } from '../Help.tsx'
import { exportSaveText, importSaveFromText, startNewGame } from '../store.ts'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Back up the game to a file, load a backup, or wipe everything and start over. */
export function SavePanel() {
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function download(): void {
    const blob = new Blob([exportSaveText()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rpg-save-${today()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setError(null)
    setMessage('Saved a backup file.')
  }

  async function choose(file: File | undefined): Promise<void> {
    if (file === undefined) return
    setError(null)
    setMessage(null)
    setPending({ name: file.name, text: await file.text() })
  }

  function replace(): void {
    if (pending === null) return
    const problem = importSaveFromText(pending.text)
    setError(problem)
    setMessage(problem === null ? 'Backup loaded.' : null)
    setPending(null)
  }

  function wipe(): void {
    startNewGame()
    setConfirmWipe(false)
  }

  return (
    <section aria-label="Save file">
      <h2>
        Save file
        <Help label="About saves">
          The game saves itself in this browser. A backup file lets you keep a copy, move to another browser, or recover if the browser data is cleared.
        </Help>
      </h2>
      <div className="controls">
        <button type="button" onClick={download}>
          Export backup
        </button>{' '}
        <label>
          Load backup{' '}
          <input type="file" accept="application/json,.json" aria-label="Load backup file" onChange={(event) => void choose(event.target.files?.[0])} />
        </label>
      </div>
      {pending !== null ? (
        <div role="dialog" aria-label="Confirm loading a backup">
          <p>Replace your whole game with {pending.name}? Your current game is lost unless you exported it.</p>
          <button type="button" className="btn-danger" onClick={replace}>
            Replace my game
          </button>{' '}
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      <div className="controls">
        {confirmWipe ? (
          <div role="dialog" aria-label="Confirm starting over">
            <p>This deletes every hero and everything they own. It cannot be undone. Export a backup first if you might want it.</p>
            <button type="button" className="btn-danger" onClick={wipe}>
              Delete everything
            </button>{' '}
            <button type="button" onClick={() => setConfirmWipe(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn-danger" onClick={() => setConfirmWipe(true)}>
            Start over
          </button>
        )}
      </div>
      {message !== null ? <p data-testid="save-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
