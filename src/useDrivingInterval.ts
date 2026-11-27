/**
 * Jízdní krok simulace (100 ms): cílová rychlost, kilometry, překročení rychlosti a čítače VDO.
 * Přesunuto z App.tsx. Rychlost se zapisuje do předaného currentSpeedRef ve stejném místě ticku.
 * useSimulationSecondClock tento ref čte a ukládá jeden vzorek za sekundu.
 */

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { activitiesForApplyTime, loadedCardPresent } from './applyTimeJump'
import { DRIVING_SYMBOL, getActivityCode } from './CardLogic'
import {
  ACCEL_KMH_PER_SEC,
  DRIVING_LIMIT_415_MS,
  DRIVING_LIMIT_430_MS,
  ODOMETER_KM,
  REST_RESET_MS,
  SIM_DT_MS,
  SPEED_STOPPED_THRESHOLD_KMH,
} from './Constants'
import { accumulateFerryDriving } from './ferryTrainMode'
import {
  MANUAL_ACTIVITIES,
  type ActivityDurationsMs,
  type ActivityKind,
  type CardData,
  type EventLogEntry,
  type FaultOrEvent,
  type VirtualRoutePoint,
} from './TachoTypes'
import { getVirtualLocationForDistance } from './VirtualRoute'
import { SPLIT_REST_FIRST_MS, SPLIT_REST_SECOND_MS } from './VDOCounter'
import { drivingWithoutDriverCard } from './slotCardRules'

export function activityDurationDelta(char: string, dtMs: number): ActivityDurationsMs {
  if (char === DRIVING_SYMBOL) return { driving: dtMs, rest: 0, otherWork: 0, availability: 0 }
  const act = MANUAL_ACTIVITIES.find((item) => item.code === char)
  if (act?.id === 'REST') return { driving: 0, rest: dtMs, otherWork: 0, availability: 0 }
  if (act?.id === 'WORK') return { driving: 0, rest: 0, otherWork: dtMs, availability: 0 }
  if (act?.id === 'AVAILABILITY') return { driving: 0, rest: 0, otherWork: 0, availability: dtMs }
  return { driving: 0, rest: 0, otherWork: 0, availability: 0 }
}

/** Zobrazení doby činnosti je po minutách. Stejná minuta nepotřebuje nové vykreslení. */
export function activityDurationMinuteKey(durations: ActivityDurationsMs): string {
  return [
    Math.floor(durations.driving / 60000),
    Math.floor(durations.rest / 60000),
    Math.floor(durations.otherWork / 60000),
    Math.floor(durations.availability / 60000),
  ].join(':')
}

export function sameDisplayedOdometerKm(previous: number, next: number): boolean {
  return Math.round(previous * 10) === Math.round(next * 10)
}

/** STOP dál ukazuje skutečnou rychlost do zastavení. Stání se zapnutým zapalováním pod prahem je 0. */
export function publishedSpeed(ignition: boolean, speed: number): number {
  if (!ignition) return speed
  return speed <= SPEED_STOPPED_THRESHOLD_KMH ? 0 : speed
}

