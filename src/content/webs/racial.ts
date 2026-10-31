import type { HeroRace, RacialWeb, SkillNode, SkillNodeIndex } from '../../sim/progression.ts'

function kebab(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
}

/** Four nodes in one line. Each needs the one before it. The fourth is the capstone, not a keystone. */
function defineRacialWeb(race: HeroRace, names: readonly [string, string, string, string]): RacialWeb {
  const nodes: SkillNode[] = []
  let previous: string | null = null
  names.forEach((name, position) => {
    const id = `${race}-${kebab(name)}`
    nodes.push({
      id,
      name,
      cluster: race,
      index: (position + 1) as SkillNodeIndex,
      cost: 1,
      requires: previous,
      keystone: false,
      unlocksSkillId: null,
    })
    previous = id
  })
  return { race, nodes }
}

export const racialWebs: { readonly [race in HeroRace]: RacialWeb } = {
  human: defineRacialWeb('human', ['Quick Study', 'Cross-Training', 'Flexible Route', 'Renaissance']),
  elf: defineRacialWeb('elf', ['Focused Mind', 'Efficient Flow', 'Foresight', 'Perfect Clarity']),
  beastfolk: defineRacialWeb('beastfolk', ['Thick Hide', 'Blood Scent', 'Long Hunt', 'Apex Instinct']),
  undead: defineRacialWeb('undead', ['Patient Killer', 'Soul Harvest', 'Cursebound', 'Deathly Precision']),
}
