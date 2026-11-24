import { enemies } from '../content/enemies.ts'
import { itemBase, starterEquipment } from '../content/items.ts'
import { skills } from '../content/skills.ts'
import { statuses } from '../content/statuses.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { contracts as contractTable, type ContractDef } from '../content/contracts.ts'
import { supplyTable } from '../content/supplies.ts'
import { applyHeroUpdates } from './heroUpdates.ts'
import { EQUIPMENT_SLOT_IDS, ITEM_MODIFIERS, MAX_ITEM_MODIFIERS, MODIFIER_RANK_MAX, MODIFIER_TEMPER_MAX, rankable, STARTING_MODIFIER_RECIPES, type Equipment, type EquipmentSlotId, type ItemInstance } from '../sim/economy.ts'
import { SUPPLY_STACK_LIMIT, assertExpedition, type ExpeditionState } from '../sim/expedition.ts'
import { MAX_LOADOUT_SLOTS, assertProgress, type HeroProgress } from '../sim/progression.ts'
import { isPackId, overStacked, packSlots, type PackId } from './pack.ts'
import { elitesFromClaimed } from './remembered.ts'
import { MAX_PAST_SETUPS, loadoutSlots } from './skillSlots.ts'
import { parseRuleStacks } from '../sim/automation.ts'
import type { PriorityRow, RuleStack } from '../sim/types.ts'
import type { PlannedPurchase } from './reincarnation.ts'

export const SAVE_VERSION = 1
export const SAVE_KEY = 'rpg.save.v1'
export const CORRUPT_KEY_PREFIX = 'rpg.save.corrupt.'

/** Character slots, decided in G6: 2 at the start, up to 5 through the milestones below. */
export const STARTING_SLOTS = 2
export const MAX_SLOTS = 5
/** The usual gold to carry: the rescue fee. */
export const DEFAULT_CARRY_GOLD = 25
/** Standing orders for time away: push on while HP is at least this percent. */
export const DEFAULT_PUSH_ON_PERCENT = 50
/** What a run does when the bag is nearly full: walk home, hold and wait for the player, or keep going (loot that does not fit is lost). */
export type BagFullOrder = 'home' | 'ask' | 'keep'
export const BAG_FULL_ORDERS: readonly BagFullOrder[] = ['home', 'ask', 'keep']
/** The run limits the preparation offers. 0 is no limit. */
/** Trainer drills a hero can buy within one level (GAME_DESIGN §9, "Gold sinks"). */
export const MAX_DRILLS_PER_LEVEL = 3
/** How long one Trainer drill takes, in milliseconds (GAME_DESIGN §9, "Gold sinks"). */
export const DRILL_MS = 45_000
export const REPEAT_LIMITS: readonly number[] = [0, 1, 3, 5, 10, 25]
export const DEFAULT_BAG_FULL_ORDER: BagFullOrder = 'home'
/** The usual retreat threshold: 40% of maximum HP. */
export const DEFAULT_RETREAT = 0.4
/** A new game knows the town and the road out of it. */
export const STARTING_DISCOVERIES = ['node:greyhaven', 'node:splintered-road'] as const
/** Slot 3, 4, and 5 unlock once each, the first time any hero reaches the milestone. */
export const SLOT_MILESTONES = ['first-return', 'first-reincarnation', 'first-warden-defeat'] as const

/** One crafting job. Costs were paid when it was queued, and only the first job advances. */
export type CraftJob =
  | {
      id: string
      kind: 'craft'
      heroId: string
      baseId: string
      itemLevel: number
      materialId: string
      modifierId: string | null
      remainingMs: number
      /** Index into the account's craft seed. Fixes the quality roll. */
      seedIndex: number
      /** The hero's proficiency rank when the job was queued. It sets the quality range. */
      rank: number
    }
  | {
      id: string
      kind: 'upgrade'
      heroId: string
      /** The item is held here while the upgrade runs. It returns to `slot` when that slot is still empty, else to the archive. */
      item: ItemInstance
      /** The slot the item was worn in, or absent when it came from the archive. */
      slot?: EquipmentSlotId
      /** True when another upgrade job for the same item follows: this job hands its result on instead of returning the item. Absent in older saves. */
      chained?: true
      materialId: string
      remainingMs: number
      seedIndex: number
      rank: number
    }
  | {
      id: string
      kind: 'socket'
      heroId: string
      /** Held here while the job runs, like an upgrade's item. */
      item: ItemInstance
      slot?: EquipmentSlotId
      /** The rare material (riftglass, duskiron, cinderite or bloodstone) that paid for it. */
      materialId: string
      remainingMs: number
      seedIndex: number
      rank: number
    }
  | {
      id: string
      kind: 'infuse'
      heroId: string
      item: ItemInstance
      slot?: EquipmentSlotId
      /** The second modifier the item gets. */
      modifierId: string
      materialId: string
      remainingMs: number
      seedIndex: number
      rank: number
    }

  | {
      id: string
      /** A crafted backpack (Step 13.22). The hero gets the pack when it ends. */
      kind: 'pack'
      heroId: string
      packId: PackId
      materialId: string
      remainingMs: number
      seedIndex: number
      rank: number
    }
  | {
      id: string
      kind: 'rank'
      heroId: string
      item: ItemInstance
      slot?: EquipmentSlotId
      /** Which of the item's modifiers is raised: 0 is the first, 1 the socket. */
      modifierIndex: number
      /** The rank it reaches, 2 or 3. */
      toRank: number
      materialId: string
      remainingMs: number
      seedIndex: number
      rank: number
    }

/** A contract the player has taken. Progress counts toward the contract's target. */
export type ActiveContract = {
  contractId: string
  progress: number
}

/** First-run coach. Older saves omit it and are treated as finished. A new game starts at `name`. */
export const TUTORIAL_STEPS = ['name', 'race', 'class', 'create', 'start', 'bank', 'home', 'again', 'push', 'fall', 'fee', 'pouch', 'back', 'done'] as const

export type TutorialStep = (typeof TUTORIAL_STEPS)[number]

/**
 * What the whole account shares: knowledge and character slots. Wealth is not shared, decided
 * 2026-11-03, so a grown hero cannot fund a new one (see `Purse`).
 */
