/**
 * Průvodce vložením karty – logika, efekty, obsluha tlačítek a zobrazení obrazovek
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { floorToMinute, utcMsToSegment, localMsToSegment, segmentToMs, segmentToMsUtc, clampSegmentToMaxMsLocal, clampSegmentToMinMsLocal, cycleEditorActivity, EDITOR_FIELD_ORDER } from './CardLogic'
import { IDLE_WARNING_MS, IDLE_CRITICAL_MS } from './Constants'
import type { CardInsertionState, CardData, CardInsertionPhase, ManualEntrySegment, FaultOrEvent, EventLogEntry } from './TachoTypes'
import type { CountryEntry } from './data/countriesLoader'
import type { SymbolMap, TachoState } from './TachoTypes'
import { ACTIVITY_SYMBOLS, SPECIAL_SYMBOLS } from './TachoTypes'
import { parseSymbols, getIconChar, TachoIcon, TACHO_FONT } from './Symbols'
import { getActivityCode } from './CardLogic'

const INPUT_WAITING_PHASES: CardInsertionState['phase'][] = ['decision1M', 'manualEditor', 'country', 'finalConfirm', 'itsQuestion', 'vdoQuestion']

export type CardInsertionDisplayProps = {
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

export function CardInsertionDisplay(props: CardInsertionDisplayProps) {
  const { symbolMap, cardInsertionState: cs, isBlinking, isMultiManning, countries, spanishRegions, lastEjectionTimeBySlot, localTime, timeStr, currentSpeed, odometerKm, card1Inserted, card2Inserted, leftActivityId, rightActivityId } = props
  const cardName = cs.cardName

  if (cs.phase === 'welcome') {
    const now = new Date()
    const localTimeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const utcTimeStrWelcome = now.toISOString().substring(11, 16)
    const multi = isMultiManning
    const slotLabel = String(cs.slot)
    const symbolPart = multi ? '(2)(2)' : '(2)'
    const rawL1 = `${slotLabel}${symbolPart} ${cardName}`
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
          <div className="lcd-row lcd-row-left">prosím čekejte!</div>
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
        <div className="lcd-row lcd-row-left">{cardName}</div>
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
        <div className="lcd-row lcd-row-left">Posled. vyjmutí</div>
        <div className="lcd-row lcd-row-left">{dateStr} {timeStrLast}</div>
      </div>
    )
  }

  if (cs.phase === 'decision1M') {
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row">1M vstup</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>doplnit?</span>
          <span className="lcd-decision-1m-blink">{cs.decisionSupplement ? 'ano' : 'ne'}</span>
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
        ? parseSymbols('(37)(36)?\u00A0výchozí země', symbolMap)
        : parseSymbols('(41)(37)? cílová země', symbolMap)
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
          {cs.firstInsertion ? (
            'První vložení'
          ) : (
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
          )}
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
              {parseSymbols('(37)(36)?\u00A0výchozí země', symbolMap)}
            </span>
          ) : seg.activityId === 'END_COUNTRY' ? (
            <span className={`lcd-l2-country-text${blinkHide('activity')}`}>
              {parseSymbols('(41)(37)? cílová země', symbolMap)}
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
        <div className="lcd-row lcd-row-left">{cs.selectingSpanishRegion ? 'region Španělsko' : parseSymbols('(37)(36)\u00A0výchozí země', symbolMap)}</div>
        <div className="lcd-row lcd-country-code-blink">:{code}</div>
      </div>
    )
  }

  if (cs.phase === 'idleWarning') {
    const l1 = parseSymbols('(35) (19)\u00A0prosím', symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{l1}</div>
        <div className="lcd-row lcd-row-left">zadání</div>
      </div>
    )
  }

  if (cs.phase === 'itsQuestion') {
    const slotNum = cs.slot
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{slotNum} Publikovat</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>ITS data?</span>
          <span className={`lcd-decision-1m-blink ${isBlinking ? 'lcd-blink-hide' : ''}`}>{cs.itsYes ? 'ano' : 'ne'}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'vdoQuestion') {
    const slotNum = cs.slot
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{slotNum} Publikovat</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>VDO data?</span>
          <span className={`lcd-decision-1m-blink ${isBlinking ? 'lcd-blink-hide' : ''}`}>{cs.vdoYes ? 'ano' : 'ne'}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'itsVdoConfirmSaved') {
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">zadání</div>
        <div className="lcd-row lcd-row-left">uloženo</div>
      </div>
    )
  }

  if (cs.phase === 'finalConfirm') {
    const slotSymbol = cs.slot === 1 ? 12 : 13
    const l1 = parseSymbols(`(${slotSymbol}) (42)\u00A0vložená data`, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{l1}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>potvrdit?</span>
          <span className="lcd-decision-1m-blink">{cs.finalConfirmYes ? 'ano' : 'ne'}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'finalizeStep2' || cs.phase === 'readyToDrive') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">prosím čekejte!</div>
          <div className="lcd-row" />
        </div>
      )
    }
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{parseSymbols('(2)\u00A0připraven', symbolMap)}</div>
        <div className="lcd-row lcd-row-left">k jízdě</div>
      </div>
    )
  }

  if (cs.phase === 'finalizeStep1' || cs.phase === 'finalizeStep3' || cs.phase === 'finalizeStep4') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">prosím čekejte!</div>
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
            {'   '}{parseSymbols('(2)', symbolMap)}
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

export type UseCardWizardParams = {
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
  setDrivingWithoutValidCardWarningActive: (v: boolean) => void
  setFaultsAndEvents: React.Dispatch<React.SetStateAction<FaultOrEvent[]>>
  setEventLog: React.Dispatch<React.SetStateAction<EventLogEntry[]>>
  /** Vyčistit slot při vypršení idle timeoutu (karta se vysune). Hook sám nastaví cardInsertionState na null.
   * @param options.idleTimeout - když true, karta se vysune bez zápisu a bez změny lastWithdrawal */
  onEjectRequested: (slot: 1 | 2, options?: { idleTimeout?: boolean }) => void
  currentSpeed: number
}

