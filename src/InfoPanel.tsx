/**
 * Informační okénko vpravo od simulátoru.
 * Modré podkreslení + ikona I = informace, oranžové/amber + ikona ! = výstraha.
 *
 * Všechna okna zůstávají otevřená dokud je uživatel nezavře. Nová se přidávají
 * a vrství od shora dolů. InfoPanel spravuje logiku interně.
 */

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { CardInsertionState, ManualEntrySegment, MenuCountryInputState } from './TachoTypes'
import type { VdoNamedScreen } from './slot1DddCounter'
import type { Translations } from './translations/types'
import type { SymbolMap } from './TachoTypes'
import { ACTIVITY_SYMBOLS } from './TachoTypes'
import { segmentToMsUtc } from './CardLogic'
import type { VehicleCheckResult } from './vehiclePreDepartureCheck'
import { parseSymbols, ACTIVITY_ID_TO_BG } from './Symbols'

const INFO_PANEL_SYMBOL_BG_DEFAULT = '#888'
import { useLanguage } from './translations'

export type InfoItem = {
  id: string
  type: 'info' | 'warning'
  message: string
  /** Nadpis karty. Stávající hlášení ho nemají. */
  title?: string
  /** Automaticky zavřít, jakmile přestane platit podmínka hlášení. */
  activeOnly?: boolean
  /**
   * ID zůstává v seznamu, karta se ale nekreslí.
   * Zavření × se tím nezapomene, dokud položka ze seznamu nezmizí.
   */
  hidden?: boolean
  /** Volitelný React obsah – místo textu message se vykreslí content (pro výpis s symboly apod.) */
  content?: ReactNode
  onDismiss?: () => void
}

type InfoPanelProps = {
  items: InfoItem[]
  /** Po změně vymaže historii otevřených oken (reakce na globální Reset) */
  resetTrigger?: number
  /** Mapa symbolů pro převod (N) na glyfy fontu SymbolTacho1 */
  symbolMap?: SymbolMap | null
  /** Sbalený režim – zobraz jen úzký proužek s ikonami */
  collapsed?: boolean
  mobile?: boolean
}

function InfoIcon({ type }: { type: 'info' | 'warning' }) {
  const base = 'info-panel-icon'
  return (
    <span className={`${base} ${base}--${type}`} aria-hidden>
      {type === 'info' ? 'i' : '!'}
    </span>
  )
}

