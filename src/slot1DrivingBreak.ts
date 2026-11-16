/**
 * Vstup do drivingBreakDisplay pro řidiče ve šachtě 1.
 * Uzavřené minuty bereme z historie karty. Otevřenou minutu skládáme
 * ze sekundových vzorků v jejich pořadí. Po přechodu na další minutu
 * vzorky té minuty nahrazuje jeden uzavřený záznam.
 */

import type { ActivityHistoryEntry, ActivityKind, ManualEntrySegment, SecondActivitySnapshot } from './TachoTypes'
import { activityRecordedForCard, manualIntervalsOutside } from './slot1DddDrivingBreak.ts'
import {
  drivingBreakDisplay,
  type DrivingBreakActivity,
  type DrivingBreakDisplay,
  type DrivingBreakInterval,
} from './drivingBreakDisplay.ts'

const MINUTE_MS = 60_000
const SECOND_MS = 1_000

export function capSlot1DrivingBreak(
  display: DrivingBreakDisplay,
  limits: { dailyRemainingMs: number; weeklyRemainingMs: number; fortnightRemainingMs: number },
): DrivingBreakDisplay {
  const cap = (value: number) => Math.max(
    0,
    Math.min(value, limits.dailyRemainingMs, limits.weeklyRemainingMs, limits.fortnightRemainingMs),
  )
  if (display.phase === 'driving') {
    return { ...display, remainingDrivingMs: cap(display.remainingDrivingMs) }
  }
  return {
    ...display,
    drivingIfStartNowMs: cap(display.drivingIfStartNowMs),
    drivingAfterBreakMs: cap(display.drivingAfterBreakMs),
  }
}

export function buildSlot1VirtualCardDrivingBreak(input: {
  cardHistory: readonly ActivityHistoryEntry[]
  secondSamples: readonly SecondActivitySnapshot[]
  nowMs: number
}): DrivingBreakDisplay {
  return drivingBreakDisplay(buildSlot1DrivingBreakIntervals(input), input.nowMs)
}

/**
 * Virtuální karta jednoho řidiče: uzavřené minuty a otevřená minuta z adaptéru,
 * potvrzené ruční doplnění jen do mezer. Chybějící čas zůstane mezerou.
 * driverSlot 2 čte činnost zaznamenanou pro pravou šachtu.
 */
export function buildSlot1VirtualCounterIntervals(input: {
  cardHistory: readonly ActivityHistoryEntry[]
  manual: readonly ManualEntrySegment[]
  secondSamples: readonly SecondActivitySnapshot[]
  nowMs: number
  /** 1 je levá šachta. 2 čte činnost zaznamenanou pro pravou šachtu, pokud záznam nemá číslo karty. */
  driverSlot?: 1 | 2
  /** Identita karty. Má přednost před aktuální šachtou, když je na záznamu z doby zápisu. */
  cardId?: string | null
}): DrivingBreakInterval[] {
  const card = buildSlot1DrivingBreakIntervals({ ...input, driverSlot: input.driverSlot ?? 1, cardId: input.cardId })
  const manual = manualIntervalsOutside(input.manual, card, input.nowMs)
  return [...card, ...manual].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
}

export function buildSlot1DrivingBreakIntervals(input: {
  cardHistory: readonly ActivityHistoryEntry[]
  secondSamples: readonly SecondActivitySnapshot[]
  nowMs: number
  driverSlot?: 1 | 2
  cardId?: string | null
}): DrivingBreakInterval[] {
  const driverSlot = input.driverSlot ?? 1
  const cardId = input.cardId
  const openMinute = Math.floor(input.nowMs / MINUTE_MS) * MINUTE_MS
  const closedMinutes = new Set<number>()
  const intervals: DrivingBreakInterval[] = []

  const closed = [...input.cardHistory].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
  for (const entry of closed) {
    if (entry.minuteStartUtc >= openMinute || closedMinutes.has(entry.minuteStartUtc)) continue
    closedMinutes.add(entry.minuteStartUtc)
    const kind = activityKind(activityRecordedForCard(entry, cardId, driverSlot))
    if (!kind) continue
    intervals.push({
      kind,
      startMs: entry.minuteStartUtc,
      endMs: entry.minuteStartUtc + MINUTE_MS,
    })
  }

  const openRecord = closed.find((entry) => entry.minuteStartUtc === openMinute)
  if (openRecord) {
    const kind = activityKind(activityRecordedForCard(openRecord, cardId, driverSlot))
    if (kind) {
      intervals.push({
        kind,
        startMs: openMinute,
        endMs: Math.min(openMinute + MINUTE_MS, input.nowMs),
      })
    }
    return intervals
  }

  intervals.push(...openMinuteFromSamples(input.secondSamples, openMinute, input.nowMs, driverSlot, cardId))
  return intervals
}

function openMinuteFromSamples(
  samples: readonly SecondActivitySnapshot[],
  openMinute: number,
  nowMs: number,
  driverSlot: 1 | 2,
  cardId: string | null | undefined,
): DrivingBreakInterval[] {
  const inMinute = samples
    .filter((sample) => {
      const minute = Math.floor(sample.timestampUtc / MINUTE_MS) * MINUTE_MS
      return minute === openMinute && sample.timestampUtc > openMinute && sample.timestampUtc <= nowMs
    })
    .sort((a, b) => a.timestampUtc - b.timestampUtc)

  const runs: DrivingBreakInterval[] = []
  for (const sample of inMinute) {
    const kind = activityKind(activityRecordedForCard(sample, cardId, driverSlot))
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

function activityKind(kind: ActivityKind): DrivingBreakActivity | null {
  if (kind === 'driving') return 'driving'
  if (kind === 'rest') return 'rest'
  if (kind === 'otherWork') return 'work'
  if (kind === 'availability') return 'availability'
  return null
}