export type AccountData = {
  /** Modifier recipes every hero can craft. */
  recipes: string[]
  /** Shared world discoveries: node ids from the world content, such as `node:splintered-road`. */
  discoveries: string[]
  slots: number
  /** One-time account milestones reached so far. Each one opens a character slot. */
  milestones: string[]
  /** First-run coach. Absent on a save from before the coach means finished. */
  tutorial?: TutorialStep
}

/** One hero's wealth and town business. Nothing in it moves between heroes. */
export type Purse = {
  gold: number
  /** Material id to quantity. */
  materials: { [materialId: string]: number }
  /** Contracts taken from the board, at most three. */
  contracts: ActiveContract[]
  /** Queued crafting jobs, no limit. Every hero's queue advances, the first job first. */
  craftQueue: CraftJob[]
  /** How many crafting rolls this hero has used. The next job takes this index. */
  craftCounter: number
  /** Gold owed from defeats. It is paid off at the town and blocks nothing. */
  debt: number
  /** Items this hero owns but is not wearing. */
  archive: ItemInstance[]
  /** Supply id to quantity in town. Packed supplies leave it for a run and unused ones come back. */
  supplies: { [supplyId: string]: number }
  /** This hero's contract board: rolled offers, taken ones included, at most `BOARD_SIZE` plus old held contracts. */
  board: ContractDef[]
  /** How many offers this hero's board has rolled. The next roll takes this index. */
  boardRolls: number
}

export function emptyPurse(): Purse {
  return { gold: 0, materials: {}, contracts: [], craftQueue: [], craftCounter: 0, debt: 0, archive: [], supplies: {}, board: [], boardRolls: 0 }
}

/** A held or offered contract: the hero's board first, then the old fixed contracts for saves that hold one. */
export function contractFor(purse: Purse, contractId: string): ContractDef | undefined {
  return purse.board.find((entry) => entry.id === contractId) ?? contractTable[contractId]
}

function assertContractDef(value: unknown, label: string): asserts value is ContractDef {
  check(isRecord(value), `${label} must be an object`)
  check(typeof value.id === 'string' && value.id.length > 0, `${label} is missing an id`)
  check(typeof value.name === 'string' && typeof value.description === 'string', `${label} is missing its text`)
  whole(value.count, `${label} count`)
  check((value.count as number) >= 1, `${label} count must be at least 1`)
  whole(value.level, `${label} level`)
  check(isRecord(value.target) && ['kill', 'fights', 'encounters', 'secure'].includes(String(value.target.kind)), `${label} target is unknown`)
  check(isRecord(value.reward), `${label} reward is missing`)
  const reward = value.reward as Record<string, unknown>
  whole(reward.xp, `${label} reward XP`)
  whole(reward.gold, `${label} reward gold`)
  whole(reward.materialQuantity, `${label} reward material`)
  check(typeof reward.materialId === 'string', `${label} reward material is missing`)
}

/** One hero's saved record. Combat state is rebuilt from this and the content tables. */
/** What a hero has bought with Legacy. */
export type HeroPurchases = {
  /** Starting attribute points bought, by attribute. Ten in total at most. */
  attributeSeeds: { strength: number; vitality: number; agility: number; intellect: number; spirit: number }
  /** Skill Point Seeds bought, up to 3. */
  skillSeeds: number
  /** Whether the Second Heirloom was bought. */
  secondHeirloom: boolean
  /** Whether Deep Pockets (+4 bag room) was bought. */
  deepPockets: boolean
  /** Head Start tiers bought: 0 none, 1 start at level 5, 2 start at level 10 (Step 13.18). */
  headStart: number
  /** Stockpile tiers bought, 0 to 3: the carried share becomes 30, 40 or 50% (Step 13.31). Absent means 0. */
  stockpile?: number
  /** Artisan's Favor tiers bought, 0 to 2: each new life starts with that many more free upgrade tokens. Absent means 0. */
  artisan?: number
  /** Long Memory tiers bought, 0 to 2: Recall reaches 3 or 6 levels above the peak. Absent means 0. */
  longMemory?: number
  /** Whether the Third Heirloom was bought. Absent means false. */
  thirdHeirloom?: boolean
  /** Whether the Fifth Skill Slot was bought: five equipped skills instead of four (Step 13.34). Absent means false. */
  fifthSlot?: boolean
}

export const EMPTY_PURCHASES: HeroPurchases = {
  attributeSeeds: { strength: 0, vitality: 0, agility: 0, intellect: 0, spirit: 0 },
  skillSeeds: 0,
  secondHeirloom: false,
  deepPockets: false,
  headStart: 0,
}

/** A hero's drills (Step 13.11). `queue` has 1 to `MAX_DRILLS_PER_LEVEL` entries; the first is running. */
export type TrainingQueue = { remainingMs: number; queue: { xp: number }[] }

/** Auto run mode (Step 13.26): rerun the route, keep going until a retreat or a defeat, or climb Echo ranks on the Bastion gate. */
export type AutoRunMode = 'repeat' | 'endless' | 'echo'

