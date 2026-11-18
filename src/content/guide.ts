import type { HeroClass } from '../sim/constants.ts'
import type { ClericVow } from '../sim/classes/cleric.ts'
import type { HeroRace } from '../sim/progression.ts'

/*
 * Hand-written text for the in-game Guide (GAME_DESIGN §12, "Guide page").
 * Rule: NO DIGITS in any string here. Every number the Guide shows is generated from the content and
 * sim definitions (src/ui/guide/guideIndex.ts), so this text cannot go stale. guide.test.ts enforces it.
 */

export type GuideTopicId = 'getting-started' | 'rules' | 'expeditions' | 'supplies-crafting' | 'reincarnation'

export type GuideTopic = {
  id: GuideTopicId
  title: string
  summary: string
  body: string[]
}

export const GUIDE_TOPICS: readonly GuideTopic[] = [
  {
    id: 'getting-started',
    title: 'The loop',
    summary: 'Create a hero, set its rules, prepare in town, send it down the road, and grow stronger.',
    body: [
      'Lead a hero out of Greyhaven along the Splintered Road, gather loot, and grow strong enough to face the Fractured Warden at the Fracture Gate.',
      'You do not press attack buttons. Fights play out by themselves from the rules you set, so most of the game is preparation: choosing a race and class, spending attribute and skill points, wearing better gear, setting rules, and packing supplies.',
      'In town you sell loot, buy and brew supplies, craft and repair gear, and take contracts. On the map you pick a route and start an expedition. The hero walks, fights, and collects loot until you call it home, it retreats, or it falls.',
      'Loot is only safe once the hero is back in Greyhaven. Pushing on earns more but risks everything you carry.',
    ],
  },
  {
    id: 'rules',
    title: 'Rules (automation)',
    summary: 'A hero uses its skills from an ordered list of rules you write.',
    body: [
      'Rules live in Combat setup. The hero tries the first rule, then the next, and uses the first skill whose conditions pass. Put the situations you care about most at the top and a cheap fallback at the bottom.',
      'A rule names a skill and optional conditions, such as the hero or enemy health, the class resource, a status on a target, or whether the enemy has telegraphed an attack. Supplies work the same way: a rule can drink a draught when health is low.',
      'Rule templates give you a working starting point for each class. The list shows how often each rule fires, so you can see which rules do the work and which never trigger.',
    ],
  },
  {
    id: 'expeditions',
    title: 'Expeditions and risk',
    summary: 'Walk a route, fight what you meet, and decide when to push on or return.',
    body: [
      'An expedition follows a route from town. The hero walks between fights, and each win adds loot that stays unsecured until the hero reaches town again.',
      'After each fight you can push on or return. Pushing on builds momentum, which improves enemy-material rewards and the chance of finding rare route resources, but it risks everything you carry. Returning secures the loot and clears momentum.',
      'Auto run repeats this by your standing orders: it pushes on or walks home after each fight and reruns the route after each safe return, so the hero keeps working while you are away.',
      'Retreat is automatic. Set the health level at which the hero tries to escape. Escape is a roll, not a promise: enemies keep acting while it is attempted, and a failed attempt can be retried later. A successful escape abandons the current fight and its loot, then walks home safely.',
      'Defeat has weight. Unsecured loot is lost, equipment loses durability, and a rescue fee is taken from the gold you carried; unpaid fees become debt. The hero must also rest before the next expedition. Gold you deposited stays safe.',
      'Gear also wears down slowly from ordinary fighting. A piece at no durability is disabled until repaired, never destroyed.',
    ],
  },
  {
    id: 'supplies-crafting',
    title: 'Supplies and crafting',
    summary: 'Buy or brew consumables, pack them for the road, and craft gear from what you collect.',
    body: [
      'Supplies are consumables packed before an expedition. The pack has a small number of slots, so choose what the route needs: healing, a cure for a status, or a ward against a big attack.',
      'Most supplies are used by a rule. Write a rule that names the supply and the situation, or start from a template. A few are used by the expedition itself, such as the Smoke Bomb that improves one escape roll.',
      'Greyhaven sells the basic supplies for gold. Better ones cannot be bought and are brewed at the Potion Shop from materials the hero collected, once the account has done what that supply asks for.',
      'Materials from enemies and route nodes feed crafting. Crafting and brewing take real time and finish while you play or while you are away.',
    ],
  },
  {
    id: 'reincarnation',
    title: 'Reincarnation',
    summary: 'After losing to a boss, a hero may start a new life with permanent Legacy gains.',
    body: [
      'Reincarnation unlocks after the hero has lost to a boss. It is optional, and losing does not reward you by itself.',
      'Level and experience turn into Legacy, a currency that stays with that hero. Reaching a boss, zone, or difficulty milestone for the first time gives a one-time bonus. Legacy buys small permanent gains, new nodes, and starting options.',
      'Reincarnating resets level, experience, attributes, the skill web, the hero’s world progress, and its contracts. Mastery, purchases, Legacy, discoveries, recipes, crafting, gold, materials, and the archive stay. Worn gear goes to the archive, and one heirloom can be chosen to carry over.',
      'The elites you beat are remembered, so the zones they guard stay open in the next life.',
    ],
  },
]

export type TipEntry = { tips: string[] }

