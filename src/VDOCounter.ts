/**
 * VDO Counter – vyhodnocování aktivit dle předpisů EU (nařízení 165/2014).
 * Implementace limitů řízení, odpočinků, pracovních směn a plovoucích období.
 */

import { segmentToMsUtc } from './CardLogic'
import type { ActivityHistoryEntry, ManualActivityEntry, ManualEntrySegment } from './TachoTypes'

// ─── Konstanty z předpisů EU ────────────────────────────────────────────────

/** 1) Maximální doba aktivity řízení v jednom bloku */
export const DRIVING_LIMIT_430_MS = 4 * 3600 * 1000 + 30 * 60 * 1000 // 4h30m
export const DRIVING_LIMIT_415_MS = 4 * 3600 * 1000 + 15 * 60 * 1000 // 4h15m (varování)

/** 2) Minimální pauza (postýlka) pro nový blok řízení */
export const REST_RESET_MS = 45 * 60 * 1000 // 45m

/** 3) Dělená pauza: první část 15m, druhá 30m */
export const SPLIT_REST_FIRST_MS = 15 * 60 * 1000  // 15m
export const SPLIT_REST_SECOND_MS = 30 * 60 * 1000 // 30m

/** 5) Maximální doba řízení v jedné pracovní směně */
export const DAILY_DRIVING_LIMIT_MS = 9 * 3600 * 1000 // 9h

/** 6) Prodloužená směna: max 10h, uplatní se při >9h01m */
export const EXTENDED_DRIVING_LIMIT_MS = 10 * 3600 * 1000 // 10h
export const EXTENDED_DRIVING_THRESHOLD_MS = 9 * 3600 * 1000 + 60 * 1000 // 9h01m

/** 7) Minimální týdenní odpočinek */
export const WEEKLY_REST_MIN_MS = 24 * 3600 * 1000 // 24h

/** 8) Zkrácený týdenní odpočinek: 24h00m – 44h59m */
export const REDUCED_WEEKLY_REST_MIN_MS = 24 * 3600 * 1000
export const REDUCED_WEEKLY_REST_MAX_MS = 44 * 3600 * 1000 + 59 * 60 * 1000

/** 9) Standardní týdenní odpočinek: ≥45h */
export const STANDARD_WEEKLY_REST_MIN_MS = 45 * 3600 * 1000

/** 10) Plovoucí týden: max 144h od první aktivity po předchozím týdenním odpočinku */
export const FLOATING_WEEK_LIMIT_MS = 144 * 3600 * 1000

/** 11) Plovoucí den: 24h od zadání výchozí země */
export const FLOATING_DAY_MS = 24 * 3600 * 1000
/** Režim osádky: plovoucí den se prodlužuje na 30h */
export const FLOATING_DAY_CREW_MODE_MS = 30 * 3600 * 1000

/** 13) Minimální denní odpočinek (varianta 1) → max směna 13h */
export const DAILY_REST_MIN_11H_MS = 11 * 3600 * 1000 // 11h
/** Režim osádky: standardní denní odpočinek 9h (není potřeba 3h+9h ani 11h) */
export const DAILY_REST_CREW_MODE_MS = 9 * 3600 * 1000 // 9h
export const MAX_WORK_SHIFT_13H_MS = 13 * 3600 * 1000 // 13h

/** 14) Souvislá postýlka (rest) ve směně min. 3h → denní odpočinek na konci směny může být 9h.
 * V režimu osádky se toto pravidlo neuplatňuje – 9h je standard. */
export const REST_IN_SHIFT_FOR_9H_DAILY_MS = 3 * 3600 * 1000 // 3h
export const DAILY_REST_SPLIT_9H_MS = 9 * 3600 * 1000 // 9h

/** 15) Zkrácený týdenní odpočinek vyhovuje 9h */
export const REDUCED_WEEKLY_REST_SATISFIES_MS = 9 * 3600 * 1000

/** 16) Max počet zkrácených denních odpočinků mezi dvěma týdenními v plovoucím týdnu */
export const MAX_REDUCED_DAILY_REST_PER_PERIOD = 3
/** Zkrácená denní doba odpočinku: 9h00m – 10h59m (méně než standardních 11h) */
const REDUCED_DAILY_REST_MIN_MS = 9 * 3600 * 1000 // 9h
const REDUCED_DAILY_REST_MAX_MS = 11 * 3600 * 1000 - 1 // < 11h

/** 18) Doba odpočinku nad 24h resetuje počítadlo zkrácených denních */
export const REST_RESET_REDUCED_COUNT_MS = 24 * 3600 * 1000

