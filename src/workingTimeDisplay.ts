/**
 * Počitadlo pracovní doby. Nezasahuje do limitů řízení VDO.
 * Pracovní doba je součet řízení, jiné práce a pohotovosti.
 * Odpočinek se do ní nepočítá. Chybějící pokrytí nebo nedoložený OUT je null.
 */

import type { DrivingBreakInterval } from './drivingBreakDisplay'
import { REDUCED_DAILY_REST_MIN_MS } from './VDOCounter'
import { firstUncoveredInterval, weekStartUtc } from './slot1DddDailyRemaining'

const MINUTE_MS = 60_000
const WORKING = new Set<DrivingBreakInterval['kind']>(['driving', 'work', 'availability'])

export type WorkingTimeDisplay = {
  /** Souvislá pracovní doba od posledního odpočinku. Při probíhajícím odpočinku je 0. */
  currentWithoutRestMs: number | null
  /** Pracovní doba od konce posledního denního nebo týdenního odpočinku. */
  sinceDailyOrWeeklyRestMs: number | null
  /** Odpočinek kratší než denní odpočinek v tomtéž období. */
  breaksInPeriodMs: number | null
  /** Pracovní doba od pondělí 00:00 UTC. */
  calendarWeekMs: number | null
}

type Span = { kind: DrivingBreakInterval['kind']; startMs: number; endMs: number }

function clipped(intervals: readonly DrivingBreakInterval[], nowMs: number): Span[] {
  return intervals
    .filter((item) => item.startMs < nowMs && item.endMs > item.startMs)
    .map((item) => ({ kind: item.kind, startMs: item.startMs, endMs: Math.min(item.endMs, nowMs) }))
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
}

function blocked(undetermined: readonly { startMs: number; endMs: number }[], fromMs: number, toMs: number): boolean {
  return undetermined.some((item) => item.startMs < toMs && item.endMs > fromMs)
}

function covered(intervals: readonly DrivingBreakInterval[], fromMs: number, toMs: number, undetermined: readonly { startMs: number; endMs: number }[]): boolean {
  if (toMs < fromMs) return false
  if (blocked(undetermined, fromMs, toMs)) return false
  return firstUncoveredInterval(intervals, fromMs, toMs) == null
}

function sumBetween(spans: readonly Span[], fromMs: number, toMs: number, accept: (kind: Span['kind']) => boolean): number {
  let cursor = fromMs
  let sum = 0
  for (const span of spans) {
    if (!accept(span.kind)) continue
    const start = Math.max(span.startMs, cursor, fromMs)
    const end = Math.min(span.endMs, toMs)
    if (end > start) {
      sum += end - start
      cursor = end
    }
  }
  return sum
}

function activeSpan(spans: readonly Span[], nowMs: number): Span | null {
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index]!
    if (span.startMs < nowMs && span.endMs >= nowMs) return span
  }
  const openMinute = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index]!
    if (span.endMs >= openMinute && span.endMs <= nowMs && span.startMs < nowMs) return span
  }
  return null
}

function currentWithoutRest(spans: readonly Span[], nowMs: number, intervals: readonly DrivingBreakInterval[], undetermined: readonly { startMs: number; endMs: number }[]): number | null {
  const active = activeSpan(spans, nowMs)
  if (!active) return null
  if (active.kind === 'rest') return covered(intervals, active.startMs, nowMs, undetermined) ? 0 : null
  let start = active.startMs
  const index = spans.indexOf(active)
  for (let earlier = index - 1; earlier >= 0; earlier -= 1) {
    const previous = spans[earlier]!
    if (previous.endMs < start) return null
    if (previous.kind === 'rest') break
    if (previous.startMs < start) start = previous.startMs
  }
  if (!covered(intervals, start, nowMs, undetermined)) return null
  return sumBetween(spans, start, nowMs, (kind) => WORKING.has(kind))
}

function dailyOrWeeklyRestEnd(spans: readonly Span[], nowMs: number, extraEndsMs: readonly number[]): number | null {
  const ends: number[] = []
  let start: number | null = null
  let end = 0
  const flush = () => {
    if (start != null && end - start >= REDUCED_DAILY_REST_MIN_MS && end <= nowMs) ends.push(end)
    start = null
  }
  for (const span of spans) {
    if (span.kind !== 'rest') {
      flush()
      continue
    }
    if (start == null || span.startMs > end) {
      flush()
      start = span.startMs
      end = span.endMs
    } else {
      end = Math.max(end, span.endMs)
    }
  }
  flush()
  for (const extra of extraEndsMs) {
    if (extra <= nowMs) ends.push(extra)
  }
  if (ends.length === 0) return null
  return Math.max(...ends)
}

/**
 * Denní nebo týdenní hranice je konec souvislého odpočinku alespoň 9 h,
 * stejně jako začátek denního období. Dokončený trajektový odpočinek se předá zvlášť.
 */
export function workingTimeDisplay(
  intervals: readonly DrivingBreakInterval[],
  nowMs: number,
  options?: {
    undetermined?: readonly { startMs: number; endMs: number }[]
    extraDailyRestEndsMs?: readonly number[]
  },
): WorkingTimeDisplay {
  const undetermined = options?.undetermined ?? []
  const spans = clipped(intervals, nowMs)
  const currentWithoutRestMs = currentWithoutRest(spans, nowMs, intervals, undetermined)
  const periodStart = dailyOrWeeklyRestEnd(spans, nowMs, options?.extraDailyRestEndsMs ?? [])
  let sinceDailyOrWeeklyRestMs: number | null = null
  let breaksInPeriodMs: number | null = null
  if (periodStart == null) {
    sinceDailyOrWeeklyRestMs = null
    breaksInPeriodMs = null
  } else if (periodStart >= nowMs) {
    sinceDailyOrWeeklyRestMs = 0
    breaksInPeriodMs = 0
  } else if (!covered(intervals, periodStart, nowMs, undetermined)) {
    sinceDailyOrWeeklyRestMs = null
    breaksInPeriodMs = null
  } else {
    sinceDailyOrWeeklyRestMs = sumBetween(spans, periodStart, nowMs, (kind) => WORKING.has(kind))
    breaksInPeriodMs = sumBetween(spans, periodStart, nowMs, (kind) => kind === 'rest')
  }
  const weekStart = weekStartUtc(nowMs)
  const calendarWeekMs = covered(intervals, weekStart, nowMs, undetermined)
    ? sumBetween(spans, weekStart, nowMs, (kind) => WORKING.has(kind))
    : null
  return { currentWithoutRestMs, sinceDailyOrWeeklyRestMs, breaksInPeriodMs, calendarWeekMs }
}
