/**
 * Informační okénko vpravo od simulátoru.
 * Modré podkreslení + ikona I = informace, oranžové/amber + ikona ! = výstraha.
 *
 * Všechna okna zůstávají otevřená dokud je uživatel nezavře. Nová se přidávají
 * a vrství od shora dolů. InfoPanel spravuje logiku interně.
 */

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ActivityHistoryEntry, CardInsertionState, ManualEntrySegment, MenuCountryInputState } from './TachoTypes'
import type { SymbolMap } from './TachoTypes'
import { ACTIVITY_SYMBOLS } from './TachoTypes'
import { segmentToMsUtc } from './CardLogic'
import { parseSymbols, ACTIVITY_ID_TO_BG } from './Symbols'

const INFO_PANEL_SYMBOL_BG_DEFAULT = '#888'
import { useLanguage } from './translations'

export type InfoItem = {
  id: string
  type: 'info' | 'warning'
  message: string
  /** Volitelný React obsah – místo textu message se vykreslí content (pro výpis s symboly apod.) */
  content?: ReactNode
}

type InfoPanelProps = {
  items: InfoItem[]
  /** Po změně vymaže historii otevřených oken (reakce na globální Reset) */
  resetTrigger?: number
  /** Mapa symbolů pro převod (N) na glyfy fontu SymbolTacho1 */
  symbolMap?: SymbolMap | null
  /** Sbalený režim – zobraz jen úzký proužek s ikonami */
  collapsed?: boolean
}

function InfoIcon({ type }: { type: 'info' | 'warning' }) {
  const base = 'info-panel-icon'
  return (
    <span className={`${base} ${base}--${type}`} aria-hidden>
      {type === 'info' ? 'i' : '!'}
    </span>
  )
}

