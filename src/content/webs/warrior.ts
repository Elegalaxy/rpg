import { defineWeb } from './define.ts'

export const warriorWeb = defineWeb(
  'warrior',
  [
    {
      name: 'Fury',
      nodes: ['Driving Blow', 'Rising Heat', 'Cleave', 'Bloodletting', 'Berserker'],
      unlocks: { Cleave: 'cleave' },
    },
    {
      name: 'Arms',
      nodes: ['Sundering Blow', 'Weapon Discipline', 'Reckless Strike', 'Heavy Follow-Through', 'Weapon Master'],
      unlocks: { 'Sundering Blow': 'sundering-blow', 'Reckless Strike': 'reckless-strike' },
    },
    {
      name: 'Bulwark',
      nodes: ['Shield Brace', 'Second Wind', 'Defiance', 'Shield Impact', 'Unbroken'],
      unlocks: { 'Shield Brace': 'shield-brace', 'Second Wind': 'second-wind' },
    },
  ],
  ['driving-blow', 'sundering-blow', 'shield-brace', 'second-wind'],
)
