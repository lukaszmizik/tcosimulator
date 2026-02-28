/**
 * Průvodce vložením karty – verze s logikou ukládání:
 * - Data v rozlišení celých minut
 * - Po zadání jednoho segmentu: další krok přebere L2 na L1 (+ 1 minuta), na L2 se zobrazí maximální čas (čas vložení karty)
 * - Výchozí/cílová země: časové razítko přimknuté ke stejnému HH:MM jako na L1
 *
 * Časová zóna: segmentStart a currentSegment jsou v MÍSTNÍM čase (pro zobrazení a editaci).
 * Zápis do manualEntryBuffer probíhá vždy v UTC (přes localSegmentToUtcForBuffer).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { floorToMinute, utcMsToSegment, localMsToSegment, segmentToMs, segmentToMsUtc, localSegmentToUtcForBuffer, clampSegmentToMaxMsLocal, clampSegmentToMinMsLocal, cycleEditorActivity, EDITOR_FIELD_ORDER } from './CardLogic'
import { useLanguage } from './translations'
import { IDLE_WARNING_MS, IDLE_CRITICAL_MS } from './Constants'
import type { CardInsertionState, CardData, CardInsertionPhase, ManualEntrySegment } from './TachoTypes'
import type { CountryEntry } from './data/countriesLoader'
import type { SymbolMap, TachoState } from './TachoTypes'
import { ACTIVITY_SYMBOLS, SPECIAL_SYMBOLS } from './TachoTypes'
import { parseSymbols, getIconChar, TachoIcon, TACHO_FONT } from './Symbols'
import { getActivityCode } from './CardLogic'
import { createInitialCardInsertionState } from './CardLogic'

const INPUT_WAITING_PHASES: CardInsertionState['phase'][] = ['decision1M', 'manualEditor', 'country', 'finalConfirm', 'itsQuestion', 'vdoQuestion']

const MANUAL_ENTRY_PHASES_FOR_SPEED: CardInsertionState['phase'][] = ['welcome', 'loading', 'lastRemoval', 'decision1M', 'manualEditor', 'country', 'finalConfirm', 'itsQuestion', 'vdoQuestion', 'idleWarning']

// Zkopírované časy zobrazení obrazovek
const WELCOME_MS = 3000
const LOADING_MS = 3000
const LAST_REMOVAL_MS = 4000
const FINALIZE_STEP1_MS = 2000
const FINALIZE_STEP2_MS = 2000
const FINALIZE_STEP3_MS = 4000
const ITS_VDO_CONFIRM_SAVED_MS = 2000
const READY_TO_DRIVE_MS = 3000

export type CardInsertionDisplay2Props = {
  symbolMap: SymbolMap | null
  cardInsertionState: CardInsertionState
  isBlinking: boolean
  isMultiManning: boolean
  countries: CountryEntry[]
  spanishRegions: CountryEntry[]
  lastEjectionTimeBySlot: { 1: number | null; 2: number | null }
  localTime: Date
  timeStr: string
  currentSpeed: number
  odometerKm: number
  card1Inserted: boolean
  card2Inserted: boolean
  leftActivityId: TachoState['leftActivityId']
  rightActivityId: TachoState['rightActivityId']
}

/** Zobrazení – shodné s CardWizard (L1, L2, symboly, kurzor) */
export function CardInsertionDisplay2(props: CardInsertionDisplay2Props) {
  const { symbolMap, cardInsertionState: cs, isBlinking, isMultiManning, countries, spanishRegions, lastEjectionTimeBySlot, localTime, timeStr, currentSpeed, odometerKm, card1Inserted, card2Inserted, leftActivityId, rightActivityId } = props
  const { t } = useLanguage()
  /** Ve fázích načítání (welcome, loading) se zobrazuje pouze příjmení. */
  const displayName = cs.phase === 'welcome' || cs.phase === 'loading' ? (cs.cardSurname ?? cs.cardName) : cs.cardName

  if (cs.phase === 'welcome') {
    const now = new Date()
    const localTimeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const utcTimeStrWelcome = now.toISOString().substring(11, 16)
    const multi = isMultiManning
    const slotLabel = String(cs.slot)
    const symbolPart = multi ? '(2)(2)' : '(2)'
    const rawL1 = `${slotLabel}${symbolPart} ${displayName}`
    const line1 = parseSymbols(rawL1, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion lcd-welcome">
        <div className="lcd-row lcd-welcome-l1">
          <span className="lcd-welcome-l1-name">{line1}</span>
        </div>
        <div className="lcd-row lcd-welcome-l2">
          <span className="lcd-welcome-l2-left">
            {localTimeStr}
            {parseSymbols('(37)', symbolMap)}
          </span>
          <span className="lcd-welcome-l2-right">
            {utcTimeStrWelcome}
            {' UTC'}
          </span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'loading') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWait}</div>
          <div className="lcd-row" />
        </div>
      )
    }
    const barSegments: Array<{ sym?: number; char?: string }> = [
      { sym: 15 },
      { sym: 15 },
      { sym: 16 },
      { sym: 16 },
      { char: '\u00a6' },
      { char: '\u00a6' },
      { char: '\u00a6' },
    ]
    const count = cs.loadingProgress >= 1 ? 7 : Math.floor(cs.loadingProgress * 7)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{displayName}</div>
        <div className="lcd-row lcd-row-left lcd-loading-row lcd-loading-bargraf">
          {barSegments.map((seg, i) => {
            const ch = seg.sym !== undefined ? (symbolMap?.[seg.sym!] ?? `(${seg.sym})`) : seg.char
            return (
              <span key={i} className={`tacho-icon ${i < count ? '' : 'lcd-bargraf-empty'}`}>
                {ch}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  if (cs.phase === 'lastRemoval') {
    const last = cs.lastWithdrawal ?? (cs.slot === 1 ? lastEjectionTimeBySlot[1] : lastEjectionTimeBySlot[2])
    const d = last != null ? new Date(last) : localTime
    const dateStr = d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStrLast = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{t.cardWizard.lastRemoval}</div>
        <div className="lcd-row lcd-row-left">{dateStr} {timeStrLast}</div>
      </div>
    )
  }

  if (cs.phase === 'decision1M') {
    const decision1mRaw = t.cardWizard.decision1m.replace('{slot}', String(cs.slot))
    const decision1mL1 = parseSymbols(decision1mRaw, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{decision1mL1}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.supplement}</span>
          <span className="lcd-decision-1m-blink">{cs.decisionSupplement ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'manualEditor') {
    if (cs.selectingCountryForStamp) {
      const code = cs.selectingSpanishRegion
        ? (spanishRegions[cs.spanishRegionIndex]?.code ?? '')
        : (countries[cs.countryIndex]?.code ?? 'CZ')
      const l1 = cs.stampActivityId === 'START_COUNTRY'
        ? parseSymbols(`(37)(36)?\u00A0${t.cardWizard.startCountry}`, symbolMap)
        : parseSymbols(`(41)(37)? ${t.cardWizard.endCountry}`, symbolMap)
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{l1}</div>
          <div className="lcd-row lcd-row-left lcd-country-code-blink">:{code}</div>
        </div>
      )
    }
    const seg = cs.currentSegment
    const start = cs.segmentStart
    const actSym = ACTIVITY_SYMBOLS.find((a) => a.id === seg.activityId)
    const blinkHide = (field: typeof cs.editorBlinkField) => (field === cs.editorBlinkField && isBlinking ? ' lcd-blink-hide' : '')
    const isStandardActivity = ['REST', 'WORK', 'AVAILABILITY', 'UNKNOWN'].includes(seg.activityId)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">
          <span className="lcd-l2-editor-content">
            <span className="lcd-l2-symbol">M</span>
            <span className="lcd-l2-space" />
            <span className="lcd-l2-num">{String(start.day).padStart(2, '0')}</span>
            <span className="lcd-l2-sep">.</span>
            <span className="lcd-l2-num">{String(start.month).padStart(2, '0')}</span>
            <span className="lcd-l2-sep">.</span>
            <span className="lcd-l2-num lcd-l2-year">{start.year}</span>
            <span className="lcd-l2-space lcd-l2-space-big" />
            <span className="lcd-l2-num">{String(start.hour).padStart(2, '0')}</span>
            <span className="lcd-l2-sep">:</span>
            <span className="lcd-l2-num">{String(start.minute).padStart(2, '0')}</span>
          </span>
        </div>
        <div className="lcd-row lcd-row-left">
          {isStandardActivity ? (
            <span className="lcd-l2-editor-content">
              <span className={`lcd-l2-symbol ${blinkHide('activity')}`}>
                {seg.activityId === 'UNKNOWN' ? (
                  <span className="lcd-display-font">?</span>
                ) : (
                  <TachoIcon code={actSym?.code ?? ''} />
                )}
              </span>
              <span className="lcd-l2-space" />
              <span className={`lcd-l2-num ${blinkHide('day')}`}>{String(seg.day).padStart(2, '0')}</span>
              <span className="lcd-l2-sep">.</span>
              <span className={`lcd-l2-num ${blinkHide('month')}`}>{String(seg.month).padStart(2, '0')}</span>
              <span className="lcd-l2-sep">.</span>
              <span className={`lcd-l2-num lcd-l2-year ${blinkHide('year')}`}>{seg.year}</span>
              <span className="lcd-l2-space lcd-l2-space-big" />
              <span className={`lcd-l2-num ${blinkHide('hour')}`}>{String(seg.hour).padStart(2, '0')}</span>
              <span className="lcd-l2-sep">:</span>
              <span className={`lcd-l2-num ${blinkHide('minute')}`}>{String(seg.minute).padStart(2, '0')}</span>
            </span>
          ) : seg.activityId === 'START_COUNTRY' ? (
            <span className={`lcd-l2-country-text${blinkHide('activity')}`}>
              {parseSymbols(`(37)(36)?\u00A0${t.cardWizard.startCountry}`, symbolMap)}
            </span>
          ) : seg.activityId === 'END_COUNTRY' ? (
            <span className={`lcd-l2-country-text${blinkHide('activity')}`}>
              {parseSymbols(`(41)(37)? ${t.cardWizard.endCountry}`, symbolMap)}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  if (cs.phase === 'country') {
    const code = cs.selectingSpanishRegion
      ? (spanishRegions[cs.spanishRegionIndex]?.code ?? '')
      : (countries[cs.countryIndex]?.code ?? 'CZ')
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{cs.selectingSpanishRegion ? t.cardWizard.regionSpain : parseSymbols(`(37)(36)\u00A0${t.cardWizard.startCountry}`, symbolMap)}</div>
        <div className="lcd-row lcd-row-left lcd-country-code-blink">:{code}</div>
      </div>
    )
  }

  if (cs.phase === 'idleWarning') {
    const l1 = parseSymbols(`(35) (19)\u00A0${t.cardWizard.idlePlease}`, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{l1}</div>
        <div className="lcd-row lcd-row-left">{t.cardWizard.input}</div>
      </div>
    )
  }

  if (cs.phase === 'itsQuestion') {
    const slotNum = cs.slot
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{slotNum} {t.cardWizard.publish}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.itsQuestion}</span>
          <span className={`lcd-decision-1m-blink ${isBlinking ? 'lcd-blink-hide' : ''}`}>{cs.itsYes ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'vdoQuestion') {
    const slotNum = cs.slot
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{slotNum} {t.cardWizard.publish}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.vdoQuestion}</span>
          <span className={`lcd-decision-1m-blink ${isBlinking ? 'lcd-blink-hide' : ''}`}>{cs.vdoYes ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'itsVdoConfirmSaved') {
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{t.cardWizard.input}</div>
        <div className="lcd-row lcd-row-left">{t.cardWizard.inputSaved}</div>
      </div>
    )
  }

  if (cs.phase === 'finalConfirm') {
    const slotSymbol = cs.slot === 1 ? 12 : 13
    const l1 = parseSymbols(`(${slotSymbol}) (42)\u00A0${t.cardWizard.confirmData}`, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{l1}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.confirm}</span>
          <span className="lcd-decision-1m-blink">{cs.finalConfirmYes ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'finalizeStep2' || cs.phase === 'readyToDrive') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWait}</div>
          <div className="lcd-row" />
        </div>
      )
    }
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{parseSymbols(`${isMultiManning ? '(2)(2)' : '(2)'}\u00A0${t.cardWizard.publishReady}`, symbolMap)}</div>
        <div className="lcd-row lcd-row-left">{t.cardWizard.readyToDrive}</div>
      </div>
    )
  }

  if (cs.phase === 'finalizeStep1' || cs.phase === 'finalizeStep3' || cs.phase === 'finalizeStep4') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWait}</div>
          <div className="lcd-row" />
        </div>
      )
    }
    const cardSymbolId = cs.phase === 'finalizeStep1' ? 15 : cs.phase === 'finalizeStep3' ? 16 : 14
    const cardSymbolEl = symbolMap?.[cardSymbolId] ? <span className="tacho-icon">{symbolMap[cardSymbolId]}</span> : <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} className="lcd-icon" />
    const leftEdgeChar = getActivityCode(leftActivityId)
    const rightEdgeChar = getActivityCode(rightActivityId)
    const showSlot1Card = cs.slot === 1 || card1Inserted
    const showSlot2Card = cs.slot === 2 || card2Inserted
    return (
      <div className={`lcd-two-rows lcd-card-insertion ${isMultiManning ? 'lcd-multi-manning' : ''}`} data-multi-manning={isMultiManning || undefined}>
        <div className="lcd-row">
          <div className="lcd-row-sides">{timeStr}{parseSymbols('(37)', symbolMap)}</div>
          <div className="lcd-row-center">
            {'   '}{parseSymbols(isMultiManning ? '(2)(2)' : '(2)', symbolMap)}
          </div>
          <div className="lcd-row-sides">{Math.round(currentSpeed)} km/h</div>
        </div>
        <div className="lcd-row">
          <div className="lcd-row-sides">
            <TachoIcon code={leftEdgeChar} />
            {showSlot1Card && (cs.slot === 1 ? cardSymbolEl : <><TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} /><span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span></>)}
          </div>
          <div className="lcd-row-center">
            {odometerKm.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
          </div>
          <div className="lcd-row-sides">
            {showSlot2Card && (cs.slot === 2 ? cardSymbolEl : <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />)}
            <TachoIcon code={rightEdgeChar} />
            {showSlot2Card && (cs.slot === 2 ? null : <span className="lcd-icon" style={{ fontFamily: TACHO_FONT }}>{getIconChar('card')}</span>)}
          </div>
        </div>
      </div>
    )
  }

  return null
}

