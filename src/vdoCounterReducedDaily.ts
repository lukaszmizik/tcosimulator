/**
 * Zkrácené denní odpočinky (9 h) v období mezi týdenními odpočinky (≥ 24 h).
 * Pro VDOi: zbývá = 3 − použité. Otevřené období končí „teď“.
 */

import type { WeeklyRestCandidate } from '../vendor/cardviewer/src/analysis/weeklyRest.ts'
import type { DrivingBreakInterval } from './drivingBreakDisplay'
import {
  MAX_REDUCED_DAILY_REST_PER_PERIOD,
  REDUCED_DAILY_REST_MIN_MS,
  REST_IN_SHIFT_FOR_9H_DAILY_MS,
  REST_RESET_REDUCED_COUNT_MS,
} from './VDOCounter'

/** Horní mez zkráceného denního odpočinku: &lt; 11 h. */
const REDUCED_DAILY_REST_MAX_MS = 11 * 60 * 60 * 1000 - 1

type Span = { startMs: number; endMs: number; durationMs: number }

function mergeKind(
  intervals: readonly DrivingBreakInterval[],
  kind: DrivingBreakInterval['kind'],
  fromMs: number,
  toMs: number,
): Span[] {
  const pieces = intervals
    .filter((item) => item.kind === kind && item.startMs < toMs && item.endMs > fromMs)
    .map((item) => ({
      startMs: Math.max(item.startMs, fromMs),
      endMs: Math.min(item.endMs, toMs),
    }))
    .filter((item) => item.endMs > item.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const spans: Span[] = []
  for (const piece of pieces) {
    const last = spans[spans.length - 1]
    if (last && piece.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, piece.endMs)
      last.durationMs = last.endMs - last.startMs
      continue
    }
    spans.push({
      startMs: piece.startMs,
      endMs: piece.endMs,
      durationMs: piece.endMs - piece.startMs,
    })
  }
  return spans
}

function mergeAll(intervals: readonly DrivingBreakInterval[], fromMs: number, toMs: number): DrivingBreakInterval[] {
  const clipped = intervals
    .filter((item) => item.startMs < toMs && item.endMs > fromMs)
    .map((item) => ({
      kind: item.kind,
      startMs: Math.max(item.startMs, fromMs),
      endMs: Math.min(item.endMs, toMs),
    }))
    .filter((item) => item.endMs > item.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const merged: DrivingBreakInterval[] = []
  for (const item of clipped) {
    const last = merged[merged.length - 1]
    if (last && last.kind === item.kind && item.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, item.endMs)
      continue
    }
    merged.push({ ...item })
  }
  return merged
}

function earliestStart(intervals: readonly DrivingBreakInterval[]): number | null {
  let min = Number.POSITIVE_INFINITY
  for (const item of intervals) {
    if (item.startMs < min) min = item.startMs
  }
  return Number.isFinite(min) ? min : null
}

function overlapsUnknown(
  fromMs: number,
  toMs: number,
  unknowns: readonly { startUtc: number; endUtc: number }[],
): boolean {
  return unknowns.some((item) => item.startUtc < toMs && item.endUtc > fromMs)
}

function hasLongRestInShift(blocks: readonly DrivingBreakInterval[], shiftStartMs: number, shiftEndMs: number): boolean {
  let run = 0
  let max = 0
  for (const block of blocks) {
    if (block.endMs <= shiftStartMs || block.startMs >= shiftEndMs) continue
    const start = Math.max(block.startMs, shiftStartMs)
    const end = Math.min(block.endMs, shiftEndMs)
    if (end <= start) continue
    if (block.kind === 'rest') {
      run += end - start
      max = Math.max(max, run)
    } else {
      run = 0
    }
  }
  return max >= REST_IN_SHIFT_FOR_9H_DAILY_MS
}

/**
 * Použité zkrácené denní odpočinky v [periodStartMs, periodEndMs).
 */