export function useCardWizard(params: UseCardWizardParams) {
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
    setDrivingWithoutValidCardWarningActive,
    setFaultsAndEvents,
    setEventLog,
    onEjectRequested,
    currentSpeed,
  } = params

  const [cardInsertionState, setCardInsertionState] = useState<CardInsertionState | null>(null)

  const cardInsertionStateRef = useRef<CardInsertionState | null>(null)
  const lastCardInsertionKeyPressRef = useRef<number>(Date.now())
  const pleaseWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualEntryAbortedBySpeedRef = useRef(false)
  const idleTimeoutEjectionRef = useRef(false)
  const lastCardInsertionStateRef = useRef<CardInsertionState | null>(null)

  cardInsertionStateRef.current = cardInsertionState

  const countriesRef = useRef(countries)
  const spanishRegionsRef = useRef(spanishRegions)
  const card1DataRef = useRef(card1Data)
  const card2DataRef = useRef(card2Data)
  const simulatedUtcTimeRef = useRef(simulatedUtcTime)
  countriesRef.current = countries
  spanishRegionsRef.current = spanishRegions
  card1DataRef.current = card1Data
  card2DataRef.current = card2Data
  simulatedUtcTimeRef.current = simulatedUtcTime

  useEffect(() => {
    if (!cardInsertionState) return
    const { phase, phaseStartTime } = cardInsertionState
    if (phase === 'finalizeStep1') {
      const elapsed = Date.now() - phaseStartTime
      const nextPhase = cardInsertionState.skipReadyToDriveScreen ? 'finalizeStep3' : 'finalizeStep2'
      if (elapsed >= 2000) {
        setCardInsertionState((p) => (p?.phase === 'finalizeStep1' ? { ...p!, phase: nextPhase, phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'finalizeStep1' ? { ...p!, phase: nextPhase, phaseStartTime: Date.now() } : p)), 2000 - elapsed)
      return () => clearTimeout(t)
    }
    if (phase === 'finalizeStep2') {
      const elapsed = Date.now() - phaseStartTime
      const dur = 2000
      if (elapsed >= dur) {
        setCardInsertionState((p) => (p?.phase === 'finalizeStep2' ? { ...p!, phase: 'finalizeStep3', phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'finalizeStep2' ? { ...p!, phase: 'finalizeStep3', phaseStartTime: Date.now() } : p)), dur - elapsed)
      return () => clearTimeout(t)
    }
    if (phase === 'finalizeStep3') {
      const elapsed = Date.now() - phaseStartTime
      if (elapsed >= 4000) {
        setCardInsertionState((p) => (p?.phase === 'finalizeStep3' ? { ...p!, phase: 'finalizeStep4', phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'finalizeStep3' ? { ...p!, phase: 'finalizeStep4', phaseStartTime: Date.now() } : p)), 4000 - elapsed)
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
      const CONFIRM_SAVED_MS = 2000
      const elapsed = Date.now() - phaseStartTime
      if (elapsed >= CONFIRM_SAVED_MS) {
        setCardInsertionState((p) => (p?.phase === 'itsVdoConfirmSaved' ? { ...p!, phase: 'finalizeStep1', phaseStartTime: Date.now() } : p))
        return
      }
      const t = setTimeout(
        () => setCardInsertionState((p) => (p?.phase === 'itsVdoConfirmSaved' ? { ...p!, phase: 'finalizeStep1', phaseStartTime: Date.now() } : p)),
        CONFIRM_SAVED_MS - elapsed,
      )
      return () => clearTimeout(t)
    }
    if (phase === 'readyToDrive') {
      const elapsed = Date.now() - phaseStartTime
      if (elapsed >= 3000) {
        setCardInsertionState(null)
        return
      }
      const t = setTimeout(() => setCardInsertionState((p) => (p?.phase === 'readyToDrive' ? null : p)), 3000 - elapsed)
      return () => clearTimeout(t)
    }
    if (phase !== 'welcome' && phase !== 'loading' && phase !== 'lastRemoval') return

    const tick = () => {
      const elapsed = Date.now() - phaseStartTime
      setCardInsertionState((prev) => {
        if (!prev) return null
        if (prev.phase === 'welcome') {
          if (elapsed >= 3000) {
            return { ...prev, phase: 'loading', phaseStartTime: Date.now(), loadingProgress: 0 }
          }
          return prev
        }
        if (prev.phase === 'loading') {
          const progress = Math.min(1, elapsed / 3000)
          if (progress >= 1) {
            if (prev.supplementDeclined) return { ...prev, phase: 'readyToDrive', phaseStartTime: Date.now(), loadingProgress: 1, supplementDeclined: false }
            if (prev.firstInsertion) {
              return { ...prev, phase: 'decision1M', phaseStartTime: Date.now(), loadingProgress: 1 }
            }
            return { ...prev, phase: 'lastRemoval', phaseStartTime: Date.now(), loadingProgress: 1 }
          }
          return { ...prev, loadingProgress: progress }
        }
        if (prev.phase === 'lastRemoval') {
          if (elapsed >= 4000) {
            return { ...prev, phase: 'decision1M', phaseStartTime: Date.now() }
          }
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
              : prev.segmentStart
          const segmentStartFixed = {
            day: l1FromLastWithdrawal.day,
            month: l1FromLastWithdrawal.month,
            year: l1FromLastWithdrawal.year,
            hour: l1FromLastWithdrawal.hour,
            minute: l1FromLastWithdrawal.minute,
          }
          const minL2Ms = segmentToMs(segmentStartFixed) + 60000
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
      if (prev.phase === 'manualEditor') {
        const insertionTimeFixed = prev.insertionTimeFixed ?? floorToMinute(prev.cardInsertionTime)
        const minAllowedTime = prev.lastWithdrawal != null ? floorToMinute(prev.lastWithdrawal) : null
        const minL2Ms = segmentToMs(prev.segmentStart) + 60000
        const countriesList = countriesRef.current
        const regionsList = spanishRegionsRef.current

        if (prev.selectingCountryForStamp && prev.stampActivityId) {
          if (action === 'up' || action === 'down') {
            if (prev.selectingSpanishRegion) {
              const delta = action === 'up' ? 1 : -1
              const len = regionsList.length || 1
              const i = (prev.spanishRegionIndex + delta + len) % len
              return { ...prev, spanishRegionIndex: i }
            }
            const delta = action === 'up' ? 1 : -1
            const len = countriesList.length || 1
            const i = (prev.countryIndex + delta + len) % len
            return { ...prev, countryIndex: i }
          }
          if (action === 'ok') {
            const code = prev.selectingSpanishRegion
              ? (regionsList[prev.spanishRegionIndex]?.code ?? '')
              : (countriesList[prev.countryIndex]?.code ?? 'CZ')
            if (code === 'E' && regionsList.length > 0 && !prev.selectingSpanishRegion) {
              return { ...prev, selectingSpanishRegion: true, spanishRegionIndex: 0 }
            }
            // OK u cílové/výchozí země = pouze časové razítko v čase a datumu který je na L1
            const stampBase = prev.stampL1Segment ?? prev.segmentStart
            const stampLocal = {
              ...stampBase,
              activityId: prev.stampActivityId,
              countryCode: prev.selectingSpanishRegion ? (regionsList[prev.spanishRegionIndex]?.code ?? '') : code,
              isManualEntry: true,
            }
            const stamp = { ...utcMsToSegment(segmentToMs(stampLocal)), activityId: stampLocal.activityId, countryCode: stampLocal.countryCode, isManualEntry: stampLocal.isManualEntry }
            const buffer = [...prev.manualEntryBuffer, stamp]
            // segmentStart v lokálním čase pro další blok (stamp má UTC)
            const segmentStartLocal = localMsToSegment(segmentToMsUtc(stamp))
            const l2Max = localMsToSegment(insertionTimeFixed)
            const nextDefaultActivity =
              prev.stampActivityId === 'START_COUNTRY'
                ? ('AVAILABILITY' as const)
                : ('REST' as const)
            return {
              ...prev,
              phase: 'manualEditor' as const,
              manualEntryBuffer: buffer,
              selectingCountryForStamp: false,
              stampActivityId: null,
              stampL2Segment: undefined,
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
            if (prev.selectingSpanishRegion) {
              return { ...prev, selectingSpanishRegion: false }
            }
            return { ...prev, selectingCountryForStamp: false, stampActivityId: null, stampL2Segment: undefined, stampL1Segment: undefined, selectingSpanishRegion: false }
          }
          if (prev.awaitingMaxTimeConfirm) {
            const segUser = prev.currentSegment
            const startMs = segmentToMs(prev.segmentStart)
            const segMsValid = segmentToMs(segUser)
            const segValid = segMsValid > startMs ? segUser : { ...localMsToSegment(startMs + 60000), activityId: segUser.activityId }
            const toAddUtc = (s: typeof prev.segmentStart & { activityId: typeof segUser.activityId }) =>
              ({ ...utcMsToSegment(segmentToMs(s)), activityId: s.activityId, isManualEntry: true as const })
            const toAdd =
              prev.manualEntryBuffer.length === 0 && startMs < segmentToMs(segValid)
                ? [toAddUtc({ ...prev.segmentStart, activityId: segUser.activityId }), toAddUtc({ ...segValid, activityId: segUser.activityId })]
                : [toAddUtc({ ...segValid, activityId: segUser.activityId })]
            const buffer = [...prev.manualEntryBuffer, ...toAdd]
            const insertionTimeFixed = prev.insertionTimeFixed ?? floorToMinute(prev.cardInsertionTime)
            if (segmentToMs(segValid) >= insertionTimeFixed) {
              return { ...prev, manualEntryBuffer: buffer, phase: 'country' as const, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const nextSeg = clampSegmentToMaxMsLocal({ ...segValid }, insertionTimeFixed)
            const nextBlockMinMs = segmentToMs(nextSeg) + 60000
            if (nextBlockMinMs > insertionTimeFixed) {
              return { ...prev, manualEntryBuffer: buffer, phase: 'country' as const, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const l1Seg = localMsToSegment(nextBlockMinMs)
            const l2MaxSeg = localMsToSegment(insertionTimeFixed)
            return {
              ...prev,
              manualEntryBuffer: buffer,
              segmentStart: { day: l1Seg.day, month: l1Seg.month, year: l1Seg.year, hour: l1Seg.hour, minute: l1Seg.minute },
              currentSegment: { ...l2MaxSeg, activityId: 'REST' as const },
              editorBlinkField: 'activity',
              awaitingMaxTimeConfirm: false,
              pendingMaxTimeSegment: undefined,
            }
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
            if (action === 'down') {
              const top = prev.segmentStart
              if (seg.month === top.month) {
                seg.day = top.day
                seg.hour = top.hour
                seg.minute = top.minute
              }
            }
          }
          if (field === 'year') seg.year = seg.year + delta
          if (field === 'hour') {
            if (seg.hour === 0 && delta === -1) {
              seg.hour = 23
              const d = new Date(seg.year, seg.month - 1, seg.day)
              d.setDate(d.getDate() - 1)
              seg.day = d.getDate()
              seg.month = d.getMonth() + 1
              seg.year = d.getFullYear()
            } else if (seg.hour === 23 && delta === 1) {
              seg.hour = 0
              const d = new Date(seg.year, seg.month - 1, seg.day)
              d.setDate(d.getDate() + 1)
              seg.day = d.getDate()
              seg.month = d.getMonth() + 1
              seg.year = d.getFullYear()
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

          let clamped = clampSegmentToMaxMsLocal(adjusted, insertionTimeFixed)
          clamped = clampSegmentToMinMsLocal(clamped, minL2Ms)
          return { ...prev, currentSegment: clamped }
        }
        if (action === 'ok') {
          if (field === 'activity' && (seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY')) {
            // OK u výchozí/cílové země = pouze razítko na L1, nic dalšího
            return {
              ...prev,
              selectingCountryForStamp: true,
              stampActivityId: seg.activityId as 'START_COUNTRY' | 'END_COUNTRY',
              stampL1Segment: { day: prev.segmentStart.day, month: prev.segmentStart.month, year: prev.segmentStart.year, hour: prev.segmentStart.hour, minute: prev.segmentStart.minute },
              countryIndex: Math.max(0, countriesList.findIndex((c) => c.code === 'CZ')),
              selectingSpanishRegion: false,
            }
          }
          const idx = EDITOR_FIELD_ORDER.indexOf(field)
          const nextField = EDITOR_FIELD_ORDER[idx + 1]
          if (nextField) {
            return {
              ...prev,
              editorBlinkField: nextField,
              selectingCountryForStamp: false,
              stampActivityId: null,
              stampL2Segment: undefined,
              stampL1Segment: undefined,
            }
          }
          if (prev.awaitingMaxTimeConfirm) {
            const segForTime =
              prev.pendingMaxTimeSegment != null
                ? { ...prev.pendingMaxTimeSegment, activityId: seg.activityId }
                : seg
            const segMs = segmentToMs(segForTime)
            const startMs = segmentToMs(prev.segmentStart)
            const segValid = segMs > startMs ? segForTime : { ...localMsToSegment(startMs + 60000), activityId: seg.activityId }
            const segMsValid = segmentToMs(segValid)
            const isCountryStamp = seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY'
            if (isCountryStamp) {
              // OK u výchozí/cílové země = pouze razítko na L1
              return {
                ...prev,
                selectingCountryForStamp: true,
                stampActivityId: seg.activityId as 'START_COUNTRY' | 'END_COUNTRY',
                stampL1Segment: { day: prev.segmentStart.day, month: prev.segmentStart.month, year: prev.segmentStart.year, hour: prev.segmentStart.hour, minute: prev.segmentStart.minute },
                countryIndex: Math.max(0, countriesList.findIndex((c) => c.code === 'CZ')),
                selectingSpanishRegion: false,
                awaitingMaxTimeConfirm: false,
                pendingMaxTimeSegment: undefined,
              }
            }
            const isFirstBlock = prev.manualEntryBuffer.length === 0
            const blockSpansFromStart = isFirstBlock && startMs < segMsValid
            const toAddUtc = (s: typeof prev.segmentStart & { activityId: typeof seg.activityId }) =>
              ({ ...utcMsToSegment(segmentToMs(s)), activityId: s.activityId, isManualEntry: true as const })
            const toAdd = blockSpansFromStart
              ? [
                  toAddUtc({ ...prev.segmentStart, activityId: seg.activityId }),
                  toAddUtc({ ...segValid, activityId: seg.activityId }),
                ]
              : [toAddUtc({ ...segValid, activityId: seg.activityId })]
            const buffer = [...prev.manualEntryBuffer, ...toAdd]
            if (segMsValid >= insertionTimeFixed) {
              return { ...prev, manualEntryBuffer: buffer, phase: 'country' as const, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const nextSeg = clampSegmentToMaxMsLocal({ ...segValid }, insertionTimeFixed)
            const nextSegMs = segmentToMs(nextSeg)
            const nextBlockMinMs = nextSegMs + 60000
            if (nextBlockMinMs > insertionTimeFixed) {
              return { ...prev, manualEntryBuffer: buffer, phase: 'country' as const, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const l1Seg = localMsToSegment(nextBlockMinMs)
            const l2MaxSeg = localMsToSegment(insertionTimeFixed)
            return {
              ...prev,
              manualEntryBuffer: buffer,
              segmentStart: { day: l1Seg.day, month: l1Seg.month, year: l1Seg.year, hour: l1Seg.hour, minute: l1Seg.minute },
              currentSegment: { ...l2MaxSeg, activityId: 'REST' as const },
              editorBlinkField: 'activity',
              awaitingMaxTimeConfirm: false,
              pendingMaxTimeSegment: undefined,
            }
          }
          const startMs = segmentToMs(prev.segmentStart)
          if (field === 'minute') {
            const segMs = segmentToMs(seg)
            if (segMs < insertionTimeFixed && segMs > startMs) {
              const maxSeg = localMsToSegment(insertionTimeFixed)
              let segWithMax = clampSegmentToMaxMsLocal(
                { ...seg, day: maxSeg.day, month: maxSeg.month, year: maxSeg.year, hour: maxSeg.hour, minute: maxSeg.minute },
                insertionTimeFixed,
              )
              segWithMax = clampSegmentToMinMsLocal(segWithMax, minL2Ms)
              if (segmentToMs(segWithMax) <= insertionTimeFixed) {
                return { ...prev, pendingMaxTimeSegment: segWithMax, editorBlinkField: 'activity', awaitingMaxTimeConfirm: true }
              }
            }
          }
          const segMs = segmentToMs(seg)
          const segValid = segMs > startMs ? seg : localMsToSegment(startMs + 60000)
          const segMsValid = segmentToMs(segValid)
          const isCountryStamp = seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY'
          if (isCountryStamp) {
            // OK u výchozí/cílové země = pouze razítko na L1
            return {
              ...prev,
              selectingCountryForStamp: true,
              stampActivityId: seg.activityId as 'START_COUNTRY' | 'END_COUNTRY',
              stampL1Segment: { day: prev.segmentStart.day, month: prev.segmentStart.month, year: prev.segmentStart.year, hour: prev.segmentStart.hour, minute: prev.segmentStart.minute },
              countryIndex: Math.max(0, countriesList.findIndex((c) => c.code === 'CZ')),
              selectingSpanishRegion: false,
            }
          }
          const isFirstBlock = prev.manualEntryBuffer.length === 0
          const blockSpansFromStart = isFirstBlock && startMs < segMsValid
          const toAddUtc = (s: typeof prev.segmentStart & { activityId: typeof seg.activityId }) =>
            ({ ...utcMsToSegment(segmentToMs(s)), activityId: s.activityId, isManualEntry: true as const })
          const toAdd = blockSpansFromStart
            ? [
                toAddUtc({ ...prev.segmentStart, activityId: seg.activityId }),
                toAddUtc({ ...segValid, activityId: seg.activityId }),
              ]
            : [toAddUtc({ ...segValid, activityId: seg.activityId })]
          const buffer = [...prev.manualEntryBuffer, ...toAdd]
          if (segMsValid >= insertionTimeFixed) {
            return { ...prev, manualEntryBuffer: buffer, phase: 'country' as const, phaseStartTime: Date.now() }
          }
          const nextSeg = clampSegmentToMaxMsLocal({ ...segValid }, insertionTimeFixed)
          const nextSegMs = segmentToMs(nextSeg)
          const nextBlockMinMs = nextSegMs + 60000
          if (nextBlockMinMs > insertionTimeFixed) {
            return { ...prev, manualEntryBuffer: buffer, phase: 'country' as const, phaseStartTime: Date.now() }
          }
          const l1Seg = localMsToSegment(nextBlockMinMs)
          const l2MaxSeg = localMsToSegment(insertionTimeFixed)
          return {
            ...prev,
            manualEntryBuffer: buffer,
            segmentStart: { day: l1Seg.day, month: l1Seg.month, year: l1Seg.year, hour: l1Seg.hour, minute: l1Seg.minute },
            currentSegment: { ...l2MaxSeg, activityId: 'REST' as const },
            editorBlinkField: 'activity',
          }
        }
      }
      if (prev.phase === 'country') {
        if (action === 'back') {
          if (prev.selectingSpanishRegion) {
            return { ...prev, selectingSpanishRegion: false }
          }
          return {
            ...prev,
            phase: 'finalConfirm',
            phaseStartTime: Date.now(),
            finalConfirmSkippedEditor: true,
            selectingSpanishRegion: false,
          }
        }
        const countriesList = countriesRef.current
        const regionsList = spanishRegionsRef.current
        const addStartCountryAndConfirm = () => {
          const code = prev.selectingSpanishRegion
            ? (regionsList[prev.spanishRegionIndex]?.code ?? '')
            : (countriesList[prev.countryIndex]?.code ?? 'CZ')
          const insertionTimeFixed = prev.insertionTimeFixed ?? floorToMinute(prev.cardInsertionTime)
          // Výchozí země po manuálním záznamu má razítko v čase vložení karty (L2), ne vytažení
          // – nahradíme poslední segment (L2), aby nevznikl duplicitní (L2,L2) blok
          const hasManualBlocks = prev.manualEntryBuffer.length > 0
          const startCountryStamp = {
            ...utcMsToSegment(insertionTimeFixed),
            activityId: 'START_COUNTRY' as const,
            countryCode: code,
            isManualEntry: true,
          }
          const newBuffer = hasManualBlocks
            ? [...prev.manualEntryBuffer.slice(0, -1), startCountryStamp]
            : [...prev.manualEntryBuffer, startCountryStamp]
          return {
            ...prev,
            manualEntryBuffer: newBuffer,
            phase: 'finalConfirm' as CardInsertionPhase,
            phaseStartTime: Date.now(),
            finalConfirmSkippedEditor: true,
            selectingSpanishRegion: false,
          }
        }
        if (prev.selectingSpanishRegion) {
          if (action === 'up' || action === 'down') {
            const delta = action === 'up' ? 1 : -1
            const len = regionsList.length || 1
            const i = (prev.spanishRegionIndex + delta + len) % len
            return { ...prev, spanishRegionIndex: i }
          }
          if (action === 'ok') return addStartCountryAndConfirm()
        } else {
          if (action === 'up' || action === 'down') {
            const delta = action === 'up' ? 1 : -1
            const len = countriesList.length || 1
            const i = (prev.countryIndex + delta + len) % len
            return { ...prev, countryIndex: i }
          }
          if (action === 'ok') {
            const code = countriesList[prev.countryIndex]?.code ?? 'CZ'
            if (code === 'E' && regionsList.length > 0) {
              return { ...prev, selectingSpanishRegion: true, spanishRegionIndex: 0 }
            }
            return addStartCountryAndConfirm()
          }
        }
      }
      if (prev.phase === 'finalConfirm') {
        if (action === 'up' || action === 'down') return { ...prev, finalConfirmYes: !prev.finalConfirmYes }
        if (action === 'ok') {
          if (prev.finalConfirmYes) {
            if (prev.showItsVdoQuestions) return { ...prev, phase: 'itsQuestion', phaseStartTime: Date.now() }
            return { ...prev, phase: 'itsVdoConfirmSaved', phaseStartTime: Date.now() }
          }
          return null
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
      const isCardInitializingPhase = ['finalizeStep1', 'finalizeStep2', 'finalizeStep3', 'finalizeStep4'].includes(prev.phase)
      if (isCardInitializingPhase && (action === 'ok' || action === 'up' || action === 'down' || action === 'back')) {
        if (pleaseWaitTimeoutRef.current) clearTimeout(pleaseWaitTimeoutRef.current)
        pleaseWaitTimeoutRef.current = setTimeout(() => {
          setCardInsertionState((p) => (p ? { ...p, showPleaseWait: false } : null))
          pleaseWaitTimeoutRef.current = null
        }, 2000)
        return { ...prev, showPleaseWait: true }
      }
      if (prev.phase === 'readyToDrive' || prev.phase === 'finalizeStep1' || prev.phase === 'finalizeStep2' || prev.phase === 'finalizeStep3' || prev.phase === 'finalizeStep4') {
        return prev
      }
      return prev
    })
  }, [])

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
        onEjectRequested(cs.slot, { idleTimeout: true })
        setCardInsertionState(null)
        return
      }
      if (elapsed >= IDLE_WARNING_MS && cs.phase !== 'idleWarning') {
        setCardInsertionState((p) => (p?.phase === cs.phase ? { ...p!, phase: 'idleWarning', phaseStartTime: Date.now(), idleWarningReturnPhase: p.phase } : p))
      }
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [cardInsertionState?.phase, cardInsertionState?.slot, onEjectRequested])

  useEffect(() => {
    if (!cardInsertionState || currentSpeed <= 0) return
    const isManualEntry = INPUT_WAITING_PHASES.includes(cardInsertionState.phase) || cardInsertionState.phase === 'idleWarning'
    if (isManualEntry) {
      const slot = cardInsertionState.slot
      const ts = simulatedUtcTimeRef.current
      const startMs = cardInsertionState.lastWithdrawal ?? segmentToMs({ ...cardInsertionState.segmentStart, activityId: 'REST' })
      const d = new Date(startMs)
      const unknownSegment: ManualEntrySegment = {
        activityId: 'UNKNOWN',
        day: d.getUTCDate(),
        month: d.getUTCMonth() + 1,
        year: d.getUTCFullYear(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
      }
      manualEntryAbortedBySpeedRef.current = true
      if (slot === 1) {
        setDriver1ManualEntryBuffer((prev) => [...prev, unknownSegment])
      } else {
        setDriver2ManualEntryBuffer((prev) => [...prev, unknownSegment])
      }
      setCardInsertionState(null)
      setDrivingWithoutValidCardWarningActive(true)
      setFaultsAndEvents((prev) => [
        ...prev,
        { id: Date.now(), timestampUtc: ts, type: 'DRIVING_WITHOUT_VALID_CARD_WARNING', duringIncompleteManualEntry: true },
      ])
      setEventLog((prev) => [
        ...prev,
        { id: Date.now(), type: 'DRIVING_WITHOUT_VALID_CARD', startTime: ts, duringIncompleteManualEntry: true },
      ])
    }
  }, [cardInsertionState, currentSpeed, setDriver1ManualEntryBuffer, setDriver2ManualEntryBuffer, setDrivingWithoutValidCardWarningActive, setFaultsAndEvents, setEventLog])

  return {
    cardInsertionState,
    setCardInsertionState,
    handleCardInsertionKey,
    cardInsertionStateRef,
    lastCardInsertionKeyPressRef,
  }
}