type UseDrivingIntervalParams = {
  outModeActiveRef: MutableRefObject<boolean>
  activeNoCardIdRef: MutableRefObject<string | null>
  ignitionOnRef: MutableRefObject<boolean>
  targetSpeedRef: MutableRefObject<number>
  currentSpeedRef: MutableRefObject<number>
  odometerKmRef: MutableRefObject<number>
  /** Zapíše už spočítaný přírůstek kilometrů do denní evidence. Počitadlo nemění. */
  noteDayKmRef: MutableRefObject<(atUtc: number, deltaKm: number) => void>
  virtualLocationRef: MutableRefObject<VirtualRoutePoint | null>
  trackOverspeed: (speed: number, atUtc: number, elapsedMs: number) => void
  simulatedUtcTimeRef: MutableRefObject<number>
  ferryTrainModeActiveRef: MutableRefObject<boolean>
  ferryDrivingMsRef: MutableRefObject<number>
  /** Jediné automatické ukončení: souvislá jízda delší než minutu. */
  endFerryTrainRef: MutableRefObject<() => void>
  card1InsertedRef: MutableRefObject<boolean>
  card2InsertedRef: MutableRefObject<boolean>
  card2DataRef: MutableRefObject<CardData | null>
  leftActivityIdRef: MutableRefObject<Parameters<typeof getActivityCode>[0]>
  rightActivityIdRef: MutableRefObject<Parameters<typeof getActivityCode>[0]>
  drivingSinceLastBreakMsByDriverRef: MutableRefObject<Record<1 | 2, number>>
  restSinceLastBreakMsByDriverRef: MutableRefObject<Record<1 | 2, number>>
  splitFirstPartTakenByDriverRef: MutableRefObject<Record<1 | 2, boolean>>
  breakWarning415DismissedRef: MutableRefObject<boolean>
  breakWarning430DismissedRef: MutableRefObject<boolean>
  prevLeftCharRef: MutableRefObject<string | null>
  prevRightCharRef: MutableRefObject<string | null>
  setDrivingWithoutCardWarningActive: Dispatch<SetStateAction<boolean>>
  setCurrentSpeed: Dispatch<SetStateAction<number>>
  setOdometerKm: Dispatch<SetStateAction<number>>
  setFaultsAndEvents: Dispatch<SetStateAction<FaultOrEvent[]>>
  setEventLog: Dispatch<SetStateAction<EventLogEntry[]>>
  setSplitFirstPartTakenByDriver: Dispatch<SetStateAction<Record<1 | 2, boolean>>>
  setBreakWarningActive: Dispatch<SetStateAction<'415' | '430' | null>>
  setActivityDurationsMs: Dispatch<SetStateAction<ActivityDurationsMs>>
  activityDurationsMsRef: MutableRefObject<ActivityDurationsMs>
}

