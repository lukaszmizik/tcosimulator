/**
 * Výhled odpočinků pro VDO Counter LCD.
 * Blok 4h30 nepočítá – ten zůstává v drivingBreakDisplay.
 * Denní/týdenní odpočinky berou cardviewer analysis přes Activity adaptér.
 */

import { findRestIntervals } from '../vendor/cardviewer/src/analysis/restIntervals.ts'
import { classifyRestCandidates } from '../vendor/cardviewer/src/analysis/restCandidates.ts'
import { buildDailyRestChain } from '../vendor/cardviewer/src/analysis/dailyRestChain.ts'
import { DAILY_WINDOW_MS } from '../vendor/cardviewer/src/analysis/restWindowIntersection.ts'
import { classifyWeeklyRestCandidates } from '../vendor/cardviewer/src/analysis/weeklyRest.ts'
import { buildWeeklyRestAssignment } from '../vendor/cardviewer/src/analysis/weeklyRestAssignment.ts'
import { assessWeeklyRestCompensation } from '../vendor/cardviewer/src/analysis/weeklyRestCompensation.ts'
import { CREW_WINDOW_MS } from '../vendor/cardviewer/src/analysis/crewDailyRest.ts'
import type { DrivingBreakInterval } from './drivingBreakDisplay'
import { drivingBreakIntervalsToActivities } from './vdoCounterActivityAdapter'
import {
  DAILY_REST_MIN_11H_MS,
  MAX_REDUCED_DAILY_REST_PER_PERIOD,
  REDUCED_DAILY_REST_MIN_MS,
  REDUCED_WEEKLY_REST_MIN_MS,
  STANDARD_WEEKLY_REST_MIN_MS,
} from './VDOCounter'

const HOUR_MS = 60 * 60 * 1000
const SIX_PERIODS_MS = 6 * 24 * HOUR_MS

export type VdoCounterL2Kind = 'break' | 'daily' | 'weekly'

export type VdoCounterOutlook = {
  /** Délka dalšího denního odpočinku (11h nebo 9h). null = neurčeno. */
  nextDailyRestMs: number | null
  /** Zbývající čas do nejpozdějšího začátku denního odpočinku. */
  latestDailyRestStartMs: number | null
  /** Délka dalšího týdenního odpočinku (45h nebo 24h). */
  nextWeeklyRestMs: number | null
  /** Zbývající čas do nejpozdějšího začátku týdenního odpočinku. */
  latestWeeklyRestStartMs: number | null
  /** Zbývající počet zkrácení denního odpočinku na 9 h (max 3). */
  reducedDailyRemaining: number | null
  /** Zbývající náhrada za zkrácený týdenní odpočinek. */
  compensationMs: number | null
  /** Doporučený druh L2 při řízení (bez trajektu). */
  l2Kind: VdoCounterL2Kind
  /** Hodnota pro L2 při l2Kind daily/weekly; u break nechává volající requiredBreakMs. */
  l2RestMs: number | null
}

