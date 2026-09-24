# Goffredo's Automation Compendium - Design

## 1. Obiettivo

Creare un modulo pubblico e riutilizzabile per Foundry VTT che raccolga le automazioni mancanti o non piu funzionanti nella campagna Wildemount, senza trasformare il mondo Foundry o il repository della campagna in fonti tecniche concorrenti.

La prima release, `0.1.0`, automatizza integralmente le capacita Echo Knight 2014 `Manifest Echo` e `Unleash Incarnation`. Le release successive aggiungeranno, una alla volta, le automazioni effettivamente usate dai quattro PG.

## 2. Repository e distribuzione

- Repository locale separato: `C:\Users\ingfr\OneDrive\Documenti\ChatGPT\Goffredo-Compendium`.
- Repository GitHub pubblico dedicato.
- Nome visibile: `Goffredo's Automation Compendium`.
- ID tecnico e cartella del modulo: `goffredo-compendium`.
- Branch principale: `main`.
- Versionamento semantico; prima release funzionale `0.1.0`.
- Release GitHub con `module.json` stabile e archivio ZIP installabile da Foundry e The Forge.
- Il repository viene aggiunto allo stesso workspace VS Code della campagna, ma non viene annidato nel repository `Wildemount Campaign`.

## 3. Compatibilita iniziale

La matrice verificata iniziale e:

| Componente | Versione |
| --- | --- |
| Foundry VTT | 14.367 |
| D&D5e | 5.3.3, regole 2014 |
| Midi-QOL | 14.0.12 |
| DAE | 14.0.14 |
| CAT | 0.0.8 |
| Sequencer | 4.2.3, opzionale per le animazioni |
| Levels | 7.0.3, supportato e testato |

Il manifesto dichiara D&D5e, Midi-QOL, DAE e CAT come dipendenze richieste. Sequencer e Levels sono integrazioni opzionali: l'automazione deve restare funzionale senza animazioni e sulle scene prive di livelli.

Il modulo controlla le dipendenze e le versioni all'avvio. In caso di incompatibilita mostra un avviso al GM e non esegue parzialmente un'automazione rischiosa.

## 4. Architettura

```text
Goffredo-Compendium/
  module.json
  scripts/
    main.js
    registry.js
    api/
    automations/2014/
      fighter/echo-knight/
        manifest-echo.js
        unleash-incarnation.js
        echo-state.js
  packData/
    class-features-2014/
    spells-2014/
    feats-2014/
    equipment-2014/
    summons-2014/
  packs/
  lang/
    en.json
    it.json
  tests/
    unit/
    fixtures/
  docs/
  LICENSE
  THIRD_PARTY_NOTICES.md
```

### 4.1 Codice

Il modulo usa ES modules. Ogni automazione vive in un file focalizzato e viene registrata tramite un identificatore stabile, per esempio:

```text
goffredo.echo-knight.manifest-echo
goffredo.echo-knight.unleash-incarnation
```

Gli Item dei compendi conservano attivita, effetti, metadati e identificatore. La logica eseguibile resta nel modulo, non in macro di mondo o in lunghi script incorporati negli Item.

Il registro collega gli identificatori agli hook di Midi-QOL, D&D5e, CAT e Foundry necessari. Le API non pubbliche di Foundry vengono evitate quando esiste un equivalente pubblico.

Le responsabilita sono separate come segue:

- D&D5e Activities fornisce i comandi visibili e gestisce azioni, utilizzi e recuperi;
- Midi-QOL espone e risolve i workflow di attacco e reazione;
- DAE conserva gli effetti temporanei e i controlli disponibili mentre l'eco e attivo;
- CAT esegue le operazioni privilegiate, come creazione e rimozione del token, anche quando ad agire e un giocatore;
- Foundry Public API gestisce documenti, token, misure e hook di turno;
- Levels viene interrogato soltanto quando attivo per superfici, elevazione e collisioni verticali.

