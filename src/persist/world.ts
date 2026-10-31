import { encounters } from '../content/encounters.ts'
import { enemies } from '../content/enemies.ts'
import {
  GREYHAVEN_ID,
  LEG_TRAVEL_MS,
  bossRevealed,
  gateBlock,
  legs,
  nodes,
  routes,
  type Route,
  type WorldNode,
} from '../content/world.ts'
import { TRAVEL_GAP_MS, rescueFee, type ExpeditionState } from '../sim/expedition.ts'

import { selectedHero } from './character.ts'
import { startExpedition } from './expeditionSetup.ts'
import { itemBase } from '../content/items.ts'
import { awardXp } from '../sim/progression.ts'
import { applyDurability, gearGaps } from '../sim/economy.ts'
import { addContractProgress } from './contracts.ts'
import { scaleHeirlooms } from './reincarnation.ts'
import { reachMilestone, type SaveData, type SavedHero } from './save.ts'

export type NodeState = 'locked' | 'discovered' | 'cleared'

export type NodeStatus = {
  state: NodeState
  /** Why a node is locked, or null. A personal gate shows what the hero still has to defeat. */
  reason: string | null
}

/**
 * One node as the selected hero sees it. Discovery is shared across the account. Clearing and the
 * Fracture Gate's gate are personal to the hero.
 */
export function nodeStatus(node: WorldNode, save: SaveData, hero: SavedHero | null): NodeStatus {
  if (hero !== null && hero.clearedNodeIds.includes(node.id)) return { state: 'cleared', reason: null }
  if (!save.account.discoveries.includes(node.discoveryId)) return { state: 'locked', reason: 'Not discovered yet.' }
  if (node.gate !== undefined) {
    const block = gateBlock(node, { defeatedEnemyIds: hero?.defeatedEnemyIds ?? [] })
    if (block !== null) return { state: 'locked', reason: block }
  }
  if (node.kind === 'town') return { state: 'cleared', reason: null }
  return { state: 'discovered', reason: null }
}

export type RouteInfo = {
  route: Route
  nodeNames: string[]
  fights: number
  levels: { min: number; max: number } | null
  /** Enemy names on the route. The boss shows as hidden until the hero has arrived at its node. */
  enemyNames: string[]
  bossHidden: boolean
  resources: { name: string; materialId: string; quantity: number }[]
  /** One way, in seconds. A return walk takes the same. */
  travelSeconds: number
}

function routeNodes(route: Route): WorldNode[] {
  return route.nodeIds.flatMap((id) => {
    const node = nodes[id]
    return node === undefined ? [] : [node]
  })
}

export function routeInfo(routeId: string, save: SaveData): RouteInfo {
  const route = routes[routeId]
  if (route === undefined) throw new Error(`unknown route '${routeId}'`)
  const along = routeNodes(route)
  let min: number | null = null
  let max: number | null = null
  const names: string[] = []
  let bossHidden = false
  let fights = 0
  const resources: RouteInfo['resources'] = []
  for (const node of along) {
    if (node.levels !== undefined) {
      min = min === null || node.levels.min < min ? node.levels.min : min
      max = max === null || node.levels.max > max ? node.levels.max : max
    }
    if (node.resource !== undefined) {
      resources.push({ name: node.resource.name, materialId: node.resource.materialId, quantity: node.resource.quantity })
    }
    fights += node.encounterIds.length
    for (const id of node.encounterIds) {
      const encounter = encounters[id]
      for (const member of encounter?.members ?? []) {
        const def = enemies[member.enemyId]
        if (def === undefined) continue
        if (def.boss === true) {
          if (bossRevealed(node, save.account.discoveries.includes(node.discoveryId))) names.push(def.name)
          else bossHidden = true
          continue
        }
        if (!names.includes(def.name)) names.push(def.name)
      }
    }
  }
  return {
    route,
    nodeNames: along.map((node) => node.name),
    fights,
    levels: min === null || max === null ? null : { min, max },
    enemyNames: names,
    bossHidden,
    resources,
    travelSeconds: ((route.nodeIds.length - 1) * LEG_TRAVEL_MS) / 1000,
  }
}