function lastDailyRestEndMs(intervals: readonly DrivingBreakInterval[], nowMs: number): number | null {
  let best: number | null = null
  const rests = intervals
    .filter((item) => item.kind === 'rest' && item.endMs <= nowMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  let runStart: number | null = null
  let runEnd: number | null = null
  const flush = () => {
    if (runStart == null || runEnd == null) return
    if (runEnd - runStart >= REDUCED_DAILY_REST_MIN_MS) best = runEnd
  }
  for (const rest of rests) {
    if (runEnd != null && rest.startMs <= runEnd) {
      runEnd = Math.max(runEnd, rest.endMs)
      continue
    }
    flush()
    runStart = rest.startMs
    runEnd = rest.endMs
  }
  flush()
  return best
}

function earliestActivityStart(intervals: readonly DrivingBreakInterval[]): number | null {
  let min = Number.POSITIVE_INFINITY
  for (const item of intervals) {
    if (item.startMs < min) min = item.startMs
  }
  return Number.isFinite(min) ? min : null
}

function recordEndUtc(intervals: readonly DrivingBreakInterval[], nowMs: number): number {
  let max = 0
  for (const item of intervals) {
    if (item.endMs > max) max = item.endMs
  }
  return Math.max(max, nowMs)
}

/**
 * Spočítá výhled denních/týdenních odpočinků pro zvolenou šachtu.
 * Při ambiguous / neúplných datech vrací null u konkrétních polí.
 */
export function buildVdoCounterOutlook(input: {
  intervals: readonly DrivingBreakInterval[]
  nowMs: number
  slot: 1 | 2
  isMultiManning: boolean
  /** Zbývající řízení v bloku 4h30 (pro volbu L2). */
  remainingDrivingMs: number | null
  /** Požadovaná další přestávka 45/30. */
  requiredBreakMs: number | null
  /** Zbývající prodloužení 10 h z denní osy (pro kontext, ne pro L2). */
  extensionsRemaining?: number | null
}): VdoCounterOutlook {
  const empty: VdoCounterOutlook = {
    nextDailyRestMs: null,
    latestDailyRestStartMs: null,
    nextWeeklyRestMs: null,
    latestWeeklyRestStartMs: null,
    reducedDailyRemaining: null,
    compensationMs: null,
    l2Kind: 'break',
    l2RestMs: null,
  }
  if (input.intervals.length === 0) return empty

  const activities = drivingBreakIntervalsToActivities(input.intervals, input.slot)
  const restIntervals = findRestIntervals(activities)
  const candidates = classifyRestCandidates(restIntervals)
  const unknowns = activities
    .filter((activity) => activity.kind === 'unknown')
    .map((activity) => ({ startUtc: activity.startUtc, endUtc: activity.endUtc }))
  const endUtc = recordEndUtc(input.intervals, input.nowMs)

  const anchor = lastDailyRestEndMs(input.intervals, input.nowMs) ?? earliestActivityStart(input.intervals)
  let nextDailyRestMs: number | null = null
  let latestDailyRestStartMs: number | null = null
  let reducedUsed: number | null = null

  if (anchor != null) {
    const chain = buildDailyRestChain(
      anchor,
      candidates,
      unknowns,
      endUtc,
      input.isMultiManning
        ? activities.map((activity) => ({
            id: activity.id,
            kind: activity.kind,
            startUtc: activity.startUtc,
            endUtc: activity.endUtc,
            isCrew: true,
            slot: activity.slot,
          }))
        : [],
    )
    const open = chain.nodes[chain.nodes.length - 1]
    if (open) {
      const windowMs = open.windowMode === 'crew_30h' ? CREW_WINDOW_MS : DAILY_WINDOW_MS
      const deadline = open.windowStartUtc + windowMs
      latestDailyRestStartMs = Math.max(0, deadline - input.nowMs)
      if (open.status === 'history_incomplete' || open.status === 'insufficient_data') {
        nextDailyRestMs = null
        latestDailyRestStartMs = null
      } else {
        const path = chain.paths[0]
        reducedUsed = path?.reducedCount ?? 0
        const canReduce = reducedUsed < MAX_REDUCED_DAILY_REST_PER_PERIOD
        nextDailyRestMs = canReduce ? REDUCED_DAILY_REST_MIN_MS : DAILY_REST_MIN_11H_MS
        // Osádka: standardní denní odpočinek 9 h
        if (input.isMultiManning || open.windowMode === 'crew_30h') {
          nextDailyRestMs = REDUCED_DAILY_REST_MIN_MS
        }
      }
    }
  }

  const weeklyCandidates = classifyWeeklyRestCandidates(candidates)
  const assignment = buildWeeklyRestAssignment({
    candidates: weeklyCandidates,
    unknownIntervals: unknowns,
    recordEndUtc: endUtc,
  })
  let nextWeeklyRestMs: number | null = STANDARD_WEEKLY_REST_MIN_MS
  let latestWeeklyRestStartMs: number | null = null
  const establishedWeeklyNodes = assignment.nodes.filter((node) => !node.ambiguous).sort((a, b) => a.endUtc - b.endUtc)
  const lastBoundary = assignment.suggestedBoundaryEndsUtc[assignment.suggestedBoundaryEndsUtc.length - 1]
    ?? establishedWeeklyNodes[establishedWeeklyNodes.length - 1]?.endUtc
  if (lastBoundary != null) {
    latestWeeklyRestStartMs = Math.max(0, lastBoundary + SIX_PERIODS_MS - input.nowMs)
  } else {
    const start = earliestActivityStart(input.intervals)
    if (start != null) latestWeeklyRestStartMs = Math.max(0, start + SIX_PERIODS_MS - input.nowMs)
  }
  // Po řádném 45h odpočinku další může být zkrácený 24h; bez jistoty ukazujeme 45h.
  const weeklySorted = [...weeklyCandidates].sort((a, b) => a.endUtc - b.endUtc)
  const lastWeekly = weeklySorted[weeklySorted.length - 1]
  if (lastWeekly?.established && lastWeekly.lengthClass === 'regular') {
    nextWeeklyRestMs = REDUCED_WEEKLY_REST_MIN_MS
  } else if (lastWeekly?.ambiguous) {
    nextWeeklyRestMs = null
    latestWeeklyRestStartMs = null
  }

  let compensationMs: number | null = null
  const compensation = assessWeeklyRestCompensation({
    candidates: weeklyCandidates,
    unknownIntervals: unknowns,
    recordEndUtc: endUtc,
  })
  const openObligations = compensation.obligations.filter((item) => item.compensationMs > 0)
  if (openObligations.length > 0) {
    compensationMs = openObligations.reduce((sum, item) => sum + item.compensationMs, 0)
  } else if (compensation.unresolved.length > 0 && openObligations.length === 0) {
    compensationMs = null
  } else {
    compensationMs = 0
  }

  const reducedDailyRemaining = reducedUsed == null
    ? null
    : Math.max(0, MAX_REDUCED_DAILY_REST_PER_PERIOD - reducedUsed)

  const remainingDriving = input.remainingDrivingMs
  const breakMs = input.requiredBreakMs
  let l2Kind: VdoCounterL2Kind = 'break'
  let l2RestMs: number | null = breakMs

  if (typeof remainingDriving === 'number') {
    const urgencyBreak = remainingDriving
    const urgencyDaily = latestDailyRestStartMs
    const urgencyWeekly = latestWeeklyRestStartMs
    const dailyOk = typeof urgencyDaily === 'number' && typeof nextDailyRestMs === 'number'
    const weeklyOk = typeof urgencyWeekly === 'number' && typeof nextWeeklyRestMs === 'number'
    if (dailyOk && urgencyDaily! < urgencyBreak && (!weeklyOk || urgencyDaily! <= urgencyWeekly!)) {
      l2Kind = 'daily'
      l2RestMs = nextDailyRestMs
    } else if (weeklyOk && urgencyWeekly! < urgencyBreak && (!dailyOk || urgencyWeekly! < urgencyDaily!)) {
      l2Kind = 'weekly'
      l2RestMs = nextWeeklyRestMs
    } else {
      l2Kind = 'break'
      l2RestMs = breakMs
    }
  }

  return {
    nextDailyRestMs,
    latestDailyRestStartMs,
    nextWeeklyRestMs,
    latestWeeklyRestStartMs,
    reducedDailyRemaining,
    compensationMs,
    l2Kind,
    l2RestMs,
  }
}
