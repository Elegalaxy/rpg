import type { HeroClass } from '../../sim/constants.ts'
import type { HeroRace } from '../../sim/progression.ts'

const SAME_RULES =
  'Fifteen nodes in three clusters of five. Each cluster runs in order, and its fifth node is a major keystone. You can hold only one keystone per life, and there is no respec until you reincarnate.'

/** A short plain-language intro for each class web, so a player can read what it is about before spending points. */
export const classWebIntro: { readonly [classId in HeroClass]: string } = {
  warrior: SAME_RULES,
  assassin: SAME_RULES,
  ranger: SAME_RULES,
  mage: SAME_RULES,
  cleric: SAME_RULES,
}

/** What each cluster is about, by class and cluster name. */
export const clusterIntro: { readonly [classId in HeroClass]: { readonly [cluster: string]: string } } = {
  warrior: {
    Fury: 'Build Fury faster and spend it on multi-target Cleave and Bleed. The keystone, Berserker, trades safety for a much larger held-Fury bonus.',
    Arms: 'Weapon skills: shorter cooldowns, cheaper skills, and the risky two-handed Reckless Strike. The keystone, Weapon Master, rewards chaining three different weapon skills.',
    Bulwark:
      'Shields, recovery, and staying alive at high Fury. The keystone, Unbroken, survives one lethal hit per fight at the cost of the damage bonus.',
  },
  assassin: {
    Shadow: 'Mark, evasion, and Smoke Step. Dodge, then punish. The keystone, Ghost, adds Veil for a large empowered strike.',
    Venom: 'Poison stacks and group damage. The keystone, Toxic Sovereign, spreads Poison from a Marked target that dies.',
    Execution: 'Mark for Death, Advantage, and the Execute finisher. The keystone, Death Sentence, makes Execute lethal at low HP.',
  },
  ranger: {
    Marksmanship:
      'Readiness-driven aimed shots, bigger hits at high Readiness, and rolls that stay high. The keystone, Deadeye, spends full Readiness on a near-perfect shot.',
    Traps: 'Snare Trap, Flame Arrow, and special ammunition. The keystone, Trapper, sets a trap before the first enemy action.',
    Pathfinder:
      'Reading targets and routes, and getting stronger on long runs through Momentum. The keystone, Trailblazer, turns Momentum into damage and Readiness.',
  },
  mage: {
    Elemental: 'Fire, Frost, and Lightning spells. The keystone, Elemental Convergence, combines all three in order into a powerful authored spell.',
    Arcane: 'Mana efficiency, Mana Ward, and recovery. The keystone, Overcast, pays health when out of Mana for extra damage.',
    Prepared: 'Prepared spell charges that cost no Mana. The keystone, Grand Grimoire, gives three chosen spells charges instead of Mana.',
  },
  cleric: {
    Devotion: 'Vows, Faith, and Smite. The keystone, Exalted Vow, strengthens your vow in exchange for a harsher penalty if you break it.',
    Sanctuary: 'Healing, Ward, and the Consecration field. The keystone, Living Sanctuary, stores healing and returns it.',
    Judgment: 'Faith-spending offence and Judgment. The keystone, Sacred Balance, replaces Faith and vows with Grace and Wrath meters.',
  },
}

/** What each racial branch is about. The four nodes are one line, and the fourth is the capstone. */
export const racialIntro: { readonly [race in HeroRace]: string } = {
  human: 'Flexible and quick to learn: more XP, gear freedom, and a capstone that rewards spreading points across every cluster.',
  elf: 'Focus: gain it faster, lose less, and use its bonuses sooner. The capstone makes rolls near-perfect at full Focus, but damage removes it.',
  beastfolk: 'Ferocity: tougher, quicker to recover, and stronger at higher tiers. The capstone adds critical damage and healing at tier 3.',
  undead: 'Stillness and Souls: stronger patient strikes, Soul Fragments, an expedition curse, and a capstone that spends a Soul for a guaranteed strong hit.',
}
