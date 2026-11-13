import { Help } from '../Help.tsx'

/** What quality does, in one place: shown wherever an item's quality percent appears. */
export function QualityHelp() {
  return (
    <Help label="About quality">
      Quality multiplies a weapon's or off-hand's Power and the Armor and Resistance of armor and shields. 104% means +4%. It also raises the sell price. It has no combat effect on accessories. Upgrades never lower quality, so one good-material upgrade lifts it for good and later cheap upgrades keep it.
    </Help>
  )
}
