/**
 * Vstup do drivingBreakDisplay pro DDD kartu ve šachtě 1.
 * Čte jen záznam vybraný podle cardNumber. Společnou historii tachografu nepoužívá.
 *
 * Pořadí při stejném čase:
 * 1. original.activities zůstávají celé. Nic je neořezává a pole se neupravuje.
 * 2. Uzavřené workingActivities doplní jen čas, který originál nemá.
 *    Minuta už uložená v originálu se podruhé nepřidá.
 * 3. Ruční doplnění vyplní jen zbylé mezery. Deklarace nepřepíše ani soubor, ani uzavřenou minutu.
 * 4. Sekundy otevřené minuty se použijí, jen když pro ni není uzavřený pracovní záznam
 *    a čas ještě není pokrytý vyšším zdrojem.
 *
 * work je jiná práce. unknown, razítka zemí a mezery nejsou odpočinek.
 * Ruční úsek bez následujícího segmentu nemá známý konec, proto se nedomýšlí.
 * Historický slot 1 i 2 patří držiteli karty a oba se počítají.
 * Osádka, trajekt a OUT se v tomto výpočtu nerozlišují.
 */

import type { DddCardRecord } from './dddCardSession'
import type { ActivityHistoryEntry, ActivityKind, EditorActivityId, ManualEntrySegment, SecondActivitySnapshot } from './TachoTypes'
import type { DddParsedActivity } from './types/tachoViewerDddMapper'
import { firstUncoveredInterval, weekStartUtc } from './slot1DddDailyRemaining'
import {
  drivingBreakDisplay,
  type DrivingBreakActivity,
  type DrivingBreakDisplay,
  type DrivingBreakInterval,
} from './drivingBreakDisplay.ts'

const MINUTE_MS = 60_000
const SECOND_MS = 1_000

/**
 * Činnost patří kartě, která v šachtě byla při zápisu.
 * Když záznam číslo karty nemá, zůstává dosavadní čtení podle aktuální šachty.
 */
export function activityRecordedForCard(
  entry: {
    driver1: ActivityKind
    driver2: ActivityKind
    driver1CardId?: string | null
    driver2CardId?: string | null
  },
  cardId: string | null | undefined,
  fallbackSlot: 1 | 2,
): ActivityKind {
  if (cardId && entry.driver1CardId === cardId) return entry.driver1
  if (cardId && entry.driver2CardId === cardId) return entry.driver2
  return fallbackSlot === 2 ? entry.driver2 : entry.driver1
}

function segmentStartUtc(segment: ManualEntrySegment): number {
  return Date.UTC(segment.year, segment.month - 1, segment.day, segment.hour, segment.minute)
}

export type Slot1DddDrivingBreakIntervals = {
  intervals: DrivingBreakInterval[]
  /** Začátky ručních činností, které nemají další segment a tedy známý konec. */
  unboundedManualStartMs: readonly number[]
}

export function buildSlot1DddDrivingBreak(input: {
  cards: Readonly<Record<string, DddCardRecord>>
  cardNumber: string
  secondSamples: readonly SecondActivitySnapshot[]
  nowMs: number
  /** Činnost zaznamenaná pro fyzickou šachtu, ve které karta právě je. Historický slot ve výpisu to není. */
  recordedDriver?: 1 | 2
}): DrivingBreakDisplay | null {
  const card = input.cards[input.cardNumber]
  if (!card || card.cardNumber !== input.cardNumber) return null
  return drivingBreakDisplay(intervalsForCard(card, input.secondSamples, input.nowMs, input.recordedDriver ?? 1).intervals, input.nowMs)
}

export type StoredManualRest = {
  startMs: number
  endMs: number | null
}

export type Slot1WeekCoverageDebug = {
  cardNumber: string
  weekStartMs: number
  nowMs: number
  manualRests: StoredManualRest[]
  hole: { startMs: number; endMs: number; reason: 'gap' | 'unknown' } | null
}

/** Diagnostika aktuálního týdne pro kartu, jejíž číslo výpočet právě čte. */
export function describeSlot1WeekCoverage(input: {
  card: DddCardRecord
  intervals: readonly DrivingBreakInterval[]
  nowMs: number
}): Slot1WeekCoverageDebug {
  const weekStartMs = weekStartUtc(input.nowMs)
  const hole = firstUncoveredInterval(input.intervals, weekStartMs, input.nowMs)
  return {
    cardNumber: input.card.cardNumber,
    weekStartMs,
    nowMs: input.nowMs,
    manualRests: storedManualRests(input.card.workingManual),
    hole: hole ? { ...hole, reason: holeReason(input.card, hole.startMs, hole.endMs) } : null,
  }
}