/** 20) Maximální doba řízení v jednom kalendářním týdnu */
export const WEEKLY_DRIVING_LIMIT_MS = 56 * 3600 * 1000 // 56h

/** 21) Maximální doba řízení ve dvou po sobě jdoucích kalendářních týdnech */
export const TWO_WEEKS_DRIVING_LIMIT_MS = 90 * 3600 * 1000 // 90h

const MINUTE_MS = 60 * 1000

/** Vrátí plovoucí den v ms: 30h v režimu osádky, jinak 24h */
export function getFloatingDayMs(isCrewMode: boolean): number {
  return isCrewMode ? FLOATING_DAY_CREW_MODE_MS : FLOATING_DAY_MS
}

/**
 * Odvodí začátek směny z manualEntryBuffer, pokud WorkShift nemá hodnotu.
 * Vrací čas posledního START_COUNTRY před nowMs, po němž nenásleduje END_COUNTRY.
 */
export function getShiftStartFromManualBuffer(
  manualEntryBuffer: ManualEntrySegment[],
  nowMs: number
): number | null {
  let lastStartMs: number | null = null
  for (const seg of manualEntryBuffer) {
    const ms = segmentToMsUtc(seg)
    if (seg.activityId === 'START_COUNTRY' && ms <= nowMs) {
      lastStartMs = ms
    } else if (seg.activityId === 'END_COUNTRY' && lastStartMs != null && ms <= nowMs) {
      lastStartMs = null
    }
  }
  return lastStartMs
}

/** Vrátí minimální denní odpočinek v ms: 9h v režimu osádky, jinak 11h */
export function getDailyRestMinMs(isCrewMode: boolean): number {
  return isCrewMode ? DAILY_REST_CREW_MODE_MS : DAILY_REST_MIN_11H_MS
}

// ─── Typy ────────────────────────────────────────────────────────────────────

/** Agregované doby aktivit v ms */
export type VDODurationsMs = {
  driving: number
  rest: number
  otherWork: number
  availability: number
}

/** Typ týdenního odpočinku */
export type WeeklyRestType = 'standard' | 'reduced' | 'short'

/** Blok řízení – od skončení denní/týdenní odpočinku nebo pauzy 45m/dělené 15m+30m */
export type DrivingBlock = {
  startMinuteUtc: number
  drivingMs: number
}

// ─── Pomocné funkce ────────────────────────────────────────────────────────────

/**
 * Formátuje dobu v ms na řetězec "hh:mm".
 * @param roundUp true = pro odpočet (zbývá X min) – 61 s se zobrazí jako 2 min (aktivita s více sekundami v minutě vyhrává)
 */
export function formatDurationHhMm(ms: number, roundUp?: boolean): string {
  const totalMin = roundUp ? Math.ceil(ms / MINUTE_MS) : Math.floor(ms / MINUTE_MS)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Formátuje dobu v ms na "Xh Ym".
 */
export function formatDurationHuman(ms: number): string {
  const totalMin = Math.floor(ms / MINUTE_MS)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * 20) Zjistí, zda byl překročen limit 56h v kalendářním týdnu.
 */
export function isWeeklyDrivingLimitExceeded(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  referenceTimeUtc: number
): boolean {
  const sum = aggregateDrivingInCalendarWeek(history, slotIndex, referenceTimeUtc)
  return sum > WEEKLY_DRIVING_LIMIT_MS
}

/**
 * 21) Zjistí, zda byl překročen limit 90h ve dvou kalendářních týdnech.
 */
export function isTwoWeeksDrivingLimitExceeded(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  referenceTimeUtc: number
): boolean {
  const sum = aggregateDrivingTwoWeeks(history, slotIndex, referenceTimeUtc)
  return sum > TWO_WEEKS_DRIVING_LIMIT_MS
}

// ─── Agregace aktivit ─────────────────────────────────────────────────────────

/**
 * Sloučí sekvenci aktivit do agregovaných dob za den.
 * @param history Historie aktivit po minutách
 * @param slotIndex 1 = řidič 1, 2 = řidič 2
 * @param dayStartUtc Počátek dne (UTC midnight) v ms
 * @param dayEndUtc Konec dne (24h) v ms
 */
export function aggregateDurationsForDay(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  dayStartUtc: number,
  dayEndUtc: number
): VDODurationsMs {
  const filtered = history.filter(
    (e) => e.minuteStartUtc >= dayStartUtc && e.minuteStartUtc < dayEndUtc
  )
  const out: VDODurationsMs = { driving: 0, rest: 0, otherWork: 0, availability: 0 }

  for (const e of filtered) {
    const slot = slotIndex === 1 ? e.driver1 : e.driver2
    if (slot === 'driving') out.driving += MINUTE_MS
    else if (slot === 'rest') out.rest += MINUTE_MS
    else if (slot === 'otherWork') out.otherWork += MINUTE_MS
    else if (slot === 'availability') out.availability += MINUTE_MS
  }
  return out
}

/**
 * Součet řízení v jednom kalendářním týdnu (po–ne).
 */
function aggregateDrivingInCalendarWeek(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  referenceTimeUtc: number
): number {
  const d = new Date(referenceTimeUtc)
  const dayOfWeek = d.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const mondayThisWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset))
  const weekStart = mondayThisWeek.getTime()
  let sum = 0
  for (let i = 0; i < 7; i++) {
    const dayStart = weekStart + i * 24 * 3600 * 1000
    const dayEnd = dayStart + 24 * 3600 * 1000
    const dur = aggregateDurationsForDay(history, slotIndex, dayStart, dayEnd)
    sum += dur.driving
  }
  return sum
}

