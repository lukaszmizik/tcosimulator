/**
 * Denní evidence kilometrů pro blok [9].
 * Nemění počitadlo ani vzorec vzdálenosti — jen rozdělí už vypočtený přírůstek mezi UTC dny.
 */
import type { DayOdometerRecord } from './TachoTypes'

const DAY_MS = 86_400_000

export function utcDayStart(atUtc: number): number {
  return Math.floor(atUtc / DAY_MS) * DAY_MS
}

/** Výchozí stav syntetického dne. Hodnota počitadla se nepřepisuje. */
export function openSyntheticDay(atUtc: number, km: number): DayOdometerRecord {
  const dayStartUtc = utcDayStart(atUtc)
  return {
    dayStartUtc,
    startAtUtc: atUtc,
    kmAtStart: km,
    lastAtUtc: atUtc,
    kmAtLast: km,
    closedAtMidnight: false,
    syntheticStart: atUtc !== dayStartUtc,
    unavailable: false,
  }
}

export function resetDayOdometers(atUtc: number, km: number): DayOdometerRecord[] {
  return [openSyntheticDay(atUtc, km)]
}

/**
 * Běžný jízdní krok. deltaKm je tentýž přírůstek, který už byl přičten k počitadlu.
 * Přes půlnoc se den uzavře a nový krok patří až následujícímu dni.
 */
export function noteLiveDistance(records: DayOdometerRecord[], atUtc: number, deltaKm: number): void {
  const day = utcDayStart(atUtc)
  let open = records[records.length - 1]
  if (!open) {
    records.push(openSyntheticDay(atUtc, 0))
    open = records[records.length - 1]
  }
  if (open.unavailable) return
  if (day < open.dayStartUtc) {
    noteBackwardJump(records, atUtc)
    return
  }
  if (day === open.dayStartUtc) {
    if (atUtc >= open.lastAtUtc) {
      open.kmAtLast += deltaKm
      open.lastAtUtc = atUtc
    }
    return
  }
  if (day === open.dayStartUtc + DAY_MS) {
    if (!open.closedAtMidnight) {
      open.closedAtMidnight = true
      open.lastAtUtc = open.dayStartUtc + DAY_MS
    }
    records.push(dayOpenedAtMidnight(day, open.kmAtLast, atUtc, deltaKm))
    return
  }
  // Živý krok přeskočil víc než jeden den. Mezidny se nedoplňují.
  records.push({
    dayStartUtc: day,
    startAtUtc: atUtc,
    kmAtStart: open.kmAtLast,
    lastAtUtc: atUtc,
    kmAtLast: open.kmAtLast + deltaKm,
    closedAtMidnight: false,
    syntheticStart: atUtc !== day,
    unavailable: false,
  })
}

/**
 * Skok vpřed. totalKm je už vypočtený přírůstek; při jízdě se rozdělí podle trvání
 * v jednotlivých UTC dnech a poslední díl dorovná součet na původní hodnotu.
 * Bez jízdy se přeskočené dny nevytvářejí.
 */
