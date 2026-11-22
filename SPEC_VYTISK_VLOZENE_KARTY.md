# DTCO 4.1b — výtisk „Vložené karty tachografu“ (historie karet ve VU)

**Určení:** přesná datová a implementační specifikace pro Tacho Simulator. Jde o **historii vložení karet do tachografu**, ne o pouhý přehled dvou aktuálně vložených karet ani o seznam vozidel z DDD karty řidiče.

**Zdroje:**
- Oficiální český návod DTCO 4.1–4.1b, vydání 4, březen 2025: str. **90, 94 (obr. 92), 138 (pravý výtisk), 139–140 (bloky [1]–[3]), 148 (legenda [32])**. https://www.fleet.vdo.com/media/32khmiuh/ba_dtco_41b_cs_web_2025-04-22_ad.pdf
- Shodný druh výtisku uvádí i anglický návod DTCO 4.1b vydání 5, únor 2026, str. 94 a 138: https://www.fleet.vdo.com/media/1wcfjdwk/ba00-1381-41-100-102_dtco_41b_en_web_2026-02-20.pdf
- Příloha I C, dodatek 4 (tiskové výstupy), **PRT_014**, definovaná prováděcím nařízením (EU) 2016/799 ve znění (EU) 2018/502. Text části PRT_014: https://www.zakonyprolidi.cz/pravoeu/dokument?celex=32018R0502

## A. Co je doloženo přímo návodem

### Vyvolání

- Cesta: hlavní menu **Výtisk → Vozidlo → Karty**; obr. 92 na str. 94.
- Položka zobrazuje piktogramovou kombinaci **** (implementace menu `PV_CARDS`, akce `PRINT_CARDS_V`).
- Vytisknou se údaje o vložených tachografových kartách. Na str. 90 je obecný postup tisku včetně volby UTC / místní čas a krátkého oznámení zahájení tisku; u tohoto konkrétního výtisku **není výběr kalendářního dne**.
- Samostatná akce `DISP_CARDS_V` je pro zobrazení na LCD, **není předmětem této tiskové implementace**.

### Vizuální struktura z pravého příkladu na str. 138

1. **[1]** Datum a čas tisku v UTC, nahoře výtisku.
2. **[2]** Oddělovací linie a piktogram druhu výtisku; informace o generaci (`GEN2 v2`) viditelná v záhlaví.
3. **[3]** Identifikace držitele karty právě vložené do VU: příjmení, jméno, identifikace karty, platnost do, generace karty. U neosobních karet se místo jména tiskne název firmy/servisu/kontrolního orgánu (návod str. 140). Podle konkrétního stavu může existovat i identifikace další vložené karty [3a].
4. **[32]** Chronologický výpis vložených karet. Na obrázku jsou bloky oddělené čárkovanou čarou; typ/generace/verze/výrobce, identifikační číslo karty, sériové číslo, datum/čas vložení.
5. Označení konce / ukončovací oddělovač ve vzhledu ostatních výtisků. Neskládat vlastní české či anglické slovní názvy přímo do výtisku — originální výtisky používají převážně data a piktogramy.

**Pozor:** v návodu je číslo **[32]** označení vysvětlující části obrázku. Technický formát PRT_014 čísluje odpovídající datový blok **[23]** a záznam **[23.1]**. Nezaměňovat za číslo piktogramu!

### Vlastnosti tisku

- Termopapír, monospaced, přibližně **24 tiskových znakových pozic v řádku** (tuto šířku už simulátor používá).
- Zachovat přesně zalomení, mezery, separátory a existující glyfy. Nezavádět nový tiskový CSS engine.
- Reálný návod obecně uvádí oznámení zahájení tisku **3 sekundy**; výukový simulátor má podle uživatelova zadání **2 sekundy**. Použít jeho již existující mechanismus, je-li v aktuálním projektu správně implementovaný.

## B. Doplňující podrobná datová specifikace PRT_014 (legislativa)

Předepsané pořadí bloků: 

| Blok | Obsah |
|---|---|
| 1 | Datum a čas vytvoření výtisku |
| 2 | Druh výtisku / kombinace piktogramů |
| 3 | Identifikace držitele/držitelů karet právě vložených ve VU |
| 23 | Historie naposledy vložených karet do této VU |
| 23.1 | Jednotlivé záznamy vložení — **maximálně 88** |
| 12.3 | Oddělovač poruch podle normativní tabulky (ověřit konkrétní použití podle příkladu VDO, nevymýšlet záznamy poruch) |

