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
import {
  MANUAL_ACTIVITIES,
  type ActivityDurationsMs,
  type EventLogEntry,
  type FaultOrEvent,
  type FerryTrainEvent,
  type VirtualRoutePoint,
} from './TachoTypes'
import { getVirtualLocationForDistance } from './VirtualRoute'
import { SPLIT_REST_FIRST_MS, SPLIT_REST_SECOND_MS } from './VDOCounter'

type UseDrivingIntervalParams = {
  outModeActiveRef: MutableRefObject<boolean>
  drivingWithoutCardEventAddedRef: MutableRefObject<boolean>
  ignitionOnRef: MutableRefObject<boolean>
  targetSpeedRef: MutableRefObject<number>
  currentSpeedRef: MutableRefObject<number>
  odometerKmRef: MutableRefObject<number>
  virtualLocationRef: MutableRefObject<VirtualRoutePoint | null>
  excessSpeedAbove90MsRef: MutableRefObject<number>
  simulatedUtcTimeRef: MutableRefObject<number>
  ferryTrainModeActiveRef: MutableRefObject<boolean>
  ferryDrivingMsRef: MutableRefObject<number>
  setFerryTrainModeActiveRef: MutableRefObject<(value: boolean) => void>
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
  setExcessSpeedWarningActive: Dispatch<SetStateAction<boolean>>
  setFaultsAndEvents: Dispatch<SetStateAction<FaultOrEvent[]>>
  setFerryTrainEvents: Dispatch<SetStateAction<FerryTrainEvent[]>>
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
    drivingWithoutCardEventAddedRef,
    ignitionOnRef,
    targetSpeedRef,
    currentSpeedRef,
    odometerKmRef,
    virtualLocationRef,
    excessSpeedAbove90MsRef,
    simulatedUtcTimeRef,
    ferryTrainModeActiveRef,
    ferryDrivingMsRef,
    setFerryTrainModeActiveRef,
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
    setExcessSpeedWarningActive,
    setFaultsAndEvents,
    setFerryTrainEvents,
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
        drivingWithoutCardEventAddedRef.current = false
      }

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
      if (isDriving && noCardSlot1 && !outModeActiveRef.current && !drivingWithoutCardEventAddedRef.current) {
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
}
