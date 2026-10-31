// Plain JSON hero progress: level, XP toward the next level, and unspent points.

import {
  ENCOUNTER_XP_DISCOUNT_CAP,
  ENCOUNTER_XP_DISCOUNT_PER_EXTRA,
  HERO_CLASSES,
  ORDINARY_XP_FACTOR,
  ORDINARY_XP_SOFT_CAP,
  type HeroClass,
} from './constants.ts'
import type { Attributes } from './stats.ts'
import { xpToNextLevel } from './stats.ts'

export const HERO_RACES = ['human', 'elf', 'beastfolk', 'undead'] as const
export type HeroRace = (typeof HERO_RACES)[number]

const ATTRIBUTE_KEYS = ['strength', 'vitality', 'agility', 'intellect', 'spirit'] as const
type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]

const ATTRIBUTE_POINTS_PER_LEVEL = 2
const SKILL_POINT_LEVEL_INTERVAL = 3

/** Enemy below the hero: 0.75^(hero level − enemy level), floored at 10%. */
const LOWER_ENEMY_XP_DECAY = 0.75
const LOWER_ENEMY_XP_FLOOR = 0.1
/** Enemy above the hero: +5% per level of difference, capped at 125%. */
const HIGHER_ENEMY_XP_PER_LEVEL = 0.05
const HIGHER_ENEMY_XP_CAP = 1.25

export type HeroProgress = {
  race: HeroRace
  level: number
  /** Progress toward the next level. */
  xp: number
  unspentAttributePoints: number
  unspentSkillPoints: number
  attributes: Attributes
  allocatedNodeIds: string[]
  learnedSkillIds: string[]
  /** Equipped skill ids. Empty, or one to four learned ids. */
  loadout: string[]
  legacySkillPoints: number
  attachmentSlots: [null, null]
}

export type SkillNodeIndex = 1 | 2 | 3 | 4 | 5

export type SkillNode = {
  id: string
  name: string
  cluster: string
  index: SkillNodeIndex
  cost: 1
  requires: string | null
  keystone: boolean
  unlocksSkillId: string | null
}

/** A race's four-node branch. Nodes use the same skill points as class nodes. */
export type RacialWeb = {
  race: HeroRace
  nodes: readonly SkillNode[]
}

export type SkillWeb = {
  classId: HeroClass
  nodes: readonly SkillNode[]
  startingSkillIds: readonly [string, string, string, string]
}

export type CreateProgressOptions = {
  startingSkillIds?: readonly string[]
}

export type AllocationPreview = {
  cost: 1
  canTake: boolean
  missingRequirementId: string | null
  unlocksSkillId: string | null
  blockedKeystoneIds: string[]
  reasons: string[]
}

const ALREADY_ALLOCATED = 'already allocated'
const MISSING_REQUIREMENT = 'missing requirement'
const NOT_ENOUGH_POINTS = 'not enough skill points'
const ANOTHER_KEYSTONE = 'another keystone is allocated'

export type XpMember = {
  xp: number
  level: number
  summon: boolean
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'bigint') return `${value}n`
  if (value === undefined) return 'undefined'
  return String(value)
}

function includesName<T extends string>(values: readonly T[], value: string): value is T {
  for (const entry of values) {
    if (entry === value) return true
  }
  return false
}

function assertRace(race: unknown): asserts race is HeroRace {
  if (typeof race !== 'string' || !includesName(HERO_RACES, race)) {
    throw new Error(`unknown race ${describeValue(race)}`)
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, received ${describeValue(value)}`)
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be an integer of at least 0, received ${describeValue(value)}`)
  }
}

function assertAttributes(value: unknown): asserts value is Attributes {
  if (value === null || typeof value !== 'object') {
    throw new Error(`attributes must be an object, received ${describeValue(value)}`)
  }
  const record = value as Record<string, unknown>
  for (const key of ATTRIBUTE_KEYS) {
    assertNonNegativeInteger(record[key], key)
  }
}

