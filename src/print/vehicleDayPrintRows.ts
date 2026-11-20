import { VEHICLE_TECHNICAL_DATA } from '../data/vehicle_technical_data'
import { getCard1StoredData, getCard2StoredData } from '../data/card_stored_data'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import { dayKilometresForPrint } from '../dayOdometer'
import {
  NO_CARD, type ActivityHistoryEntry, type ActivityKind, type DayOdometerRecord, type EventLogEntry,
  type FerryTrainEvent, type OutModeEvent, type RecordedGpsLocation, type SecondActivitySnapshot,
} from '../TachoTypes'
import { createPrintRows, duration, printDateUtc, printTimeUtc, type PrintCell } from './driverCardPrintRows'

const MINUTE = 60_000
const DAY = 1_440 * MINUTE
const activities = ['driving', 'otherWork', 'availability', 'rest', 'none'] as const
const symbols: Record<ActivityKind, number> = { driving: 2, otherWork: 9, availability: 7, rest: 8, none: 11 }

export type VehiclePrintCard = {
  firstName?: string
  surname?: string
  cardNumber?: string
  issuingCountry?: string
  dateOfExpiry?: string
}

const cardGenerations = ['GEN1', 'GEN2', 'GEN2 v2'] as const
export type VehicleCardGeneration = (typeof cardGenerations)[number]
export type VehicleDayHolder = {
  kind: 'driver' | 'company' | 'control' | 'workshop'
  surname?: string
  firstName?: string
  cardNumber?: string
  issuingCountry?: string
  dateOfExpiry?: string
  generation?: VehicleCardGeneration
}

const holderSymbols: Record<VehicleDayHolder['kind'], number> = {
  driver: 2, company: 3, control: 4, workshop: 5,
}

/** Údaje bloku [3] z karty vložené v okamžiku tisku. Neznámá generace se nepřebírá. */
export function vehiclePrintHolder(
  kind: VehicleDayHolder['kind'],
  source: {
    surname?: string
    firstName?: string
    cardNumber?: string
    issuingCountry?: string
    dateOfExpiry?: string
    generation?: string
  },
): VehicleDayHolder {
  const generation = cardGenerations.find((item) => item === source.generation)
  return {
    kind,
    ...(source.surname ? { surname: source.surname } : {}),
    ...(source.firstName ? { firstName: source.firstName } : {}),
    ...(source.cardNumber ? { cardNumber: source.cardNumber } : {}),
    ...(source.issuingCountry ? { issuingCountry: source.issuingCountry } : {}),
    ...(source.dateOfExpiry ? { dateOfExpiry: source.dateOfExpiry } : {}),
    ...(generation ? { generation } : {}),
  }
}

export type VehicleDayPrintData = {
  profile: PrintVehicleProfile
  localOffsetMs: number
  history: readonly ActivityHistoryEntry[]
  seconds: readonly SecondActivitySnapshot[]
  events: readonly EventLogEntry[]
  out: readonly OutModeEvent[]
  ferry: readonly FerryTrainEvent[]
  places: readonly RecordedGpsLocation[]
  isCrew: boolean
  resolveCard: (id: string) => VehiclePrintCard | undefined
  /** Karty vložené při vytvoření výtisku, šachta 1 a potom šachta 2. Prázdná šachta se vynechá. */
  insertedHolders: readonly VehicleDayHolder[]
  /** Denní stavy tachometru. Den bez záznamu se v bloku [9] tiskne jen jako datum. */
  dayOdometers: readonly DayOdometerRecord[]
}

type Segment = {
  start: number
  end: number
  cardId: string | undefined
  activity: ActivityKind
  crew: boolean
  open: boolean
}

