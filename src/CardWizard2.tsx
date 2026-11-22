/**
 * Průvodce vložením karty – verze s logikou ukládání:
 * - Data v rozlišení celých minut
 * - Po zadání jednoho segmentu: další krok přebere L2 na L1 (+ 1 minuta), na L2 se zobrazí maximální čas (čas vložení karty)
 * - Výchozí/cílová země: časové razítko přimknuté ke stejnému HH:MM jako na L1
 *
 * Časová zóna: segmentStart a currentSegment jsou hodiny tachografu.
 * Zápis do manualEntryBuffer je UTC: offset tachografu se odečte právě jednou.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { advanceConfirmedCapToMinute, floorToMinute, utcMsToSegment, segmentToMsUtc, utcMsToTachographSegment, tachographSegmentToUtcMs, tachographSegmentToUtcForBuffer, clampTachographSegment, cycleEditorActivity, EDITOR_FIELD_ORDER } from './CardLogic'
import { IDLE_WARNING_MS, IDLE_CRITICAL_MS } from './Constants'
import type { CardInsertionState, CardData, CardInsertionPhase, ManualEntrySegment } from './TachoTypes'
import type { CountryEntry } from './data/countriesLoader'
import { createInitialCardInsertionState } from './CardLogic'

const INPUT_WAITING_PHASES: CardInsertionState['phase'][] = ['invalidCard', 'decision1M', 'manualEditor', 'country', 'finalConfirm', 'itsQuestion', 'vdoQuestion']

const MANUAL_ENTRY_PHASES_FOR_SPEED: CardInsertionState['phase'][] = ['welcome', 'loading', 'lastRemoval', 'decision1M', 'manualEditor', 'country', 'finalConfirm', 'itsQuestion', 'vdoQuestion', 'idleWarning']

function shiftTachographDay(seg: { day: number; month: number; year: number }, deltaDays: number) {
  const shifted = new Date(Date.UTC(seg.year, seg.month - 1, seg.day + deltaDays))
  seg.day = shifted.getUTCDate()
  seg.month = shifted.getUTCMonth() + 1
  seg.year = shifted.getUTCFullYear()
}

// Zkopírované časy zobrazení obrazovek
const WELCOME_MS = 3000
const LOADING_MS = 3000
const LAST_REMOVAL_MS = 4000
const FINALIZE_STEP1_MS = 2000
const FINALIZE_STEP2_MS = 2000
const FINALIZE_STEP3_MS = 4000
const ITS_VDO_CONFIRM_SAVED_MS = 2000
const READY_TO_DRIVE_MS = 3000

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
  /** Offset tachografu. Editor ho přičítá k UTC a při uložení ho jednou odečte. */
  timeOffsetMs: number
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
    timeOffsetMs,
    getCurrentLocationCountryCode,
  } = params

  const [cardInsertionState, setCardInsertionState] = useState<CardInsertionState | null>(null)
  const cardInsertionStateRef = useRef<CardInsertionState | null>(null)
  /** Poslední stisk v průvodci – jen pro idle timeout (výstraha / vysunutí), ne pro debounce OK. */
  const lastCardInsertionKeyPressRef = useRef<number>(Date.now())
  const pleaseWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimeoutEjectionRef = useRef(false)
  const manualEntryAbortedBySpeedRef = useRef(false)
  const lastCardInsertionStateRef = useRef<CardInsertionState | null>(null)
  const countriesRef = useRef(countries)
  const spanishRegionsRef = useRef(spanishRegions)
  const simulatedUtcTimeRef = useRef(simulatedUtcTime)
  const timeOffsetMsRef = useRef(timeOffsetMs)
  const card1DataRef = useRef(card1Data)
  const card2DataRef = useRef(card2Data)
  const getCurrentLocationCountryCodeRef = useRef(getCurrentLocationCountryCode)
  getCurrentLocationCountryCodeRef.current = getCurrentLocationCountryCode

  cardInsertionStateRef.current = cardInsertionState
  countriesRef.current = countries
  spanishRegionsRef.current = spanishRegions
  simulatedUtcTimeRef.current = simulatedUtcTime
  timeOffsetMsRef.current = timeOffsetMs
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
          if (tid && s.consentConfirmed) {
            setDriverCardStateByTemplateId((prev) => ({
              ...prev,
              [tid]: { isFirstInsertion: false, itsConsent: s.itsYes, vdoConsent: s.vdoYes },
            }))
            if (s.slot === 1) setCard1Data((p) => (p ? { ...p, isFirstInsertion: false, itsConsent: s.itsYes, vdoConsent: s.vdoYes } : null))
            else setCard2Data((p) => (p ? { ...p, isFirstInsertion: false, itsConsent: s.itsYes, vdoConsent: s.vdoYes } : null))

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
            if (prev.cardExpired) return { ...prev, phase: 'invalidCard', phaseStartTime: Date.now(), loadingProgress: 1 }
            if (prev.supplementDeclined) return { ...prev, phase: 'readyToDrive', phaseStartTime: Date.now(), loadingProgress: 1, supplementDeclined: false }
            if (prev.firstInsertion && !prev.showFirstManualEntryBoundary) return { ...prev, phase: 'decision1M', phaseStartTime: Date.now(), loadingProgress: 1 }
            return { ...prev, phase: 'lastRemoval', phaseStartTime: Date.now(), loadingProgress: 1 }
          }
          return { ...prev, loadingProgress: progress }
        }
        if (prev.phase === 'lastRemoval') {
          if (elapsed >= LAST_REMOVAL_MS) {
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

  // Neplatná karta: při jízdě ihned odmítnout (bez manuálního zadání)
  useEffect(() => {
    if (!cardInsertionState || currentSpeed <= 0) return
    if (cardInsertionState.phase !== 'invalidCard') return
    idleTimeoutEjectionRef.current = true
    onEjectRequested?.(cardInsertionState.slot, { idleTimeout: true })
    setCardInsertionState(null)
  }, [cardInsertionState, currentSpeed, onEjectRequested])

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
      const capMinute = prev.insertionTimeFixed ?? floorToMinute(prev.cardInsertionTime)
      const committed = advanceConfirmedCapToMinute(prev.manualEntryBuffer, capMinute, simulatedUtcTimeRef.current)
      if (prev.slot === 1 && committed.length) {
        setDriver1ManualEntryBuffer(committed)
      }
      if (prev.slot === 2 && committed.length) {
        setDriver2ManualEntryBuffer(committed)
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
      } else if (elapsed >= IDLE_WARNING_MS && cs.phase !== 'idleWarning' && cs.phase !== 'invalidCard') {
        setCardInsertionState((p) => (p?.phase === cs.phase ? { ...p!, phase: 'idleWarning', phaseStartTime: Date.now(), idleWarningReturnPhase: p.phase } : p))
      }
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [cardInsertionState?.phase, cardInsertionState?.slot, onEjectRequested])

  const handleCardInsertionKey = useCallback((action: 'ok' | 'up' | 'down' | 'back') => {
    // Obnov idle časovač při každé aktivitě (OK/šipky/zpět). Neblokuj rychlé samostatné stisky OK.
    lastCardInsertionKeyPressRef.current = Date.now()
    setCardInsertionState((prev) => {
      if (!prev) return null
      if (prev.phase === 'idleWarning') {
        if (action === 'ok' && prev.idleWarningReturnPhase) {
          return { ...prev, phase: prev.idleWarningReturnPhase, phaseStartTime: Date.now(), idleWarningReturnPhase: undefined }
        }
        return prev
      }
      if (prev.phase === 'invalidCard') {
        if (action === 'ok') {
          idleTimeoutEjectionRef.current = true
          onEjectRequested?.(prev.slot, { idleTimeout: true })
          return null
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
            // Návod str. 56: Ne = žádné činnosti, pokračuje se krokem i (bez editoru a bez výchozí země).
            return { ...prev, phase: prev.showItsVdoQuestions ? 'itsQuestion' : 'finalizeStep1', phaseStartTime: Date.now() }
          }
          const offset = timeOffsetMsRef.current
          const insertionTimeFixed = floorToMinute(prev.cardInsertionTime)
          const l1Utc = floorToMinute(prev.lastWithdrawal ?? prev.firstManualEntryStartUtc ??
            segmentToMsUtc({ ...prev.segmentStart, activityId: 'REST' }))
          // Činnost potřebuje aspoň minutu. Když už nastal okamžik vložení, následuje výchozí země.
          if (l1Utc + 60_000 > insertionTimeFixed) {
            return { ...prev, phase: 'country', phaseStartTime: Date.now(), insertionTimeFixed }
          }
          const l1FromLastWithdrawal = utcMsToTachographSegment(l1Utc, offset)
          const segmentStartFixed = { day: l1FromLastWithdrawal.day, month: l1FromLastWithdrawal.month, year: l1FromLastWithdrawal.year, hour: l1FromLastWithdrawal.hour, minute: l1FromLastWithdrawal.minute }
          const l2Clamped = clampTachographSegment(
            { ...prev.currentSegment, ...utcMsToTachographSegment(insertionTimeFixed, offset) },
            l1Utc + 60000,
            insertionTimeFixed,
            offset,
          )
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
        const offset = timeOffsetMsRef.current
        const insertionTimeFixed = prev.insertionTimeFixed ?? floorToMinute(prev.cardInsertionTime)
        const minL2Utc = tachographSegmentToUtcMs(prev.segmentStart, offset) + 60000
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
            const stamp = tachographSegmentToUtcForBuffer(stampLocal, offset)
            const segmentStartLocal = utcMsToTachographSegment(segmentToMsUtc(stamp), offset)
            const l2Max = utcMsToTachographSegment(insertionTimeFixed, offset)
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
              shiftTachographDay(seg, -1)
            } else if (seg.hour === 23 && delta === 1) {
              seg.hour = 0
              shiftTachographDay(seg, 1)
            } else {
              seg.hour = (seg.hour + delta + 24) % 24
            }
          }
          if (field === 'minute') seg.minute = (seg.minute + delta + 60) % 60
          let adjusted = seg
          if (action === 'down' && minAllowedTime != null && tachographSegmentToUtcMs(adjusted, offset) < minAllowedTime) {
            const minSeg = utcMsToTachographSegment(minAllowedTime, offset)
            adjusted = { ...adjusted, day: minSeg.day, month: minSeg.month, year: minSeg.year, hour: minSeg.hour, minute: minSeg.minute }
          }
          const clamped = clampTachographSegment(adjusted, minL2Utc, insertionTimeFixed, offset)
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
            const segUtc = floorToMinute(tachographSegmentToUtcMs(segForTime, offset))
            // Razítko země v mezeře není výchozí země v okamžiku vložení — tu DTCO ptá vždy.
            const nextPhase = 'country' as CardInsertionPhase
            const store = (fields: typeof prev.segmentStart, activityId: typeof seg.activityId) =>
              tachographSegmentToUtcForBuffer({ ...fields, activityId }, offset)
            if (segUtc >= insertionTimeFixed) {
              const newBuffer = [
                ...prev.manualEntryBuffer,
                store(prev.segmentStart, seg.activityId),
                store(segForTime, seg.activityId),
              ]
              return { ...prev, manualEntryBuffer: newBuffer, phase: nextPhase, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const segValid = { ...segForTime, activityId: seg.activityId }
            const newBuffer = [...prev.manualEntryBuffer, store(prev.segmentStart, seg.activityId), store(segValid, seg.activityId)]
            const l1NextUtc = segUtc + 60000
            if (l1NextUtc > insertionTimeFixed) {
              return { ...prev, manualEntryBuffer: newBuffer, phase: nextPhase, phaseStartTime: Date.now(), awaitingMaxTimeConfirm: false, pendingMaxTimeSegment: undefined }
            }
            const l1FromL2PlusMinute = utcMsToTachographSegment(l1NextUtc, offset)
            const l2MaxTime = utcMsToTachographSegment(insertionTimeFixed, offset)
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
          const startUtc = tachographSegmentToUtcMs(prev.segmentStart, offset)
          const segUtc = tachographSegmentToUtcMs(seg, offset)
          const segValid = segUtc > startUtc ? seg : { ...utcMsToTachographSegment(startUtc + 60000, offset), activityId: seg.activityId }
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
          const newBuffer = [
            ...prev.manualEntryBuffer,
            tachographSegmentToUtcForBuffer({ ...prev.segmentStart, activityId: seg.activityId }, offset),
            tachographSegmentToUtcForBuffer({ ...segValid, activityId: seg.activityId }, offset),
          ]
          const nextPhase = 'country' as CardInsertionPhase
          const l2Utc = floorToMinute(tachographSegmentToUtcMs(segValid, offset))
          if (l2Utc >= insertionTimeFixed) {
            return { ...prev, manualEntryBuffer: newBuffer, phase: nextPhase, phaseStartTime: Date.now() }
          }
          const l1NextUtc = l2Utc + 60000
          if (l1NextUtc > insertionTimeFixed) {
            return { ...prev, manualEntryBuffer: newBuffer, phase: nextPhase, phaseStartTime: Date.now() }
          }
          const l1FromL2PlusMinute = utcMsToTachographSegment(l1NextUtc, offset)
          const l2MaxTime = utcMsToTachographSegment(insertionTimeFixed, offset)
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
          return { ...prev, phase: prev.showItsVdoQuestions ? 'itsQuestion' : 'itsVdoConfirmSaved', phaseStartTime: Date.now(), finalConfirmSkippedEditor: true, selectingSpanishRegion: false }
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
        if (action === 'ok') return { ...prev, phase: 'itsVdoConfirmSaved', consentConfirmed: true, phaseStartTime: Date.now() }
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
  }, [onEjectRequested])

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
