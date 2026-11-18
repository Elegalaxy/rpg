import { describe, expect, it } from 'vitest'

import { CLERIC_VOWS } from '../sim/classes/cleric.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import { HERO_RACES } from '../sim/progression.ts'
import { EXTRA_CLASS_SKILLS, GUIDE_TOPICS, HIDDEN_SKILL_IDS, VOW_GENERAL_NOTE, classGuide, raceGuide, statusGuide, vowGuide } from './guide.ts'
import { skills } from './skills.ts'
import { statuses } from './statuses.ts'
import { classWebs } from './webs/index.ts'

function proseStrings(): string[] {
  const out: string[] = [VOW_GENERAL_NOTE]
  for (const topic of GUIDE_TOPICS) out.push(topic.title, topic.summary, ...topic.body)
  for (const entry of Object.values(classGuide)) out.push(...entry.tips)
  for (const entry of Object.values(raceGuide)) out.push(...entry.tips)
  for (const entry of Object.values(vowGuide)) out.push(entry.name, entry.when, entry.note)
  for (const entry of Object.values(statusGuide)) out.push(entry.summary)
  for (const entry of Object.values(EXTRA_CLASS_SKILLS)) out.push(entry.unlockedBy)
  return out
}

describe('guide text', () => {
  it('has tips for every class and race', () => {
    for (const id of HERO_CLASSES) expect(classGuide[id].tips.length).toBeGreaterThanOrEqual(2)
    for (const id of HERO_RACES) expect(raceGuide[id].tips.length).toBeGreaterThanOrEqual(2)
  })

  it('describes every vow', () => {
    for (const vow of CLERIC_VOWS) {
      const entry = vowGuide[vow]
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.when.length).toBeGreaterThan(0)
      expect(entry.note.length).toBeGreaterThan(0)
    }
  })

  it('describes every status', () => {
    for (const id of Object.keys(statuses)) expect(statusGuide[id]?.summary.length ?? 0).toBeGreaterThan(0)
    for (const id of Object.keys(statusGuide)) expect(statuses[id]).toBeDefined()
  })

  it('has non-empty topics with unique ids', () => {
    expect(new Set(GUIDE_TOPICS.map((topic) => topic.id)).size).toBe(GUIDE_TOPICS.length)
    for (const topic of GUIDE_TOPICS) {
      expect(topic.title.length).toBeGreaterThan(0)
      expect(topic.body.length).toBeGreaterThan(0)
    }
  })

  it('contains no digits in any hand-written prose', () => {
    for (const text of proseStrings()) {
      expect(text.length).toBeGreaterThan(0)
      expect(text, text).not.toMatch(/\d/)
    }
  })

  it('accounts for every non-supply skill exactly once', () => {
    const webOwned = new Set<string>()
    for (const web of Object.values(classWebs)) {
      for (const id of web.startingSkillIds) webOwned.add(id)
      for (const node of web.nodes) if (node.unlocksSkillId !== null) webOwned.add(node.unlocksSkillId)
    }
    const extra = Object.keys(EXTRA_CLASS_SKILLS)
    for (const id of [...webOwned, ...extra, ...HIDDEN_SKILL_IDS]) expect(skills[id], id).toBeDefined()
    for (const id of extra) expect(webOwned.has(id), id).toBe(false)
    for (const id of HIDDEN_SKILL_IDS) expect(webOwned.has(id) || extra.includes(id), id).toBe(false)
    for (const skill of Object.values(skills)) {
      if ((skill as { supply?: boolean }).supply === true) continue
      const owners = [webOwned.has(skill.id), extra.includes(skill.id), HIDDEN_SKILL_IDS.includes(skill.id)].filter(Boolean).length
      expect(owners, skill.id).toBe(1)
    }
  })
})
