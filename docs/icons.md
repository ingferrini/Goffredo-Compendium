# Icone del compendio

Le icone sono artwork originali generati con l'AI per questo progetto e distribuiti con il modulo in `assets/icons/`. Ogni nuovo documento dei pack riceve un'icona con lo stesso stile.

## Come si aggiunge un'icona

1. Il prompt si scrive con il modello qui sotto e l'immagine si genera (1024x1024 va bene).
2. Il file va nella cartella `imgs/` del worktree o in quella indicata; il nome non conta.
3. Viene convertita in WebP 256x256 (circa 5 KB) in `assets/icons/<identifier>.webp` e il documento del pack la richiama con `modules/goffredo-compendium/assets/icons/<identifier>.webp`. I token delle evocazioni perdono lo sfondo nero e diventano trasparenti.
4. `tests/release.test.mjs` controlla che ogni icona richiamata sia nel pacchetto e che non ci siano immagini inutilizzate.

## Modello di prompt

> Square 1:1 game icon, simple bold composition readable at 64 pixels. <SOGGETTO>. Painterly dark-fantasy oil painting, realistic, dramatic lighting, muted palette with one accent colour, plain dark background, no text, no border, not cartoon.

Per i token: `Square 1:1 top-down token image, simple bold shape readable at 64 pixels. <SOGGETTO>, centred. Transparent background (if not possible, pure black background). Painterly dark-fantasy oil painting, realistic, no text, no border, not cartoon.`

## Icone presenti

| File | Documento | Soggetto |
| --- | --- | --- |
| `manifest-echo.webp` | Manifest Echo, attore GAC - Echo | Translucent grey spectral double of an armoured warrior |
| `unleash-incarnation.webp` | Unleash Incarnation | Warrior and ghostly echo swinging the same warhammer |
| `manifest-mind.webp` | Manifest Mind, attore GAC - Spectral Mind | Ghostly spellbook dissolving into teal script |
| `manifest-mind-token.webp` | Token della mente spettrale | Hovering spellbook in a teal halo, transparent |
| `vengeful-assault.webp` | Vengeful Assault | Black-scaled dragonborn gauntlet counter-striking |
| `pack-tactics-companion.webp` | Pack Tactics (Companion) | Red-eyed grey wolf beside an armoured dwarf cleric |
| `great-weapon-fighting.webp` | Great Weapon Fighting | Greatsword in two gauntleted hands |
| `frammento-runico-instabile.webp` | Frammento Runico Instabile | Stone shard with cracked golden runes and violet sparks |
| `piuma-regina-corvo.webp` | Piuma Metallica della Regina Corvo | Raven feather of burnished metal |

Il token dell'eco resta quello del proprietario, applicato all'evocazione.