function storedManualRests(segments: readonly ManualEntrySegment[]): StoredManualRest[] {
  const sorted = [...segments].sort((a, b) => segmentStartUtc(a) - segmentStartUtc(b))
  const rests: StoredManualRest[] = []
  for (let index = 0; index < sorted.length; index += 1) {
    const segment = sorted[index]!
    if (segment.activityId !== 'REST') continue
    const startMs = segmentStartUtc(segment)
    const next = sorted[index + 1]
    if (!next) {
      rests.push({ startMs, endMs: null })
      continue
    }
    const endMs = segmentStartUtc(next)
    if (endMs <= startMs) continue
    rests.push({ startMs, endMs })
  }
  return rests
}

function holeReason(card: DddCardRecord, startMs: number, endMs: number): 'gap' | 'unknown' {
  const originalUnknown = card.original.activities.some(
    (activity) => activity.kind === 'unknown' && activity.startUtc < endMs && activity.endUtc > startMs,
  )
  if (originalUnknown) return 'unknown'
  const manual = [...card.workingManual].sort((a, b) => segmentStartUtc(a) - segmentStartUtc(b))
  for (let index = 0; index < manual.length; index += 1) {
    const segment = manual[index]!
    if (segment.activityId !== 'UNKNOWN') continue
    const unknownStart = segmentStartUtc(segment)
    const next = manual[index + 1]
    const unknownEnd = next ? segmentStartUtc(next) : endMs
    if (unknownStart < endMs && unknownEnd > startMs) return 'unknown'
  }
  return 'gap'
}

export function buildSlot1DddDrivingBreakIntervals(input: {
  cards: Readonly<Record<string, DddCardRecord>>
  cardNumber: string
  secondSamples: readonly SecondActivitySnapshot[]
  nowMs: number
  /** Činnost zaznamenaná pro fyzickou šachtu, ve které karta právě je. Historický slot ve výpisu to není. */
  recordedDriver?: 1 | 2
}): Slot1DddDrivingBreakIntervals {
  const card = input.cards[input.cardNumber]
  if (!card || card.cardNumber !== input.cardNumber) {
    return { intervals: [], unboundedManualStartMs: [] }
  }
  return intervalsForCard(card, input.secondSamples, input.nowMs, input.recordedDriver ?? 1)
}

function intervalsForCard(
  card: DddCardRecord,
  secondSamples: readonly SecondActivitySnapshot[],
  nowMs: number,
  recordedDriver: 1 | 2,
): Slot1DddDrivingBreakIntervals {
  const openMinute = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS
  const original = originalIntervals(card.original.activities, nowMs)
  const working = workingIntervals(card.workingActivities, openMinute, nowMs, recordedDriver, card.cardNumber)
  const manual = manualIntervals(card.workingManual, nowMs)
  const openMinuteIsClosed = card.workingActivities.some((entry) => entry.minuteStartUtc === openMinute)

  const placed: DrivingBreakInterval[] = []
  for (const interval of original) placed.push(interval)
  for (const interval of working) placed.push(...outside(interval, placed))
  for (const interval of manual.intervals) placed.push(...outside(interval, placed))
  if (!openMinuteIsClosed) {
    for (const interval of openMinuteFromSamples(secondSamples, openMinute, nowMs, recordedDriver, card.cardNumber)) {
      placed.push(...outside(interval, placed))
    }
  }

  placed.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  return { intervals: placed, unboundedManualStartMs: manual.unboundedManualStartMs }
}

function originalIntervals(activities: readonly DddParsedActivity[], nowMs: number): DrivingBreakInterval[] {
  const sorted = [...activities].sort((a, b) => a.startUtc - b.startUtc || a.endUtc - b.endUtc)
  const placed: DrivingBreakInterval[] = []
  for (const activity of sorted) {
    // activity.slot je historická šachta ve výpisu. Nerozhoduje, jestli se činnost započte.
    const kind = originalKind(activity.kind)
    const endMs = Math.min(activity.endUtc, nowMs)
    if (!kind || endMs <= activity.startUtc) continue
    placed.push(...outside({ kind, startMs: activity.startUtc, endMs }, placed))
  }
  return placed
}

function workingIntervals(
  entries: readonly ActivityHistoryEntry[],
  openMinute: number,
  nowMs: number,
  recordedDriver: 1 | 2,
  cardId: string,
): DrivingBreakInterval[] {
  const seen = new Set<number>()
  const sorted = [...entries].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
  const intervals: DrivingBreakInterval[] = []
  for (const entry of sorted) {
    if (seen.has(entry.minuteStartUtc) || entry.minuteStartUtc > openMinute) continue
    seen.add(entry.minuteStartUtc)
    const kind = sessionKind(activityRecordedForCard(entry, cardId, recordedDriver))
    if (!kind) continue
    const endMs = entry.minuteStartUtc === openMinute
      ? Math.min(openMinute + MINUTE_MS, nowMs)
      : entry.minuteStartUtc + MINUTE_MS
    if (endMs <= entry.minuteStartUtc) continue
    intervals.push({ kind, startMs: entry.minuteStartUtc, endMs })
  }
  return intervals
}

