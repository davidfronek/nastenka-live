# Nástěnka Live: uživatelský manuál

Nástěnka Live je společná online plocha pro zadávání, delegování a sledování ticketů v reálném čase. Změny provedené jedním uživatelem se zobrazí ostatním připojeným uživatelům.

## 1. Přihlášení

1. Otevřete adresu Nástěnky Live.
2. Přihlaste se e-mailem a heslem.
3. Pokud potřebujete pouze prohlížet plochu, můžete zvolit **Pokračovat jako host**.

Host má přístup pouze pro náhled. Může si prohlížet tickety, feed a online uživatele a používat filtraci, ale nemůže vytvářet, upravovat, přesouvat, řešit ani mazat tickety, měnit texty, spravovat spojnice, ukládat nebo obnovovat snapshoty ani měnit heslo. Host nemá vlastní registrovaný účet ani heslo.

Po přihlášení se v horní části zobrazí vaše jméno, počet online uživatelů a případně odkaz **Správa uživatelů**, pokud máte administrátorskou roli.

## 2. Orientace v nástěnce

Vlevo je svislý dock s hlavními nástroji:

- **Nový ticket**: otevře formulář pro vytvoření ticketu.
- **Filtrace**: zobrazí pouze tickety vybraného řešitele.
- **Zálohy**: ruční uložení a obnova posledního snapshotu.
- **Můj účet**: změna vlastního hesla.
- **Spojnice**: propojení dvou ticketů čárou.

Po kliknutí na nástroj se otevře odpovídající panel. Dalším kliknutím lze panel zavřít.

## 3. Vytvoření ticketu

Ticket můžete vytvořit přes panel **Nový ticket** nebo rychlým vytvořením přímo na ploše.

Vyplňte:

- **Zadání**: popis úkolu nebo požadavku.
- **Autor**: vyplní se automaticky podle přihlášeného uživatele.
- **Řešitelé**: jeden nebo více uživatelů, kterým je ticket určen.
- **Priorita**: nízká, střední nebo vysoká.
- **Do data**: volitelný termín dokončení.
- **Barva**: barva ticketu na ploše.

V editoru zadání lze použít tučné písmo, kurzívu, velikost a zarovnání textu. K dispozici je také vložení smajlíku nebo textu ze schránky.

Ticket vytvoříte tlačítkem **Přidat ticket**. Nový ticket se okamžitě zobrazí všem připojeným uživatelům.

## 4. Práce s ticketem

Tickety můžete na ploše přesouvat přetažením. Kliknutím na ticket otevřete jeho náhled s podrobnostmi.

Podle oprávnění můžete:

- ticket upravit,
- změnit jeho velikost,
- označit ho jako vyřešený,
- obnovit vyřešený ticket zpět na plochu,
- ticket smazat.

Autor může upravovat a mazat své aktivní tickety. Administrátor má rozšířená oprávnění. U vyřešených ticketů se zobrazí ovládání pro jejich obnovení nebo odstranění.

### Označení jako vyřešený

Klikněte na tlačítko **Vyřešeno**. Ticket se přesune do archivu vyřešených ticketů. Pokud jsou vyřešené tickety mimo aktuální výřez plochy, zobrazí se informace o jejich směru v levém spodním rohu. Kliknutím na tuto informaci se plocha přesune k vyřešeným ticketům.

## 5. Filtrace a výběr více ticketů

V panelu **Filtrace** vyberte řešitele. Plocha se zaměří na tickety přiřazené vybranému uživateli.

Pro hromadné operace použijte výběr ticketů na ploše. Poté lze podle dostupných oprávnění:

- hromadně označit tickety jako vyřešené,
- smazat vybrané tickety,
- upravit vybraný ticket.

Před trvalým smazáním aplikace zobrazí potvrzovací dialog.

## 6. Spojování ticketů

1. Klikněte na ikonu **Spojnice**.
2. Klikněte na první ticket.
3. Klikněte na druhý ticket.

Mezi tickety se vytvoří spojnice. Opětovným použitím nástroje lze vytvořit další spojení. Spojnice jsou součástí snapshotů.

## 7. Živý feed a online uživatelé

V pravé části nástěnky je **Živý feed**. Zobrazuje poslední události, například vytvoření, přesunutí, úpravu, vyřešení nebo smazání ticketu.

Feed začíná po každém spuštění serveru znovu. Starší události se nemažou automaticky; administrátor je může vyhledávat a exportovat v části **Analýza live feedu**.

Časy ve feedu jsou zobrazovány v časovém pásmu Europe/Prague.

## 8. Snapshoty a obnova plochy

V panelu **Zálohy** jsou k dispozici dvě akce:

- **Uložit snapshot nyní**: uloží aktuální stav plochy.
- **Obnovit poslední snapshot**: načte nejnovější uložený stav.

Server navíc ukládá změněnou plochu automaticky jednou za pět minut. Uchovávají se pouze tři nejnovější snapshoty.

Snapshot obsahuje:

- aktivní i vyřešené tickety,
- textové prvky,
- spojnice,
- pozice a rozměry,
- formátování a metadata ticketů.

Obnova snapshotu nahradí aktuální stav plochy. Používejte ji proto pouze tehdy, když chcete obnovit uloženou verzi.

## 9. Změna hesla

1. Otevřete panel **Můj účet**.
2. Zadejte aktuální heslo.
3. Zadejte nové heslo.
4. Nové heslo zopakujte v poli pro potvrzení.
5. Klikněte na **Změnit heslo**.

Nové heslo musí mít alespoň 6 znaků a musí se lišit od původního hesla. Po úspěšné změně zůstává aktuální přihlášení aktivní.

Pokud si heslo nepamatujete, požádejte administrátora o jeho resetování.

## 10. Administrace

Administrátorský účet má v horní liště odkaz **Správa uživatelů**.

Administrátor může:

- vytvořit účet,
- upravit uživatelské jméno, e-mail, roli a barvu,
- nastavit nebo resetovat heslo,
- účet smazat,
- vyhledávat historické události podle textu, uživatele a data,
- mazat vybrané záznamy aktivity,
- exportovat feed ve formátu JSON nebo CSV,
- exportovat snapshoty ve formátu JSON nebo CSV.

Při úpravě existujícího uživatele není nutné heslo vyplňovat, pokud ho nechcete změnit.

## 11. Odhlášení

Klikněte na **Odhlásit** v horní části obrazovky. Odhlášení ukončí všechna otevřená připojení stejné session.

Při problémech s připojením stránku obnovte a zkontrolujte, zda používáte správný účet. Změny se synchronizují pouze při aktivním připojení k serveru.
