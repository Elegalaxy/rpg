import { defineWeb } from './define.ts'

export const assassinWeb = defineWeb(
  'assassin',
  [
    {
      name: 'Shadow',
      nodes: ['Shadow Cut', 'Smoke Step', 'Elusive Footwork', 'Ambush', 'Ghost'],
      unlocks: { 'Smoke Step': 'smoke-step' },
    },
    {
      name: 'Venom',
      nodes: ['Venom Edge', 'Potent Toxins', 'Fan of Knives', 'Toxic Opportunity', 'Toxic Sovereign'],
      unlocks: { 'Venom Edge': 'venom-edge', 'Fan of Knives': 'fan-of-knives' },
    },
    {
      name: 'Execution',
      nodes: ['Mark for Death', 'Exploit Weakness', 'Execute', 'Relentless', 'Death Sentence'],
      unlocks: { 'Mark for Death': 'mark-for-death', Execute: 'execute' },
    },
  ],
  ['mark-for-death', 'shadow-cut', 'venom-edge', 'execute'],
)
