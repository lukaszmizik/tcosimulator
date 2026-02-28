/**
 * Vizuál displeje tachografu - L1, L2, ikonky, všechny obrazovky
 */

import { useState, useEffect } from 'react'
import { useLanguage } from './translations'
import type { SymbolMap } from './TachoTypes'
import type { CardInsertionState, CardWithdrawalState, MenuCountryInputState, MenuLoadUnloadConfirmState, PrintWizardState, ActivityHistoryEntry } from './TachoTypes'
import type { TachoState } from './TachoTypes'
import type { VDODurationsMs } from './VDOCounter'
import {
  formatDurationHhMm,
  remainingDrivingToLimit430,
  aggregateDrivingTwoWeeks,
  aggregateDrivingInWorkShift,
  aggregateOtherWorkInWorkShift,
  getMinimumRestAfterDrivingBlockMs,
  countExtendedDrivingDaysThisWeek,
  getRequiredDailyRestMs,
  getShiftStartFromManualBuffer,
  hasRestBlockInShiftFor9hDaily,
  EXTENDED_DRIVING_LIMIT_MS,
  DAILY_DRIVING_LIMIT_MS,
} from './VDOCounter'
import * as WorkShift from './WorkShift'
import type { MenuItem, MenuNode } from './MenuStructure'
import type { CountryEntry } from './data/countriesLoader'
import { getWarning } from './data/warnings'
import { SPECIAL_SYMBOLS } from './TachoTypes'
import { parseSymbols, getIconChar, TachoIcon, TACHO_FONT } from './Symbols'
import { getActivityCode } from './CardLogic'
import { CardInsertionDisplay2 } from './CardWizard2'
import { loadCard1ActivityHistory } from './data/card1_write_data'
import { loadCard2ActivityHistory } from './data/card2_write_data'

export type TachoDisplayProps = {
  withdrawalBargrafTick?: number
  symbolMap: SymbolMap | null
  cardInsertionState: CardInsertionState | null
  cardWithdrawalState: CardWithdrawalState | null
  drivingWithoutCardWarningActive: boolean
  drivingWithoutValidCardWarningActive: boolean
  breakWarningActive: '415' | '430' | null
  excessSpeedWarningActive?: boolean
  /** Výstraha: při jízdě nelze vysunout kartu – L1 (35)(14) výhoz není, L2 možný */
  ejectionBlockedWarningActive?: boolean
  /** Přepsání: zobraz výstrahu "XX" – zobrazí danou výstrahu bez ohledu na kontext */
  overrideWarningCode?: string | null
  menuCountryInputState: MenuCountryInputState | null
  menuLoadUnloadConfirmState: MenuLoadUnloadConfirmState | null
  printWizardState: PrintWizardState | null
  /** Hláška „výtisk spuštěn“ – zobrazí se 1 s po potvrzení výtisku (timestamp do kdy platí). */
  printStartedToastUntil?: number | null
  displayMode: 'operating' | 'menu'
  /** Pro výběr prioritního zobrazení */
  isBlinking: boolean
  isMultiManning: boolean
  timeStr: string
  currentSpeed: number
  odometerKm: number
  ignitionOn: boolean
  ignitionWarningActive: boolean
  card1Inserted: boolean
  card2Inserted: boolean
  tachoState: TachoState
  countries: CountryEntry[]
  spanishRegions: CountryEntry[]
  lastEjectionTimeBySlot: { 1: number | null; 2: number | null }
  localTime: Date
  currentMenu: MenuNode | null
  selectedItem: MenuItem | null
  currentMenuId: string
  entryMenuId: string
  leftActivityId: TachoState['leftActivityId']
  rightActivityId: TachoState['rightActivityId']
  /** VDO counter aktivní až po stisku šipky – jinak základní obrazovka */
  vdoCounterActive?: boolean
  /** Index obrazovky VDO counter (0–6) na základní obrazovce */
  operatingScreenIndex?: number
  activityDurationsMs?: VDODurationsMs
  activityHistory?: ActivityHistoryEntry[]
  /** Data z karet – klíč templateId (zmizik, novak) */
  cardActivityHistoryByTemplateId?: Record<string, ActivityHistoryEntry[]>
  card1Data?: { templateId?: string } | null
  card2Data?: { templateId?: string } | null
  simulatedUtcTime?: number
  /** Doba řízení od poslední přestávky – per řidič (1=levý slot, 2=pravý) */
  drivingSinceLastBreakMsByDriver?: Record<1 | 2, number>
  restSinceLastBreakMsByDriver?: Record<1 | 2, number>
  /** Dělená pauza: po první 15m proběhla, nyní je potřeba druhá část 30m – per řidič */
  splitFirstPartTakenByDriver?: Record<1 | 2, boolean>
  /** Callback při nedostupnosti prodloužené směny 10h (2× v týdnu již vyčerpáno) */
  onExtendedDrivingUnavailable?: () => void
  /** Vzdálené stahování dat aktivní – animace rotující čáry vedle symbolu (37) */
  remoteDataDownloadActive?: boolean
  /** Manuální záznamy pro odvození začátku směny při null z WorkShift */
  driver1ManualEntryBuffer?: import('./TachoTypes').ManualEntrySegment[]
  driver2ManualEntryBuffer?: import('./TachoTypes').ManualEntrySegment[]
  /** Režim OUT: zobrazit "OUT" na L2 vlevo místo symbolů (vozidlo stojí ≥30 s) */
  showOutOnL2?: boolean
}

