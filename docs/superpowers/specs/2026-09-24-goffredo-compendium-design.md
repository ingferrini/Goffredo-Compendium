# Goffredo's Automation Compendium - Design

> Updates since this design: the module is English only (campaign items keep their Italian names); icons are bundled in `assets/icons`; reactions are covered by [the reactions design](2026-09-24-reactions-design.md).

## 1. Goal

Build a public, reusable Foundry VTT module that collects the automations missing or broken in the Wildemount campaign, without turning the Foundry world or the campaign repository into competing technical sources.

Release `0.1.0` fully automates the 2014 Echo Knight features `Manifest Echo` and `Unleash Incarnation`. Later releases add, one at a time, the automations the four player characters actually use.

## 2. Repository and distribution

- Separate local repository: `C:\Users\ingfr\OneDrive\Documenti\ChatGPT\Goffredo-Compendium`.
- Dedicated public GitHub repository.
- Display name: `Goffredo's Automation Compendium`.
- Technical ID and module folder: `goffredo-compendium`.
- Main branch: `main`.
- Semantic versioning; first functional release `0.1.0`.
- GitHub releases with a stable `module.json` and a ZIP installable from Foundry and The Forge.
- The repository sits in the same VS Code workspace as the campaign, but is not nested in the `Wildemount Campaign` repository.

## 3. Initial compatibility

| Component | Version |
| --- | --- |
| Foundry VTT | 14.367 |
| D&D5e | 5.3.3, 2014 rules |
| Midi-QOL | 14.0.12 |
| DAE | 14.0.14 |
| CAT | 0.0.8 |
| Sequencer | 4.2.3, optional for animations |
| Levels | 7.0.3, supported and tested |

The manifest declares D&D5e, Midi-QOL, DAE and CAT as required dependencies. Sequencer and Levels are optional integrations: automations keep working without animations and on scenes without levels.

The module checks dependencies and versions at startup. On incompatibility it warns the GM and never runs a risky automation partially.

## 4. Architecture

```text
Goffredo-Compendium/
  module.json
  scripts/
  packData/
  packs/
  lang/
  tests/
  docs/
  LICENSE
  THIRD_PARTY_NOTICES.md
```

### 4.1 Code

ES modules. Each automation lives in a focused file and is registered under a stable identifier, for example `goffredo.echo-knight.manifest-echo`.

Compendium Items hold activities, effects, metadata and the identifier. Executable logic stays in the module, not in world macros or long scripts embedded in Items.

Responsibilities:

- D&D5e Activities provide the visible commands and handle actions, uses and recovery;
- Midi-QOL exposes and resolves attack and reaction workflows;
- DAE keeps temporary effects and the controls available while the echo is active;
- CAT runs privileged operations such as creating and removing tokens, even when a player acts;
- Foundry's public API handles documents, tokens, measurement and turn hooks;
- Levels is queried only when active, for surfaces, elevation and vertical collisions.

No custom socket protocol is introduced while CAT offers adequate GM execution.

### 4.2 Compendia

`Class Features 2014`, `Spells 2014`, `Feats 2014`, `Equipment 2014` (Item) and `Summons 2014` (Actor), grouped with `packFolders` under a visible `Goffredo's Automation Compendium / 2014` folder. Documents are kept in `packData` as readable JSON; LevelDB packs are generated at build time and are not the primary source.

## 5. Content and licensing

- Original code under the MIT license.
- Code adapted from MIT projects keeps its notices; `THIRD_PARTY_NOTICES.md` records project, author, license, URL, source and changes.
- No official images or commercial assets.
- No full non-SRD descriptions; SRD text only with the required attribution.
- Non-SRD features get only short original operating instructions.
- Optional animations use only freely distributable or user-installed assets; missing assets never block the mechanics.

## 6. Manifest Echo

### 6.1 Summoning

- Bonus action; the player picks a free, visible point within 15 ft, measured in three dimensions.
- No summoning through walls, closed doors or occupied spaces.
- An existing echo of the same actor is removed before a new one is created.
- The echo comes from an Actor template in `Summons 2014`, configured from the summoner's current data.

### 6.2 Echo statistics

1 hit point; AC `14 + proficiency bonus`; the summoner's size; the feature's condition immunities; saving throws with the summoner's bonuses; a token clearly recognisable as the echo and uniquely linked to its summoner.

### 6.3 State and ownership

The summoner-echo link lives in namespaced module flags (summoner UUID, echo UUID and token ID, scene, schema version, reaction state), not in token names. Deleting the token, changing scene, disabling the actor or summoning again cleans the state without orphaned references.

### 6.4 Movement

- The owner controls the echo token and, on their turn, can move it up to 30 ft in any direction, vertical included, measured in three dimensions.
- Movement uses the scene's normal system, including collisions and Levels surfaces, with a dedicated control for elevation changes within the movement budget.
- At the end of the summoner's turn the three-dimensional distance is measured; beyond 30 ft the echo is removed with a localized message.

### 6.5 Attacking from the echo

For each attack of the Attack action the summoner chooses whether it originates from their space or the echo's. The attack uses the summoner's weapon, bonuses and damage; reach, line of sight, cover and distance are measured from the chosen position. No duplicated ammunition, resources or weapon effects.

### 6.6 Opportunity attack

When a creature the summoner can see leaves the echo's reach, the owner is offered their reaction; the attack comes from the echo's space. The reaction is spent once, and forced movement and non-provoking movement are excluded.

### 6.7 Swapping places

Bonus action; requires a valid echo on the same scene; summoner and echo swap position and elevation atomically; both destinations must be valid, otherwise nothing moves and nothing is spent.

### 6.8 Dismiss

Bonus action; removes only the acting actor's echo and cleans flags, effects and controls. Deleting the token by hand performs the same cleanup.

### 6.9 Player controls

`Manifest`, `Attack from Echo`, `Swap Positions`, `Dismiss` (plus `Change Elevation`), shown while the echo is active without permanent copies of Items on the sheet.

## 7. Unleash Incarnation

One extra melee attack from the echo's position during the Attack action; uses equal to the Constitution modifier (minimum one), recovered on a long rest; a use is spent only when the attack actually starts; no second offer in the same Attack action.

## 8. Installing and updating Items

The GM installs the module, imports Items from the compendium (or applies the automation to an existing Item by identifier). Imported Items need no extra world macros. Module updates never silently overwrite private or legally imported descriptions on characters.

## 9. Errors and operational safety

No automation changes the actor when an essential prerequisite is missing; composite operations validate everything before spending resources or moving tokens; technical errors go to the console with a short message for the player; configuration warnings go to the GM; hooks are filtered by identifier and actor UUID; nothing depends on the name `Ash`.

## 10. Verification

Unit tests cover AC and uses, 15/30 ft distances, echo movement budget, echo selection and validation, state transitions and flag cleanup, double-spend prevention and localization. The Foundry acceptance test runs on a copy of Ash, as GM and as the owning player, on flat and Levels scenes, before the automation is applied to the campaign actor.

## 11. Out of scope for 0.1.0

D&D5e 2024 support; Foundry 13 or earlier; automating every character at once; a general automation builder UI; distributing unlicensed descriptions, images or assets; declaring compatibility with untested future versions.

## 12. Acceptance criteria for 0.1.0

1. The module installs from a public GitHub manifest and enables without errors on the initial stack.
2. The compendia appear in the expected folders.
3. Manifest Echo and Unleash Incarnation meet sections 6 and 7.
4. No non-distributable text or asset is included.
5. All automated tests pass.
6. The Foundry acceptance test passes as GM and as player.
7. The original Ash actor is not changed before GM approval.
