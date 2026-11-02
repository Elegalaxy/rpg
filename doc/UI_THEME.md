# UI Theme: Fractured Frontier

The look of the first playable. It is a dark, ink-and-parchment fantasy style with an ember accent. The implementation is `src/ui/theme.css`. Change the colours there and everything follows.

## Mood

A hard border country after something broke the world: cold dark panels, warm parchment text, and a glowing ember colour for the one thing the player should click next. Light mode flips it to parchment paper with ink text.

## Colours (dark / light)

| Role | Dark | Light | Use |
|---|---|---|---|
| Background | `#12141a` | `#f3eddd` | page |
| Panel | `#1a1d26` | `#fbf7ea` | cards, side panel |
| Panel raised | `#232733` | `#fffdf5` | inputs, buttons, previews |
| Border | `#353b4d` | `#cfc3a6` | all outlines |
| Text | `#ebe5d3` | `#2a2418` | body text |
| Muted | `#9a95a3` | `#6d6450` | notes under rows |
| Accent (ember) | `#e0963a` | `#a8620f` | title, selected tab, primary buttons |
| Good | `#62b86f` | `#2f7a3d` | collect, equip, repair, pay |
| Warn (gold) | `#e0b84c` | `#8a6a12` | sell, spend |
| Danger | `#e07070` | `#a63a3a` | abandon, errors |
| Info | `#6aa0e6` | `#2c5fa8` | neutral actions, links |

Class colours (for later badges and the skill web): Warrior red, Assassin violet, Ranger green, Mage blue, Cleric gold. They are defined as `--class-*`.

## Type

Headings use Georgia (a system serif) for the storybook feel. Body text uses the system sans-serif. No web fonts, so nothing to load.

## Spacing and shape

One scale for every margin, padding, and gap: 4, 8, 12, 16, 24, 32 px (`--s1` to `--s6`). Corners are 4 px. Borders are 1 px.

## Buttons: one meaning per colour

- **Ember fill (`btn-primary`):** the main action on a screen. Start expedition, Buy, Accept, Craft, Upgrade, Select.
- **Green outline (`btn-good`):** gaining or restoring. Collect, Equip, Repair, Pay debt.
- **Gold outline (`btn-warn`):** giving something up for gold. Sell.
- **Red outline (`btn-danger`):** losing progress. Abandon.
- **Blue outline (`btn-info`):** neutral information actions.
- **Plain:** everything else, such as Unequip, tabs, and small controls.

## Layout rules

- Lists use rows: text on the left, buttons aligned at the end, so changing a word never moves a button.
- Radio groups (race, class, route) are chips with a clear selected state.
- Wide screens: top bar, left side panel with the hero and tabs, and a content area. Two-column screens (skills, gear) put the preview or stats on the right.
- Phones: the layout stacks and the hero header stays on top.
