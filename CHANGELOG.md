# Changelog

All notable changes to this project are documented here.

## 0.1.4 - 2026-09-24

- Swap Positions, Change Elevation and echo movement rollback now move tokens through Foundry's `TokenDocument#move`; CAT 0.0.8 does not expose `tokenUtils.moveToken`, which made these actions fail.

## 0.1.3 - 2026-09-24

- The echo now actually receives its owner's stats (AC 14 + proficiency, 1 HP, size, senses, save bonuses, token art); CAT merges summon updates directly into the actor data and the previous nested shape was ignored.
- Console diagnostics for Manifest Echo activities, swap, elevation and echo movement rollback.

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