export type SavedHero = {
  id: string
  name: string
  classId: HeroClass
  progress: HeroProgress
  priorityRows: PriorityRow[]
  /** Extra named stacks of rules with a trigger. Empty keeps today's single list. */
  ruleStacks: RuleStack[]
  /** The vow a Cleric takes into an expedition. Null for other classes. */
  vow: string | null
  /** The Undead curse chosen for an expedition. Null when none. */
  curse: string | null
  /** The spells a Mage prepared. Empty takes the loadout order. */
  preparedSpells: string[]
  /** Personal world record: enemies this hero has defeated, and the nodes this hero has cleared. */
  defeatedEnemyIds: string[]
  /** Elites this hero defeated in earlier lives. Zone gates read them (never the Fracture Gate). Step 13.18. */
  rememberedEnemyIds?: string[]
  clearedNodeIds: string[]
  /** Zone nodes whose first-clear reward has been paid. Absent means none (Step 13.24); reincarnation keeps it. */
  firstClearIds?: string[]
  /** Unspent free upgrade tokens from first clears. Absent means 0. */
  freeUpgrades?: number
  /** Ids of the archive items kept from earlier lives. They sell at the carried share only (Step 13.31). Absent means none. */
  pastLifeItemIds?: string[]
  /** The loadout the hero had when the last life ended. Its skills return to the loadout as they are relearned (Step 13.37). Absent means none. */
  pastLoadout?: string[]
  /** The loadouts of the last three lives, newest first (Step 13.42). Replaces `pastLoadout`, which an old save may still hold. */
  pastLoadouts?: string[][]
  /** The between-lives planner's staged purchases and heirloom picks, kept across a reload (Step 13.43). Absent means no plan. Cleared at reincarnation. */
  nextLifePlan?: { purchases: PlannedPurchase[]; picks: string[] }
  /** Skills named by kept rules that this life cannot use yet. Those rules wait. Absent means none (Step 13.37). */
  waitingSkillIds?: string[]
  /** Retreat when HP falls to this fraction of maximum. Null never retreats. */
  retreatAtMost: number | null
  /** Special arrows a Ranger packs for an expedition. 0 for other classes. */
  specialAmmo: number
  /** Gold to carry into an expedition. The rest of the hero's gold stays deposited and safe. */
  carryGold: number
  /** Supply ids to pack into the slots, in slot order, at most four. A run takes what the stash has. */
  packedSupplies: string[]
  /** Standing order while away: push on to the next fight while HP is at least this whole percent of maximum, else walk home. */
  pushOnHpPercent: number
  /** Standing order while away: after a safe return, run the same route again if the hero has cleared it. */
  repeatRoute: boolean
  /** Standing order while away: stop starting runs once this many have ended in one catch-up. 0 is no limit. */
  repeatLimit: number
  /** Standing order: after this many fights in one run (1 to 99) the hero walks home instead of pushing on. Null is no limit. */
  stopAfterFights: number | null
  /** Live Auto run: at each hold the run decides like the away orders and repeats a cleared route on its own. Absent means off. */
  autoRun?: boolean
  /** Auto run session limit: total fights since Auto run was switched on (1 to 9999). Null or absent is no limit. */
  autoRunMaxFights?: number | null
  /** What Auto run does when the route's orders say go home: `repeat` (default, absent) reruns the route; `endless` keeps pushing on until a retreat, a defeat or the fight limit; `echo` climbs Echo ranks on the Bastion gate (Step 13.26). */
  autoRunMode?: AutoRunMode
  /** Auto run hands in finished contracts and takes board contracts that fit the route when it gets home (Step 13.26). Absent means off. */
  autoContracts?: boolean
  /** Auto run repairs worn gear at the normal price when it gets home (Step 13.49). Absent means off. */
  autoRepair?: boolean
  /** Trainer drills bought at the current level (0 to 3). Back to 0 whenever the level rises. */
  drillsThisLevel: number
  /** Drills paid for and not yet finished. `queue[0]` is the running drill with `remainingMs` left; each entry's XP was fixed when it was queued. Absent when none. */
  training?: TrainingQueue
  /** Standing order while away: when fewer than 4 bag room is free, walk home (`home`) or hold for the player (`ask`). */
  bagFullOrder: BagFullOrder
  /** Route to start on its own when the hero has no run as the player leaves. Null never starts one. */
  awayRouteId: string | null
  /** This hero's run while another hero is selected: the away route it keeps running in the background. Null when it has none. Promoted to `SaveData.expedition` when the hero is selected. */
  awayRun: ExpeditionState | null
  /** Safe returns per route (live or while away). At `MASTERY_RETURNS` the route is mastered for this hero. */
  routeReturns: { [routeId: string]: number }
  /** One-time content updates this hero already has (see `heroUpdates.ts`). */
  updates: string[]
  /** The highest Fractured Warden Echo rank this hero can fight. Each victory unlocks the next. Personal to the hero. */
  echoRank: number
  /** The Echo rank to fight on the next run to the Fracture Gate. At most `echoRank`. */
  fightRank: number
  /** A boss defeated this hero this life. Reincarnation needs it, and reincarnation clears it. */
  bossLossThisLife: boolean
  /** The crafted backpack (Step 13.22): 5 slots (Satchel) or 6 (Field Pack). Absent means none, 4 slots. Kept through reincarnation. */
  pack?: PackId
  /** The highest level this hero reached in a finished life. Recall doubles run XP below it. Absent until the first reincarnation after Step 13.18. */
  peakLevel?: number
  /** Reincarnation currency this hero has not spent. Bound to the hero and kept across lives. */
  legacy: number
  /** Lives this hero has completed by reincarnating. Mastery rank is this, up to 10. */
  lives: number
  /** Legacy purchases, kept across lives. */
  purchases: HeroPurchases
  /** One-time milestone bonuses already paid out, such as `elite:echo-knight` or `rank:2`. */
  claimedBonuses: string[]
  /** Crafting experience. Rank is `floor(√XP)` up to 10. Personal to the hero and kept through reincarnation. */
  craftXp: number
  /** Epoch ms at which the rest after a defeat ends. Absent or in the past means the hero can set out (GAME_DESIGN §8). */
  recoveryUntil?: number
  /** Equipped items. Gear is bound to its hero. */
  equipment: Equipment
  /** Gold, materials, unequipped items, contracts, crafting, and debt. Personal to the hero. */
  purse: Purse
}

export type SaveData = {
  version: typeof SAVE_VERSION
  account: AccountData
  heroes: SavedHero[]
  /** Id of the selected hero, or null while the roster is empty. */
  selectedHeroId: string | null
  /** The road run in progress. Null in town. */
  expedition: ExpeditionState | null
  /** Wall-clock time (ms since 1970) the game last saw the player. Offline catch-up counts from here. Null before the first save. */
  lastSeenAt: number | null
}

export type SaveLogger = (message: string, details?: unknown) => void

/** The slice of `localStorage` the save layer uses, so tests can pass a fake. */
export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type ParseResult = { ok: true; data: SaveData } | { ok: false; reason: string }

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; data: SaveData; bytes: number }
  | { kind: 'corrupt'; reason: string; backupKey: string | null }

export type WriteResult = { ok: true; bytes: number } | { ok: false; reason: string }

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

export function newSave(): SaveData {
  return {
    version: SAVE_VERSION,
    account: {
      recipes: [...STARTING_MODIFIER_RECIPES],
      discoveries: [...STARTING_DISCOVERIES],
      slots: STARTING_SLOTS,
      milestones: [],
      tutorial: 'name',
    },
    heroes: [],
    selectedHeroId: null,
    expedition: null,
    lastSeenAt: null,
  }
}