/** Ruční úseky jen tam, kde vyšší záznam čas ještě nemá. Stejný úsek se nezapočte dvakrát. */
export function manualIntervalsOutside(
  segments: readonly ManualEntrySegment[],
  blocked: readonly DrivingBreakInterval[],
  nowMs: number,
): DrivingBreakInterval[] {
  const placed: DrivingBreakInterval[] = []
  for (const interval of manualIntervals(segments, nowMs).intervals) {
    placed.push(...outside(interval, [...blocked, ...placed]))
  }
  return placed
}

function manualIntervals(segments: readonly ManualEntrySegment[], nowMs: number): {
  intervals: DrivingBreakInterval[]
  unboundedManualStartMs: readonly number[]
} {
  const sorted = [...segments].sort((a, b) => segmentStartUtc(a) - segmentStartUtc(b))
  const intervals: DrivingBreakInterval[] = []
  const unboundedManualStartMs: number[] = []
  for (let index = 0; index < sorted.length; index += 1) {
    const segment = sorted[index]!
    const kind = manualKind(segment.activityId)
    const startMs = segmentStartUtc(segment)
    const next = sorted[index + 1]
    if (!next) {
      if (kind && startMs <= nowMs) unboundedManualStartMs.push(startMs)
      continue
    }
    const endMs = Math.min(segmentStartUtc(next), nowMs)
    if (!kind || endMs <= startMs) continue
    intervals.push({ kind, startMs, endMs })
  }
  return { intervals, unboundedManualStartMs }
}

function openMinuteFromSamples(
  samples: readonly SecondActivitySnapshot[],
  openMinute: number,
  nowMs: number,
  recordedDriver: 1 | 2,
  cardId: string,
): DrivingBreakInterval[] {
  const inMinute = samples
    .filter((sample) => {
      const minute = Math.floor(sample.timestampUtc / MINUTE_MS) * MINUTE_MS
      return minute === openMinute && sample.timestampUtc > openMinute && sample.timestampUtc <= nowMs
    })
    .sort((a, b) => a.timestampUtc - b.timestampUtc)

  const runs: DrivingBreakInterval[] = []
  for (const sample of inMinute) {
    const kind = sessionKind(activityRecordedForCard(sample, cardId, recordedDriver))
    const startMs = Math.max(openMinute, sample.timestampUtc - SECOND_MS)
    const endMs = sample.timestampUtc
    if (!kind || endMs <= startMs) continue
    const previous = runs[runs.length - 1]
    if (previous && previous.kind === kind && previous.endMs === startMs) {
      previous.endMs = endMs
      continue
    }
    runs.push({ kind, startMs, endMs })
  }
  return runs
}

function outside(interval: DrivingBreakInterval, blocked: readonly DrivingBreakInterval[]): DrivingBreakInterval[] {
  let pieces: DrivingBreakInterval[] = [interval]
  for (const block of blocked) {
    const next: DrivingBreakInterval[] = []
    for (const piece of pieces) {
      if (block.endMs <= piece.startMs || block.startMs >= piece.endMs) {
        next.push(piece)
        continue
      }
      if (piece.startMs < block.startMs) {
        next.push({ kind: piece.kind, startMs: piece.startMs, endMs: block.startMs })
      }
      if (piece.endMs > block.endMs) {
        next.push({ kind: piece.kind, startMs: block.endMs, endMs: piece.endMs })
      }
    }
    pieces = next
  }
  return pieces.filter((piece) => piece.endMs > piece.startMs)
}

function originalKind(kind: DddParsedActivity['kind']): DrivingBreakActivity | null {
  if (kind === 'driving') return 'driving'
  if (kind === 'rest') return 'rest'
  if (kind === 'work') return 'work'
  if (kind === 'availability') return 'availability'
  return null
}

function sessionKind(kind: ActivityKind): DrivingBreakActivity | null {
  if (kind === 'driving') return 'driving'
  if (kind === 'rest') return 'rest'
  if (kind === 'otherWork') return 'work'
  if (kind === 'availability') return 'availability'
  return null
}

function manualKind(activityId: EditorActivityId): DrivingBreakActivity | null {
  if (activityId === 'REST') return 'rest'
  if (activityId === 'WORK') return 'work'
  if (activityId === 'AVAILABILITY') return 'availability'
  return null
}