export type UseCardWizard2Params = {
  countries: CountryEntry[]
  spanishRegions: CountryEntry[]
  simulatedUtcTime: number
  card1Data: CardData | null
  card2Data: CardData | null
  setCard1Data: React.Dispatch<React.SetStateAction<CardData | null>>
  setCard2Data: React.Dispatch<React.SetStateAction<CardData | null>>
  setDriverCardStateByTemplateId: React.Dispatch<React.SetStateAction<Record<string, { isFirstInsertion: boolean; itsConsent?: boolean; vdoConsent?: boolean }>>>
  setDriver1ManualEntryBuffer: React.Dispatch<React.SetStateAction<ManualEntrySegment[]>>
  setDriver2ManualEntryBuffer: React.Dispatch<React.SetStateAction<ManualEntrySegment[]>>
  isMultiManning: boolean
  onEjectRequested?: (slot: 1 | 2, options?: { idleTimeout?: boolean }) => void
  currentSpeed?: number
  /** Vrátí kód země dle aktuální GPS lokace (např. CZ, AT, DE) – pro výchozí výběr v nabídce zemí */
  getCurrentLocationCountryCode?: () => string | null
}

/**
 * Hook s logikou ukládání: data v celých minutách, L1 = L2+1 min, razítka zemí = HH:MM z L1.
 */