export function byteSize(text: string): number {
  return new TextEncoder().encode(text).length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function whole(value: unknown, label: string): asserts value is number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 0, `${label} must be a whole number of at least 0, received ${describeValue(value)}`)
}

function stringList(value: unknown, label: string): asserts value is string[] {
  check(Array.isArray(value), `${label} must be a list`)
  for (const entry of value) check(typeof entry === 'string' && entry.length > 0, `${label} has a bad entry ${describeValue(entry)}`)
}

function assertItem(value: unknown, label: string): asserts value is ItemInstance {
  check(isRecord(value), `${label} must be an object`)
  check(typeof value.id === 'string' && value.id.length > 0, `${label} is missing an id`)
  if (value.heirloom !== undefined) {
    check(isRecord(value.heirloom) && typeof value.heirloom.heroId === 'string', `${label} heirloom must name its hero`)
    whole(value.heirloom.cap, `${label} heirloom cap`)
  }
  check(typeof value.baseId === 'string' && itemBase(value.baseId) !== undefined, `${label} has an unknown base ${describeValue(value.baseId)}`)
  check(typeof value.itemLevel === 'number' && Number.isInteger(value.itemLevel) && value.itemLevel >= 1, `${label} item level must be a whole number of at least 1`)
  check(typeof value.quality === 'number' && value.quality > 0 && value.quality <= 2, `${label} quality must be above 0 and at most 2`)
  whole(value.maxDurability, `${label} maximum durability`)
  whole(value.durability, `${label} durability`)
  check(value.durability <= value.maxDurability, `${label} durability is above its maximum`)
  stringList(value.modifiers, `${label} modifiers`)
  for (const id of value.modifiers) check(ITEM_MODIFIERS[id] !== undefined, `${label} has an unknown modifier ${describeValue(id)}`)
  // An unknown unique id is allowed: it loads as a plain item with no signature (Step 14.6).
  check(value.uniqueId === undefined || (typeof value.uniqueId === 'string' && value.uniqueId.length > 0), `${label} unique id must be a non-empty text`)
  check(value.socketed === undefined || typeof value.socketed === 'boolean', `${label} socket flag must be true or false`)
  check(value.modifiers.length <= MAX_ITEM_MODIFIERS, `${label} holds ${value.modifiers.length} modifiers, at most ${MAX_ITEM_MODIFIERS}`)
  check(new Set(value.modifiers).size === value.modifiers.length, `${label} holds the same modifier twice`)
  if (value.modifierRanks !== undefined) {
    check(Array.isArray(value.modifierRanks) && value.modifierRanks.length <= value.modifiers.length, `${label} has more modifier ranks than modifiers`)
    value.modifierRanks.forEach((rank: unknown, index: number) => {
      check(typeof rank === 'number' && Number.isInteger(rank) && rank >= 1 && rank <= MODIFIER_RANK_MAX, `${label} modifier rank must be a whole number from 1 to ${MODIFIER_RANK_MAX}`)
      const modifier = ITEM_MODIFIERS[(value.modifiers as string[])[index] ?? '']
      check(rank === 1 || (modifier !== undefined && rankable(modifier)), `${label} has a rank on a modifier that cannot be ranked`)
    })
  }
  if (value.modifierTempers !== undefined) {
    check(Array.isArray(value.modifierTempers) && value.modifierTempers.length <= value.modifiers.length, `${label} has more modifier tempers than modifiers`)
    for (const temper of value.modifierTempers as unknown[]) {
      check(typeof temper === 'number' && Number.isInteger(temper) && temper >= 0 && temper <= MODIFIER_TEMPER_MAX, `${label} modifier temper must be a whole number from 0 to ${MODIFIER_TEMPER_MAX}`)
    }
  }
  check(value.modifiers.length < 2 || value.socketed === true, `${label} has a second modifier but no socket`)
}

function assertJob(value: unknown): asserts value is CraftJob {
  check(isRecord(value), 'craft job must be an object')
  check(typeof value.id === 'string' && value.id.length > 0, 'craft job is missing an id')
  check(['craft', 'upgrade', 'socket', 'infuse', 'rank', 'pack'].includes(String(value.kind)), 'craft job kind must be craft, upgrade, socket, infuse, rank or pack')
  check(typeof value.heroId === 'string', 'craft job is missing a hero')
  check(typeof value.materialId === 'string', 'craft job is missing a material')
  whole(value.remainingMs, 'craft job time')
  whole(value.seedIndex, 'craft job seed index')
  whole(value.rank, 'craft job rank')
  if (value.kind === 'craft') {
    check(typeof value.baseId === 'string' && itemBase(value.baseId) !== undefined, 'craft job has an unknown base')
    whole(value.itemLevel, 'craft job item level')
    check(value.modifierId === null || (typeof value.modifierId === 'string' && ITEM_MODIFIERS[value.modifierId] !== undefined), 'craft job has an unknown modifier')
  } else if (value.kind === 'pack') {
    check(isPackId(value.packId), 'pack job has an unknown pack')
  } else {
    assertItem(value.item, 'craft job item')
    check(
      value.slot === undefined || (typeof value.slot === 'string' && (EQUIPMENT_SLOT_IDS as readonly string[]).includes(value.slot)),
      'craft job slot is unknown',
    )
    check(value.chained === undefined || value.chained === true, 'craft job chained flag must be true or absent')
    if (value.kind === 'infuse') check(typeof value.modifierId === 'string' && ITEM_MODIFIERS[value.modifierId] !== undefined, 'infuse job has an unknown modifier')
    if (value.kind === 'rank') {
      whole(value.modifierIndex, 'rank job modifier slot')
      check(value.modifierIndex < MAX_ITEM_MODIFIERS && value.modifierIndex < (value.item as ItemInstance).modifiers.length, 'rank job names a modifier the item does not have')
      check(value.toRank === 2 || value.toRank === 3, 'rank job must go to rank 2 or 3')
    }
    check(value.kind === 'upgrade' || value.chained === undefined, 'only an upgrade job can be chained')
  }
}

