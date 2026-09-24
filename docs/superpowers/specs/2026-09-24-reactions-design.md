# Reazioni di combattimento - Design

## 1. Obiettivo

Sostituire le automazioni di reazione di Gambit's Premades, non piu disponibile, con un sistema unico del modulo, regole 2014. Le reazioni che Midi-QOL gestisce gia (attivazione "Reazione" su attacco, colpo, danno, tiro salvezza: Shield, Uncanny Dodge, Hellish Rebuke, Absorb Elements...) restano a Midi.

## 2. Rilasci

| Versione | Contenuto |
| --- | --- |
| 0.4.0 | Servizio di richiesta con timeout, pannello Reazioni, motore del movimento: attacco di opportunita (tutti, eco compreso), Sentinel parti 1-2, War Caster, Polearm Master; Vengeful Assault migrato sul nuovo servizio |
| 0.5.0 | Reazioni ad attacchi verso altri (Sentinel parte 3, Protection, Interception) e a incantesimi (Mage Slayer) |

## 3. Configurazione per reazione

Ogni tipo di reazione ha una riga nel pannello **Reazioni** (impostazioni del modulo, solo GM), sul modello di Gambit's Premades:

| Campo | Valori | Default |
| --- | --- | --- |
| Attiva | si / no | si |
| Timeout | secondi (5-120) | 15 |
| Allo scadere | Rinuncia / Usa automaticamente / Passa al GM | Rinuncia |
| PNG | Chiedi al GM / Automatico / Spento | Chiedi al GM |
| Destinatari PG | Giocatore / Giocatore e GM / Solo GM | Giocatore |

Opzioni generali: solo durante un combattimento attivo (default si), riepilogo in chat delle reazioni usate (default si).

Tipi in 0.4.0: `opportunityAttack`, `sentinel` (modificatori dell'attacco di opportunita), `warCaster`, `polearmMaster`, `vengefulAssault`.

## 4. Servizio di richiesta

- Una sola autorita: il GM attivo calcola gli inneschi e invia le richieste. Nessun doppione tra client.
- La richiesta usa `User#query` di Foundry 14 con un handler registrato in `CONFIG.queries`; il destinatario vede un dialog con conto alla rovescia, le scelte (arma, incantesimo o rinuncia) e il pulsante di conferma.
- Allo scadere del timeout il dialog si chiude e si applica l'azione configurata. "Passa al GM" riapre la richiesta al GM con lo stesso timeout.
- Se il destinatario non e connesso si applica subito l'azione "allo scadere".
- Se piu destinatari ricevono la stessa richiesta vale la prima risposta; agli altri il dialog viene chiuso.

## 5. Motore del movimento

Hook `preMoveToken` (distanze iniziali) e `moveToken` (fine movimento), eseguiti solo dal GM attivo.

Per ogni token reattore sulla scena:

- ostile al token che si muove (disposizioni opposte), non se stesso;
- reazione non usata, non incapacitato, vede il bersaglio (`tokenUtils.canSee`);
- portata = massima portata delle armi da mischia impugnate (5 ft minimo), distanza 3D con dislivello;
- l'eco di un Echo Knight e un reattore del proprietario: stessa reazione, armi del proprietario, portata dall'eco.

Inneschi:

- **Attacco di opportunita**: distanza iniziale <= portata e finale > portata. Esclusi movimento forzato, teletrasporto (`displace`, `blink`, `catForce`), scambio con l'eco, bersagli con Disengage (effetto o status `disengage`/`disengaged`).
- **Polearm Master**: il bersaglio entra nella portata (iniziale > portata, finale <= portata) e il reattore impugna glaive, halberd, pike, quarterstaff o spear.
- **War Caster**: quando il reattore puo fare un attacco di opportunita, la richiesta offre anche gli incantesimi preparati a bersaglio singolo con tempo di lancio 1 azione.
- **Sentinel**:
  - il Disengage non protegge dal reattore;
  - se l'attacco di opportunita colpisce, il bersaglio ha velocita 0 fino alla fine del suo turno (effetto DAE `turnEnd`) e torna al punto di partenza del movimento, cioe l'ultimo punto dentro la portata.

La reazione viene consumata solo quando l'attacco o l'incantesimo parte davvero. Un token che ha gia reagito in questo movimento non riceve una seconda richiesta.

## 6. Vengeful Assault

La richiesta passa dal servizio: timeout e comportamento allo scadere configurabili nella riga `vengefulAssault`.

## 7. Test

Unitari, senza Foundry: configurazione e fusione dei default, risoluzione del timeout, idoneita del reattore, inneschi uscita/entrata dalla portata, esclusioni, eco come reattore, Sentinel, War Caster, esecuzione solo sul GM, nomi dei pass e degli hook.
