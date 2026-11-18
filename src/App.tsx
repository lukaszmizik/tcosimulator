import { advanceOverspeed, qualifiesAsOverspeed, type OverspeedRun } from './overspeed'
import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { loadCountries, type CountryEntry } from './data/countriesLoader'
import { buildSymbolMapFromFile } from './Symbols'
import { buildMenusById, applyMenuTranslations, ENTRY_MENU_ID } from './MenuStructure'
import { clampMenuIndex, enterMenuRoot, enterSubmenu, leaveSubmenu, stepMenuIndex, visibleMenuItems } from './menu/menuCursor'
import { createInitialCardInsertionState, activityFromChar, getNextActivity, getActivityCode, utcMsToSegment } from './CardLogic'
import { EDITOR_FIELD_ORDER } from './CardLogic'
import { getVirtualLocationForDistance } from './VirtualRoute'
import { FaceplateFrame } from './FaceplateFrame'
import { LcdDebugGrid } from './LcdDebugGrid'
import { TachoDisplay } from './TachoDisplay'
import type { SymbolMap } from './TachoTypes'
import type {
  ActivityId,
  ActivityDurationsMs,
  ActivityHistoryEntry,
  SecondActivitySnapshot,
  FaultOrEvent,
  EventLogEntry,
  ManualActivityEntry,
  ManualEntrySegment,
  CardInsertionState,
  CardWithdrawalState,
  CardData,
  VirtualRoutePoint,
  PrintWizardState,
  VehicleLoadUnloadEvent,
  FerryTrainEvent,
  OutModeEvent,
  RecordedGpsLocation,
} from './TachoTypes'
import {
  INITIAL_ACTIVITY_DURATIONS,
  CARD_EJECT_HOLD_MS,
  FALLBACK_COUNTRY_LIST,
  ODOMETER_KM,
  SPEED_STOPPED_THRESHOLD_KMH,
  DRIVING_LIMIT_415_MS,
  DRIVING_LIMIT_430_MS,
  REST_RESET_MS,
  MULTI_MANNING_ONE_HOUR_MS,
} from './Constants'
import {
  type ActivityKind,
  type TachoState,
  MAX_MANUAL_ACTIVITIES,
  ACTIVITY_SYMBOLS,
  TEST_CARDS,
  NO_CARD,
} from './TachoTypes'
import { DRIVING_SYMBOL, segmentToMsUtc } from './CardLogic'
import { activitiesForApplyTime, clockAfterApplyTime, insertedCardId, planApplyTimeJump } from './applyTimeJump'
import { useCardWizard2 } from './CardWizard2'
import { useActionLog } from './ActionLogContext'
import * as WorkShift from './WorkShift'
import {
  loadCard1ActivityHistory,
  saveCard1ActivityHistory,
  loadCard1LastWithdrawal,
  saveCard1LastWithdrawal,
  clearCard1LastWithdrawal,
  loadCard1ManualEntryBuffer,
  saveCard1ManualEntryBuffer,
  CARD1_TEMPLATE_ID,
} from './data/card1_write_data'
import {
  saveCard2ActivityHistory,
  loadCard2LastWithdrawal,
  saveCard2LastWithdrawal,
  clearCard2LastWithdrawal,
  loadCard2ManualEntryBuffer,
  saveCard2ManualEntryBuffer,
  CARD2_TEMPLATE_ID,
} from './data/card2_write_data'
import {
  loadTachographActivityHistory,
  saveTachographActivityHistory,
  loadTachographFaultsAndEvents,
  saveTachographFaultsAndEvents,
  loadTachographEventLog,
  saveTachographEventLog,
  loadTachographVehicleLoadUnloadEvents,
  saveTachographVehicleLoadUnloadEvents,
  loadTachographFerryTrainEvents,
  saveTachographFerryTrainEvents,
  loadTachographOutModeEvents,
  saveTachographOutModeEvents,
  loadTachographRecordedGpsLocations,
  saveTachographRecordedGpsLocations,
  loadTachographCardActivityHistoryByTemplateId,
} from './data/tachograph_write_data'
import { generateRandomWorkWeek } from './MockDataGenerator'
import { exportWorkWeekToTxt, workWeekToTxtString, simulatorToGraphData } from './workWeekExportTxt'
import { parseWorkWeekTxt, activitiesByDay, expandToWeeksContainingData, type DayData, type CountryMarker } from './workWeekTxtParser'
import { WorkWeekGraphView } from './WorkWeekGraphView'
import { InsertedCardsHistory } from './InsertedCardsHistory'
import { InfoPanel, useInfoPanelItems, useNr165Warning, Nr165WarningBox, lcdTeachInfoItem, visibleLcdTeachScreen, type InfoItem } from './InfoPanel'
import { REDUCED_DAILY_REST_MIN_MS, SPLIT_REST_SECOND_MS, formatDurationHhMm } from './VDOCounter'
import { drivingBreakDisplay, drivingRestTotals } from './drivingBreakDisplay'
import { drivingRemainderUndocumented, evaluateRecordedOut, undeterminedOverlaps } from './outDrivingEvaluation'
import { ferryDailyRestRemaining, intervalsWithRecognizedFerryRest } from './ferryRestEvaluation'
import { buildSlot1VirtualCardDrivingBreak, buildSlot1VirtualCounterIntervals } from './slot1DrivingBreak'
import { buildSlot1DddDrivingBreakIntervals, buildSlot1DddOutSources, describeSlot1WeekCoverage } from './slot1DddDrivingBreak'
import { slot1DddCalendarRemaining, slot1DddDailyRemaining, weekStartUtc } from './slot1DddDailyRemaining'
import { workingTimeDisplay } from './workingTimeDisplay'
import { counterCardSlot, counterIndexAfterCardRemoval, slot1CounterLcdProps, vdo24hEntryAvailable, vdoCounterClosesWithoutCard, buildTimesSequence, timesLocationFrom, stepTimesLocation, type VdoNamedScreen } from './slot1DddCounter'
import { parseSymbols } from './Symbols'
import { isWarningCode } from './data/warnings'
import { useLanguage } from './translations'
import { ControlPanel } from './ControlPanel'
import { PrintVehicleSettings } from './components/PrintVehicleSettings'
import { loadPrintVehicleProfile } from './data/printVehicleProfile'
import { DriverCardVisual } from './DriverCardVisual'
import { CardPrepMenu, type CardPrep } from './CardPrepMenu'
import { usePrintState } from './print/usePrintState'
import { PrintOverlays } from './print/PrintOverlays'
import { driverPrintSlot, applyPrintWizardKey, resolvePrintMenuAction } from './print/printWizardHandling'
import { driver1PrintCardActivities, simulatedPrintCardActivities, ongoingPrintCardActivity } from './print/prepareDriver1Print24h'
import { useMenuCountryInput } from './useMenuCountryInput'
import { useMenuLoadUnload } from './useMenuLoadUnload'
import { useSimulationSecondClock, type MinuteAccumulator } from './useSimulationSecondClock'
import { useDrivingInterval } from './useDrivingInterval'
import { advanceWithdrawalBargraf, applyCardWithdrawalKey } from './cardWithdrawalTransitions'
import { buildSimulated4h10m } from './simulate4h10m'
import { buildShowCardGraphData } from './showCardGraphData'
import { buildDroppedCardData } from './buildDroppedCardData'
import { type DddCardPreview } from './dddCardPreview'
import { loadDriverCardFromDdd } from './loadDddCard'
import {
  appendWorkingMinutes,
  assessDddInsertion,
  createDddCardRecord,
  replaceWorkingManual,
  setWorkingWithdrawal,
  type DddCardRecord,
} from './dddCardSession'

export type { ActivityId, CardData, CardInsertionState, CardWithdrawalState, TachoState, ManualActivityEntry, ManualEntrySegment, ActivityHistoryEntry, EventLogEntry }
export { TEST_CARDS }