export function applyForwardDistance(
  records: DayOdometerRecord[],
  fromUtc: number,
  toUtc: number,
  totalKm: number,
  kmBefore: number,
): void {
  if (!(toUtc > fromUtc)) return
  const fromDay = utcDayStart(fromUtc)
  const toDay = utcDayStart(toUtc)
  let open = records[records.length - 1]
  if (!open || open.unavailable || open.dayStartUtc !== fromDay) {
    records.push(openSyntheticDay(fromUtc, kmBefore))
    open = records[records.length - 1]
  }
  if (totalKm === 0) {
    if (fromDay === toDay) {
      if (toUtc > open.lastAtUtc) open.lastAtUtc = toUtc
      return
    }
    if (fromUtc > open.lastAtUtc) open.lastAtUtc = fromUtc
    records.push({
      dayStartUtc: toDay,
      startAtUtc: toUtc,
      kmAtStart: open.kmAtLast,
      lastAtUtc: toUtc,
      kmAtLast: open.kmAtLast,
      closedAtMidnight: false,
      syntheticStart: toUtc !== toDay,
      unavailable: false,
    })
    return
  }

  const slices = daySlices(fromUtc, toUtc)
  const parts = splitByWeight(slices.map((slice) => slice.ms), totalKm)
  const baseline = open.kmAtLast
  let running = baseline
  slices.forEach((slice, index) => {
    const part = parts[index] ?? 0
    const atMidnight = slice.to === slice.dayStart + DAY_MS
    const last = records[records.length - 1]
    if (last && last.dayStartUtc === slice.dayStart && !last.unavailable) {
      last.kmAtLast = running + part
      last.lastAtUtc = atMidnight ? slice.dayStart + DAY_MS : slice.to
      last.closedAtMidnight = atMidnight
      running = last.kmAtLast
      return
    }
    const startAtUtc = slice.from === slice.dayStart ? slice.dayStart : slice.from
    records.push({
      dayStartUtc: slice.dayStart,
      startAtUtc,
      kmAtStart: running,
      lastAtUtc: atMidnight ? slice.dayStart + DAY_MS : slice.to,
      kmAtLast: running + part,
      closedAtMidnight: atMidnight,
      syntheticStart: startAtUtc !== slice.dayStart,
      unavailable: false,
    })
    running += part
  })
  records[records.length - 1].kmAtLast = baseline + totalKm
}

/**
 * Simulace 4h10m. Bere jen sekundy jízdy, ze kterých vznikl totalKm.
 * Součet dílů se dorovná na totalKm, aby se celková vzdálenost nezměnila.
 */
export function applySecondDistances(
  records: DayOdometerRecord[],
  entries: readonly { timestampUtc: number; driver1: string; speed: number }[],
  totalKm: number,
  kmBefore: number,
  endUtc: number,
): void {
  if (entries.length === 0) {
    const fromUtc = records[records.length - 1]?.lastAtUtc ?? endUtc
    if (endUtc > fromUtc) applyForwardDistance(records, fromUtc, endUtc, 0, kmBefore)
    return
  }
  const firstUtc = entries[0].timestampUtc
  const firstDay = utcDayStart(firstUtc)
  const lastDay = utcDayStart(endUtc - 1)
  const days: number[] = []
  for (let day = firstDay; day <= lastDay; day += DAY_MS) days.push(day)
  const kmByDay = new Map<number, number>()
  for (const entry of entries) {
    if (entry.driver1 !== 'driving') continue
    const day = utcDayStart(entry.timestampUtc)
    kmByDay.set(day, (kmByDay.get(day) ?? 0) + entry.speed / 3600)
  }
  const parts = days.map((day) => kmByDay.get(day) ?? 0)
  const lastDriving = parts.reduce((found, km, index) => km > 0 ? index : found, -1)
  const correction = totalKm - parts.reduce((sum, km) => sum + km, 0)
  parts[lastDriving >= 0 ? lastDriving : parts.length - 1] += correction

  let open = records[records.length - 1]
  if (!open || open.unavailable || open.dayStartUtc !== firstDay) {
    records.push(openSyntheticDay(firstUtc, kmBefore))
    open = records[records.length - 1]
  }
  const baseline = open.kmAtLast
  let running = baseline
  days.forEach((day, index) => {
    const part = parts[index] ?? 0
    const dayEnd = day + DAY_MS
    const atMidnight = endUtc >= dayEnd
    const last = records[records.length - 1]
    if (last && last.dayStartUtc === day && !last.unavailable) {
      last.kmAtLast = running + part
      last.lastAtUtc = atMidnight ? dayEnd : endUtc
      last.closedAtMidnight = atMidnight
      running = last.kmAtLast
      return
    }
    records.push({
      dayStartUtc: day,
      startAtUtc: day,
      kmAtStart: running,
      lastAtUtc: atMidnight ? dayEnd : endUtc,
      kmAtLast: running + part,
      closedAtMidnight: atMidnight,
      syntheticStart: false,
      unavailable: false,
    })
    running += part
  })
  records[records.length - 1].kmAtLast = baseline + totalKm
}

