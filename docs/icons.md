# Compendium icons

Icons are original AI-generated artwork made for this project and shipped with the module in `assets/icons/`. Every new pack document gets an icon in the same style.

## Adding an icon

1. Write the prompt from the template below and generate the image (1024x1024 is fine).
2. Put the original in `art/source/` as `<identifier>.jpg` (tokens: `<identifier>-token.jpg`). Originals stay in the repository but never enter the module ZIP.
3. Run `python tools/build_icons.py`: it writes `assets/icons/<identifier>.webp` at 256x256 (about 5 KB); `-token` files lose their black background and become transparent.
4. Reference it from the pack document as `modules/goffredo-compendium/assets/icons/<identifier>.webp`.
5. `tests/release.test.mjs` checks that every referenced icon is bundled and that no bundled image is unused.

## Prompt template

> Square 1:1 game icon, simple bold composition readable at 64 pixels. [SUBJECT]. Painterly dark-fantasy oil painting, realistic, dramatic lighting, muted palette with one accent colour, plain dark background, no text, no border, not cartoon.

Tokens: `Square 1:1 top-down token image, simple bold shape readable at 64 pixels. [SUBJECT], centred. Transparent background (if not possible, pure black background). Painterly dark-fantasy oil painting, realistic, no text, no border, not cartoon.`

## Icons

| File | Document | Subject |
| --- | --- | --- |
| `manifest-echo.webp` | Manifest Echo, GAC - Echo actor | Translucent grey spectral double of an armoured warrior |
| `manifest-echo-attack.webp` | Manifest Echo: Attack from Echo | Spectral echo lunging with a warhammer strike |
| `manifest-echo-swap.webp` | Manifest Echo: Swap Positions | Warrior and echo trading places in an arc of light |
| `manifest-echo-elevation.webp` | Manifest Echo: Change Elevation | Echo rising with light trails beneath it |
| `manifest-echo-dismiss.webp` | Manifest Echo: Dismiss | Echo dissolving into ash and motes |
| `unleash-incarnation.webp` | Unleash Incarnation | Warrior and ghostly echo swinging the same warhammer |
| `manifest-mind.webp` | Manifest Mind, GAC - Spectral Mind actor | Ghostly spellbook dissolving into teal script |
| `manifest-mind-slot.webp` | Manifest Mind: Manifest with a spell slot | Spellbook rising from a burning arcane sigil |
| `manifest-mind-cast.webp` | Manifest Mind: Cast from Mind | Spellbook releasing a teal arcane bolt |
| `manifest-mind-move.webp` | Manifest Mind: Move Mind | Spellbook gliding with a curved teal trail |
| `manifest-mind-dismiss.webp` | Manifest Mind: Dismiss | Closed spellbook fading into motes |
| `manifest-mind-token.webp` | Spectral mind token | Hovering spellbook in a teal halo, transparent |
| `vengeful-assault.webp` | Vengeful Assault | Black-scaled dragonborn gauntlet counter-striking |
| `pack-tactics-companion.webp` | Pack Tactics (Companion) | Red-eyed grey wolf beside an armoured dwarf cleric |
| `great-weapon-fighting.webp` | Great Weapon Fighting | Greatsword in two gauntleted hands |
| `frammento-runico-instabile.webp` | Frammento Runico Instabile | Stone shard with cracked golden runes and violet sparks |
| `piuma-regina-corvo.webp` | Piuma Metallica della Regina Corvo | Raven feather of burnished metal |

The echo token uses its owner's token art, applied when it is summoned.
