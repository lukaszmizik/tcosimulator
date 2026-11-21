/**
 * Logika karet - načítání, vytahování, výpočty jízdy
 */

import type { CountryEntry } from './data/countriesLoader'
import type { ActivityId, CardData, CardInsertionState, EditorActivityId, ManualEntrySegment } from './TachoTypes'
import { ACTIVITY_SYMBOLS, MANUAL_ACTIVITIES, UNKNOWN_ACTIVITY_SYMBOL } from './TachoTypes'
import { FIRST_INSERTION_OFFSET_MS, VIRTUAL_CARD_VALIDITY_DATES } from './Constants'

const lcdOdometerFormat = new Intl.NumberFormat('cs-CZ', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatLcdOdometer(km: number): string {
  const parts = lcdOdometerFormat.formatToParts(km)
  const padding = parts.filter(({ type }) => type === 'group').length
  const number = parts.filter(({ type }) => type !== 'group').map(({ value }) => value).join('')
  return '\u00a0'.repeat(padding) + number + 'km'
}

export const DRIVING_SYMBOL = '\u0053'

export const EDITOR_FIELD_ORDER: CardInsertionState['editorBlinkField'][] = ['activity', 'day', 'month', 'year', 'hour', 'minute']

/** Standardní délka platnosti karty řidiče (roky). */
export const DRIVER_CARD_VALIDITY_YEARS = 5

/** Platnost končí dnem `expiryUtc` (začátek dne UTC). Další kalendářní den je karta neplatná. */
export function isTrainingCardExpired(expiryUtc: number | undefined | null, nowMs: number): boolean {
  if (expiryUtc == null) return false
  const dayMs = 86_400_000
  return Math.floor(nowMs / dayMs) > Math.floor(expiryUtc / dayMs)
}

/** Začátek platnosti = konec platnosti minus 5 kalendářních let (stejný den UTC). */
export function trainingValidityBeginUtc(expiryUtc: number): number {
  const d = new Date(expiryUtc)
  d.setUTCFullYear(d.getUTCFullYear() - DRIVER_CARD_VALIDITY_YEARS)
  return d.getTime()
}

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
  options?: { skipReadyToDriveScreen?: boolean; initialCountryCode?: string; existingManualEntryBuffer?: ManualEntrySegment[]; timeOffsetMs?: number },
): CardInsertionState {
  const firstInsertion = cardData.lastWithdrawal === null
  const showItsVdoQuestions = cardData.isFirstInsertion !== false
  const offset = options?.timeOffsetMs ?? 0
  const dayMs = 86_400_000
  const currentLocalDay = Math.floor((simulatedUtcTime + offset) / dayMs)
  const controlStartUtc = (currentLocalDay - 56) * dayMs - offset
  const validityStartUtc = firstInsertion && (cardData.trainingValidityBeginUtc != null || cardData.templateId)
    ? (cardData.trainingValidityBeginUtc != null
      ? cardData.trainingValidityBeginUtc - offset
      : Date.parse(VIRTUAL_CARD_VALIDITY_DATES[cardData.templateId!].from) - offset)
    : undefined
  const firstManualEntryStartUtc = validityStartUtc == null
    ? undefined
    : Math.max(validityStartUtc, controlStartUtc)
  const utcMs = cardData.lastWithdrawal ?? firstManualEntryStartUtc ?? simulatedUtcTime - FIRST_INSERTION_OFFSET_MS
  const seg = utcMsToSegment(utcMs)
  const requestedCode = options?.initialCountryCode ? (ROUTE_TO_TACHOGRAPH_CODE[options.initialCountryCode] ?? options.initialCountryCode) : 'CZ'
  const countryIndex = Math.max(0, countries.findIndex((c) => c.code === requestedCode))
  const existingBuffer = options?.existingManualEntryBuffer ?? []
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
    manualEntryBuffer: existingBuffer,
    manualEntryStartIndex: existingBuffer.length,
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
    firstManualEntryStartUtc,
    showFirstManualEntryBoundary: validityStartUtc != null && validityStartUtc < controlStartUtc,
    firstInsertion,
    selectingCountryForStamp: false,
    stampActivityId: null,
    skipReadyToDriveScreen: options?.skipReadyToDriveScreen ?? false,
    cardExpired: isTrainingCardExpired(cardData.trainingExpiryUtc, simulatedUtcTime),
  }
}

