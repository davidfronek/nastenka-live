# Nastenka Live

Klasicky fullstack projekt pro kolaborativni post-it nastenku.

## Co umi

- prihlaseni vice uzivatelu najednou (kazdy uzivatel v jinem okne/tabu)
- realtime synchronizace listku pres Socket.IO
- pridavani listku s delegaci (Od -> Pro), prioritou a terminem
- drag and drop presouvani listku po spolecne plose
- oznaceni ukolu jako hotovy
- mazani listku po jednom i hromadne (vsechny najednou)
- zivy feed aktivity a seznam online uzivatelu
- zaznam stavu nastenky pri ukonceni prace (pozice listku, pocet, popisy)

## Struktura

- `server.js` - Node + Express + Socket.IO server
- `index.html`, `styles.css`, `app.js` - klient

## Spusteni

1. `cd h:\projects\nastenka-live`
2. `npm install`
3. `npm run dev`
4. Otevri `http://localhost:3099`

Pro simulaci vice uzivatelu otevri stejnou adresu ve vice oknech nebo ruznych prohlizecich a prihlas kazdeho uzivatele zvlast.

## Snapshoty po ukonceni prace

- Tlacitko "Ukoncit praci a ulozit snapshot" ulozi aktualni stav boardu.
- Pri zavreni zalozky se snapshot uklada automaticky.
- Ulozene zaznamy jsou v dennim souboru `data/board-snapshots-YYYY-MM-DD.json`.
- Pri startu serveru se automaticky obnovi posledni dostupny snapshot.
- Kazdy zaznam obsahuje: cas ulozeni, uzivatele, pocet listku a detail kazdeho listku vcetne pozice `x` a `y`.

## Firebase / Firestore

Ve vychozim nastaveni se pouzivaji lokalni JSON soubory. Pro externi uloziste vytvor Firebase projekt s aktivnim Cloud Firestore a servisni ucet. Nastav mimo repozitar:

```powershell
$env:STORAGE_PROVIDER = "firestore"
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\firebase-service-account.json"
```

Alternativne lze pouzit `FIREBASE_SERVICE_ACCOUNT_JSON` s obsahem JSON servisniho uctu. Servisni klic nikdy nevkladej do `index.html`, `app.js` ani do verejneho repozitare.

Jednorazovy import existujicich lokalnich dat:

```powershell
npm run firestore:import
```

Po importu spust server se stejnymi promennymi prostredi. Firestore rezim uklada uzivatele, snapshoty i aktivitu; pri vypnutem `STORAGE_PROVIDER` zustava puvodni lokalni chovani.