export function useCardWizard2(params: UseCardWizard2Params) {
  const {
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
    onEjectRequested,
    currentSpeed = 0,
    getCurrentLocationCountryCode,
  } = params

  const [cardInsertionState, setCardInsertionState] = useState<CardInsertionState | null>(null)
  const cardInsertionStateRef = useRef<CardInsertionState | null>(null)
  const lastCardInsertionKeyPressRef = useRef<number>(Date.now())
  const pleaseWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimeoutEjectionRef = useRef(false)
  const manualEntryAbortedBySpeedRef = useRef(false)
  const lastCardInsertionStateRef = useRef<CardInsertionState | null>(null)
  const countriesRef = useRef(countries)
  const spanishRegionsRef = useRef(spanishRegions)
  const simulatedUtcTimeRef = useRef(simulatedUtcTime)
  const card1DataRef = useRef(card1Data)
  const card2DataRef = useRef(card2Data)
  const getCurrentLocationCountryCodeRef = useRef(getCurrentLocationCountryCode)
  getCurrentLocationCountryCodeRef.current = getCurrentLocationCountryCode

  cardInsertionStateRef.current = cardInsertionState
  countriesRef.current = countries
  spanishRegionsRef.current = spanishRegions
  simulatedUtcTimeRef.current = simulatedUtcTime
  card1DataRef.current = card1Data
  card2DataRef.current = card2Data

  // Časy zobrazení: welcome 3s → loading 3s → lastRemoval 4s (nebo decision1M)
  useEffect(() => {
    if (!cardInsertionState) return
    const { phase, phaseStartTime } = cardInsertionState
    if (phase === 'finalizeStep1') {
      const elapsed = Date.now() - phaseStartTime
      const nextPhase = cardInsertionState.skipReadyToDriveScreen ? 'finalizeStep3' : 'finalizeStep2'
      if (elapsed >= FINALIZE_STEP1_MS) {
        setCardInsertionState((p) => (p?.phase === 'finalizeStep1' ? { ...p!, phase: nextPhase, phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'finalizeStep1' ? { ...p!, phase: nextPhase, phaseStartTime: Date.now() } : p)), FINALIZE_STEP1_MS - elapsed)
      return () => clearTimeout(t)
    }
    if (phase === 'finalizeStep2') {
      const elapsed = Date.now() - phaseStartTime
      if (elapsed >= FINALIZE_STEP2_MS) {
        setCardInsertionState((p) => (p?.phase === 'finalizeStep2' ? { ...p!, phase: 'finalizeStep3', phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'finalizeStep2' ? { ...p!, phase: 'finalizeStep3', phaseStartTime: Date.now() } : p)), FINALIZE_STEP2_MS - elapsed)
      return () => clearTimeout(t)
    }
    if (phase === 'finalizeStep3') {
      const elapsed = Date.now() - phaseStartTime
      if (elapsed >= FINALIZE_STEP3_MS) {
        setCardInsertionState((p) => (p?.phase === 'finalizeStep3' ? { ...p!, phase: 'finalizeStep4', phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'finalizeStep3' ? { ...p!, phase: 'finalizeStep4', phaseStartTime: Date.now() } : p)), FINALIZE_STEP3_MS - elapsed)
      return () => clearTimeout(t)
    }
    if (phase === 'finalizeStep4') {
      const t = setTimeout(() => {
        const s = cardInsertionStateRef.current
        if (s?.phase === 'finalizeStep4') {
          const tid = s.slot === 1 ? card1DataRef.current?.templateId : card2DataRef.current?.templateId
          if (tid && s.showItsVdoQuestions) {
            setDriverCardStateByTemplateId((prev) => ({
              ...prev,
              [tid]: { isFirstInsertion: false, itsConsent: s.itsYes, vdoConsent: s.vdoYes },
            }))
            if (s.slot === 1) setCard1Data((p) => (p ? { ...p, isFirstInsertion: false, itsConsent: s.itsYes, vdoConsent: s.vdoYes } : null))
            else setCard2Data((p) => (p ? { ...p, isFirstInsertion: false, itsConsent: s.itsYes, vdoConsent: s.vdoYes } : null))
          } else if (tid) {
            setDriverCardStateByTemplateId((prev) => ({ ...prev, [tid]: { isFirstInsertion: false } }))
            if (s.slot === 1) setCard1Data((p) => (p ? { ...p, isFirstInsertion: false } : null))
            else setCard2Data((p) => (p ? { ...p, isFirstInsertion: false } : null))
          }
        }
        setCardInsertionState(null)
      }, 300)
      return () => clearTimeout(t)
    }
    if (phase === 'itsVdoConfirmSaved') {
      const elapsed = Date.now() - phaseStartTime
      if (elapsed >= ITS_VDO_CONFIRM_SAVED_MS) {
        setCardInsertionState((p) => (p?.phase === 'itsVdoConfirmSaved' ? { ...p!, phase: 'finalizeStep1', phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(
        () => setCardInsertionState((p) => (p?.phase === 'itsVdoConfirmSaved' ? { ...p!, phase: 'finalizeStep1', phaseStartTime: Date.now() } : p)),
        ITS_VDO_CONFIRM_SAVED_MS - elapsed,
      )
      return () => clearTimeout(t)
    }
    if (phase === 'readyToDrive') {
      const elapsed = Date.now() - phaseStartTime
      if (elapsed >= READY_TO_DRIVE_MS) {
        setCardInsertionState(null)
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'readyToDrive' ? null : p)), READY_TO_DRIVE_MS - elapsed)
      return () => clearTimeout(t)
    }
    if (phase !== 'welcome' && phase !== 'loading' && phase !== 'lastRemoval') return

    const tick = () => {
      const elapsed = Date.now() - phaseStartTime
      setCardInsertionState((prev) => {
        if (!prev) return null
        if (prev.phase === 'welcome') {
          if (elapsed >= WELCOME_MS) return { ...prev, phase: 'loading', phaseStartTime: Date.now(), loadingProgress: 0 }
          return prev
        }
        if (prev.phase === 'loading') {
          const progress = Math.min(1, elapsed / LOADING_MS)
          if (progress >= 1) {
            if (prev.supplementDeclined) return { ...prev, phase: 'readyToDrive', phaseStartTime: Date.now(), loadingProgress: 1, supplementDeclined: false }
            /* Při opětovném vložení karty nejdřív obrazovka „Poslední vyjmutí“, pak decision1M. Při prvním vložení rovnou decision1M. */
            if (prev.firstInsertion) return { ...prev, phase: 'decision1M', phaseStartTime: Date.now(), loadingProgress: 1 }
            return { ...prev, phase: 'lastRemoval', phaseStartTime: Date.now(), loadingProgress: 1 }
          }
          return { ...prev, loadingProgress: progress }
        }
        if (prev.phase === 'lastRemoval') {
          if (elapsed >= LAST_REMOVAL_MS) return { ...prev, phase: 'decision1M', phaseStartTime: Date.now() }
          return prev
        }
        return prev
      })
    }
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [cardInsertionState?.phase, cardInsertionState?.phaseStartTime, cardInsertionState?.skipReadyToDriveScreen, setDriverCardStateByTemplateId, setCard1Data, setCard2Data])

  useEffect(() => {
    if (!cardInsertionState && pleaseWaitTimeoutRef.current) {
      clearTimeout(pleaseWaitTimeoutRef.current)
      pleaseWaitTimeoutRef.current = null
    }
  }, [cardInsertionState])

  // Detekce pohybu vozidla během manuálního zadávání – ukončit průvodce, doplnit UNKNOWN
  useEffect(() => {
    if (!cardInsertionState || currentSpeed <= 0) return
    if (!MANUAL_ENTRY_PHASES_FOR_SPEED.includes(cardInsertionState.phase)) return
    if (cardInsertionState.supplementDeclined) return // po "ne" jen animace načtení → připraven k jízdě
    const prev = cardInsertionState
    const insertionTimeFixed = floorToMinute(prev.cardInsertionTime)
    const startMs = prev.lastWithdrawal != null
      ? floorToMinute(prev.lastWithdrawal)
      : Math.max(0, insertionTimeFixed - 60000)
    const endMs = insertionTimeFixed
    if (startMs >= endMs) return
    const startSeg: ManualEntrySegment = { ...utcMsToSegment(startMs), activityId: 'UNKNOWN', isManualEntry: true }
    const endSeg: ManualEntrySegment = { ...utcMsToSegment(endMs), activityId: 'UNKNOWN', isManualEntry: true }
    const existingBuffer = prev.manualEntryBuffer ?? []
    const unknownBuffer: ManualEntrySegment[] = [...existingBuffer, startSeg, endSeg]
    manualEntryAbortedBySpeedRef.current = true
    if (prev.slot === 1) setDriver1ManualEntryBuffer(unknownBuffer)
    else setDriver2ManualEntryBuffer(unknownBuffer)
    setCardInsertionState({ ...prev, phase: 'finalizeStep1', phaseStartTime: Date.now(), skipReadyToDriveScreen: true, manualEntryBuffer: unknownBuffer })
  }, [cardInsertionState, currentSpeed, setDriver1ManualEntryBuffer, setDriver2ManualEntryBuffer])

  // Uložení manualEntryBuffer při ukončení průvodce (ne při idle timeout)
  useEffect(() => {
    if (cardInsertionState) {
      lastCardInsertionStateRef.current = cardInsertionState
      manualEntryAbortedBySpeedRef.current = false
    } else if (lastCardInsertionStateRef.current) {
      if (manualEntryAbortedBySpeedRef.current) {
        manualEntryAbortedBySpeedRef.current = false
        lastCardInsertionStateRef.current = null
        return
      }
      if (idleTimeoutEjectionRef.current) {
        idleTimeoutEjectionRef.current = false
        lastCardInsertionStateRef.current = null
        return
      }
      const prev = lastCardInsertionStateRef.current
      if (prev.slot === 1 && prev.manualEntryBuffer?.length) {
        setDriver1ManualEntryBuffer(prev.manualEntryBuffer)
      }
      if (prev.slot === 2 && prev.manualEntryBuffer?.length) {
        setDriver2ManualEntryBuffer(prev.manualEntryBuffer)
      }
      lastCardInsertionStateRef.current = null
    }
  }, [cardInsertionState, setDriver1ManualEntryBuffer, setDriver2ManualEntryBuffer])

  // Idle timeout
  useEffect(() => {
    const cs = cardInsertionState
    if (!cs) return
    const isInputWaiting = INPUT_WAITING_PHASES.includes(cs.phase) || cs.phase === 'idleWarning'
    if (!isInputWaiting) return
    const tick = () => {
      const lastPress = lastCardInsertionKeyPressRef.current
      const elapsed = Date.now() - lastPress
      if (elapsed >= IDLE_CRITICAL_MS) {
        idleTimeoutEjectionRef.current = true
        onEjectRequested?.(cs.slot, { idleTimeout: true })
        setCardInsertionState(null)
      } else if (elapsed >= IDLE_WARNING_MS && cs.phase !== 'idleWarning') {
        setCardInsertionState((p) => (p?.phase === cs.phase ? { ...p!, phase: 'idleWarning', phaseStartTime: Date.now(), idleWarningReturnPhase: p.phase } : p))
      }
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [cardInsertionState?.phase, cardInsertionState?.slot, onEjectRequested])

  const handleCardInsertionKey = useCallback((action: 'ok' | 'up' | 'down' | 'back') => {
    const now = Date.now()
    if (action === 'ok' && now - lastCardInsertionKeyPressRef.current < 400) return
    lastCardInsertionKeyPressRef.current = now
    setCardInsertionState((prev) => {
      if (!prev) return null
      if (prev.phase === 'idleWarning') {
        if (action === 'ok' && prev.idleWarningReturnPhase) {
          return { ...prev, phase: prev.idleWarningReturnPhase, phaseStartTime: Date.now(), idleWarningReturnPhase: undefined }
        }
        return prev
      }
      if (prev.phase === 'loading' && (action === 'ok' || action === 'up' || action === 'down')) {
        if (pleaseWaitTimeoutRef.current) clearTimeout(pleaseWaitTimeoutRef.current)
        pleaseWaitTimeoutRef.current = setTimeout(() => {
          setCardInsertionState((p) => (p ? { ...p, showPleaseWait: false } : null))
          pleaseWaitTimeoutRef.current = null
        }, 2000)
        return { ...prev, showPleaseWait: true }
      }
      if (prev.phase === 'decision1M') {
        if (action === 'up' || action === 'down') return { ...prev, decisionSupplement: !prev.decisionSupplement }
        if (action === 'ok') {
          if (!prev.decisionSupplement) {
            return { ...prev, phase: 'finalizeStep1', phaseStartTime: Date.now(), showItsVdoQuestions: false }
          }
          const insertionTimeFixed = floorToMinute(prev.cardInsertionTime)
          const l1FromLastWithdrawal =
            prev.lastWithdrawal != null
              ? localMsToSegment(floorToMinute(prev.lastWithdrawal))
              : localMsToSegment(segmentToMsUtc({ ...prev.segmentStart, activityId: 'REST' }))
          const segmentStartFixed = { day: l1FromLastWithdrawal.day, month: l1FromLastWithdrawal.month, year: l1FromLastWithdrawal.year, hour: l1FromLastWithdrawal.hour, minute: l1FromLastWithdrawal.minute }
          const minL2Ms = segmentToMs({ ...segmentStartFixed, activityId: 'REST' }) + 60000
          const l2Base = clampSegmentToMinMsLocal(localMsToSegment(insertionTimeFixed), minL2Ms)
          const l2Clamped = clampSegmentToMaxMsLocal({ ...prev.currentSegment, ...l2Base }, insertionTimeFixed)
          return {
            ...prev,
            phase: 'manualEditor',
            phaseStartTime: prev.phaseStartTime,
            insertionTimeFixed,
            segmentStart: segmentStartFixed,
            currentSegment: l2Clamped,
          }
        }
      }
      // Zbytek handlerů – manualEditor, country, finalConfirm, atd. – zjednodušeně bez ukládání
      if (prev.phase === 'manualEditor') {
        const insertionTimeFixed = prev.insertionTimeFixed ?? floorToMinute(prev.cardInsertionTime)
        const minL2Ms = segmentToMs(prev.segmentStart) + 60000
        const countriesList = countriesRef.current
        const regionsList = spanishRegionsRef.current
        const minAllowedTime = prev.lastWithdrawal != null ? floorToMinute(prev.lastWithdrawal) : null

        if (prev.selectingCountryForStamp && prev.stampActivityId) {
          if (action === 'up' || action === 'down') {
            if (prev.selectingSpanishRegion) {
              const delta = action === 'up' ? 1 : -1
              const i = (prev.spanishRegionIndex + delta + (regionsList.length || 1)) % (regionsList.length || 1)
              return { ...prev, spanishRegionIndex: i }
            }
            const delta = action === 'up' ? 1 : -1
            const i = (prev.countryIndex + delta + (countriesList.length || 1)) % (countriesList.length || 1)
            return { ...prev, countryIndex: i }
          }
          if (action === 'ok') {
            if (regionsList.length > 0 && !prev.selectingSpanishRegion && (countriesList[prev.countryIndex]?.code === 'E')) {
              return { ...prev, selectingSpanishRegion: true, spanishRegionIndex: 0 }
            }
            // Razítko výchozí/cílové země: přimknuté ke stejnému HH:MM jako na L1, v rozlišení minut
            const stampL1 = prev.stampL1Segment ?? prev.segmentStart
            const stampLocal = { ...stampL1, activityId: prev.stampActivityId, countryCode: prev.selectingSpanishRegion ? (regionsList[prev.spanishRegionIndex]?.code ?? '') : (countriesList[prev.countryIndex]?.code ?? 'CZ') }
            const stamp = localSegmentToUtcForBuffer(stampLocal)
            const segmentStartLocal = localMsToSegment(segmentToMsUtc(stamp))
            const l2Max = localMsToSegment(insertionTimeFixed)
            const nextDefaultActivity = prev.stampActivityId === 'START_COUNTRY' ? 'AVAILABILITY' : 'REST'
            return {
              ...prev,
              phase: 'manualEditor',
              manualEntryBuffer: [...prev.manualEntryBuffer, stamp],
              selectingCountryForStamp: false,
              stampActivityId: null,
              stampL1Segment: undefined,
              selectingSpanishRegion: false,
              segmentStart: { day: segmentStartLocal.day, month: segmentStartLocal.month, year: segmentStartLocal.year, hour: segmentStartLocal.hour, minute: segmentStartLocal.minute },
              currentSegment: { ...l2Max, activityId: nextDefaultActivity },
              editorBlinkField: 'activity',
            }
          }
        }
        if (action === 'back') {
          if (prev.selectingCountryForStamp) {
            return prev.selectingSpanishRegion ? { ...prev, selectingSpanishRegion: false } : { ...prev, selectingCountryForStamp: false, stampActivityId: null, selectingSpanishRegion: false }
          }
          if (prev.awaitingMaxTimeConfirm) {
            return { ...prev, awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
          }
          const idx = EDITOR_FIELD_ORDER.indexOf(prev.editorBlinkField)
          const prevFieldId = EDITOR_FIELD_ORDER[idx - 1]
          if (!prevFieldId) return prev
          return { ...prev, editorBlinkField: prevFieldId }
        }
        const field = prev.editorBlinkField
        const seg = { ...prev.currentSegment }
        if (action === 'up' || action === 'down') {
          const delta = action === 'up' ? 1 : -1
          if (field === 'activity') seg.activityId = cycleEditorActivity(seg.activityId, delta as 1 | -1)
          if (field === 'day') seg.day = ((seg.day - 1 + delta + 31) % 31) + 1
          if (field === 'month') {
            seg.month = ((seg.month - 1 + delta + 12) % 12) + 1
          }
          if (field === 'year') seg.year = seg.year + delta
          if (field === 'hour') {
            if (seg.hour === 0 && delta === -1) {
              seg.hour = 23
              const d = new Date(seg.year, seg.month - 1, seg.day)
              d.setDate(d.getDate() - 1)
              Object.assign(seg, { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() })
            } else if (seg.hour === 23 && delta === 1) {
              seg.hour = 0
              const d = new Date(seg.year, seg.month - 1, seg.day)
              d.setDate(d.getDate() + 1)
              Object.assign(seg, { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() })
            } else {
              seg.hour = (seg.hour + delta + 24) % 24
            }
          }
          if (field === 'minute') seg.minute = (seg.minute + delta + 60) % 60
          let adjusted = seg
          if (action === 'down' && minAllowedTime != null) {
            const ms = segmentToMs(adjusted)
            if (ms < minAllowedTime) {
              const minSeg = localMsToSegment(minAllowedTime)
              adjusted = { ...adjusted, day: minSeg.day, month: minSeg.month, year: minSeg.year, hour: minSeg.hour, minute: minSeg.minute }
            }
          }
          const clamped = clampSegmentToMinMsLocal(clampSegmentToMaxMsLocal(adjusted, insertionTimeFixed), minL2Ms)
          return { ...prev, currentSegment: clamped }
        }
        if (action === 'ok') {
          if (field === 'activity' && (seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY')) {
            const routeToTachograph: Record<string, string> = { CZ: 'CZ', AT: 'A', DE: 'D', CH: 'CH', FR: 'F', ES: 'E' }
            const gpsCode = getCurrentLocationCountryCodeRef.current?.() ?? 'CZ'
            const code = routeToTachograph[gpsCode] ?? gpsCode
            const idx = Math.max(0, countriesList.findIndex((c) => c.code === code))
            return {
              ...prev,
              selectingCountryForStamp: true,
              stampActivityId: seg.activityId,
              stampL1Segment: { ...prev.segmentStart },
              countryIndex: idx,
              selectingSpanishRegion: false,
            }
          }
          if (prev.awaitingMaxTimeConfirm) {
            const segForTime = prev.pendingMaxTimeSegment ?? seg
            const segMs = segmentToMs(segForTime)
            const hasStartCountry = prev.manualEntryBuffer.some((s) => s.activityId === 'START_COUNTRY')
            const nextPhase = hasStartCountry ? ('finalConfirm' as CardInsertionPhase) : ('country' as CardInsertionPhase)
            if (segMs >= insertionTimeFixed) {
              return { ...prev, phase: nextPhase, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const segValid = { ...segForTime, activityId: seg.activityId }
            const newBuffer = [...prev.manualEntryBuffer, localSegmentToUtcForBuffer({ ...prev.segmentStart, activityId: seg.activityId }), localSegmentToUtcForBuffer(segValid)]
            const l2Ms = floorToMinute(segMs)
            const l1NextMs = l2Ms + 60000
            if (l1NextMs > insertionTimeFixed) {
              return { ...prev, manualEntryBuffer: newBuffer, phase: nextPhase, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const l1FromL2PlusMinute = localMsToSegment(l1NextMs)
            const l2MaxTime = localMsToSegment(insertionTimeFixed)
            return {
              ...prev,
              manualEntryBuffer: newBuffer,
              segmentStart: l1FromL2PlusMinute,
              currentSegment: { ...l2MaxTime, activityId: 'REST' },
              editorBlinkField: 'activity',
              awaitingMaxTimeConfirm: false,
              pendingMaxTimeSegment: undefined,
            }
          }
          const idx = EDITOR_FIELD_ORDER.indexOf(field)
          const nextField = EDITOR_FIELD_ORDER[idx + 1]
          if (nextField) {
            return { ...prev, editorBlinkField: nextField, selectingCountryForStamp: false, stampActivityId: null, stampL1Segment: undefined }
          }
          const startMs = segmentToMs(prev.segmentStart)
          const segMs = segmentToMs(seg)
          const segValid = segMs > startMs ? seg : { ...localMsToSegment(startMs + 60000), activityId: seg.activityId }
          if (seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY') {
            const routeToTachograph: Record<string, string> = { CZ: 'CZ', AT: 'A', DE: 'D', CH: 'CH', FR: 'F', ES: 'E' }
            const gpsCode = getCurrentLocationCountryCodeRef.current?.() ?? 'CZ'
            const code = routeToTachograph[gpsCode] ?? gpsCode
            const idx = Math.max(0, countriesList.findIndex((c) => c.code === code))
            return {
              ...prev,
              selectingCountryForStamp: true,
              stampActivityId: seg.activityId,
              stampL1Segment: { ...prev.segmentStart },
              countryIndex: idx,
              selectingSpanishRegion: false,
            }
          }
          const newBuffer = [...prev.manualEntryBuffer, localSegmentToUtcForBuffer({ ...prev.segmentStart, activityId: seg.activityId }), localSegmentToUtcForBuffer({ ...segValid, activityId: seg.activityId })]
          const hasStartCountry = newBuffer.some((s) => s.activityId === 'START_COUNTRY')
          const nextPhase = hasStartCountry ? ('finalConfirm' as CardInsertionPhase) : ('country' as CardInsertionPhase)
          const l2Ms = floorToMinute(segmentToMs(segValid))
          if (l2Ms >= insertionTimeFixed) {
            return { ...prev, manualEntryBuffer: newBuffer, phase: nextPhase, phaseStartTime: Date.now() }
          }
          const l1NextMs = l2Ms + 60000
          if (l1NextMs > insertionTimeFixed) {
            return { ...prev, manualEntryBuffer: newBuffer, phase: nextPhase, phaseStartTime: Date.now() }
          }
          const l1FromL2PlusMinute = localMsToSegment(l1NextMs)
          const l2MaxTime = localMsToSegment(insertionTimeFixed)
          return {
            ...prev,
            manualEntryBuffer: newBuffer,
            segmentStart: l1FromL2PlusMinute,
            currentSegment: { ...l2MaxTime, activityId: 'REST' },
            editorBlinkField: 'activity',
          }
        }
      }
      if (prev.phase === 'country') {
        if (action === 'back') {
          if (prev.selectingSpanishRegion) {
            return { ...prev, selectingSpanishRegion: false }
          }
          return { ...prev, phase: 'itsVdoConfirmSaved' as CardInsertionPhase, phaseStartTime: Date.now(), finalConfirmSkippedEditor: true, selectingSpanishRegion: false }
        }
        const regionsList = spanishRegionsRef.current
        const countriesList = countriesRef.current
        const addStartCountryStamp = () => {
          const insertionTimeFixed = prev.insertionTimeFixed ?? floorToMinute(prev.cardInsertionTime)
          const countryCode = prev.selectingSpanishRegion ? (regionsList[prev.spanishRegionIndex]?.code ?? '') : (countriesList[prev.countryIndex]?.code ?? 'CZ')
          const stampMs = floorToMinute(insertionTimeFixed)
          const stamp = { ...utcMsToSegment(stampMs), activityId: 'START_COUNTRY' as const, countryCode, isManualEntry: true as const }
          return [...prev.manualEntryBuffer, stamp]
        }
        if (prev.selectingSpanishRegion) {
          if (action === 'up' || action === 'down') {
            const delta = action === 'up' ? 1 : -1
            const i = (prev.spanishRegionIndex + delta + (regionsList.length || 1)) % (regionsList.length || 1)
            return { ...prev, spanishRegionIndex: i }
          }
          if (action === 'ok') {
            const newBuffer = addStartCountryStamp()
            return { ...prev, manualEntryBuffer: newBuffer, selectingSpanishRegion: false, phase: 'finalConfirm' as CardInsertionPhase, phaseStartTime: Date.now(), finalConfirmSkippedEditor: true }
          }
        }
        if (action === 'up' || action === 'down') {
          const delta = action === 'up' ? 1 : -1
          const i = (prev.countryIndex + delta + (countriesList.length || 1)) % (countriesList.length || 1)
          return { ...prev, countryIndex: i }
        }
        if (action === 'ok') {
          const code = countriesList[prev.countryIndex]?.code ?? 'CZ'
          if (code === 'E' && regionsList.length > 0) {
            return { ...prev, selectingSpanishRegion: true, spanishRegionIndex: 0 }
          }
          const newBuffer = addStartCountryStamp()
          return { ...prev, manualEntryBuffer: newBuffer, phase: 'finalConfirm' as CardInsertionPhase, phaseStartTime: Date.now(), finalConfirmSkippedEditor: true, selectingSpanishRegion: false }
        }
      }
      if (prev.phase === 'finalConfirm') {
        if (action === 'up' || action === 'down') return { ...prev, finalConfirmYes: !prev.finalConfirmYes }
        if (action === 'ok') {
          if (prev.finalConfirmYes) {
            if (prev.showItsVdoQuestions) return { ...prev, phase: 'itsQuestion', phaseStartTime: Date.now() }
            return { ...prev, phase: 'itsVdoConfirmSaved', phaseStartTime: Date.now() }
          }
          /* „ne“ → krok zpět na obrazovku manuálního zadávání aktivit */
          return { ...prev, phase: 'manualEditor' as CardInsertionPhase, phaseStartTime: Date.now() }
        }
      }
      if (prev.phase === 'itsQuestion') {
        if (action === 'up' || action === 'down') return { ...prev, itsYes: !prev.itsYes }
        if (action === 'ok') return { ...prev, phase: 'vdoQuestion', phaseStartTime: Date.now() }
      }
      if (prev.phase === 'vdoQuestion') {
        if (action === 'up' || action === 'down') return { ...prev, vdoYes: !prev.vdoYes }
        if (action === 'ok') return { ...prev, phase: 'itsVdoConfirmSaved', phaseStartTime: Date.now() }
      }
      if (['finalizeStep1', 'finalizeStep2', 'finalizeStep3', 'finalizeStep4'].includes(prev.phase) && (action === 'ok' || action === 'up' || action === 'down' || action === 'back')) {
        if (pleaseWaitTimeoutRef.current) clearTimeout(pleaseWaitTimeoutRef.current)
        pleaseWaitTimeoutRef.current = setTimeout(() => {
          setCardInsertionState((p) => (p ? { ...p, showPleaseWait: false } : null))
          pleaseWaitTimeoutRef.current = null
        }, 2000)
        return { ...prev, showPleaseWait: true }
      }
      if (prev.phase === 'readyToDrive' || prev.phase === 'finalizeStep1' || prev.phase === 'finalizeStep2' || prev.phase === 'finalizeStep3' || prev.phase === 'finalizeStep4') return prev
      return prev
    })
  }, [])

  return {
    cardInsertionState,
    setCardInsertionState,
    handleCardInsertionKey,
    cardInsertionStateRef,
    lastCardInsertionKeyPressRef,
    createInitialState: (slot: 1 | 2, cardData: CardData) =>
      createInitialCardInsertionState(slot, cardData, simulatedUtcTimeRef.current, countriesRef.current, {
        initialCountryCode: getCurrentLocationCountryCodeRef.current?.() ?? undefined,
      }),
  }
}
