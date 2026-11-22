/**
 * Jízdní krok simulace (100 ms): cílová rychlost, kilometry, překročení rychlosti a čítače VDO.
 * Přesunuto z App.tsx. Rychlost se zapisuje do předaného currentSpeedRef ve stejném místě ticku.
 * useSimulationSecondClock tento ref čte a ukládá jeden vzorek za sekundu.
 */

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
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
  type EventLogEntry,
  type FaultOrEvent,
  type VirtualRoutePoint,
} from './TachoTypes'
import { getVirtualLocationForDistance } from './VirtualRoute'
import { SPLIT_REST_FIRST_MS, SPLIT_REST_SECOND_MS } from './VDOCounter'

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
  setDrivingSinceLastBreakMsByDriver: Dispatch<SetStateAction<Record<1 | 2, number>>>
  setRestSinceLastBreakMsByDriver: Dispatch<SetStateAction<Record<1 | 2, number>>>
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
    setDrivingSinceLastBreakMsByDriver,
    setRestSinceLastBreakMsByDriver,
  } = params

  // Simulace jízdy: posuvník = cílová rychlost, vozidlo plynule zrychluje/brzdí, km se přičítají dle skutečné rychlosti
  // Zároveň se sčítají doby trvání jednotlivých symbolů (řízení, odpočinek, jiná práce, pohotovost)
  // Důležité: i při vypnutém zapalování (vozidlo v klidu) se aktualizují aktivity (REST), aby L1 vpravo správně odečítal čas přestávky
  useEffect(() => {
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
        /** Při rychlosti pod prahem považuj za zastavené → setDrivingMode(false) → práce () pro řidiče 1 */
        setCurrentSpeed(curr <= SPEED_STOPPED_THRESHOLD_KMH ? 0 : curr)
        deltaKm = (avgSpeed * SIM_DT_MS) / 3600000
        odometerKmRef.current += deltaKm
        setOdometerKm((prev) => prev + deltaKm)
        const distanceFromStartKm = Math.max(0, odometerKmRef.current - ODOMETER_KM)
        virtualLocationRef.current = getVirtualLocationForDistance(distanceFromStartKm)
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
      const hasDriverCard = card1InsertedRef.current
      if (activeId !== null && (!isDriving || hasDriverCard)) {
        const endUtc = simulatedUtcTimeRef.current
        activeNoCardIdRef.current = null
        setFaultsAndEvents(prev => prev.map(record =>
          record.id === activeId ? { ...record, endUtc } : record
        ))
        setEventLog(prev => prev.map(record =>
          record.id === activeId ? { ...record, endTime: endUtc } : record
        ))
      } else if (activeId === null && isDriving && !hasDriverCard && !outModeActiveRef.current) {
        const id = crypto.randomUUID()
        const startUtc = simulatedUtcTimeRef.current
        activeNoCardIdRef.current = id
        setDrivingWithoutCardWarningActive(true)
        setFaultsAndEvents(prev => [...prev, {
          id, timestampUtc: startUtc, endUtc: null, kind: 'event', type: 'DRIVING_WITHOUT_CARD_WARNING',
        }])
        setEventLog(prev => [...prev, { id, type: 'DRIVING_WITHOUT_CARD', startTime: startUtc }])
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
}