function LoadUnloadConfirmDisplay() {
  const { t } = useLanguage()
  return (
    <div className="lcd-two-rows lcd-card-insertion">
      <div className="lcd-row lcd-row-left">{t.tachoDisplay.input}</div>
      <div className="lcd-row lcd-row-left">{t.tachoDisplay.saved}</div>
    </div>
  )
}

export function TachoDisplay(props: TachoDisplayProps) {
  const { symbolMap, cardInsertionState, cardWithdrawalState, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, breakWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, overrideWarningCode, menuCountryInputState, menuLoadUnloadConfirmState, printWizardState, printStartedToastUntil, displayMode } = props

  if (overrideWarningCode) {
    const def = getWarning(overrideWarningCode)
    if (def) {
      return <OverrideWarningDisplay symbolMap={symbolMap} warningDef={def} />
    }
  }
  /** Výstraha vysoké rychlosti – přebírá vše (main dashboard, menu i průvodce), aby řidič okamžitě reagoval. */
  if (excessSpeedWarningActive) {
    return <ExcessSpeedWarningDisplay symbolMap={symbolMap} />
  }
  /** Při jízdě nelze vysunout kartu – blikající výstraha (35)(14) výhoz není / možný */
  if (ejectionBlockedWarningActive) {
    return <EjectionBlockedWarningDisplay symbolMap={symbolMap} />
  }
  if (cardInsertionState) {
    return (
      <CardInsertionDisplay2
        symbolMap={symbolMap}
        cardInsertionState={cardInsertionState}
        isBlinking={props.isBlinking}
        isMultiManning={props.isMultiManning}
        countries={props.countries}
        spanishRegions={props.spanishRegions}
        lastEjectionTimeBySlot={props.lastEjectionTimeBySlot}
        localTime={props.localTime}
        timeStr={props.timeStr}
        currentSpeed={props.currentSpeed}
        odometerKm={props.odometerKm}
        card1Inserted={props.card1Inserted}
        card2Inserted={props.card2Inserted}
        leftActivityId={props.leftActivityId}
        rightActivityId={props.rightActivityId}
      />
    )
  }
  if (cardWithdrawalState) {
    return <CardWithdrawalDisplay {...props} />
  }
  if (drivingWithoutCardWarningActive) {
    return <DrivingWithoutCardWarningDisplay symbolMap={symbolMap} />
  }
  if (drivingWithoutValidCardWarningActive) {
    return <DrivingWithoutValidCardWarningDisplay symbolMap={symbolMap} />
  }
  if (breakWarningActive) {
    return <BreakWarningDisplay symbolMap={symbolMap} breakWarningActive={breakWarningActive} />
  }
  if (menuCountryInputState) {
    return <MenuCountryInputDisplay {...props} />
  }
  if (menuLoadUnloadConfirmState) {
    return <LoadUnloadConfirmDisplay />
  }
  if (printWizardState) {
    return <PrintWizardDisplay {...props} />
  }
  if (printStartedToastUntil != null && Date.now() < printStartedToastUntil) {
    return <PrintStartedDisplay symbolMap={symbolMap} />
  }
  if (displayMode === 'operating') {
    return <OperatingDisplay {...props} />
  }
  return <MenuDisplay {...props} />
}