function assertAccount(value: unknown): asserts value is AccountData {
  check(isRecord(value), 'account is missing')
  whole(value.slots, 'slots')
  check(value.slots >= STARTING_SLOTS && value.slots <= MAX_SLOTS, `slots must be from ${STARTING_SLOTS} through ${MAX_SLOTS}, received ${value.slots}`)
  stringList(value.recipes, 'recipes')
  stringList(value.discoveries, 'discoveries')
  stringList(value.milestones, 'milestones')
  check(value.milestones.length <= MAX_SLOTS - STARTING_SLOTS, 'too many milestones')
  if (value.tutorial !== undefined) {
    check(typeof value.tutorial === 'string' && (TUTORIAL_STEPS as readonly string[]).includes(value.tutorial), `tutorial step is unknown, received ${describeValue(value.tutorial)}`)
  }
}

function assertPurse(value: unknown, label: string, heroId: string): asserts value is Purse {
  check(isRecord(value), `${label} purse is missing`)
  whole(value.gold, `${label} gold`)
  check(isRecord(value.materials), `${label} materials must be an object`)
  for (const id of Object.keys(value.materials)) whole(value.materials[id], `${label} material ${id}`)
  whole(value.debt, `${label} debt`)
  whole(value.craftCounter, `${label} craft counter`)
  check(Array.isArray(value.board), `${label} contract board must be a list`)
  value.board.forEach((entry, index) => assertContractDef(entry, `${label} board offer ${index + 1}`))
  whole(value.boardRolls, `${label} board rolls`)
  const board = value.board as ContractDef[]
  const known = (id: string) => board.find((entry) => entry.id === id) ?? contractTable[id]
  check(Array.isArray(value.contracts) && value.contracts.length <= 3, `${label}: at most 3 contracts can be active`)
  const taken: string[] = []
  for (const entry of value.contracts) {
    check(isRecord(entry) && typeof entry.contractId === 'string' && known(entry.contractId) !== undefined, 'a contract id is unknown')
    whole(entry.progress, 'contract progress')
    check(entry.progress <= known(entry.contractId)!.count, 'contract progress is past its target')
    check(!taken.includes(entry.contractId), `contract ${entry.contractId} is taken twice`)
    taken.push(entry.contractId)
  }
  check(Array.isArray(value.craftQueue), `${label}: the craft queue must be a list`)
  for (const job of value.craftQueue) {
    assertJob(job)
    check(job.heroId === heroId, `${label} craft job ${job.id} belongs to another hero`)
  }
  check(isRecord(value.supplies), `${label} supplies must be an object`)
  for (const id of Object.keys(value.supplies)) {
    check(supplyTable[id] !== undefined, `${label} has unknown supply ${id}`)
    whole(value.supplies[id], `${label} supply ${id}`)
  }
  check(Array.isArray(value.archive), `${label} archive must be a list`)
  const archiveIds: string[] = []
  value.archive.forEach((item, index) => {
    assertItem(item, `${label} archive item ${index + 1}`)
    check(!archiveIds.includes(item.id), `item id ${item.id} is duplicated`)
    archiveIds.push(item.id)
  })
}

