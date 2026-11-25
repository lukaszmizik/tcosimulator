import { segmentToMsUtc } from './CardLogic'
import type { ManualEntrySegment, SecondActivitySnapshot } from './TachoTypes'

export type VehicleCheckResult = 'none' | 'info' | 'warning'

export function evaluatePreDepartureWork(
  cardId: string,
  insertedAtUtc: number,
  departureUtc: number,
  manualEntries: ManualEntrySegment[],
  secondHistory: Iterable<SecondActivitySnapshot>,
): VehicleCheckResult {
  let shiftStartUtc = insertedAtUtc
  const intervals: { start: number; end: number }[] = []

  for (let i = manualEntries.length - 1; i >= 0; i--) {
    const entry = manualEntries[i]!
    const timestamp = segmentToMsUtc(entry)
    if (timestamp > departureUtc) continue
    if (entry.activityId === 'END_COUNTRY') {
      shiftStartUtc = Math.max(insertedAtUtc, timestamp)
      break
    }
    if (entry.activityId === 'START_COUNTRY') {
      shiftStartUtc = timestamp
      break
    }
  }

  for (let i = 0; i < manualEntries.length; i++) {
    const entry = manualEntries[i]!
    if (entry.activityId !== 'WORK' || !entry.isManualEntry) continue
    const next = manualEntries[i + 1]
    const start = Math.max(shiftStartUtc, segmentToMsUtc(entry))
    const end = Math.min(departureUtc, insertedAtUtc, next ? segmentToMsUtc(next) : insertedAtUtc)
    if (end > start) intervals.push({ start, end })
  }

  for (const sample of secondHistory) {
    if (sample.timestampUtc > departureUtc) continue
    if (sample.driver1CardId !== cardId || sample.driver1 !== 'otherWork' || sample.speed > 0) continue
    const start = Math.max(insertedAtUtc, shiftStartUtc, sample.timestampUtc - 1000)
    const end = sample.timestampUtc
    if (end > start) intervals.push({ start, end })
  }

  intervals.sort((a, b) => a.start - b.start)
  let workMs = 0
  let countedUntil = -Infinity
  for (const { start, end } of intervals) {
    workMs += Math.max(0, end - Math.max(start, countedUntil))
    countedUntil = Math.max(countedUntil, end)
  }

  if (workMs === 0) return 'warning'
  return workMs < 4 * 60_000 ? 'info' : 'none'
}