export function assertProgress(progress: unknown): asserts progress is HeroProgress {
  if (progress === null || typeof progress !== 'object') {
    throw new Error(`hero progress must be an object, received ${describeValue(progress)}`)
  }
  const record = progress as Record<string, unknown>
  assertRace(record.race)
  assertPositiveInteger(record.level, 'level')
  assertNonNegativeInteger(record.xp, 'xp')
  assertNonNegativeInteger(record.unspentAttributePoints, 'unspent attribute points')
  assertNonNegativeInteger(record.unspentSkillPoints, 'unspent skill points')
  assertAttributes(record.attributes)
  assertIdList(record.allocatedNodeIds, 'allocated node', 0, null)
  assertIdList(record.learnedSkillIds, 'learned skill', 0, null)
  assertIdList(record.loadout, 'loadout skill', 0, 4)
  const learned = record.learnedSkillIds as readonly string[]
  const loadout = record.loadout as readonly string[]
  for (const id of loadout) {
    if (!hasId(learned, id)) throw new Error(`loadout skill ${id} is not learned`)
  }
  assertNonNegativeInteger(record.legacySkillPoints, 'legacy skill points')
  assertAttachmentSlots(record.attachmentSlots)
}

function copyAttributes(attributes: Attributes): Attributes {
  return {
    strength: attributes.strength,
    vitality: attributes.vitality,
    agility: attributes.agility,
    intellect: attributes.intellect,
    spirit: attributes.spirit,
  }
}

function copyProgress(progress: HeroProgress): HeroProgress {
  return {
    race: progress.race,
    level: progress.level,
    xp: progress.xp,
    unspentAttributePoints: progress.unspentAttributePoints,
    unspentSkillPoints: progress.unspentSkillPoints,
    attributes: copyAttributes(progress.attributes),
    allocatedNodeIds: progress.allocatedNodeIds.slice(),
    learnedSkillIds: progress.learnedSkillIds.slice(),
    loadout: progress.loadout.slice(),
    legacySkillPoints: progress.legacySkillPoints,
    attachmentSlots: [null, null],
  }
}

/**
 * Level 1 with the racial base already spent. Unspent pools start empty.
 * Pass four starting skill ids to learn them and equip that same loadout.
 * This does not look up a class web.
 */
export function createProgress(
  race: HeroRace,
  attributes: Attributes,
  options?: CreateProgressOptions,
): HeroProgress {
  assertRace(race)
  assertAttributes(attributes)
  const starting = readStartingSkills(options)
  return {
    race,
    level: 1,
    xp: 0,
    unspentAttributePoints: 0,
    unspentSkillPoints: 0,
    attributes: copyAttributes(attributes),
    allocatedNodeIds: [],
    learnedSkillIds: starting,
    loadout: starting.slice(),
    legacySkillPoints: 0,
    attachmentSlots: [null, null],
  }
}

/**
 * Add a non-negative integer of XP. Each filled level costs `xpToNextLevel`,
 * grants two attribute points, and grants one skill point when the new level
 * is divisible by 3. An award can cross several levels. Zero adds nothing.
 */
export function awardXp(progress: HeroProgress, amount: number): HeroProgress {
  assertProgress(progress)
  assertNonNegativeInteger(amount, 'xp award')
  const next = copyProgress(progress)
  if (amount === 0) return next
  next.xp += amount
  let cost = xpToNextLevel(next.level)
  while (next.xp >= cost) {
    next.xp -= cost
    next.level += 1
    next.unspentAttributePoints += ATTRIBUTE_POINTS_PER_LEVEL
    if (next.level % SKILL_POINT_LEVEL_INTERVAL === 0) next.unspentSkillPoints += 1
    cost = xpToNextLevel(next.level)
  }
  return next
}

/** Spend unspent attribute points. Whole positive amounts only. No refunds. */
export function allocateAttribute(progress: HeroProgress, key: string, amount: number): HeroProgress {
  assertProgress(progress)
  if (typeof key !== 'string' || !includesName(ATTRIBUTE_KEYS, key)) {
    throw new Error(`unknown attribute ${describeValue(key)}`)
  }
  assertPositiveInteger(amount, 'attribute allocation')
  if (amount > progress.unspentAttributePoints) {
    throw new Error(
      `attribute allocation ${amount} exceeds unspent attribute points ${progress.unspentAttributePoints}`,
    )
  }
  const attributeKey: AttributeKey = key
  const next = copyProgress(progress)
  next.attributes[attributeKey] += amount
  next.unspentAttributePoints -= amount
  return next
}

