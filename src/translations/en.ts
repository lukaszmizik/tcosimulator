import type { Translations } from './types'

export const en: Translations = {
  ui: {
    language: 'Language',
    selectLanguageTitle: 'Select interface language',
    back: 'Back',
    up: 'Up',
    down: 'Down',
    confirm: 'Confirm',
    close: 'Close',
    reset: 'Reset',
    slotOccupied: 'Slot occupied',
    slot1DragHint: 'Slot 1 – drag card 1 here',
    slot2DragHint: 'Slot 2 – drag card 2 here',
    ignitionOffNoCard: 'Ignition off – card insertion not possible',
    ejectBtn1Title: 'Short press: toggle left symbol. Hold 2 s: eject card 1',
    ejectBtn2Title: 'Short press: toggle right symbol. Hold 2 s: eject card 2',
    expandInfoboxes: 'Expand infoboxes',
    collapseInfoboxes: 'Collapse infoboxes',
    infoPanelIconsLabel: 'Information and warning icons',
    infoPanelLabel: 'Information and warnings',
    nr165Label: 'NR 165 warning',
    printVehicle24hTitle: 'Print vehicle 24h day',
    printVDiagramTitle: 'Print V-diagram',
    printSpeedVehicleTitle: 'Print vehicle – excess speed',
    driver1: 'Driver 1',
    driver2: 'Driver 2',
    saved: 'saved',
    ferryModeStart: 'ferry mode start',
    ferryModeEnd: 'ferry mode end',
    outModeStart: 'out start',
    outModeEnd: 'out end',
    driverCardsTest: 'Driver cards (test)',
    speedLabel: 'Speed',
    cardZmizik: 'Card Zmizik',
    cardZmizikSlot1: 'Card Zmizik (slot 1)',
    cardZmizikSlot2: 'Card Zmizik (slot 2)',
    cardRoman: 'Card Roman',
    cardRomanSlot1: 'Card Roman (slot 1)',
    cardRomanSlot2: 'Card Roman (slot 2)',
    hoursLabel: 'Hours',
    minutesLabel: 'Minutes',
    cannotDecrementTime: 'Time cannot be less than simulated time',
    decrementHours: 'Decrement hours',
    decrementMinutes: 'Decrement minutes',
    applyTimeTitle: 'Apply set time to tachograph display',
    remoteDataDownloadActive: 'Remote data download active',
    card1EndedByTargetCountry: 'Card 1 ended by target country',
    ignitionLabel: 'Ignition',
    stopIgnition: 'Stop ignition',
    drivingCannotStop: 'Cannot turn off vehicle while driving',
    resetTitle: 'Reset activity times, eject cards, set time to current and turn off device (STOP)',
    simulate4h10mTitle: 'Record 4h10m driving with short stops (to memory) and advance time',
    simulate4h10mDisabledNoCardTitle: 'Requires a driver card to be inserted',
    generate4h10mDriving: 'Generate 4h10m driving',
    printoutTitle: 'Tachograph printout',
    vDiagramTitle: 'V-diagram speed',
  },
  infoPanel: {
    standbyModeInfo: 'Device is in Stand-by mode. Turn on ignition with the Start button.\nEverything is under development, please report any bugs to lukas@zmizik.com',
    insertCardToSlot1: 'To start driving, insert any card into slot no. 1 by dragging.', // 1
    drivingWithoutCard: 'Driving without card – insert driver card into slot 1. This warning is recorded in the tachograph memory.', // 2
    break415: 'Warning 4:15 – take a 15 or 30 minute break (if you already had 15m).', // 3
    break430: 'Warning 4:30 – You have exceeded the driving time! Take a 45 minute break immediately. This event is recorded in memory as (27)(38) Safety violation.', // 4
    supplementActivities: 'You must now supplement activities on your card.', // 5
    lastWithdrawal: 'Last card withdrawal was', // 6
    endCountryFound: 'I found a shift end record at', // 7
    endCountryDuplicateWarning: 'Earlier shift end found at {dateTime}. This step will cause your record to show an error.',
    nr165Warning: 'You are about to enter start country twice in a row. This would be an offence under NR 165...', // 8
    generateWorkWeekBlocked: 'There is saved data on the card. Therefore random data was not generated. Delete the data from the card using the \'Reset\' button and try again.',
    manualEntryData: 'Inserted data:',
    vehicleCheckBeforeDrivingWarning: 'Before driving it was necessary to carry out a vehicle check, which is reported with symbol (9). You are now driving but not acting in accordance with Regulation (EU) No 165/2014',
    vehicleCheckBeforeDrivingShort: 'Before driving it was necessary to carry out a vehicle check, which is reported with symbol (9). Your pre-drive check was shorter than 4 minutes. This may be disputed by some control authorities and they may treat it as an aggravating circumstance.',
    idleWarningConfirmInfo: 'The device is waiting for confirmation of your selection. If you do not perform any action within 10 minutes, the card will be automatically ejected and the entered data will not be saved.',
    readyToDrivePreDepartureCheck: 'The tachograph signals that you can depart, but you know that before departure you have the obligation to perform a pre-departure check which is reported as work activity (9).',
    crewModeInfo: 'The conditions for crew mode have just been met. Your floating day is 30 hours during which your regular daily rest period will be 9 hours. You cannot spend your daily rest period in a moving vehicle! Remember that if driver 1 starts driving without a card inserted in slot 2, crew mode will be interrupted. Both drivers must end their shift at the same time!',
    crewModeNotMetInfo: 'The presence of the second card was recorded, but the conditions for crew mode were not met. Each of your floating days is 24 hours. You must complete your daily rest periods within this time.',
    crewModeInterruptedWarning: 'As driver no. 1 started driving without driver no. 2, crew mode was interrupted and your recorded activities exceed the parameters for a single driver\'s shift length. This is a safety violation!',
    duplicateDataWarning: 'Warning: The card already contains saved data. Cannot write data to occupied memory. Clear the data using the Reset button',
    publishDataConsentInfo: 'When using the card for the first time, you will be prompted to give consent for the processing of personal data, including special categories of personal data. You can withdraw your consent at any time through the device menu.',
    card1EndedByTargetCountryInfo: 'I saved to the card at {dateTime} (41)(37) the end country. The original record in the simulator had no completed shift. You can change this option at any time. It is for educational purposes.',
    ejectionBlockedWarning: 'This is an error! You cannot eject the card while driving!',
    excessSpeedWarning: 'Excess speed (39)(39) has been recorded. The vehicle\'s design speed was exceeded. This event is automatically recorded in the tachograph memory!',
    menuComingSoon: 'This menu item is not yet active. Coming soon:)',
    outModeActiveInfo: 'OUT mode has been activated. Driving time (2) is recorded as other work (9) in this mode. Familiarize yourself with the conditions under which this mode can be used.',
  },
  cardWizard: {
    pleaseWait: 'please wait!', // 9
    lastRemoval: 'Last removal', // 10
    decision1m: '{slot}(42)\u00A0entry', // 11 – {slot} = slot number (1/2), (19) = symbol M
    supplement: 'supplement?', // 12
    yes: 'yes', // 13
    no: 'no', // 14
    startCountry: 'start country', // 15
    endCountry: 'end country', // 16
    firstInsertion: 'First insertion', // 17
    regionSpain: 'Spain region', // 18
    idlePlease: 'please', // 19
    input: 'input', // 20
    itsQuestion: 'ITS data?', // 21
    vdoQuestion: 'VDO data?', // 22
    publish: 'Publish', // 23
    inputSaved: 'saved', // 24
    confirmData: 'inserted data', // 25
    confirm: 'confirm?', // 26
    readyToDrive: 'to drive', // 27
    publishReady: 'ready', // 28
  },
  tachoDisplay: {
    input: 'input', // 29
    saved: 'saved', // 30
    endCountry: 'end country', // 31
    startCountry: 'start country', // 32
    printUtc: 'UTC time?', // 33
    printStarted: 'started...', // 34
    cardWarning: '\u00A0card!', // 35 (non-breaking space before text)
    excessSpeed: 'excess speed',
    ejectionBlockedL1: 'ejection not',
    ejectionBlockedL2: 'possible',
  },
  actionLog: {
    header: 'Action log', // 36
    empty: 'Actions will appear here when you press buttons. Check the box for correct responses.', // 37
    saveLog: 'Save log', // 38
    saveLogTitle: 'Saves to TXT file only entries you did not confirm as correct (problematic behaviour)', // 39
    actionCorrect: 'Action was correct (checked)', // 40
    actionConfirmTitle: 'Check if the response was correct', // 41
    noUnconfirmed: 'No unconfirmed entries – all actions were marked as correct.', // 42
    logTitle: '=== Unconfirmed actions log (problematic behaviour) ===', // 43
    totalUnconfirmed: 'Total unconfirmed:', // 44
  },
  workWeek: {
    dayNames: [
      'Sunday',    // 45
      'Monday',    // 46
      'Tuesday',   // 47
      'Wednesday', // 48
      'Thursday',  // 49
      'Friday',    // 50
      'Saturday',  // 51
    ],
    activityLabels: {
      REST: 'rest', // 52
      WORK: 'work', // 53
      AVAILABILITY: 'availability', // 54
      UNKNOWN: 'unknown activity', // 55
      START_COUNTRY: 'start country', // 56
      END_COUNTRY: 'end country', // 57
    },
    activityTypes: {
      řízení: 'driving', // 58
      práce: 'work', // 59
      pohotovost: 'availability', // 60
      odpočinek: 'rest', // 61
      'odpočinek>24h': 'rest 24h–45h', // 62
      'odpočinek>45h': 'rest ≥45h', // 63
      neznámá: 'unknown', // 64
    },
    lastWithdrawal: 'Last withdrawal', // 65
    manualEntries: 'Manual entries', // 66
    places: 'Places', // 67
    loadUnload: 'load/unload', // 68
    none: 'none', // 69
    close: 'Close', // 70
    resetLoadUnload: 'Reset load/unload', // 71
    noData: 'No data to display', // 72
    weekGraphTitle: 'Work week graph', // 73
    prevWeek: 'Previous week', // 74
    nextWeek: 'Next week', // 75
    card1: 'Card 1', // 76
    card2: 'Card 2', // 77
    manualEntryLabel: 'manual entry', // 78
    resetLoadUnloadTitle: 'Reset load/unload', // 79
    warningsPanelTitle: 'Warnings in tachograph memory',
    workShiftDuration: 'Work shift duration',
    workShiftRest: 'Rest',
    recordedLocationsTitle: 'Recorded locations',
    manualRecordsTitle: 'Manual entries',
    tachographRecordsTitle: 'Tachograph records',
    lastWithdrawalLabel: 'Last withdrawal:',
    manualDataLabel: 'Manually entered data:',
    shiftMarkerLabel: '(shift marker)',
    loadUnloadSection: 'Load/unload:',
    ferryTrainSection: 'Ferry/train mode:',
    outModeSection: 'OUT mode:',
    activation: 'activation',
    deactivation: 'deactivation',
    outModeStartMark: 'out start',
    outModeEndMark: 'out end',
    legendRest45h: '≥ 45h',
    legendRest24h: '24h - 44h 59m',
    shiftSumLabel: 'Sum of activities in current shift:',
    shiftSumRestPlaceholder: '----',
    shiftLengthLabel: 'Length of current shift:',
    faultDrivingWithoutCard: 'Driving without card',
    faultDrivingWithoutValidCard: 'Driving without valid card',
    faultExcessSpeed: '(39)(39) Excess speed',
    recordedLocationTypes: {
      gps_3h: 'automatic detection every 3h',
      start_country: 'start country',
      end_country: 'end country',
      end_country_card: 'end country (card withdrawal)',
      load: 'loading',
      unload: 'unloading',
      load_unload: 'loading/unloading',
      border_crossing: 'border crossing',
    },
  },
  controls: {
    generateWorkWeek: 'Generate work week', // 80
    generateWorkWeekTitle: 'Generate 5–6 work shifts with driving, work and breaks into memory and Zmizik card', // 81
    generateWorkWeekDisabledTitle: 'Cannot generate work week in crew mode',
    generateWorkWeekDisabledIgnitionTitle: 'Generate work week is only available in standby mode (ignition off)',
    openFromFile: 'Open data from file', // 82
    openFromFileTitle: 'Select TXT file with work week data and display graph', // 83
    saveDataToFile: 'Save data to file', // 84
    saveDataToFileTitle: 'Save card 1 contents to TXT file', // 85
    showCardData: 'Show card data', // 86
    showCardDataTitle: 'Display graph with current simulator data', // 87
  },
  printOverlay: {
    driver1Title: 'Printout driver 1', // 88
    basicInfo: 'Basic info', // 89
    name: 'Name:', // 90
    cardNumber: 'Card number:', // 91
    manualEntries: 'Manual entries', // 92
    places: 'Places', // 93
    none: 'none', // 94
    close: 'Close', // 95
  },
  menu: {
    items: {
      M_PRINT_D1: { line1: 'print', line2: '(14)(18) driver 1' },
      M_PRINT_D2: { line1: 'print', line2: '(14)(18) driver 2' },
      M_PRINT_VEHICLE: { line1: 'print', line2: '(24)(18) vehicle' },
      M_INPUT_D1: { line1: 'input', line2: '(19) driver 1' },
      M_INPUT_D2: { line1: 'input', line2: '(19) driver 2' },
      M_INPUT_VEHICLE: { line1: 'input', line2: '(24)(19) vehicle' },
      M_DISPLAY_D1: { line1: 'display', line2: '(14)(20) driver 1' },
      M_DISPLAY_D2: { line1: 'display', line2: '(14)(20) driver 2' },
      M_DISPLAY_VEHICLE: { line1: 'display', line2: '(24)(20) vehicle' },
      M_DISPLAY_CONTROL: { line1: 'display', line2: 'Control' },
      M_TOLL: { line1: 'menu', line2: '(32) Toll' },
      PD1_24H: { line2: '24h(14)(18) day-print' },
      PD1_EVENT: { line2: '(27)(34)(14)(18) event' },
      PD1_ACT: { line2: '(44)(14)(18) activities' },
      PD2_24H: { line2: '24h(14)(18) day-print' },
      PD2_EVENT: { line2: '(27)(34)(14)(18) event' },
      PD2_ACT: { line2: '(44)(14)(18) activities' },
      PV_24H: { line2: '24h(24)(18) day-print' },
      PV_EVENT: { line2: '(27)(34)(24)(18) event' },
      PV_SPEED: { line2: '(39)(39)(18) excess speed' },
      PV_TECH: { line2: '(5)(17)(18) tech. data' },
      PV_CARDS: { line2: '(6)(14)(17)(18) Cards' },
      PV_V_DIAGRAM: { line2: '(44)v(18) v-diagram' },
      PV_STATUS: { line2: '(44)D(18) status D1/D2' },
      PV_V_PROF: { line2: '%v(18) v-profile' },
      PV_N_PROF: { line2: '%n(18) n-profile' },
      ID1_START: { line2: '(37)(36) start country' },
      ID1_END: { line2: '(41)(37) end country' },
      ID1_SETTINGS: { line2: '?(19) Settings' },
      ID1_BT: { line2: '(1) Bluetooth' },
      ID1_MISC: { line2: 'Miscellaneous' },
      ID2_START: { line2: '(37)(36) start country' },
      ID2_END: { line2: '(41)(37) end country' },
      ID2_SETTINGS: { line2: '?(19) Settings' },
      ID2_BT: { line2: '(1) Bluetooth' },
      ID2_MISC: { line2: 'Miscellaneous' },
      IV_OUT_S: { line2: 'OUT(59) start' },
      IV_OUT_E: { line2: '(59)OUT end' },
      IV_FERRY_S: { line2: '(49)(59) start' },
      IV_FERRY_E: { line2: '(59)(49) end' },
      IV_LOAD_UNLOAD_ROOT: { line2: '(54) load/unload' },
      IV_LOCAL: { line2: '(37)(17) local time' },
      IV_OWNER: { line2: '(3)(17) owner time' },
      IV_LIC: { line2: '(21) License code' },
      IV_LANG: { line2: 'central language' },
      IV_CONN: { line2: '(1)(24) In-Vehicle Connection' },
      IV_BT_MGMT: { line2: '(1) Bluetooth Device management' },
      IV_BT_CONF: { line2: '(1) Bluetooth Configuration' },
      LU_BOTH: { line2: '(54) load/unload' },
      LU_LOAD: { line2: '(52) load' },
      LU_UNLOAD: { line2: '(53) unload' },
      DD1_24H: { line2: '24h(14)(20) day' },
      DD1_EVENT: { line2: '(27)(34)(14)(20) event' },
      DD2_24H: { line2: '24h(14)(20) day' },
      DD2_EVENT: { line2: '(27)(34)(14)(20) event' },
      DV_24H: { line2: '24h(24)(20) day' },
      DV_EVENT: { line2: '(27)(34)(24)(20) event' },
      DV_SPEED: { line2: '(39)(39)(20) excess speed' },
      DV_TECH: { line2: '(5)(17)(20) tech. data' },
      DV_CARDS: { line2: '(6)(14)(17)(20) Cards' },
      DV_OWNER: { line2: '(3)(14) owner' },
      DV_WEIGHT: { line2: '(24)(33) weight' },
      DV_VER: { line2: '(47)(6) DTCO version' },
      DC_SENSOR: { line2: '(23) Sensor serial number' },
    },
    headers: {
      SUB_PRINT_D1: '(14)(18) driver 1',
      SUB_PRINT_D2: '(14)(18) driver 2',
      SUB_PRINT_VEHICLE: '(24)(18) vehicle',
      SUB_INPUT_D1: '(19) driver 1',
      SUB_INPUT_D1_SETTINGS: '?(19) Settings',
      SUB_INPUT_D2: '(19) driver 2',
      SUB_INPUT_D2_SETTINGS: '?(19) Settings',
      SUB_INPUT_VEHICLE: '(24)(19) vehicle',
      SUB_LOAD_UNLOAD: '(54) load/unload',
      SUB_DISPLAY_D1: '(14)(20) driver 1',
      SUB_DISPLAY_D2: '(14)(20) driver 2',
      SUB_DISPLAY_VEHICLE: 'vehicle',
      SUB_DISPLAY_CONTROL: 'Control',
    },
  },
  manualEntry: {
    startCountry: 'start country', // 96
    endCountry: 'end country', // 97
    segment: '1 segment', // 98
    segments: 'segments', // 99
    stamp: '1 stamp', // 100
    stamps: 'stamps', // 101
    fullManualRecord: 'full manual record', // 102
    load: 'load', // 103
    unload: 'unload', // 104
    loadUnload: 'load/unload', // 105
  },
  actions: {
    stiskOk: 'Press OK', // 106
    stiskZpet: 'Press Back', // 107
    stiskNahoru: 'Press Up', // 108
    stiskDolu: 'Press Down', // 109
    vstupDoMenu: 'enter menu', // 110
    navratNaProvozni: 'return to operating screen', // 111
    navratVMenu: 'return in menu', // 112
    vstupDoPodmenu: 'enter submenu:', // 113
    vyberDataProTisk: 'select date for print:', // 114
    tiskRidic1: 'print driver 1:', // 115
    tiskVDiagram: 'print V-diagram', // 116
    tiskVozidlo: 'print vehicle:', // 116b
    otevreniZadaniStart: 'open start country entry', // 117
    otevreniZadaniEnd: 'open end country entry', // 118
    ulozenaZeme: 'saved', // 119
    potvrzeniVarovani: 'warning confirmation', // 120
    potvrzeniJizdyBezKarty: 'driving without card warning confirmation', // 121
    potvrzeniJizdyBezPlatneKarty: 'driving without valid card warning confirmation', // 122
    potvrzeniVarovaniZapalovani: 'ignition warning confirmation', // 123
    potvrzeniVarovaniPrestavky: 'break warning confirmation', // 124
    zavreniTisku: 'close print', // 125
    zruseniVarovani: 'cancel warning', // 126
    navratVPrivodciTiskem: 'return in print wizard', // 127
    vysunutiKartyBezCilove: 'card ejection without end country', // 128
    navratZeZadaniZeme: 'return from country entry', // 129
    navratZPotvrzeniNakladky: 'return from load/unload confirmation', // 130
    opusteniVdoPrehledu: 'leave VDO overview', // 131
    podrzeniTlacitka: 'Button hold', // 132
    vysunutiKartyZeSachty: 'card ejection from slot', // 133
    stiskTlacitkaPrepnuti: 'Button press - symbol toggle', // 134
    vlozeniKarty: 'Card insertion', // 135
  },
}
