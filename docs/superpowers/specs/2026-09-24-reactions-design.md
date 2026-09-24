# Combat reactions - Design

## 1. Goal

Replace the reaction automations of Gambit's Premades, no longer available, with a single module system using 2014 rules. Reactions Midi-QOL already handles (activation "Reaction" on being attacked, hit, damaged or saving: Shield, Uncanny Dodge, Hellish Rebuke, Absorb Elements...) stay with Midi.

## 2. Releases

| Version | Content |
| --- | --- |
| 0.4.x | Timed prompt service, Reactions panel, movement engine: opportunity attacks (everyone, echo included), Sentinel parts 1-2, War Caster, Polearm Master; Vengeful Assault moved onto the new service; visible reaction marker as the reaction state |
| 0.5.0 | Sentinel part 3 on `midi-qol.RollComplete`: any attack (reactions included) by a hostile creature within 5 ft of the holder's own token against a target without Sentinel |
| later | Protection, Interception, Mage Slayer, if a character needs them |

## 3. Per-reaction configuration

Each reaction type has a row in the **Reactions** panel (module settings, GM only), following Gambit's Premades:

| Field | Values | Default |
| --- | --- | --- |
| Enabled | yes / no | yes |
| Timeout | seconds (5-120) | 15 |
| When time runs out | Decline / Use automatically / Ask the GM | Decline |
| NPCs | Ask the GM / Automatic / Off | Ask the GM |
| PC prompt to | Player / Player and GM / GM only | Player |

General options: only during an active combat (default yes), a chat line for each reaction used (default yes).

## 4. Prompt service

- One authority: the active GM detects triggers and sends prompts, so clients never duplicate them.
- Prompts use Foundry 14 `User#query` with a handler registered in `CONFIG.queries`; the recipient sees a dialog with a countdown, the choices (weapon, spell) and decline.
- When the timeout expires the dialog closes and the configured fallback applies; "Ask the GM" reopens the prompt for the GM with the same timeout. A declined or expired prompt is as if the reaction was never taken.
- An offline recipient counts as an expired prompt.
- With several recipients the first answer wins and the other dialogs close.

## 5. Movement engine

`moveToken` hook, run by the active GM only; distances along the path come from `movement.origin` and `movement.passed.waypoints`.

Each reacting token on the scene must be hostile to the mover, have its reaction available, not be incapacitated, and see the mover. Reach is the largest reach among melee attacks (equipped weapons for PCs; every melee attack, natural weapons and attack features included, for NPCs), measured in 3D with height. An Echo Knight's echo reacts for its owner with the owner's weapons and the same single reaction.

Triggers:

- **Opportunity attack**: the path goes from inside to outside reach. Forced movement, teleports and swaps with the echo are excluded, and so is a mover that took Disengage.
- **Polearm Master**: the path enters the reach of a glaive, halberd, pike, quarterstaff or spear.
- **War Caster**: the opportunity attack prompt also offers prepared single-target spells with a one-action casting time.
- **Sentinel**: Disengage doesn't protect from the reactor; a hit leaves the mover at the last point inside reach with speed 0 until the end of its turn.

The reaction roll gets a temporary range grace (the mover has already left reach) and tells Midi not to treat it as a reaction. The reaction is marked once, after the attack starts.

## 6. Reaction state

A reaction is used exactly while a visible marker is on the actor: Midi's reaction effect (which may reuse Convenient Effects' "Reaction"), the module's own marker, a `reaction` status, or an effect named "Reaction". Deleting the marker gives the reaction back; the module's marker clears at the start of the actor's turn.

## 7. Names shown to players

Prompts and chat lines show player characters and tokens whose name is visible to everyone; other creatures appear as "a creature".

## 8. Tests

Unit tests without Foundry: configuration and defaults, timeout fallbacks, reactor eligibility, leaving and entering reach, exclusions, echo as a reactor, Sentinel, War Caster, Polearm Master, GM-only execution, reaction markers, public names.
