import { LANGUAGE_PAGE, MAIN_MENU_PAGE, UTC_PAGE, languageLabels, utcRows } from './firstLevelDisplay'
import type { SupportedLanguage } from './translations/types'
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
  formatDurationHm,
} from './VDOCounter'
import type { MenuItem, MenuNode } from './MenuStructure'
import type { CountryEntry } from './data/countriesLoader'
import { getWarning } from './data/warnings'
import { SPECIAL_SYMBOLS } from './TachoTypes'
import { parseSymbols, getIconChar, TachoIcon, TACHO_FONT } from './Symbols'
import { formatLcdOdometer, getActivityCode } from './CardLogic'
import { CardInsertionDisplay2 } from './CardInsertionDisplay2'
import {
  BreakWarningDisplay,
  DrivingWithoutCardWarningDisplay,
  EjectionBlockedWarningDisplay,
  ExcessSpeedWarningDisplay,
  OverrideWarningDisplay,
} from './WarningDisplays'
import type { DrivingBreakDisplay } from './drivingBreakDisplay'
import type { VdoNamedScreen } from './slot1DddCounter'

export type TachoDisplayProps = {
  expiryNote?: { slot: 1 | 2; days: number } | null
  lcdPreview?: boolean
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
  timeOffsetMs?: number
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
  /** Pojmenovaná obrazovka. Hlavní Counter je výchozí obrazovka bez názvu. */
  languageDraft?: SupportedLanguage | null
  languageSaved?: boolean
  vdoNamedScreen?: VdoNamedScreen | null
  /** Odjetý čas od platného odpočinku. null je neznámý a na přehledu se ukáže jako pomlčky. */
  drivenSinceRestMs?: number | null
  /** Uznaná přestávka. null je neznámá. 0 je skutečná nula. */
  recognizedBreakMs?: number | null
  /** Trvání aktuální činnosti od její poslední změny, zvlášť pro každou šachtu. */
  activityDurationMsByDriver?: { 1: number | null; 2: number | null }
  /**
   * Počitadlo pracovní doby řidiče, jehož Counter je otevřený.
   * null u položky je nedoložená hodnota a na LCD se ukáže jako pomlčky.
   */
  workTime?: {
    currentWithoutRestMs: number | null
    sinceDailyOrWeeklyRestMs: number | null
    breaksInPeriodMs: number | null
    calendarWeekMs: number | null
  } | null
  activityDurationsMs?: VDODurationsMs
  activityHistory?: ActivityHistoryEntry[]
  /** Data z karet – klíč templateId (zmizik, novak) */
  cardActivityHistoryByTemplateId?: Record<string, ActivityHistoryEntry[]>
  card1Data?: { templateId?: string } | null
  card2Data?: { templateId?: string } | null
  simulatedUtcTime?: number
  /** Vzdálené stahování dat aktivní – animace rotující čáry vedle symbolu (37) */
  remoteDataDownloadActive?: boolean
  /** Manuální záznamy pro odvození začátku směny při null z WorkShift */
  driver1ManualEntryBuffer?: import('./TachoTypes').ManualEntrySegment[]
  driver2ManualEntryBuffer?: import('./TachoTypes').ManualEntrySegment[]
  /** Režim OUT: zobrazit "OUT" na L2 vlevo místo symbolů (vozidlo stojí ≥30 s) */
  showOutOnL2?: boolean
  /**
   * Jen ?debug=1 a podporovaný řidič ve šachtě 1.
   * U virtuální karty jsou stropy už v hodnotách.
   */
  slot1DebugBreak?: DrivingBreakDisplay | null
  /**
   * Denní zbytek z osy DDD karty. null znamená, že období na kartě není známé
   * a paměť vozidla se nesmí použít. undefined ponechá dosavadní denní zbytek obrazovky.
   */
  slot1DebugDailyRemainingMs?: number | null
  /** Týdenní zbytek z osy DDD karty. null je neurčený a do minima se nezařadí. */
  slot1DebugWeeklyRemainingMs?: number | null
  /** Dvoutýdenní zbytek z osy DDD karty. null je neurčený a do minima se nezařadí. */
  slot1DebugFortnightRemainingMs?: number | null
  /** Dvoutýdenní součet z osy DDD karty. null je neúplné pokrytí a na LCD se ukáže ----. */
  slot1DebugFortnightSumMs?: number | null
  /** Zbývající prodloužení na 10 h. null je neurčené, 0 je skutečná nula. */
  slot1DebugDailyExtensionsRemaining?: number | null
  /** Jiná práce ve směně. null je neurčené a na LCD se ukáže ----. undefined ponechá původní součet. */
  slot1DebugOtherWorkMs?: number | null
  /** false: zbývající řízení nelze doložit. Přestávka se tím neruší. */
  slot1DebugDrivingKnown?: boolean
  /**
   * Při zapnutém trajektu zbývající pravidelný denní odpočinek.
   * null je nedoložený odpočinek a na dolním řádku se ukáže ----. Číslo 0 je skutečná nula.
   */
  slot1DebugFerryRestMs?: number | null
  /** Součet přes přerušení je podmíněný: záznamy nepotvrzují lůžko a značka trajektu ho nedokazuje. */
  slot1DebugFerryRestConditional?: boolean
}