function assertHero(value: unknown, index: number): asserts value is SavedHero {
  const label = `hero ${index + 1}`
  check(isRecord(value), `${label} must be an object`)
  check(typeof value.id === 'string' && value.id.length > 0, `${label} is missing an id`)
  check(typeof value.name === 'string' && value.name.length > 0, `${label} is missing a name`)
  check(
    typeof value.classId === 'string' && (HERO_CLASSES as readonly string[]).includes(value.classId),
    `${label} has an unknown class ${describeValue(value.classId)}`,
  )
  assertProgress(value.progress)
  check(Array.isArray(value.priorityRows), `${label} priority rows must be a list`)
  for (const row of value.priorityRows) {
    check(isRecord(row) && typeof row.skillId === 'string', `${label} has a bad priority row`)
  }
  const stacks = parseRuleStacks(value.ruleStacks, { enemies, skills, statuses })
  check(stacks.ok, `${label} rule stacks are invalid: ${stacks.ok ? '' : stacks.reason}`)
  check(value.vow === null || typeof value.vow === 'string', `${label} vow must be text or null`)
  check(value.curse === null || typeof value.curse === 'string', `${label} curse must be text or null`)
  stringList(value.preparedSpells, `${label} prepared spells`)
  stringList(value.defeatedEnemyIds, `${label} defeated enemies`)
  stringList(value.clearedNodeIds, `${label} cleared nodes`)
  check(
    value.retreatAtMost === null ||
      (typeof value.retreatAtMost === 'number' && value.retreatAtMost > 0 && value.retreatAtMost < 1),
    `${label} retreat threshold must be between 0 and 1, or null`,
  )
  whole(value.specialAmmo, `${label} special arrows`)
  whole(value.carryGold, `${label} carried gold`)
  whole(value.pushOnHpPercent, `${label} push-on percent`)
  check((value.pushOnHpPercent as number) >= 1 && (value.pushOnHpPercent as number) <= 100, `${label} push-on percent must be from 1 to 100`)
  check(typeof value.repeatRoute === 'boolean', `${label} repeat route must be true or false`)
  check(typeof value.repeatLimit === 'number' && REPEAT_LIMITS.includes(value.repeatLimit), `${label} run limit must be one of ${REPEAT_LIMITS.join(', ')}`)
  check(
    value.stopAfterFights === null || (typeof value.stopAfterFights === 'number' && Number.isInteger(value.stopAfterFights) && value.stopAfterFights >= 1 && value.stopAfterFights <= 99),
    `${label} stop-after-fights must be a whole number from 1 to 99, or null`,
  )
  check(value.rememberedEnemyIds === undefined || (Array.isArray(value.rememberedEnemyIds) && value.rememberedEnemyIds.every((id: unknown) => typeof id === 'string')), `${label} remembered enemies must be a list of text`)
  check(value.firstClearIds === undefined || (Array.isArray(value.firstClearIds) && value.firstClearIds.every((id: unknown) => typeof id === 'string')), `${label} first clears must be a list of text`)
  check(value.freeUpgrades === undefined || (typeof value.freeUpgrades === 'number' && Number.isInteger(value.freeUpgrades) && value.freeUpgrades >= 0), `${label} free upgrades must be a whole number, 0 or more`)
  check(value.autoRun === undefined || typeof value.autoRun === 'boolean', `${label} auto run must be true or false`)
  check(value.autoContracts === undefined || typeof value.autoContracts === 'boolean', `${label} auto contracts must be true or false`)
  check(value.autoRepair === undefined || typeof value.autoRepair === 'boolean', `${label} auto repair must be true or false`)
  check(value.autoRunMode === undefined || value.autoRunMode === 'repeat' || value.autoRunMode === 'endless' || value.autoRunMode === 'echo', `${label} auto run mode must be repeat, endless or echo`)
  check(
    value.autoRunMaxFights === undefined ||
      value.autoRunMaxFights === null ||
      (typeof value.autoRunMaxFights === 'number' && Number.isInteger(value.autoRunMaxFights) && value.autoRunMaxFights >= 1 && value.autoRunMaxFights <= 9999),
    `${label} auto run fight limit must be a whole number from 1 to 9999, or null`,
  )
  check(
    typeof value.drillsThisLevel === 'number' && Number.isInteger(value.drillsThisLevel) && value.drillsThisLevel >= 0 && value.drillsThisLevel <= MAX_DRILLS_PER_LEVEL,
    `${label} drills this level must be a whole number from 0 to ${MAX_DRILLS_PER_LEVEL}`,
  )
  if (value.training !== undefined) {
    const training = value.training
    check(isRecord(training), `${label} training must be an object`)
    whole(training.remainingMs, `${label} drill time left`)
    check((training.remainingMs as number) > 0 && (training.remainingMs as number) <= DRILL_MS, `${label} drill time left must be from 1 to ${DRILL_MS}`)
    check(Array.isArray(training.queue) && training.queue.length >= 1 && training.queue.length <= MAX_DRILLS_PER_LEVEL, `${label} drill queue must hold 1 to ${MAX_DRILLS_PER_LEVEL} drills`)
    for (const drill of training.queue as unknown[]) {
      check(isRecord(drill), `${label} each queued drill must be an object`)
      check(typeof drill.xp === 'number' && Number.isInteger(drill.xp) && drill.xp >= 1, `${label} each queued drill needs whole XP of at least 1`)
    }
  }
  check(value.bagFullOrder === 'home' || value.bagFullOrder === 'ask' || value.bagFullOrder === 'keep', `${label} bag-full order must be home, ask or keep`)
  check(value.awayRouteId === null || typeof value.awayRouteId === 'string', `${label} away route must be a route id or null`)
  check(isRecord(value.routeReturns), `${label} route returns must be an object`)
  for (const [routeId, count] of Object.entries(value.routeReturns)) whole(count, `${label} safe returns on ${routeId}`)
  if (value.awayRun !== null) {
    check(isRecord(value.awayRun), `${label} away run must be an object or null`)
    assertExpedition(value.awayRun as unknown as ExpeditionState)
  }
  stringList(value.packedSupplies, `${label} packed supplies`)
  stringList(value.updates, `${label} updates`)
  check(value.recoveryUntil === undefined || (typeof value.recoveryUntil === 'number' && Number.isFinite(value.recoveryUntil)), `${label} recovery time must be a number`)
  check(value.pack === undefined || isPackId(value.pack), `${label} pack must be satchel or fieldPack`)
  const slotCount = packSlots({ pack: value.pack as PackId | undefined })
  check(value.packedSupplies.length <= slotCount, `${label} packs more than ${slotCount} supplies`)
  check(overStacked(value.packedSupplies, slotCount) === null, `${label} packs more than ${SUPPLY_STACK_LIMIT} of one supply`)
  for (const id of value.packedSupplies) check(supplyTable[id] !== undefined, `${label} packs unknown supply ${id}`)
  whole(value.craftXp, `${label} crafting experience`)
  whole(value.legacy, `${label} Legacy`)
  whole(value.lives, `${label} lives`)
  check(value.peakLevel === undefined || (typeof value.peakLevel === 'number' && Number.isInteger(value.peakLevel) && value.peakLevel >= 1), `${label} peak level must be a whole number from 1`)
  stringList(value.claimedBonuses, `${label} claimed bonuses`)
  check(isRecord(value.purchases), `${label} purchases must be an object`)
  check(isRecord(value.purchases.attributeSeeds), `${label} attribute seeds must be an object`)
  let seeds = 0
  for (const key of ['strength', 'vitality', 'agility', 'intellect', 'spirit']) {
    whole(value.purchases.attributeSeeds[key], `${label} ${key} seeds`)
    seeds += value.purchases.attributeSeeds[key] as number
  }
  check(seeds <= 10, `${label} has more than 10 attribute seeds`)
  whole(value.purchases.skillSeeds, `${label} skill seeds`)
  check((value.purchases.skillSeeds as number) <= 3, `${label} has more than 3 skill seeds`)
  check(typeof value.purchases.secondHeirloom === 'boolean', `${label} second heirloom must be true or false`)
  check(typeof value.purchases.deepPockets === 'boolean', `${label} deep pockets must be true or false`)
  check(
    typeof value.purchases.headStart === 'number' && Number.isInteger(value.purchases.headStart) && value.purchases.headStart >= 0 && value.purchases.headStart <= 3,
    `${label} head start must be 0, 1, 2 or 3`,
  )
  for (const [key, max, text] of [['stockpile', 3, 'stockpile'], ['artisan', 2, "artisan's favor"], ['longMemory', 2, 'long memory']] as const) {
    const tier = value.purchases[key]
    check(tier === undefined || (typeof tier === 'number' && Number.isInteger(tier) && tier >= 0 && tier <= max), `${label} ${text} must be a whole number from 0 to ${max}`)
  }
  check(value.purchases.thirdHeirloom === undefined || typeof value.purchases.thirdHeirloom === 'boolean', `${label} third heirloom must be true or false`)
  check(value.purchases.fifthSlot === undefined || typeof value.purchases.fifthSlot === 'boolean', `${label} fifth slot must be true or false`)
  const slots = loadoutSlots({ purchases: value.purchases as HeroPurchases })
  check(value.progress.loadout.length <= slots, `${label} equips more than ${slots} skills`)
  if (value.pastLoadout !== undefined) {
    stringList(value.pastLoadout, `${label} past loadout`)
    check(value.pastLoadout.length <= MAX_LOADOUT_SLOTS, `${label} past loadout holds at most ${MAX_LOADOUT_SLOTS} skills`)
  }
  if (value.nextLifePlan !== undefined) {
    const plan = value.nextLifePlan as unknown as { purchases: unknown[]; picks: string[] }
    check(typeof plan === 'object' && plan !== null && Array.isArray(plan.purchases) && Array.isArray(plan.picks), `${label} next life plan must have purchases and picks`)
    check(plan.purchases.length <= 40, `${label} next life plan holds too many purchases`)
    check(plan.purchases.every((entry) => typeof entry === 'object' && entry !== null && typeof (entry as { kind?: unknown }).kind === 'string' && ((entry as { attribute?: unknown }).attribute === undefined || typeof (entry as { attribute?: unknown }).attribute === 'string')), `${label} next life plan purchases must name a kind`)
    // A blank pick is an empty heirloom slot, so empty text is allowed here.
    check(plan.picks.every((id) => typeof id === 'string'), `${label} next life plan picks must be text`)
    check(plan.picks.length <= 3, `${label} next life plan holds at most 3 heirloom picks`)
  }
  if (value.pastLoadouts !== undefined) {
    check(Array.isArray(value.pastLoadouts) && value.pastLoadouts.length <= MAX_PAST_SETUPS, `${label} past loadouts hold at most ${MAX_PAST_SETUPS} lives`)
    for (const setup of value.pastLoadouts) {
      stringList(setup, `${label} past loadout`)
      check(setup.length <= MAX_LOADOUT_SLOTS, `${label} past loadout holds at most ${MAX_LOADOUT_SLOTS} skills`)
    }
  }
  if (value.waitingSkillIds !== undefined) stringList(value.waitingSkillIds, `${label} waiting skills`)
  check(value.pastLifeItemIds === undefined || (Array.isArray(value.pastLifeItemIds) && value.pastLifeItemIds.every((id: unknown) => typeof id === 'string')), `${label} earlier-life items must be a list of text`)
  whole(value.echoRank, `${label} Echo rank`)
  whole(value.fightRank, `${label} fight rank`)
  check(value.fightRank <= value.echoRank, `${label} fight rank is above the Echo rank it has unlocked`)
  check(typeof value.bossLossThisLife === 'boolean', `${label} boss loss must be true or false`)
  check(isRecord(value.equipment), `${label} equipment must be an object`)
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = value.equipment[slot]
    check(item !== undefined, `${label} equipment is missing the ${slot} slot`)
    if (item !== null) assertItem(item, `${label} ${slot}`)
  }
  assertPurse(value.purse, label, value.id)
}

