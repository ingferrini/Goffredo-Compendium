# Changelog

All notable changes to this project are documented here.

## 0.2.0 - 2026-09-24

- Added Manifest Mind (Order of Scribes): spectral mind summon with a Tiny hovering token, 60 ft darkvision and 10 ft dim light; cast wizard spells from the mind with range checked before any slot is spent; move, dismiss, re-manifest with a spell slot, and removal beyond 300 ft.
- Added Vengeful Assault: reaction attack prompt when damaged by a creature within weapon reach.
- Added Pack Tactics (Companion): advantage when the named companion is adjacent to the target.
- Added the GAC Equipment (2014) compendium with Frammento Runico Instabile and Piuma Metallica della Regina Corvo.
- Fixed echo end-of-turn removal: CAT prefixes combat passes with the owner scope, so the pass is `actorTurnEnd` again.

## 0.1.5 - 2026-09-24

- Attack from Echo and Unleash Incarnation now enforce weapon reach (melee) or long range (ranged) from the echo's space, always including height difference. The attack-origin override disables Midi-QOL's own range check, so nothing was checked before. Opportunity attacks from the echo skip the check, since the mover has already left reach.

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