Non viene introdotto un protocollo socket proprietario finche CAT offre un'esecuzione GM adeguata.

### 4.2 Compendi

I compendi iniziali sono:

- `Class Features 2014`, tipo Item;
- `Spells 2014`, tipo Item;
- `Feats 2014`, tipo Item;
- `Equipment 2014`, tipo Item;
- `Summons 2014`, tipo Actor.

Il `module.json` usa `packFolders` per raccoglierli sotto una cartella visibile `Goffredo's Automation Compendium`, con sottocartella `2014`.

I documenti sono mantenuti in `packData` come JSON leggibile e revisionabile. Durante la build vengono generati i pack LevelDB destinati alla release; i file generati non sono la fonte primaria.

### 4.3 Localizzazione

- Inglese come lingua predefinita.
- Traduzione italiana completa in `lang/it.json`.
- Nomi canonici delle capacita mantenuti in inglese per facilitarne ricerca e riconoscimento.
- Notifiche, finestre e istruzioni operative passano sempre dal sistema di localizzazione.

## 5. Contenuti e licenze

- Codice originale del progetto pubblicato con licenza MIT.
- Codice adattato da progetti MIT mantiene avvisi, attribuzioni e copyright applicabili.
- `THIRD_PARTY_NOTICES.md` documenta per ogni adattamento: progetto, autore, licenza, URL, file o idea di provenienza e natura delle modifiche.
- Nessuna immagine ufficiale o asset commerciale viene distribuito.
- Nessuna descrizione integrale non SRD viene inclusa.
- I contenuti SRD possono usare il testo consentito dalla relativa licenza, accompagnato dalle attribuzioni richieste.
- Le capacita non SRD ricevono soltanto brevi istruzioni operative originali, sufficienti a usare l'automazione senza riprodurre il testo editoriale ufficiale.
- Le animazioni opzionali possono richiamare soltanto asset liberamente distribuibili o gia installati dall'utente; l'assenza degli asset non blocca la meccanica.

## 6. Manifest Echo

### 6.1 Evocazione

- L'attivita usa un'azione bonus.
- Il giocatore seleziona un punto libero e visibile entro 15 ft dal proprio token.
- La distanza viene misurata in tre dimensioni quando la scena usa elevazioni.
- La posizione puo trovarsi a un'elevazione differente purche sia visibile, libera, entro 15 ft e compatibile con i limiti fisici della scena.
- Non e consentita l'evocazione attraverso muri, porte chiuse o in spazi occupati.
- Se esiste gia un eco attivo dello stesso attore, il precedente viene rimosso prima di crearne uno nuovo.
- L'eco viene creato da un Actor template incluso in `Summons 2014` e configurato dai dati correnti dell'evocatore.

### 6.2 Statistiche dell'eco

- 1 punto ferita.
- CA `14 + bonus di competenza` dell'evocatore.
- Stessa taglia dell'evocatore.
- Immunita alle condizioni previste dalla capacita.
- Tiri salvezza risolti usando i bonus dell'evocatore.
- Token visivamente riconoscibile come eco e collegato in modo univoco all'attore che lo ha evocato.
- L'eco non e trattato come un normale alleato per effetti che richiedono una creatura, salvo esplicita compatibilita con la regola della capacita.

### 6.3 Stato e proprieta

L'associazione fra evocatore ed eco viene conservata in flag namespaced del modulo, non nel nome del token. I flag registrano almeno:

- UUID dell'attore evocatore;
- UUID e token ID dell'eco;
- scena di appartenenza;
- versione dello schema dei dati;
- eventuale stato necessario alle reazioni.

La cancellazione del token, il cambio scena, la disattivazione dell'attore o la nuova evocazione ripuliscono lo stato senza lasciare riferimenti orfani.

### 6.4 Movimento