function levelXpFactor(heroLevel: number, enemyLevel: number): number {
  if (heroLevel === enemyLevel) return 1
  if (heroLevel > enemyLevel) {
    return Math.max(LOWER_ENEMY_XP_FLOOR, LOWER_ENEMY_XP_DECAY ** (heroLevel - enemyLevel))
  }
  return Math.min(HIGHER_ENEMY_XP_CAP, 1 + HIGHER_ENEMY_XP_PER_LEVEL * (enemyLevel - heroLevel))
}

function assertSpirit(spirit: unknown): asserts spirit is number {
  if (typeof spirit !== 'number' || !Number.isFinite(spirit) || spirit < 0) {
    throw new Error(`spirit must be a finite number of at least 0, received ${describeValue(spirit)}`)
  }
}

function assertEnemyXp(xp: unknown): asserts xp is number {
  if (typeof xp !== 'number' || !Number.isFinite(xp) || xp < 0) {
    throw new Error(`enemy xp must be at least 0, received ${describeValue(xp)}`)
  }
}

/**
 * Scale each non-summon member by the level gap, apply the group discount,
 * then the Spirit ordinary-XP factor. Round once, on that final product.
 */
export function xpFromEnemies(
  heroLevel: number,
  spirit: number,
  members: readonly XpMember[],
  ordinaryMultiplier = 1,
): number {
  assertPositiveInteger(heroLevel, 'hero level')
  assertSpirit(spirit)
  if (!Array.isArray(members)) {
    throw new Error(`enemies must be a list, received ${describeValue(members)}`)
  }
  let sum = 0
  let count = 0
  for (const member of members) {
    if (member === null || typeof member !== 'object') {
      throw new Error(`enemy must be an object, received ${describeValue(member)}`)
    }
    const record = member as Record<string, unknown>
    if (typeof record.summon !== 'boolean') {
      throw new Error(`summon must be a boolean, received ${describeValue(record.summon)}`)
    }
    if (record.summon) continue
    assertEnemyXp(record.xp)
    assertPositiveInteger(record.level, 'enemy level')
    sum += record.xp * levelXpFactor(heroLevel, record.level)
    count += 1
  }
  const extra = count > 0 ? count - 1 : 0
  const raw = extra * ENCOUNTER_XP_DISCOUNT_PER_EXTRA
  const discount = raw > ENCOUNTER_XP_DISCOUNT_CAP ? ENCOUNTER_XP_DISCOUNT_CAP : raw
  const discounted = sum * (1 - discount)
  const spiritFactor = 1 + (ORDINARY_XP_FACTOR * spirit) / (spirit + ORDINARY_XP_SOFT_CAP)
  if (
    typeof ordinaryMultiplier !== 'number' ||
    !Number.isFinite(ordinaryMultiplier) ||
    ordinaryMultiplier < 0
  ) {
    throw new Error(
      `ordinary XP multiplier must be at least 0, received ${describeValue(ordinaryMultiplier)}`,
    )
  }
  const product = discounted * spiritFactor
  const scaled = ordinaryMultiplier === 1 ? product : product * ordinaryMultiplier
  return Math.round(scaled)
}

function hasId(ids: readonly string[], id: string): boolean {
  for (const entry of ids) {
    if (entry === id) return true
  }
  return false
}

