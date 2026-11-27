/**
 * Příprava scénáře 4 h 10 min. Funkce jen počítá, do stavu simulátoru nezapisuje.
 * Pořadí volání Math.random odpovídá původnímu handleru.
 */

import { activitiesForApplyTime, dominantMinuteActivity, insertedCardId } from './applyTimeJump'
import { getVirtualLocationForDistance } from './VirtualRoute'
import {
  NO_CARD,
  type ActivityHistoryEntry,
  type ActivityKind,
  type RecordedGpsLocation,
  type SecondActivitySnapshot,
} from './TachoTypes'

export type BuildSimulated4h10mInput = {
  startMs: number
  /** Posouzení osádky. Činnost S2 se z něj neodvozuje. */
  isMultiManning: boolean
  card1Inserted: boolean
  card2Inserted: boolean
  card1TemplateId: string | undefined
  card2TemplateId: string | undefined
  card1CardNumber?: string
  card2CardNumber?: string
  distanceFromStartKm: number
}

export type BuildSimulated4h10mResult = {
  secondEntries: SecondActivitySnapshot[]
  activityEntries: ActivityHistoryEntry[]
  gpsRecords: RecordedGpsLocation[]
  totalDrivingDistance: number
  drivingMs: number
  otherWorkMs: number
}

