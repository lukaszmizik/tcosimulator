/**
 * Logika karet - načítání, vytahování, výpočty jízdy
 */

import type { CountryEntry } from './data/countriesLoader'
import type { ActivityId, CardData, CardInsertionState, EditorActivityId, ManualEntrySegment } from './TachoTypes'
import { ACTIVITY_SYMBOLS, MANUAL_ACTIVITIES, UNKNOWN_ACTIVITY_SYMBOL } from './TachoTypes'
import { FIRST_INSERTION_OFFSET_MS } from './Constants'

export const DRIVING_SYMBOL = '\u0053'

export const EDITOR_FIELD_ORDER: CardInsertionState['editorBlinkField'][] = ['activity', 'day', 'month', 'year', 'hour', 'minute']

export function nowToSegment(d: Date): ManualEntrySegment & { day: number; month: number; year: number; hour: number; minute: number } {
  return {
    activityId: 'REST',
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

/** Převod UTC timestampu na segment – pro konzistenci s activityHistory (UTC). */
export function utcMsToSegment(utcMs: number): ManualEntrySegment & { day: number; month: number; year: number; hour: number; minute: number } {
  const d = new Date(utcMs)
  return {
    activityId: 'REST',
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

/** Převod timestampu na segment v místním čase – pro průvodce doplňováním. */
export function localMsToSegment(ms: number): ManualEntrySegment & { day: number; month: number; year: number; hour: number; minute: number } {
  const d = new Date(ms)
  return {
    activityId: 'REST',
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

/** Mapování kódu země z trasy (AT, DE, …) na kód v seznamu zemí tachografu (A, D, …) */
const ROUTE_TO_TACHOGRAPH_CODE: Record<string, string> = { CZ: 'CZ', AT: 'A', DE: 'D', CH: 'CH', FR: 'F', ES: 'E' }

export function createInitialCardInsertionState(
  slot: 1 | 2,
  cardData: CardData,
  simulatedUtcTime: number,
  countries: CountryEntry[],
  options?: { skipReadyToDriveScreen?: boolean; initialCountryCode?: string; existingManualEntryBuffer?: ManualEntrySegment[] },
): CardInsertionState {
  const firstInsertion = cardData.lastWithdrawal === null
  const showItsVdoQuestions = cardData.isFirstInsertion !== false
  const utcMs = firstInsertion
    ? simulatedUtcTime - FIRST_INSERTION_OFFSET_MS
    : cardData.lastWithdrawal!
  const seg = utcMsToSegment(utcMs)
  const requestedCode = options?.initialCountryCode ? (ROUTE_TO_TACHOGRAPH_CODE[options.initialCountryCode] ?? options.initialCountryCode) : 'CZ'
  const countryIndex = Math.max(0, countries.findIndex((c) => c.code === requestedCode))
  return {
    slot,
    phase: 'welcome',
    phaseStartTime: Date.now(),
    cardInsertionTime: simulatedUtcTime,
    loadingProgress: 0,
    showPleaseWait: false,
    decisionSupplement: true,
    editorBlinkField: 'activity',
    segmentStart: { day: seg.day, month: seg.month, year: seg.year, hour: seg.hour, minute: seg.minute },
    currentSegment: { ...seg },
    manualEntryBuffer: options?.existingManualEntryBuffer ?? [],
    countryIndex,
    selectingSpanishRegion: false,
    spanishRegionIndex: 0,
    finalConfirmYes: true,
    finalConfirmSkippedEditor: false,
    showItsVdoQuestions,
    itsYes: true,
    vdoYes: true,
    cardName: cardData.name,
    cardSurname: cardData.surname,
    lastWithdrawal: cardData.lastWithdrawal,
    firstInsertion,
    selectingCountryForStamp: false,
    stampActivityId: null,
    skipReadyToDriveScreen: options?.skipReadyToDriveScreen ?? false,
  }
}

export function segmentToMs(
  s: ManualEntrySegment | { day: number; month: number; year: number; hour: number; minute: number },
): number {
  return new Date(s.year, s.month - 1, s.day, s.hour, s.minute).getTime()
}

export function floorToMinute(ms: number): number {
  const d = new Date(ms)
  d.setSeconds(0, 0)
  return d.getTime()
}

export function clampSegmentToMaxMs(seg: ManualEntrySegment, maxMs: number): ManualEntrySegment {
  const ms = segmentToMsUtc(seg)
  if (ms <= maxMs) return seg
  const d = new Date(maxMs)
  return {
    ...seg,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

/** L2 musí být alespoň o minutu vyšší než L1 (segmenty po minutách). */
export function clampSegmentToMinMs(seg: ManualEntrySegment, minMs: number): ManualEntrySegment {
  const ms = segmentToMsUtc(seg)
  if (ms >= minMs) return seg
  const d = new Date(minMs)
  return {
    ...seg,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

/** Clamp s místním časem – pro průvodce doplňováním. Zachová activityId a countryCode. */
export function clampSegmentToMaxMsLocal(seg: ManualEntrySegment, maxMs: number): ManualEntrySegment {
  const ms = segmentToMs(seg)
  if (ms <= maxMs) return seg
  const maxSeg = localMsToSegment(maxMs)
  return { ...seg, day: maxSeg.day, month: maxSeg.month, year: maxSeg.year, hour: maxSeg.hour, minute: maxSeg.minute }
}

export function clampSegmentToMinMsLocal(seg: ManualEntrySegment, minMs: number): ManualEntrySegment {
  const ms = segmentToMs(seg)
  if (ms >= minMs) return seg
  const minSeg = localMsToSegment(minMs)
  return { ...seg, day: minSeg.day, month: minSeg.month, year: minSeg.year, hour: minSeg.hour, minute: minSeg.minute }
}

export function segmentToMsUtc(s: ManualEntrySegment): number {
  return Date.UTC(s.year, s.month - 1, s.day, s.hour, s.minute)
}

/**
 * Převede segment s MÍSTNÍMI složkami (z editoru) na segment s UTC složkami pro zápis do manualEntryBuffer.
 * Doplňování probíhá v místním čase, zápis na kartu se provádí v UTC.
 */
export function localSegmentToUtcForBuffer<T extends { day: number; month: number; year: number; hour: number; minute: number; activityId?: EditorActivityId; countryCode?: string }>(
  s: T,
): ManualEntrySegment {
  const ms = floorToMinute(segmentToMs(s))
  const base = utcMsToSegment(ms)
  return {
    ...base,
    activityId: s.activityId ?? 'REST',
    countryCode: s.countryCode,
    isManualEntry: true,
  }
}

export function cycleEditorActivity(id: EditorActivityId, direction: 1 | -1 = 1): EditorActivityId {
  const i = ACTIVITY_SYMBOLS.findIndex((a) => a.id === id)
  const len = ACTIVITY_SYMBOLS.length
  return ACTIVITY_SYMBOLS[(i + direction + len) % len].id
}

export function getActivityCode(activityId: ActivityId): string {
  if (activityId === 'DRIVING') return DRIVING_SYMBOL
  if (activityId === 'UNKNOWN') return UNKNOWN_ACTIVITY_SYMBOL
  const a = MANUAL_ACTIVITIES.find((x) => x.id === activityId)
  return a?.code ?? MANUAL_ACTIVITIES[0].code
}

/** Cyklické přepínání mezi manuálními aktivitami: Odpočinek → Práce → Pohotovost → Odpočinek. Z DRIVING/UNKNOWN první stisk → Odpočinek. */
export function getNextActivity(currentId: ActivityId): ActivityId {
  const manualOrder: ActivityId[] = ['REST', 'WORK', 'AVAILABILITY']
  if (currentId === 'DRIVING' || currentId === 'UNKNOWN') return 'REST'
  const i = manualOrder.indexOf(currentId)
  return manualOrder[(i + 1) % manualOrder.length]
}

import type { ActivityKind } from './TachoTypes'

export function activityFromChar(char: string): ActivityKind {
  if (char === DRIVING_SYMBOL) return 'driving'
  const byCode = MANUAL_ACTIVITIES.find((a) => a.code === char)
  if (byCode?.id === 'REST') return 'rest'
  if (byCode?.id === 'WORK') return 'otherWork'
  if (byCode?.id === 'AVAILABILITY') return 'availability'
  return 'none'
}