- Il proprietario di Ash controlla il token dell'eco.
- Durante il proprio turno puo muoverlo fino a 30 ft senza spendere azioni. Il modulo non dipende dal nome Ash: vale per qualunque evocatore proprietario.
- `In qualsiasi direzione` include il movimento verticale. La distanza percorsa viene misurata in tre dimensioni.
- Il movimento usa il normale sistema della scena, incluse collisioni e superfici Levels, con un controllo dedicato per modificare l'elevazione senza superare il budget di movimento.
- Il modulo traccia la distanza percorsa nel turno e impedisce di superare il limite della capacita.
- Al termine del turno dell'evocatore viene misurata la distanza tridimensionale fra evocatore ed eco.
- Se la distanza supera 30 ft, l'eco viene rimosso automaticamente e viene mostrato un messaggio localizzato.

### 6.5 Attacco dalla posizione dell'eco

- Quando l'evocatore compie l'azione Attack, puo scegliere per ciascun attacco se originarlo dal proprio spazio o da quello dell'eco.
- L'attacco usa arma, bonus, vantaggi, svantaggi e danni dell'evocatore.
- Portata, linea di vista, copertura e distanza dal bersaglio vengono calcolate dalla posizione scelta.
- L'eco non compie un proprio attacco e non possiede un turno separato.
- Il flusso non duplica consumo di munizioni, risorse o effetti dell'arma.

### 6.6 Attacco di opportunita

- Se una creatura visibile all'evocatore si allontana di almeno 5 ft dalla portata dell'eco, il proprietario riceve la proposta di usare la propria reazione.
- L'attacco viene risolto come proveniente dallo spazio dell'eco.
- La reazione viene consumata una sola volta e rispetta le esclusioni applicabili al movimento forzato e alle forme di movimento che non provocano attacchi di opportunita.
- Se Midi-QOL ha gia consumato o bloccato la reazione, l'automazione non propone un secondo attacco.

### 6.7 Scambio di posizione

- Attivazione con azione bonus.
- Richiede un eco valido e presente nella stessa scena.
- Consuma 15 ft del movimento disponibile dell'evocatore.
- Evocatore ed eco scambiano posizione ed elevazione in modo atomico.
- Entrambe le destinazioni devono essere valide; in caso contrario nessun token viene mosso e nessuna risorsa viene consumata.

### 6.8 Dismiss

- Attivazione con azione bonus.
- Rimuove soltanto l'eco associato all'attore che usa la capacita.
- Ripulisce flag, effetti e controlli collegati.
- La rimozione manuale del token esegue la stessa pulizia senza richiedere l'azione bonus.

### 6.9 Comandi visibili al giocatore

L'Item `Manifest Echo` espone attivita separate e localizzate:

- `Manifest / Evoca`;
- `Attack from Echo / Attacca dall'eco`;
- `Swap Positions / Scambia posizione`;
- `Dismiss / Congeda`.

Quando l'eco e attivo, DAE mantiene un effetto di controllo sull'evocatore che rende disponibili gli stessi comandi nelle interfacce compatibili, senza creare copie permanenti di Item sulla scheda. Il comando di attacco fa scegliere una delle armi o degli attacchi validi dell'evocatore e avvia un solo workflow dalla posizione dell'eco. Il movimento resta un controllo diretto del token, con un comando localizzato dedicato esclusivamente alla variazione di elevazione.

## 7. Unleash Incarnation

- E disponibile quando l'attore compie l'azione Attack e possiede un eco valido.
- Permette un singolo attacco melee aggiuntivo dalla posizione dell'eco.
- Non concede una nuova azione Attack e non duplica automaticamente Extra Attack.
- Usa le stesse regole di portata, visuale e copertura dell'attacco originato dall'eco.
- Numero massimo di utilizzi pari al modificatore di Costituzione, minimo uno.
- Recupero completo al riposo lungo.
- Il consumo avviene soltanto quando l'attacco viene effettivamente avviato; annullare la selezione non consuma utilizzi.
- Il modulo evita una seconda proposta durante la stessa azione Attack dopo che la capacita e stata usata.

