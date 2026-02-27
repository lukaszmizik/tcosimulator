/**
 * Generátor náhodného pracovního týdne pro testování simulátoru.
 * Generuje 5–6 směn s řízením, prací a přestávkami dle předpisů EU.
 */

import type { ActivityHistoryEntry, ManualEntrySegment, SecondActivitySnapshot } from './TachoTypes'
import {
  REST_RESET_MS,
  SPLIT_REST_FIRST_MS,
  SPLIT_REST_SECOND_MS,
  DRIVING_LIMIT_430_MS,
  DAILY_DRIVING_LIMIT_MS,
  WEEKLY_REST_MIN_MS,
} from './VDOCounter'
import { NO_CARD } from './TachoTypes'

const MINUTE_MS = 60 * 1000

export type GenerateResult = {
  activityHistory: ActivityHistoryEntry[]
  manualEntryBuffer: ManualEntrySegment[]
  /** Sekundové záznamy rychlosti pro paměť vozidla (V-diagram) */
  secondHistory: SecondActivitySnapshot[]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function floorToMinute(ms: number): number {
  return Math.floor(ms / MINUTE_MS) * MINUTE_MS
}

function msToSegment(ms: number): Omit<ManualEntrySegment, 'activityId' | 'countryCode'> {
  const d = new Date(ms)
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

const DAY_MS = 24 * 3600 * 1000

/**
 * Vygeneruje 5–6 pracovních směn.
 *
 * - Každá směna začíná a končí značkou země (START_COUNTRY / END_COUNTRY)
 * - Ve směně pouze pracovní aktivity: řízení, krátké bezpečnostní přestávky (45m nebo 15+30),
 *   občas 3–4h přestávka
 * - Mezi směnami denní odpočinek (9h nebo 11h) na samostatném řádku
 * - Za poslední směnou týdenní odpočinek (24h+)
 *
 * S nowUtc: data se generují týden do minulosti, na konci je týdenní odpočinek,
 * po něm volný prostor alespoň 2 dnů až do nowUtc.
 */
export function generateRandomWorkWeek(
  slotIndex: 1 | 2,
  startTimeUtc: number,
  templateId: string,
  nowUtc?: number
): GenerateResult {
  const history: ActivityHistoryEntry[] = []
  const manualBuffer: ManualEntrySegment[] = []
  const numShifts = randomInt(5, 6)

  const useAnchoredTimeline = nowUtc != null
  const dataEndMs = useAnchoredTimeline ? floorToMinute(nowUtc - 2 * DAY_MS) : 0
  const dataStartMs = useAnchoredTimeline ? dataEndMs - 7 * DAY_MS : floorToMinute(startTimeUtc)

  let currentMs = dataStartMs

  const addEntry = (
    minuteStartUtc: number,
    driver1: ActivityHistoryEntry['driver1'],
    driver2: ActivityHistoryEntry['driver2']
  ) => {
    history.push({
      minuteStartUtc,
      driver1,
      driver2,
      driver1CardId: slotIndex === 1 ? templateId : NO_CARD,
      driver2CardId: slotIndex === 2 ? templateId : NO_CARD,
    })
  }

  const fillActivity = (
    startMs: number,
    durationMs: number,
    kind: 'driving' | 'rest' | 'otherWork' | 'availability'
  ): number => {
    const minutes = Math.max(0, Math.floor(durationMs / MINUTE_MS))
    const slotVal = kind
    const other: ActivityHistoryEntry['driver2'] = 'none'
    for (let m = 0; m < minutes; m++) {
      const minuteStartUtc = floorToMinute(startMs + m * MINUTE_MS)
      if (slotIndex === 1) addEntry(minuteStartUtc, slotVal, other)
      else addEntry(minuteStartUtc, other, slotVal)
    }
    return startMs + minutes * MINUTE_MS
  }

  const LONG_BREAK_3H_MS = 3 * 3600 * 1000
  const LONG_BREAK_4H_MS = 4 * 3600 * 1000

  for (let s = 0; s < numShifts; s++) {
    const shiftStartMs = currentMs
    manualBuffer.push({ ...msToSegment(shiftStartMs), activityId: 'START_COUNTRY', countryCode: 'CZ' })
    currentMs = fillActivity(currentMs, MINUTE_MS, 'rest')

    const startWorkMs = randomInt(5, 15) * MINUTE_MS
    currentMs = fillActivity(currentMs, startWorkMs, 'otherWork')

    let drivingInShiftMs = 0
    const maxDrivingThisShift = Math.min(DAILY_DRIVING_LIMIT_MS, randomInt(4, 9) * 3600 * 1000)
    let lastBreakWasSplit = false
    let firstBlock = true
    let addedLongBreak = false

    while (drivingInShiftMs < maxDrivingThisShift) {
      if (!firstBlock) {
        const useLongBreak = !addedLongBreak && randomInt(0, 2) === 0
        if (useLongBreak) {
          const longBreakMs = randomInt(0, 1) === 0 ? LONG_BREAK_3H_MS : LONG_BREAK_4H_MS
          currentMs = fillActivity(currentMs, longBreakMs, 'rest')
          addedLongBreak = true
        } else {
          const useSplit: boolean = !lastBreakWasSplit && randomInt(0, 1) === 1
          const breakMs = useSplit ? SPLIT_REST_FIRST_MS + SPLIT_REST_SECOND_MS : REST_RESET_MS
          lastBreakWasSplit = useSplit
          currentMs = fillActivity(currentMs, breakMs, 'rest')
        }
      }

      if (randomInt(0, 1) === 1 && (firstBlock || randomInt(0, 1) === 1)) {
        const workMs = randomInt(15, 50) * MINUTE_MS
        currentMs = fillActivity(currentMs, workMs, 'otherWork')
      }
      if (randomInt(0, 1) === 1 && !firstBlock) {
        const availMs = randomInt(10, 40) * MINUTE_MS
        currentMs = fillActivity(currentMs, availMs, 'availability')
      }

      const remaining = maxDrivingThisShift - drivingInShiftMs
      const maxBlockMs = Math.min(DRIVING_LIMIT_430_MS, remaining)
      const blockMs = randomInt(60, Math.max(60, Math.floor(maxBlockMs / MINUTE_MS))) * MINUTE_MS
      currentMs = fillActivity(currentMs, blockMs, 'driving')
      drivingInShiftMs += blockMs
      firstBlock = false
    }

    if (randomInt(0, 1) === 1) {
      const workMs = randomInt(10, 35) * MINUTE_MS
      currentMs = fillActivity(currentMs, workMs, 'otherWork')
    }

    manualBuffer.push({ ...msToSegment(currentMs), activityId: 'END_COUNTRY', countryCode: 'CZ' })
    currentMs = fillActivity(currentMs, MINUTE_MS, 'rest')

    if (s < numShifts - 1) {
      const useShortDaily = randomInt(0, 1) === 0
      const dailyRestMs = useShortDaily
        ? (9 * 60 + randomInt(0, 59)) * 60 * 1000
        : (11 * 60 + randomInt(0, 59)) * 60 * 1000
      currentMs = fillActivity(currentMs, dailyRestMs, 'rest')
    } else {
      const weeklyRestMs = WEEKLY_REST_MIN_MS + 60000 + randomInt(0, 23) * 3600 * 1000 + randomInt(0, 59) * 60 * 1000
      currentMs = fillActivity(currentMs, weeklyRestMs, 'rest')
    }
  }

  /** Vyplnit případné mezery v historii (pojistka kontinuity) */
  history.sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
  let filledHistory: ActivityHistoryEntry[] = []
  for (let i = 0; i < history.length; i++) {
    filledHistory.push(history[i]!)
    if (i + 1 >= history.length) continue
    const currMs = history[i]!.minuteStartUtc
    const nextMs = history[i + 1]!.minuteStartUtc
    let gapMs = currMs + MINUTE_MS
    while (gapMs < nextMs) {
      filledHistory.push({
        minuteStartUtc: gapMs,
        driver1: slotIndex === 1 ? 'rest' : 'none',
        driver2: slotIndex === 2 ? 'rest' : 'none',
        driver1CardId: slotIndex === 1 ? templateId : NO_CARD,
        driver2CardId: slotIndex === 2 ? templateId : NO_CARD,
      })
      gapMs += MINUTE_MS
    }
  }

  /** Pokud je nowUtc zadané: posunout časovou osu tak, aby data končila 2 dny před „teď“ */
  if (useAnchoredTimeline && filledHistory.length > 0) {
    const lastMs = filledHistory[filledHistory.length - 1]!.minuteStartUtc
    const offsetMs = dataEndMs - lastMs
    const shift = (ms: number) => ms + offsetMs
    const shiftSegment = (seg: ManualEntrySegment) => {
      const d = new Date(Date.UTC(seg.year, seg.month - 1, seg.day, seg.hour, seg.minute))
      const shifted = new Date(d.getTime() + offsetMs)
      return {
        ...seg,
        day: shifted.getUTCDate(),
        month: shifted.getUTCMonth() + 1,
        year: shifted.getUTCFullYear(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
      }
    }
    filledHistory = filledHistory.map((e) => ({ ...e, minuteStartUtc: shift(e.minuteStartUtc) }))
    const shiftedManual = manualBuffer.map(shiftSegment)
    manualBuffer.length = 0
    manualBuffer.push(...shiftedManual)
  }

  /** Vygenerovat secondHistory pro paměť vozidla (V-diagram) – z activityHistory */
  const secondHistory: SecondActivitySnapshot[] = []
  let baseSpeed = 65
  for (const entry of filledHistory) {
    const isDriving = entry.driver1 === 'driving' || entry.driver2 === 'driving'
    for (let sec = 0; sec < 60; sec++) {
      const timestampUtc = entry.minuteStartUtc + sec * 1000
      const speed = isDriving
        ? Math.max(0, Math.min(125, baseSpeed + randomInt(-8, 8)))
        : 0
      if (isDriving && sec % 10 === 0) baseSpeed = Math.max(40, Math.min(95, baseSpeed + randomInt(-5, 5)))
      secondHistory.push({
        timestampUtc,
        driver1: entry.driver1,
        driver2: entry.driver2,
        speed,
      })
    }
  }

  return { activityHistory: filledHistory, manualEntryBuffer: manualBuffer, secondHistory }
}
