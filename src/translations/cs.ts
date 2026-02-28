import type { Translations } from './types'

export const cs: Translations = {
  ui: {
    language: 'Jazyk',
    selectLanguageTitle: 'Vybrat jazyk rozhraní',
    back: 'Zpět',
    up: 'Nahoru',
    down: 'Dolů',
    confirm: 'Potvrdit',
    close: 'Zavřít',
    reset: 'Reset',
    slotOccupied: 'Slot obsazen',
    slot1DragHint: 'Slot 1 – přetáhněte kartu 1 sem',
    slot2DragHint: 'Slot 2 – přetáhněte kartu 2 sem',
    ignitionOffNoCard: 'Zapalování vypnuto – vložení karty nelze',
    ejectBtn1Title: 'Krátký stisk: přepnutí symbolu vlevo. Podržení 2 s: vysunutí karty 1',
    ejectBtn2Title: 'Krátký stisk: přepnutí symbolu vpravo. Podržení 2 s: vysunutí karty 2',
    expandInfoboxes: 'Rozbalit infoboxy',
    collapseInfoboxes: 'Sbalit infoboxy',
    infoPanelIconsLabel: 'Ikony informací a výstrah',
    infoPanelLabel: 'Informace a výstrahy',
    nr165Label: 'Varování NR 165',
    printVehicle24hTitle: 'Výtisk vozidlo 24h den',
    printVDiagramTitle: 'Výtisk V-diagram',
    printSpeedVehicleTitle: 'Výtisk vozidlo – překročení rychlosti',
    driver1: 'Řidič 1',
    driver2: 'Řidič 2',
    saved: 'uloženo',
    ferryModeStart: 'režim trajekt začátek',
    ferryModeEnd: 'režim trajekt konec',
    outModeStart: 'out začátek',
    outModeEnd: 'out konec',
    driverCardsTest: 'Karty řidičů (testovací)',
    speedLabel: 'Rychlost',
    cardZmizik: 'Karta Zmizík',
    cardZmizikSlot1: 'Karta Zmizík (slot 1)',
    cardZmizikSlot2: 'Karta Zmizík (slot 2)',
    cardRoman: 'Karta Roman',
    cardRomanSlot1: 'Karta Roman (slot 1)',
    cardRomanSlot2: 'Karta Roman (slot 2)',
    hoursLabel: 'Hodiny',
    minutesLabel: 'Minuty',
    cannotDecrementTime: 'Čas nemůže být menší než simulovaný čas',
    decrementHours: 'Zmenšit hodiny',
    decrementMinutes: 'Zmenšit minuty',
    applyTimeTitle: 'Přenést nastavený čas na displej tachografu',
    remoteDataDownloadActive: 'Vzdálené stahování dat aktivní',
    card1EndedByTargetCountry: 'Karta 1 ukončena cílovou zemí',
    ignitionLabel: 'Zapalování',
    stopIgnition: 'Vypnout zapalování',
    drivingCannotStop: 'V režimu jízdy nelze vozidlo vypnout',
    resetTitle: 'Vynulovat časy činností, vysunout karty, nastavit hodiny na aktuální čas a vypnout zařízení (STOP)',
    simulate4h10mTitle: 'Zapsat 4h10m jízdy s krátkými zastávkami (do paměti) a posunout čas dopředu',
    simulate4h10mDisabledNoCardTitle: 'Vyžaduje vloženou kartu řidiče',
    generate4h10mDriving: 'Generovat 4h10m jízdy',
    printoutTitle: 'Výtisk tachografu',
    vDiagramTitle: 'V-diagram rychlosti',
  },
  infoPanel: {
    standbyModeInfo: 'Zařízení je v režimu Stand-by. Zapni zapalování tlačítkem Start.\nVše je ve vývoji, případné chyby mi nahlaš na lukas@zmizik.com',
    insertCardToSlot1: 'Pokud chceš zahájit řízení, vlož kteroukoli kartu přetáhnutím do slotu č. 1.', // 1
    drivingWithoutCard: 'Jízda bez karty – vlož kartu řidiče do slotu 1. Tato výstraha se zapisuje do paměti tachografu.', // 2
    break415: 'Výstraha 4:15 – proveď pauzu 15 minut nebo 30 minut (pokud jsi už měl 15m).', // 3
    break430: 'Výstraha 4:30 – Překročil jsi dobu řízení! Neprodleně udělej přestávku 45 minut. Tato událost se zapíše do paměti jako (27)(38) Porušení bezpečnosti.', // 4
    supplementActivities: 'Nyní jsi povinen doplnit aktivity na svou kartu.', // 5
    lastWithdrawal: 'Poslední vytažení karty bylo', // 6
    endCountryFound: 'Našel jsem záznam o ukončení směny v', // 7
    endCountryDuplicateWarning: 'Nalezeno dřívější ukončení směny v {dateTime}. Tímto krokem bude tvůj záznam vykazovat chybu.',
    nr165Warning: 'Hodláš podruhé za sebou zadat výchozí zemi. Toto by byl přestupek podle NR 165...', // 8
    generateWorkWeekBlocked: 'Na kartě jsou uložená data. Proto se náhodná data nevygenerovala. Smaž data z karty tlačítkem "Reset" a zkus to znovu.',
    manualEntryData: 'Vložená data:',
    vehicleCheckBeforeDrivingWarning: 'Před jízdou bylo nutné provést kontrolu vozidla a ta se vykazuje aktivitou (9). Teď řídíš, ale nepostupuješ správně podle Nařízení (EU) č. 165/2014',
    vehicleCheckBeforeDrivingShort: 'Před jízdou bylo nutné provést kontrolu vozidla a ta se vykazuje aktivitou (9). Tvoje kontrola před jízdou byla kratší než 4 minuty. To může být pro některé kontrolní orgány sporné a můžou to brát jako přitěžující okolnost.',
    idleWarningConfirmInfo: 'Zařízení čeká na potvrzení tvé volby. Pokud do 10 minut neprovedeš žádnou akci, karta bude automaticky vysunuta a zadané údaje nebudou uloženy.',
    readyToDrivePreDepartureCheck: 'Tachograf sice indikuje možnost zahájit jízdu, avšak před samotným výjezdem je řidič povinen provést předepsanou kontrolu vozidla. Tato činnost se zaznamenává jako jiná práce (9)',
    crewModeInfo: 'Právě byly splněny podmínky pro režim osádky. Váš plovoucí den má 30 hodin během kterých bude vaše běžná doba denního odpočinku 9 hodin. Denní dobu odpočinku nelze trávit v jedoucím vozidle! Pamatuj, že pokud se řidič 1 rozjede bez karty vložené ve slotu 2, přeruší se režim osádky. Oba řidiči musí směnu skončit současně!',
    crewModeNotMetInfo: 'Byla zaznamenána přitomnost druhé karty, avšak nebyly splněny podmínky režimu osádky. Plovoucí den každého z vás je 24 hodin. V tomto čase musíte stihnout dokončit vaše denní doby odpočinku.',
    crewModeInterruptedWarning: 'Jelikož řidič č. 1 zahájil jízdu bez řidiče č. 2, došlo k přerušení režimu osádky a vaše zapsané aktivity překračují parametry pro délku směny jednoho řidiče. Toto je porušení bezpečnosti!',
    duplicateDataWarning: 'Pozor, na kartě jsou již uložená data. Nelze zapisovat data do obsazené paměti. Vymaž data tlačítkem Reset',
    publishDataConsentInfo: 'Při prvním použití karty se zobrazí výzva k udělení souhlasu se zpracováním osobních údajů, případně zvláštních kategorií osobních údajů. Udělený souhlas lze kdykoli následně odvolat prostřednictvím menu zařízení.',
    card1EndedByTargetCountryInfo: 'Uložil jsem na kartu {dateTime} (41)(37) cílovou zemi. Výchozí záznam v simulátoru byl bez ukončené směny. Tuto volbu můžeš libovolně měnit. Slouží pro výukové účely.',
    excessSpeedWarning: 'Byla zaznamenána (39)(39) příliš vysoká rychlost. Došlo k překročení konstrukční rychlosti vozidla. Tato událost je automaticky zaznamenána do paměti tachografu!',
    ejectionBlockedWarning: 'Toto je chyba! Nemůžeš vytahovat kartu během jízdy!',
    menuComingSoon: 'Tato položka zatím není aktivní. Coming soon:)',
    outModeActiveInfo: 'Byl aktivován režim OUT. Doba řízení (2) je v tomto režimu zaznamenávána jako jiná práce (9). Seznamte se s podmínkami, za nichž lze tento režim používat.',
  },
  cardWizard: {
    pleaseWait: 'prosím čekejte!', // 9
    lastRemoval: 'Posled. vyjmutí', // 10
    decision1m: '{slot}(42)\u00A0vstup', // 11 – {slot} = číslo slotu (1/2), (19) = symbol M
    supplement: 'doplnit?', // 12
    yes: 'ano', // 13
    no: 'ne', // 14
    startCountry: 'výchozí země', // 15
    endCountry: 'cílová země', // 16
    firstInsertion: 'První vložení', // 17
    regionSpain: 'region Španělsko', // 18
    idlePlease: 'prosím', // 19
    input: 'zadání', // 20
    itsQuestion: 'ITS data?', // 21
    vdoQuestion: 'VDO data?', // 22
    publish: 'Publikovat', // 23
    inputSaved: 'uloženo', // 24
    confirmData: 'vložená data', // 25
    confirm: 'potvrdit?', // 26
    readyToDrive: 'k jízdě', // 27
    publishReady: 'připraven', // 28
  },
  tachoDisplay: {
    input: 'zadání', // 29
    saved: 'uloženo', // 30
    endCountry: 'cílová země', // 31
    startCountry: 'výchozí země', // 32
    printUtc: 'UTC času?', // 33
    printStarted: 'spuštěn...', // 34
    cardWarning: '\u00A0karta!', // 35 (nezlomitelná mezera před textem)
    excessSpeed: 'vys. rychlost',
    ejectionBlockedL1: 'výhoz není',
    ejectionBlockedL2: 'možný',
  },
  actionLog: {
    header: 'Log akcí', // 36
    empty: 'Zde se zobrazí výpis akcí po stisknutí tlačítek. Zaškrtněte checkbox u správných reakcí.', // 37
    saveLog: 'Uložit log', // 38
    saveLogTitle: 'Uloží do TXT souboru jen zápisy, které jste nepotvrdili jako správné (problematické chování)', // 39
    actionCorrect: 'Akce proběhla správně (zaškrtnuto)', // 40
    actionConfirmTitle: 'Zaškrtněte, pokud byla reakce správná', // 41
    noUnconfirmed: 'Žádné nepotvrzené zápisy – všechny akce byly označeny jako správné.', // 42
    logTitle: '=== Log nepotvrzených akcí (problematické chování) ===', // 43
    totalUnconfirmed: 'Celkem nepotvrzených:', // 44
  },
  workWeek: {
    dayNames: [
      'Neděle',   // 45
      'Pondělí',  // 46
      'Úterý',    // 47
      'Středa',   // 48
      'Čtvrtek',  // 49
      'Pátek',    // 50
      'Sobota',   // 51
    ],
    activityLabels: {
      REST: 'odpočinek', // 52
      WORK: 'práce', // 53
      AVAILABILITY: 'pohotovost', // 54
      UNKNOWN: 'neznámá činnost', // 55
      START_COUNTRY: 'výchozí země', // 56
      END_COUNTRY: 'cílová země', // 57
    },
    activityTypes: {
      řízení: 'řízení', // 58
      práce: 'práce', // 59
      pohotovost: 'pohotovost', // 60
      odpočinek: 'odpočinek', // 61
      'odpočinek>24h': 'odpoč. 24h–45h', // 62
      'odpočinek>45h': 'odpoč. ≥45h', // 63
      neznámá: 'neznámá', // 64
    },
    lastWithdrawal: 'Poslední vytažení', // 65
    manualEntries: 'Manuální záznamy', // 66
    places: 'Místa', // 67
    loadUnload: 'nakládka/vykládka', // 68
    none: 'žádné', // 69
    close: 'Zavřít', // 70
    resetLoadUnload: 'Reset nakládky/vykládky', // 71
    noData: 'Žádná data k zobrazení', // 72
    weekGraphTitle: 'Graf pracovního týdne', // 73
    prevWeek: 'Předchozí týden', // 74
    nextWeek: 'Následující týden', // 75
    card1: 'Karta 1', // 76
    card2: 'Karta 2', // 77
    manualEntryLabel: 'manuální zadání', // 78
    resetLoadUnloadTitle: 'Resetovat nakládky/vykládky', // 79
    warningsPanelTitle: 'Výstrahy v paměti tachografu',
    workShiftDuration: 'Délka pracovní směny',
    workShiftRest: 'Odpočinek',
    recordedLocationsTitle: 'Zaznamenané lokace',
    manualRecordsTitle: 'Manuální záznamy',
    tachographRecordsTitle: 'Záznamy tachografu',
    lastWithdrawalLabel: 'Poslední vyjmutí:',
    manualDataLabel: 'Manuálně zadaná data:',
    shiftMarkerLabel: '(značka směny)',
    loadUnloadSection: 'Nakládky/vykládky:',
    ferryTrainSection: 'Režim trajekt:',
    outModeSection: 'Režim OUT:',
    activation: 'aktivace',
    deactivation: 'deaktivace',
    outModeStartMark: 'out začátek',
    outModeEndMark: 'out konec',
    legendRest45h: '≥ 45h',
    legendRest24h: '24h - 44h 59m',
    shiftSumLabel: 'Součet aktivit v probíhající směně:',
    shiftSumRestPlaceholder: '----',
    shiftLengthLabel: 'Délka aktuální směny:',
    faultDrivingWithoutCard: 'Jízda bez karty',
    faultDrivingWithoutValidCard: 'Jízda bez platné karty',
    faultExcessSpeed: '(39)(39) Příliš vysoká rychlost',
    recordedLocationTypes: {
      gps_3h: 'automatická detekce každé 3h',
      start_country: 'výchozí země',
      end_country: 'cílová země',
      end_country_card: 'cílová země (vytažení karty)',
      load: 'nakládka',
      unload: 'vykládka',
      load_unload: 'nakládka/vykládka',
      border_crossing: 'průjezd hranic',
    },
  },
  controls: {
    generateWorkWeek: 'Generovat pracovní týden', // 80
    generateWorkWeekTitle: 'Vygenerovat 5–6 pracovních směn s jízdou, prací a přestávkami do paměti a na kartu Zmizík', // 81
    generateWorkWeekDisabledTitle: 'V režimu osádky nelze generovat pracovní týden',
    generateWorkWeekDisabledIgnitionTitle: 'Generovat pracovní týden lze jen v režimu standby (vypnuté zapalování)',
    openFromFile: 'Otevřít data ze souboru', // 82
    openFromFileTitle: 'Vybrat TXT soubor s daty pracovního týdne a zobrazit graf', // 83
    saveDataToFile: 'Ulož data do souboru', // 84
    saveDataToFileTitle: 'Uložit obsah karty 1 do TXT souboru', // 85
    showCardData: 'Zobraz data z karty', // 86
    showCardDataTitle: 'Zobrazit graf s daty aktuálně v simulátoru', // 87
  },
  printOverlay: {
    driver1Title: 'Výtisk řidič 1', // 88
    basicInfo: 'Základní info', // 89
    name: 'Jméno:', // 90
    cardNumber: 'Číslo karty:', // 91
    manualEntries: 'Manuální záznamy', // 92
    places: 'Místa', // 93
    none: 'žádné', // 94
    close: 'Zavřít', // 95
  },
  menu: {
    items: {
      M_PRINT_D1: { line1: 'výtisk', line2: '(14)(18) řidič 1' },
      M_PRINT_D2: { line1: 'výtisk', line2: '(14)(18) řidič 2' },
      M_PRINT_VEHICLE: { line1: 'výtisk', line2: '(24)(18) vozidlo' },
      M_INPUT_D1: { line1: 'zadání', line2: '(19) řidič 1' },
      M_INPUT_D2: { line1: 'zadání', line2: '(19) řidič 2' },
      M_INPUT_VEHICLE: { line1: 'zadání', line2: '(24)(19) vozidlo' },
      M_DISPLAY_D1: { line1: 'displej', line2: '(14)(20) řidič 1' },
      M_DISPLAY_D2: { line1: 'displej', line2: '(14)(20) řidič 2' },
      M_DISPLAY_VEHICLE: { line1: 'displej', line2: '(24)(20) vozidlo' },
      M_DISPLAY_CONTROL: { line1: 'displej', line2: 'Kontrola' },
      M_TOLL: { line1: 'menu', line2: '(32) Mýtné' },
      PD1_24H: { line2: '24h(14)(18) den-tisk' },
      PD1_EVENT: { line2: '(27)(34)(14)(18) událost' },
      PD1_ACT: { line2: '(44)(14)(18) aktivity' },
      PD2_24H: { line2: '24h(14)(18) den-tisk' },
      PD2_EVENT: { line2: '(27)(34)(14)(18) událost' },
      PD2_ACT: { line2: '(44)(14)(18) aktivity' },
      PV_24H: { line2: '24h(24)(18) den-tisk' },
      PV_EVENT: { line2: '(27)(34)(24)(18) událost' },
      PV_SPEED: { line2: '(39)(39)(18) vys.rychlost' },
      PV_TECH: { line2: '(5)(17)(18) tech. data' },
      PV_CARDS: { line2: '(6)(14)(17)(18) Karty' },
      PV_V_DIAGRAM: { line2: '(44)v(18) v-diagram' },
      PV_STATUS: { line2: '(44)D(18) status D1/D2' },
      PV_V_PROF: { line2: '%v(18) v-profil' },
      PV_N_PROF: { line2: '%n(18) n-profil' },
      ID1_START: { line2: '(37)(36) výchozí země' },
      ID1_END: { line2: '(41)(37) cílová země' },
      ID1_SETTINGS: { line2: '?(19) Nastavení' },
      ID1_BT: { line2: '(1) Bluetooth' },
      ID1_MISC: { line2: 'Různé' },
      ID2_START: { line2: '(37)(36) výchozí země' },
      ID2_END: { line2: '(41)(37) cílová země' },
      ID2_SETTINGS: { line2: '?(19) Nastavení' },
      ID2_BT: { line2: '(1) Bluetooth' },
      ID2_MISC: { line2: 'Různé' },
      IV_OUT_S: { line2: 'OUT(59) začátek' },
      IV_OUT_E: { line2: '(59)OUT konec' },
      IV_FERRY_S: { line2: '(49)(59) začátek' },
      IV_FERRY_E: { line2: '(59)(49) konec' },
      IV_LOAD_UNLOAD_ROOT: { line2: '(54) nalož./vylož.' },
      IV_LOCAL: { line2: '(37)(17) místní čas' },
      IV_OWNER: { line2: '(3)(17) čas majitel' },
      IV_LIC: { line2: '(21) Licenční kód' },
      IV_LANG: { line2: 'centr. jazyk' },
      IV_CONN: { line2: '(1)(24) In-Vehicle Připojení' },
      IV_BT_MGMT: { line2: '(1) Bluetooth Správa zařízení' },
      IV_BT_CONF: { line2: '(1) Bluetooth Konfigurace' },
      LU_BOTH: { line2: '(54) nalož./vylož.' },
      LU_LOAD: { line2: '(52) nalož' },
      LU_UNLOAD: { line2: '(53) vylož' },
      DD1_24H: { line2: '24h(14)(20) den' },
      DD1_EVENT: { line2: '(27)(34)(14)(20) událost' },
      DD2_24H: { line2: '24h(14)(20) den' },
      DD2_EVENT: { line2: '(27)(34)(14)(20) událost' },
      DV_24H: { line2: '24h(24)(20) den' },
      DV_EVENT: { line2: '(27)(34)(24)(20) událost' },
      DV_SPEED: { line2: '(39)(39)(20) vys.rychlost' },
      DV_TECH: { line2: '(5)(17)(20) tech. data' },
      DV_CARDS: { line2: '(6)(14)(17)(20) Karty' },
      DV_OWNER: { line2: '(3)(14) majitel' },
      DV_WEIGHT: { line2: '(24)(33) hmotnost' },
      DV_VER: { line2: '(47)(6) verze DTCO' },
      DC_SENSOR: { line2: '(23) Sériové číslo snímače' },
    },
    headers: {
      SUB_PRINT_D1: '(14)(18) řidič 1',
      SUB_PRINT_D2: '(14)(18) řidič 2',
      SUB_PRINT_VEHICLE: '(24)(18) vozidlo',
      SUB_INPUT_D1: '(19) řidič 1',
      SUB_INPUT_D1_SETTINGS: '?(19) Nastavení',
      SUB_INPUT_D2: '(19) řidič 2',
      SUB_INPUT_D2_SETTINGS: '?(19) Nastavení',
      SUB_INPUT_VEHICLE: '(24)(19) vozidlo',
      SUB_LOAD_UNLOAD: '(54) nalož./vylož.',
      SUB_DISPLAY_D1: '(14)(20) řidič 1',
      SUB_DISPLAY_D2: '(14)(20) řidič 2',
      SUB_DISPLAY_VEHICLE: 'vozidlo',
      SUB_DISPLAY_CONTROL: 'Kontrola',
    },
  },
  manualEntry: {
    startCountry: 'výchozí země', // 96
    endCountry: 'cílová země', // 97
    segment: '1 segment', // 98
    segments: 'segmentů', // 99
    stamp: '1 razítko', // 100
    stamps: 'razítek', // 101
    fullManualRecord: 'celý manuální záznam', // 102
    load: 'nakládka', // 103
    unload: 'vykládka', // 104
    loadUnload: 'nakládka/vykládka', // 105
  },
  actions: {
    stiskOk: 'Stisk OK', // 106
    stiskZpet: 'Stisk Zpět', // 107
    stiskNahoru: 'Stisk Nahoru', // 108
    stiskDolu: 'Stisk Dolů', // 109
    vstupDoMenu: 'vstup do menu', // 110
    navratNaProvozni: 'návrat na provozní obrazovku', // 111
    navratVMenu: 'návrat v menu', // 112
    vstupDoPodmenu: 'vstup do podmenu:', // 113
    vyberDataProTisk: 'výběr data pro tisk:', // 114
    tiskRidic1: 'tisk řidič 1:', // 115
    tiskVDiagram: 'tisk V-diagram', // 116
    tiskVozidlo: 'tisk vozidlo:', // 116b
    otevreniZadaniStart: 'otevření zadání výchozí země', // 117
    otevreniZadaniEnd: 'otevření zadání cílové země', // 118
    ulozenaZeme: 'uložena', // 119
    potvrzeniVarovani: 'potvrzení varování', // 120
    potvrzeniJizdyBezKarty: 'potvrzení varování jízdy bez karty', // 121
    potvrzeniJizdyBezPlatneKarty: 'potvrzení varování jízdy bez platné karty', // 122
    potvrzeniVarovaniZapalovani: 'potvrzení varování zapalování', // 123
    potvrzeniVarovaniPrestavky: 'potvrzení varování přestávky', // 124
    zavreniTisku: 'zavření tisku', // 125
    zruseniVarovani: 'zrušení varování', // 126
    navratVPrivodciTiskem: 'návrat v průvodci tiskem', // 127
    vysunutiKartyBezCilove: 'vysunutí karty bez zadání cílové země', // 128
    navratZeZadaniZeme: 'návrat ze zadání země', // 129
    navratZPotvrzeniNakladky: 'návrat z potvrzení nakládky/vykládky', // 130
    opusteniVdoPrehledu: 'opuštění VDO přehledu', // 131
    podrzeniTlacitka: 'Podržení tlačítka', // 132
    vysunutiKartyZeSachty: 'vysunutí karty ze slotu', // 133
    stiskTlacitkaPrepnuti: 'Stisk tlačítka - přepnutí symbolu', // 134
    vlozeniKarty: 'Vložení karty', // 135
  },
}