/**
 * 21) Součet dob řízení za dva po sobě jdoucí kalendářní týdny (max 90h).
 */
export function aggregateDrivingTwoWeeks(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  referenceTimeUtc: number
): number {
  const d = new Date(referenceTimeUtc)
  const dayOfWeek = d.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const mondayThisWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset))
  const week1Start = mondayThisWeek.getTime()
  const week2Start = week1Start - 7 * 24 * 3600 * 1000
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const dayStart = week2Start + i * 24 * 3600 * 1000
    const dayEnd = dayStart + 24 * 3600 * 1000
    const dur = aggregateDurationsForDay(history, slotIndex, dayStart, dayEnd)
    sum += dur.driving
  }
  return sum
}

/**
 * Součet řízení v probíhající pracovní směně (od výchozí země do nowMinuteUtc).
 */
export function aggregateDrivingInWorkShift(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  shiftStartMinuteUtc: number,
  nowMinuteUtc: number
): number {
  const filtered = history.filter(
    (e) => e.minuteStartUtc >= shiftStartMinuteUtc && e.minuteStartUtc < nowMinuteUtc
  )
  let sum = 0
  for (const e of filtered) {
    const slot = slotIndex === 1 ? e.driver1 : e.driver2
    if (slot === 'driving') sum += MINUTE_MS
  }
  return sum
}

/**
 * Počet dní v aktuálním kalendářním týdnu, kdy řidič řídil ≥9h01m (prodloužená směna).
 * Max 2× za týden lze použít 10h místo 9h.
 */
export function countExtendedDrivingDaysThisWeek(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  referenceTimeUtc: number
): number {
  const d = new Date(referenceTimeUtc)
  const dayOfWeek = d.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const mondayThisWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset))
  const weekStart = mondayThisWeek.getTime()
  let count = 0
  for (let i = 0; i < 7; i++) {
    const dayStart = weekStart + i * 24 * 3600 * 1000
    const dayEnd = dayStart + 24 * 3600 * 1000
    const dur = aggregateDurationsForDay(history, slotIndex, dayStart, dayEnd)
    if (dur.driving >= EXTENDED_DRIVING_THRESHOLD_MS) count++
  }
  return count
}

/**
 * Minimální denní odpočinek v ms po skončení směny (9h režim osádky, 9h po 3h postýlce ve směně, jinak 11h).
 */
export function getRequiredDailyRestMs(
  isCrewMode: boolean,
  hasRest3hInShift: boolean
): number {
  if (isCrewMode) return DAILY_REST_CREW_MODE_MS
  if (hasRest3hInShift) return DAILY_REST_SPLIT_9H_MS
  return DAILY_REST_MIN_11H_MS
}

/**
 * 4) Doba „jiné práce“ v probíhající pracovní směně.
 * Používá WorkShift.getFirstStartMinuteUtc – směna začíná výchozí zemí, končí cílovou.
 */
export function aggregateOtherWorkInWorkShift(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  shiftStartMinuteUtc: number,
  nowMinuteUtc: number
): number {
  const filtered = history.filter(
    (e) => e.minuteStartUtc >= shiftStartMinuteUtc && e.minuteStartUtc < nowMinuteUtc
  )
  let sum = 0
  for (const e of filtered) {
    const slot = slotIndex === 1 ? e.driver1 : e.driver2
    if (slot === 'otherWork') sum += MINUTE_MS
  }
  return sum
}

