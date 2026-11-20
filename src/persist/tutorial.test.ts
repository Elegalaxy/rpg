import { describe, expect, it } from 'vitest'

import type { ExpeditionState } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { createHero } from './roster.ts'
import { newSave, parseSave, serializeSave, type SaveData } from './save.ts'
import { nextTutorialStep, syncTutorial, tutorialAfterTap, tutorialMark } from './tutorial.ts'

function heroSave(): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save
}

function withStep(save: SaveData, step: SaveData['account']['tutorial'], expedition: ExpeditionState | null = save.expedition): SaveData {
  return { ...save, expedition, account: { ...save.account, tutorial: step } }
}

function hold(save: SaveData): ExpeditionState {
  const hero = selectedHero(save)
  if (hero === null) throw new Error('no hero')
  const expedition = startExpedition(hero, 'splintered-road', 1)
  expedition.phase = 'travel'
  expedition.encounterIndex = 1
  expedition.travelMs = 0
  expedition.history = [{ index: 0, encounterId: 'shardling-pair', seed: 1, outcome: 'victory', durationMs: 1 }]
  return expedition
}

describe('the first-run coach', () => {
  it('starts a new game on the name and treats an older save as finished', () => {
    expect(newSave().account.tutorial).toBe('name')
    expect(tutorialMark(newSave())?.chip).toBe('Name your hero')
    const raw = JSON.parse(serializeSave(newSave())) as { account: { tutorial?: string } }
    delete raw.account.tutorial
    const parsed = parseSave(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.account.tutorial).toBe('done')
    expect(tutorialMark(parsed.data)).toBeNull()
  })

  it('walks return, then a second run, then one push, and waits if that fight is a win', () => {
    const save = heroSave()
    expect(nextTutorialStep('name', save)).toBe('start')
    const waiting = hold(save)
    const banking = withStep(save, 'bank', waiting)
    expect(tutorialMark(banking)?.chip).toBe('Bank this loot')
    waiting.returning = true
    expect(nextTutorialStep('bank', withStep(save, 'bank', waiting))).toBe('home')
    waiting.returning = false
    waiting.outcome = 'returned'
    expect(tutorialMark(withStep(save, 'home', waiting))?.chip).toBe('Home')
    expect(nextTutorialStep('home', withStep(save, 'home', null))).toBe('again')
    expect(tutorialMark(withStep(save, 'again', null))?.chip).toBe('Fight again')
    const second = hold(save)
    expect(tutorialMark(withStep(save, 'push', second))?.chip).toBe('Push on once')
    second.travelMs = 10
    expect(nextTutorialStep('push', withStep(save, 'push', second))).toBe('fall')
    second.travelMs = 0
    second.outcome = 'returned'
    expect(nextTutorialStep('fall', withStep(save, 'fall', second))).toBe('fall')
    expect(tutorialMark(withStep(save, 'fall', null))).toBeNull()
  })

  it('shows the defeat marks on the first fall, including a fall before the first return', () => {
    const save = heroSave()
    const fell = hold(save)
    fell.outcome = 'defeat'
    expect(nextTutorialStep('bank', withStep(save, 'bank', fell))).toBe('fee')
    expect(nextTutorialStep('fall', withStep(save, 'fall', fell))).toBe('fee')
    const defeat = withStep(save, 'fee', fell)
    expect(tutorialMark(defeat)?.chip).toBe('You pay this')
    expect(tutorialAfterTap('fee')).toBe('pouch')
    expect(tutorialMark(withStep(save, 'pouch', fell))?.chip).toBe('The pouch kept this')
    expect(tutorialAfterTap('pouch')).toBe('back')
    expect(tutorialMark(withStep(save, 'back', fell))?.chip).toBe('Back to town')
    expect(nextTutorialStep('back', withStep(save, 'back', null))).toBe('done')
    expect(nextTutorialStep('fee', withStep(save, 'fee', fell))).toBe('fee')
    expect(syncTutorial(withStep(save, 'done', fell)).account.tutorial).toBe('done')
  })

  it('hides the mark during a fight and while walking home', () => {
    const save = heroSave()
    const walking = hold(save)
    walking.returning = true
    walking.travelMs = 100
    expect(tutorialMark(withStep(save, 'bank', walking))).toBeNull()
    const fighting = hold(save)
    fighting.phase = 'combat'
    fighting.travelMs = 0
    expect(tutorialMark(withStep(save, 'bank', fighting))).toBeNull()
  })
})