export function buildSimulated4h10m(input: BuildSimulated4h10mInput): BuildSimulated4h10mResult {
  const {
    startMs,
    card1Inserted,
    card2Inserted,
    card1TemplateId,
    card2TemplateId,
    card1CardNumber,
    card2CardNumber,
    distanceFromStartKm,
  } = input
  const startMinute = Math.floor(startMs / 60000) * 60000
  const card1Id = insertedCardId(card1Inserted, card1CardNumber, card1TemplateId)
  const card2Id = insertedCardId(card2Inserted, card2CardNumber, card2TemplateId)
  const slot2Present = card2Id !== NO_CARD
  const totalSeconds = 250 * 60

  const rand = (min: number, max: number) => min + Math.random() * (max - min)
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))

  /** Setrvačnost kamionu: max 2 km/h za sekundu. Žádné okamžité skoky. */
  const MAX_ACCEL_KMH_PER_SEC = 2

  const stepSpeed = (current: number, target: number): number => {
    const diff = target - current
    if (Math.abs(diff) < 0.1) return target
    const delta = diff > 0 ? Math.min(MAX_ACCEL_KMH_PER_SEC, diff) : -Math.min(MAX_ACCEL_KMH_PER_SEC, -diff)
    return Math.max(0, Math.min(125, current + delta))
  }

  type Mode = 'city' | 'highway' | 'jam' | 'restArea' | 'village'
  const modes: Mode[] = ['city', 'highway', 'jam', 'restArea', 'village']

  /** Pravděpodobnostní přechod mezi režimy. */
  const nextMode = (current: Mode): Mode => {
    const r = Math.random()
    if (current === 'highway') {
      if (r < 0.10) return 'highway'
      if (r < 0.30) return 'jam'
      if (r < 0.55) return 'village'
      if (r < 0.70) return 'restArea'
      return 'city'
    }
    if (current === 'city') {
      if (r < 0.25) return 'highway'
      if (r < 0.50) return 'jam'
      if (r < 0.75) return 'village'
      return 'city'
    }
    if (current === 'jam') {
      if (r < 0.35) return 'highway'
      if (r < 0.60) return 'city'
      if (r < 0.85) return 'village'
      return 'jam'
    }
    if (current === 'restArea') return Math.random() < 0.8 ? 'highway' : 'city'
    if (current === 'village') {
      if (r < 0.40) return 'highway'
      if (r < 0.70) return 'city'
      return 'village'
    }
    return modes[randInt(0, modes.length - 1)]
  }

  /** Trvání úseků: Dálnice 15–30 min, Město 5–10 min. Odstranění kmitání. */
  const getSegmentLengthMin = (mode: Mode): number => {
    if (mode === 'highway') return randInt(15, 30)
    if (mode === 'city') return randInt(5, 10)
    if (mode === 'village') return randInt(5, 12)
    if (mode === 'jam') return randInt(5, 15)
    return randInt(2, 5)
  }

  const segments: { mode: Mode; startSec: number; endSec: number }[] = []
  let sec = 0
  let currentMode: Mode = modes[randInt(0, modes.length - 1)]
  while (sec < totalSeconds) {
    const lenMin = getSegmentLengthMin(currentMode)
    const lenSec = lenMin * 60
    const endSec = Math.min(sec + lenSec, totalSeconds)
    segments.push({ mode: currentMode, startSec: sec, endSec })
    sec = endSec
    if (sec < totalSeconds) currentMode = nextMode(currentMode)
  }

  /** Zastávky na semaforu: max 1–2 za hodinu, 30–60 s. */
  const trafficLightStops: { startSec: number; endSec: number }[] = []
  const stopsPerHour = randInt(1, 2)
  const intervalSec = 3600 / stopsPerHour
  let nextStopSec = randInt(intervalSec * 0.3, intervalSec * 0.7)
  while (nextStopSec < totalSeconds) {
    const stopLen = randInt(30, 60)
    trafficLightStops.push({ startSec: nextStopSec, endSec: nextStopSec + stopLen })
    nextStopSec += randInt(Math.floor(intervalSec * 0.8), Math.floor(intervalSec * 1.2))
  }

  const inTrafficLightStop = (second: number): boolean =>
    trafficLightStops.some((s) => second >= s.startSec && second < s.endSec)

  const getSegmentAt = (second: number) => segments.find((s) => second >= s.startSec && second < s.endSec)

  /** Base rychlost – bez vnitřních zastávek v městě/dálnici. Jedině jam a restArea mají 0. */
  const getBaseTarget = (second: number, mode: Mode, segStart: number): { target: number; activity: ActivityKind } => {
    if (mode === 'city') return { target: 40 + (segStart % 11), activity: 'driving' }
    if (mode === 'highway') return { target: 82 + (segStart % 9), activity: 'driving' }
    if (mode === 'jam') {
      const cycle = Math.floor((second - segStart) / 25) % 4
      if (cycle === 0) return { target: 0, activity: 'otherWork' }
      return { target: 5 + (segStart % 10), activity: 'driving' }
    }
    if (mode === 'restArea') return { target: 0, activity: 'otherWork' }
    return { target: 48 + (segStart % 5), activity: 'driving' }
  }

  /** Plynulé mikrozměny: dálnice ±2 km/h kolem průměru (85, 87, 86, 84…). */
  let flutterUntilSec = randInt(8, 15)
  let currentFlutter = rand(-2, 2)

  const secondEntries: SecondActivitySnapshot[] = []
  let simSpeed = 0
  let totalDrivingDistance = 0

  for (let second = 0; second < totalSeconds; second++) {
    const timestampUtc = startMs + second * 1000

    let targetSpeed: number
    let targetActivity: ActivityKind

    if (inTrafficLightStop(second)) {
      targetSpeed = 0
      targetActivity = 'otherWork'
    } else {
      const seg = getSegmentAt(second)
      const mode = seg?.mode ?? 'highway'
      const segStart = seg?.startSec ?? 0
      const base = getBaseTarget(second, mode, segStart)

      if (second >= flutterUntilSec) {
        currentFlutter = mode === 'highway' ? rand(-2, 2) : rand(-2, 2)
        flutterUntilSec = second + randInt(8, 18)
      }
      const clampedTarget = Math.max(0, Math.min(125, base.target + currentFlutter))
      targetSpeed = clampedTarget
      targetActivity = base.activity
    }

    simSpeed = stepSpeed(simSpeed, targetActivity === 'otherWork' ? 0 : targetSpeed)
    const driver2Activity = activitiesForApplyTime(simSpeed, 'WORK', 'AVAILABILITY', slot2Present).driver2
    if (targetActivity === 'otherWork') {
      secondEntries.push({ timestampUtc, driver1: 'otherWork', driver2: driver2Activity, speed: simSpeed, driver1CardId: card1Id, driver2CardId: card2Id })
    } else {
      secondEntries.push({ timestampUtc, driver1: 'driving', driver2: driver2Activity, speed: simSpeed, driver1CardId: card1Id, driver2CardId: card2Id })
      totalDrivingDistance += (simSpeed / 3600) * 1
    }
  }

  const emptyDriver2 = (): Record<ActivityKind, number> => ({ driving: 0, rest: 0, otherWork: 0, availability: 0, none: 0 })
  const countByMinute = new Map<number, { driving: number; otherWork: number; driver2: Record<ActivityKind, number>; lastDriver2: ActivityKind }>()
  const distanceByMinute = new Map<number, number>()
  for (const e of secondEntries) {
    const minIdx = Math.floor((e.timestampUtc - startMs) / 60000)
    const c = countByMinute.get(minIdx) ?? { driving: 0, otherWork: 0, driver2: emptyDriver2(), lastDriver2: 'none' as ActivityKind }
    if (e.driver1 === 'driving') c.driving++
    else c.otherWork++
    c.driver2[e.driver2] = (c.driver2[e.driver2] ?? 0) + 1
    c.lastDriver2 = e.driver2
    countByMinute.set(minIdx, c)
    const dist = (e.speed / 3600) * 1
    distanceByMinute.set(minIdx, (distanceByMinute.get(minIdx) ?? 0) + dist)
  }

  const activityEntries: ActivityHistoryEntry[] = []
  let drivingMs = 0
  let otherWorkMs = 0
  let drivingMinutesSinceLastGps = 0
  const gpsRecords: RecordedGpsLocation[] = []
  let cumulativeKm = distanceFromStartKm
  for (let m = 0; m < 250; m++) {
    const minuteStartUtc = startMinute + m * 60000
    const c = countByMinute.get(m) ?? { driving: 0, otherWork: 0, driver2: emptyDriver2(), lastDriver2: 'none' as ActivityKind }
    /* Pravidlo jedné minuty: řízení se započte jen když v minutě odřídím více než 31 s (≥ 32 s). */
    const driver1: ActivityKind = c.driving > 31 ? 'driving' : 'otherWork'
    const driver2 = dominantMinuteActivity(c.driver2, c.lastDriver2).activity
    const distThisMin = distanceByMinute.get(m) ?? 0
    cumulativeKm += distThisMin
    const gpsLocation = getVirtualLocationForDistance(cumulativeKm).name
    activityEntries.push({
      minuteStartUtc,
      driver1,
      driver2,
      gpsLocation,
      driver1CardId: card1Id,
      driver2CardId: card2Id,
    })
    if (driver1 === 'driving') {
      drivingMs += 60000
      drivingMinutesSinceLastGps += 1
      if (drivingMinutesSinceLastGps >= 180) {
        gpsRecords.push({ minuteStartUtc, gpsLocation, recordType: 'gps_3h' as const })
        drivingMinutesSinceLastGps = 0
      }
    } else {
      otherWorkMs += 60000
    }
  }

  return { secondEntries, activityEntries, gpsRecords, totalDrivingDistance, drivingMs, otherWorkMs }
}