**Podrobná pole jednoho záznamu 23.1:**
- `cardType`: typ karty včetně piktogramu (řidič / podnik / kontrola / servis, podle zdroje).
- `generation`: GEN1 / GEN2 / příslušné označení nové generace.
- `version`: verze karty, je-li známa.
- `manufacturerCode`: kód výrobce, pokud je ve zdrojových datech.
- `cardIdentification`: číslo a identifikace karty, včetně vydávajícího státu/indexů, je-li dostupná.
- `cardSerialNumber`: sériové číslo karty, **není totéž jako cardIdentification**.
- `insertedAtUtc`: datum a čas posledního vložení pro daný záznam.

PRT_014 výslovně říká „vložené karty (až 88 záznamů)“. Neomezovat historii na dnešní dvě karty ani na dvě nejnovější karty. Záznamy zobrazit chronologicky dle legendy [32].

Obecná pravidla formátu PRT_001 až PRT_006: vynechávat neznámé celé řádky, neznámá jednotlivá pole ponechat prázdná; číselné údaje zarovnávat doprava, text doleva; nevymýšlet data ani datum expirace. Není-li některý údaj v DDD/parsing vrstvách dostupný, výstup jej **nesmí synteticky odvozovat**.

## C. Co už existuje v simulátoru (kontrola větve `deploy/vercel-vdo-print`, 22. 11. 2026)

- `src/data/menu_structure.json`: `PV_CARDS` → `PRINT_CARDS_V` a zvlášť `DV_CARDS` → `DISP_CARDS_V`.
- `src/print/printWizardHandling.ts`: `resolvePrintMenuAction` zatím neobsahuje větev pro `PRINT_CARDS_V`, takže menu samotné výtisk neotevře.
- `src/print/usePrintState.ts`: stav a akce pro ostatní výtisky, **ne pro historii karet**.
- `src/print/PrintOverlays.tsx`: centralizované náhledy a PrintPreview/PrintRows, které je vhodné beze změny vzhledu využít.
- `src/print/driverCardPrintRows.ts`: `createPrintRows()`, `printDateUtc()`, `printTimeUtc()`, `separator()` a čísla glyfů — znovu použít.
- `src/TachoTypes.ts`: `CardData` má jméno, příjmení, `cardNumber`/`templateId`, ale ne všechny údaje 23.1.
- `src/dddCardSession.ts`: `DddCardRecord.original.generation`, `cardNumber`, jméno; neznamená to ale historii všech karet v **tomto** tachografu.
- `src/App.tsx`: `insertCardIntoSlot` (v aktuálně prohlédnuté verzi cca ř. 2135–2215) má obě cesty vložení: DDD i virtuální; to je přirozené místo pro zápis skutečné události do historie VU.
- `src/TachoTypes.ts`: `ActivityHistoryEntry` obsahuje `driver1CardId`, `driver2CardId` po minutách. **Nelze z toho spolehlivě odvodit přesný čas skutečného vložení, sériové číslo nebo karty podniku/servisu.**
- `src/App.tsx` a ostatní komponenty se mezitím v lokálním projektu mohly změnit; **aktuální lokální kód má přednost**. Toto je orientace, ne povel k přepsání souborů podle staré větve.

## D. Doporučené datové rozhraní (návrh implementace, nikoli doslovná citace manuálu)

```ts
export type VehicleCardInsertion = {
  id: string;              // stabilní ID konkrétního vložení
  insertedAtUtc: number;   // čas simulace; NESMÍ být Date.now()
  slot: 1 | 2;             // pro korelaci, nemusí tvořit tiskový sloupec
  cardType: 'driver' | 'company' | 'control' | 'workshop';
  cardIdentification?: string;
  cardSerialNumber?: string;
  cardGeneration?: 'GEN1' | 'GEN2' | 'GEN2 v2';
  cardVersion?: string;
  manufacturerCode?: string;
  surnameOrOrganisation?: string;
  firstName?: string;
  expiresAtUtc?: number;
};

export type InsertedCardsPrintInput = {
  printedAtUtc: number;          // simulační čas; UTC
  isUtc: boolean;
  localOffsetMs: number;
  insertedNow: Array<VehicleCardInsertion>; // jen pro blok [3], bez generování vložení
  insertionHistory: VehicleCardInsertion[]; // jen skutečná vložení v této VU
};
```

**Rozhodnutí návrhu:** události ukládat do jednoho perzistentního deníku VU, nikoli z grafu činností a nikoli z importované historie použití DDD karty v jiných vozidlech. Zápis při *úspěšném přijetí/rozpoznání karty* v obou slotech, v obou cestách DDD/virtuální. Dvě vložení téže karty = dva historické záznamy. Nepřidávat záznam při otevření nabídky, drag-over nebo zamítnutí. Případné vyjmutí kartu z historie nemaže. Ukládat jen potřebná identifikační metadata, ne celý DDD obsah. Perzistence má přežít refresh; `Reset` může historii vymazat, **pouze pokud reset v tomto projektu záměrně maže paměť VU** (ověřit chování a dát do testů). Při zobrazení zvolit nejnovějších 88 a na výtisku dodržet chronologii. Výstup při prázdné historii bez vymyšlených demo položek.

