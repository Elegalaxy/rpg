import { defineWeb } from './define.ts'

export const clericWeb = defineWeb(
  'cleric',
  [
    {
      name: 'Devotion',
      nodes: ['Smite', 'Vowkeeper', 'Penance', 'Steadfast Spirit', 'Exalted Vow'],
      unlocks: { Penance: 'penance' },
    },
    {
      name: 'Sanctuary',
      nodes: ['Mend', 'Ward', 'Consecration', 'Safeguard', 'Living Sanctuary'],
      unlocks: { Ward: 'ward', Consecration: 'consecration' },
    },
    {
      name: 'Judgment',
      nodes: ['Judgment', 'Righteous Force', 'Reciprocal Purpose', 'Final Mercy', 'Sacred Balance'],
      unlocks: { Judgment: 'judgment' },
    },
  ],
  ['smite', 'mend', 'ward', 'judgment'],
)
