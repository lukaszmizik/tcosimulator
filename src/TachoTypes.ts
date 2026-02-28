/**
 * Sdílené typy pro simulátor tachografu VDO DTCO 4.1
 */

export type ActivityId = 'REST' | 'WORK' | 'AVAILABILITY' | 'UNKNOWN' | 'DRIVING'

export type ActivityKind = 'driving' | 'rest' | 'otherWork' | 'availability' | 'none'

export type ActivityDurationsMs = {
  driving: number
  rest: number
  otherWork: number
  availability: number
}

export type TachoEvent = {
  id: number
  timestamp: number
  type: 'DRIVING_WITHOUT_CARD'
  acknowledged: boolean
}

export type SecondActivitySnapshot = {
  timestampUtc: number
  driver1: ActivityKind
  driver2: ActivityKind
  speed: number
}

/** Konstanta pro záznam ve VU, když v daném slotu není vložena karta */
export const NO_CARD = 'NO_CARD' as const

export type ActivityHistoryEntry = {
  minuteStartUtc: number
  driver1: ActivityKind
  driver2: ActivityKind
  gpsLocation?: string
  /** ID karty ve slotu 1 (templateId) nebo NO_CARD */
  driver1CardId?: string | typeof NO_CARD
  /** ID karty ve slotu 2 (templateId) nebo NO_CARD */
  driver2CardId?: string | typeof NO_CARD
}

export type FaultOrEvent = {
  id: number
  timestampUtc: number
  type: 'DRIVING_WITHOUT_CARD_WARNING' | 'DRIVING_WITHOUT_VALID_CARD_WARNING' | 'EXCESS_SPEED_WARNING'
  /** Událost během nedokončeného manuálního zadávání (přerušení rozjezdem). */
  duringIncompleteManualEntry?: boolean
}

export type EventLogEntry = {
  id: number
  type: 'DRIVING_WITHOUT_CARD' | 'DRIVING_WITHOUT_VALID_CARD'
  startTime: number
  endTime?: number
  /** Událost během nedokončeného manuálního zadávání (přerušení rozjezdem). */
  duringIncompleteManualEntry?: boolean
}

export type TachoState = {
  targetSpeed: number
  currentSpeed: number
  odometerKm: number
  ignitionOn: boolean
  card1Inserted: boolean
  card2Inserted: boolean
  isMultiManning: boolean
  leftActivityId: ActivityId
  rightActivityId: ActivityId
  companyCardInserted: boolean
  controlCardInserted: boolean
  optionalFeatureEnabled: boolean
  vdoLinkConnected: boolean
  /** Režim trajekt – symbol (49) na L1 vlevo od počítadla km */
  ferryTrainModeActive: boolean
  /** Režim OUT – aktivní po zadání vozidlo–OUT začátek, končí zadáním OUT konec nebo vytažením karty */
  outModeActive: boolean
}

export type ManualActivityType = 'driving' | 'rest' | 'otherWork' | 'availability'

export type ManualActivityEntry = {
  type: ManualActivityType
  minutes: number
}

export type CardData = {
  name: string
  /** Příjmení – pro zobrazení pouze příjmení ve fázích načítání průvodce (welcome, loading). */
  surname?: string
  lastWithdrawal: number | null
  templateId?: 'zmizik' | 'novak'
  /** Po prvním úspěšném vložení se změní na false. */
  isFirstInsertion?: boolean
  /** Souhlas s publikací ITS dat (z průvodce vložením). */
  itsConsent?: boolean
  /** Souhlas s publikací VDO dat (z průvodce vložením). */
  vdoConsent?: boolean
}

export type EditorActivityId = 'REST' | 'WORK' | 'AVAILABILITY' | 'UNKNOWN' | 'START_COUNTRY' | 'END_COUNTRY'

export type CardInsertionPhase =
  | 'welcome'
  | 'loading'
  | 'lastRemoval'
  | 'decision1M'
  | 'manualEditor'
  | 'country'
  | 'finalConfirm'
  | 'itsQuestion'
  | 'vdoQuestion'
  | 'itsVdoConfirmSaved'
  | 'idleWarning'
  | 'readyToDrive'
  | 'finalizeStep1'
  | 'finalizeStep2'
  | 'finalizeStep3'
  | 'finalizeStep4'

