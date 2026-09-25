# Changelog

All notable changes to this project are documented here.

## 0.7.3 - 2026-09-25

- Removed the one-off cleanup of leftovers from older versions; only flagged transient effects are swept.

## 0.7.2 - 2026-09-25

- Fixed helper effects that could stay on an actor forever when a roll never completed ("Reaction reach" range grace, the echo's attack-origin override, the spectral mind's cast arming), giving unlimited range. They are now flagged as transient, removed after the roll or a 60-second timeout, and swept by the GM at every turn change and when the world loads.

## 0.7.1 - 2026-09-25

- Legendary actions and resistances spent by the module never go past the maximum, so a manual recharge from the NPC sheet takes effect at once.

## 0.7.0 - 2026-09-25

- Added the campaign legendary action "Protocollo di intangibilità" (Maelis Rhor): items with identifier `protocollo-intangibilita` grant, until the start of the user's next turn, resistance to all damage, advantage on saving throws, immunity to grappled and prone, and turn the first damage taken through Midi into 0.

## 0.6.0 - 2026-09-25

- Added legendary actions between turns: the turn advance is held, the game pauses, players get a notice and the GM chooses an affordable legendary action or skips; then the turn advances.
- Added lair actions at initiative count 20 (losing ties), without repeating the same one two rounds in a row.
- Added Legendary Resistance after failed saving throws in Midi workflows.
- The panel has a separate "Legendary actions, lair actions and Legendary Resistance" section (enable, timeout with 0 = no limit, pause, fallback).

## 0.5.0 - 2026-09-25

- Added Sentinel's third part: after a hostile creature within 5 feet of a Sentinel holder attacks another target without Sentinel, the holder is offered a melee weapon attack against it (new row in the Reactions panel). Attacks made as reactions count too; the echo never counts as "within 5 feet of you".
- Reaction rolls for creatures without an active player owner run as the GM.

## 0.4.6 - 2026-09-25

- The module is English only: the Italian localization is removed, activity names and feature descriptions are English, and the repository documentation is translated. Campaign items keep their original Italian names and descriptions.

## 0.4.5 - 2026-09-25

- Reaction rolls (opportunity attacks, echo, Polearm Master, War Caster, Vengeful Assault) tell Midi not to treat them as reactions, so Midi no longer asks for an "additional reaction". The module marks the reaction once, after the attack starts.

## 0.4.4 - 2026-09-24

- A reaction already marked (Midi recognises out-of-turn attacks on its own) is not marked a second time, so Midi's reaction counter no longer reaches 2.

## 0.4.3 - 2026-09-24

- The visible marker is now the reaction state. Using a reaction asks Midi to place its "Reaction used" effect; when Midi does not (reaction enforcement off), the module places its own marker with Midi's reaction icon. Deleting any marker gives the reaction back; the module's marker is removed at the start of the actor's turn.

## 0.4.2 - 2026-09-24

- A reaction also counts as used when the actor shows a reaction marker: Midi's "Reaction used" effect, a `reaction` status, or an enabled effect named "Reaction".

## 0.4.1 - 2026-09-24

- Opportunity attacks (also from the echo) no longer fail Midi's range check: the attack resolves after the mover has left reach, so the reacting actor gets a temporary range grace for that single roll.
- Reactions are tracked by the module and come back at the start of the actor's own turn, independently of Midi's "enforce reactions" setting.
- Prompts and chat lines name only player characters and tokens whose name is shown to everyone; other creatures appear as "a creature".
- The echo attack no longer deletes its temporary effect twice.
- A failing reaction roll is logged and no longer stops other creatures from reacting.

## 0.4.0 - 2026-09-24

- Added the Reactions panel: per-reaction enable, timeout, fallback when time runs out, NPC handling and prompt recipients.
- Added a timed reaction prompt built on Foundry user queries, with a countdown and first-answer-wins across player and GM.
- Added a CAT-independent movement reaction engine run by the active GM: opportunity attacks for every combatant (echo included, sharing its owner's reaction), Sentinel, War Caster and Polearm Master.
- NPC reach comes from every melee attack they have, including unequipped natural weapons and attack features; PCs use equipped melee weapons.
- A prompt that times out (with the Decline fallback) is as if the reaction was never taken: nothing is rolled and the reaction stays available.
- Vengeful Assault now uses the timed prompt and Midi-QOL directly.
- Removed the echo-only opportunity attack hooks, replaced by the shared engine.

## 0.3.3 - 2026-09-24

- Manifest Mind activities (spell-slot manifest, cast, move, dismiss) have their own painterly icons.

## 0.3.2 - 2026-09-24

- Manifest Echo activities (attack, swap, elevation, dismiss) have their own painterly icons.

## 0.3.1 - 2026-09-24

- Bundled original painterly icons (256 px WebP, about 5 KB each) for every compendium document, plus a transparent token for the spectral mind. The compendia reference them from the module folder, so nothing needs uploading.

## 0.3.0 - 2026-09-24

- Added Great Weapon Fighting (2014): one feature on the actor rerolls 1s and 2s once on the damage dice of every melee attack with a two-handed weapon, or a versatile weapon in the two-handed attack mode. Dice that already carry a reroll are left alone.

## 0.2.3 - 2026-09-24

- Midi-QOL 14 exposes the attack origin only through `workflow.token`; assigning `attackingToken` threw. Spells cast from the spectral mind and attacks from the echo now set the origin through the setter and recompute line of sight and cover from it.

## 0.2.2 - 2026-09-24

- Manifest Mind: the mind token is recorded on the owner at summon time, so Move and Cast from Mind find it even when CAT's summon registry returns a stale entry without a token. Move uses CAT's exported `displaceToken` with a 30-foot crosshair.

## 0.2.1 - 2026-09-24

- Frammento Runico Instabile: the item awakens on its first attunement; the attunement-loss backlash can only happen after that.

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
