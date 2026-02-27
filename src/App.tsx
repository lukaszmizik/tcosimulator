import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { loadCountries, type CountryEntry } from './data/countriesLoader'
import { buildSymbolMapFromFile } from './Symbols'
import { buildMenusById, applyMenuTranslations, conditionSatisfied, ENTRY_MENU_ID } from './MenuStructure'
import { createInitialCardInsertionState, activityFromChar, getNextActivity, getActivityCode, utcMsToSegment } from './CardLogic'
import { EDITOR_FIELD_ORDER } from './CardLogic'
import { getVirtualLocationForDistance } from './VirtualRoute'
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
  MenuCountryInputState,
  MenuLoadUnloadConfirmState,
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
  FIRST_INSERTION_OFFSET_MS,
  SIM_DT_MS,
  SPEED_STOPPED_THRESHOLD_KMH,
  ACCEL_KMH_PER_SEC,
  DRIVING_LIMIT_415_MS,
  DRIVING_LIMIT_430_MS,
  REST_RESET_MS,
  MULTI_MANNING_ONE_HOUR_MS,
} from './Constants'
import {
  type ActivityKind,
  type TachoState,
  MANUAL_ACTIVITIES,
  MAX_MANUAL_ACTIVITIES,
  ACTIVITY_SYMBOLS,
  TEST_CARDS,
  NO_CARD,
} from './TachoTypes'
import { DRIVING_SYMBOL, segmentToMsUtc } from './CardLogic'
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
import { InfoPanel, useInfoPanelItems, useNr165Warning, Nr165WarningBox } from './InfoPanel'
import { SPLIT_REST_FIRST_MS, SPLIT_REST_SECOND_MS } from './VDOCounter'
import { isWarningCode } from './data/warnings'
import { useLanguage } from './translations'
import { ControlPanel } from './ControlPanel'
import { usePrintState } from './print/usePrintState'
import { PrintOverlays } from './print/PrintOverlays'

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
  const [currentMenuPath, setCurrentMenuPath] = useState<string[]>([ENTRY_MENU_ID])
  const [selectedIndex, setSelectedIndex] = useState(0)
  // Simulovaný čas UTC – vnitřní čas simulátoru, nezávislý na systémovém čase
  const [simulatedUtcTime, setSimulatedUtcTime] = useState(() => Date.now())
  const [timeOffsetMs, setTimeOffsetMs] = useState(0)
  const localTime = useMemo(
    () => new Date(simulatedUtcTime + timeOffsetMs),
    [simulatedUtcTime, timeOffsetMs],
  )
  const [panelDateTime, setPanelDateTime] = useState(() => new Date())
  /** Čas poslední manuální úpravy panelu (+/-) – po tuto dobu nesyncovat panel zpět, aby tlačítko + zůstalo funkční */
  const lastPanelAdjustmentMsRef = useRef<number>(0)
  const [nr165Dismissed, setNr165Dismissed] = useState(false)
  /** Sbalený stav infoboxů – úzký proužek s ikonami */
  const [infoPanelsCollapsed, setInfoPanelsCollapsed] = useState(false)
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
    fetch('/symboly.txt')
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
  // Posun simulovaného času + záznam aktivit v jednom intervalu – nezávisle na React render cyklu.
  // Oprava: pokud visí okno readyToDrivePreDepartureCheck (nebo jiný modal), React může batchovat
  // aktualizace a effect závislý na simulatedUtcTime se nemusí včas spustit → ztráta sekund.
  useEffect(() => {
    const id = setInterval(() => {
      const next = simulatedUtcTimeRef.current + 1000
      setSimulatedUtcTime(next)

      // Sekundový tracker + logování po minutách (přesunuto z useEffect[simulatedUtcTime])
      const timestamp = next
      const speed = currentSpeedRef.current
      const isDriving = speed > 0
      const leftChar = isDriving ? DRIVING_SYMBOL : getActivityCode(leftActivityIdRef.current)
      const rightChar = isDriving ? getActivityCode('AVAILABILITY') : getActivityCode(rightActivityIdRef.current)
      const driver1Activity = activityFromChar(leftChar)
      const driver2Activity = activityFromChar(rightChar)

      setSecondHistory((prev) => {
        const nextArr = [...prev, { timestampUtc: timestamp, driver1: driver1Activity, driver2: driver2Activity, speed }]
        if (nextArr.length > 86400) nextArr.shift()
        return nextArr
      })

      const minuteStartUtc = Math.floor(timestamp / 60000) * 60000
      let acc = minuteAccumulatorRef.current
      const ensureCounts = (): MinuteAccumulator['counts'] => ({
        driver1: { driving: 0, rest: 0, otherWork: 0, availability: 0, none: 0 },
        driver2: { driving: 0, rest: 0, otherWork: 0, availability: 0, none: 0 },
      })

      const finalizeMinute = (m: MinuteAccumulator) => {
        const pickWinner = (counts: Record<ActivityKind, number>, last: ActivityKind): ActivityKind => {
          let max = 0
          let candidates: ActivityKind[] = []
          ;(Object.keys(counts) as ActivityKind[]).forEach((k) => {
            const v = counts[k] ?? 0
            if (v > max) {
              max = v
              candidates = [k]
            } else if (v === max) {
              candidates.push(k)
            }
          })
          if (max === 0) return 'none'
          /* Pravidlo jedné minuty: aktivita se započte jen když v minutě trvá více než 31 s (≥ 32 s). */
          if (max <= 31) return 'none'
          if (candidates.length === 1) return candidates[0]
          return candidates.includes(last) ? last : candidates[0]
        }
        let driver1Winner = pickWinner(m.counts.driver1, m.lastActivity.driver1)
        let driver2Winner = pickWinner(m.counts.driver2, m.lastActivity.driver2)
        if (driver1Winner === 'none') driver1Winner = m.lastActivity.driver1 === 'none' ? 'rest' : m.lastActivity.driver1
        if (driver2Winner === 'none') driver2Winner = m.lastActivity.driver2

        const c1Inserted = card1InsertedRef.current
        const c2Inserted = card2InsertedRef.current
        const tid1 = card1DataRef.current?.templateId
        const tid2 = card2DataRef.current?.templateId
        const entry: ActivityHistoryEntry = {
          minuteStartUtc: m.minuteStartUtc,
          driver1: driver1Winner,
          driver2: driver2Winner,
          gpsLocation: virtualLocationRef.current?.name,
          driver1CardId: c1Inserted && tid1 ? tid1 : NO_CARD,
          driver2CardId: c2Inserted && tid2 ? tid2 : NO_CARD,
        }
        setActivityHistory((prev) => {
          const exists = prev.some((e) => e.minuteStartUtc === entry.minuteStartUtc)
          if (exists) return prev
          return [...prev, entry]
        })
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
        // Režim trajekt: konec při zápisu minuty s jízdou do paměti karty
        if (ferryTrainModeActiveRef.current && (driver1Winner === 'driving' || driver2Winner === 'driving')) {
          setFerryTrainModeActiveRef.current(false)
        }
        // Každé 3 hodiny řízení zaznamenat GPS pozici
        if (driver1Winner === 'driving' || driver2Winner === 'driving') {
          drivingMsSinceLastGpsRecordRef.current += 60000
          const GPS_RECORD_INTERVAL_MS = 3 * 60 * 60 * 1000
          if (drivingMsSinceLastGpsRecordRef.current >= GPS_RECORD_INTERVAL_MS) {
            const gpsName = virtualLocationRef.current?.name ?? '—'
            setRecordedGpsLocations((prev) => [...prev, { minuteStartUtc: m.minuteStartUtc, gpsLocation: gpsName ?? '—', recordType: 'gps_3h' }])
            drivingMsSinceLastGpsRecordRef.current = 0
          }
        }
      }

      if (!acc || acc.minuteStartUtc !== minuteStartUtc) {
        if (acc) finalizeMinute(acc)
        acc = {
          minuteStartUtc,
          secondsInMinute: 0,
          counts: ensureCounts(),
          lastActivity: { driver1: 'none', driver2: 'none' },
        }
        minuteAccumulatorRef.current = acc
      }

      acc.secondsInMinute += 1
      acc.counts.driver1[driver1Activity] = (acc.counts.driver1[driver1Activity] ?? 0) + 1
      acc.counts.driver2[driver2Activity] = (acc.counts.driver2[driver2Activity] ?? 0) + 1
      acc.lastActivity.driver1 = driver1Activity
      acc.lastActivity.driver2 = driver2Activity

      if (driver1Activity === 'driving' || driver2Activity === 'driving') {
        drivingSinceLastGpsMsRef.current += 1000
      }
    }, 1000)
    return () => clearInterval(id)
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
  const panelHours = panelDateTime.getHours()
  const panelMinutes = panelDateTime.getMinutes()
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
  /** Čas (UTC ms), kdy vozidlo zastavilo v režimu OUT – null = jede nebo režim neaktivní. Pro zobrazení "OUT" po ~30 s */
  const [outStoppedAtUtc, setOutStoppedAtUtc] = useState<number | null>(null)
  const [remoteDataDownloadActive, setRemoteDataDownloadActive] = useState(false)
  const [card1EndedByTargetCountry, setCard1EndedByTargetCountry] = useState(false)
  const [activityDurationsMs, setActivityDurationsMs] = useState<ActivityDurationsMs>(() => ({ ...INITIAL_ACTIVITY_DURATIONS }))
  /** Pro VDO counter: doba řízení od poslední přestávky, doba odpočinku – per řidič (1=levý slot, 2=pravý) */
  const [drivingSinceLastBreakMsByDriver, setDrivingSinceLastBreakMsByDriver] = useState<Record<1 | 2, number>>({ 1: 0, 2: 0 })
  const [restSinceLastBreakMsByDriver, setRestSinceLastBreakMsByDriver] = useState<Record<1 | 2, number>>({ 1: 0, 2: 0 })
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
  const [extendedDrivingUnavailableWarning, setExtendedDrivingUnavailableWarning] = useState(false)
  /** Varování: překročení rychlosti >90 km/h déle než 1 min – L1 (39)(39) vys. rychlost, L2 vpravo "30" */
  const [excessSpeedWarningActive, setExcessSpeedWarningActive] = useState(false)
  /** Přepsání: zobraz výstrahu "XX" – volá se povelem zobrazVystrahu("XX") */
  const [overrideWarningCode, setOverrideWarningCode] = useState<string | null>(null)
  /** Výstraha „výhoz není možný“ – zobrazí se jen po pokusu o vyjmutí karty během jízdy, zruší se po zastavení */
  const [ejectionBlockedWarningActive, setEjectionBlockedWarningActive] = useState(false)
  const drivingWithoutCardEventAddedRef = useRef(false)
  const [dragOverSlot, setDragOverSlot] = useState<1 | 2 | null>(null)
  /** Čas posledního vyjmutí karty (pro „Posled. vyjmutí“ v sekvenci vložení). */
  const [lastEjectionTimeBySlot, setLastEjectionTimeBySlot] = useState<{ 1: number | null; 2: number | null }>({ 1: null, 2: null })
  /** Která testovací karta je ve slotu 1/2 (null = prázdný). */
  const [card1Data, setCard1Data] = useState<CardData | null>(null)
  const [card2Data, setCard2Data] = useState<CardData | null>(null)
  /** Sekvence vložení karty (1M) – řízena useCardWizard */
  /** Průvodce vyjmutím karty (Withdrawal Wizard). Trigger: krátký stisk tlačítka slotu s vloženou kartou. */
  const [cardWithdrawalState, setCardWithdrawalState] = useState<CardWithdrawalState | null>(null)
  /** Manuální zadání země v menu (zadání -> řidič 1/2 -> výchozí/cílová země). */
  const [menuCountryInputState, setMenuCountryInputState] = useState<MenuCountryInputState | null>(null)
  /** Potvrzení nakládky/vykládky – L1 zadání L2 uloženo. */
  const [menuLoadUnloadConfirmState, setMenuLoadUnloadConfirmState] = useState<MenuLoadUnloadConfirmState | null>(null)
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
  /** Blikání v manuálním editoru – přepíná každých 500 ms. */
  const [isBlinking, setIsBlinking] = useState(false)
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
  const excessSpeedAbove90MsRef = useRef(0)
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
      setDrivingMode(true)
      if (!wasMoving) setRightActivityId('AVAILABILITY')
      setOutStoppedAtUtc(null)
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

  /** Režim OUT: při aktivaci při stojícím vozidle nastav outStoppedAtUtc, aby se po 30 s zobrazil "OUT" */
  useEffect(() => {
    if (outModeActive && currentSpeed === 0 && outStoppedAtUtc === null) {
      setOutStoppedAtUtc(simulatedUtcTime)
    }
    if (!outModeActive) {
      setOutStoppedAtUtc(null)
    }
  }, [outModeActive, currentSpeed, outStoppedAtUtc, simulatedUtcTime])

  /** Po zastavení vozidla zruš výstrahu „výhoz není možný“ */
  useEffect(() => {
    if (currentSpeed === 0) setEjectionBlockedWarningActive(false)
  }, [currentSpeed])

  useEffect(() => {
    const id = setInterval(() => setIsBlinking((b) => !b), 500)
    return () => clearInterval(id)
  }, [])

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
        setCardWithdrawalState((p) => (p?.phase === 'bargraf' ? { ...p!, phase: 'countrySelect', phaseStartTime: Date.now() } : p))
      } else {
        setWithdrawalBargrafTick((t) => t + 1)
      }
    }
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [cardWithdrawalState?.phase, cardWithdrawalState?.phaseStartTime])

  // Manuální zadání země: po 3 s v confirmSaved vrátit o úroveň výš v menu
  useEffect(() => {
    const mc = menuCountryInputState
    if (!mc || mc.phase !== 'confirmSaved') return
    const returnPath = mc.returnMenuPath.slice(0, -1)
    const elapsed = Date.now() - mc.phaseStartTime
    const CONFIRM_DURATION_MS = 3000
    if (elapsed >= CONFIRM_DURATION_MS) {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuCountryInputState(null)
      return
    }
    const t = setTimeout(() => {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuCountryInputState(null)
    }, CONFIRM_DURATION_MS - elapsed)
    return () => clearTimeout(t)
  }, [menuCountryInputState?.phase, menuCountryInputState?.phaseStartTime, menuCountryInputState?.returnMenuPath])

  // Nakládka/vykládka: po 3 s v confirmSaved vrátit o úroveň výš v menu
  useEffect(() => {
    const lu = menuLoadUnloadConfirmState
    if (!lu) return
    const returnPath = lu.returnMenuPath.slice(0, -1)
    const elapsed = Date.now() - lu.phaseStartTime
    const CONFIRM_DURATION_MS = 3000
    if (elapsed >= CONFIRM_DURATION_MS) {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuLoadUnloadConfirmState(null)
      return
    }
    const t = setTimeout(() => {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuLoadUnloadConfirmState(null)
    }, CONFIRM_DURATION_MS - elapsed)
    return () => clearTimeout(t)
  }, [menuLoadUnloadConfirmState?.phaseStartTime, menuLoadUnloadConfirmState?.returnMenuPath])

  const countriesRef = useRef(countries)
  const spanishRegionsRef = useRef(spanishRegions)
  countriesRef.current = countries
  spanishRegionsRef.current = spanishRegions

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
    setDriver1ManualEntryBuffer,
    setDriver2ManualEntryBuffer,
    isMultiManning,
    onEjectRequested: onEjectRequestedForWizard,
    currentSpeed,
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
      if (prev.slot === 1) {
        setDriver1ManualEntryBuffer((buf) =>
          isDuplicateEndCountry(buf, withdrawalTime, countryCode) ? buf : [...buf, makeEndCountrySegment(withdrawalTime, countryCode)]
        )
      } else {
        setDriver2ManualEntryBuffer((buf) =>
          isDuplicateEndCountry(buf, withdrawalTime, countryCode) ? buf : [...buf, makeEndCountrySegment(withdrawalTime, countryCode)]
        )
      }
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
  }, [countries, isMultiManning, setVdoCounterActive, setDisplayMode, setDriver1ManualEntryBuffer, setDriver2ManualEntryBuffer])

  const handleCardWithdrawalKey = useCallback((action: 'ok' | 'up' | 'down' | 'back') => {
    setCardWithdrawalState((prev) => {
      if (!prev) return null
      if (prev.phase === 'bargraf') return prev
      if (prev.phase === 'countrySelect') {
        if (action === 'up' || action === 'down') {
          const delta = action === 'up' ? 1 : -1
          const len = countries.length || 1
          const i = (prev.countryIndex + delta + len) % len
          return { ...prev, countryIndex: i }
        }
        if (action === 'ok') {
          return { ...prev, phase: 'print24hQuestion', phaseStartTime: Date.now(), print24hYes: false }
        }
        if (action === 'back') {
          const withdrawalTime = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
          const templateId = prev.cardData.templateId
          if (templateId === CARD1_TEMPLATE_ID) saveCard1LastWithdrawal(withdrawalTime)
          else if (templateId === CARD2_TEMPLATE_ID) saveCard2LastWithdrawal(withdrawalTime)
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
      }
      if (prev.phase === 'print24hQuestion') {
        if (action === 'up' || action === 'down') {
          return { ...prev, print24hYes: !(prev.print24hYes ?? false) }
        }
        if (action === 'ok') {
          performCardEjectWithCountry(prev)
          return null
        }
        if (action === 'back') {
          return { ...prev, phase: 'countrySelect', phaseStartTime: Date.now() }
        }
      }
      return prev
    })
  }, [countries, performCardEjectWithCountry, setVdoCounterActive, setDisplayMode, setDriver1ManualEntryBuffer, setDriver2ManualEntryBuffer])

  const handleMenuCountryInputKey = useCallback((action: 'ok' | 'up' | 'down' | 'back') => {
    setMenuCountryInputState((prev) => {
      if (!prev) return null
      if (prev.phase === 'confirmSaved') {
        if (action === 'back') {
          setCurrentMenuPath(prev.returnMenuPath.slice(0, -1))
          setSelectedIndex(0)
          return null
        }
        return prev
      }
      if (prev.phase === 'selecting') {
        if (action === 'up' || action === 'down') {
          const delta = action === 'up' ? 1 : -1
          const len = countries.length || 1
          const i = (prev.countryIndex + delta + len) % len
          return { ...prev, countryIndex: i }
        }
        if (action === 'ok') {
          const countryCode = countries[prev.countryIndex]?.code ?? 'CZ'
          const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
          const gpsName = virtualLocationRef.current?.name
          const gpsStr = gpsName ? `${countryCode}: ${gpsName}` : countryCode
          const isDriver1 = prev.returnMenuPath[prev.returnMenuPath.length - 1] === 'SUB_INPUT_D1'
          const driver = isDriver1 ? (1 as const) : (2 as const)
          const shouldAdd = prev.type === 'start'
            ? WorkShift.onStartCountry(driver, minuteStartUtc).shouldAddToHistory
            : WorkShift.onEndCountry(driver, minuteStartUtc).shouldAddToHistory
          if (shouldAdd) {
            // Pouze jedno časové razítko (jako v CardWizardu) – jen segment do manuálního bufferu, ne do activityHistory.
            // Ochrana proti dvojímu zápisu (např. dvojí volání handleru): nepřidat, pokud buffer už končí stejným razítkem.
            const countrySegment: ManualEntrySegment = {
              ...utcMsToSegment(minuteStartUtc),
              activityId: prev.type === 'start' ? 'START_COUNTRY' : 'END_COUNTRY',
              countryCode,
            }
            const isDuplicateStamp = (buf: ManualEntrySegment[]) => {
              const last = buf[buf.length - 1]
              return last?.activityId === countrySegment.activityId && last?.countryCode === countrySegment.countryCode && segmentToMsUtc(last) === minuteStartUtc
            }
            if (isDriver1) {
              setDriver1ManualEntryBuffer((buf) => (isDuplicateStamp(buf) ? buf : [...buf, countrySegment]))
            } else {
              setDriver2ManualEntryBuffer((buf) => (isDuplicateStamp(buf) ? buf : [...buf, countrySegment]))
            }
            const recordType = prev.type === 'start' ? 'start_country' : 'end_country'
            setRecordedGpsLocations((r) => {
              const last = r[r.length - 1]
              if (last?.minuteStartUtc === minuteStartUtc && last?.recordType === recordType) return r
              return [...r, { minuteStartUtc, gpsLocation: gpsStr ?? countryCode, recordType }]
            })
          }
          return { ...prev, phase: 'confirmSaved', phaseStartTime: Date.now() }
        }
        if (action === 'back') {
          setCurrentMenuPath(prev.returnMenuPath.slice(0, -1))
          setSelectedIndex(0)
          return null
        }
      }
      return prev
    })
  }, [countries, setDriver1ManualEntryBuffer, setDriver2ManualEntryBuffer])

  type MinuteAccumulator = {
    minuteStartUtc: number
    secondsInMinute: number
    counts: {
      driver1: Record<ActivityKind, number>
      driver2: Record<ActivityKind, number>
    }
    lastActivity: {
      driver1: ActivityKind
      driver2: ActivityKind
    }
  }

  const minuteAccumulatorRef = useRef<MinuteAccumulator | null>(null)
  const drivingSinceLastGpsMsRef = useRef(0)
  const drivingMsSinceLastGpsRecordRef = useRef(0)
  const virtualLocationRef = useRef<VirtualRoutePoint | null>(null)
  const odometerKmRef = useRef(odometerKm)
  odometerKmRef.current = odometerKm
  /** Země zjištěná při průjezdu hranic – použije se jako výchozí v nabídce zadání výchozí země */
  const detectedBorderCountryCodeRef = useRef<string | null>(null)

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
    const entry: ActivityHistoryEntry = {
      minuteStartUtc: acc.minuteStartUtc,
      driver1: driver1Winner,
      driver2: driver2Winner,
      gpsLocation: virtualLocationRef.current?.name,
      driver1CardId: c1Inserted && tid1 ? tid1 : NO_CARD,
      driver2CardId: c2Inserted && tid2 ? tid2 : NO_CARD,
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
    () => items.filter((it) => conditionSatisfied(it.condition, tachoState)),
    [items, tachoState],
  )
  const selectedItem = visibleItems[selectedIndex] ?? visibleItems[0]
  const canGoBack = currentMenuPath.length > 1

  // Když je menu prázdné (žádná položka nesplňuje podmínky), návrat na MAIN_LEVEL
  useEffect(() => {
    if (displayMode !== 'menu') return
    if (visibleItems.length > 0) return
    setCurrentMenuPath([ENTRY_MENU_ID])
    setSelectedIndex(0)
  }, [displayMode, visibleItems.length])

  // Držet selectedIndex v mezích po změně visibleItems
  useEffect(() => {
    if (visibleItems.length === 0) return
    setSelectedIndex((prev) => Math.min(prev, visibleItems.length - 1))
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

  // Režim OUT: konec při vytažení karty
  useEffect(() => {
    if (!card1Inserted && !card2Inserted && outModeActive) {
      const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
      const gpsStr = virtualLocationRef.current?.name
      setOutModeEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'deactivation' }])
      setOutModeActive(false)
    }
  }, [card1Inserted, card2Inserted, outModeActive])

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

  // Simulace jízdy: posuvník = cílová rychlost, vozidlo plynule zrychluje/brzdí, km se přičítají dle skutečné rychlosti
  // Zároveň se sčítají doby trvání jednotlivých symbolů (řízení, odpočinek, jiná práce, pohotovost)
  // Důležité: i při vypnutém zapalování (vozidlo v klidu) se aktualizují aktivity (REST), aby L1 vpravo správně odečítal čas přestávky
  useEffect(() => {
    const id = setInterval(() => {
      const ignition = ignitionOnRef.current
      const target = targetSpeedRef.current
      let curr = currentSpeedRef.current
      if (!ignition) {
        curr = Math.max(0, curr - (ACCEL_KMH_PER_SEC * SIM_DT_MS) / 1000)
        currentSpeedRef.current = curr
        setCurrentSpeed(curr)
      } else {
        const step = (ACCEL_KMH_PER_SEC * SIM_DT_MS) / 1000
        const diff = target - curr
        if (Math.abs(diff) <= step) {
          curr = target
        } else {
          curr += Math.sign(diff) * step
        }
        curr = Math.max(0, Math.min(125, curr))
        const avgSpeed = (currentSpeedRef.current + curr) / 2
        currentSpeedRef.current = curr
        /** Při rychlosti pod prahem považuj za zastavené → spustí setDrivingMode(false) a přepne na REST pro L1 vpravo */
        setCurrentSpeed(curr <= SPEED_STOPPED_THRESHOLD_KMH ? 0 : curr)
        const deltaKm = (avgSpeed * SIM_DT_MS) / 3600000
        odometerKmRef.current += deltaKm
        setOdometerKm((prev) => prev + deltaKm)
        const distanceFromStartKm = Math.max(0, odometerKmRef.current - ODOMETER_KM)
        virtualLocationRef.current = getVirtualLocationForDistance(distanceFromStartKm)
      }

      /** Rychlost pod prahem = v klidu → použij manuální aktivitu (REST), aby L1 vpravo správně odečítal přestávku */
      const isDriving = curr > SPEED_STOPPED_THRESHOLD_KMH
      // Hlídání rychlosti: nad 90 km/h déle než 1 min → varování.
      // Hystereze: reset jen při poklesu pod 85 km/h, aby krátké propady (oscilace kolem 90) neresetovaly akumulovaný čas.
      const EXCESS_SPEED_THRESHOLD_KMH = 90
      const EXCESS_SPEED_RESET_BELOW_KMH = 85
      if (curr >= EXCESS_SPEED_THRESHOLD_KMH && ignition) {
        excessSpeedAbove90MsRef.current += SIM_DT_MS
        if (excessSpeedAbove90MsRef.current >= 60000) {
          const ts = simulatedUtcTimeRef.current
          setExcessSpeedWarningActive(true)
          setFaultsAndEvents((prev) => [...prev, { id: Date.now(), timestampUtc: ts, type: 'EXCESS_SPEED_WARNING' }])
          excessSpeedAbove90MsRef.current = 0
        }
      } else if (curr < EXCESS_SPEED_RESET_BELOW_KMH) {
        excessSpeedAbove90MsRef.current = 0
      }
      // Režim trajekt: konec při 1 min jízdy – ferryDrivingMsRef navázán na stejnou detekci jízdy jako aktivity
      if (ferryTrainModeActiveRef.current) {
        if (isDriving) {
          ferryDrivingMsRef.current += SIM_DT_MS
          if (ferryDrivingMsRef.current >= 60000) {
            ferryDrivingMsRef.current = 0
            const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
            const gpsStr = virtualLocationRef.current?.name
            setFerryTrainEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type: 'deactivation' }])
            setFerryTrainModeActiveRef.current(false)
          }
        } else {
          ferryDrivingMsRef.current = 0
        }
      }
      const noCardSlot1 = !card1InsertedRef.current
      if (isDriving && noCardSlot1 && !drivingWithoutCardEventAddedRef.current) {
        drivingWithoutCardEventAddedRef.current = true
        const ts = simulatedUtcTimeRef.current
        setDrivingWithoutCardWarningActive(true)
        setFaultsAndEvents((prev) => [
          ...prev,
          { id: Date.now(), timestampUtc: ts, type: 'DRIVING_WITHOUT_CARD_WARNING' },
        ])
        setEventLog((prev) => [
          ...prev,
          { id: Date.now(), type: 'DRIVING_WITHOUT_CARD', startTime: ts },
        ])
      }

      const leftChar = isDriving ? DRIVING_SYMBOL : getActivityCode(leftActivityIdRef.current)
      const rightChar = isDriving ? getActivityCode('AVAILABILITY') : getActivityCode(rightActivityIdRef.current)
      const add = (char: string) => {
        if (char === DRIVING_SYMBOL) return { driving: SIM_DT_MS, rest: 0, otherWork: 0, availability: 0 }
        const act = MANUAL_ACTIVITIES.find((a) => a.code === char)
        if (act?.id === 'REST') return { driving: 0, rest: SIM_DT_MS, otherWork: 0, availability: 0 }
        if (act?.id === 'WORK') return { driving: 0, rest: 0, otherWork: SIM_DT_MS, availability: 0 }
        if (act?.id === 'AVAILABILITY') return { driving: 0, rest: 0, otherWork: 0, availability: SIM_DT_MS }
        return { driving: 0, rest: 0, otherWork: 0, availability: 0 }
      }
      const leftDelta = add(leftChar)
      const rightDelta = add(rightChar)

      const updateDriver = (driver: 1 | 2, char: string, delta: { driving: number; rest: number }, prevChar: string | null) => {
        const drivingRef = drivingSinceLastBreakMsByDriverRef.current[driver]
        const restRef = restSinceLastBreakMsByDriverRef.current[driver]
        const splitRef = splitFirstPartTakenByDriverRef.current[driver]
        if (char === DRIVING_SYMBOL) {
          if (prevChar !== DRIVING_SYMBOL) {
            if (restRef >= SPLIT_REST_FIRST_MS && restRef < REST_RESET_MS) {
              splitFirstPartTakenByDriverRef.current[driver] = true
              setSplitFirstPartTakenByDriver((p) => ({ ...p, [driver]: true }))
            }
            restSinceLastBreakMsByDriverRef.current[driver] = 0
          }
          drivingSinceLastBreakMsByDriverRef.current[driver] = drivingRef + delta.driving
          if (driver === 1) {
            const d = drivingSinceLastBreakMsByDriverRef.current[1]
            if (d >= DRIVING_LIMIT_430_MS && !breakWarning430DismissedRef.current) setBreakWarningActive('430')
            else if (d >= DRIVING_LIMIT_415_MS && !breakWarning415DismissedRef.current) setBreakWarningActive('415')
          }
        } else if (char === getActivityCode('REST')) {
          restSinceLastBreakMsByDriverRef.current[driver] = restRef + delta.rest
          const rest = restSinceLastBreakMsByDriverRef.current[driver]
          if (rest >= REST_RESET_MS) {
            drivingSinceLastBreakMsByDriverRef.current[driver] = 0
            restSinceLastBreakMsByDriverRef.current[driver] = 0
            splitFirstPartTakenByDriverRef.current[driver] = false
            setSplitFirstPartTakenByDriver((p) => ({ ...p, [driver]: false }))
            if (driver === 1) {
              breakWarning415DismissedRef.current = false
              breakWarning430DismissedRef.current = false
              setBreakWarningActive(null)
            }
          } else if (splitRef && rest >= SPLIT_REST_SECOND_MS) {
            drivingSinceLastBreakMsByDriverRef.current[driver] = 0
            restSinceLastBreakMsByDriverRef.current[driver] = 0
            splitFirstPartTakenByDriverRef.current[driver] = false
            setSplitFirstPartTakenByDriver((p) => ({ ...p, [driver]: false }))
            if (driver === 1) {
              breakWarning415DismissedRef.current = false
              breakWarning430DismissedRef.current = false
              setBreakWarningActive(null)
            }
          }
        } else {
          if (prevChar === getActivityCode('REST')) restSinceLastBreakMsByDriverRef.current[driver] = 0
        }
      }
      const prevLeftChar = prevLeftCharRef.current
      const prevRightChar = prevRightCharRef.current
      prevLeftCharRef.current = leftChar
      prevRightCharRef.current = rightChar
      updateDriver(1, leftChar, leftDelta, prevLeftChar)
      updateDriver(2, rightChar, rightDelta, prevRightChar)

      setActivityDurationsMs((prev) => ({
        driving: prev.driving + leftDelta.driving + rightDelta.driving,
        rest: prev.rest + leftDelta.rest + rightDelta.rest,
        otherWork: prev.otherWork + leftDelta.otherWork + rightDelta.otherWork,
        availability: prev.availability + leftDelta.availability + rightDelta.availability,
      }))
      setDrivingSinceLastBreakMsByDriver({ ...drivingSinceLastBreakMsByDriverRef.current })
      setRestSinceLastBreakMsByDriver({ ...restSinceLastBreakMsByDriverRef.current })
    }, SIM_DT_MS)
    return () => clearInterval(id)
  }, [])

  // Při vypnutí zapalování zrušit zvýraznění šachty a resetovat varování pracovní doby
  useEffect(() => {
    if (!ignitionOn) {
      setDragOverSlot(null)
      setCardWithdrawalState(null)
      setMenuCountryInputState(null)
      setExtendedDrivingUnavailableWarning(false)
      setExcessSpeedWarningActive(false)
      excessSpeedAbove90MsRef.current = 0
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
    setPrintWizardState((prev) => {
      if (!prev) return null
      if (action === 'back') {
        if (prev.step === 'utc') return { ...prev, step: 'date' }
        return null
      }
      if (action === 'up') {
        if (prev.step === 'date') {
          const next = Math.max(prev.dateIndex - 1, 0)
          return { ...prev, dateIndex: next }
        }
        return { ...prev, utcYes: true }
      }
      if (action === 'down') {
        if (prev.step === 'date') {
          const next = Math.min(prev.dateIndex + 1, prev.availableDatesUtc.length - 1)
          return { ...prev, dateIndex: next }
        }
        return { ...prev, utcYes: false }
      }
      if (action === 'ok') {
        if (prev.step === 'date') {
          const dayUtc = prev.availableDatesUtc[prev.dateIndex]
          if (dayUtc == null) return prev
          if (prev.requiresUtcConfirm) return { ...prev, step: 'utc' }
          setCurrentMenuPath(prev.returnMenuPath)
          if (prev.action === 'PRINT_V_DIAGRAM') {
            printState.openPrintVDiagram(dayUtc)
          } else if (prev.action === 'PRINT_24H_D1') {
            printState.openPrintDriver1(dayUtc)
          } else if (prev.action === 'PRINT_24H_V') {
            printState.openPrintVehicle24h(dayUtc, true)
          }
          return null
        }
        const dayUtc = prev.availableDatesUtc[prev.dateIndex]
        setCurrentMenuPath(prev.returnMenuPath)
        if (prev.action === 'PRINT_24H_D1') {
          printState.openPrintDriver1(prev.utcYes ? dayUtc : null)
        } else if (prev.action === 'PRINT_24H_V') {
          printState.openPrintVehicle24h(dayUtc, prev.utcYes)
        }
        return null
      }
      return prev
    })
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
      setVdoCounterActive(true)
      setOperatingScreenIndex((prev) => {
        const canShow = (i: number) => i >= 2 || (i === 0 && card1Inserted) || (i === 1 && card2Inserted)
        let next = prev > 0 ? prev - 1 : 6
        for (let n = 0; n < 7 && !canShow(next); n++) {
          next = next > 0 ? next - 1 : 6
        }
        return next
      })
      return
    }
    if (visibleItems.length === 0) return
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : visibleItems.length - 1))
  }, [ignitionOn, wakeDisplayFromStandby, displayMode, card1Inserted, card2Inserted, visibleItems.length, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, menuLoadUnloadConfirmState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, ignitionWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, isPrintoutActive])

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
      setVdoCounterActive(true)
      if (!vdoCounterActive) {
        setOperatingScreenIndex(card1Inserted ? 0 : card2Inserted ? 1 : 2)
      } else {
        setOperatingScreenIndex((prev) => {
          const canShow = (i: number) => i >= 2 || (i === 0 && card1Inserted) || (i === 1 && card2Inserted)
          let next = prev < 6 ? prev + 1 : 0
          for (let n = 0; n < 7 && !canShow(next); n++) {
            next = next < 6 ? next + 1 : 0
          }
          return next
        })
      }
      return
    }
    if (visibleItems.length === 0) return
    setSelectedIndex((prev) => (prev < visibleItems.length - 1 ? prev + 1 : 0))
  }, [ignitionOn, wakeDisplayFromStandby, displayMode, card1Inserted, card2Inserted, vdoCounterActive, visibleItems.length, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, menuLoadUnloadConfirmState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, ignitionWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, isPrintoutActive])

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
      setCurrentMenuPath([ENTRY_MENU_ID])
      setSelectedIndex(0)
      return
    }
    if (!selectedItem) return
    if (selectedItem.sub_menu && menusById[selectedItem.sub_menu]) {
      addEntry(t.actions.stiskOk, `${t.actions.vstupDoPodmenu} ${selectedItem.line2 ?? selectedItem.sub_menu}`)
      setCurrentMenuPath((path) => [...path, selectedItem.sub_menu!])
      setSelectedIndex(0)
      return
    }
    if (selectedItem.action) {
      const item = selectedItem as import('./MenuStructure').MenuItem & { requiresDate?: boolean; requiresUtcConfirm?: boolean }
      const hasRequiresDate = item.requiresDate === true
      const hasRequiresUtcConfirm = item.requiresUtcConfirm === true
      if (hasRequiresDate && ['PRINT_24H_D1', 'PRINT_V_DIAGRAM', 'PRINT_24H_V'].includes(selectedItem.action)) {
        addEntry(t.actions.stiskOk, `${t.actions.vyberDataProTisk} ${selectedItem.line2 ?? selectedItem.action}`)
        const dayStarts = new Set<number>()
        for (const s of secondHistory) {
          const d = new Date(s.timestampUtc)
          dayStarts.add(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
        }
        let availableDatesUtc = Array.from(dayStarts).sort((a, b) => b - a)
        if (availableDatesUtc.length === 0) {
          const d = new Date(simulatedUtcTime)
          availableDatesUtc = [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())]
        }
        setPrintWizardState({
          action: selectedItem.action,
          step: 'date',
          menuItemLine2: selectedItem.line2,
          dateIndex: 0,
          availableDatesUtc,
          utcYes: true,
          returnMenuPath: [...currentMenuPath],
          requiresUtcConfirm: hasRequiresUtcConfirm,
        })
        return
      }
      if (['PRINT_24H_D1', 'PRINT_EVENT_D1', 'PRINT_ACT_D1'].includes(selectedItem.action)) {
        addEntry(t.actions.stiskOk, `${t.actions.tiskRidic1} ${selectedItem.line2 ?? selectedItem.action}`)
        printState.openPrintDriver1(null)
        return
      }
      if (selectedItem.action === 'PRINT_V_DIAGRAM') {
        addEntry(t.actions.stiskOk, t.actions.tiskVDiagram)
        printState.openPrintVDiagram()
        return
      }
      if (selectedItem.action === 'PRINT_SPEED_V') {
        addEntry(t.actions.stiskOk, `${t.actions.tiskVozidlo} ${selectedItem.line2 ?? ''}`)
        printState.openPrintSpeedVehicle()
        return
      }
      if (selectedItem.action === 'INPUT_START_COUNTRY' || selectedItem.action === 'INPUT_END_COUNTRY') {
        addEntry(t.actions.stiskOk, selectedItem.action === 'INPUT_START_COUNTRY' ? t.actions.otevreniZadaniStart : t.actions.otevreniZadaniEnd)
        const routeToTachographCode: Record<string, string> = { CZ: 'CZ', AT: 'A', DE: 'D', CH: 'CH', FR: 'F', ES: 'E' }
        const gpsCountry = virtualLocationRef.current?.country ?? null
        const defaultCode =
          (gpsCountry && routeToTachographCode[gpsCountry])
            ? routeToTachographCode[gpsCountry]
            : (selectedItem.action === 'INPUT_START_COUNTRY' && detectedBorderCountryCodeRef.current
              ? (routeToTachographCode[detectedBorderCountryCodeRef.current] ?? 'CZ')
              : 'CZ')
        const defaultIndex = Math.max(0, countries.findIndex((c) => c.code === defaultCode))
        setMenuCountryInputState({
          type: selectedItem.action === 'INPUT_START_COUNTRY' ? 'start' : 'end',
          phase: 'selecting',
          phaseStartTime: Date.now(),
          countryIndex: defaultIndex,
          returnMenuPath: [...currentMenuPath],
        })
        return
      }
      if (['ACTION_LOAD', 'ACTION_UNLOAD', 'ACTION_LOAD_UNLOAD_BOTH'].includes(selectedItem.action)) {
        const type: VehicleLoadUnloadEvent['type'] =
          selectedItem.action === 'ACTION_LOAD' ? 'load'
          : selectedItem.action === 'ACTION_UNLOAD' ? 'unload'
          : 'both'
        const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
        const gpsName = virtualLocationRef.current?.name
        const gpsStr = gpsName ?? undefined
        const label = type === 'load' ? t.manualEntry.load : type === 'unload' ? t.manualEntry.unload : t.manualEntry.loadUnload
        addEntry(t.actions.stiskOk, `${t.ui.saved} ${label}${gpsStr ? ` (${gpsStr})` : ''}`)
        setVehicleLoadUnloadEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type }])
        setRecordedGpsLocations((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr ?? '—', recordType: type === 'load' ? 'load' : type === 'unload' ? 'unload' : 'load_unload' }])
        setMenuLoadUnloadConfirmState({ phaseStartTime: Date.now(), returnMenuPath: [...currentMenuPath] })
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
        setOutModeActive(true)
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
  }, [t, ignitionOn, wakeDisplayFromStandby, displayMode, currentSpeed, selectedItem, menusById, currentMenuPath, countries, spanishRegions, secondHistory, simulatedUtcTime, overrideWarningCode, drivingWithoutCardWarningActive, ignitionWarningActive, breakWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, isPrintoutActive, printState, addEntry, getCardInsertionOkDetail])

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
      setCurrentMenuPath((path) => path.slice(0, -1))
      setSelectedIndex(0)
      setMenuLoadUnloadConfirmState(null)
      return
    }
    if (displayMode === 'operating' && vdoCounterActive) {
      addEntry(t.actions.stiskZpet, t.actions.opusteniVdoPrehledu)
      setVdoCounterActive(false)
      return
    }
    if (displayMode === 'menu' && !canGoBack) {
      addEntry(t.actions.stiskZpet, t.actions.navratNaProvozni)
      setDisplayMode('operating')
      return
    }
    if (canGoBack) {
      addEntry(t.actions.stiskZpet, t.actions.navratVMenu)
      setCurrentMenuPath((path) => path.slice(0, -1))
      setSelectedIndex(0)
    }
  }, [t, ignitionOn, wakeDisplayFromStandby, displayMode, canGoBack, vdoCounterActive, overrideWarningCode, cardInsertionState, cardWithdrawalState, printWizardState, menuCountryInputState, menuLoadUnloadConfirmState, handleCardInsertionKey, handleCardWithdrawalKey, handlePrintWizardKey, handleMenuCountryInputKey, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, ignitionWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, isPrintoutActive, printState, addEntry])

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

  const handleSlotDrop = useCallback((e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault()
    if (!ignitionOn && !displayAwakeFromStandby) return
    if (slot === 1 && card1Data) return
    if (slot === 2 && card2Data) return
    const cardId = (e.dataTransfer.getData('card') || e.dataTransfer.getData('text/plain')) as keyof typeof TEST_CARDS | ''
    const template = cardId && TEST_CARDS[cardId] ? TEST_CARDS[cardId] : null
    if (!template) return

    const templateId = cardId === 'zmizik' || cardId === 'novak' ? cardId : undefined
    addEntry(`${t.actions.vlozeniKarty} ${template.surname ?? template.name} do slotu ${slot}`)
    let lastWithdrawal: number | null =
      templateId === 'zmizik'
        ? loadCard1LastWithdrawal()
        : templateId === 'novak'
          ? loadCard2LastWithdrawal()
          : null
    if (lastWithdrawal == null && cardId === 'zmizik') {
      const now = new Date()
      const raw = now.getTime() - FIRST_INSERTION_OFFSET_MS
      const d = new Date(raw)
      d.setSeconds(0, 0)
      lastWithdrawal = d.getTime()
    }
    let name = template.name
    const otherCard = slot === 1 ? card2Data : card1Data
    if (otherCard) {
      lastWithdrawal = otherCard.lastWithdrawal
      name = slot === 2 ? t.ui.driver2 : t.ui.driver1
    }

    const driverState = (templateId && driverCardStateByTemplateId[templateId]) ?? undefined
    const cardData: CardData = {
      ...template,
      lastWithdrawal,
      name,
      templateId,
      isFirstInsertion: driverState?.isFirstInsertion ?? true,
      itsConsent: driverState?.itsConsent,
      vdoConsent: driverState?.vdoConsent,
    }
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
  }, [ignitionOn, displayAwakeFromStandby, simulatedUtcTime, countries, card1Data, card2Data, driverCardStateByTemplateId, driver1ManualEntryBuffer, driver2ManualEntryBuffer, addEntry, setCardInsertionState, virtualLocation])

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
    const currentMsUtc = simulatedUtcTime + timeOffsetMs
    const targetMsUtc = panelDateTime.getTime()
    const deltaMs = targetMsUtc - currentMsUtc

    // Skok zpět – jen přenastavíme offset, nic negenerujeme
    if (deltaMs <= 0) {
      lastPanelAdjustmentMsRef.current = 0
      setTimeOffsetMs(panelDateTime.getTime() - simulatedUtcTime)
      return
    }

    /* Posunout simulatedUtcTime dopředu, aby VDO counter a všechny komponenty reagovaly na čas i když je zobrazen main dashboard */
    setSimulatedUtcTime((prev) => prev + deltaMs)

    // Počet minut k vygenerování; ceil zajišťuje pokrytí částečné minuty (např. 65 s = 2 min)
    const deltaMinutes = Math.ceil(deltaMs / 60000)
    const targetMinuteUtc = Math.floor(targetMsUtc / 60000) * 60000

    if (deltaMinutes > 0) {
      const speedNow = currentSpeedRef.current
      const isDrivingNow = speedNow > 0
      const leftCharNow = isDrivingNow ? DRIVING_SYMBOL : getActivityCode(leftActivityIdRef.current)
      const rightCharNow = isDrivingNow ? getActivityCode('AVAILABILITY') : getActivityCode(rightActivityIdRef.current)

      const driver1Activity = activityFromChar(leftCharNow)
      const driver2Activity = activityFromChar(rightCharNow)

      // startMinuteUtc vždy v UTC; navazujeme na poslední záznam nebo na aktuální simulatedUtcTime
      let startMinuteUtc: number
      if (activityHistory.length > 0) {
        startMinuteUtc = activityHistory[activityHistory.length - 1].minuteStartUtc + 60000
      } else {
        startMinuteUtc = Math.floor(simulatedUtcTime / 60000) * 60000
      }

      const c1Inserted = card1InsertedRef.current
      const c2Inserted = card2InsertedRef.current
      const tid1 = card1DataRef.current?.templateId
      const tid2 = card2DataRef.current?.templateId
      const gpsName = virtualLocationRef.current?.name

      const generated: ActivityHistoryEntry[] = []
      for (let i = 0; i < deltaMinutes; i += 1) {
        const minuteUtc = startMinuteUtc + i * 60000
        // Nepřekračovat cílovou minutu – ochrana proti překryvu s intervalovým efektem
        if (minuteUtc > targetMinuteUtc) break
        generated.push({
          minuteStartUtc: minuteUtc,
          driver1: driver1Activity,
          driver2: driver2Activity,
          gpsLocation: gpsName,
          driver1CardId: c1Inserted && tid1 ? tid1 : NO_CARD,
          driver2CardId: c2Inserted && tid2 ? tid2 : NO_CARD,
        })
      }

      if (generated.length > 0) {
        // Sloučení bez duplicit – ochrana proti překryvu (minuteStartUtc musí být unikátní)
        const existingMinutes = new Set(activityHistory.map((e) => e.minuteStartUtc))
        const toAdd = generated.filter((e) => !existingMinutes.has(e.minuteStartUtc))
        if (toAdd.length > 0) {
          setActivityHistory((prev) => {
            const prevSet = new Set(prev.map((e) => e.minuteStartUtc))
            const filtered = toAdd.filter((e) => !prevSet.has(e.minuteStartUtc))
            return filtered.length > 0 ? [...prev, ...filtered] : prev
          })
          if (c1Inserted && tid1) {
            setCardActivityHistoryByTemplateId((prev) => ({
              ...prev,
              [tid1]: [...(prev[tid1] ?? []), ...toAdd],
            }))
          }
          if (c2Inserted && tid2) {
            setCardActivityHistoryByTemplateId((prev) => ({
              ...prev,
              [tid2]: [...(prev[tid2] ?? []), ...toAdd],
            }))
          }
        }
      }

      const driverForJump = leftCharNow === DRIVING_SYMBOL ? 1 : rightCharNow === DRIVING_SYMBOL ? 2 : null
      const restDriver = leftCharNow === getActivityCode('REST') ? 1 : rightCharNow === getActivityCode('REST') ? 2 : null
      // Výstraha vysoké rychlosti: při přetočení času o ≥60 s s rychlostí ≥90 km/h – stejná pravidla jako v reálném čase
      const EXCESS_SPEED_THRESHOLD_KMH = 90
      const EXCESS_SPEED_RESET_BELOW_KMH = 85
      if (deltaMs >= 60000 && ignitionOnRef.current) {
        if (speedNow >= EXCESS_SPEED_THRESHOLD_KMH) {
          excessSpeedAbove90MsRef.current += deltaMs
          if (excessSpeedAbove90MsRef.current >= 60000) {
            const ts = Math.floor(targetMsUtc / 60000) * 60000
            setExcessSpeedWarningActive(true)
            setFaultsAndEvents((prev) => [...prev, { id: Date.now(), timestampUtc: ts, type: 'EXCESS_SPEED_WARNING' }])
            excessSpeedAbove90MsRef.current = 0
          }
        } else if (speedNow < EXCESS_SPEED_RESET_BELOW_KMH) {
          excessSpeedAbove90MsRef.current = 0
        }
      }
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
    setTimeOffsetMs(panelDateTime.getTime() - simulatedUtcTime - deltaMs)
  }, [panelDateTime, simulatedUtcTime, timeOffsetMs, activityHistory, setActivityHistory])

  const handleStopIgnition = useCallback(() => {
    if (menuCountryInputState?.phase === 'confirmSaved') {
      setCurrentMenuPath(menuCountryInputState.returnMenuPath.slice(0, -1))
      setSelectedIndex(0)
      setMenuCountryInputState(null)
      return
    }
    if (menuLoadUnloadConfirmState) {
      setCurrentMenuPath(menuLoadUnloadConfirmState.returnMenuPath.slice(0, -1))
      setSelectedIndex(0)
      setMenuLoadUnloadConfirmState(null)
      return
    }
    setMenuCountryInputState(null)
    setMenuLoadUnloadConfirmState(null)
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
  }, [menuCountryInputState, menuLoadUnloadConfirmState, printState])

  const handleStopDisabledClick = useCallback(() => {
    setStopDisabledMessage(true)
    setTimeout(() => setStopDisabledMessage(false), 2500)
  }, [])

  const SIMULATE_4H10M_MS = 4 * 3600000 + 10 * 60000

  const handleSimulate4h10m = useCallback(() => {
    const startMs = simulatedUtcTimeRef.current
    const startMinute = Math.floor(startMs / 60000) * 60000
    const endMinute = startMinute + 250 * 60000
    const totalSeconds = 250 * 60

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

    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))

    /** Setrvačnost kamionu: max 2 km/h za sekundu. Žádné okamžité skoky. */
    const MAX_ACCEL_KMH_PER_SEC = 2

    const stepSpeed = (current: number, target: number): number => {
      const diff = target - current
      if (Math.abs(diff) < 0.1) return target
      const delta = diff > 0 ? Math.min(MAX_ACCEL_KMH_PER_SEC, diff) : -Math.min(MAX_ACCEL_KMH_PER_SEC, -diff)
      return Math.max(0, Math.min(125, current + delta))
    }

    type Mode = 'city' | 'highway' | 'jam' | 'restArea' | 'village'
    const modes: Mode[] = ['city', 'highway', 'jam', 'restArea', 'village']

    /** Pravděpodobnostní přechod mezi režimy. */
    const nextMode = (current: Mode): Mode => {
      const r = Math.random()
      if (current === 'highway') {
        if (r < 0.10) return 'highway'
        if (r < 0.30) return 'jam'
        if (r < 0.55) return 'village'
        if (r < 0.70) return 'restArea'
        return 'city'
      }
      if (current === 'city') {
        if (r < 0.25) return 'highway'
        if (r < 0.50) return 'jam'
        if (r < 0.75) return 'village'
        return 'city'
      }
      if (current === 'jam') {
        if (r < 0.35) return 'highway'
        if (r < 0.60) return 'city'
        if (r < 0.85) return 'village'
        return 'jam'
      }
      if (current === 'restArea') return Math.random() < 0.8 ? 'highway' : 'city'
      if (current === 'village') {
        if (r < 0.40) return 'highway'
        if (r < 0.70) return 'city'
        return 'village'
      }
      return modes[randInt(0, modes.length - 1)]
    }

    /** Trvání úseků: Dálnice 15–30 min, Město 5–10 min. Odstranění kmitání. */
    const getSegmentLengthMin = (mode: Mode): number => {
      if (mode === 'highway') return randInt(15, 30)
      if (mode === 'city') return randInt(5, 10)
      if (mode === 'village') return randInt(5, 12)
      if (mode === 'jam') return randInt(5, 15)
      return randInt(2, 5)
    }

    const segments: { mode: Mode; startSec: number; endSec: number }[] = []
    let sec = 0
    let currentMode: Mode = modes[randInt(0, modes.length - 1)]
    while (sec < totalSeconds) {
      const lenMin = getSegmentLengthMin(currentMode)
      const lenSec = lenMin * 60
      const endSec = Math.min(sec + lenSec, totalSeconds)
      segments.push({ mode: currentMode, startSec: sec, endSec })
      sec = endSec
      if (sec < totalSeconds) currentMode = nextMode(currentMode)
    }

    /** Zastávky na semaforu: max 1–2 za hodinu, 30–60 s. */
    const trafficLightStops: { startSec: number; endSec: number }[] = []
    const stopsPerHour = randInt(1, 2)
    const intervalSec = 3600 / stopsPerHour
    let nextStopSec = randInt(intervalSec * 0.3, intervalSec * 0.7)
    while (nextStopSec < totalSeconds) {
      const stopLen = randInt(30, 60)
      trafficLightStops.push({ startSec: nextStopSec, endSec: nextStopSec + stopLen })
      nextStopSec += randInt(Math.floor(intervalSec * 0.8), Math.floor(intervalSec * 1.2))
    }

    const inTrafficLightStop = (sec: number): boolean =>
      trafficLightStops.some((s) => sec >= s.startSec && sec < s.endSec)

    const getSegmentAt = (sec: number) => segments.find((s) => sec >= s.startSec && sec < s.endSec)

    /** Base rychlost – bez vnitřních zastávek v městě/dálnici. Jedině jam a restArea mají 0. */
    const getBaseTarget = (sec: number, mode: Mode, segStart: number): { target: number; activity: ActivityKind } => {
      if (mode === 'city') return { target: 40 + (segStart % 11), activity: 'driving' }
      if (mode === 'highway') return { target: 82 + (segStart % 9), activity: 'driving' }
      if (mode === 'jam') {
        const cycle = Math.floor((sec - segStart) / 25) % 4
        if (cycle === 0) return { target: 0, activity: 'otherWork' }
        return { target: 5 + (segStart % 10), activity: 'driving' }
      }
      if (mode === 'restArea') return { target: 0, activity: 'otherWork' }
      return { target: 48 + (segStart % 5), activity: 'driving' }
    }

    /** Plynulé mikrozměny: dálnice ±2 km/h kolem průměru (85, 87, 86, 84…). */
    let flutterUntilSec = randInt(8, 15)
    let currentFlutter = rand(-2, 2)

    const secondEntries: SecondActivitySnapshot[] = []
    let simSpeed = 0
    let totalDrivingDistance = 0

    for (let sec = 0; sec < totalSeconds; sec++) {
      const timestampUtc = startMs + sec * 1000

      let targetSpeed: number
      let targetActivity: ActivityKind

      if (inTrafficLightStop(sec)) {
        targetSpeed = 0
        targetActivity = 'otherWork'
      } else {
        const seg = getSegmentAt(sec)
        const mode = seg?.mode ?? 'highway'
        const segStart = seg?.startSec ?? 0
        const base = getBaseTarget(sec, mode, segStart)

        if (sec >= flutterUntilSec) {
          currentFlutter = mode === 'highway' ? rand(-2, 2) : rand(-2, 2)
          flutterUntilSec = sec + randInt(8, 18)
        }
        const clampedTarget = Math.max(0, Math.min(125, base.target + currentFlutter))
        targetSpeed = clampedTarget
        targetActivity = base.activity
      }

      const driver2Activity = isMultiManningRef.current && targetActivity === 'driving' ? 'availability' : 'none'
      if (targetActivity === 'otherWork') {
        simSpeed = stepSpeed(simSpeed, 0)
        secondEntries.push({ timestampUtc, driver1: 'otherWork', driver2: 'none', speed: simSpeed })
      } else {
        simSpeed = stepSpeed(simSpeed, targetSpeed)
        secondEntries.push({ timestampUtc, driver1: 'driving', driver2: driver2Activity, speed: simSpeed })
        totalDrivingDistance += (simSpeed / 3600) * 1
      }
    }

    const countByMinute = new Map<number, { driving: number; otherWork: number }>()
    const distanceByMinute = new Map<number, number>()
    for (const e of secondEntries) {
      const minIdx = Math.floor((e.timestampUtc - startMs) / 60000)
      const c = countByMinute.get(minIdx) ?? { driving: 0, otherWork: 0 }
      if (e.driver1 === 'driving') c.driving++
      else c.otherWork++
      countByMinute.set(minIdx, c)
      const dist = (e.speed / 3600) * 1
      distanceByMinute.set(minIdx, (distanceByMinute.get(minIdx) ?? 0) + dist)
    }

    const c1Inserted = card1InsertedRef.current
    const c2Inserted = card2InsertedRef.current
    const tid1 = card1DataRef.current?.templateId
    const tid2 = card2DataRef.current?.templateId
    const distanceFromStartAtSimBegin = Math.max(0, odometerKmRef.current - ODOMETER_KM)

    const activityEntries: ActivityHistoryEntry[] = []
    let drivingMs = 0
    let otherWorkMs = 0
    let drivingMinutesSinceLastGps = 0
    const gpsRecordsFromSim: RecordedGpsLocation[] = []
    let cumulativeKm = distanceFromStartAtSimBegin
    for (let m = 0; m < 250; m++) {
      const minuteStartUtc = startMinute + m * 60000
      const c = countByMinute.get(m) ?? { driving: 0, otherWork: 0 }
      /* Pravidlo jedné minuty: řízení se započte jen když v minutě odřídím více než 31 s (≥ 32 s). */
      const driver1: ActivityKind = c.driving > 31 ? 'driving' : 'otherWork'
      const driver2: ActivityKind = isMultiManningRef.current && driver1 === 'driving' ? 'availability' : 'none'
      const distThisMin = distanceByMinute.get(m) ?? 0
      cumulativeKm += distThisMin
      const gpsLocation = getVirtualLocationForDistance(cumulativeKm).name
      activityEntries.push({
        minuteStartUtc,
        driver1,
        driver2,
        gpsLocation,
        driver1CardId: c1Inserted && tid1 ? tid1 : NO_CARD,
        driver2CardId: c2Inserted && tid2 ? tid2 : NO_CARD,
      })
      if (driver1 === 'driving') {
        drivingMs += 60000
        drivingMinutesSinceLastGps += 1
        if (drivingMinutesSinceLastGps >= 180) {
          gpsRecordsFromSim.push({ minuteStartUtc, gpsLocation, recordType: 'gps_3h' as const })
          drivingMinutesSinceLastGps = 0
        }
      } else {
        otherWorkMs += 60000
      }
    }

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
    setSimulatedUtcTime(nowUtc)
    setPanelDateTime(new Date(nowUtc))
    setTimeOffsetMs(0)
    setSecondHistory(generatedSecondHistory)
    drivingSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
    restSinceLastBreakMsByDriverRef.current = { 1: 0, 2: 0 }
    setDrivingSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
    setRestSinceLastBreakMsByDriver({ 1: 0, 2: 0 })
    exportWorkWeekToTxt(generated, manualEntryBuffer, slotIndex)
    const { activities, countryMarkers } = simulatorToGraphData(generated, manualEntryBuffer, slotIndex)
    const days = activitiesByDay(activities)
    const daysToShow = activities.length > 0 ? expandToWeeksContainingData(days, Math.min(...activities.map((a) => a.startMs))) : expandToWeeksContainingData([], nowUtc)
    setWorkWeekGraphData({ days: daysToShow, countryMarkers })
  }, [activityHistory, driver1ManualEntryBuffer, cardActivityHistoryByTemplateId])

  const handleShowCardData = useCallback(() => {
    try {
      const insertionTimeMs = simulatedUtcTimeRef.current
      const refMs = simulatedUtcTimeRef.current

      // Při dvou kartách použij sloučenou historii – zajišťuje správná data pro oba sloty
      const bothInserted = card1Data != null && card2Data != null
      const tid1 = card1Data?.templateId ?? CARD1_TEMPLATE_ID
      const tid2 = card2Data?.templateId ?? CARD2_TEMPLATE_ID
      const card1History = bothInserted ? activityHistory : (cardActivityHistoryByTemplateId[tid1] ?? activityHistory)
      const { activities, countryMarkers: rawCountryMarkers } = simulatorToGraphData(card1History, driver1ManualEntryBuffer, 1, {
        lastWithdrawalMs: card1Data?.lastWithdrawal ?? loadCard1LastWithdrawal(),
        insertionTimeMs,
      })
      const lastWithdraw = card1Data?.lastWithdrawal ?? loadCard1LastWithdrawal()
      let countryMarkers = rawCountryMarkers
      if (card1EndedByTargetCountry && lastWithdraw != null) {
        const d = new Date(lastWithdraw)
        const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        const dateStr = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
        countryMarkers = [...countryMarkers, { activityId: 'END_COUNTRY' as const, countryCode: 'CZ', timeStr, dateStr }]
      }
      const days = activitiesByDay(activities)
      const refForExpand = activities.length > 0 ? Math.min(...activities.map((a) => a.startMs)) : refMs
      const daysToShow = expandToWeeksContainingData(days, refForExpand)

      let card2GraphData: { days: DayData[]; countryMarkers: CountryMarker[]; manualEntryBuffer?: ManualEntrySegment[]; lastWithdrawalUtc?: number | null } | undefined
      try {
        const card2History = bothInserted ? activityHistory : (cardActivityHistoryByTemplateId[tid2] ?? activityHistory)
        const { activities: activities2, countryMarkers: countryMarkers2 } = simulatorToGraphData(card2History, driver2ManualEntryBuffer, 2, {
          lastWithdrawalMs: card2Data?.lastWithdrawal ?? loadCard2LastWithdrawal(),
          insertionTimeMs,
        })
        const days2 = activitiesByDay(activities2)
        const lastWithdraw2 = card2Data?.lastWithdrawal ?? loadCard2LastWithdrawal()
        const ref2 = activities2.length > 0 ? Math.min(...activities2.map((a) => a.startMs)) : refMs
        const daysToShow2 = expandToWeeksContainingData(days2, ref2)
        card2GraphData = { days: daysToShow2, countryMarkers: countryMarkers2, manualEntryBuffer: driver2ManualEntryBuffer, lastWithdrawalUtc: lastWithdraw2 }
      } catch {
        card2GraphData = undefined
      }

      setWorkWeekGraphData({ days: daysToShow, countryMarkers, manualEntryBuffer: driver1ManualEntryBuffer, lastWithdrawalUtc: lastWithdraw, card2Data: card2GraphData })
    } catch {
      const txt = workWeekToTxtString(activityHistory, driver1ManualEntryBuffer, 1)
      const parsed = parseWorkWeekTxt(txt)
      const days = activitiesByDay(parsed.activities)
      const lastWithdraw = card1Data?.lastWithdrawal ?? loadCard1LastWithdrawal()
      const refMs = simulatedUtcTimeRef.current
      const refFallback = parsed.activities.length > 0 ? Math.min(...parsed.activities.map((a) => a.startMs)) : refMs
      const daysToShow = expandToWeeksContainingData(days, refFallback)

      let card2GraphData: { days: DayData[]; countryMarkers: CountryMarker[]; manualEntryBuffer?: ManualEntrySegment[]; lastWithdrawalUtc?: number | null } | undefined
      try {
        const txt2 = workWeekToTxtString(activityHistory, driver2ManualEntryBuffer, 2)
        const parsed2 = parseWorkWeekTxt(txt2)
        const days2 = activitiesByDay(parsed2.activities)
        const ref2Fallback = parsed2.activities.length > 0 ? Math.min(...parsed2.activities.map((a) => a.startMs)) : refMs
        const daysToShow2 = expandToWeeksContainingData(days2, ref2Fallback)
        card2GraphData = { days: daysToShow2, countryMarkers: parsed2.countryMarkers, manualEntryBuffer: driver2ManualEntryBuffer, lastWithdrawalUtc: card2Data?.lastWithdrawal ?? loadCard2LastWithdrawal() }
      } catch {
        card2GraphData = undefined
      }

      setWorkWeekGraphData({ days: daysToShow, countryMarkers: parsed.countryMarkers, manualEntryBuffer: driver1ManualEntryBuffer, lastWithdrawalUtc: lastWithdraw, card2Data: card2GraphData })
    }
  }, [activityHistory, cardActivityHistoryByTemplateId, driver1ManualEntryBuffer, driver2ManualEntryBuffer, card1Data, card2Data, card1EndedByTargetCountry])

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
    drivingWithoutCardEventAddedRef.current = false
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
    excessSpeedAbove90MsRef.current = 0
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
    setMenuCountryInputState(null)
    setMenuLoadUnloadConfirmState(null)
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

  const handleExtendedDrivingUnavailable = useCallback(() => {
    setExtendedDrivingUnavailableWarning(true)
  }, [])

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
    onExtendedDrivingUnavailable: handleExtendedDrivingUnavailable,
    menuCountryInputState,
    menuLoadUnloadConfirmState,
    printWizardState,
    printStartedToastUntil: printState.printStartedToastUntil,
    displayMode,
    isBlinking,
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
    drivingSinceLastBreakMsByDriver,
    restSinceLastBreakMsByDriver,
    splitFirstPartTakenByDriver,
    remoteDataDownloadActive,
    driver1ManualEntryBuffer,
    driver2ManualEntryBuffer,
    /** Režim OUT: zobrazit "OUT" na L2 vlevo – vozidlo stojí ≥30 s */
    showOutOnL2: outModeActive && currentSpeed === 0 && outStoppedAtUtc != null && simulatedUtcTime - outStoppedAtUtc >= 30000,
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
    card1EndedByTargetCountry,
    card1LastWithdrawalUtc: card1Data?.lastWithdrawal ?? lastEjectionTimeBySlot[1],
    menuComingSoonInfo,
    outModeActive,
  })
  const showNr165Warning = useNr165Warning({
    menuCountryInputState,
    driver1ManualEntryBuffer,
    driver2ManualEntryBuffer,
  })

  return (
    <div className="app-root" data-lang={language} style={{ minHeight: '100vh', background: '#444', display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', margin: 0, padding: 24, gap: 24 }}>
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
      </div>
      <div className="device-column" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
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
        data-extended-driving-unavailable={extendedDrivingUnavailableWarning}
      >
        <div className="vdo-main-panel">
          <div className="vdo-top-section">
            <div className="display-area">
              <div
                id="main-display"
                className={`lcd-screen ${!ignitionOn && !displayAwakeFromStandby ? 'lcd-screen-off' : ''}`}
              >
                <TachoDisplay {...displayProps} />
              </div>
              <div className="display-controls">
                <button
                  type="button"
                  className="btn-nav"
                  onClick={handleBack}
                  title={t.ui.back}
                >
                  {'\u21A9'}
                </button>
                <button
                  type="button"
                  className="btn-nav"
                  onClick={() => { addEntry(t.actions.stiskNahoru); handleUp() }}
                  title={t.ui.up}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn-nav"
                  onClick={() => { addEntry(t.actions.stiskDolu); handleDown() }}
                  title={t.ui.down}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="btn-nav"
                  onClick={handleOK}
                  title={t.ui.confirm}
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
                >
                  <span className="btn-eject-icon">{'\u{1F464}'}</span>
                  <span className="btn-eject-num">2</span>
                </button>
              </div>
              <div
                ref={slot2Ref}
                className={`slot-shaft-line slot-drop-zone ${!ignitionOn && !displayAwakeFromStandby ? 'slot-shaft-line-ignition-off' : ''} ${card2Data ? 'slot-drop-zone-occupied' : ''} ${dragOverSlot === 2 ? 'slot-drop-zone-highlight' : ''}`}
                onDragOver={(e) => handleSlotDragOver(e, 2)}
                onDragLeave={handleSlotDragLeave}
                onDrop={(e) => handleSlotDrop(e, 2)}
                title={card2Data ? t.ui.slotOccupied : ignitionOn || displayAwakeFromStandby ? t.ui.slot2DragHint : t.ui.ignitionOffNoCard}
              />
            </div>
          </div>
        </div>
        <div className="vdo-labels">Continental VDO DTCO 4.1 G2V2</div>

        <ControlPanel
          t={t}
          card1Data={card1Data}
          card2Data={card2Data}
          ignitionOn={ignitionOn}
          onIgnitionStart={() => setIgnitionOn(true)}
          targetSpeed={targetSpeed}
          onTargetSpeedChange={setTargetSpeed}
          currentSpeed={currentSpeed}
          panelHours={panelHours}
          panelMinutes={panelMinutes}
          canDecrementHours={canDecrementHours}
          canDecrementMinutes={canDecrementMinutes}
          onAdjustHours={adjustHours}
          onAdjustMinutes={adjustMinutes}
          onApplyTime={handleApplyTime}
          remoteDataDownloadActive={remoteDataDownloadActive}
          onRemoteDataDownloadActiveChange={setRemoteDataDownloadActive}
          card1EndedByTargetCountry={card1EndedByTargetCountry}
          onCard1EndedByTargetCountryChange={setCard1EndedByTargetCountry}
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
          onCardDragStart={handleCardDragStart}
        />
      </div>

      <div className={`info-panels-wrapper info-panels-wrapper--attached ${infoPanelsCollapsed ? 'info-panels-wrapper--collapsed' : ''}`}>
          <button
            type="button"
            className="info-panels-toggle"
            onClick={() => setInfoPanelsCollapsed((c) => !c)}
            aria-label={infoPanelsCollapsed ? t.ui.expandInfoboxes : t.ui.collapseInfoboxes}
            aria-expanded={!infoPanelsCollapsed}
          >
            <span className="info-panels-toggle-arrow" data-collapsed={infoPanelsCollapsed}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </span>
          </button>
          {infoPanelsCollapsed ? (
            <div className="info-panels-strip">
              <InfoPanel items={infoPanelItems} resetTrigger={infoPanelResetTrigger} symbolMap={symbolMap} collapsed />
              {showNr165Warning && !nr165Dismissed && (
                <Nr165WarningBox onClose={() => setNr165Dismissed(true)} symbolMap={symbolMap} collapsed />
              )}
            </div>
          ) : (
            <div className="info-panels-stack">
              <InfoPanel items={infoPanelItems} resetTrigger={infoPanelResetTrigger} symbolMap={symbolMap} />
              {showNr165Warning && !nr165Dismissed && (
                <Nr165WarningBox onClose={() => setNr165Dismissed(true)} symbolMap={symbolMap} />
              )}
            </div>
          )}
        </div>
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
        eventLog={eventLog}
        odometerKm={odometerKm}
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
    </div>
  )
}
