/** Typ definice překladů pro i18n */

export type SupportedLanguage = 'cs' | 'en' | 'ru'

export type Translations = {
  ui: {
    language: string
    selectLanguageTitle: string
    back: string
    up: string
    down: string
    confirm: string
    close: string
    reset: string
    slotOccupied: string
    slot1DragHint: string
    slot2DragHint: string
    ignitionOffNoCard: string
    ejectBtn1Title: string
    ejectBtn2Title: string
    expandInfoboxes: string
    collapseInfoboxes: string
    infoPanelIconsLabel: string
    infoPanelLabel: string
    nr165Label: string
    printVehicle24hTitle: string
    printVDiagramTitle: string
    printSpeedVehicleTitle: string
    driver1: string
    driver2: string
    saved: string
    ferryModeStart: string
    ferryModeEnd: string
    outModeStart: string
    outModeEnd: string
    driverCardsTest: string
    speedLabel: string
    cardZmizik: string
    cardZmizikSlot1: string
    cardZmizikSlot2: string
    cardRoman: string
    cardRomanSlot1: string
    cardRomanSlot2: string
    hoursLabel: string
    minutesLabel: string
    cannotDecrementTime: string
    decrementHours: string
    decrementMinutes: string
    applyTimeTitle: string
    remoteDataDownloadActive: string
    card1EndedByTargetCountry: string
    ignitionLabel: string
    stopIgnition: string
    drivingCannotStop: string
    resetTitle: string
    simulate4h10mTitle: string
    simulate4h10mDisabledNoCardTitle: string
    generate4h10mDriving: string
    printoutTitle: string
    vDiagramTitle: string
  }
  infoPanel: {
    standbyModeInfo: string
    insertCardToSlot1: string
    drivingWithoutCard: string
    break415: string
    break430: string
    supplementActivities: string
    lastWithdrawal: string
    endCountryFound: string
    endCountryDuplicateWarning: string
    nr165Warning: string
    generateWorkWeekBlocked: string
    manualEntryData: string
    vehicleCheckBeforeDrivingWarning: string
    vehicleCheckBeforeDrivingShort: string
    readyToDrivePreDepartureCheck: string
    idleWarningConfirmInfo: string
    crewModeInfo: string
    crewModeNotMetInfo: string
    crewModeInterruptedWarning: string
    duplicateDataWarning: string
    publishDataConsentInfo: string
    card1EndedByTargetCountryInfo: string
    excessSpeedWarning: string
    /** Výstraha: nelze vytahovat kartu během jízdy (zobrazí se po pokusu o vyjmutí za jízdy) */
    ejectionBlockedWarning: string
    menuComingSoon: string
    outModeActiveInfo: string
  }
  cardWizard: {
    pleaseWait: string
    lastRemoval: string
    decision1m: string
    supplement: string
    yes: string
    no: string
    startCountry: string
    endCountry: string
    firstInsertion: string
    regionSpain: string
    idlePlease: string
    input: string
    itsQuestion: string
    vdoQuestion: string
    publish: string
    inputSaved: string
    confirmData: string
    confirm: string
    readyToDrive: string
    publishReady: string
  }
  tachoDisplay: {
    input: string
    saved: string
    endCountry: string
    startCountry: string
    printUtc: string
    printStarted: string
    cardWarning: string
    excessSpeed: string
    /** L1: text za symboly (35)(14) – „výhoz není“ */
    ejectionBlockedL1: string
    /** L2: „možný“ (výhoz není možný) */
    ejectionBlockedL2: string
  }
  actionLog: {
    header: string
    empty: string
    saveLog: string
    saveLogTitle: string
    actionCorrect: string
    actionConfirmTitle: string
    noUnconfirmed: string
    logTitle: string
    totalUnconfirmed: string
  }
  workWeek: {
    dayNames: [string, string, string, string, string, string, string]
    activityLabels: Record<string, string>
    activityTypes: Record<string, string>
    lastWithdrawal: string
    manualEntries: string
    places: string
    loadUnload: string
    none: string
    close: string
    resetLoadUnload: string
    noData: string
    weekGraphTitle: string
    prevWeek: string
    nextWeek: string
    card1: string
    card2: string
    manualEntryLabel: string
    resetLoadUnloadTitle: string
    warningsPanelTitle: string
    workShiftDuration: string
    workShiftRest: string
    recordedLocationsTitle: string
    manualRecordsTitle: string
    tachographRecordsTitle: string
    lastWithdrawalLabel: string
    manualDataLabel: string
    shiftMarkerLabel: string
    loadUnloadSection: string
    ferryTrainSection: string
    outModeSection: string
    activation: string
    deactivation: string
    legendRest45h: string
    legendRest24h: string
    shiftSumLabel: string
    shiftSumRestPlaceholder: string
    shiftLengthLabel: string
    faultDrivingWithoutCard: string
    faultDrivingWithoutValidCard: string
    faultExcessSpeed: string
    recordedLocationTypes: Record<string, string>
  }
  controls: {
    generateWorkWeek: string
    generateWorkWeekTitle: string
    generateWorkWeekDisabledTitle: string
    generateWorkWeekDisabledIgnitionTitle: string
    openFromFile: string
    openFromFileTitle: string
    saveDataToFile: string
    saveDataToFileTitle: string
    showCardData: string
    showCardDataTitle: string
  }
  printOverlay: {
    driver1Title: string
    basicInfo: string
    name: string
    cardNumber: string
    manualEntries: string
    places: string
    none: string
    close: string
  }
  manualEntry: {
    startCountry: string
    endCountry: string
    segment: string
    segments: string
    stamp: string
    stamps: string
    fullManualRecord: string
    load: string
    unload: string
    loadUnload: string
  }
  menu: {
    items: Record<string, { line1?: string; line2: string }>
    headers: Record<string, string>
  }
  actions: {
    stiskOk: string
    stiskZpet: string
    stiskNahoru: string
    stiskDolu: string
    vstupDoMenu: string
    navratNaProvozni: string
    navratVMenu: string
    vstupDoPodmenu: string
    vyberDataProTisk: string
    tiskRidic1: string
    tiskVDiagram: string
    tiskVozidlo: string
    otevreniZadaniStart: string
    otevreniZadaniEnd: string
    ulozenaZeme: string
    potvrzeniVarovani: string
    potvrzeniJizdyBezKarty: string
    potvrzeniJizdyBezPlatneKarty: string
    potvrzeniVarovaniZapalovani: string
    potvrzeniVarovaniPrestavky: string
    zavreniTisku: string
    zruseniVarovani: string
    navratVPrivodciTiskem: string
    vysunutiKartyBezCilove: string
    navratZeZadaniZeme: string
    navratZPotvrzeniNakladky: string
    opusteniVdoPrehledu: string
    podrzeniTlacitka: string
    vysunutiKartyZeSachty: string
    stiskTlacitkaPrepnuti: string
    vlozeniKarty: string
  }
}