function assertIdList(
  value: unknown,
  label: string,
  minLength: number,
  maxLength: number | null,
): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} ids must be a list, received ${describeValue(value)}`)
  }
  if (value.length < minLength || (maxLength !== null && value.length > maxLength)) {
    const limit = maxLength === null ? `at least ${minLength}` : `${minLength} to ${maxLength}`
    throw new Error(`${label} ids must be ${limit}, received ${value.length}`)
  }
  const seen: { [id: string]: boolean } = {}
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new Error(`${label} id must be a non-empty string, received ${describeValue(entry)}`)
    }
    if (seen[entry] === true) throw new Error(`${label} id ${entry} is duplicated`)
    seen[entry] = true
  }
}

function assertAttachmentSlots(value: unknown): asserts value is [null, null] {
  if (!Array.isArray(value) || value.length !== 2 || value[0] !== null || value[1] !== null) {
    throw new Error(`attachment slots must be [null, null], received ${describeValue(value)}`)
  }
}

function assertNodeIndex(value: unknown): asserts value is SkillNodeIndex {
  if (value !== 1 && value !== 2 && value !== 3 && value !== 4 && value !== 5) {
    throw new Error(`node index must be 1 to 5, received ${describeValue(value)}`)
  }
}

function assertNode(value: unknown): asserts value is SkillNode {
  if (value === null || typeof value !== 'object') {
    throw new Error(`skill node must be an object, received ${describeValue(value)}`)
  }
  const node = value as Record<string, unknown>
  if (typeof node.id !== 'string' || node.id.length === 0) {
    throw new Error(`node id must be a non-empty string, received ${describeValue(node.id)}`)
  }
  if (typeof node.name !== 'string' || node.name.length === 0) {
    throw new Error(`node name must be a non-empty string, received ${describeValue(node.name)}`)
  }
  if (typeof node.cluster !== 'string' || node.cluster.length === 0) {
    throw new Error(`node cluster must be a non-empty string, received ${describeValue(node.cluster)}`)
  }
  assertNodeIndex(node.index)
  if (node.cost !== 1) throw new Error(`node ${node.id} must cost 1, received ${describeValue(node.cost)}`)
  if (node.requires !== null && (typeof node.requires !== 'string' || node.requires.length === 0)) {
    throw new Error(`node ${node.id} requirement must be an id or null, received ${describeValue(node.requires)}`)
  }
  if (typeof node.keystone !== 'boolean') {
    throw new Error(`node ${node.id} keystone must be a boolean, received ${describeValue(node.keystone)}`)
  }
  if (node.keystone !== (node.index === 5)) {
    throw new Error(`node ${node.id} keystone must be true only at index 5`)
  }
  if (node.unlocksSkillId !== null && (typeof node.unlocksSkillId !== 'string' || node.unlocksSkillId.length === 0)) {
    throw new Error(
      `node ${node.id} unlock must be a skill id or null, received ${describeValue(node.unlocksSkillId)}`,
    )
  }
}

function assertWeb(web: unknown): asserts web is SkillWeb {
  if (web === null || typeof web !== 'object') {
    throw new Error(`skill web must be an object, received ${describeValue(web)}`)
  }
  const record = web as Record<string, unknown>
  if (typeof record.classId !== 'string' || !includesName(HERO_CLASSES, record.classId)) {
    throw new Error(`unknown hero class ${describeValue(record.classId)}`)
  }
  if (!Array.isArray(record.nodes)) {
    throw new Error(`skill web nodes must be a list, received ${describeValue(record.nodes)}`)
  }
  const nodes: SkillNode[] = []
  const seen: { [id: string]: boolean } = {}
  for (const entry of record.nodes) {
    assertNode(entry)
    if (seen[entry.id] === true) throw new Error(`duplicate skill node id ${entry.id}`)
    seen[entry.id] = true
    nodes.push(entry)
  }
  for (const entry of nodes) {
    if (entry.requires !== null && seen[entry.requires] !== true) {
      throw new Error(`node ${entry.id} requires unknown node ${entry.requires}`)
    }
  }
  assertIdList(record.startingSkillIds, 'starting skill', 4, 4)
}

function readStartingSkills(options: CreateProgressOptions | undefined): string[] {
  if (options === undefined) return []
  if (options === null || typeof options !== 'object') {
    throw new Error(`progress options must be an object, received ${describeValue(options)}`)
  }
  if (options.startingSkillIds === undefined) return []
  assertIdList(options.startingSkillIds, 'starting skill', 4, 4)
  return [...options.startingSkillIds]
}

function findNode(web: SkillWeb, nodeId: string): SkillNode {
  assertWeb(web)
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    throw new Error(`unknown node ${describeValue(nodeId)}`)
  }
  for (const node of web.nodes) {
    if (node.id === nodeId) return node
  }
  throw new Error(`unknown node ${describeValue(nodeId)}`)
}

type AllocationReview = {
  missingRequirementId: string | null
  unlocksSkillId: string | null
  blockedKeystoneIds: string[]
  reasons: string[]
}

function reviewAllocation(progress: HeroProgress, nodes: readonly SkillNode[], node: SkillNode): AllocationReview {
  const reasons: string[] = []
  if (hasId(progress.allocatedNodeIds, node.id)) reasons.push(ALREADY_ALLOCATED)
  let missingRequirementId: string | null = null
  if (node.requires !== null && !hasId(progress.allocatedNodeIds, node.requires)) {
    missingRequirementId = node.requires
    reasons.push(MISSING_REQUIREMENT)
  }
  if (progress.unspentSkillPoints + progress.legacySkillPoints < 1) reasons.push(NOT_ENOUGH_POINTS)
  const blockedKeystoneIds: string[] = []
  if (node.keystone) {
    let otherTaken = false
    for (const other of nodes) {
      if (!other.keystone || other.id === node.id) continue
      blockedKeystoneIds.push(other.id)
      if (hasId(progress.allocatedNodeIds, other.id)) otherTaken = true
    }
    if (otherTaken) reasons.push(ANOTHER_KEYSTONE)
  }
  const unlocksSkillId =
    node.unlocksSkillId !== null && !hasId(progress.learnedSkillIds, node.unlocksSkillId)
      ? node.unlocksSkillId
      : null
  return { missingRequirementId, unlocksSkillId, blockedKeystoneIds, reasons }
}

function allocationError(node: SkillNode, reason: string, missingRequirementId: string | null): string {
  if (reason === ALREADY_ALLOCATED) return `node ${node.id} is already allocated`
  if (reason === MISSING_REQUIREMENT) return `node ${node.id} requires ${missingRequirementId ?? 'unknown'}`
  if (reason === NOT_ENOUGH_POINTS) return `not enough skill points for ${node.id}`
  if (reason === ANOTHER_KEYSTONE) {
    return `node ${node.id} is a keystone and another keystone is already allocated`
  }
  return `cannot allocate ${node.id}: ${reason}`
}

/** Spend one point on a node. Ordinary skill points are spent before legacy points. */
export function allocateNode(progress: HeroProgress, web: SkillWeb, nodeId: string): HeroProgress {
  assertProgress(progress)
  const node = findNode(web, nodeId)
  const review = reviewAllocation(progress, web.nodes, node)
  const reason = review.reasons[0]
  if (reason !== undefined) throw new Error(allocationError(node, reason, review.missingRequirementId))
  const next = copyProgress(progress)
  next.allocatedNodeIds.push(node.id)
  if (review.unlocksSkillId !== null) next.learnedSkillIds.push(review.unlocksSkillId)
  if (next.unspentSkillPoints > 0) next.unspentSkillPoints -= 1
  else next.legacySkillPoints -= 1
  return next
}

/** Spend one point on a node of this hero's own racial branch. Racial nodes are never keystones. */
export function allocateRacialNode(progress: HeroProgress, web: RacialWeb, nodeId: string): HeroProgress {
  assertProgress(progress)
  if (web.race !== progress.race) {
    throw new Error(`a ${progress.race} cannot take ${web.race} racial nodes`)
  }
  const node = web.nodes.find((entry) => entry.id === nodeId)
  if (node === undefined) throw new Error(`unknown node ${describeValue(nodeId)}`)
  const review = reviewAllocation(progress, web.nodes, node)
  const reason = review.reasons[0]
  if (reason !== undefined) throw new Error(allocationError(node, reason, review.missingRequirementId))
  const next = copyProgress(progress)
  next.allocatedNodeIds.push(node.id)
  if (next.unspentSkillPoints > 0) next.unspentSkillPoints -= 1
  else next.legacySkillPoints -= 1
  return next
}

/** The same preview as a class node, for a node of this hero's racial branch. */
export function previewRacialAllocation(progress: HeroProgress, web: RacialWeb, nodeId: string): AllocationPreview {
  assertProgress(progress)
  const node = web.nodes.find((entry) => entry.id === nodeId)
  if (node === undefined) throw new Error(`unknown node ${describeValue(nodeId)}`)
  const review = reviewAllocation(progress, web.nodes, node)
  const reasons = [...review.reasons]
  if (web.race !== progress.race) reasons.unshift(`a ${progress.race} cannot take ${web.race} racial nodes`)
  return {
    cost: 1,
    canTake: reasons.length === 0,
    missingRequirementId: review.missingRequirementId,
    unlocksSkillId: null,
    blockedKeystoneIds: [],
    reasons,
  }
}

/** Renaissance: at least two nodes allocated in each cluster of the class web. */
export function renaissanceActive(allocatedNodeIds: readonly string[], web: SkillWeb): boolean {
  const counts: { [cluster: string]: number } = {}
  for (const node of web.nodes) {
    if (counts[node.cluster] === undefined) counts[node.cluster] = 0
    if (hasId(allocatedNodeIds, node.id)) counts[node.cluster] = (counts[node.cluster] ?? 0) + 1
  }
  const clusters = Object.keys(counts)
  return clusters.length > 0 && clusters.every((name) => (counts[name] ?? 0) >= 2)
}

/**
 * Legacy currency for reincarnating at this progress (G10): `2 × (level − 1)` plus a fifth-step share of
 * the XP into the current level, 0 to 4.
 */
export function legacyFromProgress(progress: HeroProgress): number {
  assertProgress(progress)
  const cost = xpToNextLevel(progress.level)
  const share = cost > 0 ? Math.floor((5 * progress.xp) / cost) : 0
  return 2 * (progress.level - 1) + (share > 4 ? 4 : share)
}

/** Add one legacy skill point. Does not change ordinary unspent points. */
export function grantLegacySkillPoint(progress: HeroProgress): HeroProgress {
  assertProgress(progress)
  const next = copyProgress(progress)
  next.legacySkillPoints += 1
  return next
}

/** Replace the loadout with 1 to 4 unique learned skill ids. */
export function setLoadout(progress: HeroProgress, ids: readonly string[]): HeroProgress {
  assertProgress(progress)
  if (!Array.isArray(ids)) throw new Error(`loadout ids must be a list, received ${describeValue(ids)}`)
  if (ids.length < 1 || ids.length > 4) {
    throw new Error(`loadout must contain 1 to 4 skills, received ${ids.length}`)
  }
  const seen: { [id: string]: boolean } = {}
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`loadout rejects an empty skill id, received ${describeValue(id)}`)
    }
    if (seen[id] === true) throw new Error(`loadout rejects duplicate skill id ${id}`)
    seen[id] = true
    if (!hasId(progress.learnedSkillIds, id)) throw new Error(`loadout rejects unlearned skill id ${id}`)
  }
  const next = copyProgress(progress)
  next.loadout = [...ids]
  return next
}

/** Racial attachment is not available. The two slots stay empty. */
export function setAttachment(progress: HeroProgress, slot: number, nodeId: string): HeroProgress {
  assertProgress(progress)
  if (slot !== 0 && slot !== 1) {
    throw new Error(`attachment slot must be 0 or 1, received ${describeValue(slot)}`)
  }
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    throw new Error(`racial node id must be a non-empty string, received ${describeValue(nodeId)}`)
  }
  throw new Error('no racial node can be attached yet')
}

/**
 * Report whether a node can be taken. Unknown node ids throw.
 * A legal preview has an empty reason list. An illegal preview lists reasons and does not throw.
 */
export function previewAllocation(progress: HeroProgress, web: SkillWeb, nodeId: string): AllocationPreview {
  assertProgress(progress)
  const node = findNode(web, nodeId)
  const review = reviewAllocation(progress, web.nodes, node)
  return {
    cost: 1,
    canTake: review.reasons.length === 0,
    missingRequirementId: review.missingRequirementId,
    unlocksSkillId: review.unlocksSkillId,
    blockedKeystoneIds: review.blockedKeystoneIds,
    reasons: review.reasons,
  }
}
