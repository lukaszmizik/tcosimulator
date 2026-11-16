/**
 * Denní zbytek řízení z intervalů DDD karty ve šachtě 1.
 * Stejná osa jako slot1DddDrivingBreak. Společnou activityHistory nečte.
 *
 * Denní období začíná koncem posledního souvislého odpočinku ≥ 9 h
 * (REDUCED_DAILY_REST_MIN_MS). Půlnoc období neukončí.
 * 10 h platí jen při méně než dvou obdobích tohoto kalendářního týdne
 * s řízením ≥ 9 h 01 min a jen když karta týden pokrývá. Jinak 9 h.
 * Počet povolených zkrácení a složení 3 h + 9 h se neposuzuje.
 */

import type { DrivingBreakInterval } from './drivingBreakDisplay'
import {
  DAILY_DRIVING_LIMIT_MS,
  EXTENDED_DRIVING_LIMIT_MS,
  EXTENDED_DRIVING_THRESHOLD_MS,
  REDUCED_DAILY_REST_MIN_MS,
  TWO_WEEKS_DRIVING_LIMIT_MS,
  WEEKLY_DRIVING_LIMIT_MS,
} from './VDOCounter'

/** Dvě prodloužení denní doby řízení v kalendářním týdnu, stejně jako volba limitu 9 h / 10 h. */
const DAILY_EXTENSIONS_PER_WEEK = 2

export type Slot1DddDailyRemaining = {
  remainingMs: number | null
  drivenMs: number | null
  limitMs: number | null
  note: string | null
  /**
   * Zbývající prodloužení na 10 h. null je neurčená hodnota při neúplném týdnu
   * nebo když období nelze ze stejných pravidel sestavit. 0 je skutečná nula.
   */
  extensionsRemaining: number | null
}

const MISSING_REST_NOTE =
  'Na kartě není souvislý denní odpočinek alespoň 9 h, od kterého by denní období začínalo. Denní zbytek se nepřebírá z paměti vozidla.'

const WEEK_NOTE =
  'Záznamy karty nezačínají na začátku týdne, proto se nepoužije 10 h a platí 9 h. Paměť vozidla se k tomu nebere.'

const RULE_NOTE =
  'Denní období ukončuje jen souvislý odpočinek alespoň 9 h, ne půlnoc. Počet zkrácených denních odpočinků a složení 3 h + 9 h se neposuzuje.'

export function weekStartUtc(nowMs: number): number {
  const date = new Date(nowMs)
  const day = date.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + mondayOffset)
}

function merged(intervals: readonly DrivingBreakInterval[], kind: DrivingBreakInterval['kind'], untilMs: number) {
  const pieces = intervals
    .filter((item) => item.kind === kind && item.startMs < untilMs)
    .map((item) => ({ startMs: item.startMs, endMs: Math.min(item.endMs, untilMs) }))
    .filter((item) => item.endMs > item.startMs)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  const spans: { startMs: number; endMs: number }[] = []
  for (const piece of pieces) {
    const last = spans[spans.length - 1]
    if (last && piece.startMs <= last.endMs) last.endMs = Math.max(last.endMs, piece.endMs)
    else spans.push({ startMs: piece.startMs, endMs: piece.endMs })
  }
  return spans
}

function drivingMs(intervals: readonly DrivingBreakInterval[], fromMs: number, toMs: number): number {
  let cursor = fromMs
  let sum = 0
  for (const piece of merged(intervals, 'driving', toMs)) {
    const start = Math.max(piece.startMs, cursor)
    if (piece.endMs > start) {
      sum += piece.endMs - start
      cursor = piece.endMs
    }
  }
  return sum
}

export function slot1DddDailyRemaining(
  intervals: readonly DrivingBreakInterval[],
  nowMs: number,
): Slot1DddDailyRemaining {
  const boundaries = merged(intervals, 'rest', nowMs)
    .filter((rest) => rest.endMs - rest.startMs >= REDUCED_DAILY_REST_MIN_MS)
    .map((rest) => rest.endMs)
  if (boundaries.length === 0) {
    return { remainingMs: null, drivenMs: null, limitMs: null, note: MISSING_REST_NOTE, extensionsRemaining: null }
  }

  const periodStart = boundaries[boundaries.length - 1]!
  const drivenMs = drivingMs(intervals, periodStart, nowMs)
  const weekStart = weekStartUtc(nowMs)
  const earliest = intervals.reduce((min, item) => Math.min(min, item.startMs), Number.POSITIVE_INFINITY)
  const weekCovered = Number.isFinite(earliest) && (earliest <= weekStart || boundaries.some((end) => end <= weekStart))
  let extended = 0
  for (let index = 0; index < boundaries.length; index++) {
    const start = boundaries[index]!
    if (start < weekStart) continue
    const end = index + 1 < boundaries.length ? boundaries[index + 1]! : nowMs
    if (drivingMs(intervals, start, end) >= EXTENDED_DRIVING_THRESHOLD_MS) extended++
  }
  const limitMs = !weekCovered || extended >= DAILY_EXTENSIONS_PER_WEEK ? DAILY_DRIVING_LIMIT_MS : EXTENDED_DRIVING_LIMIT_MS
  const extensionsRemaining = coverageWalk(intervals, weekStart, nowMs).covered
    ? Math.max(0, DAILY_EXTENSIONS_PER_WEEK - extended)
    : null
  return {
    remainingMs: Math.max(0, limitMs - drivenMs),
    drivenMs,
    limitMs,
    note: weekCovered ? RULE_NOTE : WEEK_NOTE,
    extensionsRemaining,
  }
}

