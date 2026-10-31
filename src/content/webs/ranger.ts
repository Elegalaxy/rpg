import { defineWeb } from './define.ts'

export const rangerWeb = defineWeb(
  'ranger',
  [
    {
      name: 'Marksmanship',
      nodes: ['Aimed Shot', 'Steady Hands', 'Piercing Arrow', 'Patient Shot', 'Deadeye'],
      unlocks: { 'Piercing Arrow': 'piercing-arrow' },
    },
    {
      name: 'Traps',
      nodes: ['Snare Trap', 'Reinforced Snare', 'Flame Arrow', 'Efficient Quiver', 'Trapper'],
      unlocks: { 'Snare Trap': 'snare-trap', 'Flame Arrow': 'flame-arrow' },
    },
    {
      name: 'Pathfinder',
      nodes: ["Hunter's Mark", 'Trail Sense', 'Volley', 'Press the Trail', 'Trailblazer'],
      unlocks: { "Hunter's Mark": 'hunters-mark', Volley: 'volley' },
    },
  ],
  ['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap'],
)