/** Version 1 shape check. Throws a readable message on the first problem. */
export function assertSaveData(value: unknown): asserts value is SaveData {
  check(isRecord(value), 'save must be an object')
  check(value.version === SAVE_VERSION, `unknown save version ${describeValue(value.version)}`)
  assertAccount(value.account)
  check(Array.isArray(value.heroes), 'heroes must be a list')
  const ids: string[] = []
  value.heroes.forEach((hero, index) => {
    assertHero(hero, index)
    check(!ids.includes(hero.id), `hero id ${hero.id} is duplicated`)
    ids.push(hero.id)
  })
  check(
    value.selectedHeroId === null || (typeof value.selectedHeroId === 'string' && ids.includes(value.selectedHeroId)),
    `selected hero ${describeValue(value.selectedHeroId)} is not in the roster`,
  )
  check(value.lastSeenAt === null || (typeof value.lastSeenAt === 'number' && Number.isFinite(value.lastSeenAt) && value.lastSeenAt >= 0), 'last seen time must be a number or null')
  if (value.expedition !== null) {
    check(isRecord(value.expedition), 'expedition must be an object or null')
    assertExpedition(value.expedition as unknown as ExpeditionState)
  }
}

export function serializeSave(data: SaveData): string {
  assertSaveData(data)
  return JSON.stringify(data)
}

const PURSE_KEYS = ['gold', 'materials', 'contracts', 'craftQueue', 'craftCounter', 'debt', 'archive'] as const

/**
 * Saves from before 2026-11-03 kept gold, materials, items, contracts, crafting, and debt on the
 * account. They move to the selected hero (or the first hero when none is selected). A queued
 * craft job goes to the hero who queued it. Every other hero starts with an empty purse.
 */
function splitAccountPurse(parsed: Record<string, unknown>): void {
  const account = parsed.account
  if (!isRecord(account) || !PURSE_KEYS.some((key) => key in account)) return
  const old: Record<string, unknown> = {}
  for (const key of PURSE_KEYS) {
    old[key] = account[key]
    delete account[key]
  }
  const heroes = Array.isArray(parsed.heroes) ? parsed.heroes.filter(isRecord) : []
  for (const hero of heroes) if (hero.purse === undefined) hero.purse = emptyPurse()
  const receiver = heroes.find((hero) => hero.id === parsed.selectedHeroId) ?? heroes[0]
  if (receiver === undefined) return
  const target = receiver.purse as Record<string, unknown>
  for (const key of ['gold', 'materials', 'contracts', 'craftCounter', 'debt', 'archive'] as const) {
    if (old[key] !== undefined) target[key] = old[key]
  }
  const jobs = Array.isArray(old.craftQueue) ? old.craftQueue : []
  for (const job of jobs) {
    const owner = (isRecord(job) ? heroes.find((hero) => hero.id === job.heroId) : undefined) ?? receiver
    const queue = (owner.purse as Record<string, unknown>).craftQueue as unknown[]
    queue.push(isRecord(job) ? { ...job, heroId: owner.id } : job)
  }
}

