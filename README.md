# Goffredo's Automation Compendium

Bilingual Foundry VTT automations for D&D 5e games. The first release provides a clean-room, rules-text-free implementation of the 2014 Echo Knight features Manifest Echo and Unleash Incarnation.

## Supported stack

- Foundry VTT `14.367`
- D&D5e `5.3.3`
- Midi-QOL `14.0.12` or newer compatible 14.x release
- Dynamic Active Effects `14.0.14` or newer compatible 14.x release
- Coven's Automation Toolkit (CAT) `0.0.8` or newer compatible release
- Levels `7.0.3` supported for elevation-aware movement

The module intentionally refuses to register partial automation when a required dependency is missing or older than the declared minimum.

## Installation

In Foundry, open **Add-on Modules > Install Module**, paste the manifest URL, and install:

```text
https://github.com/ingferrini/Goffredo-Compendium/releases/latest/download/module.json
```

Enable the module and its required dependencies in the world. Two compendia appear under **Goffredo's Automation Compendium / 2014**:

- `GAC Class Features (2014)`
- `GAC Summons (2014)`

Import Manifest Echo and Unleash Incarnation from the feature compendium onto the character. Do not edit the compendium originals. CAT reads the embedded identifiers automatically when the imported Items are used.

## Echo Knight automation

Manifest Echo provides controls to summon or replace the echo, attack from its position, exchange positions, change elevation, and dismiss it. The runtime enforces the 15-foot summon placement, one active echo, 1 HP, calculated AC, a cumulative 30-foot three-dimensional movement allowance during the owner's turn, 15 feet of movement for the exchange, and end-of-turn removal beyond 30 feet.

Normal echo attacks may use any equipped weapon attack, including ranged weapons. Opportunity attacks and Unleash Incarnation are restricted to equipped melee weapon attacks. Attacks roll the original Item so its bonuses, ammunition, effects, and Midi-QOL configuration remain authoritative.

The opportunity trigger ignores forced movement, teleport-style movement, swaps, internal corrections, non-hostile creatures, unseen targets, and actors that have already spent their reaction. The reaction is consumed only after an attack is actually started.

Unleash Incarnation checks for an active echo and target, offers a melee weapon, and spends one use only after the synthetic attack starts. Foundry and Midi-QOL model individual attack workflows rather than the whole Attack action; the player must therefore invoke Unleash once for the specific Attack action that grants it. This preserves valid Action Surge use without guessing at table intent.

## Lingue

L'interfaccia del modulo e disponibile in inglese e italiano. I compendi non includono il testo integrale delle regole protette: i nomi identificano le capacita, mentre descrizioni e riferimenti alle regole vanno aggiunti dal materiale posseduto dal tavolo.

## Development

```bash
npm ci
npm run check
```

`npm run check` runs linting, tests, compendium compilation, and release construction. The installable files are written to `dist/`; source JSON in `packData/` never enters the release archive.

## Public-content policy

This repository contains original automation code, empty feature descriptions, configuration metadata, and no copyrighted artwork. It is not affiliated with or endorsed by Wizards of the Coast, Foundry Gaming LLC, or the maintainers of the compatible automation modules.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for technical attributions.