const WEEK_MS = 7 * 24 * 3_600_000

export type Slot1DddCalendarRemaining = {
  weeklyRemainingMs: number | null
  fortnightRemainingMs: number | null
  fortnightSumMs: number | null
  currentWeekDrivingMs: number | null
  previousWeekDrivingMs: number | null
  note: string | null
}

/**
 * Týden je pokrytý, když od jeho pondělí 00:00 UTC do simulačního času
 * není mezera ani unknown. Výslovně zaznamenaný odpočinek, řízení, práce
 * a pohotovost pokrytí drží. Jízda přes pondělí se dělí podle skutečného času.
 * Nedokončená aktuální minuta, do které záznam už sahá, mezera není.
 * Bez pokrytí je příslušný zbytek i dvoutýdenní součet null.
 */
export function slot1DddCalendarRemaining(
  intervals: readonly DrivingBreakInterval[],
  nowMs: number,
): Slot1DddCalendarRemaining {
  const thisMonday = weekStartUtc(nowMs)
  const prevMonday = thisMonday - WEEK_MS
  const currentCovered = coverageWalk(intervals, thisMonday, nowMs).covered
  const fortnightCovered = currentCovered && coverageWalk(intervals, prevMonday, thisMonday).covered
  if (!currentCovered) {
    return {
      weeklyRemainingMs: null,
      fortnightRemainingMs: null,
      fortnightSumMs: null,
      currentWeekDrivingMs: null,
      previousWeekDrivingMs: null,
      note: 'Týdenní zbytek neurčený. Dvoutýdenní zbytek neurčený. V aktuálním týdnu je mezera nebo unknown, součet nelze určit.',
    }
  }
  const currentWeekDrivingMs = drivingMs(intervals, thisMonday, nowMs)
  const weeklyRemainingMs = Math.max(0, WEEKLY_DRIVING_LIMIT_MS - currentWeekDrivingMs)
  if (!fortnightCovered) {
    return {
      weeklyRemainingMs,
      fortnightRemainingMs: null,
      fortnightSumMs: null,
      currentWeekDrivingMs,
      previousWeekDrivingMs: null,
      note: 'Dvoutýdenní zbytek neurčený. V předchozím týdnu je mezera nebo unknown, součet nelze určit.',
    }
  }
  const previousWeekDrivingMs = drivingMs(intervals, prevMonday, thisMonday)
  const fortnightSumMs = previousWeekDrivingMs + currentWeekDrivingMs
  return {
    weeklyRemainingMs,
    fortnightRemainingMs: Math.max(0, TWO_WEEKS_DRIVING_LIMIT_MS - fortnightSumMs),
    fortnightSumMs,
    currentWeekDrivingMs,
    previousWeekDrivingMs,
    note: null,
  }
}

const MINUTE_MS = 60_000

export type UncoveredInterval = {
  startMs: number
  endMs: number
}

/**
 * První díra v [fromMs, toMs). Díra jen v nedokončené aktuální minutě,
 * do které záznam už sahá, se nepočítá: minutový zápis tu vteřinu ještě nemá.
 */
export function firstUncoveredInterval(
  intervals: readonly DrivingBreakInterval[],
  fromMs: number,
  toMs: number,
): UncoveredInterval | null {
  return coverageWalk(intervals, fromMs, toMs).hole
}

function coverageWalk(
  intervals: readonly DrivingBreakInterval[],
  fromMs: number,
  toMs: number,
): { covered: boolean; hole: UncoveredInterval | null } {
  if (toMs <= fromMs) return { covered: true, hole: null }
  const spans = intervals
    .map((item) => ({ startMs: Math.max(item.startMs, fromMs), endMs: Math.min(item.endMs, toMs) }))
    .filter((item) => item.endMs > item.startMs)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  let cursor = fromMs
  for (const span of spans) {
    if (span.startMs > cursor) return { covered: false, hole: { startMs: cursor, endMs: span.startMs } }
    if (span.endMs > cursor) cursor = span.endMs
    if (cursor >= toMs) return { covered: true, hole: null }
  }
  if (cursor >= toMs) return { covered: true, hole: null }
  const openMinute = Math.floor(toMs / MINUTE_MS) * MINUTE_MS
  if (cursor >= openMinute && toMs > openMinute) return { covered: true, hole: null }
  return { covered: false, hole: { startMs: cursor, endMs: toMs } }
}