export function segmentToMs(
  s: ManualEntrySegment | { day: number; month: number; year: number; hour: number; minute: number },
): number {
  return new Date(s.year, s.month - 1, s.day, s.hour, s.minute).getTime()
}

export function floorToMinute(ms: number): number {
  return Math.floor(ms / 60000) * 60000
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
 * Starší převod, který editorová čísla čte jako čas prohlížeče.
 * Průvodce vložení ho už nepoužívá.
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

type TachographClockFields = { day: number; month: number; year: number; hour: number; minute: number }

/**
 * Editor ukazuje hodiny tachografu. Offset se přičte k uloženému UTC právě jednou
 * a kalendář se čte v UTC, ne v pásmu prohlížeče.
 */
export function utcMsToTachographSegment(utcMs: number, timeOffsetMs: number) {
  return utcMsToSegment(utcMs + timeOffsetMs)
}

/** Editorová pole jsou hodiny tachografu. Uložené UTC vznikne jejich čtením jako UTC a jedním odečtením offsetu. */
export function tachographSegmentToUtcMs(s: TachographClockFields, timeOffsetMs: number): number {
  return Date.UTC(s.year, s.month - 1, s.day, s.hour, s.minute) - timeOffsetMs
}

export function tachographSegmentToUtcForBuffer<T extends TachographClockFields & { activityId?: EditorActivityId; countryCode?: string }>(
  s: T,
  timeOffsetMs: number,
): ManualEntrySegment {
  const ms = floorToMinute(tachographSegmentToUtcMs(s, timeOffsetMs))
  const base = utcMsToSegment(ms)
  return {
    ...base,
    activityId: s.activityId ?? 'REST',
    countryCode: s.countryCode,
    isManualEntry: true,
  }
}

/** Udrž editor v hodinách tachografu a mezích uloženého UTC. */
export function clampTachographSegment<T extends ManualEntrySegment>(
  seg: T,
  minUtcMs: number | null,
  maxUtcMs: number,
  timeOffsetMs: number,
): T {
  let utc = tachographSegmentToUtcMs(seg, timeOffsetMs)
  if (minUtcMs != null && utc < minUtcMs) utc = minUtcMs
  if (utc > maxUtcMs) utc = maxUtcMs
  const fields = utcMsToTachographSegment(utc, timeOffsetMs)
  return { ...seg, day: fields.day, month: fields.month, year: fields.year, hour: fields.hour, minute: fields.minute }
}

function isConfirmedActivity(activityId: EditorActivityId | undefined): boolean {
  return activityId === 'REST' || activityId === 'WORK' || activityId === 'AVAILABILITY'
}

/**
 * Potvrzený úsek na stropu času vložení znamená „do teď“.
 * Průvodce ten strop zachytí na začátku a potvrzení přijde později.
 * Posune jen body ležící přesně na stropu, včetně razítka ve stejné minutě.
 * Dřívější výslovný konec ani úsek bez konce se nemění.
 */
export function advanceConfirmedCapToMinute(
  buffer: readonly ManualEntrySegment[],
  capMinuteMs: number,
  confirmMinuteMs: number,
): ManualEntrySegment[] {
  const cap = floorToMinute(capMinuteMs)
  const confirm = floorToMinute(confirmMinuteMs)
  if (confirm <= cap) return [...buffer]
  const capIsConfirmedEnd = buffer.some((segment) => isConfirmedActivity(segment.activityId) && segmentToMsUtc(segment) === cap)
  if (!capIsConfirmedEnd) return [...buffer]
  return buffer.map((segment) => {
    if (segmentToMsUtc(segment) !== cap) return segment
    const moved = utcMsToSegment(confirm)
    return {
      ...segment,
      day: moved.day,
      month: moved.month,
      year: moved.year,
      hour: moved.hour,
      minute: moved.minute,
    }
  })
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
