/**
 * Zbývající pravidelný denní odpočinek při trajektu.
 * Počítá se jen zaznamenaný odpočinek. Symbol trajektu odpočinek nevytvoří
 * a není důkaz, že řidič měl lůžko.
 * Přerušení se přeskočí jen uvnitř doloženého úseku stejného zdroje,
 * nejvýše dvakrát a dohromady nejvýše 60 minut. Čas přerušení se do odpočinku nepočítá.
 * Dvě přerušení nad 60 minut nebo tři přerušení odpočinek nespojí.
 * Hranice vozidla neplatí pro import z DDD.
 * Chybí-li konec trajektu, otevřený úsek končí na první mezeře vlastního záznamu.
 */

import type { DrivingBreakInterval } from './drivingBreakDisplay'
import { continuousRecordEnd } from './outDrivingEvaluation'
import { DAILY_REST_MIN_11H_MS } from './VDOCounter'

const MAX_FERRY_INTERRUPTIONS = 2
const MAX_FERRY_INTERRUPTION_MS = 60 * 60 * 1000

type FerryBoundary = { atMs: number; type: 'activation' | 'deactivation' }
type Range = { startMs: number; endMs: number }
type SourceName = 'imported' | 'vehicle' | 'manual'
type TaggedInterval = DrivingBreakInterval & { source: SourceName }

export function cardFerryBoundaries(
  conditions: readonly { kind: string; atUtc: number }[] | undefined,
): FerryBoundary[] {
  const boundaries: FerryBoundary[] = []
  for (const condition of conditions ?? []) {
    if (condition.kind === 'ferry') boundaries.push({ atMs: condition.atUtc, type: 'activation' })
    else if (condition.kind === 'ferry_end') boundaries.push({ atMs: condition.atUtc, type: 'deactivation' })
  }
  return boundaries
}

export function vehicleFerryBoundaries(
  events: readonly { minuteStartUtc: number; type: 'activation' | 'deactivation' }[],
): FerryBoundary[] {
  return events.map((event) => ({ atMs: event.minuteStartUtc, type: event.type }))
}

export type CompletedRegularRest = {
  endMs: number
  /** Lůžko ze záznamů nevyplývá. Značka trajektu ho nedokazuje. */
  conditional: boolean
}

export function ferryDailyRestRemaining(input: {
  imported: readonly DrivingBreakInterval[]
  vehicle: readonly DrivingBreakInterval[]
  manual?: readonly DrivingBreakInterval[]
  cardConditions?: readonly { kind: string; atUtc: number }[]
  vehicleEvents?: readonly { minuteStartUtc: number; type: 'activation' | 'deactivation' }[]
  nowMs: number
}): {
  remainingMs: number | null
  accumulatedMs: number | null
  conditional: boolean
  completed: CompletedRegularRest[]
} {
  const none = { remainingMs: null, accumulatedMs: null, conditional: false, completed: [] as CompletedRegularRest[] }
  const imported = sourceWindows(input.imported, cardFerryBoundaries(input.cardConditions), input.nowMs)
  const vehicle = sourceWindows(input.vehicle, vehicleFerryBoundaries(input.vehicleEvents ?? []), input.nowMs)
  if (imported.ambiguous || vehicle.ambiguous) return none
  const walked = walkRest(
    taggedMerge(input.imported, input.vehicle, input.manual ?? []),
    { imported: imported.ranges, vehicle: vehicle.ranges, manual: [] },
    input.nowMs,
  )
  if (walked == null) return none
  if (!walked.ongoing) return { ...none, completed: walked.completed }
  return {
    accumulatedMs: walked.accumulatedMs,
    remainingMs: Math.max(0, DAILY_REST_MIN_11H_MS - walked.accumulatedMs),
    conditional: walked.conditional,
    completed: walked.completed,
  }
}

/**
 * Dokončený pravidelný odpočinek zůstane hranicí denního období i mimo režim trajekt.
 * Do osy se nemaluje: souvislých 11 h by přikrylo skutečná přerušení, sloučilo se
 * s dřívějším odpočinkem a čas by v navazujících výpočtech nešel oddělit.
 * Hranice je `completed.endMs` a předává se zvlášť.
 */
export function intervalsWithRecognizedFerryRest(
  intervals: readonly DrivingBreakInterval[],
  completed: readonly CompletedRegularRest[],
): DrivingBreakInterval[] {
  void completed
  return intervals.map((interval) => ({ kind: interval.kind, startMs: interval.startMs, endMs: interval.endMs }))
}

function sourceWindows(
  intervals: readonly DrivingBreakInterval[],
  events: readonly FerryBoundary[],
  nowMs: number,
): { ranges: Range[]; ambiguous: boolean } {
  if (!intervals.some((interval) => Math.min(interval.endMs, nowMs) > interval.startMs)) {
    return { ranges: [], ambiguous: false }
  }
  const ranges = closedRanges(events, nowMs)
  let ambiguous = false
  for (const startMs of openStarts(events, nowMs)) {
    const limitMs = continuousRecordEnd(intervals, startMs, nowMs)
    const continuesAfterGap = intervals.some((interval) => {
      const endMs = Math.min(interval.endMs, nowMs)
      return endMs > interval.startMs && endMs > limitMs && interval.startMs < nowMs
    })
    if (continuesAfterGap) ambiguous = true
    else if (limitMs > startMs) ranges.push({ startMs, endMs: limitMs })
  }
  if (ranges.some((range) => hasGap(intervals, range.startMs, Math.min(range.endMs, nowMs)))) ambiguous = true
  return { ranges: ambiguous ? [] : ranges, ambiguous }
}