export type StartCheck = { ok: true } | { ok: false; reason: string }

/** A route can start when a hero is selected, none is running, and every node on it is open to this hero. */
export function canStartRoute(save: SaveData, routeId: string): StartCheck {
  const route = routes[routeId]
  if (route === undefined) return { ok: false, reason: 'Unknown route.' }
  const hero = selectedHero(save)
  if (hero === null) return { ok: false, reason: 'Select a hero first.' }
  if (save.expedition !== null) return { ok: false, reason: 'An expedition is already running.' }
  const gaps = gearGaps(hero.equipment, itemBase)
  if (gaps.length > 0) return { ok: false, reason: `Equip every slot first. Missing: ${gaps.join(', ')}.` }
  for (const node of routeNodes(route)) {
    if (node.kind === 'town') continue
    const status = nodeStatus(node, save, hero)
    if (status.state === 'locked') return { ok: false, reason: `${node.name}: ${status.reason ?? 'locked'}` }
  }
  return { ok: true }
}

/** Which node each fight on a route happens at, in order. */
export function fightNodeIds(route: Route): string[] {
  const ids: string[] = []
  for (const node of routeNodes(route)) {
    for (let index = 0; index < node.encounterIds.length; index += 1) ids.push(node.id)
  }
  return ids
}

function nodeForFight(route: Route, index: number): string {
  const ids = fightNodeIds(route)
  return ids[index] ?? ids[ids.length - 1] ?? GREYHAVEN_ID
}

export type MarkerPosition =
  | { kind: 'at'; nodeId: string }
  | { kind: 'between'; fromId: string; toId: string; fraction: number }

/**
 * Where the hero is, computed only from the expedition state. Between two fights in different nodes
 * the marker moves along their leg for the length of the walk. A return walk goes back to Greyhaven.
 */
export function markerPosition(expedition: ExpeditionState): MarkerPosition {
  const route = routes[expedition.id]
  if (route === undefined) return { kind: 'at', nodeId: GREYHAVEN_ID }
  if (expedition.outcome !== 'ongoing') return { kind: 'at', nodeId: GREYHAVEN_ID }
  if (expedition.phase === 'combat') {
    const index = expedition.current?.index ?? expedition.encounterIndex
    return { kind: 'at', nodeId: nodeForFight(route, index) }
  }
  const previous = expedition.encounterIndex === 0 ? GREYHAVEN_ID : nodeForFight(route, expedition.encounterIndex - 1)
  if (expedition.returning) {
    if (previous === GREYHAVEN_ID) return { kind: 'at', nodeId: GREYHAVEN_ID }
    return { kind: 'between', fromId: previous, toId: GREYHAVEN_ID, fraction: clamp(expedition.travelMs / TRAVEL_GAP_MS) }
  }
  const next = nodeForFight(route, expedition.encounterIndex)
  if (previous === next) return { kind: 'at', nodeId: next }
  return { kind: 'between', fromId: previous, toId: next, fraction: clamp(expedition.travelMs / expedition.travelGapMs) }
}

function clamp(value: number): number {
  if (!(value > 0)) return 0
  return value > 1 ? 1 : value
}

function add(list: readonly string[], ...ids: string[]): string[] {
  const missing = ids.filter((id, index) => !list.includes(id) && ids.indexOf(id) === index)
  return missing.length === 0 ? (list as string[]) : [...list, ...missing]
}

/**
 * Fold what the running expedition has done into the save: arriving discovers a node for the whole
 * account, defeating an elite is recorded for the hero, and winning every fixed fight at a node clears
 * it and discovers the nodes beyond. Safe to call again, it only adds.
 */
