# Goffredo's Automation Compendium

Bilingual Foundry VTT automations for D&D 5e 2014 games: clean-room, rules-text-free implementations of Echo Knight (Manifest Echo, Unleash Incarnation), Order of Scribes Manifest Mind, Ravenite Vengeful Assault, companion-bound Pack Tactics, and two Wildemount campaign items.

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

Enable the module and its required dependencies in the world. Three compendia appear under **Goffredo's Automation Compendium / 2014**:

- `GAC Class Features (2014)`
- `GAC Summons (2014)`
- `GAC Equipment (2014)`

Import the features and items from the compendia onto the character, replacing any unautomated copy. Do not edit the compendium originals. CAT reads the embedded identifiers automatically when the imported Items are used.

## Echo Knight automation

Manifest Echo provides controls to summon or replace the echo, attack from its position, exchange positions, change elevation, and dismiss it. The runtime enforces the 15-foot summon placement, one active echo, 1 HP, calculated AC, a cumulative 30-foot three-dimensional movement allowance during the owner's turn, 15 feet of movement for the exchange, and end-of-turn removal beyond 30 feet.

Normal echo attacks may use any equipped weapon attack, including ranged weapons. Opportunity attacks and Unleash Incarnation are restricted to equipped melee weapon attacks. Attacks roll the original Item so its bonuses, ammunition, effects, and Midi-QOL configuration remain authoritative.

The opportunity trigger ignores forced movement, teleport-style movement, swaps, internal corrections, non-hostile creatures, unseen targets, and actors that have already spent their reaction. The reaction is consumed only after an attack is actually started.

Unleash Incarnation checks for an active echo and target, offers a melee weapon, and spends one use only after the synthetic attack starts. Foundry and Midi-QOL model individual attack workflows rather than the whole Attack action; the player must therefore invoke Unleash once for the specific Attack action that grants it. This preserves valid Action Surge use without guessing at table intent.

## Manifest Mind

Manifest conjures a Tiny, hovering spectral mind within 60 feet (once per long rest, or with the second activity by spending a spell slot). Its token has 60-foot darkvision and sheds 10-foot dim light; it cannot be targeted. *Cast from Mind* (proficiency bonus uses per long rest) arms the next wizard spell cast on your turn: targets out of range from the mind cancel the cast before any slot is spent, and the spell originates from the mind. *Move* repositions it up to 30 feet; it vanishes if the owner ends a turn more than 300 feet away.

## Vengeful Assault

When a creature damages the owner and stands within reach (or range) of an equipped weapon, the owner is asked whether to spend the reaction and the once-per-rest use to attack it back.

## Great Weapon Fighting

One feature on the actor covers every weapon: melee attacks with a two-handed weapon, or a versatile weapon used two-handed, reroll damage dice showing 1 or 2 once and keep the new result (2014 rules).

## Pack Tactics (Companion)

Advantage on attack rolls when the companion named in the feature's **Requirements** field (for example `Jira`) is within 5 feet of every target and isn't incapacitated. Edit the field to bind another companion.

## Reactions

**Game Settings > Goffredo's Automation Compendium > Reactions** lists every reaction with: enabled, prompt timeout in seconds, what happens when time runs out (decline, use automatically, ask the GM), NPC handling (ask the GM, automatic, off) and who receives PC prompts. Prompts use Foundry's own user queries with a visible countdown; the active GM detects the triggers.

- **Opportunity attack** for every combatant when a hostile creature it can see leaves its melee reach (3D, height included); forced movement, teleports and Disengage are excluded. An Echo Knight's echo reacts for its owner with the same single reaction.
- **Sentinel**: Disengage doesn't protect from the reactor, and a hit stops the mover at the last point inside reach with speed 0 until the end of its turn.
- **War Caster**: the prompt also offers single-target action spells.
- **Polearm Master**: a creature entering the reach of a glaive, halberd, pike, quarterstaff or spear.
- **Vengeful Assault** uses the same timed prompt.

This system depends only on Foundry and Midi-QOL, not on CAT.

## Campaign items

- **Frammento Runico Instabile**: while equipped and attuned, spells dealing radiant damage deal an extra 1d6 radiant; every third owner turn in combat, and when attunement ends, the owner takes 2d6 psychic damage.
- **Piuma Metallica della Regina Corvo**: bonus action, once per day; until the end of the turn, advantage on attack rolls against evil creatures.

## Lingue

L'interfaccia del modulo e disponibile in inglese e italiano. I compendi non includono il testo integrale delle regole protette: i nomi identificano le capacita, mentre descrizioni e riferimenti alle regole vanno aggiunti dal materiale posseduto dal tavolo.

## Development

```bash
npm ci
npm run check
```

`npm run check` runs linting, tests, compendium compilation, and release construction. The installable files are written to `dist/`; source JSON in `packData/` never enters the release archive.

## Public-content policy

This repository contains original automation code, short original feature summaries, configuration metadata, and original AI-generated icons created for this project (`assets/icons`). It contains no third-party or copyrighted artwork. It is not affiliated with or endorsed by Wizards of the Coast, Foundry Gaming LLC, or the maintainers of the compatible automation modules.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for technical attributions.
