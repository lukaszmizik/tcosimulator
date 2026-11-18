/**
 * Sekundový krok simulace: posun UTC času, vzorek rychlosti a uzávěrka minuty.
 * Přesunuto z App.tsx. useDrivingInterval zapisuje rychlost do předaného currentSpeedRef; tento krok z něj čte jeden vzorek za sekundu.
 */

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { insertedCardId } from './applyTimeJump'
import { DRIVING_SYMBOL, activityFromChar, getActivityCode } from './CardLogic'
import { CARD1_TEMPLATE_ID, saveCard1ActivityHistory } from './data/card1_write_data'
import { CARD2_TEMPLATE_ID, saveCard2ActivityHistory } from './data/card2_write_data'
import {
  type ActivityHistoryEntry,
  type ActivityKind,
  type CardData,
  type RecordedGpsLocation,
  type SecondActivitySnapshot,
  type VirtualRoutePoint,
} from './TachoTypes'

export type MinuteAccumulator = {
  minuteStartUtc: number
  secondsInMinute: number
  counts: {
    driver1: Record<ActivityKind, number>
    driver2: Record<ActivityKind, number>
  }
  lastActivity: {
    driver1: ActivityKind
    driver2: ActivityKind
  }
}

type UseSimulationSecondClockParams = {
  simulatedUtcTimeRef: MutableRefObject<number>
  setSimulatedUtcTime: Dispatch<SetStateAction<number>>
  currentSpeedRef: MutableRefObject<number>
  odometerKmRef: MutableRefObject<number>
  leftActivityIdRef: MutableRefObject<Parameters<typeof getActivityCode>[0]>
  rightActivityIdRef: MutableRefObject<Parameters<typeof getActivityCode>[0]>
  minuteAccumulatorRef: MutableRefObject<MinuteAccumulator | null>
  card1InsertedRef: MutableRefObject<boolean>
  card2InsertedRef: MutableRefObject<boolean>
  card1DataRef: MutableRefObject<CardData | null>
  card2DataRef: MutableRefObject<CardData | null>
  isMultiManningRef: MutableRefObject<boolean>
  virtualLocationRef: MutableRefObject<VirtualRoutePoint | null>
  ferryTrainModeActiveRef: MutableRefObject<boolean>
  setFerryTrainModeActiveRef: MutableRefObject<(value: boolean) => void>
  drivingMsSinceLastGpsRecordRef: MutableRefObject<number>
  drivingSinceLastGpsMsRef: MutableRefObject<number>
  setSecondHistory: Dispatch<SetStateAction<SecondActivitySnapshot[]>>
  setActivityHistory: Dispatch<SetStateAction<ActivityHistoryEntry[]>>
  setCardActivityHistoryByTemplateId: Dispatch<SetStateAction<Record<string, ActivityHistoryEntry[]>>>
  setRecordedGpsLocations: Dispatch<SetStateAction<RecordedGpsLocation[]>>
  /** Minuta jízdy karty načtené z DDD, identifikované číslem karty. */
  recordDddMinuteRef: MutableRefObject<(cardNumber: string, entry: ActivityHistoryEntry) => void>
}