function closedRanges(events: readonly FerryBoundary[], nowMs: number): Range[] {
  const sorted = [...events].sort((left, right) => left.atMs - right.atMs)
  const ranges: Range[] = []
  let pending: number | null = null
  for (const event of sorted) {
    if (event.atMs > nowMs) break
    if (event.type === 'activation') {
      pending = event.atMs
      continue
    }
    if (pending == null) continue
    const endMs = Math.min(event.atMs, nowMs)
    if (endMs > pending) ranges.push({ startMs: pending, endMs })
    pending = null
  }
  return ranges
}

function openStarts(events: readonly FerryBoundary[], nowMs: number): number[] {
  const sorted = [...events].sort((left, right) => left.atMs - right.atMs)
  let pending: number | null = null
  for (const event of sorted) {
    if (event.atMs > nowMs) break
    pending = event.type === 'activation' ? event.atMs : null
  }
  return pending == null ? [] : [pending]
}

function hasGap(intervals: readonly DrivingBreakInterval[], fromMs: number, toMs: number): boolean {
  if (toMs <= fromMs) return false
  let cursor = fromMs
  const spans = intervals
    .map((interval) => ({ startMs: Math.max(interval.startMs, fromMs), endMs: Math.min(interval.endMs, toMs) }))
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  for (const span of spans) {
    if (span.endMs <= cursor) continue
    if (span.startMs > cursor) return true
    cursor = span.endMs
  }
  return cursor < toMs
}

function walkRest(
  intervals: readonly TaggedInterval[],
  windows: Record<SourceName, Range[]>,
  nowMs: number,
): { accumulatedMs: number; ongoing: boolean; conditional: boolean; completed: CompletedRegularRest[] } | null {
  let restMs = 0
  let interruptionMs = 0
  let interruptionCount = 0
  let bridged = false
  let pending = false
  let ongoing = false
  let lastRestEnd: number | null = null
  let cursor: number | null = null
  const completed: CompletedRegularRest[] = []
  const finishPeriod = () => {
    if (restMs >= DAILY_REST_MIN_11H_MS && lastRestEnd != null) {
      completed.push({ endMs: lastRestEnd, conditional: bridged })
    }
    restMs = 0
    interruptionMs = 0
    interruptionCount = 0
    bridged = false
    pending = false
    ongoing = false
    lastRestEnd = null
  }
  const spans = intervals
    .map((interval) => ({ ...interval, endMs: Math.min(interval.endMs, nowMs) }))
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  for (const span of spans) {
    if (cursor != null && span.startMs > cursor) finishPeriod()
    if (span.kind === 'rest') {
      restMs += span.endMs - span.startMs
      pending = true
      lastRestEnd = span.endMs
      ongoing = span.endMs === nowMs
    } else {
      const cover = coverage(span, windows[span.source])
      const durationMs = span.endMs - span.startMs
      const canBridge = cover === 'inside'
        && pending
        && interruptionCount + 1 <= MAX_FERRY_INTERRUPTIONS
        && interruptionMs + durationMs <= MAX_FERRY_INTERRUPTION_MS
      if (canBridge) {
        interruptionCount += 1
        interruptionMs += durationMs
        bridged = true
        ongoing = span.endMs === nowMs
      } else if (cover === 'partial' && (pending || span.endMs === nowMs)) {
        return null
      } else {
        finishPeriod()
      }
    }
    cursor = span.endMs
  }
  if (!ongoing) finishPeriod()
  return { accumulatedMs: restMs, ongoing, conditional: ongoing && bridged, completed }
}

function coverage(span: { startMs: number; endMs: number }, windows: readonly Range[]): 'inside' | 'partial' | 'outside' {
  let touched = false
  for (const window of windows) {
    if (window.endMs <= span.startMs || window.startMs >= span.endMs) continue
    touched = true
    if (window.startMs <= span.startMs && window.endMs >= span.endMs) return 'inside'
  }
  return touched ? 'partial' : 'outside'
}

function taggedMerge(
  imported: readonly DrivingBreakInterval[],
  vehicle: readonly DrivingBreakInterval[],
  manual: readonly DrivingBreakInterval[],
): TaggedInterval[] {
  const placed: TaggedInterval[] = imported.map((interval) => ({ ...interval, source: 'imported' }))
  for (const interval of vehicle) placed.push(...outsideTagged(interval, 'vehicle', placed))
  for (const interval of manual) placed.push(...outsideTagged(interval, 'manual', placed))
  placed.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  return placed
}

function outsideTagged(interval: DrivingBreakInterval, source: SourceName, blocked: readonly TaggedInterval[]): TaggedInterval[] {
  let pieces: TaggedInterval[] = [{ ...interval, source }]
  for (const block of blocked) {
    const next: TaggedInterval[] = []
    for (const piece of pieces) {
      if (block.endMs <= piece.startMs || block.startMs >= piece.endMs) {
        next.push(piece)
        continue
      }
      if (piece.startMs < block.startMs) next.push({ ...piece, endMs: block.startMs })
      if (piece.endMs > block.endMs) next.push({ ...piece, startMs: block.endMs })
    }
    pieces = next
  }
  return pieces.filter((piece) => piece.endMs > piece.startMs)
}