export function InfoPanel({ items, resetTrigger, symbolMap, collapsed = false }: InfoPanelProps) {
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
  useEffect(() => {
    const currentIds = new Set(items.map((i) => i.id))
    dismissedIdsRef.current = new Set([...dismissedIdsRef.current].filter((id) => currentIds.has(id)))

    const itemsById = new Map(items.map((i) => [i.id, i]))
    const dismissed = dismissedIdsRef.current
    const languageChanged = prevLanguageRef.current !== language
    prevLanguageRef.current = language

    setOpenItems((prev) => {
      const kept = prev.filter((p) => !dismissed.has(p.id))
      const toAdd = items.filter((i) => !kept.some((p) => p.id === i.id) && !dismissed.has(i.id))
      const updated = kept.map((p) => itemsById.get(p.id) ?? p)
      const hasChanges =
        toAdd.length > 0 ||
        languageChanged ||
        kept.some((p, i) => updated[i]?.message !== p.message || (updated[i]?.content != null) !== (p.content != null))
      if (!hasChanges && updated.length === kept.length) return prev
      return [...toAdd, ...updated]
    })
  }, [items, language])

  const handleDismiss = (id: string) => {
    setOpenItems((prev) => prev.filter((i) => i.id !== id))
    dismissedIdsRef.current = new Set([...dismissedIdsRef.current, id])
  }

  if (openItems.length === 0) return null

  if (collapsed) {
    return (
      <div className="info-panel-strip-icons" role="complementary" aria-label={t.ui.infoPanelIconsLabel}>
        {openItems.map((item) => (
          <InfoIcon key={item.id} type={item.type} />
        ))}
      </div>
    )
  }

  return (
    <aside className="info-panel" role="complementary" aria-label={t.ui.infoPanelLabel}>
      <div className="info-panel-inner info-panel-stack">
        {openItems.map((item) => (
          <div key={`${item.id}-${language}`} className={`info-panel-item info-panel-item--${item.type}`}>
            <InfoIcon type={item.type} />
            {item.content != null ? (
              <div className="info-panel-content">{item.content}</div>
            ) : (
              <p className="info-panel-text">{parseSymbols(item.message, symbolMap, { symbolBg: true })}</p>
            )}
            <button
              type="button"
              className="info-panel-close"
              onClick={() => handleDismiss(item.id)}
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

const MANUAL_ENTRY_PHASES: CardInsertionState['phase'][] = ['decision1M', 'manualEditor', 'country', 'finalConfirm', 'itsQuestion', 'vdoQuestion']

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

const WORK_MIN_MS = 4 * 60 * 1000

type VehicleCheckResult = 'none' | 'warning' | 'info'

/**
 * Kontrola: mezi výchozí zemí a první minutou jízdy musí být WORK (kontrola vozidla, symbol 9).
 * - Žádná WORK → warning
 * - WORK < 4 min → info
 * - WORK >= 4 min → none
 */
function checkVehicleWorkBeforeDriving(
  buffer: ManualEntrySegment[],
  activityHistory: ActivityHistoryEntry[],
  driverSlot: 1 | 2,
): VehicleCheckResult {
  const lastStartIdx = buffer.map((s, i) => (s.activityId === 'START_COUNTRY' ? i : -1)).filter((i) => i >= 0).pop()
  if (lastStartIdx == null) return 'none'
  const startMs = segmentToMsUtc(buffer[lastStartIdx]!)

  const driverKey = driverSlot === 1 ? 'driver1' : 'driver2'
  // První jízda po posledním START_COUNTRY (nikoli první jízda v celé historii)
  const firstDrivingEntry = activityHistory.find((e) => e[driverKey] === 'driving' && e.minuteStartUtc > startMs)
  // Výstraha jen když řidič již zahájil řízení – před tím nelze kontrolovat „aktivitu před řízením“
  if (firstDrivingEntry == null) return 'none'
  const endMs = firstDrivingEntry.minuteStartUtc

  let workMs = 0

  for (let j = 0; j < buffer.length - 1; j++) {
    const seg = buffer[j]!
    if (seg.activityId !== 'WORK') continue
    const next = buffer[j + 1]!
    const blockStart = segmentToMsUtc(seg)
    const blockEnd = segmentToMsUtc(next)
    const overlapStart = Math.max(blockStart, startMs)
    const overlapEnd = Math.min(blockEnd, endMs)
    if (overlapEnd > overlapStart) workMs += overlapEnd - overlapStart
  }

  for (const e of activityHistory) {
    if (e[driverKey] !== 'otherWork') continue
    const minuteMs = e.minuteStartUtc
    if (minuteMs >= startMs && minuteMs < endMs) workMs += 60000
  }

  if (workMs === 0) return 'warning'
  if (workMs < WORK_MIN_MS) return 'info'
  return 'none'
}

function ManualEntryBufferDisplay({ buffer, label }: { buffer: ManualEntrySegment[]; label: string }) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (s: ManualEntrySegment) => `${pad(s.day)}.${pad(s.month)}. ${pad(s.hour)}:${pad(s.minute)}`
  return (
    <div>
      <div className="info-panel-manual-label">{label}</div>
      <div className="info-panel-manual-list">
      {buffer.map((seg, i) => {
        const sym = ACTIVITY_SYMBOLS.find((a) => a.id === seg.activityId)
        const code = sym?.code ?? '?'
        const next = buffer[i + 1]
        const isCountry = seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY'
        if (!isCountry && next && segmentToMsUtc(seg) === segmentToMsUtc(next)) return null
        if (!isCountry && next && (next.activityId === 'START_COUNTRY' || next.activityId === 'END_COUNTRY')) return null
        const segBg = ACTIVITY_ID_TO_BG[seg.activityId] ?? INFO_PANEL_SYMBOL_BG_DEFAULT
        const symbolWrap = (c: string) => (
          <span className="tacho-icon info-panel-symbol-wrap info-panel-symbol" style={{ background: segBg }}>
            {c}
          </span>
        )
        return (
          <div key={i} className="info-panel-manual-item">
            <span className="info-panel-manual-time">{fmt(seg)}</span>
            {isCountry ? (
              <>
                {symbolWrap(code)}
                {seg.countryCode && <span className="info-panel-manual-country"> {seg.countryCode}</span>}
              </>
            ) : (
              <>
                {' → '}
                <span className="info-panel-manual-time">{next ? fmt(next) : '—'}</span>
                {' '}
                {symbolWrap(code)}
              </>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
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
  activityHistory?: ActivityHistoryEntry[]
  /** Zaškrtnuto „Karta 1 ukončena cílovou zemí“ – zobrazí infobox */
  card1EndedByTargetCountry?: boolean
  /** Čas posledního vytažení karty 1 (pro infobox při card1EndedByTargetCountry) */
  card1LastWithdrawalUtc?: number | null
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
    activityHistory = [],
    card1EndedByTargetCountry = false,
    card1LastWithdrawalUtc = null,
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

  if (card1EndedByTargetCountry && card1LastWithdrawalUtc != null) {
    items.push({
      id: 'card1-ended-by-target-country-info',
      type: 'info',
      message: t.infoPanel.card1EndedByTargetCountryInfo.replace('{dateTime}', formatLastWithdrawal(card1LastWithdrawalUtc)),
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
  const vehicleCheckD1 = card1Inserted ? checkVehicleWorkBeforeDriving(bufferD1, activityHistory, 1) : 'none'
  const vehicleCheckD2 = card2Inserted ? checkVehicleWorkBeforeDriving(bufferD2, activityHistory, 2) : 'none'
  if (vehicleCheckD1 === 'warning' || vehicleCheckD2 === 'warning') {
    items.push({
      id: 'vehicle-check-before-driving-warning',
      type: 'warning',
      message: t.infoPanel.vehicleCheckBeforeDrivingWarning,
    })
  } else if (vehicleCheckD1 === 'info' || vehicleCheckD2 === 'info') {
    items.push({
      id: 'vehicle-check-before-driving-short',
      type: 'info',
      message: t.infoPanel.vehicleCheckBeforeDrivingShort,
    })
  }

  if (cardInsertionState && MANUAL_ENTRY_PHASES.includes(cardInsertionState.phase)) {
    items.push({
      id: 'supplement-activities',
      type: 'info',
      message: t.infoPanel.supplementActivities,
    })

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

    const buffer = cardInsertionState.manualEntryBuffer
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