## 8. Flusso di installazione e aggiornamento degli Item

1. Il GM installa e abilita il modulo.
2. Foundry verifica dipendenze e compatibilita.
3. Il GM importa gli Item dal compendio oppure applica l'automazione a un Item gia esistente tramite identificatore.
4. Gli Item importati funzionano senza macro di mondo aggiuntive.
5. Gli aggiornamenti del modulo non sovrascrivono automaticamente le descrizioni private o importate legalmente sui personaggi.
6. Una futura funzione di aggiornamento confronta la versione dell'automazione e propone al GM l'allineamento dei soli dati tecnici gestiti dal modulo.

Per la release `0.1.0` l'applicazione automatica agli Item esistenti puo essere limitata a una procedura GM esplicita. Non vengono eseguite migrazioni silenziose sugli attori.

## 9. Errori e sicurezza operativa

- Nessuna automazione modifica l'attore se manca un prerequisito essenziale.
- Le operazioni composite, come lo scambio, validano tutto prima di consumare risorse o spostare token.
- Gli errori tecnici completi vengono registrati nella console; al giocatore appare un messaggio breve e comprensibile.
- Gli avvisi di configurazione sono mostrati al GM e non intasano la chat dei giocatori.
- Gli hook vengono filtrati per identificatore e actor UUID, evitando interferenze con omonimi o altri Echo Knight.
- Il modulo non dipende dal nome `Ash` e deve funzionare con qualunque attore compatibile.

## 10. Verifica

### 10.1 Test automatici

I test unitari coprono almeno:

- calcolo CA e utilizzi;
- controllo delle distanze 15/30 ft;
- budget di movimento dell'eco;
- selezione e validazione dell'eco associato;
- transizioni di stato e pulizia dei flag;
- prevenzione dei doppi consumi;
- fallback di localizzazione inglese e italiano.

### 10.2 Collaudo Foundry

Il collaudo iniziale viene eseguito su una copia di Ash e include:

- uso come GM;
- uso come giocatore proprietario;
- scena senza Levels;
- scena Levels sul piano base;
- due superfici a elevazioni differenti;
- ostacoli, porte chiuse e spazio occupato;
- nuova evocazione con eco gia attivo;
- cancellazione manuale del token;
- fine turno oltre 30 ft;
- attacco melee e ranged dalla posizione dell'eco;
- reazione e movimento forzato;
- scambio valido e scambio impossibile;
- Unleash Incarnation con zero, uno e piu utilizzi;
- riposo lungo;
- assenza di Sequencer o asset animati.

Solo dopo il collaudo l'automazione viene applicata agli Item dell'attore Ash usato in campagna.

## 11. Fuori ambito per la release 0.1.0

- Supporto D&D5e 2024.
- Foundry 13 o versioni precedenti.
- Automazione completa di tutti i PG nella prima release.
- Interfaccia grafica generale per costruire automazioni.
- Distribuzione di descrizioni, immagini o asset non autorizzati.
- Compatibilita dichiarata con versioni future non ancora testate di Foundry, D&D5e o Midi-QOL.

## 12. Criteri di accettazione della 0.1.0

La release e pronta quando:

1. Il modulo si installa da un manifest GitHub pubblico e si abilita senza errori sulla matrice iniziale.
2. I compendi appaiono nelle cartelle previste e sono localizzati in inglese e italiano.
3. Manifest Echo e Unleash Incarnation soddisfano tutti i comportamenti delle sezioni 6 e 7.
4. Nessun testo o asset non distribuibile e incluso.
5. Tutti i test automatici passano.
6. Il collaudo Foundry su copia di Ash passa sia come GM sia come giocatore.
7. L'attore Ash originale non viene modificato prima dell'approvazione del GM.
