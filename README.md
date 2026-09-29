# Nastenka Live

Klasicky fullstack projekt pro kolaborativni post-it nastenku.

Uzivatelsky navod je v souboru [MANUAL.md](MANUAL.md).

## Co umi

- prihlaseni vice uzivatelu najednou (kazdy uzivatel v jinem okne/tabu)
- realtime synchronizace listku pres Socket.IO
- pridavani listku s delegaci (Od -> Pro), prioritou a terminem
- drag and drop presouvani listku po spolecne plose
- oznaceni ukolu jako hotovy
- mazani listku po jednom i hromadne (vsechny najednou)
- zivy feed aktivity a seznam online uzivatelu
- automaticke i rucni zalohy cele plochy vcetne spojnic a textovych prvku

## Struktura

- `server.js` - Node + Express + Socket.IO server
- `index.html`, `styles.css`, `app.js` - klient

## Spusteni

1. `cd h:\projects\nastenka-live`
2. `npm install`
3. `npm run dev`
4. Otevri `http://localhost:3099`

Pro simulaci vice uzivatelu otevri stejnou adresu ve vice oknech nebo ruznych prohlizecich a prihlas kazdeho uzivatele zvlast.

## Snapshoty a zalohy plochy

- V levem docku otevri sekci "Zalohy".
- Tlacitko "Ulozit snapshot nyni" ulozi rucni snapshot.
- Tlacitko "Obnovit posledni snapshot" obnovi nejmladsi ulozenou zalohu.
- Server uklada automaticky snapshot zmenene plochy jednou za 5 minut; navigace nebo zavreni zalozky uz nevytvari duplicitni snapshot.
- Uchovava se nejvyse 30 snapshotu. Starsi snapshot se odstrani pouze po ulozeni noveho snapshotu, nikdy jen pri startu serveru bez nove zmeny.
- Ulozene zaznamy jsou v dennim souboru `data/board-snapshots-YYYY-MM-DD.json`.
- Pri startu serveru se automaticky obnovi posledni dostupny snapshot.
- Snapshot obsahuje tickety, textove prvky, spojnice, formatovani, pozice, rozmery a metadata.

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

## PostgreSQL

PostgreSQL rezim uklada uzivatele, snapshoty a historii aktivity do databaze. Stav plochy se pri startu obnovi z posledniho snapshotu stejne jako v lokalnim a Firestore rezimu.

Databazi a samostatneho uzivatele lze na serveru zalozit jako PostgreSQL administrator:

```sql
CREATE USER nastenka_live WITH PASSWORD 'nahodne-dlouhe-heslo';
CREATE DATABASE nastenka_live OWNER nastenka_live;
```

V serverovem prostredi aplikace nastav:

```dotenv
STORAGE_PROVIDER=postgres
DATABASE_URL=postgresql://nastenka_live:heslo@127.0.0.1:5432/nastenka_live
```

Pro vzdalenou databazi vyzadujici TLS pridej `PGSSLMODE=require`. Heslo ani cele `DATABASE_URL` neukladej do repozitare. Pri nasazeni pres VPS dashboard patri promenne do editoru prostredi domeny `nastenka-live.onremote.cz`.

Schema v `database/schema.sql` se vytvori automaticky pri startu. Lze je pripravit i samostatne:

```bash
npm run postgres:init
```

Jednorazovy import existujicich lokalnich JSON dat spust pred prvnim produkcnim startem v PostgreSQL rezimu:

```bash
npm run postgres:import
```

Import prevadi `data/users.json`, vsechny soubory snapshotu a behy aktivity. Opakovane spusteni aktualizuje zaznamy se stejnym ID.

## Export a analyza historie

Administratori maji v `admin.html` panel `Analýza live feedu`. Umoznuje hledat v historickych udalostech podle textu, uzivatele a data a stahnout:

- snapshoty jako JSON nebo CSV,
- live feed jako JSON nebo CSV.

Pri kazdem startu server vytvori novy beh live feedu. Stary feed se uz neobnovuje do zive plochy, ale zustava ulozeny pro pozdejsi analyzu. Ve Firestore jsou behy ulozene v kolekci `nastenka/activity/runs`; lokalne se ukladaji do samostatnych JSON souboru v `data/activity/YYYY-MM-DD/`.
