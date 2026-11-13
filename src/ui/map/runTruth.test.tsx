import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pendingContractProgress } from '../../persist/contracts.ts'
import { ordersLine } from '../../persist/offline.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'
import { commitSave, getSaveStatus, setPreparationProblem, startExpeditionFromUi } from '../store.ts'
import { ExpeditionPanel } from './ExpeditionPanel.tsx'

function freshHero(): void {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  commitSave(made.save, 'test', false)
}

function startRun() {
  freshHero()
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
    array[0] = 7
    return array
  }) as never)
  expect(startExpeditionFromUi('splintered-road')).toBeNull()
  const run = getSaveStatus().save.expedition
  if (run === null) throw new Error('no run')
  return run
}

describe('the run panel tells the truth', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    setPreparationProblem(null)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('numbers the live fight from the run, shows away fights as chips, and splits gold', () => {
    const run = startRun()
    run.encounterIndex = 2
    run.carriedGold = 40
    run.startGold = 25
    run.depositedGold = 10
    run.history = [0, 1].map((index) => ({ index, encounterId: 'x', seed: index, outcome: 'victory' as const, durationMs: 1000 }))
    commitSave({ ...getSaveStatus().save, expedition: run }, 'test')
    const html = renderToStaticMarkup(<ExpeditionPanel />)
    expect(html).toContain('Fight 1 · played while away')
    expect(html).toContain('Fight 2 · played while away')
    expect(html).toContain('+15 g')
    expect(html).toContain('Banked gold')
    expect(html).toContain('Carried gold')
    expect(html).toContain('Standing orders')
  })

  it('says Full when the bag is at capacity and Nearly full below it', () => {
    const run = startRun()
    const capacity = run.lootCapacity ?? 20
    run.unsecured = [{ materialId: 'hide', quantity: capacity }]
    commitSave({ ...getSaveStatus().save, expedition: run }, 'test')
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('>Full<')
    run.unsecured = [{ materialId: 'hide', quantity: capacity - 1 }]
    commitSave({ ...getSaveStatus().save, expedition: run }, 'test')
    expect(renderToStaticMarkup(<ExpeditionPanel />)).toContain('Nearly full')
  })

  it('refuses to start while the preparation form holds unsaved changes', () => {
    freshHero()
    setPreparationProblem('Unsaved changes: fix the preparation first.')
    expect(startExpeditionFromUi('splintered-road')).toMatch(/Unsaved changes/)
  })

  it('reports contract units a live run has earned and what the standing orders did', () => {
    const run = startRun()
    expect(pendingContractProgress(getSaveStatus().save, run)).toEqual([])
    expect(
      ordersLine({ heroId: 'h', heroName: 'Ash', runs: 0, fightsWon: 0, retreats: 0, defeated: false, xp: 0, levelsGained: 0, gold: 0, materials: {}, contractsFinished: 0, stopped: null, note: null, pushedOn: 3, walkedHomeHp: 1 }),
    ).toBe('Standing orders for Ash: pushed on 3 times, walked home 1 time because HP was under the push-on limit.')
  })
})
