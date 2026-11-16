/**
 * Převod DriverCardData do formátu existujícího grafu.
 * Zachovává UTC intervaly, historický slot a značky zemí. Mezery nedoplňuje.
 */

import type { DddParsedCard } from './types/tachoViewerDddMapper'
import {
  activitiesByDay,
  expandToWeeksContainingData,
  type ActivityType,
  type CountryMarker,
  type DayData,
} from './workWeekTxtParser'

export type DddCardPreview = {
  firstName: string
  surname: string
  days: DayData[]
  countryMarkers: CountryMarker[]
  card2Data?: {
    days: DayData[]
    countryMarkers: CountryMarker[]
  }
  /** První blok řízení v původních UTC mezích parseru. */
  firstDriving: { startMs: number; endMs: number } | null
  /** Nejstarší značka země, kterou parser uvedl. */
  countrySample: { activityId: 'START_COUNTRY' | 'END_COUNTRY'; countryCode: string; atUtc: number } | null
  /** Týden, ve kterém má graf otevřít první blok řízení nebo první činnost. */
  focusMs: number | null
}

function activityType(kind: DddParsedCard['activities'][number]['kind'], durationMinutes: number): ActivityType {
  if (kind === 'driving') return 'řízení'
  if (kind === 'work') return 'práce'
  if (kind === 'availability') return 'pohotovost'
  if (kind === 'rest') {
    if (durationMinutes >= 45 * 60) return 'odpočinek>45h'
    if (durationMinutes > 24 * 60) return 'odpočinek>24h'
    return 'odpočinek'
  }
  return 'neznámá'
}

function daysFromActivities(activities: DddParsedCard['activities'], slot: 1 | 2): DayData[] {
  let carriedSlot: 1 | 2 = 1
  const parsed = []
  for (const activity of activities) {
    if (activity.slot === 1 || activity.slot === 2) carriedSlot = activity.slot
    const historicalSlot = activity.slot ?? carriedSlot
    if (historicalSlot !== slot) continue
    if (activity.endUtc <= activity.startUtc) continue
    const durationMinutes = Math.round((activity.endUtc - activity.startUtc) / 60000)
    parsed.push({
      type: activityType(activity.kind, durationMinutes),
      startMs: activity.startUtc,
      endMs: activity.endUtc,
      durationMinutes,
      originalDurationMinutes: durationMinutes,
      isManualEntry: activity.isManualEntry === true,
    })
  }
  if (parsed.length === 0) return []
  return activitiesByDay(parsed)
}

function countryMarkers(card: DddParsedCard): CountryMarker[] {
  return card.locations
    .filter((location) => (location.recordType === 'start_country' || location.recordType === 'end_country') && location.countryCode)
    .map((location) => {
      const at = new Date(location.recordedAtUtc)
      return {
        activityId: location.recordType === 'end_country' ? 'END_COUNTRY' as const : 'START_COUNTRY' as const,
        countryCode: location.countryCode!,
        timeStr: `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`,
        dateStr: `${String(at.getUTCDate()).padStart(2, '0')}.${String(at.getUTCMonth() + 1).padStart(2, '0')}.${at.getUTCFullYear()}`,
        atUtc: location.recordedAtUtc,
      }
    })
    .sort((a, b) => a.atUtc - b.atUtc)
    .map((marker) => ({
      activityId: marker.activityId,
      countryCode: marker.countryCode,
      timeStr: marker.timeStr,
      dateStr: marker.dateStr,
    }))
}

export function buildDddCardPreview(card: DddParsedCard): DddCardPreview {
  const slot1Days = daysFromActivities(card.activities, 1)
  const slot2Days = daysFromActivities(card.activities, 2)
  const markers = countryMarkers(card)
  const firstDrivingActivity = card.activities.find((activity) => activity.kind === 'driving' && activity.endUtc > activity.startUtc)
  const firstActivity = card.activities.find((activity) => activity.endUtc > activity.startUtc)
  const focusMs = firstDrivingActivity?.startUtc ?? firstActivity?.startUtc ?? null
  const sampleLocation = card.locations
    .filter((location) => (location.recordType === 'start_country' || location.recordType === 'end_country') && location.countryCode)
    .sort((a, b) => a.recordedAtUtc - b.recordedAtUtc)[0]

  const days = slot1Days.length > 0
    ? expandToWeeksContainingData(slot1Days, slot1Days[0]!.dateUtc)
    : focusMs != null && slot2Days.length > 0
      ? expandToWeeksContainingData([], focusMs)
      : []

  return {
    firstName: card.firstName,
    surname: card.surname,
    days,
    countryMarkers: markers,
    card2Data: slot2Days.length > 0
      ? { days: expandToWeeksContainingData(slot2Days, slot2Days[0]!.dateUtc), countryMarkers: markers }
      : undefined,
    firstDriving: firstDrivingActivity
      ? { startMs: firstDrivingActivity.startUtc, endMs: firstDrivingActivity.endUtc }
      : null,
    countrySample: sampleLocation?.countryCode
      ? {
          activityId: sampleLocation.recordType === 'end_country' ? 'END_COUNTRY' : 'START_COUNTRY',
          countryCode: sampleLocation.countryCode,
          atUtc: sampleLocation.recordedAtUtc,
        }
      : null,
    focusMs,
  }
}