export function countReducedDailyRestsInPeriod(
  intervals: readonly DrivingBreakInterval[],
  periodStartMs: number,
  periodEndMs: number,
): number {
  if (periodEndMs <= periodStartMs) return 0
  const blocks = mergeAll(intervals, periodStartMs, periodEndMs)
  let count = 0
  let lastLongRestEndMs = periodStartMs
  for (const block of blocks) {
    if (block.kind !== 'rest') continue
    const durationMs = block.endMs - block.startMs
    if (durationMs < REDUCED_DAILY_REST_MIN_MS || durationMs > REDUCED_DAILY_REST_MAX_MS) {
      if (durationMs >= REDUCED_DAILY_REST_MIN_MS) lastLongRestEndMs = block.endMs
      continue
    }
    const shiftStartMs = lastLongRestEndMs
    const shiftEndMs = block.startMs
    lastLongRestEndMs = block.endMs
    const hasWorkInShift = blocks.some(
      (item) =>
        item.kind !== 'rest' &&
        item.startMs < shiftEndMs &&
        item.endMs > shiftStartMs,
    )
    if (!hasWorkInShift) continue
    if (hasLongRestInShift(blocks, shiftStartMs, shiftEndMs)) continue
    count += 1
    if (count >= MAX_REDUCED_DAILY_REST_PER_PERIOD) break
  }
  return count
}

/**
 * Zbývající počet zkrácení na 9 h v aktuálním plovoucím týdnu (mezi týdenními odpočinky).
 * null = nelze určit (díra / nejednoznačný týdenní odpočinek).
 * V osádce null – 9 h je standard, zkrácení se nepočítá.
 */
export function resolveReducedDailyRemaining(input: {
  intervals: readonly DrivingBreakInterval[]
  weeklyCandidates: readonly WeeklyRestCandidate[]
  unknowns: readonly { startUtc: number; endUtc: number }[]
  nowMs: number
  isMultiManning: boolean
}): number | null {
  if (input.isMultiManning) return null
  if (input.intervals.length === 0) return null

  const start = earliestStart(input.intervals)
  if (start == null) return null

  const establishedWeekly = input.weeklyCandidates
    .filter((item) => item.established && !item.ambiguous)
    .sort((a, b) => a.endUtc - b.endUtc || a.startUtc - b.startUtc)

  const ambiguousWeekly = input.weeklyCandidates.filter((item) => item.ambiguous)
  if (ambiguousWeekly.some((item) => item.startUtc < input.nowMs && item.endUtc > start)) {
    return null
  }

  // Probíhající odpočinek ≥ 24 h už resetuje počítadlo.
  const restsToNow = mergeKind(input.intervals, 'rest', start, input.nowMs)
  const ongoingWeekly = restsToNow.find(
    (rest) =>
      rest.startMs <= input.nowMs &&
      rest.endMs >= input.nowMs &&
      input.nowMs - rest.startMs >= REST_RESET_REDUCED_COUNT_MS,
  )
  if (ongoingWeekly) {
    return MAX_REDUCED_DAILY_REST_PER_PERIOD
  }

  const closedWeeklyEnds = establishedWeekly
    .filter((item) => item.endUtc <= input.nowMs)
    .map((item) => item.endUtc)
  const periodStartMs = closedWeeklyEnds.length > 0
    ? closedWeeklyEnds[closedWeeklyEnds.length - 1]!
    : start
  const periodEndMs = input.nowMs

  if (periodEndMs <= periodStartMs) {
    return MAX_REDUCED_DAILY_REST_PER_PERIOD
  }

  if (overlapsUnknown(periodStartMs, periodEndMs, input.unknowns)) {
    return null
  }

  const used = countReducedDailyRestsInPeriod(input.intervals, periodStartMs, periodEndMs)
  return Math.max(0, MAX_REDUCED_DAILY_REST_PER_PERIOD - used)
}