/** Saves from before the world record existed get empty lists. Nothing else is guessed. */
function fillWorldFields(parsed: unknown): void {
  if (!isRecord(parsed)) return
  if (parsed.lastSeenAt === undefined) parsed.lastSeenAt = null
  if (isRecord(parsed.account) && parsed.account.milestones === undefined) parsed.account.milestones = []
  if (isRecord(parsed.account) && parsed.account.tutorial === undefined) parsed.account.tutorial = 'done'
  splitAccountPurse(parsed)
  if (!Array.isArray(parsed.heroes)) return
  for (const hero of parsed.heroes) {
    if (!isRecord(hero)) continue
    if (hero.ruleStacks === undefined) hero.ruleStacks = []
    if (hero.defeatedEnemyIds === undefined) hero.defeatedEnemyIds = []
    if (hero.clearedNodeIds === undefined) hero.clearedNodeIds = []
    if (hero.retreatAtMost === undefined) hero.retreatAtMost = DEFAULT_RETREAT
    if (hero.specialAmmo === undefined) hero.specialAmmo = 0
    if (hero.carryGold === undefined) hero.carryGold = DEFAULT_CARRY_GOLD
    if (hero.packedSupplies === undefined) hero.packedSupplies = []
    if (hero.pushOnHpPercent === undefined) hero.pushOnHpPercent = DEFAULT_PUSH_ON_PERCENT
    if (hero.repeatRoute === undefined) hero.repeatRoute = true
    if (hero.repeatLimit === undefined) hero.repeatLimit = 0
    if (hero.stopAfterFights === undefined) hero.stopAfterFights = null
    if (hero.drillsThisLevel === undefined) hero.drillsThisLevel = 0
    if (hero.bagFullOrder === undefined) hero.bagFullOrder = DEFAULT_BAG_FULL_ORDER
    if (hero.awayRouteId === undefined) hero.awayRouteId = null
    if (hero.awayRun === undefined) hero.awayRun = null
    if (hero.routeReturns === undefined) hero.routeReturns = {}
    if (hero.updates === undefined) hero.updates = []
    if (hero.craftXp === undefined) hero.craftXp = 0
    if (hero.legacy === undefined) hero.legacy = 0
    if (hero.lives === undefined) hero.lives = 0
    if (hero.claimedBonuses === undefined) hero.claimedBonuses = []
    if (hero.purchases === undefined) hero.purchases = JSON.parse(JSON.stringify(EMPTY_PURCHASES))
    if (isRecord(hero.purchases) && hero.purchases.deepPockets === undefined) hero.purchases.deepPockets = false
    if (isRecord(hero.purchases) && hero.purchases.headStart === undefined) hero.purchases.headStart = 0
    if (hero.rememberedEnemyIds === undefined && typeof hero.lives === 'number' && hero.lives > 0 && Array.isArray(hero.claimedBonuses)) {
      hero.rememberedEnemyIds = elitesFromClaimed(hero.claimedBonuses.filter((id): id is string => typeof id === 'string'))
    }
    if (hero.echoRank === undefined) hero.echoRank = 0
    if (hero.fightRank === undefined) hero.fightRank = 0
    if (hero.bossLossThisLife === undefined) hero.bossLossThisLife = false
    if (hero.equipment === undefined && typeof hero.id === 'string' && (HERO_CLASSES as readonly string[]).includes(String(hero.classId))) {
      hero.equipment = starterEquipment(hero.id, hero.classId as HeroClass)
    }
    if (hero.purse === undefined) hero.purse = emptyPurse()
    if (isRecord(hero.purse) && hero.purse.supplies === undefined) hero.purse.supplies = {}
    if (isRecord(hero.purse) && hero.purse.board === undefined) hero.purse.board = []
    if (isRecord(hero.purse) && hero.purse.boardRolls === undefined) hero.purse.boardRolls = 0
  }
}

export function parseSave(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'the save is not valid JSON' }
  }
  fillWorldFields(parsed)
  try {
    assertSaveData(parsed)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true, data: applyHeroUpdates(parsed) }
}

/**
 * Read the save. A missing entry is an empty start. A corrupt or unknown-version entry is copied
 * to `rpg.save.corrupt.<timestamp>` and left in place, so nothing is lost and the caller can
 * show an error and offer a new game.
 */
export function loadSave(storage: StorageLike, nowMs: number, log?: SaveLogger): LoadResult {
  const raw = storage.getItem(SAVE_KEY)
  if (raw === null) {
    log?.('no save found')
    return { kind: 'empty' }
  }
  const parsed = parseSave(raw)
  if (parsed.ok) {
    const bytes = byteSize(raw)
    log?.('loaded', { bytes, heroes: parsed.data.heroes.length, expedition: parsed.data.expedition !== null })
    return { kind: 'loaded', data: parsed.data, bytes }
  }
  const backupKey = `${CORRUPT_KEY_PREFIX}${nowMs}`
  let stored: string | null = backupKey
  try {
    storage.setItem(backupKey, raw)
  } catch {
    stored = null
  }
  log?.('corrupt save', { reason: parsed.reason, backupKey: stored, bytes: byteSize(raw) })
  return { kind: 'corrupt', reason: parsed.reason, backupKey: stored }
}

/** Write the save. A full or blocked store returns a reason and leaves the old entry alone. */
export function writeSave(storage: StorageLike, data: SaveData, log?: SaveLogger): WriteResult {
  let text: string
  try {
    text = serializeSave(data)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    log?.('save rejected', { reason })
    return { ok: false, reason }
  }
  try {
    storage.setItem(SAVE_KEY, text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    log?.('save failed', { reason })
    return { ok: false, reason }
  }
  const bytes = byteSize(text)
  log?.('saved', { bytes })
  return { ok: true, bytes }
}

/** Remove the live save for a new game. Corrupt backups stay. */
export function clearSave(storage: StorageLike): void {
  storage.removeItem(SAVE_KEY)
}

/**
 * Record a one-time milestone. The first time only, it opens the next character slot.
 * Returns the account unchanged when the milestone was already reached.
 */
export function reachMilestone(account: AccountData, milestone: (typeof SLOT_MILESTONES)[number]): AccountData {
  if (account.milestones.includes(milestone)) return account
  const milestones = [...account.milestones, milestone]
  return { ...account, milestones, slots: Math.min(MAX_SLOTS, STARTING_SLOTS + milestones.length) }
}

/** The purse of a hero, by default the selected one. An empty roster has an empty purse. */
export function purseOf(save: SaveData, heroId: string | null = save.selectedHeroId): Purse {
  return save.heroes.find((hero) => hero.id === heroId)?.purse ?? emptyPurse()
}

/** Replace a hero's purse, by default the selected hero's. */
export function withPurse(save: SaveData, purse: Purse, heroId: string | null = save.selectedHeroId): SaveData {
  if (!save.heroes.some((hero) => hero.id === heroId)) throw new Error(`no hero ${String(heroId)} to hold a purse`)
  return { ...save, heroes: save.heroes.map((hero) => (hero.id === heroId ? { ...hero, purse } : hero)) }
}

/** Change some purse fields of a hero, by default the selected hero. */
export function updatePurse(save: SaveData, patch: Partial<Purse>, heroId: string | null = save.selectedHeroId): SaveData {
  return withPurse(save, { ...purseOf(save, heroId), ...patch }, heroId)
}
