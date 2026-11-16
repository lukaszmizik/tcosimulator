/**
 * Příprava 24hodinového výtisku karty řidiče 1 pro zvolený kalendářní den UTC.
 * Doložené činnosti berou příznak původu z převodu časové osy karty.
 * Ruční buffer se skládá zvlášť: razítko země je jen bod a činnost neukončí.
 * Při překryvu zůstává doložená činnost z DDD. Ruční záznam doplní jen volný čas.
 * Neznámý ani nepokrytý čas se do odpočinku nepřičte. Součty jsou až z výsledných úseků.
 */

import { segmentToMsUtc } from '../CardLogic'
import type { EditorActivityId, ManualEntrySegment } from '../TachoTypes'
import { buildSimulatorSlotGraph } from 'tacho-viewer-slot-graph'

const DAY_MS = 24 * 60 * 60 * 1000

export type Driver1Print24hActivityId = Exclude<EditorActivityId, 'START_COUNTRY' | 'END_COUNTRY'> | 'DRIVING'

export type Driver1PrintCardActivity = {
  kind: 'driving' | 'work' | 'availability' | 'rest' | 'unknown'
  startUtc: number
  endUtc: number
  isManualEntry?: boolean
}

export type Driver1Print24hActivity = {
  activityId: Driver1Print24hActivityId
  startMs: number
  endMs: number
  /** Pravda jen u úseku, který vznikl z ručního doplnění. */
  isManualEntry: boolean
}

export type Driver1Print24hSums = {
  drivingMs: number
  workMs: number
  availabilityMs: number
  restMs: number
}

export type Driver1Print24hDay = {
  dayStartMs: number
  dayEndMs: number
  activities: Driver1Print24hActivity[]
  sums: Driver1Print24hSums
}

type Piece = Driver1Print24hActivity