Čísla a typy karet nesmějí být hádána: například u virtuálních karet používej existující testovací identifikaci, u DDD karty originální identifikaci jen v rozsahu, ve kterém ji parser skutečně poskytuje. `GEN2 v2` z konfigurace tachografu **není automaticky** generací každé vložené karty.

## E. Tok funkce a integrace

1. V `resolvePrintMenuAction` rozpoznat `PRINT_CARDS_V` a vytvořit jednoznačnou akci `openInsertedCardsPrint`; neměnit `DISP_CARDS_V`.
2. U tohoto výtisku **není výběr data**; použít stávající volbu UTC/místní čas pro tisk, pokud je v aktuální aplikaci dostupná. Výchozí UTC. Pro místní čas použít existující výtiskové upozornění `LOC` a korektní offset.
3. Napojit novou tiskovou akci do `usePrintState`, `App`, `PrintOverlays`. **Před otevřením náhledu** použít existující dvousekundové hlášení „výtisk spuštěn“; nevytvářet další časovač nebo duplikaci.
4. Vytvořit čistou funkci `buildInsertedCardsPrintRows(input): PrintRow[]` v `src/print/insertedCardsPrintRows.ts`. Předání dat musí být deterministické, bez `Date.now()`, bez čtení localStorage přímo uvnitř builderu.
5. Použít `PrintPreview`, `PrintRows`, existující symbolový font, tiskové CSS. Případné titulky vnějšího náhledu dát do lokalizací (`cs/en/ru/mn` podle skutečně podporovaných jazyků); žádné hardcoded jazykové texty v komponentách. Na samotném papíru preferovat symboly a pole dle předlohy.
6. Respektovat 24 znakových pozic a oddělovače z existující tiskové infrastruktury. Hlídat velmi dlouhá čísla karet/řádkové zalomení.
7. Náhled otevřít až po dokončení toastu. Reset/zrušení tisku nesmí otevřít opožděné okno. Učinit bez zásahu do ostatních výtisků.

## F. Akceptační testy

1. `PRINT_CARDS_V` otevře náhled a má odpovídající hlavičku/piktogramy; `DISP_CARDS_V` nezměněno.
2. Neexistuje žádné vložení → žádné fiktivní záznamy (správné prázdné bloky).
3. Vložení do slotu 1 → v deníku jeden záznam, po vysunutí zůstane v historii.
4. Další vložení do slotu 2 → dva záznamy v chronologii; zahrnout obě karty do sekce [3], jsou-li stále vložené.
5. Opětovné vložení stejné karty → nová událost; nikoli duplicitní záznam při vícenásobném renderu.
6. Nahraný DDD soubor → vlastní vložení do **tohoto** simulátoru, žádný falešný import historie cizích tachografů.
7. 89 a více vložení → pouze **88 nejnovějších** v chronologickém pořadí.
8. Čas tisku i čas vložení je **simulační UTC**, nikoli aktuální systémový čas; korektně zpracovat lokální časovou volbu.
9. Neznámá generace/výrobce/sériové číslo → prázdné pole, nikoli fiktivní hodnota.
10. Refresh / Reset respektuje zvolenou perzistenci VU; reset během 2s obrazovky nesmí otevřít náhled.
11. Zachovaný vzhled ostatních výtisků, žádné změny teoretické znalostní báze ani ruského menu.
12. `npm run build` a případné existující testy průvodce/tiskových builderů musí projít.

## G. Otevřené drobnosti, které manuál sám neřeší

- Přesná dostupnost `cardSerialNumber`, `manufacturerCode`, generace a verze v aktuálním DDD parseru; nevymýšlet doplňky.
- Jestli `Reset` maže simulovanou paměť VU; zachovat stejnou smlouvu jako u ostatních historických údajů.
- Normativní seznam PRT_014 obsahuje i položku `12.3 Oddělovač závad`; na ilustraci VDO není detail obsahu bloku zřejmý. Nepřidávat smyšlené poruchy jen kvůli tomuto názvu.

## H. Závěrečné rozdělení původu informací

**Přímo podle návodu:** cesta menu, příklad výtisku, chronologická historie [32], pořadí viditelných oddělovačů, identifikace karty, výchozí UTC, tisk na termopapír, vysvětlení [1]–[3].

**Podle normativního dodatku:** PRT_014 a bloky [23] / [23.1], limit 88, konkrétní pole záznamu, pravidla pro neznámé položky.

**Náš návrh pro aplikaci:** datové rozhraní, perzistence, konkrétní integrace do React hooků, testovací scénáře, dvousekundová prodleva (požadavek uživatele).