export default function App() {
  const { addEntry } = useActionLog()
  const { t, language, setLanguage } = useLanguage()
  const menusById = useMemo(() => applyMenuTranslations(buildMenusById(), t), [t])
  const [symbolMap, setSymbolMap] = useState<SymbolMap | null>(null)
  const [displayMode, setDisplayMode] = useState<'operating' | 'menu'>('operating')
  /** VDO counter aktivní až po stisku šipky nahoru/dolů – jinak základní obrazovka */
  const [vdoCounterActive, setVdoCounterActive] = useState(false)
  /** Index obrazovky VDO counter (0–6) na základní obrazovce – šipky nahoru/dolů */
  const [operatingScreenIndex, setOperatingScreenIndex] = useState(0)
  /** Prozatímní pojmenovaná obrazovka. Šipka dolů z hlavního Counteru, šipka nahoru zpět. */
  const [vdoNamedScreen, setVdoNamedScreen] = useState<VdoNamedScreen | null>(null)
  const [currentMenuPath, setCurrentMenuPath] = useState<string[]>([ENTRY_MENU_ID])
  const [selectedIndex, setSelectedIndex] = useState(0)
  // Simulovaný čas UTC – vnitřní čas simulátoru, nezávislý na systémovém čase
  const [simulatedUtcTime, setSimulatedUtcTime] = useState(() => Date.now())
  const [timeOffsetMs, setTimeOffsetMs] = useState(0)
  const [printVehicleProfile, setPrintVehicleProfile] = useState(loadPrintVehicleProfile)
  const localTime = useMemo(
    () => new Date(simulatedUtcTime + timeOffsetMs),
    [simulatedUtcTime, timeOffsetMs],
  )
  const [panelDateTime, setPanelDateTime] = useState(() => new Date())
  /** Čas poslední manuální úpravy panelu (+/-) – po tuto dobu nesyncovat panel zpět, aby tlačítko + zůstalo funkční */
  const lastPanelAdjustmentMsRef = useRef<number>(0)
  const [nr165Dismissed, setNr165Dismissed] = useState(false)
  const [mobileInfoPanels, setMobileInfoPanels] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('screen and (max-width: 900px)')
    const sync = () => setMobileInfoPanels(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  /** Výstraha při pokusu o generování pracovního týdne, když na kartě již jsou data (překryv). */
  const [generateWorkWeekBlockedWarning, setGenerateWorkWeekBlockedWarning] = useState(false)
  /** Modal: pokus o zápis duplicitních dat na kartu */
  const [duplicateDataWarningOpen, setDuplicateDataWarningOpen] = useState(false)
  /** Trigger pro vyprázdnění InfoPanel (globální Reset) */
  const [infoPanelResetTrigger, setInfoPanelResetTrigger] = useState(0)
  const [menuComingSoonInfo, setMenuComingSoonInfo] = useState<{ id: string } | null>(null)
  // Načtení symbolů ze souboru symboly.txt (dostupného jako statický asset, např. v /public)
  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}symboly.txt`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Failed to load symboly.txt'))))
      .then((text) => {
        if (cancelled) return
        setSymbolMap(buildSymbolMapFromFile(text))
      })
      .catch(() => {
        // Při chybě ponecháme symbolMap null – texty se zobrazí bez náhrad.
        if (cancelled) return
        setSymbolMap({})
      })
    return () => {
      cancelled = true
    }
  }, [])
  // Synchronizace panelu času se simulovaným časem – jen když panel ZAOSTÁVÁ za localTime
  // (panel vpřed = uživatel posunul tlačítky, nepřepisovat). Po manuální úpravě (+/-) nesyncovat
  // 5 minut – uživatel má dost času potvrdit volbu, jinak by tlačítko + přestalo reagovat.
  const localTimeMs = simulatedUtcTime + timeOffsetMs
  const PANEL_ADJUSTMENT_GRACE_MS = 5 * 60 * 1000
  useEffect(() => {
    setPanelDateTime((prev) => {
      const diffMs = prev.getTime() - localTimeMs
      if (diffMs >= 0) return prev
      const sinceAdjustment = Date.now() - lastPanelAdjustmentMsRef.current
      if (sinceAdjustment < PANEL_ADJUSTMENT_GRACE_MS) return prev
      return new Date(localTimeMs)
    })
  }, [simulatedUtcTime, timeOffsetMs])
  // Minus: povolit pokud (panel - 1h) zaokrouhleno na minutu >= local zaokrouhleno na minutu
  // (přísná porovnání ms způsobovala, že po ticku simulace minus zůstal neaktivní)
  const canDecrementHours =
    Math.floor((panelDateTime.getTime() - 3600000) / 60000) * 60000 >= Math.floor(localTimeMs / 60000) * 60000
  const canDecrementMinutes =
    Math.floor((panelDateTime.getTime() - 60000) / 60000) * 60000 >= Math.floor(localTimeMs / 60000) * 60000
  const [targetSpeed, setTargetSpeed] = useState(0)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [odometerKm, setOdometerKm] = useState(ODOMETER_KM)
  const [ignitionOn, setIgnitionOn] = useState(true)
  const [ignitionWarningActive, setIgnitionWarningActive] = useState(false)
  const ignitionWarningDismissedRef = useRef(false)
  /** Probuzení displeje ze Standby – libovolné tlačítko rozsvítí displej, žádná další akce. */
  const [displayAwakeFromStandby, setDisplayAwakeFromStandby] = useState(false)
  const displayAwakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [stopDisabledMessage, setStopDisabledMessage] = useState(false)
  const [card1Inserted, setCard1Inserted] = useState(false)
  const [card2Inserted, setCard2Inserted] = useState(false)
  useEffect(() => {
    const next = counterIndexAfterCardRemoval({
      index: operatingScreenIndex,
      card1Inserted,
      card2Inserted,
    })
    if (next !== operatingScreenIndex) setOperatingScreenIndex(next)
  }, [card1Inserted, card2Inserted, operatingScreenIndex])
  useEffect(() => {
    if (!vdoCounterClosesWithoutCard(card1Inserted, card2Inserted)) return
    if (!vdoCounterActive && vdoNamedScreen == null) return
    setVdoCounterActive(false)
    setVdoNamedScreen(null)
  }, [card1Inserted, card2Inserted, vdoCounterActive, vdoNamedScreen])
  /** Čas rozjezdu s kartou 1 (pro pravidlo 1 h v režimu osádky). Reset při vyjmutí obou karet. */
  const [drivingStartTime, setDrivingStartTime] = useState<number | null>(null)
  /** Čas vložení karty do slotu 2. Nastaví se při vložení; reset při vyjmutí obou karet. */
  const [card2InsertedAt, setCard2InsertedAt] = useState<number | null>(null)
  const [leftActivityId, setLeftActivityId] = useState<ActivityId>('REST')
  const [rightActivityId, setRightActivityId] = useState<ActivityId>('REST')
  const [companyCardInserted] = useState(false)
  const [controlCardInserted] = useState(false)
  const [optionalFeatureEnabled] = useState(false)
  const [vdoLinkConnected] = useState(false)
  /** Režim trajekt – aktivní po zadání vozidlo–trajekt začátek, končí při vytažení karty nebo po min. 1 min jízdy */
  const [ferryTrainModeActive, setFerryTrainModeActive] = useState(false)
  /** Režim OUT – aktivní po zadání vozidlo–OUT začátek, končí zadáním OUT konec nebo vytažením karty */
  const [outModeActive, setOutModeActive] = useState(false)
  /** Čas (UTC ms), kdy vozidlo zastavilo v režimu OUT – null = jede nebo režim neaktivní. */
  const [outStoppedAtUtc, setOutStoppedAtUtc] = useState<number | null>(null)
  /** Po zapnutí OUT jsme alespoň jednou jeli – pak po zastavení ukážeme 10 s kladívka, pak OUT. */
  const [hasDrivenSinceOutActivation, setHasDrivenSinceOutActivation] = useState(false)
  const [remoteDataDownloadActive, setRemoteDataDownloadActive] = useState(false)
  const [activityDurationsMs, setActivityDurationsMs] = useState<ActivityDurationsMs>(() => ({ ...INITIAL_ACTIVITY_DURATIONS }))
  /** Pro VDO counter: doba řízení od poslední přestávky, doba odpočinku – per řidič (1=levý slot, 2=pravý) */
  const [, setDrivingSinceLastBreakMsByDriver] = useState<Record<1 | 2, number>>({ 1: 0, 2: 0 })
  const [, setRestSinceLastBreakMsByDriver] = useState<Record<1 | 2, number>>({ 1: 0, 2: 0 })
  /** Dělená pauza: po 15m přestávce následuje jízda, nyní je potřeba druhá část 30m – per řidič */
  const [splitFirstPartTakenByDriver, setSplitFirstPartTakenByDriver] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false })
  // Původní události tachografu (tachoEvents) aktuálně nevyužíváme – ponecháno pro budoucí rozšíření
  /** Sekundový tracker aktivit (R1, R2, rychlost) – pro detailní historii. */
  const [secondHistory, setSecondHistory] = useState<SecondActivitySnapshot[]>([])
  /** Historie aktivit po minutách – perzistentní log. */
  const [activityHistory, setActivityHistory] = useState<ActivityHistoryEntry[]>(() => loadTachographActivityHistory())
  /** Varování / chyby (např. jízda bez karty). */
  const [faultsAndEvents, setFaultsAndEvents] = useState<FaultOrEvent[]>(() => loadTachographFaultsAndEvents())
  /** Log událostí pro výpis (Event 07 – Jízda bez karty apod.). */
  const [eventLog, setEventLog] = useState<EventLogEntry[]>(() => loadTachographEventLog())
  /** Doplňkové aktivity řidiče 1 (až 6 položek, doby v minutách) – zadání v menu po vložení karty. */
  const [driver1ManualActivities, setDriver1ManualActivities] = useState<ManualActivityEntry[]>([])
  /** Doplňkové aktivity řidiče 2 (až 6 položek, doby v minutách) – zadání v menu po vložení karty. */
  const [driver2ManualActivities, setDriver2ManualActivities] = useState<ManualActivityEntry[]>([])
  /** Aktivní varování „Jízda bez karty“ (překrývá menu). */
  const [drivingWithoutCardWarningActive, setDrivingWithoutCardWarningActive] = useState(false)
  /** Výstraha "jízda bez platné karty" – karta vložena, ale manuální zadávání přerušeno rozjezdem. */
  const [drivingWithoutValidCardWarningActive, setDrivingWithoutValidCardWarningActive] = useState(false)
  /** Varování pracovní doby – 4:15 nebo 4:30. null = nezobrazovat. */
  const [breakWarningActive, setBreakWarningActive] = useState<'415' | '430' | null>(null)
  /** Varování: 10h prodloužená směna nedostupná (2× v týdnu již vyčerpáno) */
  /** Varování: překročení rychlosti >90 km/h déle než 1 min – L1 (39)(39) vys. rychlost, L2 vpravo "30" */
  const [excessSpeedWarningActive, setExcessSpeedWarningActive] = useState(false)
  /** Přepsání: zobraz výstrahu "XX" – volá se povelem zobrazVystrahu("XX") */
  const [overrideWarningCode, setOverrideWarningCode] = useState<string | null>(null)
  /** Výstraha „výhoz není možný“ – zobrazí se jen po pokusu o vyjmutí karty během jízdy, zruší se po zastavení */
  const [ejectionBlockedWarningActive, setEjectionBlockedWarningActive] = useState(false)
  const activeNoCardIdRef = useRef<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<1 | 2 | null>(null)
  /** Čas posledního vyjmutí karty (pro „Posled. vyjmutí“ v sekvenci vložení). */
  const [lastEjectionTimeBySlot, setLastEjectionTimeBySlot] = useState<{ 1: number | null; 2: number | null }>({ 1: null, 2: null })
  /** Která testovací karta je ve slotu 1/2 (null = prázdný). */
  const [cardsOpen, setCardsOpen] = useState(false)
  const [cardPickerSlot, setCardPickerSlot] = useState<1 | 2 | null>(null)
  const [cardDragging, setCardDragging] = useState(false)
  const [card1Data, setCard1Data] = useState<CardData | null>(null)
  const [card2Data, setCard2Data] = useState<CardData | null>(null)
  /** Sekvence vložení karty (1M) – řízena useCardWizard */
  /** Průvodce vyjmutím karty (Withdrawal Wizard). Trigger: krátký stisk tlačítka slotu s vloženou kartou. */
  const [cardWithdrawalState, setCardWithdrawalState] = useState<CardWithdrawalState | null>(null)
  /** Události nakládky/vykládky vozidla (časové razítko + GPS). */
  const [vehicleLoadUnloadEvents, setVehicleLoadUnloadEvents] = useState<VehicleLoadUnloadEvent[]>(() => loadTachographVehicleLoadUnloadEvents())
  const [ferryTrainEvents, setFerryTrainEvents] = useState<FerryTrainEvent[]>(() => loadTachographFerryTrainEvents())
  const [outModeEvents, setOutModeEvents] = useState<OutModeEvent[]>(() => loadTachographOutModeEvents())
  const [recordedGpsLocations, setRecordedGpsLocations] = useState<RecordedGpsLocation[]>(() => loadTachographRecordedGpsLocations())
  /** Univerzální průvodce výtiskem (requiresDate, requiresUtcConfirm). */
  const [printWizardState, setPrintWizardState] = useState<PrintWizardState | null>(null)
  /** Data z karty – VDO counter čerpá z karty; bez karty z paměti tachografu (activityHistory) */
  const [cardActivityHistoryByTemplateId, setCardActivityHistoryByTemplateId] = useState<Record<string, ActivityHistoryEntry[]>>(() => loadTachographCardActivityHistoryByTemplateId())
  /** Persistence isFirstInsertion, itsConsent, vdoConsent pro karty řidičů. */
  const [driverCardStateByTemplateId, setDriverCardStateByTemplateId] = useState<Record<string, { isFirstInsertion: boolean; itsConsent?: boolean; vdoConsent?: boolean }>>({})
  /** Uložené 1M záznamy pro řidiče 1 (pro výtisk) – uloží se při dokončení průvodce. */
  const [driver1ManualEntryBuffer, setDriver1ManualEntryBuffer] = useState<ManualEntrySegment[]>(() => loadCard1ManualEntryBuffer())
  /** Uložené 1M záznamy pro řidiče 2 (pro výtisk). */
  const [driver2ManualEntryBuffer, setDriver2ManualEntryBuffer] = useState<ManualEntrySegment[]>(() => loadCard2ManualEntryBuffer())
  /** Stav a logika výtisků – overlaye, otevření/zavření, toast. */
  const printState = usePrintState()
  /** Graf pracovního týdne – načtená data z TXT. null = okno zavřeno. */
  const [workWeekGraphData, setWorkWeekGraphData] = useState<{
    days: DayData[]
    countryMarkers: CountryMarker[]
    manualEntryBuffer?: ManualEntrySegment[]
    lastWithdrawalUtc?: number | null
    card2Data?: { days: DayData[]; countryMarkers: CountryMarker[]; manualEntryBuffer?: ManualEntrySegment[]; lastWithdrawalUtc?: number | null }
  } | null>(null)
  const workWeekFileInputRef = useRef<HTMLInputElement>(null)
  const [dddPreview, setDddPreview] = useState<DddCardPreview | null>(null)
  const [dddPreviewOpen, setDddPreviewOpen] = useState(false)
  const [cardGraphsWindowOpen, setCardGraphsWindowOpen] = useState(false)
  const [cardPrep, setCardPrep] = useState<[CardPrep | null, CardPrep | null]>([null, null])
  const [cardPrepError, setCardPrepError] = useState<[string | null, string | null]>([null, null])
  const [dddInsertMessage, setDddInsertMessage] = useState<string | null>(null)
  const [dddCards, setDddCards] = useState<Record<string, DddCardRecord>>({})
  const dddCardsRef = useRef(dddCards)
  dddCardsRef.current = dddCards
  /** Seznam zemí z countries.txt (nebo fallback). */
  const [countries, setCountries] = useState<CountryEntry[]>(FALLBACK_COUNTRY_LIST)
  /** Regiony Španělska (pod „regions:“ v countries.txt). */
  const [spanishRegions, setSpanishRegions] = useState<CountryEntry[]>([])
  const slot1Ref = useRef<HTMLDivElement>(null)
  const slot2Ref = useRef<HTMLDivElement>(null)
  const vdoWrapperRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const longPressFiredRef = useRef(false)
  const longPressStartRef = useRef<number>(0)
  const setCard1InsertedRef = useRef(setCard1Inserted)
  const setCard2InsertedRef = useRef(setCard2Inserted)
  const card1InsertedRef = useRef(card1Inserted)
  const card2InsertedRef = useRef(card2Inserted)
  const isMultiManningRef = useRef(false)
  const ignitionOnRef = useRef(ignitionOn)
  const targetSpeedRef = useRef(targetSpeed)
  const currentSpeedRef = useRef(currentSpeed)
  const leftActivityIdRef = useRef(leftActivityId)
  const activitySinceRef = useRef<{ 1: { activity: string; at: number }; 2: { activity: string; at: number } } | null>(null)
  const rightActivityIdRef = useRef(rightActivityId)
  const activityDurationsMsRef = useRef(activityDurationsMs)
  activityDurationsMsRef.current = activityDurationsMs
  const simulatedUtcTimeRef = useRef(simulatedUtcTime)
  const drivingSinceLastBreakMsByDriverRef = useRef<Record<1 | 2, number>>({ 1: 0, 2: 0 })
  const restSinceLastBreakMsByDriverRef = useRef<Record<1 | 2, number>>({ 1: 0, 2: 0 })
  const splitFirstPartTakenByDriverRef = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false })
  const breakWarning415DismissedRef = useRef(false)
  const breakWarning430DismissedRef = useRef(false)
  const prevLeftCharRef = useRef<string | null>(null)
  const prevRightCharRef = useRef<string | null>(null)
  const card1DataRef = useRef<CardData | null>(null)
  const card2DataRef = useRef<CardData | null>(null)
  const activityHistoryRef = useRef<ActivityHistoryEntry[]>([])
  const cardActivityHistoryByTemplateIdRef = useRef<Record<string, ActivityHistoryEntry[]>>({})
  const cardWithdrawalStateRef = useRef<CardWithdrawalState | null>(null)
  /** Aktuální země dle GPS – předává se do useCardWizard2 (ref proto, že virtualLocation je deklarován později) */
  const currentLocationCountryCodeRefForWizard = useRef<string | null>(null)
  const flushActivitiesToCardBeforeEjectRef = useRef<((slot: 1 | 2) => void) | null>(null)
  /** Doba jízdy během režimu trajekt – reset při startu trajektu, používá se pro ukončení po 1 min */
  const ferryDrivingMsRef = useRef(0)
  /** Čas nad 90 km/h – po 1 min zobrazí varování překročení rychlosti */
  const overspeedRunRef = useRef<OverspeedRun | null>(null)
  setCard1InsertedRef.current = setCard1Inserted
  setCard2InsertedRef.current = setCard2Inserted
  card1DataRef.current = card1Data
  card2DataRef.current = card2Data
  activityHistoryRef.current = activityHistory
  cardActivityHistoryByTemplateIdRef.current = cardActivityHistoryByTemplateId
  cardWithdrawalStateRef.current = cardWithdrawalState
  card1InsertedRef.current = card1Inserted
  card2InsertedRef.current = card2Inserted
  ignitionOnRef.current = ignitionOn
  targetSpeedRef.current = targetSpeed
  currentSpeedRef.current = currentSpeed
  simulatedUtcTimeRef.current = simulatedUtcTime
  splitFirstPartTakenByDriverRef.current = splitFirstPartTakenByDriver
  leftActivityIdRef.current = leftActivityId
  rightActivityIdRef.current = rightActivityId

  const ferryTrainModeActiveRef = useRef(ferryTrainModeActive)
  ferryTrainModeActiveRef.current = ferryTrainModeActive
  const outModeActiveRef = useRef(outModeActive)
  outModeActiveRef.current = outModeActive
  const setFerryTrainModeActiveRef = useRef(setFerryTrainModeActive)
  setFerryTrainModeActiveRef.current = setFerryTrainModeActive

  /** isMoving true → slot 1 na Řízení (DRIVING). isMoving false → přepne slot 1 (a při režimu osádky i slot 2) na Odpočinek (REST); symbol Řízení nesmí zůstat aktivní při zastavení.
   * Okamžitá aktualizace refů je nutná, aby interval (100 ms) viděl správnou aktivitu dříve než React vykreslí – jinak L1 vpravo neodečítá čas přestávky. */
  const setDrivingMode = useCallback((isMoving: boolean, alsoSetSlot2ToRest: boolean = false) => {
    if (isMoving) {
      leftActivityIdRef.current = 'DRIVING'
      setLeftActivityId('DRIVING')
    } else {
      leftActivityIdRef.current = 'REST'
      setLeftActivityId('REST')
      if (alsoSetSlot2ToRest) {
        rightActivityIdRef.current = 'REST'
        setRightActivityId('REST')
      }
    }
  }, [])

  const [crewRuleInterruptedByCard2Exit, setCrewRuleInterruptedByCard2Exit] = useState(false)
  /** V režimu osádky: odložené razítko cílové země (slot → { čas, countryCode }). Propíše se při skončení režimu. */
  const deferredEndCountryInCrewModeRef = useRef<Partial<Record<1 | 2, { withdrawalTime: number; countryCode: string }>>>({})
  const prevSpeedRef = useRef(currentSpeed)
  const prevCard2InsertedRef = useRef(card2Inserted)

  useEffect(() => {
    if (currentSpeed > 0 && card1Inserted) {
      setDrivingStartTime((prev) => (prev === null ? Date.now() : prev))
    }
  }, [currentSpeed, card1Inserted])

  useEffect(() => {
    if (!card1Inserted && !card2Inserted) {
      setDrivingStartTime(null)
      setCard2InsertedAt(null)
      setCrewRuleInterruptedByCard2Exit(false)
      deferredEndCountryInCrewModeRef.current = {}
    }
  }, [card1Inserted, card2Inserted])

  /** Přerušení režimu osádky: pouze když řidič 1 jel po vytažení karty řidiče 2 (ne při prvním nástupu řidiče 2).
   * Řidič 2 může nastoupit do 1 h od začátku jízdy; v takovém případě je režim osádky platný. */
  useEffect(() => {
    const hadCard2 = prevCard2InsertedRef.current
    prevCard2InsertedRef.current = card2Inserted

    if (!card1Inserted && !card2Inserted) return

    if (card2Inserted && !hadCard2) {
      if (drivingStartTime == null || card2InsertedAt == null || card2InsertedAt <= drivingStartTime + MULTI_MANNING_ONE_HOUR_MS) {
        setCrewRuleInterruptedByCard2Exit(false)
      }
    } else if (!card2Inserted && hadCard2 && currentSpeed > 0 && card1Inserted) {
      setCrewRuleInterruptedByCard2Exit(true)
    }
  }, [card1Inserted, card2Inserted, currentSpeed, drivingStartTime, card2InsertedAt])

  /** Globální příkaz: zobraz výstrahu "XX" – volatelné z konzole nebo z testů */
  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(window as unknown as { zobrazVystrahu?: (code: string) => void }).zobrazVystrahu = (code: string) => {
      if (isWarningCode(code)) {
        setOverrideWarningCode(code)
      }
    }
    return () => {
      delete (window as unknown as { zobrazVystrahu?: (code: string) => void }).zobrazVystrahu
    }
  }, [])

  const isMultiManning = useMemo(() => {
    if (!card1Inserted || !card2Inserted) return false
    if (crewRuleInterruptedByCard2Exit) return false
    if (drivingStartTime === null) return true
    if (card2InsertedAt === null) return true
    return card2InsertedAt <= drivingStartTime + MULTI_MANNING_ONE_HOUR_MS
  }, [card1Inserted, card2Inserted, crewRuleInterruptedByCard2Exit, drivingStartTime, card2InsertedAt])

  isMultiManningRef.current = isMultiManning

  useEffect(() => {
    const wasMoving = prevSpeedRef.current > 0
    const isStopped = currentSpeed === 0
    prevSpeedRef.current = currentSpeed

    if (currentSpeed > 0) {
      setOutStoppedAtUtc(null)
      setDrivingMode(true)
      if (!wasMoving) setRightActivityId('AVAILABILITY')
      if (outModeActive) setHasDrivenSinceOutActivation(true)
    } else if (wasMoving && isStopped) {
      if (outModeActive) {
        leftActivityIdRef.current = 'WORK'
        setLeftActivityId('WORK')
        if (isMultiManning) {
          rightActivityIdRef.current = 'REST'
          setRightActivityId('REST')
        }
        setOutStoppedAtUtc(simulatedUtcTime)
      } else {
        setDrivingMode(false, isMultiManning)
      }
    }
  }, [currentSpeed, isMultiManning, setDrivingMode, outModeActive, simulatedUtcTime])

  /** Při startu jízdy okamžitě ukončit menu (main dashboard: při aktivitě jízdy menu zmizí) */
  useEffect(() => {
    if (currentSpeed > 0 && displayMode === 'menu') {
      setDisplayMode('operating')
      setCurrentMenuPath([ENTRY_MENU_ID])
      setSelectedIndex(0)
    }
  }, [currentSpeed, displayMode])

  /** Režim OUT: při stojícím vozidle nastav outStoppedAtUtc (pro 10 s odpočet do nápisu OUT po zastavení) */
  useEffect(() => {
    if (outModeActive && currentSpeed === 0 && outStoppedAtUtc === null) {
      setOutStoppedAtUtc(simulatedUtcTime)
    }
    if (!outModeActive) {
      setOutStoppedAtUtc(null)
      setHasDrivenSinceOutActivation(false)
    }
  }, [outModeActive, currentSpeed, outStoppedAtUtc, simulatedUtcTime])

  /** Po zastavení vozidla zruš výstrahu „výhoz není možný“ */
  useEffect(() => {
    if (currentSpeed === 0) setEjectionBlockedWarningActive(false)
  }, [currentSpeed])

  useEffect(() => {
    loadCountries().then(({ countries: c, spanishRegions: r }) => {
      setCountries(c.length ? c : FALLBACK_COUNTRY_LIST)
      setSpanishRegions(r)
    })
  }, [])

  // Průvodce vyjmutím: bargraf ~2 s → automatický přechod na countrySelect (tick nutný pro re-render během animace)
  const [withdrawalBargrafTick, setWithdrawalBargrafTick] = useState(0)
  useEffect(() => {
    const ws = cardWithdrawalState
    if (!ws || ws.phase !== 'bargraf') return
    const startTime = ws.phaseStartTime
    const tick = () => {
      const elapsed = Date.now() - startTime
      if (elapsed >= 2000) {
        setCardWithdrawalState((p) => (p?.phase === 'bargraf' ? advanceWithdrawalBargraf(p, Date.now()) : p))
      } else {
        setWithdrawalBargrafTick((t) => t + 1)
      }
    }
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [cardWithdrawalState?.phase, cardWithdrawalState?.phaseStartTime])

  const countriesRef = useRef(countries)
  const spanishRegionsRef = useRef(spanishRegions)
  countriesRef.current = countries
  spanishRegionsRef.current = spanishRegions

  const commitSlotManual = useCallback((slot: 1 | 2, update: React.SetStateAction<ManualEntrySegment[]>) => {
    const cardNumber = (slot === 1 ? card1DataRef.current : card2DataRef.current)?.cardNumber
    if (cardNumber) {
      setDddCards((prev) => {
        const current = prev[cardNumber]?.workingManual ?? []
        const next = typeof update === 'function' ? update(current) : update
        return replaceWorkingManual(prev, cardNumber, next)
      })
      return
    }
    if (slot === 1) setDriver1ManualEntryBuffer(update)
    else setDriver2ManualEntryBuffer(update)
  }, [])

  const noteDddWithdrawal = useCallback((cardNumber: string | undefined, withdrawalUtc: number) => {
    if (!cardNumber) return
    setDddCards((prev) => setWorkingWithdrawal(prev, cardNumber, withdrawalUtc))
  }, [])

  const commitDriver1Manual = useCallback((update: React.SetStateAction<ManualEntrySegment[]>) => {
    commitSlotManual(1, update)
  }, [commitSlotManual])

  const commitDriver2Manual = useCallback((update: React.SetStateAction<ManualEntrySegment[]>) => {
    commitSlotManual(2, update)
  }, [commitSlotManual])

  const onEjectRequestedForWizard = useCallback((slot: 1 | 2, options?: { idleTimeout?: boolean }) => {
    if (!ignitionOnRef.current) return
    if (options?.idleTimeout) {
      setCardWithdrawalState((prev) => (prev?.slot === slot ? null : prev))
      if (slot === 1) {
        setCard1Data(null)
        setCard1InsertedRef.current(false)
      }
      if (slot === 2) {
        setCard2Data(null)
        setCard2InsertedRef.current(false)
      }
      return
    }
    const withdrawalTime = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
    const cardData = slot === 1 ? card1DataRef.current : card2DataRef.current
    const tid = cardData?.templateId
    if (tid === CARD1_TEMPLATE_ID) saveCard1LastWithdrawal(withdrawalTime)
    else if (tid === CARD2_TEMPLATE_ID) saveCard2LastWithdrawal(withdrawalTime)
    noteDddWithdrawal(cardData?.cardNumber, withdrawalTime)
    setLastEjectionTimeBySlot((prev) => ({ ...prev, [slot]: withdrawalTime }))
    setCardWithdrawalState((prev) => (prev?.slot === slot ? null : prev))
    if (slot === 1) {
      setCard1Data(null)
      setCard1InsertedRef.current(false)
    }
    if (slot === 2) {
      setCard2Data(null)
      setCard2InsertedRef.current(false)
    }
  }, [])

  const {
    cardInsertionState,
    setCardInsertionState,
    handleCardInsertionKey,
    cardInsertionStateRef,
    lastCardInsertionKeyPressRef,
  } = useCardWizard2({
    countries,
    spanishRegions,
    simulatedUtcTime,
    card1Data,
    card2Data,
    setCard1Data,
    setCard2Data,
    setDriverCardStateByTemplateId,
    setDriver1ManualEntryBuffer: commitDriver1Manual,
    setDriver2ManualEntryBuffer: commitDriver2Manual,
    isMultiManning,
    onEjectRequested: onEjectRequestedForWizard,
    currentSpeed,
    timeOffsetMs,
    getCurrentLocationCountryCode: () => currentLocationCountryCodeRefForWizard.current ?? null,
  })

  cardInsertionStateRef.current = cardInsertionState

  const runEjectForSlot = useCallback((slot: 1 | 2) => {
    if (!ignitionOnRef.current) return
    onEjectRequestedForWizard(slot)
    setCardInsertionState((prev) => (prev?.slot === slot ? null : prev))
  }, [onEjectRequestedForWizard, setCardInsertionState])

  const performCardEjectWithCountry = useCallback((prev: CardWithdrawalState) => {
    flushActivitiesToCardBeforeEjectRef.current?.(prev.slot)
    const withdrawalTime = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
    const templateId = prev.cardData.templateId
    if (templateId === CARD1_TEMPLATE_ID) saveCard1LastWithdrawal(withdrawalTime)
    else if (templateId === CARD2_TEMPLATE_ID) saveCard2LastWithdrawal(withdrawalTime)
    noteDddWithdrawal(prev.cardData.cardNumber, withdrawalTime)
    setLastEjectionTimeBySlot((p) => ({ ...p, [prev.slot]: withdrawalTime }))
    const countryCode = countries[prev.countryIndex]?.code ?? 'CZ'

    const makeEndCountrySegment = (time: number, code: string): ManualEntrySegment => ({
      ...utcMsToSegment(time),
      activityId: 'END_COUNTRY',
      countryCode: code,
      isManualEntry: true,
    })

    const isDuplicateEndCountry = (buf: ManualEntrySegment[], time: number, code: string) => {
      const last = buf[buf.length - 1]
      return last?.activityId === 'END_COUNTRY' && last?.countryCode === code && segmentToMsUtc(last) === time
    }

    const gpsName = virtualLocationRef.current?.name ?? '—'
    const deferred = deferredEndCountryInCrewModeRef.current
    const alreadyAddedForCurrentSlot = Boolean(deferred[prev.slot])
    if (deferred[1]) {
      setDriver1ManualEntryBuffer((buf) =>
        isDuplicateEndCountry(buf, deferred[1]!.withdrawalTime, deferred[1]!.countryCode)
          ? buf
          : [...buf, makeEndCountrySegment(deferred[1]!.withdrawalTime, deferred[1]!.countryCode)]
      )
      setRecordedGpsLocations((r) => [...r, { minuteStartUtc: deferred[1]!.withdrawalTime, gpsLocation: '—', recordType: 'end_country_card' }])
    }
    if (deferred[2]) {
      setDriver2ManualEntryBuffer((buf) =>
        isDuplicateEndCountry(buf, deferred[2]!.withdrawalTime, deferred[2]!.countryCode)
          ? buf
          : [...buf, makeEndCountrySegment(deferred[2]!.withdrawalTime, deferred[2]!.countryCode)]
      )
      setRecordedGpsLocations((r) => [...r, { minuteStartUtc: deferred[2]!.withdrawalTime, gpsLocation: '—', recordType: 'end_country_card' }])
    }
    deferredEndCountryInCrewModeRef.current = {}
    if (isMultiManning) {
      deferredEndCountryInCrewModeRef.current = { [prev.slot]: { withdrawalTime, countryCode } }
    } else if (!alreadyAddedForCurrentSlot) {
      commitSlotManual(prev.slot, (buf) =>
        isDuplicateEndCountry(buf, withdrawalTime, countryCode) ? buf : [...buf, makeEndCountrySegment(withdrawalTime, countryCode)]
      )
      setRecordedGpsLocations((r) => [...r, { minuteStartUtc: withdrawalTime, gpsLocation: gpsName ?? '—', recordType: 'end_country_card' }])
    }

    if (prev.slot === 1) {
      setCard1Data(null)
      setCard1InsertedRef.current(false)
    } else {
      setCard2Data(null)
      setCard2InsertedRef.current(false)
    }
    setCardInsertionState((p) => (p?.slot === prev.slot ? null : p))
    setVdoCounterActive(false)
    setDisplayMode('operating')
  }, [countries, isMultiManning, setVdoCounterActive, setDisplayMode, commitSlotManual, noteDddWithdrawal])

  const handleCardWithdrawalKey = useCallback((action: 'ok' | 'up' | 'down' | 'back') => {
    setCardWithdrawalState((prev) => {
      if (!prev) return null
      const result = applyCardWithdrawalKey(prev, action, countries.length)
      if (result.type === 'state') return result.state
      if (result.type === 'ejectWithoutCountry') {
        const withdrawalTime = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
        const templateId = prev.cardData.templateId
        if (templateId === CARD1_TEMPLATE_ID) saveCard1LastWithdrawal(withdrawalTime)
        else if (templateId === CARD2_TEMPLATE_ID) saveCard2LastWithdrawal(withdrawalTime)
        noteDddWithdrawal(prev.cardData.cardNumber, withdrawalTime)
        setLastEjectionTimeBySlot((p) => ({ ...p, [prev.slot]: withdrawalTime }))
        if (prev.slot === 1) {
          setCard1Data(null)
          setCard1InsertedRef.current(false)
        } else {
          setCard2Data(null)
          setCard2InsertedRef.current(false)
        }
        setCardInsertionState((p) => (p?.slot === prev.slot ? null : p))
        setVdoCounterActive(false)
        setDisplayMode('operating')
        return null
      }
      performCardEjectWithCountry(prev)
      return null
    })
  }, [countries, performCardEjectWithCountry, setVdoCounterActive, setDisplayMode, setDriver1ManualEntryBuffer, setDriver2ManualEntryBuffer])

  const minuteAccumulatorRef = useRef<MinuteAccumulator | null>(null)
  const recordDddMinuteRef = useRef<(cardNumber: string, entry: ActivityHistoryEntry) => void>(() => {})
  recordDddMinuteRef.current = (cardNumber, entry) => {
    setDddCards((prev) => appendWorkingMinutes(prev, cardNumber, [entry]))
  }
  const drivingSinceLastGpsMsRef = useRef(0)
  const drivingMsSinceLastGpsRecordRef = useRef(0)
  const virtualLocationRef = useRef<VirtualRoutePoint | null>(null)
  const odometerKmRef = useRef(odometerKm)
  odometerKmRef.current = odometerKm

  useSimulationSecondClock({
    simulatedUtcTimeRef,
    setSimulatedUtcTime,
    currentSpeedRef,
    leftActivityIdRef,
    rightActivityIdRef,
    minuteAccumulatorRef,
    card1InsertedRef,
    card2InsertedRef,
    card1DataRef,
    card2DataRef,
    isMultiManningRef,
    virtualLocationRef,
    ferryTrainModeActiveRef,
    setFerryTrainModeActiveRef,
    drivingMsSinceLastGpsRecordRef,
    drivingSinceLastGpsMsRef,
    setSecondHistory,
    setActivityHistory,
    setCardActivityHistoryByTemplateId,
    setRecordedGpsLocations,
    recordDddMinuteRef,
  })
  /** Země zjištěná při průjezdu hranic – použije se jako výchozí v nabídce zadání výchozí země */
  const detectedBorderCountryCodeRef = useRef<string | null>(null)

  const {
    menuCountryInputState,
    openMenuCountryInput,
    cancelMenuCountryInput,
    returnToParentMenu,
    handleMenuCountryInputKey,
  } = useMenuCountryInput({
    countries,
    simulatedUtcTimeRef,
    virtualLocationRef,
    detectedBorderCountryCodeRef,
    setCurrentMenuPath,
    setSelectedIndex,
    setDriver1ManualEntryBuffer,
    setDriver2ManualEntryBuffer,
    setRecordedGpsLocations,
  })

  const {
    menuLoadUnloadConfirmState,
    confirmMenuLoadUnload,
    leaveMenuLoadUnloadByBack,
    leaveMenuLoadUnloadByStop,
    cancelMenuLoadUnload,
  } = useMenuLoadUnload({
    t,
    addEntry,
    simulatedUtcTimeRef,
    virtualLocationRef,
    setCurrentMenuPath,
    setSelectedIndex,
    setVehicleLoadUnloadEvents,
    setRecordedGpsLocations,
  })

  /** Před fyzickým vysunutím karty: zapiš obsah aktuální minuty z akumulátoru do historie obou karet (je-li vložena). */
  const flushActivitiesToCardBeforeEject = useCallback((_slot: 1 | 2) => {
    const acc = minuteAccumulatorRef.current
    if (!acc || acc.secondsInMinute === 0) return
    const pickWinner = (counts: Record<ActivityKind, number>, last: ActivityKind): ActivityKind => {
      let max = 0
      let candidates: ActivityKind[] = []
      ;(Object.keys(counts) as ActivityKind[]).forEach((k) => {
        const v = counts[k] ?? 0
        if (v > max) {
          max = v
          candidates = [k]
        } else if (v === max) candidates.push(k)
      })
      if (max === 0) return 'none'
      /* Pravidlo jedné minuty: aktivita se započte jen když v minutě trvá více než 31 s (≥ 32 s). */
      if (max <= 31) return 'none'
      if (candidates.length === 1) return candidates[0]
      return candidates.includes(last) ? last : candidates[0]
    }
    const driver1Winner = pickWinner(acc.counts.driver1, acc.lastActivity.driver1)
    const driver2Winner = pickWinner(acc.counts.driver2, acc.lastActivity.driver2)
    const c1Inserted = card1InsertedRef.current
    const c2Inserted = card2InsertedRef.current
    const tid1 = card1DataRef.current?.templateId
    const tid2 = card2DataRef.current?.templateId
    const number1 = card1DataRef.current?.cardNumber
    const number2 = card2DataRef.current?.cardNumber
    const entry: ActivityHistoryEntry = {
      minuteStartUtc: acc.minuteStartUtc,
      isCrew: isMultiManningRef.current,
      driver1: driver1Winner,
      driver2: driver2Winner,
      gpsLocation: virtualLocationRef.current?.name,
      driver1CardId: insertedCardId(c1Inserted, number1, tid1),
      driver2CardId: insertedCardId(c2Inserted, number2, tid2),
    }
    setActivityHistory((prev) => [...prev, entry])
    if (c1Inserted && tid1) {
      setCardActivityHistoryByTemplateId((p) => {
        const arr = p[tid1] ?? []
        if (arr.some((e) => e.minuteStartUtc === entry.minuteStartUtc)) return p
        const newArr = [...arr, entry]
        if (tid1 === CARD1_TEMPLATE_ID) saveCard1ActivityHistory(newArr)
        else if (tid1 === CARD2_TEMPLATE_ID) saveCard2ActivityHistory(newArr)
        return { ...p, [tid1]: newArr }
      })
    }
    if (c2Inserted && tid2) {
      setCardActivityHistoryByTemplateId((p) => {
        const arr = p[tid2] ?? []
        if (arr.some((e) => e.minuteStartUtc === entry.minuteStartUtc)) return p
        const newArr = [...arr, entry]
        if (tid2 === CARD1_TEMPLATE_ID) saveCard1ActivityHistory(newArr)
        else if (tid2 === CARD2_TEMPLATE_ID) saveCard2ActivityHistory(newArr)
        return { ...p, [tid2]: newArr }
      })
    }
    if (c1Inserted && number1) recordDddMinuteRef.current(number1, entry)
    if (c2Inserted && number2) recordDddMinuteRef.current(number2, entry)
    acc.secondsInMinute = 0
    acc.counts.driver1 = { driving: 0, rest: 0, otherWork: 0, availability: 0, none: 0 }
    acc.counts.driver2 = { driving: 0, rest: 0, otherWork: 0, availability: 0, none: 0 }
  }, [])

  flushActivitiesToCardBeforeEjectRef.current = flushActivitiesToCardBeforeEject

  // Centralizovaný stav tachografu – pro snadné předávání do pod-komponent
  const tachoState: TachoState = useMemo(
    () => ({
      targetSpeed,
      currentSpeed,
      odometerKm,
      ignitionOn,
      card1Inserted,
      card2Inserted,
      isMultiManning,
      leftActivityId,
      rightActivityId,
      companyCardInserted,
      controlCardInserted,
      optionalFeatureEnabled,
      vdoLinkConnected,
      ferryTrainModeActive,
      outModeActive,
    }),
    [
      targetSpeed, currentSpeed, odometerKm, ignitionOn,
      card1Inserted, card2Inserted, isMultiManning, leftActivityId, rightActivityId,
      companyCardInserted, controlCardInserted, optionalFeatureEnabled, vdoLinkConnected,
      ferryTrainModeActive, outModeActive,
    ],
  )

  // Uložení centralizovaného stavu jako data atributu pro ladění / budoucí použití
  const tachoStateJson = useMemo(() => JSON.stringify(tachoState), [tachoState])

  const [virtualLocation, setVirtualLocation] = useState<VirtualRoutePoint>(() =>
    getVirtualLocationForDistance(0),
  )
  virtualLocationRef.current = virtualLocation
  currentLocationCountryCodeRefForWizard.current = virtualLocation?.country ?? null

  // JSON pro ladění a případné využití ve vnějším nástroji
  const faultsAndEventsJson = useMemo(() => JSON.stringify(faultsAndEvents), [faultsAndEvents])

  const currentMenuId = currentMenuPath[currentMenuPath.length - 1]
  const currentMenu = menusById[currentMenuId]
  const items = currentMenu?.items ?? []
  const visibleItems = useMemo(
    () => visibleMenuItems(items, tachoState),
    [items, tachoState],
  )
  const selectedItem = visibleItems[selectedIndex] ?? visibleItems[0]
  const canGoBack = currentMenuPath.length > 1

  // Když je menu prázdné (žádná položka nesplňuje podmínky), návrat na MAIN_LEVEL
  useEffect(() => {
    if (displayMode !== 'menu') return
    if (visibleItems.length > 0) return
    const root = enterMenuRoot()
    setCurrentMenuPath(root.path)
    setSelectedIndex(root.index)
  }, [displayMode, visibleItems.length])

  // Držet selectedIndex v mezích po změně visibleItems
  useEffect(() => {
    if (visibleItems.length === 0) return
    setSelectedIndex((prev) => clampMenuIndex(prev, visibleItems.length))
  }, [visibleItems.length])

  // Při zapnutí zapalování zruš probuzení ze Standby
  useEffect(() => {
    if (ignitionOn) {
      setDisplayAwakeFromStandby(false)
      if (displayAwakeTimeoutRef.current) {
        clearTimeout(displayAwakeTimeoutRef.current)
        displayAwakeTimeoutRef.current = null
      }
    }
  }, [ignitionOn])

  // Detekce chybějící karty při startu: ihned po START zkontroluj slot 1,
  // pokud není karta, aktivuj výstrahu. Hláška se skryje po OK nebo vložení karty.
  // Persistence: po OK se neobjeví znovu až do dalšího cyklu STOP/START.
  // Hláška "!karta" se objeví až po zapnutí zapalování (pokud není vložena karta).
  useEffect(() => {
    if (!ignitionOn) {
      ignitionWarningDismissedRef.current = false
      return
    }
    if (card1Inserted) {
      setIgnitionWarningActive(false)
      return
    }
    if (ignitionWarningDismissedRef.current) return
    setIgnitionWarningActive(true)
  }, [ignitionOn, card1Inserted])

  // Režim trajekt: konec při vytažení karty
  useEffect(() => {
    if (!card1Inserted && !card2Inserted && ferryTrainModeActive) {
      const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
      const gpsStr = virtualLocationRef.current?.name
      setFerryTrainEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'deactivation' }])
      setFerryTrainModeActive(false)
    }
  }, [card1Inserted, card2Inserted, ferryTrainModeActive])

  // Režim OUT: konec jen při vytažení poslední karty (přechod z „byla karta“ na „žádná“), ne když už žádná karta není a uživatel OUT právě zapnul
  const hadCardBeforeRef = useRef(card1Inserted || card2Inserted)
  useEffect(() => {
    const hadCardBefore = hadCardBeforeRef.current
    const hasCardNow = card1Inserted || card2Inserted
    hadCardBeforeRef.current = hasCardNow
    if (hadCardBefore && !hasCardNow && outModeActive) {
      const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
      const gpsStr = virtualLocationRef.current?.name
      setOutModeEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'deactivation' }])
      setOutModeActive(false)
    }
  }, [card1Inserted, card2Inserted, outModeActive])

  /** Kdykoli je aktivní režim OUT, výstraha „jízda bez karty“ se nesmí zobrazovat – ihned ji zruš. */
  useEffect(() => {
    if (outModeActive) {
      setDrivingWithoutCardWarningActive(false)
    }
  }, [outModeActive])

  // Jízda bez vložené karty – původní tachoEvents zachováme jen pro případné budoucí rozšíření

  // Aktualizace virtuální polohy na trase podle ujetých km + GPS razítka při změně země
  useEffect(() => {
    const distanceFromStartKm = Math.max(0, odometerKm - ODOMETER_KM)
    const newLocation = getVirtualLocationForDistance(distanceFromStartKm)
    const prev = virtualLocationRef.current
    setVirtualLocation(newLocation)

    // Změna země (např. CZ -> AT) => GPS razítko + uložení pro nabídku výchozí země
      if (prev && prev.country !== newLocation.country) {
      detectedBorderCountryCodeRef.current = newLocation.country
      const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
      setRecordedGpsLocations((r) => [...r, { minuteStartUtc, gpsLocation: newLocation.name, recordType: 'border_crossing' }])
      const speedNow = currentSpeedRef.current
      const isDrivingNow = speedNow > 0
      const leftCharNow = isDrivingNow ? DRIVING_SYMBOL : getActivityCode(leftActivityIdRef.current)
      const rightCharNow = isDrivingNow ? getActivityCode('AVAILABILITY') : getActivityCode(rightActivityIdRef.current)
      const driver1Activity = activityFromChar(leftCharNow)
      const driver2Activity = activityFromChar(rightCharNow)
      const c1Inserted = card1InsertedRef.current
      const c2Inserted = card2InsertedRef.current
      const tid1 = card1DataRef.current?.templateId
      const tid2 = card2DataRef.current?.templateId

      const entry: ActivityHistoryEntry = {
        minuteStartUtc,
        driver1: driver1Activity,
        driver2: driver2Activity,
        gpsLocation: newLocation.name,
        driver1CardId: c1Inserted && tid1 ? tid1 : NO_CARD,
        driver2CardId: c2Inserted && tid2 ? tid2 : NO_CARD,
      }
      setActivityHistory((prevHistory) => [...prevHistory, entry])
      if (c1Inserted && tid1) {
        setCardActivityHistoryByTemplateId((p) => ({ ...p, [tid1]: [...(p[tid1] ?? []), entry] }))
      }
      if (c2Inserted && tid2) {
        setCardActivityHistoryByTemplateId((p) => ({ ...p, [tid2]: [...(p[tid2] ?? []), entry] }))
      }

      // po GPS razítku kvůli změně země neovlivňujeme 3h kumulovanou jízdu
    }
  }, [odometerKm])

  const trackOverspeed = useCallback((speed: number, atUtc: number, elapsedMs: number) => {
    const previous = overspeedRunRef.current
    const next = advanceOverspeed(previous, speed, atUtc, elapsedMs,
      card1InsertedRef.current ? card1DataRef.current : null)
    overspeedRunRef.current = next

    if (qualifiesAsOverspeed(next) && !qualifiesAsOverspeed(previous)) {
      setExcessSpeedWarningActive(true)
    }
    if (!next && qualifiesAsOverspeed(previous)) {
      const { startUtc, elapsedMs: durationMs, speedTime, maxKmh, driver } = previous
      const id = crypto.randomUUID()
      setFaultsAndEvents(records => [...records, {
        id, timestampUtc: startUtc, endUtc: atUtc, kind: 'event', type: 'EXCESS_SPEED_WARNING',
        overspeed: { durationMs, maxKmh, averageKmh: speedTime / durationMs, driver },
      }])
    }
  }, [])

  useDrivingInterval({
    outModeActiveRef,
    activeNoCardIdRef,
    ignitionOnRef,
    targetSpeedRef,
    currentSpeedRef,
    odometerKmRef,
    virtualLocationRef,
    trackOverspeed,
    simulatedUtcTimeRef,
    ferryTrainModeActiveRef,
    ferryDrivingMsRef,
    setFerryTrainModeActiveRef,
    card1InsertedRef,
    leftActivityIdRef,
    rightActivityIdRef,
    drivingSinceLastBreakMsByDriverRef,
    restSinceLastBreakMsByDriverRef,
    splitFirstPartTakenByDriverRef,
    breakWarning415DismissedRef,
    breakWarning430DismissedRef,
    prevLeftCharRef,
    prevRightCharRef,
    setDrivingWithoutCardWarningActive,
    setCurrentSpeed,
    setOdometerKm,
    setFaultsAndEvents,
    setFerryTrainEvents,
    setEventLog,
    setSplitFirstPartTakenByDriver,
    setBreakWarningActive,
    setActivityDurationsMs,
    setDrivingSinceLastBreakMsByDriver,
    setRestSinceLastBreakMsByDriver,
  })

  // Při vypnutí zapalování zrušit zvýraznění šachty a resetovat varování pracovní doby
  useEffect(() => {
    if (!ignitionOn) {
      setDragOverSlot(null)
      setCardWithdrawalState(null)
      cancelMenuCountryInput()
      setExcessSpeedWarningActive(false)
      drivingSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
      restSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
      splitFirstPartTakenByDriverRef.current = { 1: false, 2: false }
      breakWarning415DismissedRef.current = false
      breakWarning430DismissedRef.current = false
      setDrivingSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
      setRestSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
      setSplitFirstPartTakenByDriver({ 1: false, 2: false })
      setBreakWarningActive(null)
      WorkShift.resetWorkShift()
    }
  }, [ignitionOn])

  const handlePrintWizardKey = useCallback((action: 'up' | 'down' | 'ok' | 'back') => {
    setPrintWizardState((prev) => applyPrintWizardKey(prev, action, {
      setCurrentMenuPath,
      openPrintVDiagram: printState.openPrintVDiagram,
      openPrintDriverCard: printState.openPrintDriverCard,
      openPrintDriverActivities: printState.openPrintDriverActivities,
      openPrintVehicleEvents: printState.openPrintVehicleEvents,
      openPrintVehicle24h: printState.openPrintVehicle24h,
    }))
  }, [printState])

  const isPrintoutActive = printState.isPrintoutActive

  /** Pomocná funkce pro detail logu při Stisk OK v průvodci vložením karty */
  const getCardInsertionOkDetail = useCallback(
    (cs: CardInsertionState, countriesList: CountryEntry[], spanishRegionsList: CountryEntry[]): string | undefined => {
      const pad = (n: number) => String(n).padStart(2, '0')
      const startCountry = t.manualEntry.startCountry
      const endCountry = t.manualEntry.endCountry
      if (cs.phase === 'manualEditor' && cs.selectingCountryForStamp && cs.stampActivityId) {
        const code =
          cs.selectingSpanishRegion && spanishRegionsList.length > 0
            ? (spanishRegionsList[cs.spanishRegionIndex]?.code ?? '')
            : (countriesList[cs.countryIndex]?.code ?? 'CZ')
        const typ = cs.stampActivityId === 'START_COUNTRY' ? startCountry : endCountry
        return `razítko ${typ} ${code}`
      }
      if (cs.phase === 'manualEditor' && !cs.selectingCountryForStamp) {
        const seg = cs.currentSegment
        const idx = EDITOR_FIELD_ORDER.indexOf(cs.editorBlinkField)
        const nextField = EDITOR_FIELD_ORDER[idx + 1]
        const isCountryStamp = seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY'
        if (isCountryStamp) {
          const typ = seg.activityId === 'START_COUNTRY' ? startCountry : endCountry
          return `přechod na výběr razítka ${typ}`
        }
        if (!nextField) {
          const act = ACTIVITY_SYMBOLS.find((a) => a.id === seg.activityId)
          const label = t.workWeek.activityLabels[seg.activityId] ?? act?.label ?? seg.activityId
          return `segment ${label} ${pad(seg.day)}.${pad(seg.month)}. ${pad(seg.hour)}:${pad(seg.minute)}`
        }
        if (cs.awaitingMaxTimeConfirm && cs.pendingMaxTimeSegment) {
          const s = cs.pendingMaxTimeSegment
          const act = ACTIVITY_SYMBOLS.find((a) => a.id === seg.activityId)
          const label = t.workWeek.activityLabels[seg.activityId] ?? act?.label ?? seg.activityId
          return `segment ${label} ${pad(s.day)}.${pad(s.month)}. ${pad(s.hour)}:${pad(s.minute)}`
        }
      }
      if (cs.phase === 'country') {
        const code =
          cs.selectingSpanishRegion && spanishRegionsList.length > 0
            ? (spanishRegionsList[cs.spanishRegionIndex]?.code ?? '')
            : (countriesList[cs.countryIndex]?.code ?? 'CZ')
        return `${startCountry} ${code}`
      }
      if (cs.phase === 'finalConfirm' && cs.finalConfirmYes) {
        const buf = cs.manualEntryBuffer ?? []
        const segmentCount = buf.filter((s) => s.activityId !== 'START_COUNTRY' && s.activityId !== 'END_COUNTRY').length
        const stampCount = buf.filter((s) => s.activityId === 'START_COUNTRY' || s.activityId === 'END_COUNTRY').length
        const parts: string[] = []
        if (segmentCount > 0) parts.push(segmentCount === 1 ? t.manualEntry.segment : `${segmentCount} ${t.manualEntry.segments}`)
        if (stampCount > 0) parts.push(stampCount === 1 ? t.manualEntry.stamp : `${stampCount} ${t.manualEntry.stamps}`)
        return parts.length > 0 ? `${t.manualEntry.fullManualRecord} (${parts.join(', ')})` : t.manualEntry.fullManualRecord
      }
      return undefined
    },
    [t],
  )

  const STANDBY_WAKE_TIMEOUT_MS = 120_000 /* 2 minuty bez aktivity → návrat do Standby */

  const wakeDisplayFromStandby = useCallback(() => {
    setDisplayAwakeFromStandby(true)
    if (displayAwakeTimeoutRef.current) clearTimeout(displayAwakeTimeoutRef.current)
    displayAwakeTimeoutRef.current = setTimeout(() => {
      setDisplayAwakeFromStandby(false)
      displayAwakeTimeoutRef.current = null
    }, STANDBY_WAKE_TIMEOUT_MS)
  }, [])

  const browseOperatingTimes = useCallback((direction: 'down' | 'up') => {
    const entryContext = {
      vdoCounterActive: true,
      card1Inserted,
      isMultiManning,
      ferryTrainModeActive: tachoState.ferryTrainModeActive,
      outModeActive,
      templateId: card1Data?.templateId,
      cardNumber: card1Data?.cardNumber,
      card2Inserted,
      slot2TemplateId: card2Data?.templateId,
      slot2CardNumber: card2Data?.cardNumber,
      speed: currentSpeed,
      leftActivityId,
      rightActivityId,
    }
    const sequence = buildTimesSequence({
      moving: currentSpeed > 0,
      card1: card1Inserted,
      card2: card2Inserted,
      counterOn: true,
      ferry: tachoState.ferryTrainModeActive,
      entry: {
        1: vdo24hEntryAvailable({ ...entryContext, operatingScreenIndex: 0 }),
        2: vdo24hEntryAvailable({ ...entryContext, operatingScreenIndex: 1 }),
      },
    })
    const next = stepTimesLocation(
      timesLocationFrom(vdoCounterActive, vdoNamedScreen, operatingScreenIndex),
      direction,
      sequence,
    )
    if (next.kind === 'standard') {
      setVdoCounterActive(false)
      setVdoNamedScreen(null)
      return
    }
    setVdoCounterActive(true)
    if (next.kind === 'info') {
      setVdoNamedScreen(null)
      setOperatingScreenIndex(next.index)
      return
    }
    if (next.kind === 'driveRest') {
      setVdoNamedScreen('driveRest')
      return
    }
    if (next.kind === 'workTime') {
      setVdoNamedScreen('workTime')
      setOperatingScreenIndex(card1Inserted ? 0 : 1)
      return
    }
    setOperatingScreenIndex(next.slot === 1 ? 0 : 1)
    setVdoNamedScreen(next.kind === 'counter' ? null : next.kind === 'card' ? 'vdoCard' : next.kind)
  }, [card1Inserted, card2Inserted, isMultiManning, tachoState.ferryTrainModeActive, outModeActive, card1Data, card2Data, currentSpeed, leftActivityId, rightActivityId, vdoCounterActive, vdoNamedScreen, operatingScreenIndex])

  const handleUp = useCallback(() => {
    if (!ignitionOn) {
      wakeDisplayFromStandby()
      if (!displayAwakeFromStandby) return
    }
    if (isPrintoutActive) return
    if (menuCountryInputState?.phase === 'confirmSaved' || menuLoadUnloadConfirmState) return
    if (cardInsertionState) {
      handleCardInsertionKey('up')
      return
    }
    if (cardWithdrawalState) {
      handleCardWithdrawalKey('up')
      return
    }
    if (printWizardState) {
      handlePrintWizardKey('up')
      return
    }
    if (drivingWithoutCardWarningActive || drivingWithoutValidCardWarningActive || ignitionWarningActive || excessSpeedWarningActive || ejectionBlockedWarningActive) return
    if (menuCountryInputState) {
      handleMenuCountryInputKey('up')
      return
    }
    if (displayMode === 'operating') {
      if (!card1Inserted && !card2Inserted) return
      browseOperatingTimes('up')
      return
    }
    if (visibleItems.length === 0) return
    setSelectedIndex((prev) => stepMenuIndex(prev, visibleItems.length, 'up'))
  }, [ignitionOn, wakeDisplayFromStandby, displayMode, card1Inserted, card2Inserted, visibleItems.length, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, menuLoadUnloadConfirmState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, ignitionWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, isPrintoutActive, browseOperatingTimes])

  const handleDown = useCallback(() => {
    if (!ignitionOn) {
      wakeDisplayFromStandby()
      if (!displayAwakeFromStandby) return
    }
    if (isPrintoutActive) return
    if (menuCountryInputState?.phase === 'confirmSaved' || menuLoadUnloadConfirmState) return
    if (cardInsertionState) {
      handleCardInsertionKey('down')
      return
    }
    if (cardWithdrawalState) {
      handleCardWithdrawalKey('down')
      return
    }
    if (printWizardState) {
      handlePrintWizardKey('down')
      return
    }
    if (drivingWithoutCardWarningActive || drivingWithoutValidCardWarningActive || ignitionWarningActive || excessSpeedWarningActive || ejectionBlockedWarningActive) return
    if (menuCountryInputState) {
      handleMenuCountryInputKey('down')
      return
    }
    if (displayMode === 'operating') {
      if (!card1Inserted && !card2Inserted) return
      browseOperatingTimes('down')
      return
    }
    if (visibleItems.length === 0) return
    setSelectedIndex((prev) => stepMenuIndex(prev, visibleItems.length, 'down'))
  }, [ignitionOn, wakeDisplayFromStandby, displayMode, card1Inserted, card2Inserted, visibleItems.length, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, menuLoadUnloadConfirmState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, ignitionWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, isPrintoutActive, browseOperatingTimes])

  const handleOK = useCallback(() => {
    if (!ignitionOn) {
      wakeDisplayFromStandby()
      if (!displayAwakeFromStandby) return
    }
    if (isPrintoutActive) return
    /** Bezpečnostní výstrahy – OK nejprve potvrdí výstrahu, až poté průvodce/menu. */
    if (excessSpeedWarningActive) {
      addEntry(t.actions.stiskOk, t.actions.potvrzeniVarovani)
      setExcessSpeedWarningActive(false)
      return
    }
    if (ejectionBlockedWarningActive) {
      addEntry(t.actions.stiskOk, t.actions.potvrzeniVarovani)
      setEjectionBlockedWarningActive(false)
      return
    }
    if (drivingWithoutCardWarningActive) {
      addEntry(t.actions.stiskOk, t.actions.potvrzeniJizdyBezKarty)
      ignitionWarningDismissedRef.current = true
      setIgnitionWarningActive(false)
      setDrivingWithoutCardWarningActive(false)
      setDisplayMode('operating')
      return
    }
    if (drivingWithoutValidCardWarningActive) {
      addEntry(t.actions.stiskOk, t.actions.potvrzeniJizdyBezPlatneKarty)
      setDrivingWithoutValidCardWarningActive(false)
      setDisplayMode('operating')
      return
    }
    if (ignitionWarningActive) {
      addEntry(t.actions.stiskOk, t.actions.potvrzeniVarovaniZapalovani)
      ignitionWarningDismissedRef.current = true
      setIgnitionWarningActive(false)
      return
    }
    if (breakWarningActive) {
      addEntry(t.actions.stiskOk, `${t.actions.potvrzeniVarovaniPrestavky} ${breakWarningActive}`)
      if (breakWarningActive === '415') breakWarning415DismissedRef.current = true
      else breakWarning430DismissedRef.current = true
      setBreakWarningActive(null)
      return
    }
    if (cardInsertionState) {
      const detail = getCardInsertionOkDetail(cardInsertionState, countries, spanishRegions)
      addEntry('Stisk OK', detail)
      handleCardInsertionKey('ok')
      return
    }
    if (cardWithdrawalState?.phase === 'countrySelect') {
      const code = countries[cardWithdrawalState.countryIndex]?.code ?? 'CZ'
      addEntry(t.actions.stiskOk, `${t.manualEntry.endCountry} ${code}`)
      handleCardWithdrawalKey('ok')
      return
    }
    if (cardWithdrawalState?.phase === 'print24hQuestion') {
      const yn = cardWithdrawalState.print24hYes ? t.cardWizard.yes : t.cardWizard.no
      addEntry(t.actions.stiskOk, `${t.actions.vysunutiKartyZeSachty} ${cardWithdrawalState.slot}, 24h ${yn}`)
      handleCardWithdrawalKey('ok')
      return
    }
    if (cardWithdrawalState) {
      addEntry('Stisk OK')
      handleCardWithdrawalKey('ok')
      return
    }
    if (printWizardState) {
      addEntry('Stisk OK')
      handlePrintWizardKey('ok')
      return
    }
    if (menuCountryInputState?.phase === 'confirmSaved' || menuLoadUnloadConfirmState) return
    if (menuCountryInputState?.phase === 'selecting') {
      const code = countries[menuCountryInputState.countryIndex]?.code ?? 'CZ'
      const typ = menuCountryInputState.type === 'start' ? t.manualEntry.startCountry : t.manualEntry.endCountry
      addEntry(t.actions.stiskOk, `${t.actions.ulozenaZeme} ${typ} ${code} (menu)`)
      handleMenuCountryInputKey('ok')
      return
    }
    if (overrideWarningCode) {
      addEntry(t.actions.stiskOk, t.actions.potvrzeniVarovani)
      setOverrideWarningCode(null)
      return
    }
    if (displayMode === 'operating') {
      if (currentSpeed > 0) return /* při jízdě menu tlačítkem OK nevyvolat */
      addEntry(t.actions.stiskOk, t.actions.vstupDoMenu)
      setVdoCounterActive(false)
      setDisplayMode('menu')
      const root = enterMenuRoot()
      setCurrentMenuPath(root.path)
      setSelectedIndex(root.index)
      return
    }
    if (!selectedItem) return
    if (selectedItem.sub_menu && menusById[selectedItem.sub_menu]) {
      addEntry(t.actions.stiskOk, `${t.actions.vstupDoPodmenu} ${selectedItem.line2 ?? selectedItem.sub_menu}`)
      const submenuId = selectedItem.sub_menu!
      setCurrentMenuPath((path) => enterSubmenu(path, submenuId).path)
      setSelectedIndex(enterSubmenu(currentMenuPath, submenuId).index)
      return
    }
    if (selectedItem.action) {
      const item = selectedItem as import('./MenuStructure').MenuItem & { requiresDate?: boolean; requiresUtcConfirm?: boolean }
      const printSlot = driverPrintSlot(selectedItem.action)
      const printCard = printSlot === 1 && card1InsertedRef.current ? card1DataRef.current
        : printSlot === 2 && card2InsertedRef.current ? card2DataRef.current : null
      const printDdd = printCard?.cardNumber ? dddCardsRef.current[printCard.cardNumber] : undefined
      const printCardId = printCard?.templateId ?? printCard?.cardNumber
      const printAction = resolvePrintMenuAction({
        action: selectedItem.action,
        line2: selectedItem.line2,
        requiresDate: item.requiresDate === true,
        requiresUtcConfirm: item.requiresUtcConfirm === true,
        secondHistory,
        simulatedUtcTime,
        currentMenuPath,
        vehicleActivities: activityHistory,
        cardActivities: printSlot && printCardId
          ? [
            ...(printDdd?.original.activities ?? []),
            ...simulatedPrintCardActivities(
              printDdd?.workingActivities ?? cardActivityHistoryByTemplateIdRef.current[printCardId] ?? [],
              printCardId, simulatedUtcTime, printSlot,
            ),
          ]
          : [],
      })
      if (printAction?.type === 'dateWizard') {
        addEntry(t.actions.stiskOk, `${t.actions.vyberDataProTisk} ${selectedItem.line2 ?? selectedItem.action}`)
        setPrintWizardState(printAction.state)
        return
      }
      if (printAction?.type === 'openDriver1') {
        addEntry(t.actions.stiskOk, `${t.actions.tiskRidic1} ${selectedItem.line2 ?? selectedItem.action}`)
        printState.openPrintDriverCard(null)
        return
      }
      if (printAction?.type === 'openVDiagram') {
        addEntry(t.actions.stiskOk, t.actions.tiskVDiagram)
        printState.openPrintVDiagram()
        return
      }
      if (printAction?.type === 'openSpeed') {
        addEntry(t.actions.stiskOk, `${t.actions.tiskVozidlo} ${selectedItem.line2 ?? ''}`)
        printState.openPrintSpeedVehicle()
        return
      }
      if (selectedItem.action === 'INPUT_START_COUNTRY' || selectedItem.action === 'INPUT_END_COUNTRY') {
        addEntry(t.actions.stiskOk, selectedItem.action === 'INPUT_START_COUNTRY' ? t.actions.otevreniZadaniStart : t.actions.otevreniZadaniEnd)
        openMenuCountryInput(selectedItem.action, currentMenuPath)
        return
      }
      if (selectedItem.action === 'ACTION_LOAD' || selectedItem.action === 'ACTION_UNLOAD' || selectedItem.action === 'ACTION_LOAD_UNLOAD_BOTH') {
        confirmMenuLoadUnload(selectedItem.action, currentMenuPath)
        return
      }
      if (selectedItem.action === 'MODE_FERRY_START') {
        addEntry(t.actions.stiskOk, t.ui.ferryModeStart)
        const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
        const gpsStr = virtualLocationRef.current?.name
        setFerryTrainEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'activation' }])
        setFerryTrainModeActive(true)
        ferryDrivingMsRef.current = 0
        setDisplayMode('operating')
        setCurrentMenuPath([ENTRY_MENU_ID])
        return
      }
      if (selectedItem.action === 'MODE_FERRY_END') {
        addEntry(t.actions.stiskOk, t.ui.ferryModeEnd)
        const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
        const gpsStr = virtualLocationRef.current?.name
        setFerryTrainEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'deactivation' }])
        setFerryTrainModeActive(false)
        setDisplayMode('operating')
        setCurrentMenuPath([ENTRY_MENU_ID])
        return
      }
      if (selectedItem.action === 'MODE_OUT_START') {
        addEntry(t.actions.stiskOk, t.ui.outModeStart)
        const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
        const gpsStr = virtualLocationRef.current?.name
        setOutModeEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'activation' }])
        outModeActiveRef.current = true
        setOutModeActive(true)
        setHasDrivenSinceOutActivation(false)
        setDrivingWithoutCardWarningActive(false)
        if (currentSpeedRef.current <= SPEED_STOPPED_THRESHOLD_KMH) {
          leftActivityIdRef.current = 'WORK'
          setLeftActivityId('WORK')
        }
        setDisplayMode('operating')
        setCurrentMenuPath([ENTRY_MENU_ID])
        return
      }
      if (selectedItem.action === 'MODE_OUT_END') {
        addEntry(t.actions.stiskOk, t.ui.outModeEnd)
        const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
        const gpsStr = virtualLocationRef.current?.name
        setOutModeEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'deactivation' }])
        setOutModeActive(false)
        setDisplayMode('operating')
        setCurrentMenuPath([ENTRY_MENU_ID])
        return
      }
      setMenuComingSoonInfo({ id: `menu-coming-soon-${Date.now()}` })
      addEntry(t.actions.stiskOk, t.infoPanel.menuComingSoon)
      return
    }
    setMenuComingSoonInfo({ id: `menu-coming-soon-${Date.now()}` })
    addEntry(t.actions.stiskOk, t.infoPanel.menuComingSoon)
  }, [t, ignitionOn, wakeDisplayFromStandby, displayMode, currentSpeed, selectedItem, menusById, currentMenuPath, countries, spanishRegions, secondHistory, activityHistory, simulatedUtcTime, overrideWarningCode, drivingWithoutCardWarningActive, ignitionWarningActive, breakWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, openMenuCountryInput, confirmMenuLoadUnload, isPrintoutActive, printState, addEntry, getCardInsertionOkDetail])

  const handleBack = useCallback(() => {
    if (!ignitionOn) {
      wakeDisplayFromStandby()
      if (!displayAwakeFromStandby) return
    }
    if (isPrintoutActive) {
      addEntry(t.actions.stiskZpet, t.actions.zavreniTisku)
      printState.closeAll()
      return
    }
    if (overrideWarningCode) {
      addEntry(t.actions.stiskZpet, t.actions.zruseniVarovani)
      setOverrideWarningCode(null)
      return
    }
    if (cardInsertionState) {
      addEntry(t.actions.stiskZpet)
      handleCardInsertionKey('back')
      return
    }
    if (cardWithdrawalState) {
      addEntry(t.actions.stiskZpet, cardWithdrawalState.phase === 'countrySelect' ? t.actions.vysunutiKartyBezCilove : undefined)
      handleCardWithdrawalKey('back')
      return
    }
    if (printWizardState) {
      addEntry(t.actions.stiskZpet, t.actions.navratVPrivodciTiskem)
      handlePrintWizardKey('back')
      return
    }
    if (drivingWithoutCardWarningActive || drivingWithoutValidCardWarningActive || ignitionWarningActive || excessSpeedWarningActive || ejectionBlockedWarningActive) return
    if (menuCountryInputState) {
      addEntry(t.actions.stiskZpet, t.actions.navratZeZadaniZeme)
      handleMenuCountryInputKey('back')
      return
    }
    if (menuLoadUnloadConfirmState) {
      addEntry(t.actions.stiskZpet, t.actions.navratZPotvrzeniNakladky)
      leaveMenuLoadUnloadByBack()
      return
    }
    if (displayMode === 'operating' && vdoCounterActive) {
      addEntry(t.actions.stiskZpet, t.actions.opusteniVdoPrehledu)
      setVdoCounterActive(false)
      setVdoNamedScreen(null)
      return
    }
    if (displayMode === 'menu' && !canGoBack) {
      addEntry(t.actions.stiskZpet, t.actions.navratNaProvozni)
      setDisplayMode('operating')
      return
    }
    if (canGoBack) {
      addEntry(t.actions.stiskZpet, t.actions.navratVMenu)
      setCurrentMenuPath((path) => leaveSubmenu(path).path)
      setSelectedIndex(leaveSubmenu(currentMenuPath).index)
    }
  }, [t, ignitionOn, wakeDisplayFromStandby, displayMode, canGoBack, vdoCounterActive, overrideWarningCode, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, menuLoadUnloadConfirmState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, leaveMenuLoadUnloadByBack, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, ignitionWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, isPrintoutActive, printState, addEntry])

  const cycleLeftActivity = useCallback(() => {
    setLeftActivityId((id) => getNextActivity(id))
  }, [])

  const cycleRightActivity = useCallback(() => {
    setRightActivityId((id) => getNextActivity(id))
  }, [])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearInterval(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleButton1PointerDown = useCallback((e: React.PointerEvent) => {
    if (isPrintoutActive) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    longPressFiredRef.current = false
    clearLongPressTimer()
    longPressStartRef.current = Date.now()
    longPressTimerRef.current = setInterval(() => {
      if (Date.now() - longPressStartRef.current >= CARD_EJECT_HOLD_MS) {
        clearLongPressTimer()
        longPressFiredRef.current = true
        addEntry(`${t.actions.podrzeniTlacitka} 1 - ${t.actions.vysunutiKartyZeSachty} 1`)
        const cardData = card1DataRef.current
        const moving = currentSpeedRef.current > 0
        if (cardData && !cardInsertionStateRef.current && !cardWithdrawalStateRef.current && !moving) {
          const routeToTachographCode: Record<string, string> = { CZ: 'CZ', AT: 'A', DE: 'D', CH: 'CH', FR: 'F', ES: 'E' }
          const gpsCountry = virtualLocationRef.current?.country ?? 'CZ'
          const countryCode = routeToTachographCode[gpsCountry] ?? gpsCountry
          const countryIndex = Math.max(0, countriesRef.current.findIndex((c) => c.code === countryCode))
          setCardWithdrawalState({
            slot: 1,
            phase: 'bargraf',
            phaseStartTime: Date.now(),
            cardName: cardData.name,
            cardSurname: cardData.surname,
            countryIndex,
            cardData,
          })
        } else if (cardData && moving) {
          setEjectionBlockedWarningActive(true)
          /* karta zůstane v tachografu – výhoz se neprovede */
        } else {
          runEjectForSlot(1)
        }
      }
    }, 100)
  }, [t, clearLongPressTimer, runEjectForSlot, isPrintoutActive, addEntry])

  const handleButton1PointerUp = useCallback(() => {
    if (isPrintoutActive) return
    clearLongPressTimer()
    if (!longPressFiredRef.current && currentSpeedRef.current <= 0) {
      addEntry(`${t.actions.stiskTlacitkaPrepnuti} vlevo`)
      cycleLeftActivity()
    }
  }, [clearLongPressTimer, cycleLeftActivity, isPrintoutActive, addEntry])

  const handleButton2PointerDown = useCallback((e: React.PointerEvent) => {
    if (isPrintoutActive) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    longPressFiredRef.current = false
    clearLongPressTimer()
    longPressStartRef.current = Date.now()
    longPressTimerRef.current = setInterval(() => {
      if (Date.now() - longPressStartRef.current >= CARD_EJECT_HOLD_MS) {
        clearLongPressTimer()
        longPressFiredRef.current = true
        addEntry(`${t.actions.podrzeniTlacitka} 2 - ${t.actions.vysunutiKartyZeSachty} 2`)
        const cardData = card2DataRef.current
        const moving = currentSpeedRef.current > 0
        if (cardData && !cardInsertionStateRef.current && !cardWithdrawalStateRef.current && !moving) {
          const routeToTachographCode: Record<string, string> = { CZ: 'CZ', AT: 'A', DE: 'D', CH: 'CH', FR: 'F', ES: 'E' }
          const gpsCountry = virtualLocationRef.current?.country ?? 'CZ'
          const countryCode = routeToTachographCode[gpsCountry] ?? gpsCountry
          const countryIndex = Math.max(0, countriesRef.current.findIndex((c) => c.code === countryCode))
          setCardWithdrawalState({
            slot: 2,
            phase: 'bargraf',
            phaseStartTime: Date.now(),
            cardName: cardData.name,
            cardSurname: cardData.surname,
            countryIndex,
            cardData,
          })
        } else if (cardData && moving) {
          setEjectionBlockedWarningActive(true)
          /* karta zůstane v tachografu – výhoz se neprovede */
        } else {
          runEjectForSlot(2)
        }
      }
    }, 100)
  }, [t, clearLongPressTimer, runEjectForSlot, isPrintoutActive, addEntry])

  const handleButton2PointerUp = useCallback(() => {
    if (isPrintoutActive) return
    clearLongPressTimer()
    if (!longPressFiredRef.current && currentSpeedRef.current <= 0) {
      addEntry(`${t.actions.stiskTlacitkaPrepnuti} vpravo`)
      cycleRightActivity()
    }
  }, [clearLongPressTimer, cycleRightActivity, isPrintoutActive, addEntry])

  const handleCardDragStart = useCallback((e: React.DragEvent, cardId: keyof typeof TEST_CARDS) => {
    e.dataTransfer.setData('card', cardId)
    e.dataTransfer.setData('text/plain', cardId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleSlotDragOver = useCallback((e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault()
    if (!ignitionOn && !displayAwakeFromStandby) return
    if (slot === 1 && card1Data) return
    if (slot === 2 && card2Data) return
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlot(slot)
  }, [ignitionOn, displayAwakeFromStandby, card1Data, card2Data])

  const handleSlotDragLeave = useCallback(() => {
    setDragOverSlot(null)
  }, [])

  const insertCardIntoSlot = useCallback((cardId: string, slot: 1 | 2) => {
    if (!ignitionOn && !displayAwakeFromStandby) return
    if (slot === 1 && card1Data) return
    if (slot === 2 && card2Data) return
    if (cardId.startsWith('ddd:')) {
      const cardNumber = cardId.slice(4)
      const record = dddCardsRef.current[cardNumber]
      if (!record) return
      const other = slot === 1 ? card2Data : card1Data
      const decision = assessDddInsertion({
        record,
        simulatedNowMs: simulatedUtcTimeRef.current,
        otherSlotCardNumber: other?.cardNumber ?? null,
      })
      if (!decision.ok) {
        setDddInsertMessage(decision.message)
        setDragOverSlot(null)
        return
      }
      setDddInsertMessage(null)
      addEntry(`${t.actions.vlozeniKarty} ${record.surname || record.firstName} do slotu ${slot}`)
      const cardData = decision.cardData
      lastCardInsertionKeyPressRef.current = Date.now()
      const skipReadyToDrive = !ignitionOn && displayAwakeFromStandby
      const gpsCountry = virtualLocation?.country ?? undefined
      const wizardOptions = { skipReadyToDriveScreen: skipReadyToDrive, initialCountryCode: gpsCountry, existingManualEntryBuffer: decision.manualBuffer }
      if (slot === 1) {
        setCard1Data(cardData)
        setCard1Inserted(true)
        setDrivingWithoutCardWarningActive(false)
        setCardInsertionState(createInitialCardInsertionState(1, cardData, simulatedUtcTimeRef.current, countries, wizardOptions))
      }
      if (slot === 2) {
        setCard2Data(cardData)
        setCard2Inserted(true)
        setCard2InsertedAt(Date.now())
        setCardInsertionState(createInitialCardInsertionState(2, cardData, simulatedUtcTimeRef.current, countries, wizardOptions))
      }
      setDragOverSlot(null)
      setCardsOpen(false)
      setCardPickerSlot(null)
      return
    }
    const templateIdRaw = cardId as keyof typeof TEST_CARDS | ''
    const template = templateIdRaw && TEST_CARDS[templateIdRaw] ? TEST_CARDS[templateIdRaw] : null
    if (!template) return

    const templateId = templateIdRaw === 'zmizik' || templateIdRaw === 'novak' ? templateIdRaw : undefined
    if ((slot === 1 ? card2Data : card1Data)?.templateId === templateId) return
    addEntry(`${t.actions.vlozeniKarty} ${template.surname ?? template.name} do slotu ${slot}`)
    const cardData = buildDroppedCardData({
      cardId: templateId === 'novak' ? 'novak' : 'zmizik',
      template,
      card1StoredLastWithdrawal: loadCard1LastWithdrawal(),
      card2StoredLastWithdrawal: loadCard2LastWithdrawal(),
      now: new Date(),
      slot,
      otherCard: slot === 1 ? card2Data : card1Data,
      driverState: (templateId && driverCardStateByTemplateId[templateId]) ?? undefined,
      driver1Name: t.ui.driver1,
      driver2Name: t.ui.driver2,
    })
    lastCardInsertionKeyPressRef.current = Date.now()
    const skipReadyToDrive = !ignitionOn && displayAwakeFromStandby
    const gpsCountry = virtualLocation?.country ?? undefined
    if (slot === 1) {
      setCard1Data(cardData)
      setCard1Inserted(true)
      setDrivingWithoutCardWarningActive(false)
      setCardInsertionState(createInitialCardInsertionState(1, cardData, simulatedUtcTime, countries, { skipReadyToDriveScreen: skipReadyToDrive, initialCountryCode: gpsCountry, existingManualEntryBuffer: driver1ManualEntryBuffer }))
    }
    if (slot === 2) {
      setCard2Data(cardData)
      setCard2Inserted(true)
      setCard2InsertedAt(Date.now())
      setCardInsertionState(createInitialCardInsertionState(2, cardData, simulatedUtcTime, countries, { skipReadyToDriveScreen: skipReadyToDrive, initialCountryCode: gpsCountry, existingManualEntryBuffer: driver2ManualEntryBuffer }))
    }
    setDragOverSlot(null)
    setCardsOpen(false)
    setCardPickerSlot(null)
  }, [ignitionOn, displayAwakeFromStandby, simulatedUtcTime, timeOffsetMs, countries, card1Data, card2Data, driverCardStateByTemplateId, driver1ManualEntryBuffer, driver2ManualEntryBuffer, addEntry, setCardInsertionState, virtualLocation])

  const handleSlotDrop = (e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault()
    setCardDragging(false)
    insertCardIntoSlot(e.dataTransfer.getData('card') || e.dataTransfer.getData('text/plain'), slot)
  }
  const openCardPicker = (slot: 1 | 2) => {
    if (slot === 1 ? card1Data : card2Data) return
    setCardPickerSlot(slot)
    setCardsOpen(true)
  }

  const adjustHours = useCallback((delta: number) => {
    lastPanelAdjustmentMsRef.current = Date.now()
    setPanelDateTime((prev) => {
      const next = new Date(prev.getTime() + delta * 3600000)
      if (delta < 0 && next.getTime() < localTime.getTime()) {
        return new Date(localTime.getTime())
      }
      return next
    })
  }, [localTime])

  const adjustMinutes = useCallback((delta: number) => {
    lastPanelAdjustmentMsRef.current = Date.now()
    setPanelDateTime((prev) => {
      const next = new Date(prev.getTime() + delta * 60000)
      if (delta < 0 && next.getTime() < localTime.getTime()) {
        return new Date(localTime.getTime())
      }
      return next
    })
  }, [localTime])

  const handleApplyTime = useCallback(() => {
    // Časové údaje v UTC ms (panel zobrazuje místní čas, getTime() vrací UTC)
    const targetMsUtc = panelDateTime.getTime()
    const shift = clockAfterApplyTime(simulatedUtcTime, timeOffsetMs, targetMsUtc)
    const { deltaMs } = shift

    // Skok zpět – jen přenastavíme offset, nic negenerujeme
    if (deltaMs <= 0) {
      lastPanelAdjustmentMsRef.current = 0
      setTimeOffsetMs(shift.nextTimeOffsetMs)
      return
    }

    /* Posunout simulatedUtcTime dopředu, aby VDO counter a všechny komponenty reagovaly na čas i když je zobrazen main dashboard.
       Ref se nastaví hned, aby sekundový krok neuzavřel ještě starou minutu. */
    minuteAccumulatorRef.current = null
    simulatedUtcTimeRef.current = shift.nextSimulatedUtcMs
    setSimulatedUtcTime(shift.nextSimulatedUtcMs)

    const deltaMinutes = Math.ceil(deltaMs / 60000)

    if (deltaMinutes > 0) {
      const speedNow = currentSpeedRef.current
      const isDrivingNow = speedNow > 0
      const { driver1: driver1Activity, driver2: driver2Activity } = activitiesForApplyTime(
        speedNow,
        leftActivityIdRef.current,
        rightActivityIdRef.current,
      )
      const leftCharNow = isDrivingNow ? DRIVING_SYMBOL : getActivityCode(leftActivityIdRef.current)
      const rightCharNow = isDrivingNow ? getActivityCode('AVAILABILITY') : getActivityCode(rightActivityIdRef.current)

      const c1Inserted = card1InsertedRef.current
      const c2Inserted = card2InsertedRef.current
      const card1 = card1DataRef.current
      const card2 = card2DataRef.current
      const plan = planApplyTimeJump({
        simulatedUtcMs: simulatedUtcTime,
        deltaMs,
        existingMinuteStarts: activityHistory.map((entry) => entry.minuteStartUtc),
        driver1: driver1Activity,
        driver2: driver2Activity,
        slot1: { inserted: c1Inserted, cardNumber: card1?.cardNumber, templateId: card1?.templateId },
        slot2: { inserted: c2Inserted, cardNumber: card2?.cardNumber, templateId: card2?.templateId },
        isCrew: isMultiManningRef.current,
        gpsLocation: virtualLocationRef.current?.name,
      })
      const generated = plan.entries

      if (generated.length > 0) {
        setActivityHistory((prev) => {
          const prevSet = new Set(prev.map((e) => e.minuteStartUtc))
          const filtered = generated.filter((e) => !prevSet.has(e.minuteStartUtc))
          return filtered.length > 0 ? [...prev, ...filtered] : prev
        })
        for (const templateId of plan.templateIds) {
          setCardActivityHistoryByTemplateId((prev) => {
            const arr = prev[templateId] ?? []
            const seen = new Set(arr.map((entry) => entry.minuteStartUtc))
            const added = generated.filter((entry) => !seen.has(entry.minuteStartUtc))
            if (added.length === 0) return prev
            const newArr = [...arr, ...added]
            if (templateId === CARD1_TEMPLATE_ID) saveCard1ActivityHistory(newArr)
            else if (templateId === CARD2_TEMPLATE_ID) saveCard2ActivityHistory(newArr)
            return { ...prev, [templateId]: newArr }
          })
        }
        if (plan.dddCardNumbers.length > 0) {
          setDddCards((prev) => plan.dddCardNumbers.reduce(
            (cards, cardNumber) => appendWorkingMinutes(cards, cardNumber, generated),
            prev,
          ))
        }
      }

      const driverForJump = leftCharNow === DRIVING_SYMBOL ? 1 : rightCharNow === DRIVING_SYMBOL ? 2 : null
      const restDriver = leftCharNow === getActivityCode('REST') ? 1 : rightCharNow === getActivityCode('REST') ? 2 : null
      trackOverspeed(ignitionOnRef.current ? speedNow : 0, simulatedUtcTime, deltaMs)
      // Ujetá vzdálenost za přeskočený čas (pokud byla rychlost > 0)
      if (isDrivingNow && driverForJump) {
        const distanceDeltaKm = (speedNow * deltaMinutes) / 60 // v km
        odometerKmRef.current += distanceDeltaKm
        setOdometerKm((prev) => prev + distanceDeltaKm)
        const distanceFromStartKm = Math.max(0, odometerKmRef.current - ODOMETER_KM)
        virtualLocationRef.current = getVirtualLocationForDistance(distanceFromStartKm)
        drivingSinceLastBreakMsByDriverRef.current[driverForJump] += deltaMs
        // Režim trajekt: při manuálním posunu času s jízdou ≥ 1 min → konec (100ms interval neběžel)
        if (ferryTrainModeActiveRef.current && deltaMs >= 60000) {
          const minuteStartUtc = Math.floor(targetMsUtc / 60000) * 60000
          const gpsStr = virtualLocationRef.current?.name
          setFerryTrainEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'deactivation' }])
          setFerryTrainModeActive(false)
        }
        if (driverForJump === 1) {
          const d = drivingSinceLastBreakMsByDriverRef.current[1]
          if (d >= DRIVING_LIMIT_430_MS && !breakWarning430DismissedRef.current) setBreakWarningActive('430')
          else if (d >= DRIVING_LIMIT_415_MS && !breakWarning415DismissedRef.current) setBreakWarningActive('415')
        }
      } else if (restDriver) {
        restSinceLastBreakMsByDriverRef.current[restDriver] += deltaMs
        const rest = restSinceLastBreakMsByDriverRef.current[restDriver]
        const splitRef = splitFirstPartTakenByDriverRef.current[restDriver]
        if (rest >= REST_RESET_MS) {
          drivingSinceLastBreakMsByDriverRef.current[restDriver] = 0
          restSinceLastBreakMsByDriverRef.current[restDriver] = 0
          splitFirstPartTakenByDriverRef.current[restDriver] = false
          setSplitFirstPartTakenByDriver((p) => ({ ...p, [restDriver]: false }))
          if (restDriver === 1) {
            breakWarning415DismissedRef.current = false
            breakWarning430DismissedRef.current = false
            setBreakWarningActive(null)
          }
        } else if (splitRef && rest >= SPLIT_REST_SECOND_MS) {
          drivingSinceLastBreakMsByDriverRef.current[restDriver] = 0
          restSinceLastBreakMsByDriverRef.current[restDriver] = 0
          splitFirstPartTakenByDriverRef.current[restDriver] = false
          setSplitFirstPartTakenByDriver((p) => ({ ...p, [restDriver]: false }))
          if (restDriver === 1) {
            breakWarning415DismissedRef.current = false
            breakWarning430DismissedRef.current = false
            setBreakWarningActive(null)
          }
        }
      }

      setDrivingSinceLastBreakMsByDriver({ ...drivingSinceLastBreakMsByDriverRef.current })
      setRestSinceLastBreakMsByDriver({ ...restSinceLastBreakMsByDriverRef.current })

      // Uzavřeme případnou rozpracovanou minutu, aby nedošlo k duplicitám
      minuteAccumulatorRef.current = null
    }

    /* Offset: simulatedUtcTime jsme posunuli o deltaMs, proto odečteme deltaMs, aby localTime = simulatedUtcTime + timeOffsetMs = cílový čas */
    lastPanelAdjustmentMsRef.current = 0
    setTimeOffsetMs(shift.nextTimeOffsetMs)
  }, [panelDateTime, simulatedUtcTime, timeOffsetMs, activityHistory, setActivityHistory])

  const handleStopIgnition = useCallback(() => {
    if (menuCountryInputState?.phase === 'confirmSaved') {
      returnToParentMenu()
      return
    }
    if (menuLoadUnloadConfirmState) {
      leaveMenuLoadUnloadByStop()
      return
    }
    cancelMenuCountryInput()
    cancelMenuLoadUnload()
    setTargetSpeed(0)
    setIgnitionOn(false)
    // Globální reset zobrazení: okamžité ukončení všech aktivních stavů
    setCardInsertionState(null)
    setDisplayMode('operating')
    setCurrentMenuPath([ENTRY_MENU_ID])
    setSelectedIndex(0)
    printState.closeAll()
    setDrivingWithoutCardWarningActive(false)
    setBreakWarningActive(null)
  }, [menuCountryInputState, menuLoadUnloadConfirmState, printState, returnToParentMenu, cancelMenuCountryInput, leaveMenuLoadUnloadByStop, cancelMenuLoadUnload])

  const handleStopDisabledClick = useCallback(() => {
    setStopDisabledMessage(true)
    setTimeout(() => setStopDisabledMessage(false), 2500)
  }, [])

  const SIMULATE_4H10M_MS = 4 * 3600000 + 10 * 60000

  const handleSimulate4h10m = useCallback(() => {
    const startMs = simulatedUtcTimeRef.current
    const startMinute = Math.floor(startMs / 60000) * 60000
    const endMinute = startMinute + 250 * 60000

    const ah = activityHistoryRef.current
    const cardHist = cardActivityHistoryByTemplateIdRef.current
    const allMinutes = new Set<number>([
      ...ah.map((e) => e.minuteStartUtc),
      ...Object.values(cardHist).flatMap((arr) => arr.map((e) => e.minuteStartUtc)),
    ])
    const hasOverlap = [...allMinutes].some((m) => m >= startMinute && m < endMinute)
    if (hasOverlap) {
      setDuplicateDataWarningOpen(true)
      return
    }

    const isMultiManning = isMultiManningRef.current
    const c1Inserted = card1InsertedRef.current
    const c2Inserted = card2InsertedRef.current
    const tid1 = card1DataRef.current?.templateId
    const tid2 = card2DataRef.current?.templateId
    const {
      secondEntries,
      activityEntries,
      gpsRecords: gpsRecordsFromSim,
      totalDrivingDistance,
      drivingMs,
      otherWorkMs,
    } = buildSimulated4h10m({
      startMs,
      isMultiManning,
      card1Inserted: c1Inserted,
      card2Inserted: c2Inserted,
      card1TemplateId: tid1,
      card2TemplateId: tid2,
      distanceFromStartKm: Math.max(0, odometerKmRef.current - ODOMETER_KM),
    })

    setActivityHistory((prev) => [...prev, ...activityEntries])
    if (gpsRecordsFromSim.length > 0) {
      setRecordedGpsLocations((prev) => [...prev, ...gpsRecordsFromSim])
    }
    if (c1Inserted && tid1) {
      setCardActivityHistoryByTemplateId((prev) => ({
        ...prev,
        [tid1]: [...(prev[tid1] ?? []), ...activityEntries],
      }))
    }
    if (c2Inserted && tid2) {
      setCardActivityHistoryByTemplateId((prev) => ({
        ...prev,
        [tid2]: [...(prev[tid2] ?? []), ...activityEntries],
      }))
    }
    setSecondHistory((prev) => {
      const next = [...prev, ...secondEntries]
      while (next.length > 86400) next.shift()
      return next
    })
    minuteAccumulatorRef.current = null

    const availabilityMs = isMultiManningRef.current ? drivingMs : 0
    setActivityDurationsMs((prev) => ({
      ...prev,
      driving: prev.driving + drivingMs,
      otherWork: prev.otherWork + otherWorkMs,
      availability: prev.availability + availabilityMs,
    }))

    drivingSinceLastBreakMsByDriverRef.current[1] += 250 * 60000
    restSinceLastBreakMsByDriverRef.current[1] = 0
    splitFirstPartTakenByDriverRef.current[1] = false
    breakWarning415DismissedRef.current = false
    breakWarning430DismissedRef.current = false

    const d = drivingSinceLastBreakMsByDriverRef.current[1]
    if (d >= DRIVING_LIMIT_430_MS) setBreakWarningActive('430')
    else if (d >= DRIVING_LIMIT_415_MS) setBreakWarningActive('415')
    setDrivingSinceLastBreakMsByDriver((p) => ({ ...p, 1: d }))
    setRestSinceLastBreakMsByDriver((p) => ({ ...p, 1: 0 }))

    trackOverspeed(0, simulatedUtcTimeRef.current, 0)
    setSimulatedUtcTime(startMs + SIMULATE_4H10M_MS)
    setTargetSpeed(0)
    setCurrentSpeed(0)
    setIgnitionOn(true)
    setLeftActivityId('WORK')
    targetSpeedRef.current = 0
    currentSpeedRef.current = 0

    const newOdometer = odometerKmRef.current + totalDrivingDistance
    odometerKmRef.current = newOdometer
    setOdometerKm((prev) => prev + totalDrivingDistance)
    const distanceFromStartKm = Math.max(0, newOdometer - ODOMETER_KM)
    virtualLocationRef.current = getVirtualLocationForDistance(distanceFromStartKm)
    setVirtualLocation(getVirtualLocationForDistance(distanceFromStartKm))

    // Otevřít graf s nově zapsanými daty (shodně jako po Generovat pracovní týden)
    const combinedHistory = c1Inserted && tid1
      ? [...(cardActivityHistoryByTemplateIdRef.current[tid1] ?? []), ...activityEntries]
      : [...(activityHistoryRef.current ?? []), ...activityEntries]
    const manualBuf = driver1ManualEntryBuffer
    try {
      const { activities, countryMarkers } = simulatorToGraphData(combinedHistory, manualBuf, 1, {
        lastWithdrawalMs: loadCard1LastWithdrawal(),
        insertionTimeMs: startMs + SIMULATE_4H10M_MS,
      })
      const days = activitiesByDay(activities)
      const daysToShow = activities.length > 0
        ? expandToWeeksContainingData(days, Math.min(...activities.map((a) => a.startMs)))
        : expandToWeeksContainingData(days, startMs + SIMULATE_4H10M_MS)
      setWorkWeekGraphData({ days: daysToShow, countryMarkers, manualEntryBuffer: manualBuf, lastWithdrawalUtc: loadCard1LastWithdrawal(), card2Data: undefined })
    } catch {
      try {
        const txt = workWeekToTxtString(combinedHistory, manualBuf, 1)
        const parsed = parseWorkWeekTxt(txt)
        const days = activitiesByDay(parsed.activities)
        const daysToShow = parsed.activities.length > 0
          ? expandToWeeksContainingData(days, Math.min(...parsed.activities.map((a) => a.startMs)))
          : expandToWeeksContainingData(days, startMs + SIMULATE_4H10M_MS)
        setWorkWeekGraphData({ days: daysToShow, countryMarkers: parsed.countryMarkers, manualEntryBuffer: manualBuf, lastWithdrawalUtc: loadCard1LastWithdrawal(), card2Data: undefined })
      } catch {
        setWorkWeekGraphData({ days: expandToWeeksContainingData([], startMs + SIMULATE_4H10M_MS), countryMarkers: [], manualEntryBuffer: manualBuf, lastWithdrawalUtc: null, card2Data: undefined })
      }
    }
  }, [driver1ManualEntryBuffer])

  const handleGenerateWorkWeek = useCallback(() => {
    const slotIndex: 1 | 2 = 1
    const templateId = 'zmizik'
    const nowUtc = simulatedUtcTimeRef.current
    const { activityHistory: generated, manualEntryBuffer, secondHistory: generatedSecondHistory } = generateRandomWorkWeek(slotIndex, nowUtc, templateId, nowUtc)

    const MINUTE_MS = 60 * 1000
    const floorToMinute = (ms: number) => Math.floor(ms / MINUTE_MS) * MINUTE_MS
    const segmentToMinuteMs = (seg: ManualEntrySegment) =>
      floorToMinute(new Date(Date.UTC(seg.year, seg.month - 1, seg.day, seg.hour, seg.minute)).getTime())

    const genMin = Math.min(...generated.map((e) => e.minuteStartUtc))
    const genMax = Math.max(...generated.map((e) => e.minuteStartUtc))
    const cardHistory = cardActivityHistoryByTemplateId[templateId] ?? []
    const existingMinutes = new Set<number>([
      ...activityHistory.map((e) => e.minuteStartUtc),
      ...cardHistory.map((e) => e.minuteStartUtc),
      ...driver1ManualEntryBuffer.map(segmentToMinuteMs),
    ])
    const hasOverlap = [...existingMinutes].some((m) => m >= genMin && m <= genMax)

    if (hasOverlap) {
      setGenerateWorkWeekBlockedWarning(true)
      setDuplicateDataWarningOpen(true)
      return
    }

    setGenerateWorkWeekBlockedWarning(false)
    setActivityHistory(generated)
    setDriver1ManualEntryBuffer(manualEntryBuffer)
    setCardActivityHistoryByTemplateId((prev) => ({ ...prev, [templateId]: generated }))
    saveCard1ActivityHistory(generated)
    trackOverspeed(0, simulatedUtcTimeRef.current, 0)
    setSimulatedUtcTime(nowUtc)
    setPanelDateTime(new Date(nowUtc))
    setTimeOffsetMs(0)
    setSecondHistory(generatedSecondHistory)
    drivingSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
    restSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
    setDrivingSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
    setRestSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
    const { activities, countryMarkers } = simulatorToGraphData(generated, manualEntryBuffer, slotIndex)
    const days = activitiesByDay(activities)
    const daysToShow = activities.length > 0 ? expandToWeeksContainingData(days, Math.min(...activities.map((a) => a.startMs))) : expandToWeeksContainingData([], nowUtc)
    setWorkWeekGraphData({ days: daysToShow, countryMarkers })
  }, [activityHistory, driver1ManualEntryBuffer, cardActivityHistoryByTemplateId])

  const setPrepError = useCallback((index: 0 | 1, message: string | null) => {
    setCardPrepError((prev) => {
      const next: [string | null, string | null] = [...prev]
      next[index] = message
      return next
    })
  }, [])

  const handleRemovePreparedCard = useCallback((index: 0 | 1) => {
    const prepared = cardPrep[index]
    if (prepared?.kind === 'ddd') {
      const inserted = card1Data?.cardNumber === prepared.cardNumber || card2Data?.cardNumber === prepared.cardNumber
      if (!inserted) {
        setDddCards((prev) => {
          if (!prev[prepared.cardNumber]) return prev
          const next = { ...prev }
          delete next[prepared.cardNumber]
          return next
        })
      }
    }
    setCardPrep((prev) => {
      const next: [CardPrep | null, CardPrep | null] = [...prev]
      next[index] = null
      return next
    })
    setPrepError(index, null)
  }, [cardPrep, card1Data, card2Data, setPrepError])

  const handleLoadVirtualCard = useCallback((index: 0 | 1) => {
    const templateId = index === 0 ? 'zmizik' : 'novak'
    setCardPrep((prev) => {
      const next: [CardPrep | null, CardPrep | null] = [...prev]
      next[index] = { kind: 'virtual', templateId }
      return next
    })
    setPrepError(index, null)
  }, [setPrepError])

  const handleDddFile = useCallback((index: 0 | 1, file: File) => {
    void file.arrayBuffer().then(async (buffer) => {
      try {
        const card = await loadDriverCardFromDdd(new Uint8Array(buffer))
        if (!card.cardNumber) {
          setPrepError(index, 'Výpis nemá číslo karty, takže ji nelze odlišit od jiné karty.')
          return
        }
        if (dddCardsRef.current[card.cardNumber]) {
          setPrepError(index, 'Tato karta už je načtená.')
          setDddPreview(dddCardsRef.current[card.cardNumber].originalPreview)
          return
        }
        const record = createDddCardRecord(card)
        setDddCards((prev) => ({ ...prev, [card.cardNumber]: record }))
        setCardPrep((prev) => {
          const next: [CardPrep | null, CardPrep | null] = [...prev]
          next[index] = { kind: 'ddd', cardNumber: card.cardNumber }
          return next
        })
        setDddPreview(record.originalPreview)
        setPrepError(index, null)
        setDddInsertMessage(null)
      } catch (error) {
        const message = error instanceof Error && error.message
          ? error.message
          : 'Soubor se nepodařilo načíst jako kartu řidiče.'
        setPrepError(index, message)
      }
    }).catch(() => {
      setPrepError(index, 'Soubor se nepodařilo přečíst.')
    })
  }, [setPrepError])

  const handleShowCardData = useCallback(() => {
    const hasDddCard = Boolean(
      (card1Data?.cardNumber && dddCards[card1Data.cardNumber]) ||
      (card2Data?.cardNumber && dddCards[card2Data.cardNumber]),
    )
    if (hasDddCard) {
      setCardGraphsWindowOpen(true)
      return
    }
    const refMs = simulatedUtcTimeRef.current
    setWorkWeekGraphData(buildShowCardGraphData({
      activityHistory,
      cardActivityHistoryByTemplateId,
      driver1ManualEntryBuffer,
      driver2ManualEntryBuffer,
      card1Data,
      card2Data,
      card1StoredLastWithdrawal: loadCard1LastWithdrawal(),
      card2StoredLastWithdrawal: loadCard2LastWithdrawal(),
      refMs,
    }))
  }, [activityHistory, cardActivityHistoryByTemplateId, driver1ManualEntryBuffer, driver2ManualEntryBuffer, card1Data, card2Data, dddCards])

  const handleOpenWorkWeekData = useCallback(() => {
    workWeekFileInputRef.current?.click()
  }, [])

  const handleWorkWeekFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const txt = typeof reader.result === 'string' ? reader.result : ''
      try {
        const parsed = parseWorkWeekTxt(txt)
        const days = activitiesByDay(parsed.activities)
        setWorkWeekGraphData({ days, countryMarkers: parsed.countryMarkers })
      } catch {
        setWorkWeekGraphData({ days: [], countryMarkers: [] })
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }, [])

  const handleSaveCard1ToFile = useCallback(() => {
    const activityHistory = loadCard1ActivityHistory()
    exportWorkWeekToTxt(activityHistory, driver1ManualEntryBuffer, 1)
  }, [driver1ManualEntryBuffer])

  const handleReset = useCallback(() => {
    setTargetSpeed(0)
    setCurrentSpeed(0)
    setVdoCounterActive(false)
    setDrivingWithoutCardWarningActive(false)
    setDrivingWithoutValidCardWarningActive(false)
    setGenerateWorkWeekBlockedWarning(false)
    setDuplicateDataWarningOpen(false)
    setIgnitionWarningActive(false)
    setActivityDurationsMs({ ...INITIAL_ACTIVITY_DURATIONS })
    setActivityHistory([])
    setSecondHistory([])
    setCard1Inserted(false)
    setCard2Inserted(false)
    setCard1Data(null)
    setCard2Data(null)
    setCardInsertionState(null)
    setCardWithdrawalState(null)
    setCardActivityHistoryByTemplateId({})
    setDriverCardStateByTemplateId({})
    setDriver1ManualEntryBuffer([])
    setDriver2ManualEntryBuffer([])
    setWorkWeekGraphData(null)
    setDriver1ManualActivities([])
    setDriver2ManualActivities([])
    setDrivingStartTime(null)
    setCard2InsertedAt(null)
    setCrewRuleInterruptedByCard2Exit(false)
    deferredEndCountryInCrewModeRef.current = {}
    activeNoCardIdRef.current = null
    drivingSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
    restSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
    splitFirstPartTakenByDriverRef.current = { 1: false, 2: false }
    breakWarning415DismissedRef.current = false
    breakWarning430DismissedRef.current = false
    setDrivingSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
    setRestSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
    setSplitFirstPartTakenByDriver({ 1: false, 2: false })
    setBreakWarningActive(null)
    setExcessSpeedWarningActive(false)
    setEjectionBlockedWarningActive(false)
    setOverrideWarningCode(null)
    overspeedRunRef.current = null
    const now = Date.now()
    setSimulatedUtcTime(now)
    setPanelDateTime(new Date(now))
    setTimeOffsetMs(0)
    setIgnitionOn(false)
    setDisplayAwakeFromStandby(false)
    setLeftActivityId('REST')
    setRightActivityId('REST')
    if (displayAwakeTimeoutRef.current) {
      clearTimeout(displayAwakeTimeoutRef.current)
      displayAwakeTimeoutRef.current = null
    }
    setDisplayMode('operating')
    setCurrentMenuPath([ENTRY_MENU_ID])
    setSelectedIndex(0)
    setPrintWizardState(null)
    cancelMenuCountryInput()
    cancelMenuLoadUnload()
    printState.closeAll()
    minuteAccumulatorRef.current = null
    WorkShift.resetWorkShift()
    setVehicleLoadUnloadEvents([])
    setFerryTrainEvents([])
    setOutModeEvents([])
    setRecordedGpsLocations([])
    drivingMsSinceLastGpsRecordRef.current = 0
    setFerryTrainModeActive(false)
    setOutModeActive(false)
    setOutStoppedAtUtc(null)
    setNr165Dismissed(false)
    setMenuComingSoonInfo(null)
    setInfoPanelResetTrigger((t) => t + 1)
    saveCard1ActivityHistory([])
    saveCard2ActivityHistory([])
    saveCard1ManualEntryBuffer([])
    saveCard2ManualEntryBuffer([])
    clearCard1LastWithdrawal()
    clearCard2LastWithdrawal()
    setFaultsAndEvents([])
    setEventLog([])
  }, [printState])

  /** Vrátí doplňkové aktivity pro danou šachtu (1 = řidič 1, 2 = řidič 2). Pro pozdější zobrazení / výtisk. */
  const getManualActivitiesForSlot = useCallback((slot: 1 | 2): ManualActivityEntry[] => {
    return slot === 1 ? driver1ManualActivities : driver2ManualActivities
  }, [driver1ManualActivities, driver2ManualActivities])

  /** Nastaví doplňkové aktivity pro danou šachtu. Max 6 položek, minuty celé číslo ≥ 0. Použije menu „zadání řidič 1/2“. */
  const setManualActivitiesForSlot = useCallback((slot: 1 | 2, entries: ManualActivityEntry[]) => {
    const trimmed = entries.slice(0, MAX_MANUAL_ACTIVITIES).map((e) => ({
      type: e.type,
      minutes: Math.max(0, Math.floor(e.minutes)),
    }))
    if (slot === 1) setDriver1ManualActivities(trimmed)
    else setDriver2ManualActivities(trimmed)
  }, [])

  /** Přidá nebo přepíše jednu doplňkovou aktivitu na indexu (0..5). Minuty zaokrouhleny na celé. Použije menu „zadání řidič 1/2“. */
  const setManualActivityAt = useCallback(
    (slot: 1 | 2, index: number, entry: ManualActivityEntry) => {
      if (index < 0 || index >= MAX_MANUAL_ACTIVITIES) return
      const minutes = Math.max(0, Math.floor(entry.minutes))
      const setter = slot === 1 ? setDriver1ManualActivities : setDriver2ManualActivities
      setter((prev) => {
        const next = [...prev]
        while (next.length <= index) next.push({ type: 'rest', minutes: 0 })
        next[index] = { type: entry.type, minutes }
        return next.slice(0, MAX_MANUAL_ACTIVITIES)
      })
    },
    [],
  )

  /** API pro menu „zadání řidič 1/2“ – zadání a uložení až 6 aktivit (minuty). Pro pozdější zobrazení. */
  const manualActivitiesApiRef = useRef({
    setManualActivitiesForSlot,
    setManualActivityAt,
    getManualActivitiesForSlot,
  })
  manualActivitiesApiRef.current = {
    setManualActivitiesForSlot,
    setManualActivityAt,
    getManualActivitiesForSlot,
  }

  // Perzistence activityHistory (paměť tachografu)
  useEffect(() => {
    saveTachographActivityHistory(activityHistory)
  }, [activityHistory])

  // Perzistence dat karet – zápis do samostatných souborů (card1_activity_history, card2_activity_history)
  // Aktivity po celých minutách se zapisují i v finalizeMinute; useEffect zaručuje uložení při dalších změnách
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const card1 = cardActivityHistoryByTemplateId[CARD1_TEMPLATE_ID]
      const card2 = cardActivityHistoryByTemplateId[CARD2_TEMPLATE_ID]
      if (card1) saveCard1ActivityHistory(card1)
      if (card2) saveCard2ActivityHistory(card2)
    } catch {
      // ignore
    }
  }, [cardActivityHistoryByTemplateId])

  // Perzistence manuálního zadání karet
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      saveCard1ManualEntryBuffer(driver1ManualEntryBuffer)
    } catch {
      // ignore
    }
  }, [driver1ManualEntryBuffer])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      saveCard2ManualEntryBuffer(driver2ManualEntryBuffer)
    } catch {
      // ignore
    }
  }, [driver2ManualEntryBuffer])

  // Perzistence faultsAndEvents (tachograf)
  useEffect(() => {
    saveTachographFaultsAndEvents(faultsAndEvents)
  }, [faultsAndEvents])

  // Perzistence eventLog (tachograf)
  useEffect(() => {
    saveTachographEventLog(eventLog)
  }, [eventLog])

  // Perzistence vehicleLoadUnloadEvents (tachograf)
  useEffect(() => {
    saveTachographVehicleLoadUnloadEvents(vehicleLoadUnloadEvents)
  }, [vehicleLoadUnloadEvents])

  // Perzistence ferryTrainEvents (tachograf)
  useEffect(() => {
    saveTachographFerryTrainEvents(ferryTrainEvents)
  }, [ferryTrainEvents])

  // Perzistence outModeEvents (tachograf)
  useEffect(() => {
    saveTachographOutModeEvents(outModeEvents)
  }, [outModeEvents])

  // Perzistence recordedGpsLocations (tachograf)
  useEffect(() => {
    saveTachographRecordedGpsLocations(recordedGpsLocations)
  }, [recordedGpsLocations])

  useEffect(() => {
    const el = vdoWrapperRef.current
    if (el) (el as unknown as { manualActivitiesApi: typeof manualActivitiesApiRef.current }).manualActivitiesApi = manualActivitiesApiRef.current
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Native controls own their keys; do not navigate the tacho while editing speed.
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, button, [role="button"], summary, [contenteditable="true"]')) return
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          handleUp()
          break
        case 'ArrowDown':
          e.preventDefault()
          handleDown()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handleBack()
          break
        case 'Enter':
          e.preventDefault()
          handleOK()
          break
        case 'Escape':
        case 'Backspace':
          e.preventDefault()
          handleBack()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUp, handleDown, handleOK, handleBack, addEntry])

  // Případný název kategorie z JSONu lze odvodit pomocí deriveMenuTitle,
  // aktuálně však pro displej používáme pouze section_title na úrovni menu uzlu.
  const locale = language === 'cs' ? 'cs-CZ' : language === 'ru' ? 'ru-RU' : 'en-GB'
  const timeStr = localTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  const isBargrafRunning = cardInsertionState?.phase === 'loading'
  const isCardInitializing = cardInsertionState != null && ['finalizeStep1', 'finalizeStep2', 'finalizeStep3', 'finalizeStep4'].includes(cardInsertionState.phase)

  const displayProps = {
    withdrawalBargrafTick,
    symbolMap,
    cardInsertionState,
    cardWithdrawalState,
    drivingWithoutCardWarningActive,
    drivingWithoutValidCardWarningActive,
    breakWarningActive,
    excessSpeedWarningActive,
    ejectionBlockedWarningActive,
    overrideWarningCode,
    menuCountryInputState,
    menuLoadUnloadConfirmState,
    printWizardState,
    printStartedToastUntil: printState.printStartedToastUntil,
    displayMode,
    isMultiManning,
    timeStr,
    currentSpeed,
    odometerKm,
    ignitionOn,
    ignitionWarningActive,
    card1Inserted,
    card2Inserted,
    tachoState,
    countries,
    spanishRegions,
    lastEjectionTimeBySlot,
    localTime,
    timeOffsetMs,
    currentMenu,
    selectedItem,
    currentMenuId,
    entryMenuId: ENTRY_MENU_ID,
    leftActivityId,
    rightActivityId,
    vdoCounterActive,
    operatingScreenIndex,
    activityDurationsMs,
    activityHistory,
    cardActivityHistoryByTemplateId,
    card1Data,
    card2Data,
    simulatedUtcTime,
    remoteDataDownloadActive,
    driver1ManualEntryBuffer,
    driver2ManualEntryBuffer,
    /** Režim OUT: po zapnutí OUT = hned nápis OUT; při jízdě = symbol řízení; po zastavení = kladívka 10 s, pak znovu OUT */
    showOutOnL2: outModeActive && currentSpeed === 0 && (!hasDrivenSinceOutActivation || (outStoppedAtUtc != null && simulatedUtcTime - outStoppedAtUtc >= 10000)),
  }

  const isDriving = currentSpeed > 0
  const infoPanelItems = useInfoPanelItems({
    ignitionOn,
    card1Inserted,
    card2Inserted,
    crewRuleInterruptedByCard2Exit,
    drivingWithoutCardWarningActive,
    excessSpeedWarningActive,
    ejectionBlockedWarningActive,
    breakWarningActive,
    cardInsertionState,
    lastEjectionTimeBySlot,
    generateWorkWeekBlocked: generateWorkWeekBlockedWarning,
    isMultiManning,
    driver1ManualEntryBuffer,
    driver2ManualEntryBuffer,
    activityHistory,
    menuComingSoonInfo,
    outModeActive,
  })
  const showNr165Warning = useNr165Warning({
    menuCountryInputState,
    driver1ManualEntryBuffer,
    driver2ManualEntryBuffer,
  })

  const lcdDebugEnabled = useMemo(() => new URLSearchParams(window.location.search).get('lcdDebug') === '1', [])
  /** Diagnostika režimu OUT: v URL přidej ?debug=1 a zobrazí se panel se stavem. */
  const showDebugPanel = typeof window !== 'undefined' && window.location.search.includes('debug=1')
  const slot1DrivingBreak = useMemo(() => {
    if (!card1Inserted || card1Data?.templateId !== CARD1_TEMPLATE_ID) return null
    return buildSlot1VirtualCardDrivingBreak({
      cardHistory: cardActivityHistoryByTemplateId[CARD1_TEMPLATE_ID] ?? [],
      secondSamples: secondHistory,
      nowMs: simulatedUtcTime,
    })
  }, [card1Inserted, card1Data?.templateId, cardActivityHistoryByTemplateId, secondHistory, simulatedUtcTime])
  const slot1CounterIntervals = useMemo(() => {
    const slot = vdoNamedScreen === 'driveRest'
      ? (card1Inserted ? 1 : null)
      : card1Inserted && card2Inserted
        ? counterCardSlot(operatingScreenIndex, card1Inserted, card2Inserted)
        : card1Inserted
          ? 1
          : card2Inserted
            ? 2
            : null
    if (slot == null) return null
    const data = slot === 1 ? card1Data : card2Data
    const manual = slot === 1 ? driver1ManualEntryBuffer : driver2ManualEntryBuffer
    const evaluated = data?.cardNumber && !data.templateId
      ? evaluateRecordedOut({
        ...buildSlot1DddOutSources({
          cards: dddCards,
          cardNumber: data.cardNumber,
          secondSamples: secondHistory,
          nowMs: simulatedUtcTime,
          recordedDriver: slot,
        }),
        cardConditions: dddCards[data.cardNumber]?.original.specificConditions,
        vehicleEvents: outModeEvents,
        nowMs: simulatedUtcTime,
      })
      : data?.templateId
        ? evaluateRecordedOut({
          imported: [],
          vehicle: buildSlot1VirtualCounterIntervals({
            cardHistory: cardActivityHistoryByTemplateId[data.templateId] ?? [],
            manual,
            secondSamples: secondHistory,
            nowMs: simulatedUtcTime,
            driverSlot: slot,
            cardId: data.templateId,
          }),
          vehicleEvents: outModeEvents,
          nowMs: simulatedUtcTime,
        })
        : null
    return evaluated
  }, [card1Inserted, card2Inserted, operatingScreenIndex, vdoNamedScreen, outModeEvents, card1Data, card2Data, dddCards, secondHistory, simulatedUtcTime, cardActivityHistoryByTemplateId, driver1ManualEntryBuffer, driver2ManualEntryBuffer])
  const slot1FerryRest = useMemo(() => {
    const slot = card1Inserted && card2Inserted
      ? counterCardSlot(operatingScreenIndex, card1Inserted, card2Inserted)
      : card1Inserted
        ? 1
        : card2Inserted
          ? 2
          : null
    if (slot == null) return null
    const data = slot === 1 ? card1Data : card2Data
    const manual = slot === 1 ? driver1ManualEntryBuffer : driver2ManualEntryBuffer
    if (data?.cardNumber && !data.templateId) {
      return ferryDailyRestRemaining({
        ...buildSlot1DddOutSources({
          cards: dddCards,
          cardNumber: data.cardNumber,
          secondSamples: secondHistory,
          nowMs: simulatedUtcTime,
          recordedDriver: slot,
        }),
        cardConditions: dddCards[data.cardNumber]?.original.specificConditions,
        vehicleEvents: ferryTrainEvents,
        nowMs: simulatedUtcTime,
      })
    }
    if (data?.templateId) {
      return ferryDailyRestRemaining({
        imported: [],
        vehicle: buildSlot1VirtualCounterIntervals({
          cardHistory: cardActivityHistoryByTemplateId[data.templateId] ?? [],
          manual,
          secondSamples: secondHistory,
          nowMs: simulatedUtcTime,
          driverSlot: slot,
          cardId: data.templateId,
        }),
        vehicleEvents: ferryTrainEvents,
        nowMs: simulatedUtcTime,
      })
    }
    return null
  }, [card1Inserted, card2Inserted, operatingScreenIndex, ferryTrainEvents, card1Data, card2Data, dddCards, secondHistory, simulatedUtcTime, cardActivityHistoryByTemplateId, driver1ManualEntryBuffer, driver2ManualEntryBuffer])
  const slot1FerryRestMs = tachoState.ferryTrainModeActive ? (slot1FerryRest ? slot1FerryRest.remainingMs : null) : undefined
  const completedFerryRests = slot1FerryRest?.completed ?? []
  const latestRecognizedFerryRest = completedFerryRests[completedFerryRests.length - 1]
  const slot1FerryRestConditional = tachoState.ferryTrainModeActive
    ? slot1FerryRest?.conditional === true
    : latestRecognizedFerryRest?.conditional === true
  const slot1DddBreak = useMemo(() => {
    if (!slot1CounterIntervals) return null
    return drivingBreakDisplay(slot1CounterIntervals.intervals, simulatedUtcTime)
  }, [slot1CounterIntervals, simulatedUtcTime])
  const slotRestTotals = useMemo(() => {
    if (!slot1CounterIntervals) return null
    return drivingRestTotals(slot1CounterIntervals.intervals, simulatedUtcTime)
  }, [slot1CounterIntervals, simulatedUtcTime])
  const slot1DrivingUndocumented = slot1CounterIntervals != null && slot1DddBreak != null
    && drivingRemainderUndocumented(slot1CounterIntervals.intervals, slot1CounterIntervals.undetermined, simulatedUtcTime)
  const drivenSinceRestMs = slotRestTotals == null || slot1DrivingUndocumented ? null : slotRestTotals.drivenSinceRestMs
  const recognizedBreakMs = slotRestTotals == null ? null : slotRestTotals.recognizedBreakMs
  const slotWorkingTime = useMemo(() => {
    if (!slot1CounterIntervals) return null
    return workingTimeDisplay(slot1CounterIntervals.intervals, simulatedUtcTime, {
      undetermined: slot1CounterIntervals.undetermined,
      extraDailyRestEndsMs: (slot1FerryRest?.completed ?? []).map((item) => item.endMs),
    })
  }, [slot1CounterIntervals, slot1FerryRest, simulatedUtcTime])
  if (activitySinceRef.current == null) {
    activitySinceRef.current = {
      1: { activity: leftActivityId, at: simulatedUtcTime },
      2: { activity: rightActivityId, at: simulatedUtcTime },
    }
  } else {
    if (activitySinceRef.current[1].activity !== leftActivityId) {
      activitySinceRef.current[1] = { activity: leftActivityId, at: simulatedUtcTime }
    }
    if (activitySinceRef.current[2].activity !== rightActivityId) {
      activitySinceRef.current[2] = { activity: rightActivityId, at: simulatedUtcTime }
    }
  }
  const activityDurationMsByDriver = {
    1: Math.max(0, simulatedUtcTime - activitySinceRef.current[1].at),
    2: Math.max(0, simulatedUtcTime - activitySinceRef.current[2].at),
  }
  const slot1DddDaily = useMemo(() => {
    if (!slot1CounterIntervals) return null
    const dailyIntervals = intervalsWithRecognizedFerryRest(slot1CounterIntervals.intervals, slot1FerryRest?.completed ?? [])
    const daily = slot1DddDailyRemaining(dailyIntervals, simulatedUtcTime)
    if (daily.remainingMs == null) return daily
    const periodStart = dailyIntervals.reduce((latest, interval) => (
      interval.kind === 'rest' && interval.endMs <= simulatedUtcTime && interval.endMs - interval.startMs >= REDUCED_DAILY_REST_MIN_MS
        ? Math.max(latest, interval.endMs)
        : latest
    ), 0)
    if (periodStart === 0 || !undeterminedOverlaps(slot1CounterIntervals.undetermined, periodStart, simulatedUtcTime)) return daily
    return { ...daily, remainingMs: null, drivenMs: null, extensionsRemaining: null }
  }, [slot1CounterIntervals, slot1FerryRest, simulatedUtcTime])
  const slot1DddCalendar = useMemo(() => {
    if (!slot1CounterIntervals) return null
    const calendar = slot1DddCalendarRemaining(slot1CounterIntervals.intervals, simulatedUtcTime)
    const thisMonday = weekStartUtc(simulatedUtcTime)
    const prevMonday = thisMonday - 7 * 24 * 60 * 60 * 1000
    const currentUnknown = undeterminedOverlaps(slot1CounterIntervals.undetermined, thisMonday, simulatedUtcTime)
    const previousUnknown = undeterminedOverlaps(slot1CounterIntervals.undetermined, prevMonday, thisMonday)
    if (!currentUnknown && !previousUnknown) return calendar
    if (currentUnknown) {
      return { ...calendar, weeklyRemainingMs: null, fortnightRemainingMs: null, fortnightSumMs: null, currentWeekDrivingMs: null }
    }
    return { ...calendar, fortnightRemainingMs: null, fortnightSumMs: null, previousWeekDrivingMs: null }
  }, [slot1CounterIntervals, simulatedUtcTime])
  const slot1WeekCoverage = useMemo(() => {
    if (!card1Inserted || !card1Data?.cardNumber || card1Data.templateId) return null
    const card = dddCards[card1Data.cardNumber]
    if (!card || card.cardNumber !== card1Data.cardNumber) return null
    const { intervals } = buildSlot1DddDrivingBreakIntervals({
      cards: dddCards,
      cardNumber: card1Data.cardNumber,
      secondSamples: secondHistory,
      nowMs: simulatedUtcTime,
    })
    return describeSlot1WeekCoverage({ card, intervals, nowMs: simulatedUtcTime })
  }, [card1Inserted, card1Data?.cardNumber, card1Data?.templateId, dddCards, secondHistory, simulatedUtcTime])
  const slot1DebugBreak = useMemo(() => {
    if (!showDebugPanel || !vdoCounterActive || operatingScreenIndex !== 0 || !card1Inserted) return null
    if (isMultiManning || tachoState.ferryTrainModeActive || outModeActive) return null
    return slot1DddBreak
  }, [
    showDebugPanel,
    slot1DddBreak,
    vdoCounterActive,
    operatingScreenIndex,
    card1Inserted,
    isMultiManning,
    tachoState.ferryTrainModeActive,
    outModeActive,
  ])
  const slot1LcdProps = slot1CounterLcdProps({
    diagnostics: showDebugPanel,
    context: {
      vdoCounterActive,
      operatingScreenIndex,
      card1Inserted,
      isMultiManning,
      ferryTrainModeActive: tachoState.ferryTrainModeActive,
      outModeActive,
      templateId: card1Data?.templateId,
      cardNumber: card1Data?.cardNumber,
      card2Inserted,
      slot2TemplateId: card2Data?.templateId,
      slot2CardNumber: card2Data?.cardNumber,
    },
    dddBreak: slot1DddBreak,
    daily: slot1DddDaily,
    calendar: slot1DddCalendar,
    virtualDebugBreak: card1Data?.templateId === CARD1_TEMPLATE_ID ? slot1DebugBreak : null,
  })

  const teachDriver: 1 | 2 = operatingScreenIndex === 1 && card2Inserted ? 2 : 1
  const lcdTeachCovered = Boolean(
    overrideWarningCode
    || excessSpeedWarningActive
    || ejectionBlockedWarningActive
    || cardInsertionState
    || cardWithdrawalState
    || (drivingWithoutCardWarningActive && !(outModeActive && currentSpeed === 0 && (!hasDrivenSinceOutActivation || (outStoppedAtUtc != null && simulatedUtcTime - outStoppedAtUtc >= 10000))))
    || drivingWithoutValidCardWarningActive
    || breakWarningActive
    || menuCountryInputState
    || menuLoadUnloadConfirmState
    || printWizardState
  )
  const lcdTeachItem = lcdTeachInfoItem({
    t,
    screen: visibleLcdTeachScreen({
      displayMode,
      vdoCounterActive,
      vdoNamedScreen,
      operatingScreenIndex,
      cardInserted: card1Inserted || card2Inserted,
    }),
    covered: lcdTeachCovered,
    driver: teachDriver,
    leftActivityId,
    rightActivityId,
    breakCountingDown: slot1LcdProps.slot1DebugBreak?.phase === 'break' && !tachoState.ferryTrainModeActive,
  })
  const nr165Visible = showNr165Warning && !nr165Dismissed
  const panelItems: InfoItem[] = [
    ...infoPanelItems,
    ...(lcdTeachItem ? [lcdTeachItem] : []),
    ...(mobileInfoPanels && nr165Visible ? [{
      id: 'nr165-warning',
      type: 'warning' as const,
      message: t.infoPanel.nr165Warning,
      activeOnly: true,
      onDismiss: () => setNr165Dismissed(true),
    }] : []),
  ]

  const insertedSlot1 = card1Data?.cardNumber ? dddCards[card1Data.cardNumber] ?? null : null
  const insertedSlot2 = card2Data?.cardNumber ? dddCards[card2Data.cardNumber] ?? null : null

  return (
    <div>
    <div className="app-root" data-lang={language} style={{ minHeight: '100vh', background: '#444', display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', margin: 0, padding: 24, gap: 24 }}>
      {cardsOpen && <button className="cards-dismiss" aria-label="Zavřít nabídku karet" onClick={() => {setCardsOpen(false);setCardPickerSlot(null)}}/>}
      <aside className={`cards-drawer ${cardsOpen ? 'is-open' : ''} ${cardDragging ? 'is-dragging' : ''}`} aria-label="Karty řidičů"
        onKeyDown={e => {if(e.key === 'Escape'){setCardsOpen(false);setCardPickerSlot(null)}}}
        onDragStartCapture={() => setCardDragging(true)} onDragEndCapture={() => {setCardDragging(false);setCardsOpen(false)}}>
        <div className="card-edge-tabs" onPointerEnter={e => {if(e.pointerType === 'mouse') setCardsOpen(true)}}>{([1,2] as const).map(n => <button key={n} aria-label={`Otevřít nabídku karty ${n}`} aria-expanded={cardsOpen} onClick={() => {setCardsOpen(true);setCardPickerSlot(null)}}><span>▥</span><b>{n}</b><small>KARTA</small></button>)}</div>
        <div className="cards-drawer-content" hidden={!cardsOpen}>
        <div className="cards-drawer-heading"><strong>{cardPickerSlot ? `Vložit kartu do slotu ${cardPickerSlot}` : 'Karty řidičů'}</strong><button onClick={() => {setCardsOpen(false);setCardPickerSlot(null)}} aria-label="Zavřít karty">×</button></div>
        {!(ignitionOn || displayAwakeFromStandby) && <p className="cards-hint">Nejprve zapni zapalování tlačítkem START.</p>}
      <div className="control-panel-lang-left" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <label htmlFor="lang-select" className="control-panel-label">{t.ui.language}</label>
        <select
          id="lang-select"
          className="control-panel-lang-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'cs' | 'en' | 'ru')}
          title={t.ui.selectLanguageTitle}
        >
          <option value="cs">Čeština</option>
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
        <div className="driver-cards-column" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {([0, 1] as const).map((index) => {
            const prepared = cardPrep[index]
            const templateId = prepared?.kind === 'virtual' ? prepared.templateId : null
            const dddRecord = prepared?.kind === 'ddd' ? dddCards[prepared.cardNumber] : null
            const insertedSlot = templateId
              ? (card1Data?.templateId === templateId ? 1 : card2Data?.templateId === templateId ? 2 : null)
              : dddRecord
                ? (card1Data?.cardNumber === dddRecord.cardNumber ? 1 : card2Data?.cardNumber === dddRecord.cardNumber ? 2 : null)
                : null
            const holder = dddRecord ? `${dddRecord.firstName} ${dddRecord.surname}`.trim() : ''
            return (
              <CardPrepMenu
                key={index}
                index={index}
                prepared={prepared}
                error={cardPrepError[index]}
                loadDddLabel={t.controls.loadCardFromDdd}
                loadDddTitle={t.controls.loadCardFromDddTitle}
                loadVirtualLabel={t.controls.loadVirtualCard}
                title={index === 0 ? t.workWeek.card1 : t.workWeek.card2}
                onDddFile={(file) => handleDddFile(index, file)}
                onLoadVirtual={() => handleLoadVirtualCard(index)}
                onRemove={() => handleRemovePreparedCard(index)}
              >
                {templateId && (
                  <div data-prep-holder={TEST_CARDS[templateId].surname} data-inserted-slot={insertedSlot ?? ''}>
                    <DriverCardVisual
                      cardId={templateId}
                      data={card1Data?.templateId === templateId ? card1Data : card2Data?.templateId === templateId ? card2Data : TEST_CARDS[templateId]}
                      insertedSlot={insertedSlot}
                      draggable={insertedSlot == null && ignitionOn}
                      onDragStart={(event) => handleCardDragStart(event, templateId)}
                    />
                  </div>
                )}
                {dddRecord && (
                  <div
                    data-card-number={dddRecord.cardNumber}
                    data-holder={holder}
                    data-surname={dddRecord.surname}
                    data-inserted-slot={insertedSlot ?? ''}
                    data-vehicle-last-use={dddRecord.vehicleLastUseUtc ?? ''}
                    data-vehicle-last-use-source={dddRecord.vehicleLastUseSource ?? ''}
                    data-working-activities={dddRecord.workingActivities.length}
                    data-working-manual={dddRecord.workingManual.length}
                    data-original-driving-start={dddRecord.originalPreview.firstDriving?.startMs ?? ''}
                    data-original-driving-end={dddRecord.originalPreview.firstDriving?.endMs ?? ''}
                    data-original-activity-count={dddRecord.original.activities.length}
                    data-original-slot2-start={dddRecord.original.activities.find((activity) => activity.slot === 2)?.startUtc ?? ''}
                    data-original-slot2-end={dddRecord.original.activities.find((activity) => activity.slot === 2)?.endUtc ?? ''}
                  >
                    <DriverCardVisual
                      data={{ name: holder, surname: dddRecord.surname, lastWithdrawal: null }}
                      insertedSlot={insertedSlot}
                      draggable={insertedSlot == null && (ignitionOn || displayAwakeFromStandby)}
                      dragValue={`ddd:${dddRecord.cardNumber}`}
                      birthDate={dddRecord.original.dateOfBirth}
                      validityFrom={dddRecord.original.validityBegin}
                      validityTo={dddRecord.original.dateOfExpiry}
                      authority={dddRecord.original.issuingAuthority}
                      documentNumber={dddRecord.original.drivingLicenseNumber}
                      cardNumber={dddRecord.cardNumber}
                      countryCode={dddRecord.original.issuingCountry}
                    />
                  </div>
                )}
                {prepared && <div className="card-insert-actions">
                  {insertedSlot ? <span>Vložena ve slotu {insertedSlot}</span> : (cardPickerSlot ? [cardPickerSlot] : [1,2] as const).map(slot => <button key={slot} disabled={!(ignitionOn || displayAwakeFromStandby) || !!(slot === 1 ? card1Data : card2Data)} onClick={() => insertCardIntoSlot(prepared.kind === 'virtual' ? prepared.templateId : `ddd:${prepared.cardNumber}`, slot as 1 | 2)}>Vložit do slotu {slot}</button>)}
                </div>}
              </CardPrepMenu>
            )
          })}
          {dddInsertMessage && <p className="ddd-insert-message" role="alert">{dddInsertMessage}</p>}
        </div>
      </div>
        </div>
      </aside>
      <div className="device-column">
      <div className="vdo-with-toggle">
      <div
        ref={vdoWrapperRef}
        className="vdo-wrapper"
        data-activity-durations={JSON.stringify(activityDurationsMs)}
        data-manual-activities-driver1={JSON.stringify(getManualActivitiesForSlot(1))}
        data-manual-activities-driver2={JSON.stringify(getManualActivitiesForSlot(2))}
        data-tacho-state={tachoStateJson}
        data-is-bargraf-running={isBargrafRunning}
        data-is-card-initializing={isCardInitializing}
        data-second-history-length={secondHistory.length}
        data-activity-history-length={activityHistory.length}
        data-faults-events={faultsAndEventsJson}
        data-event-log={JSON.stringify(eventLog)}
        data-driver2-manual-entries={JSON.stringify(driver2ManualEntryBuffer)}
        data-debug-out-mode-active={String(outModeActive)}
        data-debug-show-out-on-l2={String(outModeActive)}
        data-debug-driving-without-card-warning={String(drivingWithoutCardWarningActive)}
        data-debug-display-mode={displayMode}
      >
        <FaceplateFrame><div className="vdo-main-panel vdo-realistic-panel">
          <div className="vdo-top-section">
            <div className="display-area" style={{ position: 'relative' }}>
              {showDebugPanel && (
                <div
                  data-vdo-debug=""
                  style={{
                    marginTop: 8,
                    background: 'rgba(0,0,0,0.85)',
                    color: '#9f9',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    padding: 6,
                  }}
                >
                  <div>OUT režim: outModeActive={String(outModeActive)} | showOutOnL2={String(displayProps.showOutOnL2)}</div>
                  <div>Výstraha: drivingWithoutCardWarningActive={String(drivingWithoutCardWarningActive)}</div>
                  <div>displayMode={displayMode} | card1Inserted={String(card1Inserted)}</div>
                  {vdoCounterActive && operatingScreenIndex === 0 && card1Inserted && (card1Data?.templateId === CARD1_TEMPLATE_ID || card1Data?.cardNumber) && (
                    slot1DebugBreak ? (
                      <div
                        data-debug-phase={slot1DebugBreak.phase}
                        data-debug-remaining-ms={slot1DebugBreak.phase === 'driving' ? slot1DebugBreak.remainingDrivingMs : undefined}
                        data-debug-required-ms={slot1DebugBreak.phase === 'driving' ? slot1DebugBreak.requiredBreakMs : undefined}
                        data-debug-if-start-ms={slot1DebugBreak.phase === 'break' ? slot1DebugBreak.drivingIfStartNowMs : undefined}
                        data-debug-break-left-ms={slot1DebugBreak.phase === 'break' ? slot1DebugBreak.remainingBreakMs : undefined}
                        data-debug-after-ms={slot1DebugBreak.phase === 'break' ? slot1DebugBreak.drivingAfterBreakMs : undefined}
                      >
                        <div>Diagnostika šachty 1</div>
                        {slot1DddCalendar && (
                          <div
                            data-debug-weekly-remaining-ms={slot1DddCalendar.weeklyRemainingMs ?? ''}
                            data-debug-fortnight-remaining-ms={slot1DddCalendar.fortnightRemainingMs ?? ''}
                            data-debug-calendar-note={slot1DddCalendar.note ?? ''}
                          >
                            <div>Týdenní zbytek: {slot1DddCalendar.weeklyRemainingMs == null ? 'neurčený' : formatDurationHhMm(slot1DddCalendar.weeklyRemainingMs, true)}</div>
                            <div>Dvoutýdenní zbytek: {slot1DddCalendar.fortnightRemainingMs == null ? 'neurčený' : formatDurationHhMm(slot1DddCalendar.fortnightRemainingMs, true)}</div>
                            {slot1DddCalendar.note && <div>{slot1DddCalendar.note}</div>}
                            {slot1WeekCoverage && (
                              <div
                                data-debug-card={slot1WeekCoverage.cardNumber}
                                data-debug-week-start-ms={slot1WeekCoverage.weekStartMs}
                                data-debug-sim-ms={slot1WeekCoverage.nowMs}
                                data-debug-manual-rest={slot1WeekCoverage.manualRests.map((rest) => `${rest.startMs}-${rest.endMs ?? 'none'}`).join(',')}
                                data-debug-hole={slot1WeekCoverage.hole ? `${slot1WeekCoverage.hole.reason}:${slot1WeekCoverage.hole.startMs}-${slot1WeekCoverage.hole.endMs}` : 'none'}
                              >
                                <div>Karta: {slot1WeekCoverage.cardNumber}</div>
                                <div>Začátek aktuálního týdne UTC: {new Date(slot1WeekCoverage.weekStartMs).toISOString()}</div>
                                <div>Simulační čas: {new Date(slot1WeekCoverage.nowMs).toISOString()}</div>
                                {slot1WeekCoverage.manualRests.length === 0 ? (
                                  <div>Ruční odpočinek: není uložený</div>
                                ) : (
                                  slot1WeekCoverage.manualRests.map((rest, index) => (
                                    <div key={index}>
                                      Ruční odpočinek: {new Date(rest.startMs).toISOString()} – {rest.endMs == null ? 'bez konce' : new Date(rest.endMs).toISOString()}
                                    </div>
                                  ))
                                )}
                                <div>
                                  {slot1WeekCoverage.hole
                                    ? `První nepokrytý interval: ${new Date(slot1WeekCoverage.hole.startMs).toISOString()} – ${new Date(slot1WeekCoverage.hole.endMs).toISOString()} (${slot1WeekCoverage.hole.reason === 'unknown' ? 'unknown' : 'mezera'})`
                                    : 'První nepokrytý interval: žádný'}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {slot1DddDaily && (
                          <div data-debug-daily-note={slot1DddDaily.note ?? ''} data-debug-daily-remaining-ms={slot1DddDaily.remainingMs ?? ''}>
                            {slot1DddDaily.note}
                          </div>
                        )}
                        {slot1DebugBreak.phase === 'driving' ? (
                          <div>
                            {parseSymbols('(2)', symbolMap)} {formatDurationHhMm(slot1DebugBreak.remainingDrivingMs, true)}
                            {' '}
                            {parseSymbols('(10)', symbolMap)} {formatDurationHhMm(slot1DebugBreak.requiredBreakMs, true)}
                          </div>
                        ) : (
                          <div>
                            {parseSymbols('(2)', symbolMap)} {formatDurationHhMm(slot1DebugBreak.drivingIfStartNowMs, true)}
                            {' '}
                            {parseSymbols('(10)', symbolMap)} {formatDurationHhMm(slot1DebugBreak.remainingBreakMs, true)}
                            {' '}
                            {parseSymbols('(2)', symbolMap)} {formatDurationHhMm(slot1DebugBreak.drivingAfterBreakMs, true)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div data-debug-phase="counter">Diagnostika mimo rozsah, platí současný Counter</div>
                    )
                  )}
                </div>
              )}
              <div
                id="main-display"
                data-lcd-preview
                className={`lcd-screen ${!ignitionOn && !displayAwakeFromStandby ? 'lcd-screen-off' : ''}`}
              >
                <TachoDisplay
                  lcdPreview
                  {...displayProps}
                  vdoNamedScreen={vdoNamedScreen}
                  slot1DebugBreak={slot1LcdProps.slot1DebugBreak}
                  slot1DebugDailyRemainingMs={slot1LcdProps.slot1DebugDailyRemainingMs}
                  slot1DebugWeeklyRemainingMs={slot1LcdProps.slot1DebugWeeklyRemainingMs}
                  slot1DebugFortnightRemainingMs={slot1LcdProps.slot1DebugFortnightRemainingMs}
                  slot1DebugFortnightSumMs={slot1LcdProps.slot1DebugFortnightSumMs}
                  slot1DebugDailyExtensionsRemaining={slot1LcdProps.slot1DebugDailyExtensionsRemaining}
                  slot1DebugOtherWorkMs={slot1LcdProps.slot1DebugOtherWorkMs}
                  slot1DebugDrivingKnown={!slot1DrivingUndocumented}
                  slot1DebugFerryRestMs={slot1FerryRestMs}
                  slot1DebugFerryRestConditional={slot1FerryRestConditional}
                  drivenSinceRestMs={drivenSinceRestMs}
                  recognizedBreakMs={recognizedBreakMs}
                  activityDurationMsByDriver={activityDurationMsByDriver}
                  workTime={slotWorkingTime}
                />
                {lcdDebugEnabled && <LcdDebugGrid />}
              </div>
              {slot1DrivingBreak && (
                <div
                  hidden
                  data-slot1-driving-break={slot1DrivingBreak.phase}
                  data-remaining-driving-ms={slot1DrivingBreak.phase === 'driving' ? slot1DrivingBreak.remainingDrivingMs : undefined}
                  data-required-break-ms={slot1DrivingBreak.phase === 'driving' ? slot1DrivingBreak.requiredBreakMs : undefined}
                  data-driving-if-start-now-ms={slot1DrivingBreak.phase === 'break' ? slot1DrivingBreak.drivingIfStartNowMs : undefined}
                  data-remaining-break-ms={slot1DrivingBreak.phase === 'break' ? slot1DrivingBreak.remainingBreakMs : undefined}
                  data-driving-after-break-ms={slot1DrivingBreak.phase === 'break' ? slot1DrivingBreak.drivingAfterBreakMs : undefined}
                />
              )}
              <div className="display-controls">
                <button
                  type="button"
                  className="btn-nav"
                  onClick={handleBack}
                  title={t.ui.back}
                  aria-label={t.ui.back}
                >
                  {'\u21A9'}
                </button>
                <button
                  type="button"
                  className="btn-nav"
                  onClick={() => { addEntry(t.actions.stiskNahoru); handleUp() }}
                  title={t.ui.up}
                  aria-label={t.ui.up}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn-nav"
                  onClick={() => { addEntry(t.actions.stiskDolu); handleDown() }}
                  title={t.ui.down}
                  aria-label={t.ui.down}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="btn-nav"
                  onClick={handleOK}
                  title={t.ui.confirm}
                  aria-label={t.ui.confirm}
                >
                  OK
                </button>
              </div>
            </div>

            <div className="printer-bay">
              <div className="printer-door" />
            </div>
          </div>

          <div className="vdo-bottom-section">
            <div className="card-slot-row">
              <div
                ref={slot1Ref}
                role="button" tabIndex={0} aria-label="Vybrat kartu pro slot 1"
                onClick={() => openCardPicker(1)}
                onKeyDown={e => {if(e.key === 'Enter' || e.key === ' '){e.preventDefault();openCardPicker(1)}}}
                className={`slot-shaft-line slot-drop-zone ${!ignitionOn && !displayAwakeFromStandby ? 'slot-shaft-line-ignition-off' : ''} ${card1Data ? 'slot-drop-zone-occupied' : ''} ${dragOverSlot === 1 ? 'slot-drop-zone-highlight' : ''}`}
                onDragOver={(e) => handleSlotDragOver(e, 1)}
                onDragLeave={handleSlotDragLeave}
                onDrop={(e) => handleSlotDrop(e, 1)}
                title={card1Data ? t.ui.slotOccupied : ignitionOn || displayAwakeFromStandby ? t.ui.slot1DragHint : t.ui.ignitionOffNoCard}
              />
              <div className="eject-buttons">
                <button
                  type="button"
                  className="btn-eject"
                  onPointerDown={handleButton1PointerDown}
                  onPointerUp={handleButton1PointerUp}
                  title={t.ui.ejectBtn1Title}
                  aria-label={t.ui.ejectBtn1Title}
                >
                  <span className="btn-eject-icon">{'\u{1F464}'}</span>
                  <span className="btn-eject-num">1</span>
                </button>
                <button
                  type="button"
                  className="btn-eject"
                  onPointerDown={handleButton2PointerDown}
                  onPointerUp={handleButton2PointerUp}
                  title={t.ui.ejectBtn2Title}
                  aria-label={t.ui.ejectBtn2Title}
                >
                  <span className="btn-eject-icon">{'\u{1F464}'}</span>
                  <span className="btn-eject-num">2</span>
                </button>
              </div>
              <div
                ref={slot2Ref}
                role="button" tabIndex={0} aria-label="Vybrat kartu pro slot 2"
                onClick={() => openCardPicker(2)}
                onKeyDown={e => {if(e.key === 'Enter' || e.key === ' '){e.preventDefault();openCardPicker(2)}}}
                className={`slot-shaft-line slot-drop-zone ${!ignitionOn && !displayAwakeFromStandby ? 'slot-shaft-line-ignition-off' : ''} ${card2Data ? 'slot-drop-zone-occupied' : ''} ${dragOverSlot === 2 ? 'slot-drop-zone-highlight' : ''}`}
                onDragOver={(e) => handleSlotDragOver(e, 2)}
                onDragLeave={handleSlotDragLeave}
                onDrop={(e) => handleSlotDrop(e, 2)}
                title={card2Data ? t.ui.slotOccupied : ignitionOn || displayAwakeFromStandby ? t.ui.slot2DragHint : t.ui.ignitionOffNoCard}
              />
            </div>
          </div>
        </div>
        </FaceplateFrame>
        <div className="slot-tap-controls">{([1,2] as const).map(slot => {const card=slot === 1 ? card1Data : card2Data;return <button key={slot} disabled={!!card} onClick={() => openCardPicker(slot)}>Slot {slot} · {card ? card.surname || card.name : 'Vložit kartu'}</button>})}</div>


        <ControlPanel
          t={t}
          language={language}
          ignitionOn={ignitionOn}
          onIgnitionStart={() => setIgnitionOn(true)}
          targetSpeed={targetSpeed}
          onTargetSpeedChange={setTargetSpeed}
          currentSpeed={currentSpeed}
          panelDateTime={panelDateTime}
          canDecrementHours={canDecrementHours}
          canDecrementMinutes={canDecrementMinutes}
          onAdjustHours={adjustHours}
          onAdjustMinutes={adjustMinutes}
          onApplyTime={handleApplyTime}
          remoteDataDownloadActive={remoteDataDownloadActive}
          onRemoteDataDownloadActiveChange={setRemoteDataDownloadActive}
          isDriving={isDriving}
          onStopIgnition={handleStopIgnition}
          onStopDisabledClick={handleStopDisabledClick}
          stopDisabledMessage={stopDisabledMessage}
          onReset={handleReset}
          onSimulate4h10m={handleSimulate4h10m}
          cardInserted={card1Inserted || card2Inserted}
          isMultiManning={isMultiManning}
          onGenerateWorkWeek={handleGenerateWorkWeek}
          workWeekFileInputRef={workWeekFileInputRef}
          onWorkWeekFileChange={handleWorkWeekFileChange}
          onOpenWorkWeekData={handleOpenWorkWeekData}
          onSaveCard1ToFile={handleSaveCard1ToFile}
          onShowCardData={handleShowCardData}
          printVehicleSettings={<PrintVehicleSettings profile={printVehicleProfile} onSave={setPrintVehicleProfile} />}
          infoPanels={(
            <div
              className="info-panels-wrapper info-panels-wrapper--attached"
              role={mobileInfoPanels ? 'region' : undefined}
              aria-label={mobileInfoPanels ? t.ui.infoPanelLabel : undefined}
              tabIndex={mobileInfoPanels ? 0 : undefined}
              onKeyDown={mobileInfoPanels ? (event) => event.stopPropagation() : undefined}
            >
              <div className="info-panels-stack">
                <InfoPanel
                  items={panelItems}
                  mobile={mobileInfoPanels}
                  resetTrigger={infoPanelResetTrigger}
                  symbolMap={symbolMap}
                />
                {!mobileInfoPanels && nr165Visible && (
                  <Nr165WarningBox
                    onClose={() => setNr165Dismissed(true)}
                    symbolMap={symbolMap}
                  />
                )}
              </div>
            </div>
          )}
        />
      </div>
      </div>
      <footer className="vdo-labels">Continental VDO DTCO 4.1 G2V2 · lukas@zmizik.com</footer>
      </div>

      {duplicateDataWarningOpen && (
        <div className="duplicate-data-warning-overlay" onClick={() => setDuplicateDataWarningOpen(false)} role="dialog" aria-modal="true" aria-labelledby="duplicate-data-warning-title">
          <div className="duplicate-data-warning-window" onClick={(e) => e.stopPropagation()}>
            <span className="info-panel-icon info-panel-icon--info duplicate-data-warning-icon" aria-hidden>i</span>
            <h2 id="duplicate-data-warning-title" className="duplicate-data-warning-title">{t.infoPanel.duplicateDataWarning}</h2>
            <button type="button" className="duplicate-data-warning-close" onClick={() => setDuplicateDataWarningOpen(false)} aria-label={t.printOverlay.close}>
              {t.printOverlay.close}
            </button>
          </div>
        </div>
      )}

      <PrintOverlays
        printState={printState}
        t={t}
        simulatedUtcTime={simulatedUtcTime}
        secondHistory={secondHistory}
        symbolMap={symbolMap}
        card1Inserted={card1Inserted}
        card1Data={card1Data}
        driver1ManualEntryBuffer={driver1ManualEntryBuffer}
        slot1CardActivities={driver1PrintCardActivities(
          card1Inserted && card1Data?.cardNumber ? dddCards[card1Data.cardNumber]?.original.activities : null,
        )}
        eventLog={eventLog}
        vehicleEvents={faultsAndEvents}
        vehicleDay={() => ({
          profile: printVehicleProfile,
          localOffsetMs: timeOffsetMs,
          history: activityHistory,
          seconds: secondHistory,
          events: eventLog,
          out: outModeEvents,
          ferry: ferryTrainEvents,
          places: recordedGpsLocations,
          isCrew: isMultiManning,
          resolveCard: (id) => dddCards[id]?.original,
        })}
        vehicleProfile={printVehicleProfile}
        dailyDriverCard={(slot) => {
          const card = slot === 1 ? card1Data : card2Data
          const imported = slot === 1 ? insertedSlot1 : insertedSlot2
          const printCardId = card?.templateId ?? card?.cardNumber
          const ongoing = printCardId ? ongoingPrintCardActivity(secondHistory, printCardId, simulatedUtcTime, isMultiManning) : null
          const simulated = printCardId
            ? simulatedPrintCardActivities(
              imported?.workingActivities ?? cardActivityHistoryByTemplateId[printCardId] ?? [],
              printCardId, ongoing?.startUtc ?? simulatedUtcTime, slot,
            )
            : []
          if (ongoing) simulated.push(ongoing)
          const recordedForCard = (at: number) => simulated.some((activity) => at >= activity.startUtc && at < activity.endUtc)
          return {
            printedAtUtc: simulatedUtcTime,
            localOffsetMs: timeOffsetMs,
            profile: printVehicleProfile,
            card,
            secondCard: slot === 1 ? (card2Inserted ? card2Data : null) : (card1Inserted ? card1Data : null),
            imported: imported?.original,
            secondImported: (slot === 1 ? insertedSlot2 : insertedSlot1)?.original,
            manual: slot === 1 ? driver1ManualEntryBuffer : driver2ManualEntryBuffer,
            simulated,
            vehicleEvents: eventLog,
            simulatedConditions: [
              ...outModeEvents.map((event) => ({
                atUtc: event.minuteStartUtc, kind: event.type === 'activation' ? 'out' : 'out_end',
              })),
              ...ferryTrainEvents.map((event) => ({
                atUtc: event.minuteStartUtc, kind: event.type === 'activation' ? 'ferry' : 'ferry_end',
              })),
            ].filter((event) => recordedForCard(event.atUtc)),
            simulatedPlaces: recordedGpsLocations.flatMap((entry) => {
              if (!recordedForCard(entry.minuteStartUtc)) return []
              const kind = entry.recordType === 'gps_3h' ? 'gps'
                : entry.recordType === 'end_country_card' ? 'end_country' : entry.recordType ?? 'gps'
              return [{ atUtc: entry.minuteStartUtc, kind, detail: entry.gpsLocation }]
            }),
          }
        }}
      />

      {workWeekGraphData !== null &&
        createPortal(
          <WorkWeekGraphView
            days={workWeekGraphData.days}
            countryMarkers={workWeekGraphData.countryMarkers}
            manualEntryBuffer={workWeekGraphData.manualEntryBuffer}
            lastWithdrawalUtc={workWeekGraphData.lastWithdrawalUtc}
            card2Data={workWeekGraphData.card2Data}
            loadUnloadEvents={vehicleLoadUnloadEvents}
            ferryTrainEvents={ferryTrainEvents}
            outModeEvents={outModeEvents}
            recordedGpsLocations={recordedGpsLocations}
            faultsAndEvents={faultsAndEvents}
            symbolMap={symbolMap}
            onResetLoadUnload={() => setVehicleLoadUnloadEvents([])}
            onClose={() => {
              setWorkWeekGraphData(null)
              if (workWeekFileInputRef.current) workWeekFileInputRef.current.value = ''
            }}
          />,
          document.body
        )}

      {dddPreviewOpen && dddPreview !== null &&
        createPortal(
          <WorkWeekGraphView
            days={dddPreview.days}
            countryMarkers={dddPreview.countryMarkers}
            card2Data={dddPreview.card2Data}
            holderName={`${dddPreview.firstName} ${dddPreview.surname}`.trim()}
            focusMs={dddPreview.focusMs}
            onClose={() => setDddPreviewOpen(false)}
          />,
          document.body
        )}
    </div>
    {cardGraphsWindowOpen && (insertedSlot1 || insertedSlot2) && (
      <div className="card-graphs-window-overlay" role="dialog" aria-modal="true" aria-label="Data z karty">
        <div className="card-graphs-window" data-card-graphs-window="">
          <button
            type="button"
            className="card-graphs-window-close"
            data-card-graphs-close=""
            aria-label="Zavřít"
            onClick={() => setCardGraphsWindowOpen(false)}
          >
            ×
          </button>
          <div className="card-graphs-window-body">
            <InsertedCardsHistory slot1={insertedSlot1} slot2={insertedSlot2} vehicleOutEvents={outModeEvents} />
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