export const classGuide: Record<HeroClass, TipEntry> = {
  warrior: {
    tips: [
      'Hold Fury for a heavy attack: the held amount adds to your physical damage, so spend it on your best skill rather than the first one that is ready.',
      'Taking hits also builds Fury, so a sturdy Warrior with a shield gets stronger as the fight gets harder.',
      'Two-handed skills need a two-handed weapon and shield skills need a shield. Check the equipment before you write the rule.',
    ],
  },
  assassin: {
    tips: [
      'Mark your target first, then build Advantage with crits and evasion, and let Execute spend it on the finish.',
      'Poison stacks over time, so it shines against tough enemies that live a long time.',
      'High evasion is your defence. Skills that raise it protect you better than armor does.',
    ],
  },
  ranger: {
    tips: [
      'Readiness fills while the hero travels, so a Ranger starts each fight ready to open with aimed shots and traps.',
      'Special arrows sit in a quiver and are spent by certain skills. Keep an eye on how many are left.',
      'Longer runs favour the Ranger: momentum from consecutive wins can become damage and Readiness.',
    ],
  },
  mage: {
    tips: [
      'There is no ordinary attack. Arcane Bolt is the cheap fallback, so keep it as the last rule so the Mage never stands idle.',
      'Watch Mana in your conditions: use Arcane Recovery when Mana is low, not on a timer.',
      'Fire, frost, and lightning each work with a status, so pick spells that suit the enemy you expect.',
    ],
  },
  cleric: {
    tips: [
      'Choose your vow before leaving town. It decides how Faith is gained and cannot change during that expedition.',
      'Faith is spent on healing, wards, and Judgment. Do not spend it all on the first heal; keep some for an emergency.',
      'Penance trades health for Faith, so use it only when you can afford the cost.',
    ],
  },
}

export const raceGuide: Record<HeroRace, TipEntry> = {
  human: {
    tips: [
      'Humans have no meter to manage. They gain experience a little faster and start with even attributes, which makes them a good first choice.',
      'Their racial branch rewards spreading points across the class clusters.',
    ],
  },
  elf: {
    tips: [
      'Keep Focus high by acting successfully and avoiding direct damage. High Focus raises the lowest damage roll.',
      'Fast enemies that hurt you often undo Focus, so pair Elves with defence or evasion.',
    ],
  },
  beastfolk: {
    tips: [
      'Ferocity builds with victories during an expedition, so Beastfolk are strongest deep into a long run.',
      'Returning to town resets the climb, so decide whether one more fight is worth the risk.',
    ],
  },
  undead: {
    tips: [
      'Stillness rewards patience: a few actions in a row without taking direct damage charge a powerful strike.',
      'Undead pair well with classes that avoid damage, or with a barrier that absorbs hits.',
    ],
  },
}

export type VowGuideEntry = { name: string; when: string; note: string }

export const vowGuide: Record<ClericVow, VowGuideEntry> = {
  zeal: {
    name: 'Vow of Zeal',
    when: 'Generates Faith when one of your actions deals direct HP damage, at most once per action.',
    note: 'The most aggressive vow. It rewards a Cleric that attacks often.',
  },
  endurance: {
    name: 'Vow of Endurance',
    when: 'Generates Faith for every percent of your maximum HP you lose or a barrier absorbs, with a cap on how much one enemy action can give.',
    note: 'Turns damage taken into Faith, so it suits a sturdy Cleric that can take a beating.',
  },
  temperance: {
    name: 'Vow of Temperance',
    when: 'Generates Faith after one of your actions ends while your HP sits in a middle band, without overhealing or wasting resource.',
    note: 'Rewards steady play: heal before you drop too low and do not top up when you do not need to.',
  },
}

export const VOW_GENERAL_NOTE =
  'Your vow is locked for the whole expedition. Failing an ordinary vow condition only stops Faith generation; it is not a penalty. The Exalted Vow keystone adds a real penalty for breaking the vow.'

export const statusGuide: Record<string, { summary: string }> = {
  bleed: { summary: 'Damage over time that triggers when the target acts, so fast enemies bleed more often. Each stack lasts for a few of the target’s actions.' },
  poison: { summary: 'All stacks share one duration, and new applications refresh it. Combined poison damage ticks at a steady pace.' },
  burn: { summary: 'Fire damage over time. Applying it again raises the intensity and refreshes the shared duration.' },
  chill: { summary: 'Slows the target’s actions. Each stack slows a little more than the last, and reapplication refreshes the duration.' },
  stun: { summary: 'Pushes the target’s next action later by a short time instead of freezing it.' },
  mark: { summary: 'A guaranteed target designation. What it enables depends on the class that uses it.' },
  expose: { summary: 'Lowers armor and or resistance. Only the strongest Expose on a target counts, and new applications refresh its duration.' },
}

/** Class-owned skills that no web node or starting slot names directly. The value says how the hero gets them. */
export const EXTRA_CLASS_SKILLS: Record<string, { classId: HeroClass; unlockedBy: string }> = {
  'arcane-bolt': { classId: 'mage', unlockedBy: 'Always known' },
  'thermal-rupture': { classId: 'mage', unlockedBy: 'Elemental Convergence keystone' },
  'stormglass-aegis': { classId: 'mage', unlockedBy: 'Elemental Convergence keystone' },
  'steam-burst': { classId: 'mage', unlockedBy: 'Elemental Convergence keystone' },
  'plasma-lance': { classId: 'mage', unlockedBy: 'Elemental Convergence keystone' },
  'flash-freeze': { classId: 'mage', unlockedBy: 'Elemental Convergence keystone' },
  supercell: { classId: 'mage', unlockedBy: 'Elemental Convergence keystone' },
}

/** Internal follow-up skills that exist only for a few seconds after Consecration ends. They get no Guide entry. */
export const HIDDEN_SKILL_IDS: readonly string[] = ['sanctuary-release-heal', 'sanctuary-release-strike']
