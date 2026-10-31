import { classWebs } from '../content/webs/index.ts'
import { racialWebs } from '../content/webs/racial.ts'
import {
  allocateAttribute,
  allocateNode,
  allocateRacialNode,
  previewAllocation,
  previewRacialAllocation,
  type AllocationPreview,
  type HeroProgress,
  type SkillNode,
} from '../sim/progression.ts'

import type { RosterResult } from './roster.ts'
import type { SaveData, SavedHero } from './save.ts'

export const ATTRIBUTE_KEYS = ['strength', 'vitality', 'agility', 'intellect', 'spirit'] as const
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]
export type AttributePlan = { [key in AttributeKey]?: number }

export type NodeView = {
  node: SkillNode
  /** `class` or `racial`. Racial nodes are drawn in their own color. */
  kind: 'class' | 'racial'
  allocated: boolean
  preview: AllocationPreview
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function selectedHero(save: SaveData): SavedHero | null {
  if (save.selectedHeroId === null) return null
  return save.heroes.find((hero) => hero.id === save.selectedHeroId) ?? null
}

function withProgress(save: SaveData, heroId: string, progress: HeroProgress): SaveData {
  return { ...save, heroes: save.heroes.map((hero) => (hero.id === heroId ? { ...hero, progress } : hero)) }
}

function findHero(save: SaveData, heroId: string): SavedHero | null {
  return save.heroes.find((hero) => hero.id === heroId) ?? null
}

/** Every node the hero can see: the class web, then the racial branch. */
export function nodeViews(hero: SavedHero): NodeView[] {
  const web = classWebs[hero.classId]
  const racial = racialWebs[hero.progress.race]
  const views: NodeView[] = []
  for (const node of web.nodes) {
    views.push({
      node,
      kind: 'class',
      allocated: hero.progress.allocatedNodeIds.includes(node.id),
      preview: previewAllocation(hero.progress, web, node.id),
    })
  }
  for (const node of racial.nodes) {
    views.push({
      node,
      kind: 'racial',
      allocated: hero.progress.allocatedNodeIds.includes(node.id),
      preview: previewRacialAllocation(hero.progress, racial, node.id),
    })
  }
  return views
}

/** What the confirmation dialog says. A keystone names the keystones it closes. */
export function confirmationText(view: NodeView, hero: SavedHero): string {
  const { node, preview } = view
  const parts = [`Spend 1 skill point on ${node.name}. Skill points are not refunded and there is no respec.`]
  if (node.keystone) {
    const web = classWebs[hero.classId]
    const blocked = preview.blockedKeystoneIds.map(
      (id) => web.nodes.find((entry) => entry.id === id)?.name ?? id,
    )
    parts.push(
      `${node.name} is a keystone. Only one keystone can be active during a life, so ${blocked.join(' and ')} will become unavailable until reincarnation.`,
    )
  }
  if (preview.unlocksSkillId !== null) parts.push(`It unlocks the skill ${preview.unlocksSkillId}.`)
  return parts.join(' ')
}

/** Spend one skill point on a class or racial node. The sim's own checks refuse an illegal take. */
export function takeNode(save: SaveData, heroId: string, nodeId: string): RosterResult {
  const hero = findHero(save, heroId)
  if (hero === null) return { ok: false, reason: 'That hero is not on the roster.' }
  try {
    const classWeb = classWebs[hero.classId]
    const racial = racialWebs[hero.progress.race]
    const progress = classWeb.nodes.some((node) => node.id === nodeId)
      ? allocateNode(hero.progress, classWeb, nodeId)
      : allocateRacialNode(hero.progress, racial, nodeId)
    return { ok: true, save: withProgress(save, heroId, progress) }
  } catch (error) {
    return { ok: false, reason: describe(error) }
  }
}

/** Spend a whole plan of attribute points, or none of it. */
export function spendAttributes(save: SaveData, heroId: string, plan: AttributePlan): RosterResult {
  const hero = findHero(save, heroId)
  if (hero === null) return { ok: false, reason: 'That hero is not on the roster.' }
  let progress = hero.progress
  let total = 0
  try {
    for (const key of ATTRIBUTE_KEYS) {
      const amount = plan[key] ?? 0
      if (amount === 0) continue
      progress = allocateAttribute(progress, key, amount)
      total += amount
    }
  } catch (error) {
    return { ok: false, reason: describe(error) }
  }
  if (total === 0) return { ok: false, reason: 'Choose at least one attribute point to spend.' }
  return { ok: true, save: withProgress(save, heroId, progress) }
}

/** Development builds only: grant points so the screens can be tried on a level 1 hero. */
export function grantPoints(save: SaveData, heroId: string, attributePoints: number, skillPoints: number): SaveData {
  return {
    ...save,
    heroes: save.heroes.map((hero) =>
      hero.id === heroId
        ? {
            ...hero,
            progress: {
              ...hero.progress,
              unspentAttributePoints: hero.progress.unspentAttributePoints + attributePoints,
              unspentSkillPoints: hero.progress.unspentSkillPoints + skillPoints,
            },
          }
        : hero,
    ),
  }
}