function CardWithdrawalDisplay(props: TachoDisplayProps) {
  const { symbolMap, cardWithdrawalState, countries, simulatedUtcTime = Date.now() } = props
  const { t } = useLanguage()
  const ws = cardWithdrawalState!

  if (ws.phase === 'bargraf') {
    const elapsed = Date.now() - ws.phaseStartTime
    const BARGRAF_DURATION_MS = 2000
    const progress = Math.min(1, elapsed / BARGRAF_DURATION_MS)
    const filledCount = Math.max(0, 7 - Math.floor(progress * 7))
    const barSegments: Array<{ sym?: number; char?: string }> = [
      { sym: 15 },
      { sym: 15 },
      { sym: 16 },
      { sym: 16 },
      { char: '\u00a6' },
      { char: '\u00a6' },
      { char: '\u00a6' },
    ]
    const slotLabel = String(ws.slot)
    const displayName = ws.cardSurname ?? ws.cardName
    return (
      <div className="lcd-two-rows lcd-card-insertion lcd-withdrawal">
        <div className="lcd-row lcd-row-left">{slotLabel} {displayName}</div>
        <div className="lcd-row lcd-row-left lcd-loading-row lcd-loading-bargraf">
          {barSegments.map((seg, i) => {
            const ch = seg.sym !== undefined ? (symbolMap?.[seg.sym!] ?? `(${seg.sym})`) : seg.char
            return (
              <span key={i} className={`tacho-icon ${i < filledCount ? '' : 'lcd-bargraf-empty'}`}>
                {ch}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  if (ws.phase === 'countrySelect') {
    const code = countries[ws.countryIndex]?.code ?? 'CZ'
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{parseSymbols(`(41)(37)\u00A0${t.tachoDisplay.endCountry}`, symbolMap)}</div>
        <div className="lcd-row lcd-row-left lcd-country-code-blink">:{code}</div>
      </div>
    )
  }

  if (ws.phase === 'print24hQuestion') {
    const line1 = t.menu.items.PD1_24H?.line2 ?? '24h(14)(18) den-tisk'
    const d = new Date(simulatedUtcTime)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const year = d.getUTCFullYear()
    const dateStr = `${day}.${month}.${year}`
    const yesNo = ws.print24hYes ? t.cardWizard.yes : t.cardWizard.no
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">
          <span className="lcd-inline-symbols">{parseSymbols(line1, symbolMap)}</span>
        </div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{dateStr}</span>
          <span className="lcd-decision-1m-blink">{yesNo}</span>
        </div>
      </div>
    )
  }

  return null
}

function OverrideWarningDisplay({ symbolMap, warningDef }: { symbolMap: SymbolMap | null; warningDef: import('./data/warnings').WarningDef }) {
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(warningDef.line1, symbolMap)}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {warningDef.line2 != null ? parseSymbols(warningDef.line2, symbolMap) : null}
      </div>
    </div>
  )
}

function DrivingWithoutCardWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const def = getWarning('28')!
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(def.line1, symbolMap)}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {def.line2}
      </div>
    </div>
  )
}

function DrivingWithoutValidCardWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const def = getWarning('29')!
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(def.line1, symbolMap)}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {def.line2}
      </div>
    </div>
  )
}

function BreakWarningDisplay({ symbolMap, breakWarningActive }: { symbolMap: SymbolMap | null; breakWarningActive: '415' | '430' }) {
  const def = getWarning(breakWarningActive)!
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(def.line1, symbolMap)}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(def.line2!, symbolMap)}
      </div>
    </div>
  )
}

function ExcessSpeedWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const { t } = useLanguage()
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        <span className="lcd-inline-symbols">{parseSymbols('(39)(39)\u00A0', symbolMap)}</span>
        <span>{t.tachoDisplay.excessSpeed}</span>
      </div>
      <div className="lcd-row lcd-row-warning-inline" style={{ justifyContent: 'flex-end' }}>
        <span>30</span>
      </div>
    </div>
  )
}

function EjectionBlockedWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const { t } = useLanguage()
  const l1 = parseSymbols(`(35)(14)\u00A0${t.tachoDisplay.ejectionBlockedL1}`, symbolMap)
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {l1}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {t.tachoDisplay.ejectionBlockedL2}
      </div>
    </div>
  )
}

function PrintWizardDisplay(props: TachoDisplayProps) {
  const { symbolMap, printWizardState, isBlinking } = props
  const { t } = useLanguage()
  const pw = printWizardState!

  if (pw.step === 'utc') {
    const l1 = parseSymbols('výtisk v', symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left"><span className="lcd-inline-symbols">{l1}</span></div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.tachoDisplay.printUtc}</span>
          <span className={`lcd-decision-1m-blink ${isBlinking ? 'lcd-blink-hide' : ''}`}>{pw.utcYes ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  const dayUtc = pw.availableDatesUtc[pw.dateIndex] ?? 0
  const d = new Date(dayUtc)
  const day = d.getUTCDate()
  const month = d.getUTCMonth() + 1
  const year = d.getUTCFullYear()
  const l1 = parseSymbols(pw.menuItemLine2, symbolMap)
  return (
    <div className="lcd-two-rows lcd-card-insertion">
      <div className="lcd-row lcd-row-left"><span className="lcd-inline-symbols">{l1}</span></div>
      <div className="lcd-row lcd-row-left">
        <span className={isBlinking ? 'lcd-blink-hide' : ''}>{String(day).padStart(2, '0')}</span>
        <span>.</span>
        <span>{String(month).padStart(2, '0')}</span>
        <span>.</span>
        <span>{year}</span>
      </div>
    </div>
  )
}

function PrintStartedDisplay(props: { symbolMap: SymbolMap | null }) {
  const { symbolMap } = props
  const { t } = useLanguage()
  const l1 = parseSymbols('výtisk', symbolMap)
  return (
    <div className="lcd-two-rows lcd-card-insertion">
      <div className="lcd-row lcd-row-left"><span className="lcd-inline-symbols">{l1}</span></div>
      <div className="lcd-row lcd-row-left">{t.tachoDisplay.printStarted}</div>
    </div>
  )
}

function MenuCountryInputDisplay(props: TachoDisplayProps) {
  const { symbolMap, menuCountryInputState, isBlinking, countries } = props
  const { t } = useLanguage()
  const mc = menuCountryInputState!
  if (mc.phase === 'confirmSaved') {
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{t.tachoDisplay.input}</div>
        <div className="lcd-row lcd-row-left">{t.tachoDisplay.saved}</div>
      </div>
    )
  }
  const l1 = mc.type === 'start'
    ? parseSymbols(`(37)(36)?\u00A0${t.tachoDisplay.startCountry}`, symbolMap)
    : parseSymbols(`(41)(37)? ${t.tachoDisplay.endCountry}`, symbolMap)
  const code = countries[mc.countryIndex]?.code ?? 'CZ'
  return (
    <div className="lcd-two-rows lcd-card-insertion">
      <div className="lcd-row lcd-row-left">{l1}</div>
      <div className={`lcd-row lcd-row-left lcd-country-code-blink ${isBlinking ? 'lcd-blink-hide' : ''}`}>:{code}</div>
    </div>
  )
}

function OperatingDisplay(props: TachoDisplayProps) {
  const { t } = useLanguage()
  const {
    symbolMap,
    timeStr,
    currentSpeed,
    odometerKm,
    ignitionOn,
    ignitionWarningActive,
    card1Inserted,
    card2Inserted,
    tachoState,
    vdoCounterActive = false,
    operatingScreenIndex = 0,
    activityHistory = [],
    card1Data = null,
    card2Data = null,
    simulatedUtcTime = Date.now(),
    drivingSinceLastBreakMsByDriver = { 1: 0, 2: 0 },
    restSinceLastBreakMsByDriver = { 1: 0, 2: 0 },
    splitFirstPartTakenByDriver = { 1: false, 2: false },
    onExtendedDrivingUnavailable,
    remoteDataDownloadActive = false,
    showOutOnL2 = false,
  } = props

  /** Animace rotující čáry –\|/ při vzdáleném stahování dat */
  const ROTATING_CHARS = ['–', '\\', '|', '/'] as const
  const [rotateIndex, setRotateIndex] = useState(0)
  useEffect(() => {
    if (!remoteDataDownloadActive) return
    const id = setInterval(() => setRotateIndex((i) => (i + 1) % 4), 150)
    return () => clearInterval(id)
  }, [remoteDataDownloadActive])

  /** Standby = zapalování vypnuto – zobrazuje základní údaje pohasle, bez obtěžujících výstrah */
  const isStandby = !ignitionOn
  const showCardWarning = !isStandby && !card1Inserted && ignitionWarningActive
  const leftEdgeChar = getActivityCode(tachoState.leftActivityId)
  const rightEdgeChar = getActivityCode(tachoState.rightActivityId)

  const displayedSpeed = isStandby ? 0 : currentSpeed

  /** VDO counter – zobraz jen po stisku šipky; jinak vždy základní obrazovka */
  if (!vdoCounterActive) {
    /* Základní obrazovka – čas, rychlost, km, karty */
    return (
      <div className={`lcd-two-rows ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''} ${isStandby ? 'lcd-standby' : ''}`} data-multi-manning={tachoState.isMultiManning || undefined} data-standby={isStandby || undefined}>
        <div className="lcd-row">
          <div className="lcd-row-sides">{timeStr}{parseSymbols('(37)', symbolMap)}{remoteDataDownloadActive && <span className="lcd-rotate-spinner">{ROTATING_CHARS[rotateIndex]}</span>}</div>
          <div className="lcd-row-center">
            {'   '}{(card1Inserted || card2Inserted)
              ? parseSymbols(tachoState.isMultiManning ? '(2)(2)' : '(2)', symbolMap)
              : null}
          </div>
          <div className="lcd-row-sides">{tachoState.ferryTrainModeActive ? parseSymbols('(49)\u00A0', symbolMap) : null}{Math.round(displayedSpeed)} km/h</div>
        </div>
        <div className="lcd-row">
          {showCardWarning ? (
            <>
              <div className="lcd-row-sides">
                <TachoIcon code={leftEdgeChar} />
                <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span>
              </div>
              <div className="lcd-row-center lcd-card-warning-blink">
                {parseSymbols(`(14) ${t.tachoDisplay.cardWarning}`, symbolMap)}
              </div>
              <div className="lcd-row-sides">
                <TachoIcon code={rightEdgeChar} />
              </div>
            </>
          ) : (
            <>
              <div className="lcd-row-sides">
                {showOutOnL2 ? (
                  <span className="lcd-out-text">OUT</span>
                ) : (
                  <>
                    <TachoIcon code={leftEdgeChar} />
                    {card1Inserted && (
                      <>
                        <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />
                        <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="lcd-row-center">
                {odometerKm.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
              </div>
              <div className="lcd-row-sides">
                {card2Inserted && (
                  <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />
                )}
                <TachoIcon code={rightEdgeChar} />
                {card2Inserted && (
                  <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  /** Obrazovky 0 a 1: VDO Counter – řidič 1 a 2. Zdroj dat: karta vložena → ze souboru příslušné karty, jinak z paměti tachografu. */
  const screenIndex = Math.max(0, Math.min(6, operatingScreenIndex))
  const driver = screenIndex === 1 && !card2Inserted ? 1 : (screenIndex === 0 ? 1 : 2)
  const useCardData = (driver === 1 && card1Inserted && card1Data?.templateId) || (driver === 2 && card2Inserted && card2Data?.templateId)
  const templateId = driver === 1 ? card1Data?.templateId : card2Data?.templateId
  /** Číslo slotu karty, ze které čerpáme data (1 nebo 2) */
  const cardSlotNum = useCardData && templateId ? (templateId === 'zmizik' ? 1 : 2) : driver
  const historyForDriver = useCardData && templateId
    ? (templateId === 'zmizik' ? loadCard1ActivityHistory() : loadCard2ActivityHistory())
    : activityHistory

  /* VDO Counter – obrazovky 0 a 1 pro řidiče 1 a 2.
   * L1 vlevo: do 9h limit 4h30 blok; od 9h při dostupnosti 10h: zbývá do 10h; jinak 0h0m (chyba)
   * L1 vpravo: pauza 15/30m nebo při denním limitu: denní odpočinek 9h/11h
   * L2 vlevo: součet dob řízení ve dvou po sobě jdoucích kalendářních týdnech
   * L2 vpravo: doba trvání aktivity „jiná práce“ v aktuální pracovní směně */
  if (screenIndex === 0 || screenIndex === 1) {
    const twoWeekDriving = aggregateDrivingTwoWeeks(historyForDriver, driver as 1 | 2, simulatedUtcTime)
    const shiftStart =
      WorkShift.getFirstStartMinuteUtc(driver as 1 | 2) ??
      getShiftStartFromManualBuffer(
        (driver === 1 ? props.driver1ManualEntryBuffer : props.driver2ManualEntryBuffer) ?? [],
        simulatedUtcTime
      )
    const nowMinute = Math.floor(simulatedUtcTime / 60000) * 60000
    const d = new Date(simulatedUtcTime)
    const dayStartUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    const shiftStartForAgg = shiftStart ?? dayStartUtc
    const shiftDrivingMs = aggregateDrivingInWorkShift(historyForDriver, driver as 1 | 2, shiftStartForAgg, nowMinute + 60000)
    const extendedCountThisWeek = countExtendedDrivingDaysThisWeek(historyForDriver, driver as 1 | 2, simulatedUtcTime)
    const isAtOrOver9h = shiftDrivingMs >= 9 * 3600 * 1000
    const hasExtendedAvailable = extendedCountThisWeek < 2
    const drivingSinceLastBreakMs = drivingSinceLastBreakMsByDriver[driver as 1 | 2] ?? 0
    const restSinceLastBreakMs = restSinceLastBreakMsByDriver[driver as 1 | 2] ?? 0
    const splitFirstPartTaken = splitFirstPartTakenByDriver[driver as 1 | 2] ?? false
    const blockRemaining = remainingDrivingToLimit430(drivingSinceLastBreakMs)
    const maxDrivingThisShift = hasExtendedAvailable ? EXTENDED_DRIVING_LIMIT_MS : DAILY_DRIVING_LIMIT_MS
    const dailyRemaining = Math.max(0, maxDrivingThisShift - shiftDrivingMs)
    const remainingDriving = isAtOrOver9h
      ? hasExtendedAvailable
        ? dailyRemaining
        : 0
      : Math.min(blockRemaining, dailyRemaining)
    if (isAtOrOver9h && !hasExtendedAvailable) onExtendedDrivingUnavailable?.()
    const isRestActive = (driver === 1 ? tachoState.leftActivityId : tachoState.rightActivityId) === 'REST'
    const isCrewMode = tachoState.isMultiManning
    const shiftEndForRest = nowMinute + 60000
    const hasRest3hInShift = shiftStart != null
      ? hasRestBlockInShiftFor9hDaily(historyForDriver, driver as 1 | 2, shiftStart, shiftEndForRest, isCrewMode)
      : false
    const requiredDailyRestMs = getRequiredDailyRestMs(isCrewMode, hasRest3hInShift)
    /** Při denním limitu (9h+): L1 vpravo = denní odpočinek 9h/11h (při odpočinku: zbývá); jinak pauza 15/30m */
    const breakRight = drivingSinceLastBreakMs === 0
      ? 0
      : isAtOrOver9h
        ? isRestActive
          ? Math.max(0, requiredDailyRestMs - restSinceLastBreakMs)
          : requiredDailyRestMs
        : isRestActive
          ? getMinimumRestAfterDrivingBlockMs(restSinceLastBreakMs, splitFirstPartTaken)
          : getMinimumRestAfterDrivingBlockMs(0, splitFirstPartTaken)
    const otherWorkInShift = shiftStart != null
      ? aggregateOtherWorkInWorkShift(historyForDriver, driver as 1 | 2, shiftStart, nowMinute + 60000)
      : 0

    return (
      <div className={`lcd-two-rows lcd-vdo-counter ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''} ${isStandby ? 'lcd-standby' : ''}`} data-standby={isStandby || undefined}>
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            {cardSlotNum}
            {parseSymbols('(2)', symbolMap)}
            <span>{formatDurationHhMm(remainingDriving, true)}</span>
          </span>
          <span className="lcd-row-right">
            {parseSymbols('(10)', symbolMap)}
            <span>{formatDurationHhMm(breakRight, true)}</span>
          </span>
        </div>
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            {cardSlotNum}
            {parseSymbols('(2)(58)', symbolMap)}
            <span>{formatDurationHhMm(twoWeekDriving)}</span>
          </span>
          <span className="lcd-row-right">
            {parseSymbols('(9)', symbolMap)}
            <span>{formatDurationHhMm(otherWorkInShift)}</span>
          </span>
        </div>
      </div>
    )
  }

  /* Obrazovka 2–6 a výchozí: Info – čas, rychlost, km, karty */
  return (
    <div className={`lcd-two-rows ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''} ${isStandby ? 'lcd-standby' : ''}`} data-multi-manning={tachoState.isMultiManning || undefined} data-standby={isStandby || undefined}>
      <div className="lcd-row">
        <div className="lcd-row-sides">{timeStr}{parseSymbols('(37)', symbolMap)}{remoteDataDownloadActive && <span className="lcd-rotate-spinner">{ROTATING_CHARS[rotateIndex]}</span>}</div>
        <div className="lcd-row-center">
          {'   '}{(card1Inserted || card2Inserted)
            ? parseSymbols(tachoState.isMultiManning ? '(2)(2)' : '(2)', symbolMap)
            : null}
        </div>
        <div className="lcd-row-sides">{tachoState.ferryTrainModeActive ? parseSymbols('(49)\u00A0', symbolMap) : null}{Math.round(displayedSpeed)} km/h</div>
      </div>
      <div className="lcd-row">
        {showCardWarning ? (
          <>
            <div className="lcd-row-sides">
              <TachoIcon code={leftEdgeChar} />
              <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span>
            </div>
            <div className="lcd-row-center lcd-card-warning-blink">
              {parseSymbols(`(14) ${t.tachoDisplay.cardWarning}`, symbolMap)}
            </div>
            <div className="lcd-row-sides">
              <TachoIcon code={rightEdgeChar} />
            </div>
          </>
        ) : (
          <>
            <div className="lcd-row-sides">
              {showOutOnL2 ? (
                <span className="lcd-out-text">OUT</span>
              ) : (
                <>
                  <TachoIcon code={leftEdgeChar} />
                  {card1Inserted && (
                    <>
                      <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />
                      <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="lcd-row-center">
              {odometerKm.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
            </div>
            <div className="lcd-row-sides">
              {card2Inserted && (
                <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />
              )}
              <TachoIcon code={rightEdgeChar} />
              {card2Inserted && (
                <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MenuDisplay(props: TachoDisplayProps) {
  const { symbolMap, currentMenu, selectedItem, currentMenuId, entryMenuId } = props
  if (!currentMenu) return null
  const item = selectedItem
  const iconChar = item ? getIconChar(item.display_icon ?? null) : ''

  const rawLine1 =
    currentMenuId === entryMenuId
      ? (item?.line1 ?? '')
      : (currentMenu.header_line1 ?? '')
  const rawLine2 = item?.line2 ?? ''
  const line1 = parseSymbols(rawLine1, symbolMap)
  const line2 = parseSymbols(rawLine2, symbolMap)

  return (
    <div className="lcd-two-rows lcd-menu-two-rows">
      <div className="lcd-row lcd-row-menu-title">
        <span className="lcd-menu-title-inline">{line1}</span>
      </div>
      <div className="lcd-row">
        <div className="lcd-menu-item lcd-menu-item-selected">
          {iconChar && (
            <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{iconChar}</span>
          )}
          <span className="lcd-menu-item-text">{line2}</span>
        </div>
      </div>
    </div>
  )
}
