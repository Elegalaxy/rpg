import { describe, expect, it } from 'vitest'

import { nodes } from '../content/world.ts'

import { selectedHero } from './character.ts'
import { bonusesDue, reincarnate } from './reincarnation.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, serializeSave, type SaveData } from './save.ts'
import { nodeStatus } from './world.ts'

function heroSave(): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const save = made.save
  return {
    ...save,
    account: { ...save.account, discoveries: [...save.account.discoveries, 'node:withered-grove', 'node:drowned-causeway', 'node:fracture-gate'] },
  }
}

function hero(save: SaveData) {
  const found = selectedHero(save)
  if (found === null) throw new Error('no hero')
  return found
}

function withHero(save: SaveData, patch: Partial<ReturnType<typeof hero>>): SaveData {
  return { ...save, heroes: save.heroes.map((entry, index) => (index === 0 ? { ...entry, ...patch } : entry)) }
}

function reincarnated(defeated: string[]): SaveData {
  const save = withHero(heroSave(), { defeatedEnemyIds: defeated, bossLossThisLife: true })
  const result = reincarnate(save, 'hero-1', null)
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

describe('Remembered Paths', () => {
  it('opens the Causeway on life 2 without beating the elites again, and never the Fracture Gate', () => {
    const first = withHero(heroSave(), { defeatedEnemyIds: [] })
    expect(nodeStatus(nodes['drowned-causeway']!, first, hero(first)).state).toBe('locked')
    const next = reincarnated(['rootmaw-stalker', 'echo-knight', 'fractured-warden'])
    expect(hero(next).defeatedEnemyIds).toEqual([])
    expect(hero(next).rememberedEnemyIds).toEqual(['rootmaw-stalker', 'echo-knight'])
    const status = nodeStatus(nodes['drowned-causeway']!, next, hero(next))
    expect(status).toEqual({ state: 'discovered', reason: null, remembered: true })
    expect(nodeStatus(nodes['fracture-gate']!, next, hero(next))).toEqual({
      state: 'locked',
      reason: 'Defeat Rootmaw Stalker and Echo Knight first.',
    })
  })

  it('keeps a node discovered without the note once the hero beats the elites again', () => {
    const next = reincarnated(['rootmaw-stalker', 'echo-knight'])
    const again = withHero(next, { defeatedEnemyIds: ['rootmaw-stalker', 'echo-knight'] })
    expect(nodeStatus(nodes['drowned-causeway']!, again, hero(again))).toEqual({ state: 'discovered', reason: null })
    expect(nodeStatus(nodes['fracture-gate']!, again, hero(again)).state).toBe('discovered')
  })

  it('does not pay an elite bonus twice, and unions across lives', () => {
    const next = reincarnated(['rootmaw-stalker', 'echo-knight'])
    expect(hero(next).claimedBonuses).toEqual(expect.arrayContaining(['elite:rootmaw-stalker', 'elite:echo-knight']))
    expect(bonusesDue(hero(withHero(next, { defeatedEnemyIds: ['rootmaw-stalker'] })))).toEqual([])
    const third = reincarnate(withHero(next, { defeatedEnemyIds: ['tidebound-colossus', 'rootmaw-stalker'], bossLossThisLife: true }), 'hero-1', null)
    if (!third.ok) throw new Error(third.reason)
    expect(hero(third.save).rememberedEnemyIds?.slice().sort()).toEqual(['echo-knight', 'rootmaw-stalker', 'tidebound-colossus'])
  })

  it('backfills older saves from the elite bonuses already claimed, only for heroes with lives', () => {
    const base = heroSave()
    const old = withHero(base, { lives: 2, claimedBonuses: ['elite:rootmaw-stalker', 'elite:echo-knight', 'boss:fractured-warden', 'rank:1'] })
    const raw = JSON.parse(serializeSave(old))
    delete raw.heroes[0].rememberedEnemyIds
    const parsed = parseSave(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(hero(parsed.data).rememberedEnemyIds).toEqual(['rootmaw-stalker', 'echo-knight'])
    expect(() => assertSaveData(parsed.data)).not.toThrow()
    const rawFirst = JSON.parse(serializeSave(base))
    delete rawFirst.heroes[0].rememberedEnemyIds
    const first = parseSave(JSON.stringify(rawFirst))
    expect(first.ok && hero(first.data).rememberedEnemyIds).toBeUndefined()
  })

  it('rejects a remembered list that is not text', () => {
    const raw = JSON.parse(serializeSave(heroSave()))
    raw.heroes[0].rememberedEnemyIds = [3]
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false)
  })
})