export function useSimulationSecondClock(params: UseSimulationSecondClockParams) {
  const {
    simulatedUtcTimeRef,
    setSimulatedUtcTime,
    currentSpeedRef,
    odometerKmRef,
    leftActivityIdRef,
    rightActivityIdRef,
    minuteAccumulatorRef,
    card1InsertedRef,
    card2InsertedRef,
    card1DataRef,
    card2DataRef,
    isMultiManningRef,
    virtualLocationRef,
    ferryTrainModeActiveRef,
    setFerryTrainModeActiveRef,
    drivingMsSinceLastGpsRecordRef,
    drivingSinceLastGpsMsRef,
    setSecondHistory,
    setActivityHistory,
    setCardActivityHistoryByTemplateId,
    setRecordedGpsLocations,
    recordDddMinuteRef,
  } = params

  // Posun simulovaného času + záznam aktivit v jednom intervalu – nezávisle na React render cyklu.
  // Oprava: pokud visí okno readyToDrivePreDepartureCheck (nebo jiný modal), React může batchovat
  // aktualizace a effect závislý na simulatedUtcTime se nemusí včas spustit → ztráta sekund.
  useEffect(() => {
    const id = setInterval(() => {
      const next = simulatedUtcTimeRef.current + 1000
      setSimulatedUtcTime(next)

      // Sekundový tracker + logování po minutách (přesunuto z useEffect[simulatedUtcTime])
      const timestamp = next
      const speed = currentSpeedRef.current
      const odometerKm = odometerKmRef.current
      const isDriving = speed > 0
      const leftChar = isDriving ? DRIVING_SYMBOL : getActivityCode(leftActivityIdRef.current)
      const rightChar = isDriving ? getActivityCode('AVAILABILITY') : getActivityCode(rightActivityIdRef.current)
      const driver1Activity = activityFromChar(leftChar)
      const driver2Activity = activityFromChar(rightChar)

      const c1InsertedNow = card1InsertedRef.current
      const c2InsertedNow = card2InsertedRef.current
      const card1Id = insertedCardId(c1InsertedNow, card1DataRef.current?.cardNumber, card1DataRef.current?.templateId)
      const card2Id = insertedCardId(c2InsertedNow, card2DataRef.current?.cardNumber, card2DataRef.current?.templateId)
      setSecondHistory((prev) => {
        const nextArr = [...prev, {
          timestampUtc: timestamp,
          driver1: driver1Activity,
          driver2: driver2Activity,
          speed,
          odometerKm,
          driver1CardId: card1Id,
          driver2CardId: card2Id,
        }]
        if (nextArr.length > 86400) nextArr.shift()
        return nextArr
      })

      const minuteStartUtc = Math.floor(timestamp / 60000) * 60000
      let acc = minuteAccumulatorRef.current
      const ensureCounts = (): MinuteAccumulator['counts'] => ({
        driver1: { driving: 0, rest: 0, otherWork: 0, availability: 0, none: 0 },
        driver2: { driving: 0, rest: 0, otherWork: 0, availability: 0, none: 0 },
      })

      const finalizeMinute = (m: MinuteAccumulator) => {
        const pickWinner = (counts: Record<ActivityKind, number>, last: ActivityKind): ActivityKind => {
          let max = 0
          let candidates: ActivityKind[] = []
          ;(Object.keys(counts) as ActivityKind[]).forEach((k) => {
            const v = counts[k] ?? 0
            if (v > max) {
              max = v
              candidates = [k]
            } else if (v === max) {
              candidates.push(k)
            }
          })
          if (max === 0) return 'none'
          /* Pravidlo jedné minuty: aktivita se započte jen když v minutě trvá více než 31 s (≥ 32 s). */
          if (max <= 31) return 'none'
          if (candidates.length === 1) return candidates[0]
          return candidates.includes(last) ? last : candidates[0]
        }
        let driver1Winner = pickWinner(m.counts.driver1, m.lastActivity.driver1)
        let driver2Winner = pickWinner(m.counts.driver2, m.lastActivity.driver2)
        if (driver1Winner === 'none') driver1Winner = m.lastActivity.driver1 === 'none' ? 'rest' : m.lastActivity.driver1
        if (driver2Winner === 'none') driver2Winner = m.lastActivity.driver2

        const c1Inserted = card1InsertedRef.current
        const c2Inserted = card2InsertedRef.current
        const tid1 = card1DataRef.current?.templateId
        const tid2 = card2DataRef.current?.templateId
        const number1 = card1DataRef.current?.cardNumber
        const number2 = card2DataRef.current?.cardNumber
        const entry: ActivityHistoryEntry = {
          minuteStartUtc: m.minuteStartUtc,
          isCrew: isMultiManningRef.current,
          driver1: driver1Winner,
          driver2: driver2Winner,
          gpsLocation: virtualLocationRef.current?.name,
          driver1CardId: insertedCardId(c1Inserted, number1, tid1),
          driver2CardId: insertedCardId(c2Inserted, number2, tid2),
        }
        setActivityHistory((prev) => {
          const exists = prev.some((e) => e.minuteStartUtc === entry.minuteStartUtc)
          if (exists) return prev
          return [...prev, entry]
        })
        if (c1Inserted && tid1) {
          setCardActivityHistoryByTemplateId((p) => {
            const arr = p[tid1] ?? []
            if (arr.some((e) => e.minuteStartUtc === entry.minuteStartUtc)) return p
            const newArr = [...arr, entry]
            if (tid1 === CARD1_TEMPLATE_ID) saveCard1ActivityHistory(newArr)
            else if (tid1 === CARD2_TEMPLATE_ID) saveCard2ActivityHistory(newArr)
            return { ...p, [tid1]: newArr }
          })
        }
        if (c2Inserted && tid2) {
          setCardActivityHistoryByTemplateId((p) => {
            const arr = p[tid2] ?? []
            if (arr.some((e) => e.minuteStartUtc === entry.minuteStartUtc)) return p
            const newArr = [...arr, entry]
            if (tid2 === CARD1_TEMPLATE_ID) saveCard1ActivityHistory(newArr)
            else if (tid2 === CARD2_TEMPLATE_ID) saveCard2ActivityHistory(newArr)
            return { ...p, [tid2]: newArr }
          })
        }
        if (c1Inserted && number1) recordDddMinuteRef.current(number1, entry)
        if (c2Inserted && number2) recordDddMinuteRef.current(number2, entry)
        // Režim trajekt: konec při zápisu minuty s jízdou do paměti karty
        if (ferryTrainModeActiveRef.current && (driver1Winner === 'driving' || driver2Winner === 'driving')) {
          setFerryTrainModeActiveRef.current(false)
        }
        // Každé 3 hodiny řízení zaznamenat GPS pozici
        if (driver1Winner === 'driving' || driver2Winner === 'driving') {
          drivingMsSinceLastGpsRecordRef.current += 60000
          const GPS_RECORD_INTERVAL_MS = 3 * 60 * 60 * 1000
          if (drivingMsSinceLastGpsRecordRef.current >= GPS_RECORD_INTERVAL_MS) {
            const gpsName = virtualLocationRef.current?.name ?? '—'
            setRecordedGpsLocations((prev) => [...prev, { minuteStartUtc: m.minuteStartUtc, gpsLocation: gpsName ?? '—', recordType: 'gps_3h' }])
            drivingMsSinceLastGpsRecordRef.current = 0
          }
        }
      }

      if (!acc || acc.minuteStartUtc !== minuteStartUtc) {
        if (acc) finalizeMinute(acc)
        acc = {
          minuteStartUtc,
          secondsInMinute: 0,
          counts: ensureCounts(),
          lastActivity: { driver1: 'none', driver2: 'none' },
        }
        minuteAccumulatorRef.current = acc
      }

      acc.secondsInMinute += 1
      acc.counts.driver1[driver1Activity] = (acc.counts.driver1[driver1Activity] ?? 0) + 1
      acc.counts.driver2[driver2Activity] = (acc.counts.driver2[driver2Activity] ?? 0) + 1
      acc.lastActivity.driver1 = driver1Activity
      acc.lastActivity.driver2 = driver2Activity

      if (driver1Activity === 'driving' || driver2Activity === 'driving') {
        drivingSinceLastGpsMsRef.current += 1000
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])
}