export type ManualEntrySegment = {
  activityId: EditorActivityId
  day: number
  month: number
  year: number
  hour: number
  minute: number
  countryCode?: string
  /** Pravda, pokud byl segment doplněn manuálně pomocí průvodce. */
  isManualEntry?: boolean
}

export type CardInsertionState = {
  slot: 1 | 2
  phase: CardInsertionPhase
  phaseStartTime: number
  cardInsertionTime: number
  insertionTimeFixed?: number
  loadingProgress: number
  showPleaseWait: boolean
  decisionSupplement: boolean
  editorBlinkField: 'activity' | 'day' | 'month' | 'year' | 'hour' | 'minute'
  segmentStart: { day: number; month: number; year: number; hour: number; minute: number }
  currentSegment: ManualEntrySegment
  manualEntryBuffer: ManualEntrySegment[]
  countryIndex: number
  selectingSpanishRegion: boolean
  spanishRegionIndex: number
  finalConfirmYes: boolean
  finalConfirmSkippedEditor: boolean
  /** Zobrazit ITS/VDO dotazy (pokud isFirstInsertion karty). */
  showItsVdoQuestions: boolean
  itsYes: boolean
  vdoYes: boolean
  cardName: string
  /** Příjmení – ve fázích načítání (welcome, loading) se zobrazuje pouze toto. */
  cardSurname?: string
  lastWithdrawal: number | null
  firstInsertion: boolean
  selectingCountryForStamp: boolean
  stampActivityId: 'START_COUNTRY' | 'END_COUNTRY' | null
  /** L2 při přechodu na cílovou zemi / L1 při výchozí zemi – pro správné nastavení po potvrzení */
  stampL2Segment?: { day: number; month: number; year: number; hour: number; minute: number }
  stampL1Segment?: { day: number; month: number; year: number; hour: number; minute: number }
  /** Při návratu z idleWarning se vrátíme na tuto fázi. */
  idleWarningReturnPhase?: CardInsertionPhase
  /** Přeskočit hlášku "připraven k jízdě" (vložení započato při probuzení ze Standby). */
  skipReadyToDriveScreen?: boolean
  /** Uživatel odpověděl "ne" na doplnit data – po načtení karty zobrazit "připraven k jízdě". */
  supplementDeclined?: boolean
  /** Čas skočen na max, kurzor na aktivitě – další OK dokončí blok. */
  awaitingMaxTimeConfirm?: boolean
  /** Při awaitingMaxTimeConfirm: segment na insertion time – použije se při OK. */
  pendingMaxTimeSegment?: { day: number; month: number; year: number; hour: number; minute: number }
}

export type LoadUnloadEventType = 'load' | 'unload' | 'both'
export type VehicleLoadUnloadEvent = {
  minuteStartUtc: number
  gpsLocation?: string
  type: LoadUnloadEventType
}

export type FerryTrainEventType = 'activation' | 'deactivation'
export type FerryTrainEvent = {
  minuteStartUtc: number
  gpsLocation?: string
  type: FerryTrainEventType
}

export type OutModeEventType = 'activation' | 'deactivation'
export type OutModeEvent = {
  minuteStartUtc: number
  gpsLocation?: string
  type: OutModeEventType
}

/** Typ záznamu v tabulce Zaznamenané lokace */
export type RecordedGpsRecordType =
  | 'gps_3h'
  | 'start_country'
  | 'end_country'
  | 'end_country_card'
  | 'load'
  | 'unload'
  | 'load_unload'
  | 'border_crossing'

/** GPS pozice zaznamenaná v tabulce Zaznamenané lokace */
export type RecordedGpsLocation = {
  minuteStartUtc: number
  gpsLocation: string
  /** K čemu se záznam vztahuje – pro zobrazení v tabulce */
  recordType?: RecordedGpsRecordType
}

export type MenuLoadUnloadConfirmState = {
  phaseStartTime: number
  returnMenuPath: string[]
}