export function recordProgress(save: SaveData): SaveData {
  const expedition = save.expedition
  const hero = selectedHero(save)
  if (expedition === null || hero === null) return save
  const route = routes[expedition.id]
  if (route === undefined) return save
  const fightNodes = fightNodeIds(route)
  let discoveries = save.account.discoveries
  let defeated = hero.defeatedEnemyIds
  let cleared = hero.clearedNodeIds
  let account = save.account

  const arrive = (index: number): void => {
    const node = nodes[nodeForFight(route, index)]
    if (node !== undefined) discoveries = add(discoveries, node.discoveryId)
  }
  for (const entry of expedition.history) arrive(entry.index)
  if (expedition.current !== null) arrive(expedition.current.index)

  const won = new Set(expedition.history.filter((entry) => entry.outcome === 'victory').map((entry) => entry.index))
  for (const node of routeNodes(route)) {
    const indices = fightNodes.flatMap((id, index) => (id === node.id ? [index] : []))
    if (indices.length === 0) continue
    for (const index of indices) {
      const entry = expedition.history.find((item) => item.index === index && item.outcome === 'victory')
      if (entry === undefined) continue
      const def = enemies[entry.encounterId]
      if (def !== undefined && (def.elite === true || def.boss === true)) defeated = add(defeated, def.id)
      if (def?.boss === true) account = reachMilestone(account, 'first-warden-defeat')
    }
    if (indices.every((index) => won.has(index))) {
      cleared = add(cleared, node.id)
      for (const leg of legs) {
        if (leg.from !== node.id) continue
        const next = nodes[leg.to]
        if (next !== undefined) discoveries = add(discoveries, next.discoveryId)
      }
    }
  }
  const changed =
    discoveries !== save.account.discoveries || defeated !== hero.defeatedEnemyIds || cleared !== hero.clearedNodeIds || account !== save.account
  if (!changed) return save
  return {
    ...save,
    account: { ...account, discoveries },
    heroes: save.heroes.map((item) => (item.id === hero.id ? { ...item, defeatedEnemyIds: defeated, clearedNodeIds: cleared } : item)),
  }
}

/** The Echo rank of each boss fight the expedition won, in order. Empty when no boss fell. */
export function bossVictoryRanks(expedition: ExpeditionState): number[] {
  const ranks: number[] = []
  for (const entry of expedition.history) {
    if (entry.outcome !== 'victory') continue
    const fight = expedition.opening[entry.index]
    const boss = fight?.enemies.find((enemy) => enemies[enemy.defId]?.boss === true)
    if (boss !== undefined) ranks.push(boss.rank ?? 0)
  }
  return ranks
}

/**
 * Begin a run for the selected hero. The gold the hero carries comes out of the account, up to their
 * chosen amount, and the rest travels as safe deposited gold. Settling puts it back.
 */
export function beginExpedition(save: SaveData, routeId: string, seed: number): { ok: true; save: SaveData } | { ok: false; reason: string } {
  const check = canStartRoute(save, routeId)
  if (!check.ok) return check
  const hero = selectedHero(save)
  if (hero === null) return { ok: false, reason: 'Select a hero first.' }
  const carried = Math.min(hero.carryGold, save.account.gold)
  let expedition
  try {
    expedition = startExpedition(hero, routeId, seed, { carried, deposited: save.account.gold - carried })
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true, save: { ...save, account: { ...save.account, gold: 0 }, expedition } }
}

/**
 * Close a finished expedition. A safe return opens the first-return slot. Secured loot, deposited
 * gold, and the carried gold of a safe return go to the account, and a defeat's debt is added, and a defeat keeps only what was already secured. The expedition is removed.
 */
/** A victory at Echo rank R unlocks rank R + 1 and sets the next fight to it. Nothing else changes the rank. */
function unlockedRanks(hero: SavedHero, expedition: ExpeditionState): { echoRank: number; fightRank: number } {
  let echoRank = hero.echoRank
  for (const rank of bossVictoryRanks(expedition)) if (rank + 1 > echoRank) echoRank = rank + 1
  return { echoRank, fightRank: echoRank > hero.echoRank ? echoRank : hero.fightRank }
}