function buildSlotSegments(
  day: readonly ActivityHistoryEntry[], slot: 1 | 2, to: number, current: boolean,
): Segment[] {
  const segments: Segment[] = []
  for (const entry of day) {
    const start = entry.minuteStartUtc
    const end = Math.min(start + MINUTE, to)
    const cardId = slot === 1 ? entry.driver1CardId : entry.driver2CardId
    const activity = slot === 1 ? entry.driver1 : entry.driver2
    const crew = !!entry.isCrew
    const last = segments[segments.length - 1]
    if (last && last.end === start && last.cardId === cardId && last.activity === activity && last.crew === crew) {
      last.end = end
      last.open = current && end === to
    } else {
      segments.push({ start, end, cardId, activity, crew, open: current && end === to })
    }
  }
  return segments
}

export function buildVehicleDayPrintRows(input: VehicleDayPrintData & {
  selectedDayUtc: number
  printedAtUtc: number
  isUtc: boolean
}) {
  const { selectedDayUtc, printedAtUtc, profile, history, seconds, isUtc } = input
  const from = Math.floor(selectedDayUtc / DAY) * DAY
  const dayEnd = from + DAY
  const to = Math.min(dayEnd, printedAtUtc)
  const offset = isUtc ? 0 : input.localOffsetMs
  const stamp = (time: number) => printTimeUtc(time + offset)
  const inDay = (time: number) => time >= from && time < to
  const currentMinute = Math.floor(printedAtUtc / MINUTE) * MINUTE
  const entries = new Map(history.filter((entry) => inDay(entry.minuteStartUtc))
    .map((entry) => [entry.minuteStartUtc, entry]))
  let recent: SecondActivitySnapshot | undefined
  const cardIdsByMinute = new Map<number, [Set<string>, Set<string>]>()
  for (const sample of seconds) {
    const minute = Math.floor(sample.timestampUtc / MINUTE) * MINUTE
    if (!inDay(minute) || sample.timestampUtc > printedAtUtc) continue
    if (minute === currentMinute && (!recent || sample.timestampUtc >= recent.timestampUtc)) recent = sample
    const entry = entries.get(minute)
    if (!entry) continue
    const cardIds = cardIdsByMinute.get(minute) ?? [new Set<string>(), new Set<string>()]
    if (sample.driver1 === entry.driver1 && sample.driver1CardId != null) cardIds[0].add(sample.driver1CardId)
    if (sample.driver2 === entry.driver2 && sample.driver2CardId != null) cardIds[1].add(sample.driver2CardId)
    cardIdsByMinute.set(minute, cardIds)
  }
  // The recorder finalizes at the next minute boundary. Prefer matching samples
  // when a card was exchanged at that boundary. An ambiguous minute stays unattributed.
  const cardAt = (ids: Set<string>, fallback: string | undefined) =>
    ids.size === 0 ? fallback : ids.size === 1 ? ids.values().next().value : undefined
  for (const [minute, [slot1, slot2]] of cardIdsByMinute) {
    const entry = entries.get(minute)!
    entries.set(minute, { ...entry, driver1CardId: cardAt(slot1, entry.driver1CardId), driver2CardId: cardAt(slot2, entry.driver2CardId) })
  }
  if (recent && !entries.has(currentMinute)) {
    entries.set(currentMinute, { ...recent, minuteStartUtc: currentMinute, isCrew: input.isCrew })
  }
  const day = [...entries.values()].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
  const { rows, add, separator, addLocalTimeWarning } = createPrintRows()

  if (!isUtc) {
    addLocalTimeWarning()
    add(17, 59, ' ', printDateUtc(from + offset), ' ', stamp(from))
    add(59, 17, ' ', printDateUtc(dayEnd + offset), ' ', stamp(dayEnd))
    add(`UTC ${offset < 0 ? '-' : '+'}${duration(Math.abs(offset))}`)
  }
  separator()
  add(18, ' ', printDateUtc(printedAtUtc + offset), ' ', stamp(printedAtUtc), isUtc ? ' (UTC)' : ' (LOC)')
  separator(18)
  add('         GEN2 v2')
  add('24h', 24, 18, ...(isUtc ? [] : [17]))
  // Blok [3] a případný [3a]: jen karty skutečně vložené při tisku, před identifikací vozidla.
  for (const holder of input.insertedHolders) addInsertedHolder(holder)
  separator(24)
  if (profile.vin) add(24, ' ', profile.vin)
  if (profile.registration) add('  ', profile.registrationNation, ' /', profile.registration)
  if (profile.load) add(profile.load === 'passengers' ? 50 : 51)

  const technical = VEHICLE_TECHNICAL_DATA
  separator(6)
  add(6, ' ', technical.tachographManufacturer)
  add('  ', technical.dtcoNumber)
  add(technical.unitGeneration)
  separator(5)
  add(5, ' ', technical.lastCalibration.serviceName)
  add(5, 14, ' ', technical.lastCalibration.workshopCardId)
  add(5, ' ', technical.lastCalibration.date)
  // Blok [7]: poslední kontrola, jen pokud už v čase tisku nastala. Druh (22) = stažení dat z tachografu.
  if (technical.lastControl.atUtc <= printedAtUtc) {
    const controlOperation = { vuDownload: 22 } as const
    separator(4)
    add(4, 14, ' ', technical.lastControl.controlCardId)
    add(4, ' ', printDateUtc(technical.lastControl.atUtc + offset), ' ', stamp(technical.lastControl.atUtc),
      ' ', controlOperation[technical.lastControl.operation])
  }
  separator(17)
  add('       ', printDateUtc(from))
  addDayKilometres()

  function addDayKilometres() {
    const reading = dayKilometresForPrint(input.dayOdometers, from, printedAtUtc)
    if (!reading) return
    const km = (value: number) => `${String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`
    if (reading.startIsMidnight && reading.endIsEndOfDay) {
      add('  ', km(reading.kmAtStart), '  ', km(reading.kmAtEnd))
      return
    }
    const startLabel = reading.startIsMidnight ? '00:00' : stamp(reading.startAtUtc)
    const endLabel = reading.endIsEndOfDay ? '23:59' : stamp(reading.endAtUtc)
    add('  ', startLabel, '  ', km(reading.kmAtStart))
    add('  ', endLabel, '  ', km(reading.kmAtEnd))
  }

  function addInsertedHolder(holder: VehicleDayHolder) {
    const role = holderSymbols[holder.kind]
    separator(role)
    if (holder.surname) add(role, ' ', holder.surname)
    if (holder.firstName) add('  ', holder.firstName)
    if (holder.cardNumber) {
      add(14, ' ', holder.issuingCountry ? `${holder.issuingCountry} /` : '', holder.cardNumber)
    }
    const expiry = holder.dateOfExpiry
    const generation = holder.generation
    if (expiry && generation) {
      const combined = `  ${expiry} - ${generation}`
      if ([...combined.normalize('NFC')].length <= 24) add(combined)
      else {
        add('  ', expiry)
        add('  ', generation)
      }
    } else if (expiry) add('  ', expiry)
    else if (generation) add('  ', generation)
  }

  function cardHeader(id: string | undefined) {
    if (!id) {
      add(11, ' ---')
      return
    }
    if (id === NO_CARD) {
      add(14, '---')
      return
    }
    const card = input.resolveCard(id) ?? (id === 'zmizik' ? getCard1StoredData()
      : id === 'novak' ? getCard2StoredData() : undefined)
    if (card?.surname) add(2, ' ', card.surname)
    if (card?.firstName) add('  ', card.firstName)
    add(2, 14, ' ', card?.issuingCountry ? `${card.issuingCountry} /` : '', card?.cardNumber ?? id)
    if (card?.dateOfExpiry) add('  ', card.dateOfExpiry)
  }

  // Blok [10f]: čas a piktogram specifické podmínky. 59 = od/do podle DTCO 4.1b.
  // Šachta 2 je neopakuje: manuál je řadí do chronologie šachty 1, [10h] je jen šachta 2.
  const conditions: { at: number; pictograms: PrintCell[] }[] = [
    ...input.out.filter((event) => inDay(event.minuteStartUtc)).map((event) => ({
      at: event.minuteStartUtc,
      pictograms: event.type === 'activation' ? ['OUT', 59] : [59, 'OUT'],
    })),
    ...input.ferry.filter((event) => inDay(event.minuteStartUtc)).map((event) => ({
      at: event.minuteStartUtc,
      pictograms: event.type === 'activation' ? [49, 59] : [59, 49],
    })),
  ].sort((a, b) => a.at - b.at)
  const lastOutBefore = input.out.filter((event) => event.minuteStartUtc < from)
    .reduce<OutModeEvent | undefined>((last, event) => !last || event.minuteStartUtc >= last.minuteStartUtc ? event : last, undefined)
  if (lastOutBefore?.type === 'activation') separator('OUT')

  type Total = { times: Record<ActivityKind, number>; crew: number }
  const totals = new Map<string, Total>()
  for (const slot of [1, 2] as const) {
    separator(slot === 1 ? 12 : 13)
    const segments = buildSlotSegments(day, slot, to, to < dayEnd && entries.has(currentMinute))
    // Historical segments end at midnight. Only the current day can display an open row.
    const marks = slot === 1 ? conditions : []
    let markIndex = 0
    let previous: Segment | undefined
    const addMark = () => {
      const mark = marks[markIndex++]
      add('  ', stamp(mark.at), ' ', ...mark.pictograms)
    }
    for (const segment of segments) {
      if (!previous || previous.cardId !== segment.cardId || previous.end !== segment.start) {
        if (previous) separator()
        cardHeader(segment.cardId)
      }
      while (markIndex < marks.length && marks[markIndex].at < segment.start) addMark()
      add(symbols[segment.activity], ' ', stamp(segment.start),
        segment.open ? '' : ' ' + duration(segment.end - segment.start),
        ...(segment.crew ? [' ', 2, 2] : []))
      while (markIndex < marks.length && marks[markIndex].at <= segment.end) addMark()
      previous = segment
      const key = segment.cardId === NO_CARD || !segment.cardId
        ? `${slot}:${segment.cardId ?? "?"}` : segment.cardId
      const total = totals.get(key) ?? { times: { driving: 0, otherWork: 0, availability: 0, rest: 0, none: 0 }, crew: 0 }
      const minutes = Math.floor((segment.end - segment.start) / MINUTE) * MINUTE
      total.times[segment.activity] += minutes
      if (segment.crew) total.crew += minutes
      totals.set(key, total)
    }
    if (!segments.length) add('---')
    while (markIndex < marks.length) addMark()
  }

  separator(40)
  const placeSymbols = { start_country: 36, end_country: 41, end_country_card: 41,
    gps_3h: 29, load: 52, unload: 53, load_unload: 54, border_crossing: 43 }
  for (const place of [...input.places].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)) {
    if (inDay(place.minuteStartUtc)) add(placeSymbols[place.recordType ?? 'gps_3h'], ' ', stamp(place.minuteStartUtc), ' ', place.gpsLocation)
  }
  for (const [key, total] of [...totals].sort(([a], [b]) => Number(!a.endsWith(':' + NO_CARD)) - Number(!b.endsWith(':' + NO_CARD)))) {
    separator()
    if (key.endsWith(':' + NO_CARD)) {
      add(key.startsWith('1:') ? 12 : 13, 14, '---')
    } else if (key.endsWith(':?')) {
      add(key.startsWith('1:') ? 12 : 13, 11, ' ---')
    } else {
      cardHeader(key)
    }
    for (const activity of activities) {
      if (activity !== 'none' || total.times.none) add(symbols[activity], ' ', duration(total.times[activity]))
    }
    if (total.crew) add(2, 2, ' ', duration(total.crew))
  }

  const incidents = input.events.filter((event) => event.startTime < to && (event.endTime ?? printedAtUtc) >= from)
  if (incidents.length) {
    separator(27, 34)
    for (const event of [...incidents].sort((a, b) => a.startTime - b.startTime)) {
      add(27, 2, 14, ' ', printDateUtc(event.startTime + offset), ' ', stamp(event.startTime))
      if (event.endTime != null) add('   ', duration(event.endTime - event.startTime))
    }
  }
  separator()
  add(4, ' ', '.'.repeat(22))
  add(2, ' ', '.'.repeat(22))
  return rows
}