/**
 * 14) Vyhodnocení pravidla: souvislá postýlka (rest) ve směně min. 3h.
 * Pokud v období mezi výchozí a cílovou zemí existuje souvislý blok aktivity
 * „postýlka“ (rest) v délce minimálně 3h, pak na konci směny vyhovuje
 * denní doba odpočinku 9h (místo standardních 11h).
 * V režimu osádky se neuplatňuje – 9h je standard, není potřeba 3h+9h ani 11h.
 *
 * @param isCrewMode true = režim osádky, pravidlo se neuplatňuje (vrací false)
 * @returns true pokud byl nalezen souvislý blok rest ≥ 3h ve směně
 */
export function hasRestBlockInShiftFor9hDaily(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  shiftStartMinuteUtc: number,
  shiftEndMinuteUtc: number,
  isCrewMode?: boolean
): boolean {
  if (isCrewMode) return false
  const filtered = history
    .filter(
      (e) => e.minuteStartUtc >= shiftStartMinuteUtc && e.minuteStartUtc < shiftEndMinuteUtc
    )
    .sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)

  let maxRestMinutes = 0
  let currentRestMinutes = 0

  for (const e of filtered) {
    const slot = slotIndex === 1 ? e.driver1 : e.driver2
    if (slot === 'rest') {
      currentRestMinutes += 1
      maxRestMinutes = Math.max(maxRestMinutes, currentRestMinutes)
    } else {
      currentRestMinutes = 0
    }
  }

  const maxRestMs = maxRestMinutes * MINUTE_MS
  return maxRestMs >= REST_IN_SHIFT_FOR_9H_DAILY_MS
}

// ─── Pravidlo 16: zkrácené denní odpočinky v plovoucím týdnu ────────────────

type ActivityBlock = { kind: string; startMs: number; endMs: number; durationMs: number }

/** Rozdělí historii na souvislé bloky aktivit pro daný slot */
function getActivityBlocks(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  fromMs: number,
  toMs: number
): ActivityBlock[] {
  const filtered = history
    .filter((e) => e.minuteStartUtc >= fromMs && e.minuteStartUtc < toMs)
    .sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)

  const blocks: ActivityBlock[] = []
  let block: ActivityBlock | null = null

  for (const e of filtered) {
    const kind = slotIndex === 1 ? e.driver1 : e.driver2
    const minuteStart = e.minuteStartUtc
    const minuteEnd = minuteStart + MINUTE_MS
    if (!block || block.kind !== kind) {
      block = {
        kind,
        startMs: minuteStart,
        endMs: minuteEnd,
        durationMs: MINUTE_MS
      }
      blocks.push(block)
    } else {
      block.endMs = minuteEnd
      block.durationMs = block.endMs - block.startMs
    }
  }
  return blocks
}

/** Nalezne týdenní odpočinky: souvislé bloky rest ≥ 24h */
function findWeeklyRestPeriods(
  blocks: ActivityBlock[]
): Array<{ startMs: number; endMs: number }> {
  return blocks
    .filter((b) => b.kind === 'rest' && b.durationMs >= WEEKLY_REST_MIN_MS)
    .map((b) => ({ startMs: b.startMs, endMs: b.endMs }))
}

/**
 * 16) Počet zkrácených denních odpočinků (9h) v plovoucím týdnu.
 *
 * Plovoucí týden = období mezi prvním a druhým týdenním odpočinkem.
 * Zkrácený denní odpočinek = rest 9h–11h na konci směny (kromě pravidla 14).
 * Max 3× v jednom plovoucím týdnu.
 * V režimu osádky je 9h standard, nelze „zkrátit“ – vrací 0.
 *
 * @param isCrewMode true = režim osádky, vrací 0
 * @returns Počet zkrácených denních odpočinků v tomto období (0–3)
 */