export type MenuCountryInputType = 'start' | 'end'
export type MenuCountryInputPhase = 'selecting' | 'confirmSaved'

export type MenuCountryInputState = {
  type: MenuCountryInputType
  phase: MenuCountryInputPhase
  phaseStartTime: number
  countryIndex: number
  returnMenuPath: string[]
}

/** Univerzální průvodce výtiskem: výběr data + dotaz UTC (requiresDate, requiresUtcConfirm). */
export type PrintWizardState = {
  action: string
  step: 'date' | 'utc'
  menuItemLine2: string
  dateIndex: number
  availableDatesUtc: number[]
  utcYes: boolean
  returnMenuPath: string[]
  requiresUtcConfirm: boolean
}

export type CardWithdrawalPhase = 'bargraf' | 'countrySelect' | 'print24hQuestion' | 'done'

export type CardWithdrawalState = {
  slot: 1 | 2
  phase: CardWithdrawalPhase
  phaseStartTime: number
  cardName: string
  /** Příjmení – při vytažení karty se zobrazuje pouze příjmení. */
  cardSurname?: string
  countryIndex: number
  cardData: CardData
  /** Ve fázi print24hQuestion: true = ano, false = ne (výchozí). */
  print24hYes?: boolean
}

export type VirtualRoutePointType = 'city' | 'border_crossing' | 'rest_area'

export type VirtualRoutePoint = {
  name: string
  kmFromStart: number
  country: string
  /** Přibližné souřadnice (pro budoucí mapy nebo export) */
  coordinates?: { lat: number; lng: number }
  /** Typ místa – město, hranice, odpočinková zóna */
  type?: VirtualRoutePointType
  /** Region (např. pro Španělsko: Catalunya) */
  region?: string
}

export type SymbolMap = Record<number, string>

/** Pouze 3 aktivity pro cyklický výběr tlačítkem (Odpočinek → Práce → Pohotovost). */
export const MANUAL_ACTIVITIES: Array<{ id: 'REST' | 'WORK' | 'AVAILABILITY'; code: string; label: string }> = [
  { id: 'REST', code: '\u0059', label: 'odpočinek' },
  { id: 'WORK', code: '\u005a', label: 'jiná práce' },
  { id: 'AVAILABILITY', code: '\u0058', label: 'pohotovost' },
]

export const UNKNOWN_ACTIVITY_SYMBOL = '\u005c'

/** Pro sekvenci vložení karty (1M): Cílová země, Výchozí země, Neznámá činnost, Pohotovost, Práce, Odpočinek. */
export const ACTIVITY_SYMBOLS: Array<{ id: EditorActivityId; code: string; label: string }> = [
  { id: 'END_COUNTRY', code: '\u007A', label: 'Cílová země' },
  { id: 'START_COUNTRY', code: '\u0075', label: 'Výchozí země' },
  { id: 'UNKNOWN', code: '?', label: 'neznámá činnost' },
  ...MANUAL_ACTIVITIES.map((a) => ({ id: a.id, code: a.code, label: a.label })).reverse(),
]

export const SPECIAL_SYMBOLS = {
  START_COUNTRY: '\u0075',
  END_COUNTRY: '\u007A',
  CARD_SYMBOL: '\u005F',
  UTC_SYMBOL: '\u0076',
  LOCAL_TIME_SYMBOL: '\u0074',
} as const

export const MAX_MANUAL_ACTIVITIES = 6

/** Karta Lukas Zmizik – lastWithdrawal se načítá z úložiště karty, při prvním vložení null. */
export const TEST_CARD_ZMIZIK: CardData = {
  name: 'Lukas Zmizik',
  surname: 'Zmizik',
  lastWithdrawal: null,
}

/** Karta Roman Milewski – lastWithdrawal se načítá z úložiště karty, při prvním vložení null. */
export const TEST_CARD_NOVAK: CardData = {
  name: 'Roman Milewski',
  surname: 'Milewski',
  lastWithdrawal: null,
}

export const TEST_CARDS = { zmizik: TEST_CARD_ZMIZIK, novak: TEST_CARD_NOVAK } as const
