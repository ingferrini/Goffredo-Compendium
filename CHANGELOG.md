# Changelog

All notable changes to this project are documented here.

## 0.1.2 - 2026-09-24

- The echo is now dismissed at the end of its owner's turn when it is more than 30 feet away; the check was hooked to a combat pass CAT never fires. A notification explains the dismissal.

## 0.1.1 - 2026-09-24

- Swap Positions no longer blocks on the owner's recorded movement; it always exchanges places.
- Echo elevation control now actually moves the token and shows localized labels.
- Dialog prompts (attack choice, reaction, elevation) are localized instead of showing raw keys.
- Echo saving throws now use the owner's save totals instead of the echo's own proficiency bonus; the echo keeps its Echo creature type.
- An echo reduced to 0 hit points is dismissed automatically.

## 0.1.0 - 2026-09-24

- Added bilingual 2014 Manifest Echo and Unleash Incarnation compendium Items.
- Added CAT-based echo summoning, attacks, position exchange, elevation control, dismissal, and range cleanup.
- Added Foundry v14 movement-budget enforcement and opportunity-attack handling.
- Added deterministic release packaging, validation tests, and GitHub Actions workflows.