export function settleExpedition(save: SaveData): SaveData {
  const expedition = save.expedition
  if (expedition === null || expedition.outcome === 'ongoing') return save
  const progressed = addContractProgress(recordProgress(save), expedition)
  const materials = { ...progressed.account.materials }
  for (const stack of expedition.secured) materials[stack.materialId] = (materials[stack.materialId] ?? 0) + stack.quantity
  let account = {
    ...progressed.account,
    materials,
    gold: expedition.depositedGold + (expedition.outcome === 'returned' ? expedition.carriedGold : 0),
    debt: progressed.account.debt + expedition.debt,
  }
  if (expedition.outcome === 'returned') account = reachMilestone(account, 'first-return')
  const heroes = progressed.heroes.map((hero) =>
    hero.id === selectedHero(progressed)?.id
      ? {
          ...hero,
          equipment: applyDurability(hero.equipment, expedition.equipment),
          progress: awardXp(hero.progress, expedition.xpEarned ?? 0),
          ...unlockedRanks(hero, expedition),
          bossLossThisLife: hero.bossLossThisLife || expedition.bossLossThisLife,
        }
      : hero,
  )
  const settled: SaveData = { ...progressed, account, heroes, expedition: null }
  const owner = selectedHero(progressed)
  return owner === null ? settled : scaleHeirlooms(settled, owner.id)
}

/**
 * After a fight the run waits for the player: push on to the next walk, or return to town. The wait
 * is derived from the state, so a reload during the wait lands in the same place. `pushedAt` is the
 * fight count the player already chose to push on from.
 */
export function shouldHold(expedition: ExpeditionState, pushedAt: number | null): boolean {
  return (
    expedition.outcome === 'ongoing' &&
    expedition.phase === 'travel' &&
    !expedition.returning &&
    expedition.encounterIndex > 0 &&
    expedition.travelMs === 0 &&
    pushedAt !== expedition.encounterIndex
  )
}

export type OutcomeSummary = {
  title: string
  lines: string[]
}

function lootText(stacks: readonly { materialId: string; quantity: number }[]): string {
  return stacks.length === 0 ? 'none' : stacks.map((stack) => `${stack.quantity} ${stack.materialId}`).join(', ')
}

/** What a finished expedition cost and gained, taken only from its state. */
export function outcomeSummary(expedition: ExpeditionState): OutcomeSummary {
  const victories = expedition.history.filter((entry) => entry.outcome === 'victory').length
  const retreated = expedition.history.find((entry) => entry.outcome === 'retreat')
  const lines = [`Fights won: ${victories}.`]
  for (const rank of bossVictoryRanks(expedition)) lines.push(`The Fractured Warden fell at Echo rank ${rank}. Echo rank ${rank + 1} is unlocked.`)
  if ((expedition.xpEarned ?? 0) > 0) lines.push(`Experience earned: ${expedition.xpEarned}.`)
  if (expedition.outcome === 'returned') {
    if (retreated !== undefined) lines.push(`You retreated during fight ${retreated.index + 1}. That fight gave no loot or momentum.`)
    lines.push(`Loot secured: ${lootText(expedition.secured)}.`)
    if (expedition.overflow > 0) lines.push(`${expedition.overflow} did not fit in the bag and was lost.`)
    lines.push('Momentum was cleared on arrival.')
    return { title: retreated === undefined ? 'Returned safely' : 'Retreated to Greyhaven', lines }
  }
  if (expedition.outcome === 'defeat') {
    const lost = expedition.history.find((entry) => entry.outcome === 'defeat')
    lines.push(lost === undefined ? 'You were defeated.' : `You were defeated in fight ${lost.index + 1}.`)
    lines.push('All unsecured loot was destroyed, and momentum was cleared.')
    lines.push(`Loot kept (already secured): ${lootText(expedition.secured)}.`)
    const worn = expedition.equipment.filter((entry) => entry.durability < entry.maxDurability)
    if (worn.length > 0) {
      lines.push(`Gear damaged: ${worn.map((entry) => `${entry.slot} ${entry.durability}/${entry.maxDurability}${entry.disabled ? ' (disabled)' : ''}`).join(', ')}.`)
    }
    lines.push(`Rescue fee: ${rescueFee(expedition)} gold. Gold you carry now: ${expedition.carriedGold}. Debt: ${expedition.debt}.`)
    lines.push(`Recovery wait: ${Math.round(expedition.recoveryMs / 60_000)} minutes.`)
    if (expedition.bossLossThisLife) lines.push('A boss defeated you this life. You can now reincarnate.')
    return { title: 'Defeated', lines }
  }
  return { title: 'Expedition running', lines }
}