export function countReducedDailyRestsInFloatingWeek(
  history: ActivityHistoryEntry[],
  slotIndex: 1 | 2,
  isCrewMode?: boolean
): number {
  if (isCrewMode || !history.length) return 0

  const sorted = [...history].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
  const rangeFrom = sorted[0].minuteStartUtc
  const rangeTo = sorted[sorted.length - 1].minuteStartUtc + MINUTE_MS

  const blocks = getActivityBlocks(history, slotIndex, rangeFrom, rangeTo)
  const weeklyRests = findWeeklyRestPeriods(blocks)
  if (weeklyRests.length < 2) return 0

  const periodStartMs = weeklyRests[0].endMs // konec 1. týdenního odpočinku
  const periodEndMs = weeklyRests[1].startMs // začátek 2. týdenního odpočinku
  const periodBlocks = getActivityBlocks(history, slotIndex, periodStartMs, periodEndMs)

  let count = 0
  let lastLongRestEndMs = periodStartMs
  for (let i = 0; i < periodBlocks.length; i++) {
    const block = periodBlocks[i]
    if (block.kind !== 'rest') continue
    if (block.durationMs < REDUCED_DAILY_REST_MIN_MS || block.durationMs > REDUCED_DAILY_REST_MAX_MS) {
      if (block.durationMs >= REDUCED_DAILY_REST_MIN_MS) lastLongRestEndMs = block.endMs
      continue
    }
    const shiftStartMs = lastLongRestEndMs
    const shiftEndMs = block.startMs
    lastLongRestEndMs = block.endMs

    const hasWorkInShift = periodBlocks.some(
      (b) =>
        b.kind !== 'rest' &&
        b.kind !== 'none' &&
        b.startMs < shiftEndMs &&
        b.endMs > shiftStartMs
    )
    if (!hasWorkInShift) continue

    if (hasRestBlockInShiftFor9hDaily(history, slotIndex, shiftStartMs, shiftEndMs)) continue
    count++
    if (count >= MAX_REDUCED_DAILY_REST_PER_PERIOD) break
  }
  return count
}

// ─── Limity a varování ───────────────────────────────────────────────────────

/**
 * 19) Vrátí zbývající dobu řízení v bloku do limitu 4h30.
 */
export function remainingDrivingToLimit430(drivingSinceBreakMs: number): number {
  return Math.max(0, DRIVING_LIMIT_430_MS - drivingSinceBreakMs)
}

/**
 * 5) Zjistí, zda byl překročen denní limit řízení v pracovní směně (9h).
 */
export function isDailyDrivingLimitExceeded(drivingMs: number): boolean {
  return drivingMs > DAILY_DRIVING_LIMIT_MS
}

/**
 * 8–9) Určí typ týdenního odpočinku dle délky.
 */
export function getWeeklyRestType(restMs: number): WeeklyRestType {
  if (restMs >= STANDARD_WEEKLY_REST_MIN_MS) return 'standard'
  if (restMs >= REDUCED_WEEKLY_REST_MIN_MS && restMs <= REDUCED_WEEKLY_REST_MAX_MS) return 'reduced'
  return 'short'
}

/**
 * 3) Kontrola splnění dělené pauzy: první 15m, druhá 30m.
 * Po první pauze 15m může být max 4h20m řízení, pak nutná pauza 30m.
 */
export function isSplitRestFirstSatisfied(restMs: number): boolean {
  return restMs >= SPLIT_REST_FIRST_MS
}

export function isSplitRestSecondSatisfied(restMs: number): boolean {
  return restMs >= SPLIT_REST_SECOND_MS
}

/**
 * 2) Minimální pauza 45m pro reset bloku řízení.
 */
export function isRestResetSatisfied(restMs: number): boolean {
  return restMs >= REST_RESET_MS
}

/**
 * Minimální odpočinek v ms, který musí být proveden po skončení aktuálního bloku řízení.
 *
 * Pravidla EU – dělená pauza:
 * - První část: 15m (SPLIT_REST_FIRST_MS)
 * - Po provedení 15m: druhá část 30m (SPLIT_REST_SECOND_MS)
 * - Plná pauza: 45m (REST_RESET_MS) = alternativa k 15+30
 *
 * @param restSinceLastBreakMs Už proběhlý odpočinek od poslední pauzy/resetu (ms)
 * @param isSplitSecondPart true = už proběhla první část (15m), nyní je potřeba druhá část (30m)
 * @returns Zbývající minimální odpočinek v ms (15m nebo 30m minus proběhlý)
 */
export function getMinimumRestAfterDrivingBlockMs(
  restSinceLastBreakMs: number,
  isSplitSecondPart?: boolean
): number {
  if (isSplitSecondPart) {
    return Math.max(0, SPLIT_REST_SECOND_MS - restSinceLastBreakMs)
  }
  return Math.max(0, SPLIT_REST_FIRST_MS - restSinceLastBreakMs)
}

/**
 * Sloučí manuální záznamy (1M) do agregovaných dob.
 */
export function aggregateManualEntriesForDay(entries: ManualActivityEntry[]): VDODurationsMs {
  const out: VDODurationsMs = { driving: 0, rest: 0, otherWork: 0, availability: 0 }
  for (const e of entries) {
    const add = e.minutes * MINUTE_MS
    if (e.type === 'driving') out.driving += add
    else if (e.type === 'rest') out.rest += add
    else if (e.type === 'otherWork') out.otherWork += add
    else if (e.type === 'availability') out.availability += add
  }
  return out
}