function utcDayStart(dayUtc: number): number {
  const d = new Date(dayUtc)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function isBufferActivity(activityId: EditorActivityId): activityId is Exclude<Driver1Print24hActivityId, 'DRIVING'> {
  return activityId === 'REST' || activityId === 'WORK' || activityId === 'AVAILABILITY' || activityId === 'UNKNOWN'
}

/** Výtisk řidiče 1 čte činnosti karty vložené ve šachtě 1. */
export function driver1PrintCardActivities<T>(
  slot1: readonly T[] | null | undefined,
): readonly T[] {
  return slot1 ?? []
}

/** UTC půlnoci dnů, které protínají doloženou činnost. Ruční příznak den nepřidá. */
export function utcDaysIntersectingCardActivities(
  activities: readonly { startUtc: number; endUtc: number; isManualEntry?: boolean }[],
): number[] {
  const days = new Set<number>()
  for (const activity of activities) {
    if (activity.isManualEntry || !(activity.endUtc > activity.startUtc)) continue
    let cursor = utcDayStart(activity.startUtc)
    while (cursor < activity.endUtc) {
      days.add(cursor)
      cursor += DAY_MS
    }
  }
  return [...days].sort((a, b) => b - a)
}

function activityIdFromGraphType(type: string): Driver1Print24hActivityId | null {
  if (type === 'řízení') return 'DRIVING'
  if (type === 'práce') return 'WORK'
  if (type === 'pohotovost') return 'AVAILABILITY'
  if (type === 'neznámá') return 'UNKNOWN'
  if (type === 'odpočinek' || type === 'odpočinek>24h' || type === 'odpočinek>45h') return 'REST'
  return null
}

function cardPieces(activities: readonly Driver1PrintCardActivity[]): Piece[] {
  if (activities.length === 0) return []
  const graph = buildSimulatorSlotGraph({
    activities: activities.map((activity) => ({
      kind: activity.kind,
      startUtc: activity.startUtc,
      endUtc: activity.endUtc,
      isManualEntry: activity.isManualEntry === true,
    })),
    manualSegments: [],
    simulatedMinutes: [],
    locations: [],
    currentSlot: 1,
  })
  const blocks = graph.days.flatMap((day) => day.activities) as Array<{
    type: string
    startMs: number
    endMs: number
    isManualEntry?: boolean
  }>
  const pieces: Piece[] = []
  for (const block of blocks) {
    const activityId = activityIdFromGraphType(block.type)
    if (!activityId || block.endMs <= block.startMs) continue
    pieces.push({
      activityId,
      startMs: block.startMs,
      endMs: block.endMs,
      isManualEntry: block.isManualEntry === true,
    })
  }
  return pieces
}

function clipPiece(piece: Piece, dayStartMs: number, dayEndMs: number): Piece | null {
  const startMs = Math.max(piece.startMs, dayStartMs)
  const endMs = Math.min(piece.endMs, dayEndMs)
  if (endMs <= startMs) return null
  return { ...piece, startMs, endMs }
}

function subtractPiece(piece: Piece, blockers: readonly Piece[]): Piece[] {
  let pieces: Piece[] = [piece]
  for (const block of blockers) {
    const next: Piece[] = []
    for (const item of pieces) {
      if (block.endMs <= item.startMs || block.startMs >= item.endMs) {
        next.push(item)
        continue
      }
      if (item.startMs < block.startMs) next.push({ ...item, endMs: block.startMs })
      if (item.endMs > block.endMs) next.push({ ...item, startMs: block.endMs })
    }
    pieces = next
  }
  return pieces.filter((item) => item.endMs > item.startMs)
}

function place(incoming: readonly Piece[], occupied: readonly Piece[]): Piece[] {
  const placed = [...occupied]
  const sorted = [...incoming].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  for (const piece of sorted) {
    placed.push(...subtractPiece(piece, placed))
  }
  return placed
}

function mergeAdjacent(items: readonly Piece[]): Piece[] {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const merged: Piece[] = []
  for (const item of sorted) {
    const last = merged[merged.length - 1]
    if (
      last &&
      last.endMs === item.startMs &&
      last.activityId === item.activityId &&
      last.isManualEntry === item.isManualEntry
    ) {
      last.endMs = item.endMs
    } else {
      merged.push({ ...item })
    }
  }
  return merged
}

function bufferPieces(buffer: readonly ManualEntrySegment[], dayStartMs: number, dayEndMs: number): Piece[] {
  const points: Array<{
    activityId: Exclude<Driver1Print24hActivityId, 'DRIVING'>
    startMs: number
    isManualEntry: boolean
  }> = []
  for (const seg of buffer) {
    if (!isBufferActivity(seg.activityId)) continue
    points.push({
      activityId: seg.activityId,
      startMs: segmentToMsUtc(seg),
      isManualEntry: seg.isManualEntry === true,
    })
  }
  points.sort((a, b) => a.startMs - b.startMs)

  const pieces: Piece[] = []
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!
    const next = points[i + 1]
    if (!next || next.startMs <= current.startMs) continue
    const clipped = clipPiece(
      {
        activityId: current.activityId,
        startMs: current.startMs,
        endMs: next.startMs,
        isManualEntry: current.isManualEntry,
      },
      dayStartMs,
      dayEndMs,
    )
    if (clipped) pieces.push(clipped)
  }
  return pieces
}

function sumsOf(activities: readonly Piece[]): Driver1Print24hSums {
  const sums: Driver1Print24hSums = { drivingMs: 0, workMs: 0, availabilityMs: 0, restMs: 0 }
  for (const item of activities) {
    const durationMs = item.endMs - item.startMs
    if (item.activityId === 'DRIVING') sums.drivingMs += durationMs
    else if (item.activityId === 'WORK') sums.workMs += durationMs
    else if (item.activityId === 'AVAILABILITY') sums.availabilityMs += durationMs
    else if (item.activityId === 'REST') sums.restMs += durationMs
  }
  return sums
}

/**
 * Vrátí nepřekrývající se úseky zvoleného UTC dne.
 * Konec ručního úseku je čas následující činnosti. Poslední záznam bez další změny se vynechá.
 */
export function prepareDriver1Print24hUtc(
  dayUtc: number,
  buffer: readonly ManualEntrySegment[],
  cardActivities: readonly Driver1PrintCardActivity[] = [],
): Driver1Print24hDay {
  const dayStartMs = utcDayStart(dayUtc)
  const dayEndMs = dayStartMs + DAY_MS
  const fromCard = cardPieces(cardActivities)
    .map((piece) => clipPiece(piece, dayStartMs, dayEndMs))
    .filter((piece): piece is Piece => piece != null)
  const documented = place(fromCard.filter((piece) => !piece.isManualEntry), [])
  const withCardManual = place(fromCard.filter((piece) => piece.isManualEntry), documented)
  const activities = mergeAdjacent(place(bufferPieces(buffer, dayStartMs, dayEndMs), withCardManual))
  return { dayStartMs, dayEndMs, activities, sums: sumsOf(activities) }
}