function activitySymbol(activityId: string): string {
  if (activityId === 'DRIVING') return '(2)'
  if (activityId === 'WORK') return '(9)'
  if (activityId === 'AVAILABILITY') return '(7)'
  return '(8)'
}

function driverSymbol(driver: 1 | 2): string {
  return driver === 1 ? '(12)' : '(13)'
}

function formatOverviewTime(ms: number | null | undefined): string {
  return typeof ms === 'number' ? formatDurationHm(ms) : '--h--'
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
  const { language } = useLanguage()
  const { symbolMap, cardInsertionState, cardWithdrawalState, drivingWithoutCardWarningActive, drivingWithoutValidCardWarningActive, breakWarningActive, excessSpeedWarningActive, ejectionBlockedWarningActive, overrideWarningCode, menuCountryInputState, menuLoadUnloadConfirmState, printWizardState, printStartedToastUntil, displayMode, showOutOnL2 = false } = props

  if (typeof window !== 'undefined' && window.location.search.includes('debug=1')) {
    // Diagnostika: která větev se vykresluje (otevři konzoli F12)
    const branch =
      overrideWarningCode ? 'override' :
      excessSpeedWarningActive ? 'excessSpeed' :
      ejectionBlockedWarningActive ? 'ejectionBlocked' :
      showOutOnL2 && props.displayMode === 'operating' ? 'OUT_OperatingDisplay' :
      cardInsertionState ? 'cardInsertion' :
      cardWithdrawalState ? 'cardWithdrawal' :
      drivingWithoutCardWarningActive && !showOutOnL2 ? 'drivingWithoutCardWarning' :
      drivingWithoutValidCardWarningActive ? 'drivingWithoutValidCard' :
      breakWarningActive ? 'breakWarning' :
      displayMode === 'operating' ? 'OperatingDisplay' :
      'MenuDisplay'
    console.log('[TachoDisplay]', { showOutOnL2, displayMode: props.displayMode, drivingWithoutCardWarningActive, branch })
  }

  if (overrideWarningCode) {
    const def = getWarning(overrideWarningCode, language)
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
  /** Režim OUT (bez vložené karty): na hlavní obrazovce zobrazit nápis OUT místo symbolů aktivit. V menu zůstane menu. */
  if (!props.expiryNote && showOutOnL2 && props.displayMode === 'operating') {
    return <OperatingDisplay {...props} />
  }
  if (cardInsertionState) {
    return (
      <CardInsertionDisplay2
        lcdPreview={props.lcdPreview}
        symbolMap={symbolMap}
        cardInsertionState={cardInsertionState}
        isMultiManning={props.isMultiManning}
        countries={props.countries}
        spanishRegions={props.spanishRegions}
        lastEjectionTimeBySlot={props.lastEjectionTimeBySlot}
        localTime={props.localTime}
        timeOffsetMs={props.timeOffsetMs ?? 0}
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
  /** V režimu OUT se výstraha „jízda bez karty“ nezobrazuje – místo ní hlavní obrazovka s nápisem OUT. */
  if (drivingWithoutCardWarningActive && !showOutOnL2) {
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
  if (props.expiryNote && props.ignitionOn && displayMode === 'operating') {
    const lines = { cs: ['vyprší za', 'dní'], en: ['expires in', 'days'], ru: ['Срок действ.', 'карты'] }[language]
    const { slot, days } = props.expiryNote
    return <div className="lcd-two-rows lcd-card-insertion">
      <div className="lcd-row lcd-row-left">{parseSymbols(`(47)(14)${slot} ${lines[0]}`, symbolMap)}</div>
      <div className="lcd-row lcd-row-left">{lines[1]} {days}</div>
    </div>
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

function DrivingWithoutValidCardWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const { language } = useLanguage()
  const def = getWarning('29', language)!
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

function PrintWizardDisplay(props: TachoDisplayProps) {
  const { symbolMap, printWizardState } = props
  const { t } = useLanguage()
  const pw = printWizardState!

  if (pw.step === 'utc') {
    const l1 = parseSymbols('výtisk v', symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left"><span className="lcd-inline-symbols">{l1}</span></div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.tachoDisplay.printUtc}</span>
          <span className="lcd-decision-1m-blink">{pw.utcYes ? t.cardWizard.yes : t.cardWizard.no}</span>
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
        <span className="lcd-field-blink">{String(day).padStart(2, '0')}</span>
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
  const { symbolMap, menuCountryInputState, countries } = props
  const { t, language } = useLanguage()
  const countryQuestion = language === 'en' ? '' : '?'
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
    ? parseSymbols(`(37)(36)${countryQuestion}\u00A0${t.tachoDisplay.startCountry}`, symbolMap)
    : parseSymbols(`(41)(37)${countryQuestion} ${t.tachoDisplay.endCountry}`, symbolMap)
  const code = countries[mc.countryIndex]?.code ?? 'CZ'
  return (
    <div className="lcd-two-rows lcd-card-insertion">
      <div className="lcd-row lcd-row-left">{l1}</div>
      <div className="lcd-row lcd-row-left lcd-country-code-blink">:{code}</div>
    </div>
  )
}

function Vdo24hDisplay(props: { symbolMap: SymbolMap | null; dailyRemainingMs: number | null | undefined }) {
  const { t } = useLanguage()
  const missing = t.workWeek.shiftSumRestPlaceholder
  const dailyText = typeof props.dailyRemainingMs === 'number'
    ? formatDurationHhMm(props.dailyRemainingMs, true)
    : missing
  return (
    <div className="lcd-two-rows lcd-vdo-counter" data-vdo-screen="vdo24h" data-vdo24h-daily-ms={props.dailyRemainingMs ?? ''}>
      <div className="lcd-row lcd-row-vdo">
        <span className="lcd-row-left">VDO24h</span>
        <span className="lcd-row-right">
          {parseSymbols('(2)', props.symbolMap)}
          <span>{dailyText}</span>
        </span>
      </div>
      <div className="lcd-row lcd-row-vdo">
        <span className="lcd-row-left">
          {parseSymbols('(8)', props.symbolMap)}
          <span>{missing}</span>
        </span>
        <span className="lcd-row-right">
          {parseSymbols('(17)', props.symbolMap)}
          <span>{missing}</span>
        </span>
      </div>
    </div>
  )
}

function VdoWeekDisplay(props: { symbolMap: SymbolMap | null; weeklyRemainingMs: number | null | undefined }) {
  const { t } = useLanguage()
  const missing = t.workWeek.shiftSumRestPlaceholder
  const weeklyText = typeof props.weeklyRemainingMs === 'number'
    ? formatDurationHhMm(props.weeklyRemainingMs, true)
    : missing
  return (
    <div className="lcd-two-rows lcd-vdo-counter" data-vdo-screen="vdoWeek" data-vdo-week-remaining-ms={props.weeklyRemainingMs ?? ''}>
      <div className="lcd-row lcd-row-vdo">
        <span className="lcd-row-left">
          VDO
          {parseSymbols('(57)', props.symbolMap)}
        </span>
        <span className="lcd-row-right">
          {parseSymbols('(2)', props.symbolMap)}
          <span>{weeklyText}</span>
        </span>
      </div>
      <div className="lcd-row lcd-row-vdo">
        <span className="lcd-row-left">
          {parseSymbols('(8)', props.symbolMap)}
          <span>{missing}</span>
        </span>
        <span className="lcd-row-right">
          {parseSymbols('(17)', props.symbolMap)}
          <span>{missing}</span>
        </span>
      </div>
    </div>
  )
}

function VdoiDisplay(props: { symbolMap: SymbolMap | null; extensionsRemaining: number | null | undefined }) {
  const { t } = useLanguage()
  const missing = t.workWeek.shiftSumRestPlaceholder
  const extensionsText = typeof props.extensionsRemaining === 'number' ? String(props.extensionsRemaining) : missing
  return (
    <div className="lcd-two-rows lcd-vdo-counter" data-vdo-screen="vdoi" data-vdo-extensions-remaining={props.extensionsRemaining ?? ''}>
      <div className="lcd-row lcd-row-vdo">
        <span className="lcd-row-left">VDOi</span>
        <span className="lcd-row-right">
          {parseSymbols('(8)', props.symbolMap)}
          <span>9h</span>
          <span>{missing}</span>
        </span>
      </div>
      <div className="lcd-row lcd-row-vdo">
        <span className="lcd-row-left">
          <span>{missing}</span>
        </span>
        <span className="lcd-row-right">
          {parseSymbols('(2)', props.symbolMap)}
          <span>10h</span>
          <span>{extensionsText}</span>
        </span>
      </div>
    </div>
  )
}

function OperatingDisplay(props: TachoDisplayProps) {
  const { language, t } = useLanguage()
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
    vdoNamedScreen = null,
    drivenSinceRestMs = null,
    recognizedBreakMs = null,
    activityDurationMsByDriver = { 1: null, 2: null },
    workTime = null,
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
  /** V režimu OUT nezobrazovat řádek „vlož kartu“ – zobrazit hlavní obrazovku s nápisem OUT místo symbolů. */
  const showCardWarning = !isStandby && !card1Inserted && ignitionWarningActive && !showOutOnL2
  const leftEdgeChar = getActivityCode(tachoState.leftActivityId)
  const rightEdgeChar = getActivityCode(tachoState.rightActivityId)

  const displayedSpeed = isStandby ? 0 : currentSpeed

  /** Bez karty zůstává základní obrazovka, i když byl Counter před vysunutím otevřený. */
  const anyCard = card1Inserted || card2Inserted

  /** VDO counter – zobraz jen po stisku šipky; jinak vždy základní obrazovka */
  if (anyCard && vdoCounterActive && vdoNamedScreen === 'vdoi') {
    return <VdoiDisplay symbolMap={symbolMap} extensionsRemaining={props.slot1DebugDailyExtensionsRemaining} />
  }

  if (anyCard && vdoCounterActive && vdoNamedScreen === 'vdoWeek') {
    return <VdoWeekDisplay symbolMap={symbolMap} weeklyRemainingMs={props.slot1DebugWeeklyRemainingMs} />
  }

  if (anyCard && vdoCounterActive && vdoNamedScreen === 'vdo24h') {
    return <Vdo24hDisplay symbolMap={symbolMap} dailyRemainingMs={props.slot1DebugDailyRemainingMs} />
  }

  if (anyCard && vdoCounterActive && vdoNamedScreen === 'driveRest') {
    const driver2Activity = tachoState.rightActivityId
    return (
      <div className={`lcd-two-rows lcd-vdo-counter ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''}`} data-vdo-screen="driveRest" data-driven-ms={drivenSinceRestMs ?? ''} data-recognized-break-ms={recognizedBreakMs ?? ''} data-activity-ms={activityDurationMsByDriver[2] ?? ''}>
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            {parseSymbols('(12)(2)', symbolMap)}
            <span>{formatOverviewTime(drivenSinceRestMs)}</span>
          </span>
          <span className="lcd-row-right">
            {parseSymbols('(10)', symbolMap)}
            <span>{formatOverviewTime(recognizedBreakMs)}</span>
          </span>
        </div>
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            {parseSymbols(`(13)${activitySymbol(driver2Activity)}`, symbolMap)}
            <span>{formatOverviewTime(activityDurationMsByDriver[2])}</span>
          </span>
        </div>
      </div>
    )
  }

  if (anyCard && vdoCounterActive && vdoNamedScreen === 'workTime') {
    return (
      <div
        className={`lcd-two-rows lcd-vdo-counter ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''}`}
        data-vdo-screen="workTime"
        data-work-current-ms={workTime?.currentWithoutRestMs ?? ''}
        data-work-since-rest-ms={workTime?.sinceDailyOrWeeklyRestMs ?? ''}
        data-work-breaks-ms={workTime?.breaksInPeriodMs ?? ''}
        data-work-week-ms={workTime?.calendarWeekMs ?? ''}
      >
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            {parseSymbols('(47)(9)', symbolMap)}
            <span>{formatOverviewTime(workTime?.currentWithoutRestMs)}</span>
          </span>
          <span className="lcd-row-right">
            <span>{`24h${formatOverviewTime(workTime?.sinceDailyOrWeeklyRestMs)}`}</span>
          </span>
        </div>
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            {parseSymbols('(9)(10)', symbolMap)}
            <span>{formatOverviewTime(workTime?.breaksInPeriodMs)}</span>
          </span>
          <span className="lcd-row-right">
            {parseSymbols('(57)', symbolMap)}
            <span>{formatOverviewTime(workTime?.calendarWeekMs)}</span>
          </span>
        </div>
      </div>
    )
  }

  if (vdoCounterActive && !vdoNamedScreen && currentSpeed === 0 && operatingScreenIndex >= UTC_PAGE) {
    const labels = languageLabels[props.languageDraft ?? language]
    let rows: string[]
    if (operatingScreenIndex === LANGUAGE_PAGE) {
      if (props.languageDraft) rows = ['(20) ' + labels.title, labels.name]
      else if (props.languageSaved) rows = [labels.title, t.ui.saved]
      else rows = labels.prompt
    } else if (operatingScreenIndex === MAIN_MENU_PAGE) {
      rows = labels.menu
    } else {
      rows = utcRows(props.simulatedUtcTime ?? props.localTime.getTime(), props.localTime)
    }
    return <div className="lcd-two-rows lcd-card-insertion">
      {rows.map((row, index) => (
        <div className="lcd-row" key={index}>
          {operatingScreenIndex === LANGUAGE_PAGE
            ? <span>{parseSymbols(row, symbolMap)}</span>
            : parseSymbols(row, symbolMap)}
        </div>
      ))}
    </div>
  }

  if (!vdoCounterActive || !anyCard) {
    /* Základní obrazovka – stejné rozložení jako při načítání karty (lcd-card-insertion) */
    return (
      <div className={`lcd-two-rows lcd-card-insertion ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''} ${isStandby ? 'lcd-standby' : ''}`} data-multi-manning={tachoState.isMultiManning || undefined} data-standby={isStandby || undefined}>
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
                {formatLcdOdometer(odometerKm)}
              </div>
              <div className="lcd-row-sides">
                {card2Inserted && (
                  <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />
                )}
                <TachoIcon code={rightEdgeChar} />
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
  const newCounter = anyCard && (screenIndex === 0 || screenIndex === 1)

  if (newCounter) {
    const placeholder = t.workWeek.shiftSumRestPlaceholder
    const knownTime = (ms: number | null | undefined, roundUp?: boolean) =>
      typeof ms === 'number' ? formatDurationHm(ms, roundUp) : placeholder
    const capDriving = (value: number) => {
      const caps = [value]
      for (const item of [props.slot1DebugDailyRemainingMs, props.slot1DebugWeeklyRemainingMs, props.slot1DebugFortnightRemainingMs]) {
        if (typeof item === 'number') caps.push(item)
      }
      return Math.min(...caps)
    }
    const debugBreak = props.slot1DebugBreak ?? null
    let drivingText = placeholder
    let breakText = placeholder
    let drivingMs: number | null = null
    let breakMs: number | null = null
    let afterMs: number | null = null
    let rightKind: 'missing' | 'fulfilled' | 'next' | 'until-break' = 'missing'
    if (debugBreak?.phase === 'driving') {
      drivingMs = capDriving(debugBreak.remainingDrivingMs)
      const resting = (driver === 1 ? tachoState.leftActivityId : tachoState.rightActivityId) === 'REST'
      const blockReset = debugBreak.requiredBreakMs === 45 * 60 * 1000
      if (resting && blockReset) {
        breakMs = 0
        rightKind = 'fulfilled'
      } else {
        breakMs = debugBreak.requiredBreakMs
        rightKind = 'next'
      }
      drivingText = knownTime(drivingMs, true)
      breakText = knownTime(breakMs, true)
      if (props.slot1DebugDrivingKnown === false) {
        drivingMs = null
        drivingText = placeholder
      }
    } else if (debugBreak?.phase === 'break') {
      drivingMs = capDriving(debugBreak.drivingIfStartNowMs)
      breakMs = debugBreak.remainingBreakMs
      afterMs = capDriving(debugBreak.drivingAfterBreakMs)
      rightKind = 'until-break'
      drivingText = knownTime(drivingMs, true)
      breakText = knownTime(breakMs, true)
      if (props.slot1DebugDrivingKnown === false) {
        drivingMs = null
        afterMs = null
        drivingText = placeholder
      }
    }
    if (tachoState.ferryTrainModeActive) {
      breakMs = typeof props.slot1DebugFerryRestMs === 'number' ? props.slot1DebugFerryRestMs : null
      breakText = knownTime(breakMs, true)
      afterMs = null
      rightKind = breakMs == null ? 'missing' : 'next'
    }
    const displayedActivityId = driver === 1 ? tachoState.leftActivityId : tachoState.rightActivityId
    const activityMark = displayedActivityId === 'DRIVING' ? '(2)' : displayedActivityId === 'WORK' ? '(9)' : displayedActivityId === 'AVAILABILITY' ? '(7)' : '(8)'
    if (vdoNamedScreen === 'vdoCard') {
      const activityDurationMs = activityDurationMsByDriver[driver as 1 | 2]
      const slotSymbol = driverSymbol(driver as 1 | 2)
      return (
        <div className={`lcd-two-rows lcd-vdo-counter ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''} ${isStandby ? 'lcd-standby' : ''}`} data-vdo-screen="vdoCard" data-standby={isStandby || undefined} data-driven-ms={drivenSinceRestMs ?? ''} data-recognized-break-ms={recognizedBreakMs ?? ''} data-activity-ms={activityDurationMs ?? ''}>
          <div className="lcd-row lcd-row-vdo">
            <span className="lcd-row-left">
              {parseSymbols(`${slotSymbol}(2)`, symbolMap)}
              <span>{formatOverviewTime(drivenSinceRestMs)}</span>
            </span>
            <span className="lcd-row-right">
              {parseSymbols('(10)', symbolMap)}
              <span>{formatOverviewTime(recognizedBreakMs)}</span>
            </span>
          </div>
          <div className="lcd-row lcd-row-vdo">
            <span className="lcd-row-left">
              {parseSymbols(`${slotSymbol}(2)(58)`, symbolMap)}
              <span>{formatOverviewTime(props.slot1DebugFortnightSumMs)}</span>
            </span>
            <span className="lcd-row-right">
              {parseSymbols(activitySymbol(displayedActivityId), symbolMap)}
              <span>{formatOverviewTime(activityDurationMs)}</span>
            </span>
          </div>
        </div>
      )
    }
    return (
      <div
        className={`lcd-two-rows lcd-vdo-counter ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''} ${isStandby ? 'lcd-standby' : ''}`}
        data-standby={isStandby || undefined}
        data-lcd-right-kind={rightKind}
        data-lcd-driving-ms={drivingMs ?? ''}
        data-lcd-break-ms={breakMs ?? ''}
        data-lcd-after-ms={afterMs ?? undefined}
        data-lcd-ferry-rest={props.slot1DebugFerryRestConditional ? 'conditional' : tachoState.ferryTrainModeActive ? 'recorded' : undefined}
      >
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            VDO
            {parseSymbols(activityMark, symbolMap)}
          </span>
          <span className="lcd-row-right">
            {parseSymbols('(2)(41)', symbolMap)}
            <span>{drivingText}</span>
          </span>
        </div>
        <div className="lcd-row lcd-row-vdo">
          <span className="lcd-row-left">
            {parseSymbols('(8)(41)', symbolMap)}
            <span>{breakText}</span>
          </span>
        </div>
      </div>
    )
  }

  /* Obrazovka 2–6: Info – stejné rozložení jako při načítání karty (lcd-card-insertion) */
  return (
    <div className={`lcd-two-rows lcd-card-insertion ${tachoState.isMultiManning ? 'lcd-multi-manning' : ''} ${isStandby ? 'lcd-standby' : ''}`} data-multi-manning={tachoState.isMultiManning || undefined} data-standby={isStandby || undefined}>
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
              {formatLcdOdometer(odometerKm)}
            </div>
            <div className="lcd-row-sides">
              {card2Inserted && (
                <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />
              )}
              <TachoIcon code={rightEdgeChar} />
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
