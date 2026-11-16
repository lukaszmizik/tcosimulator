/**
 * Vstup grafu pro vloženou kartu v simulátoru.
 * Na rozdíl od cardToGraph ponechává činnosti historické šachty 2 i neznámé úseky
 * a nemění jejich UTC meze. Běžný cardToGraph se tím nemění.
 */

import { weekStartMs } from '../lib/clock'
import type { ManualEntrySegment } from '../TachoTypes'
import { activitiesByDay, type ActivityType, type CountryMarker, type ParsedActivity } from '../workWeekTxtParser'

export type SimulatorGraphKind = 'driving' | 'work' | 'availability' | 'rest' | 'unknown'

export type SimulatorGraphActivity = {
  kind: SimulatorGraphKind
  startUtc: number
  endUtc: number
  isManualEntry?: boolean
  slot?: 1 | 2
}

export type SimulatorGraphManualSegment = {
  activityId: 'REST' | 'WORK' | 'AVAILABILITY' | 'DRIVING' | 'UNKNOWN' | 'START_COUNTRY' | 'END_COUNTRY'
  day: number
  month: number
  year: number
  hour: number
  minute: number
  countryCode?: string
  isManualEntry?: boolean
}

export type SimulatorGraphLocation = {
  recordedAtUtc: number
  recordType?: string
  countryCode?: string
}

export type SimulatorGraphMinute = {
  minuteStartUtc: number
  kind: SimulatorGraphKind
}

export type SimulatorSlotGraphInput = {
  activities: SimulatorGraphActivity[]
  manualSegments: SimulatorGraphManualSegment[]
  simulatedMinutes: SimulatorGraphMinute[]
  locations: SimulatorGraphLocation[]
  /** Šachta, ve které je karta právě vložená. Nemění historický slot původních činností. */
  currentSlot: 1 | 2
}

export type SimulatorSlotGraph = {
  days: ReturnType<typeof activitiesByDay>
  countryMarkers: CountryMarker[]
  manualEntryBuffer: ManualEntrySegment[]
}

export function utcWeekStart(ms: number): number {
  return weekStartMs(ms, 'utc')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function utcParts(ms: number) {
  const date = new Date(ms)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  }
}

function segmentUtc(segment: SimulatorGraphManualSegment): number {
  return Date.UTC(segment.year, segment.month - 1, segment.day, segment.hour, segment.minute)
}

function activityType(kind: SimulatorGraphKind, durationMinutes: number): ActivityType {
  if (kind === 'driving') return 'řízení'
  if (kind === 'work') return 'práce'
  if (kind === 'availability') return 'pohotovost'
  if (kind === 'unknown') return 'neznámá'
  if (durationMinutes >= 45 * 60) return 'odpočinek>45h'
  if (durationMinutes > 24 * 60) return 'odpočinek>24h'
  return 'odpočinek'
}

function editorActivity(kind: SimulatorGraphKind): ManualEntrySegment['activityId'] {
  if (kind === 'driving') return 'DRIVING'
  if (kind === 'work') return 'WORK'
  if (kind === 'availability') return 'AVAILABILITY'
  if (kind === 'unknown') return 'UNKNOWN'
  return 'REST'
}

function toParsed(
  kind: SimulatorGraphKind,
  startMs: number,
  endMs: number,
  options: { isManualEntry?: boolean; slot?: 1 | 2 },
): ParsedActivity | null {
  if (endMs <= startMs) return null
  const durationMinutes = Math.round((endMs - startMs) / 60000)
  return {
    type: activityType(kind, durationMinutes),
    startMs,
    endMs,
    durationMinutes,
    originalDurationMinutes: durationMinutes,
    isManualEntry: options.isManualEntry,
    slot: options.slot,
  }
}

function countryMarker(atUtc: number, role: 'START_COUNTRY' | 'END_COUNTRY', countryCode: string): CountryMarker {
  const parts = utcParts(atUtc)
  return {
    activityId: role,
    countryCode,
    timeStr: `${pad(parts.hour)}:${pad(parts.minute)}`,
    dateStr: `${pad(parts.day)}.${pad(parts.month)}.${parts.year}`,
    recordedAtUtc: atUtc,
  }
}

export function buildSimulatorSlotGraph(input: SimulatorSlotGraphInput): SimulatorSlotGraph {
  const parsed: ParsedActivity[] = []
  const manualEntryBuffer: ManualEntrySegment[] = []
  const countryMarkers: CountryMarker[] = []

  for (const activity of input.activities) {
    const block = toParsed(activity.kind, activity.startUtc, activity.endUtc, {
      isManualEntry: activity.isManualEntry,
      slot: activity.slot,
    })
    if (block) parsed.push(block)
    if (activity.isManualEntry && block) {
      const parts = utcParts(activity.startUtc)
      manualEntryBuffer.push({
        activityId: editorActivity(activity.kind),
        day: parts.day,
        month: parts.month,
        year: parts.year,
        hour: parts.hour,
        minute: parts.minute,
        isManualEntry: true,
        recordedAtUtc: activity.startUtc,
      })
    }
  }

  for (let index = 0; index < input.manualSegments.length; index += 1) {
    const segment = input.manualSegments[index]!
    const atUtc = segmentUtc(segment)
    const isCountry = segment.activityId === 'START_COUNTRY' || segment.activityId === 'END_COUNTRY'
    manualEntryBuffer.push({
      activityId: segment.activityId,
      day: segment.day,
      month: segment.month,
      year: segment.year,
      hour: segment.hour,
      minute: segment.minute,
      countryCode: segment.countryCode,
      isManualEntry: segment.isManualEntry ?? true,
      recordedAtUtc: atUtc,
    })
    if (isCountry) {
      countryMarkers.push(countryMarker(atUtc, segment.activityId, segment.countryCode || 'CZ'))
      continue
    }
    const next = input.manualSegments[index + 1]
    if (!next) continue
    const nextIsCountry = next.activityId === 'START_COUNTRY' || next.activityId === 'END_COUNTRY'
    if (nextIsCountry) continue
    const block = toParsed(
      segment.activityId === 'WORK'
        ? 'work'
        : segment.activityId === 'AVAILABILITY'
          ? 'availability'
          : segment.activityId === 'DRIVING'
            ? 'driving'
            : segment.activityId === 'UNKNOWN'
              ? 'unknown'
              : 'rest',
      atUtc,
      segmentUtc(next),
      { isManualEntry: true, slot: input.currentSlot },
    )
    if (block) parsed.push(block)
  }

  for (const minute of input.simulatedMinutes) {
    const block = toParsed(minute.kind, minute.minuteStartUtc, minute.minuteStartUtc + 60000, {
      slot: input.currentSlot,
    })
    if (block) parsed.push(block)
  }

  for (const location of input.locations) {
    if (location.recordType !== 'start_country' && location.recordType !== 'end_country') continue
    countryMarkers.push(
      countryMarker(
        location.recordedAtUtc,
        location.recordType === 'end_country' ? 'END_COUNTRY' : 'START_COUNTRY',
        location.countryCode || 'CZ',
      ),
    )
  }

  return {
    days: activitiesByDay(parsed, { useLocalTime: false }),
    countryMarkers,
    manualEntryBuffer,
  }
}
