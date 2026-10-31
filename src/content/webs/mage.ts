import { defineWeb } from './define.ts'

export const mageWeb = defineWeb(
  'mage',
  [
    {
      name: 'Elemental',
      nodes: ['Fireball', 'Frost Lance', 'Chain Lightning', 'Elemental Affinity', 'Elemental Convergence'],
      unlocks: { Fireball: 'fireball', 'Frost Lance': 'frost-lance', 'Chain Lightning': 'chain-lightning' },
    },
    {
      name: 'Arcane',
      nodes: ['Arcane Bolt', 'Mana Ward', 'Arcane Recovery', 'Efficient Channeling', 'Overcast'],
      unlocks: { 'Mana Ward': 'mana-ward' },
    },
    {
      name: 'Prepared',
      nodes: ['Spell Memory', 'Quick Study', 'Defensive Preparation', 'Rehearsed Casting', 'Grand Grimoire'],
      unlocks: {},
    },
  ],
  ['fireball', 'frost-lance', 'mana-ward', 'arcane-recovery'],
)