export function useDrivingInterval(params: UseDrivingIntervalParams) {
  const {
    outModeActiveRef,
    activeNoCardIdRef,
    ignitionOnRef,
    targetSpeedRef,
    currentSpeedRef,
    odometerKmRef,
    noteDayKmRef,
    virtualLocationRef,
    trackOverspeed,
    simulatedUtcTimeRef,
    ferryTrainModeActiveRef,
    ferryDrivingMsRef,
    endFerryTrainRef,
    card1InsertedRef,
    card2InsertedRef,
    card2DataRef,
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
    setEventLog,
    setSplitFirstPartTakenByDriver,
    setBreakWarningActive,
    setActivityDurationsMs,
    activityDurationsMsRef,
  } = params

  // Simulace jízdy: posuvník = cílová rychlost, vozidlo plynule zrychluje/brzdí, km se přičítají dle skutečné rychlosti
  // Zároveň se sčítají doby trvání jednotlivých symbolů (řízení, odpočinek, jiná práce, pohotovost)
  // Důležité: i při vypnutém zapalování (vozidlo v klidu) se aktualizují aktivity (REST), aby L1 vpravo správně odečítal čas přestávky
  useEffect(() => {
    let lastPublishedSpeed = publishedSpeed(ignitionOnRef.current, currentSpeedRef.current)
    let lastPublishedOdometerKm = odometerKmRef.current
    let lastDurationKey = activityDurationMinuteKey(activityDurationsMsRef.current)
    const id = setInterval(() => {
      /** V režimu OUT se výstraha „jízda bez karty“ nesmí zobrazovat – každý tick ji zrušíme. */
      if (outModeActiveRef.current) {
        setDrivingWithoutCardWarningActive(false)
      }

      const ignition = ignitionOnRef.current
      const target = targetSpeedRef.current
      let curr = currentSpeedRef.current
      let deltaKm = 0
      if (!ignition) {
        curr = Math.max(0, curr - (ACCEL_KMH_PER_SEC * SIM_DT_MS) / 1000)
        currentSpeedRef.current = curr
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
        /** Při rychlosti pod prahem považuj za zastavené → setDrivingMode(false) → práce () pro řidiče 1 */
        deltaKm = (avgSpeed * SIM_DT_MS) / 3600000
        if (deltaKm !== 0) {
          odometerKmRef.current += deltaKm
          if (!sameDisplayedOdometerKm(lastPublishedOdometerKm, odometerKmRef.current)) {
            lastPublishedOdometerKm = odometerKmRef.current
            setOdometerKm(lastPublishedOdometerKm)
          }
        }
        const distanceFromStartKm = Math.max(0, odometerKmRef.current - ODOMETER_KM)
        virtualLocationRef.current = getVirtualLocationForDistance(distanceFromStartKm)
      }
      const shownSpeed = publishedSpeed(ignition, curr)
      if (shownSpeed !== lastPublishedSpeed) {
        lastPublishedSpeed = shownSpeed
        setCurrentSpeed(shownSpeed)
      }
      noteDayKmRef.current(simulatedUtcTimeRef.current, deltaKm)

      /** Rychlost pod prahem = v klidu → manuální aktivita (po zastavení práce; přestávku volí řidič) */
      const isDriving = curr > SPEED_STOPPED_THRESHOLD_KMH
      trackOverspeed(ignition ? curr : 0, simulatedUtcTimeRef.current, SIM_DT_MS)
      if (ferryTrainModeActiveRef.current) {
        const step = accumulateFerryDriving(ferryDrivingMsRef.current, isDriving, SIM_DT_MS)
        ferryDrivingMsRef.current = step.drivingMs
        if (step.ended) endFerryTrainRef.current()
      }
      const activeId = activeNoCardIdRef.current
      const missingDriverCard = drivingWithoutDriverCard(card1InsertedRef.current)
      if (activeId !== null && (!isDriving || !missingDriverCard)) {
        const endUtc = simulatedUtcTimeRef.current
        activeNoCardIdRef.current = null
        setFaultsAndEvents(prev => prev.map(record =>
          record.id === activeId ? { ...record, endUtc } : record
        ))
        setEventLog(prev => prev.map(record =>
          record.id === activeId ? { ...record, endTime: endUtc } : record
        ))
      } else if (activeId === null && isDriving && missingDriverCard && !outModeActiveRef.current) {
        const id = crypto.randomUUID()
        const startUtc = simulatedUtcTimeRef.current
        activeNoCardIdRef.current = id
        setDrivingWithoutCardWarningActive(true)
        setFaultsAndEvents(prev => [...prev, {
          id, timestampUtc: startUtc, endUtc: null, kind: 'event', type: 'DRIVING_WITHOUT_CARD_WARNING',
        }])
        setEventLog(prev => [...prev, { id, type: 'DRIVING_WITHOUT_CARD', startTime: startUtc }])
      }

      const slotActivities = activitiesForApplyTime(
        curr,
        leftActivityIdRef.current,
        rightActivityIdRef.current,
        loadedCardPresent(card2InsertedRef.current, card2DataRef.current),
      )
      const activityChar = (kind: ActivityKind): string => {
        if (kind === 'driving') return DRIVING_SYMBOL
        if (kind === 'rest') return getActivityCode('REST')
        if (kind === 'otherWork') return getActivityCode('WORK')
        if (kind === 'availability') return getActivityCode('AVAILABILITY')
        return ''
      }
      const leftChar = activityChar(slotActivities.driver1)
      const rightChar = activityChar(slotActivities.driver2)
      const leftDelta = activityDurationDelta(leftChar, SIM_DT_MS)
      const rightDelta = activityDurationDelta(rightChar, SIM_DT_MS)

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

      const previousDurations = activityDurationsMsRef.current
      const nextDurations = {
        driving: previousDurations.driving + leftDelta.driving + rightDelta.driving,
        rest: previousDurations.rest + leftDelta.rest + rightDelta.rest,
        otherWork: previousDurations.otherWork + leftDelta.otherWork + rightDelta.otherWork,
        availability: previousDurations.availability + leftDelta.availability + rightDelta.availability,
      }
      activityDurationsMsRef.current = nextDurations
      const durationKey = activityDurationMinuteKey(nextDurations)
      if (durationKey !== lastDurationKey) {
        lastDurationKey = durationKey
        setActivityDurationsMs(nextDurations)
      }
    }, SIM_DT_MS)
    return () => clearInterval(id)
  }, [])
}
