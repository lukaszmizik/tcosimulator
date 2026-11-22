/**
 * Počitadlo pracovní doby. Nezasahuje do limitů řízení VDO (nařízení 561/2006).
 * Pracovní doba je součet řízení a jiné práce. Pohotovost se nepočítá a přestávku sama nepřeruší.
 * Odpočinek kratší než 15 minut souvislou práci nepřeruší a do přestávek se nepočítá.
 * Odpočinek alespoň 15 minut souvislou práci přeruší a do přestávek se počítá.
 * Při práci přes 6 h až do 9 h je potřeba 30 minut přestávek, přes 9 h 45 minut.
 * Mezera nebo neznámý úsek nechává výsledek neznámý.
 */

import type { DrivingBreakInterval } from './drivingBreakDisplay'
import { REDUCED_DAILY_REST_MIN_MS } from './VDOCounter'
import { firstUncoveredInterval, weekStartUtc } from './slot1DddDailyRemaining'

const MINUTE_MS = 60_000
const WORK_ACTIVITY = new Set<DrivingBreakInterval['kind']>(['driving', 'work'])
/** Uznatelná část přestávky podle směrnice 2002/15/ES. */
const BREAK_PART_MS = 15 * MINUTE_MS
const SIX_HOURS_MS = 6 * 60 * MINUTE_MS
const NINE_HOURS_MS = 9 * 60 * MINUTE_MS
const BREAK_30_MS = 30 * MINUTE_MS
const BREAK_45_MS = 45 * MINUTE_MS
/** Předběžné varování nepřerušené práce. Není to pevný údaj z příkladu v manuálu. */
export const WORK_PREWARNING_MS = 5 * 60 * MINUTE_MS + 45 * MINUTE_MS
/** Konec nepřerušené práce bez přestávky. */
export const WORK_LIMIT_MS = SIX_HOURS_MS

export type WorkingTimeDisplay = {
  /** Souvislá práce od poslední přestávky alespoň 15 minut. Kratší odpočinek ji nenuluje. Při takové probíhající přestávce je 0. */
  currentWithoutRestMs: number | null
  /** Řízení a jiná práce od konce posledního denního nebo týdenního odpočinku. */
  sinceDailyOrWeeklyRestMs: number | null
  /** Součet uznatelných přestávek (části alespoň 15 minut) v tomtéž období. */
  breaksInPeriodMs: number | null
  /** Pohotovost v tomtéž období. Do práce ani do přestávek se nepočítá. */
  availabilityMs: number | null
  /** 0 do 6 h práce, 30 min přes 6 h až do 9 h, 45 min přes 9 h. null je neznámá práce. */
  requiredBreakMs: number | null
  /** Pracovní doba od pondělí 00:00 UTC. */
  calendarWeekMs: number | null
}

export type WorkWarningLevel = '545' | '600'

export type WorkWarningDismissed = {
  prewarning: boolean
  limit: boolean
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

function mergeAdjacentRests(spans: readonly Span[]): Span[] {
  const merged: Span[] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && last.kind === 'rest' && span.kind === 'rest' && span.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, span.endMs)
    } else {
      merged.push({ kind: span.kind, startMs: span.startMs, endMs: span.endMs })
    }
  }
  return merged
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

function qualifyingRest(span: Span): boolean {
  return span.kind === 'rest' && span.endMs - span.startMs >= BREAK_PART_MS
}

