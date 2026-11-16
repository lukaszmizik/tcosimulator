/**
 * Doložený úsek jízdy v OUT se pro výpočet čte jako jiná práce.
 * Zobrazená činnost zůstává ta, kterou má tlačítko a záznam karty.
 * Tento krok záznam karty nemění a nekouká na to, jestli je OUT právě zapnutý.
 *
 * Hranice simulovaného vozidla platí jen pro jeho vlastní minuty.
 * Podmínky DDD platí jen pro importovanou jízdu té karty.
 * Chybí-li out_end, otevřený úsek končí na první mezeře vlastního záznamu
 * a nepřejde do jiného vozidla ani do živé simulace.
 * Jízda za tou mezerou není doložené OUT ani doložené běžné řízení.
 */

import { currentDrivingBlockStartMs, type DrivingBreakInterval } from './drivingBreakDisplay'

export type OutBoundaryEvent = {
  atMs: number
  type: 'activation' | 'deactivation'
}

export function vehicleOutBoundaries(
  events: readonly { minuteStartUtc: number; type: 'activation' | 'deactivation' }[],
): OutBoundaryEvent[] {
  return events.map((event) => ({ atMs: event.minuteStartUtc, type: event.type }))
}

/** Jen podmínky vybrané karty. Jiný druh podmínky hranici OUT nevytvoří. */
export function cardOutBoundaries(
  conditions: readonly { kind: string; atUtc: number }[] | undefined,
): OutBoundaryEvent[] {
  const boundaries: OutBoundaryEvent[] = []
  for (const condition of conditions ?? []) {
    if (condition.kind === 'out') boundaries.push({ atMs: condition.atUtc, type: 'activation' })
    else if (condition.kind === 'out_end') boundaries.push({ atMs: condition.atUtc, type: 'deactivation' })
  }
  return boundaries
}