/** Skok zpět. Stav tachometru se do minulosti nezapisuje. */
export function noteBackwardJump(records: DayOdometerRecord[], targetUtc: number): void {
  const targetDay = utcDayStart(targetUtc)
  for (const record of records) {
    if (record.dayStartUtc >= targetDay) record.unavailable = true
  }
}

export function sumDayIncrements(records: readonly DayOdometerRecord[]): number {
  return records.reduce((sum, record) => (
    record.unavailable ? sum : sum + (record.kmAtLast - record.kmAtStart)
  ), 0)
}

export type DayKilometreReading = {
  startAtUtc: number
  startIsMidnight: boolean
  kmAtStart: number
  endAtUtc: number
  endIsEndOfDay: boolean
  kmAtEnd: number
}

/** Známý stav dne k okamžiku tisku. Chybějící nebo nejednoznačný den vrací null. */
export function dayKilometresForPrint(
  records: readonly DayOdometerRecord[],
  dayStartUtc: number,
  printedAtUtc: number,
): DayKilometreReading | null {
  const day = utcDayStart(dayStartUtc)
  const record = [...records].reverse().find((item) => item.dayStartUtc === day && !item.unavailable)
  if (!record || printedAtUtc < record.startAtUtc) return null
  const dayEnd = day + DAY_MS
  const endIsEndOfDay = record.closedAtMidnight && printedAtUtc >= dayEnd
  if (!endIsEndOfDay && printedAtUtc < record.lastAtUtc) return null
  const printDay = utcDayStart(printedAtUtc)
  const endAtUtc = endIsEndOfDay
    ? dayEnd - 60_000
    : printDay === day
      ? printedAtUtc
      : Math.min(record.lastAtUtc, dayEnd - 60_000)
  if (endAtUtc < record.startAtUtc) return null
  return {
    startAtUtc: record.startAtUtc,
    startIsMidnight: !record.syntheticStart && record.startAtUtc === day,
    kmAtStart: record.kmAtStart,
    endAtUtc,
    endIsEndOfDay,
    kmAtEnd: record.kmAtLast,
  }
}

function dayOpenedAtMidnight(day: number, kmAtStart: number, atUtc: number, deltaKm: number): DayOdometerRecord {
  return {
    dayStartUtc: day,
    startAtUtc: day,
    kmAtStart,
    lastAtUtc: atUtc,
    kmAtLast: kmAtStart + deltaKm,
    closedAtMidnight: false,
    syntheticStart: false,
    unavailable: false,
  }
}

function daySlices(fromUtc: number, toUtc: number): { dayStart: number; from: number; to: number; ms: number }[] {
  const slices: { dayStart: number; from: number; to: number; ms: number }[] = []
  let cursor = fromUtc
  while (cursor < toUtc) {
    const dayStart = utcDayStart(cursor)
    const sliceEnd = Math.min(dayStart + DAY_MS, toUtc)
    slices.push({ dayStart, from: cursor, to: sliceEnd, ms: sliceEnd - cursor })
    cursor = sliceEnd
  }
  return slices
}

/** Poslední díl pohltí zbytek, aby součet byl přesně total. */
function splitByWeight(weights: number[], total: number): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  if (weights.length === 0) return []
  if (weightSum <= 0) return weights.map(() => 0)
  const parts = weights.map((weight) => total * (weight / weightSum))
  const previous = parts.slice(0, -1).reduce((sum, part) => sum + part, 0)
  parts[parts.length - 1] = total - previous
  return parts
}