function currentWithoutRest(spans: readonly Span[], nowMs: number, intervals: readonly DrivingBreakInterval[], undetermined: readonly { startMs: number; endMs: number }[]): number | null {
  const merged = mergeAdjacentRests(spans)
  const active = activeSpan(merged, nowMs)
  if (!active) return null
  const index = merged.indexOf(active)
  if (qualifyingRest(active)) {
    return covered(intervals, active.startMs, nowMs, undetermined) ? 0 : null
  }
  const openMinute = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS
  let chainStart = merged[0]?.startMs ?? active.startMs
  for (let earlier = index; earlier >= 0; earlier -= 1) {
    const span = merged[earlier]!
    // Uzavřené minuty končí na hraně minuty a sekundový zápis začíná až později.
    // Tahle díra není neznámý čas, stejně jako ji přeskakuje kontrola pokrytí.
    if (earlier < index && span.endMs < merged[earlier + 1]!.startMs && span.endMs < openMinute) return null
    if (qualifyingRest(span)) {
      chainStart = span.endMs
      break
    }
    chainStart = span.startMs
  }
  if (!covered(intervals, chainStart, nowMs, undetermined)) return null
  return sumBetween(spans, chainStart, nowMs, (kind) => WORK_ACTIVITY.has(kind))
}

function recognizedBreaks(spans: readonly Span[], fromMs: number, toMs: number): number {
  let sum = 0
  let start: number | null = null
  let end = 0
  const flush = () => {
    if (start == null) return
    if (end - start >= BREAK_PART_MS) {
      const overlapStart = Math.max(start, fromMs)
      const overlapEnd = Math.min(end, toMs)
      if (overlapEnd > overlapStart) sum += overlapEnd - overlapStart
    }
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
  return sum
}

function requiredWorkBreakMs(workMs: number | null): number | null {
  if (workMs == null) return null
  if (workMs > NINE_HOURS_MS) return BREAK_45_MS
  return workMs > SIX_HOURS_MS ? BREAK_30_MS : 0
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
  let availabilityMs: number | null = null
  if (periodStart == null) {
    sinceDailyOrWeeklyRestMs = null
    breaksInPeriodMs = null
    availabilityMs = null
  } else if (periodStart >= nowMs) {
    sinceDailyOrWeeklyRestMs = 0
    breaksInPeriodMs = 0
    availabilityMs = 0
  } else if (!covered(intervals, periodStart, nowMs, undetermined)) {
    sinceDailyOrWeeklyRestMs = null
    breaksInPeriodMs = null
    availabilityMs = null
  } else {
    sinceDailyOrWeeklyRestMs = sumBetween(spans, periodStart, nowMs, (kind) => WORK_ACTIVITY.has(kind))
    breaksInPeriodMs = recognizedBreaks(spans, periodStart, nowMs)
    availabilityMs = sumBetween(spans, periodStart, nowMs, (kind) => kind === 'availability')
  }
  const weekStart = weekStartUtc(nowMs)
  const calendarWeekMs = covered(intervals, weekStart, nowMs, undetermined)
    ? sumBetween(spans, weekStart, nowMs, (kind) => WORK_ACTIVITY.has(kind))
    : null
  return {
    currentWithoutRestMs,
    sinceDailyOrWeeklyRestMs,
    breaksInPeriodMs,
    availabilityMs,
    requiredBreakMs: requiredWorkBreakMs(sinceDailyOrWeeklyRestMs),
    calendarWeekMs,
  }
}

/**
 * Jedno vyhodnocení výstrahy nepřerušené práce.
 * Pod 5:45 se potvrzení zapomene. Neznámý čas výstrahu nevyvolá a potvrzení nemaže.
 */
export function nextWorkWarning(
  continuousMs: number | null,
  dismissed: WorkWarningDismissed,
): { level: WorkWarningLevel | null; dismissed: WorkWarningDismissed } {
  const next = continuousMs != null && continuousMs < WORK_PREWARNING_MS
    ? { prewarning: false, limit: false }
    : { prewarning: dismissed.prewarning, limit: dismissed.limit }
  if (continuousMs == null || continuousMs < WORK_PREWARNING_MS) return { level: null, dismissed: next }
  if (continuousMs >= WORK_LIMIT_MS) return { level: next.limit ? null : '600', dismissed: next }
  return { level: next.prewarning ? null : '545', dismissed: next }
}

export function confirmWorkWarning(level: WorkWarningLevel, dismissed: WorkWarningDismissed): WorkWarningDismissed {
  if (level === '545') return { prewarning: true, limit: dismissed.limit }
  return { prewarning: dismissed.prewarning, limit: true }
}