/** Jen uzavřené páry. Chybějící deaktivace se sem nedomýšlí až do nowMs. */
export function closedOutRanges(events: readonly OutBoundaryEvent[], nowMs: number): Array<{ startMs: number; endMs: number }> {
  const sorted = [...events].sort((left, right) => left.atMs - right.atMs)
  const ranges: Array<{ startMs: number; endMs: number }> = []
  let pending: number | null = null
  for (const event of sorted) {
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

/** Začátek, ke kterému v historii není deaktivace. */
export function openOutStarts(events: readonly OutBoundaryEvent[], nowMs: number): number[] {
  const sorted = [...events].sort((left, right) => left.atMs - right.atMs)
  let pending: number | null = null
  for (const event of sorted) {
    if (event.atMs > nowMs) break
    if (event.type === 'activation') pending = event.atMs
    else pending = null
  }
  return pending == null ? [] : [pending]
}

/** Konec souvislého záznamu. První mezera otevřený úsek zastaví. */
export function continuousRecordEnd(intervals: readonly DrivingBreakInterval[], fromMs: number, nowMs: number): number {
  const spans = intervals
    .map((interval) => ({ startMs: interval.startMs, endMs: Math.min(interval.endMs, nowMs) }))
    .filter((interval) => interval.endMs > interval.startMs && interval.endMs > fromMs)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  let cursor = fromMs
  for (const span of spans) {
    if (span.endMs <= cursor) continue
    if (span.startMs > cursor) break
    cursor = span.endMs
  }
  return cursor
}

export type UndeterminedDriving = { startMs: number; endMs: number }

export function evaluateRecordedOut(input: {
  imported: readonly DrivingBreakInterval[]
  vehicle: readonly DrivingBreakInterval[]
  manual?: readonly DrivingBreakInterval[]
  cardConditions?: readonly { kind: string; atUtc: number }[]
  vehicleEvents?: readonly { minuteStartUtc: number; type: 'activation' | 'deactivation' }[]
  nowMs: number
}): { intervals: DrivingBreakInterval[]; undetermined: UndeterminedDriving[] } {
  const imported = applySourceOut(input.imported, cardOutBoundaries(input.cardConditions), input.nowMs)
  const vehicle = applySourceOut(input.vehicle, vehicleOutBoundaries(input.vehicleEvents ?? []), input.nowMs)
  return {
    intervals: mergeSources(imported.intervals, vehicle.intervals, input.manual ?? []),
    undetermined: [...imported.undetermined, ...vehicle.undetermined],
  }
}

function applySourceOut(
  intervals: readonly DrivingBreakInterval[],
  events: readonly OutBoundaryEvent[],
  nowMs: number,
): { intervals: DrivingBreakInterval[]; undetermined: UndeterminedDriving[] } {
  let next = evaluateOutDrivingAsWork(intervals, closedOutRanges(events, nowMs))
  const undetermined: UndeterminedDriving[] = []
  for (const startMs of openOutStarts(events, nowMs)) {
    const limitMs = continuousRecordEnd(intervals, startMs, nowMs)
    if (limitMs > startMs) next = evaluateOutDrivingAsWork(next, [{ startMs, endMs: limitMs }])
    for (const interval of next) {
      if (interval.kind !== 'driving') continue
      const fromMs = Math.max(interval.startMs, limitMs)
      const toMs = Math.min(interval.endMs, nowMs)
      if (toMs > fromMs) undetermined.push({ startMs: fromMs, endMs: toMs })
    }
  }
  return { intervals: next, undetermined }
}

function mergeSources(
  imported: readonly DrivingBreakInterval[],
  vehicle: readonly DrivingBreakInterval[],
  manual: readonly DrivingBreakInterval[],
): DrivingBreakInterval[] {
  const placed = imported.map((interval) => ({ ...interval }))
  for (const interval of vehicle) placed.push(...outsideRecorded(interval, placed))
  for (const interval of manual) placed.push(...outsideRecorded(interval, placed))
  placed.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  return placed
}

function outsideRecorded(interval: DrivingBreakInterval, blocked: readonly DrivingBreakInterval[]): DrivingBreakInterval[] {
  let pieces: DrivingBreakInterval[] = [{ ...interval }]
  for (const block of blocked) {
    const next: DrivingBreakInterval[] = []
    for (const piece of pieces) {
      if (block.endMs <= piece.startMs || block.startMs >= piece.endMs) {
        next.push(piece)
        continue
      }
      if (piece.startMs < block.startMs) next.push({ kind: piece.kind, startMs: piece.startMs, endMs: block.startMs })
      if (piece.endMs > block.endMs) next.push({ kind: piece.kind, startMs: block.endMs, endMs: piece.endMs })
    }
    pieces = next
  }
  return pieces.filter((piece) => piece.endMs > piece.startMs)
}

export function undeterminedOverlaps(undetermined: readonly UndeterminedDriving[], fromMs: number, toMs: number): boolean {
  return undetermined.some((item) => item.startMs < toMs && item.endMs > fromMs)
}

/** Zbývající řízení závisí na úseku, u kterého chybí doložený konec OUT. Přestávka ne. */
export function drivingRemainderUndocumented(
  intervals: readonly DrivingBreakInterval[],
  undetermined: readonly UndeterminedDriving[],
  nowMs: number,
): boolean {
  if (undetermined.length === 0) return false
  return undeterminedOverlaps(undetermined, currentDrivingBlockStartMs(intervals, nowMs), nowMs)
}

/** Nové intervaly. Vstup ani záznam karty se nepřepisuje. Mění se jen jízda uvnitř doloženého OUT. */
export function evaluateOutDrivingAsWork(
  intervals: readonly DrivingBreakInterval[],
  ranges: readonly { startMs: number; endMs: number }[],
): DrivingBreakInterval[] {
  const active = ranges.filter((range) => range.endMs > range.startMs).sort((left, right) => left.startMs - right.startMs)
  const evaluated: DrivingBreakInterval[] = []
  for (const interval of intervals) {
    if (interval.kind !== 'driving' || active.length === 0) {
      evaluated.push({ ...interval })
      continue
    }
    let cursor = interval.startMs
    for (const range of active) {
      if (range.endMs <= cursor || range.startMs >= interval.endMs) continue
      const cutStart = Math.max(range.startMs, cursor)
      const cutEnd = Math.min(range.endMs, interval.endMs)
      if (cutStart > cursor) evaluated.push({ kind: 'driving', startMs: cursor, endMs: cutStart })
      if (cutEnd > cutStart) evaluated.push({ kind: 'work', startMs: cutStart, endMs: cutEnd })
      cursor = cutEnd
    }
    if (cursor < interval.endMs) evaluated.push({ kind: 'driving', startMs: cursor, endMs: interval.endMs })
  }
  return evaluated
}