export function InfoPanel({ items, resetTrigger, symbolMap, collapsed = false, mobile = false }: InfoPanelProps) {
  const { t, language } = useLanguage()
  /** Otevřená okna – vrství se od shora dolů, uzavřou se až po kliknutí na zavřít */
  const [openItems, setOpenItems] = useState<InfoItem[]>([])
  /** Uzavřená okna – po zavření nezobrazovat znovu, dokud položka nezmizí z items (podmínky se změní) */
  const dismissedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (resetTrigger != null) {
      setOpenItems([])
      dismissedIdsRef.current = new Set()
    }
  }, [resetTrigger])

  // Položky visí v pořadí shora dolů; maže je jen uživatel (tlačítko Zavřít)
  const prevLanguageRef = useRef(language)
  const prevVisibleIdsRef = useRef(new Set<string>())
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const currentIds = new Set(items.map((i) => i.id))
    dismissedIdsRef.current = new Set([...dismissedIdsRef.current].filter((id) => currentIds.has(id)))

    const previousVisibleIds = prevVisibleIdsRef.current
    const visibleIds = new Set(items.filter((item) => !item.hidden).map((item) => item.id))
    prevVisibleIdsRef.current = visibleIds
    const itemsById = new Map(items.map((i) => [i.id, i]))
    const dismissed = dismissedIdsRef.current
    const languageChanged = prevLanguageRef.current !== language
    prevLanguageRef.current = language

    setOpenItems((prev) => {
      const kept = prev.filter((p) => !dismissed.has(p.id) && (!p.activeOnly || currentIds.has(p.id)) && !itemsById.get(p.id)?.hidden)
      const toAdd = items.filter((i) => !i.hidden && !kept.some((p) => p.id === i.id) && !dismissed.has(i.id))
      const updated = kept.map((p) => itemsById.get(p.id) ?? p)
      const resurfaced = mobile
        ? updated.filter((item) => visibleIds.has(item.id) && !previousVisibleIds.has(item.id))
        : []
      const hasChanges =
        resurfaced.length > 0 ||
        toAdd.length > 0 ||
        languageChanged ||
        kept.some((item, index) => {
          const next = updated[index]!
          return next.message !== item.message || next.title !== item.title || next.content !== item.content
        })
      if (!hasChanges && kept.length === prev.length) return prev
      return [...toAdd, ...resurfaced, ...updated.filter((item) => !resurfaced.includes(item))]
    })
  }, [items, language, mobile])

  const newestItemId = openItems[0]?.id
  useLayoutEffect(() => {
    if (mobile && newestItemId) {
      const rail = panelRef.current?.closest('.info-panels-wrapper--attached')
      rail?.scrollTo({ left: 0, behavior: 'instant' })
    }
  }, [mobile, newestItemId])

  const handleDismiss = (item: InfoItem) => {
    const { id } = item
    item.onDismiss?.()
    setOpenItems((prev) => prev.filter((i) => i.id !== id))
    dismissedIdsRef.current = new Set([...dismissedIdsRef.current, id])
  }

  const visibleItems = openItems.flatMap((item) => {
    if (!item.activeOnly) return [item]
    const current = items.find((candidate) => candidate.id === item.id && !candidate.hidden)
    return current ? [current] : []
  })
  if (visibleItems.length === 0) return null

  if (collapsed) {
    return (
      <div className="info-panel-strip-icons" role="complementary" aria-label={t.ui.infoPanelIconsLabel}>
        {visibleItems.map((item) => (
          <InfoIcon key={item.id} type={item.type} />
        ))}
      </div>
    )
  }

  return (
    <aside ref={panelRef} className="info-panel" role="complementary" aria-label={t.ui.infoPanelLabel}>
      <div className="info-panel-inner info-panel-stack">
        {visibleItems.map((item) => (
          <div key={`${item.id}-${language}`} className={`info-panel-item info-panel-item--${item.type}`}
            data-current={(mobile && item.id === newestItemId) || undefined}>
            <InfoIcon type={item.type} />
            {item.content != null ? (
              <div className="info-panel-content">{item.content}</div>
            ) : (
              <div className="info-panel-content">
                {item.title ? <div className="info-panel-manual-label">{item.title}</div> : null}
                <p className="info-panel-text">{parseSymbols(item.message, symbolMap, { symbolBg: true })}</p>
              </div>
            )}
            <button
              type="button"
              className="info-panel-close"
              onClick={() => handleDismiss(item)}
              aria-label={t.printOverlay.close}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}

const SUPPLEMENT_ACTIVITIES_PHASES: CardInsertionState['phase'][] = ['decision1M', 'manualEditor', 'country', 'finalConfirm']
const MANUAL_ENTRY_PHASES: CardInsertionState['phase'][] = [...SUPPLEMENT_ACTIVITIES_PHASES, 'itsQuestion', 'vdoQuestion']

function formatSegmentDateTime(seg: { day: number; month: number; year: number; hour: number; minute: number }): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(seg.day)}.${pad(seg.month)}.${seg.year} ${pad(seg.hour)}:${pad(seg.minute)}`
}

/** V bufferu najde dva END_COUNTRY za sebou (bez START_COUNTRY mezi nimi) – vrátí první (dřívější), nebo null */
function findDuplicateEndCountry(buffer: ManualEntrySegment[]): ManualEntrySegment | null {
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i]!.activityId === 'END_COUNTRY' && buffer[i + 1]!.activityId === 'END_COUNTRY') {
      return buffer[i]!
    }
  }
  return null
}

function formatLastWithdrawal(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} v ${pad(d.getHours())}:${pad(d.getMinutes())}`
}


function ManualEntryBufferDisplay({ buffer, label }: { buffer: ManualEntrySegment[]; label: string }) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (s: ManualEntrySegment) => `${pad(s.day)}.${pad(s.month)}. ${pad(s.hour)}:${pad(s.minute)}`
  const rows: { start: ManualEntrySegment; end?: ManualEntrySegment }[] = []
  for (let index = 0; index < buffer.length; index++) {
    const start = buffer[index]!
    if (start.activityId === 'START_COUNTRY' || start.activityId === 'END_COUNTRY') {
      rows.push({ start })
      continue
    }
    // Průvodce ukládá každou potvrzenou činnost jako dvojici začátek–konec.
    const end = buffer[index + 1]
    if (end?.activityId === start.activityId) {
      if (segmentToMsUtc(start) < segmentToMsUtc(end)) rows.push({ start, end })
      index++
    }
  }
  return (
    <div>
      <div className="info-panel-manual-label">{label}</div>
      <div className="info-panel-manual-list">
        {rows.map(({ start, end }, index) => {
          const symbol = ACTIVITY_SYMBOLS.find((activity) => activity.id === start.activityId)
          const background = ACTIVITY_ID_TO_BG[start.activityId] ?? INFO_PANEL_SYMBOL_BG_DEFAULT
          return (
            <div key={index} className="info-panel-manual-item">
              <span className="info-panel-manual-time">{fmt(start)}</span>
              {end && <> → <span className="info-panel-manual-time">{fmt(end)}</span>{' '}</>}
              <span className="tacho-icon info-panel-symbol-wrap info-panel-symbol" style={{ background }}>
                {symbol?.code ?? '?'}
              </span>
              {start.countryCode && <span className="info-panel-manual-country"> {start.countryCode}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function activityMark(activityId: string): string {
  if (activityId === 'DRIVING') return '(2)'
  if (activityId === 'WORK') return '(9)'
  if (activityId === 'AVAILABILITY') return '(7)'
  return '(8)'
}

function teachLine(symbols: string, text: string): string {
  return symbols ? `${symbols} ${text}` : text
}

export type LcdTeachScreen = 'driveRest' | 'card' | 'vdo' | 'work' | 'vdo24h' | 'vdoWeek' | 'vdoi'

/** Obrazovka, jejíž výuka patří do InfoPanelu. Informační indexy 2–6 sem nepatří. */
export function visibleLcdTeachScreen(input: {
  displayMode: string
  vdoCounterActive: boolean
  vdoNamedScreen: VdoNamedScreen | null
  operatingScreenIndex: number
  cardInserted: boolean
}): LcdTeachScreen | null {
  if (input.displayMode !== 'operating' || !input.vdoCounterActive || !input.cardInserted) return null
  if (input.vdoNamedScreen === 'driveRest') return 'driveRest'
  if (input.vdoNamedScreen === 'vdoCard') return 'card'
  if (input.vdoNamedScreen === 'workTime') return 'work'
  if (input.vdoNamedScreen === 'vdo24h') return 'vdo24h'
  if (input.vdoNamedScreen === 'vdoWeek') return 'vdoWeek'
  if (input.vdoNamedScreen === 'vdoi') return 'vdoi'
  if (input.vdoNamedScreen == null && (input.operatingScreenIndex === 0 || input.operatingScreenIndex === 1)) return 'vdo'
  return null
}

/**
 * Jedna modrá karta k právě zobrazené výukové obrazovce.
 * Skrytá karta drží stejné ID, aby zavření × přežilo výstrahu i překreslení.
 */
export function lcdTeachInfoItem(input: {
  t: Translations
  screen: LcdTeachScreen | null
  covered: boolean
  driver: 1 | 2
  leftActivityId: string
  rightActivityId: string
  breakCountingDown: boolean
}): InfoItem | null {
  if (!input.screen) return null
  const teach = input.t.lcdTeach
  const driverSymbol = input.driver === 1 ? '(12)' : '(13)'
  const cardActivity = activityMark(input.driver === 1 ? input.leftActivityId : input.rightActivityId)
  const vdoActivity = activityMark(input.driver === 1 ? input.leftActivityId : input.rightActivityId)
  const lines: Record<LcdTeachScreen, { title: string; message: string }> = {
    driveRest: {
      title: teach.screenDriveRest,
      message: [
        teachLine('(12)(2)', teach.driveSinceRestDriver1),
        teachLine('(10)', teach.recognizedBreak),
        teachLine(`(13)${activityMark(input.rightActivityId)}`, teach.driver2ActivityDuration),
      ].join('\n'),
    },
    card: {
      title: teach.screenCard,
      message: [
        teachLine(`${driverSymbol}(2)`, teach.driveSinceRestSelected),
        teachLine('(10)', teach.recognizedBreak),
        teachLine(`${driverSymbol}(2)(58)`, teach.fortnightSum),
        teachLine(cardActivity, teach.activitySinceChange),
      ].join('\n'),
    },
    vdo: {
      title: teach.screenVdo,
      message: [
        teachLine(vdoActivity, teach.currentActivity),
        teachLine('(2)(41)', teach.drivingRemaining),
        teachLine('(8)(41)', input.breakCountingDown ? teach.breakOrRestRemaining : teach.nextBreakOrRest),
      ].join('\n'),
    },
    work: {
      title: teach.screenWork,
      message: [
        teachLine('(47)(9)', teach.workCurrent),
        teachLine('24h', teach.workSinceRest),
        teachLine('(9)(10)', teach.workBreaks),
        teachLine('(57)', teach.workWeek),
      ].join('\n'),
    },
    vdo24h: {
      title: teach.screenVdo24h,
      message: [
        teachLine('(2)', teach.dailyDrivingRemaining),
        teachLine('(8)', teach.nextDailyRest),
        teachLine('(17)', teach.latestRestStart),
      ].join('\n'),
    },
    vdoWeek: {
      title: teach.screenVdoWeek,
      message: [
        teachLine('(2)', teach.weeklyDrivingRemaining),
        teachLine('(8)', teach.nextWeeklyRest),
        teachLine('(17)', teach.latestRestStart),
      ].join('\n'),
    },
    vdoi: {
      title: teach.screenVdoi,
      message: [
        teachLine('(8)', `9h ${teach.reducedDailyRestCount}`),
        teachLine('(2)', `10h ${teach.extendedDrivingCount}`),
        teach.weeklyRestCompensation,
      ].join('\n'),
    },
  }
  const body = lines[input.screen]
  return {
    id: `lcd-teach-${input.screen}`,
    type: 'info',
    title: body.title,
    message: body.message,
    activeOnly: true,
    hidden: input.covered,
  }
}

/** Shromáždí položky pro InfoPanel podle aktuálního stavu simulátoru */
export function useInfoPanelItems(props: {
  ignitionOn: boolean
  card1Inserted: boolean
  drivingWithoutCardWarningActive: boolean
  excessSpeedWarningActive?: boolean
  /** Po pokusu o vyjmutí karty během jízdy – zobrazí infobox s výstrahou */
  ejectionBlockedWarningActive?: boolean
  breakWarningActive: string | null
  cardInsertionState: CardInsertionState | null
  lastEjectionTimeBySlot: { 1: number | null; 2: number | null }
  generateWorkWeekBlocked?: boolean
  isMultiManning?: boolean
  card2Inserted?: boolean
  crewRuleInterruptedByCard2Exit?: boolean
  driver1ManualEntryBuffer?: ManualEntrySegment[]
  driver2ManualEntryBuffer?: ManualEntrySegment[]
  vehicleCheck?: VehicleCheckResult
  /** Zobrazit infobox „Tato položka zatím není aktivní. Coming soon“ – při OK na neimplementované menu položce */
  menuComingSoonInfo?: { id: string } | null
  /** Režim OUT aktivní – zobrazí infobox o průběhu jízdy jako jiné práce */
  outModeActive?: boolean
}): InfoItem[] {
  const {
    ignitionOn,
    card1Inserted,
    drivingWithoutCardWarningActive,
    excessSpeedWarningActive = false,
    ejectionBlockedWarningActive = false,
    breakWarningActive,
    cardInsertionState,
    lastEjectionTimeBySlot,
    generateWorkWeekBlocked,
    isMultiManning = false,
    card2Inserted = false,
    crewRuleInterruptedByCard2Exit = false,
    driver1ManualEntryBuffer = [],
    driver2ManualEntryBuffer = [],
    vehicleCheck = 'none',
    menuComingSoonInfo = null,
    outModeActive = false,
  } = props
  const { t } = useLanguage()
  const items: InfoItem[] = []

  if (!ignitionOn) {
    items.push({
      id: 'standby-mode',
      type: 'info',
      message: t.infoPanel.standbyModeInfo,
      activeOnly: true,
    })
  }

  if (ignitionOn && !card1Inserted) {
    items.push({
      id: 'insert-card',
      type: 'info',
      message: t.infoPanel.insertCardToSlot1,
    })
  }

  if (drivingWithoutCardWarningActive) {
    items.push({
      id: 'driving-without-card',
      type: 'warning',
      message: t.infoPanel.drivingWithoutCard,
    })
  }

  if (excessSpeedWarningActive) {
    items.push({
      id: 'excess-speed',
      type: 'warning',
      message: t.infoPanel.excessSpeedWarning,
    })
  }

  if (ejectionBlockedWarningActive) {
    items.push({
      id: 'ejection-blocked',
      type: 'warning',
      message: t.infoPanel.ejectionBlockedWarning,
    })
  }

  if (breakWarningActive === '415') {
    items.push({
      id: 'break-415',
      type: 'warning',
      message: t.infoPanel.break415,
    })
  }

  if (breakWarningActive === '430') {
    items.push({
      id: 'break-430',
      type: 'warning',
      message: t.infoPanel.break430,
    })
  }

  if (generateWorkWeekBlocked) {
    items.push({
      id: 'generate-work-week-blocked',
      type: 'warning',
      message: t.infoPanel.generateWorkWeekBlocked,
    })
  }

  if (outModeActive) {
    items.push({
      id: 'out-mode-active',
      type: 'info',
      message: t.infoPanel.outModeActiveInfo,
    })
  }

  if (isMultiManning && !cardInsertionState) {
    items.push({
      id: 'crew-mode-info',
      type: 'info',
      message: t.infoPanel.crewModeInfo,
    })
  }

  if (card1Inserted && card2Inserted && !isMultiManning && !cardInsertionState) {
    if (crewRuleInterruptedByCard2Exit) {
      items.push({
        id: 'crew-mode-interrupted-warning',
        type: 'warning',
        message: t.infoPanel.crewModeInterruptedWarning,
      })
    } else {
      items.push({
        id: 'crew-mode-not-met-info',
        type: 'info',
        message: t.infoPanel.crewModeNotMetInfo,
      })
    }
  }

  if (cardInsertionState?.phase === 'idleWarning') {
    items.push({
      id: 'idle-warning-confirm-info',
      type: 'info',
      message: t.infoPanel.idleWarningConfirmInfo,
    })
  }

  if (cardInsertionState?.phase === 'itsQuestion' || cardInsertionState?.phase === 'vdoQuestion') {
    items.push({
      id: 'publish-data-consent-info',
      type: 'info',
      message: t.infoPanel.publishDataConsentInfo,
    })
  }

  if (menuComingSoonInfo) {
    items.push({
      id: menuComingSoonInfo.id,
      type: 'info',
      message: t.infoPanel.menuComingSoon,
    })
  }

  const bufferD1 = cardInsertionState?.slot === 1 ? cardInsertionState.manualEntryBuffer : driver1ManualEntryBuffer
  const bufferD2 = cardInsertionState?.slot === 2 ? cardInsertionState.manualEntryBuffer : driver2ManualEntryBuffer
  if (vehicleCheck === 'warning') {
    items.push({
      id: 'vehicle-check-before-driving-warning',
      activeOnly: true,
      type: 'warning',
      message: t.infoPanel.vehicleCheckBeforeDrivingWarning,
    })
  } else if (vehicleCheck === 'info') {
    items.push({
      id: 'vehicle-check-before-driving-short',
      activeOnly: true,
      type: 'info',
      message: t.infoPanel.vehicleCheckBeforeDrivingShort,
    })
  }

  const manualEntryPhase = cardInsertionState?.phase === 'idleWarning'
    ? cardInsertionState.idleWarningReturnPhase
    : cardInsertionState?.phase
  if (manualEntryPhase && SUPPLEMENT_ACTIVITIES_PHASES.includes(manualEntryPhase)) {
    items.push({
      id: 'supplement-activities',
      type: 'info',
      message: t.infoPanel.supplementActivities,
      activeOnly: true,
    })
  }

  if (cardInsertionState && MANUAL_ENTRY_PHASES.includes(cardInsertionState.phase)) {
    const lastWithdraw =
      cardInsertionState.lastWithdrawal ??
      (cardInsertionState.slot === 1 ? lastEjectionTimeBySlot[1] : lastEjectionTimeBySlot[2])
    if (lastWithdraw != null) {
      items.push({
        id: 'last-withdrawal',
        type: 'info',
        message: `${t.infoPanel.lastWithdrawal} ${formatLastWithdrawal(lastWithdraw)}`,
      })
    }
  }

  if (cardInsertionState && manualEntryPhase && SUPPLEMENT_ACTIVITIES_PHASES.includes(manualEntryPhase)) {
    const buffer = cardInsertionState.manualEntryBuffer.slice(cardInsertionState.manualEntryStartIndex)
    if (buffer.length > 0) {
      items.push({
        id: 'manual-entry-data',
        type: 'info',
        message: t.infoPanel.manualEntryData,
        content: <ManualEntryBufferDisplay buffer={buffer} label={t.infoPanel.manualEntryData} />,
      })
    }
  }

  // Kontrola duplicitního ukončení směny (dva END_COUNTRY za sebou) – bufferD1/D2 už zahrnují wizard
  const endCountryD1 = findDuplicateEndCountry(bufferD1)
  const endCountryD2 = findDuplicateEndCountry(bufferD2)
  if (endCountryD1) {
    items.push({
      id: 'end-country-found-d1',
      type: 'warning',
      message: t.infoPanel.endCountryDuplicateWarning.replace('{dateTime}', formatSegmentDateTime(endCountryD1)),
    })
  }
  if (endCountryD2) {
    items.push({
      id: 'end-country-found-d2',
      type: 'warning',
      message: t.infoPanel.endCountryDuplicateWarning.replace('{dateTime}', formatSegmentDateTime(endCountryD2)),
    })
  }

  // Hláška jen když displej skutečně zobrazuje „Připraven k jízdě“ (finalizeStep2 / readyToDrive)
  const showReadyToDriveReminder =
    cardInsertionState?.phase === 'readyToDrive' ||
    cardInsertionState?.phase === 'finalizeStep2'
  if (showReadyToDriveReminder) {
    items.push({
      id: 'ready-to-drive-pre-departure-check',
      type: 'info',
      message: t.infoPanel.readyToDrivePreDepartureCheck,
    })
  }

  return items
}

/** NR 165: varování při pokusu o druhé zadání výchozí země za sebou */
export function useNr165Warning(props: {
  menuCountryInputState: MenuCountryInputState | null
  driver1ManualEntryBuffer: ManualEntrySegment[]
  driver2ManualEntryBuffer: ManualEntrySegment[]
}): boolean {
  const { menuCountryInputState, driver1ManualEntryBuffer, driver2ManualEntryBuffer } = props
  if (!menuCountryInputState || menuCountryInputState.type !== 'start') return false
  const isDriver1 = menuCountryInputState.returnMenuPath[menuCountryInputState.returnMenuPath.length - 1] === 'SUB_INPUT_D1'
  const buffer = isDriver1 ? driver1ManualEntryBuffer : driver2ManualEntryBuffer
  const last = buffer.length > 0 ? buffer[buffer.length - 1] : null
  return last?.activityId === 'START_COUNTRY'
}

export function Nr165WarningBox({ onClose, symbolMap, collapsed = false }: { onClose?: () => void; symbolMap?: SymbolMap | null; collapsed?: boolean }) {
  const { t } = useLanguage()
  if (collapsed) {
    return (
      <div className="info-panel-strip-icons" role="alert" aria-label={t.ui.nr165Label}>
        <span className="info-panel-icon info-panel-icon--nr165" aria-hidden>!</span>
      </div>
    )
  }
  return (
    <div className="info-panel-nr165-warning" role="alert">
      <span className="info-panel-nr165-icon" aria-hidden>!</span>
      <p className="info-panel-nr165-text">{parseSymbols(t.infoPanel.nr165Warning, symbolMap, { symbolBg: true })}</p>
      {onClose && (
        <button
          type="button"
          className="info-panel-close"
          onClick={onClose}
          aria-label={t.printOverlay.close}
        >
          ×
        </button>
      )}
    </div>
  )
}
