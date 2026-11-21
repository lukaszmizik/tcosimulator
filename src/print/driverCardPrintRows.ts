import { segmentToMsUtc } from '../CardLogic'
import { getCard1StoredData, getCard2StoredData } from '../data/card_stored_data'
import { VEHICLE_TECHNICAL_DATA } from '../data/vehicle_technical_data'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import type { CardData, EventLogEntry, ManualEntrySegment } from '../TachoTypes'
import type { DddCardIncident, DddParsedCard, DddVehicleUse } from '../types/tachoViewerDddMapper'
import {
  prepareDriver1Print24hUtc,
  type Driver1Print24hActivity,
  type Driver1PrintCardActivity,
} from './prepareDriver1Print24h'

export type PrintCell = string | number
export type PrintRow = PrintCell[]
type PrintMark = { atUtc: number; kind: string; detail?: string; odometerKm?: number | null }

const columns = 24
const minuteMs = 60_000
const activitySymbols = { DRIVING: 2, WORK: 9, AVAILABILITY: 7, REST: 8, UNKNOWN: 11 } as const
const locationSymbols: Record<string, number> = {
  start_country: 36, end_country: 41, gps: 29, border_crossing: 43, load: 52, unload: 53, load_unload: 54,
}
const pad = (n: number) => String(n).padStart(2, '0')

export function printTimeUtc(ms: number): string {
  const date = new Date(ms)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

export function printDateUtc(ms: number): string {
  const value = new Date(ms)
  return `${pad(value.getUTCDate())}.${pad(value.getUTCMonth() + 1)}.${value.getUTCFullYear()}`
}

export function duration(ms: number): string {
  const minutes = Math.floor(ms / minuteMs)
  return `${pad(Math.floor(minutes / 60))}h${pad(minutes % 60)}`
}

function cells(parts: PrintCell[]): PrintRow {
  return parts.flatMap<PrintCell>((part) => typeof part === 'number' ? [part] : [...part.normalize('NFC')])
}

function divider(...symbols: PrintCell[]): PrintRow {
  const middle = cells(symbols)
  const left = Math.floor((columns - middle.length) / 2)
  return [...Array<string>(left).fill('-'), ...middle, ...Array<string>(columns - left - middle.length).fill('-')]
}

export function createPrintRows() {
  const rows: PrintRow[] = []
  const add = (...parts: PrintCell[]) => {
    const line = cells(parts)
    for (let start = 0; start < line.length; start += columns) rows.push(line.slice(start, start + columns))
  }
  const separator = (...parts: PrintCell[]) => rows.push(divider(...parts))

  const addLocalTimeWarning = () => {
    separator()
    add('!!! No legal printout!!!')
    separator()
  }

  return { rows, add, separator, addLocalTimeWarning }
}

function kilometers(km: number): string {
  return `${String(Math.trunc(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`
}

export function printCardHolder(card: CardData | null, imported?: DddParsedCard | null) {
  if (imported) return imported
  if (card?.templateId) {
    const stored = card.templateId === 'zmizik' ? getCard1StoredData() : getCard2StoredData()
    const name = card.name.trim()
    const surnameStart = name.lastIndexOf(' ') + 1
    return {
      ...stored,
      firstName: name.slice(0, surnameStart).trimEnd(),
      surname: card.surname || name.slice(surnameStart),
      dateOfExpiry: card.trainingExpiryUtc == null ? stored.dateOfExpiry : printDateUtc(card.trainingExpiryUtc),
      dateOfIssue: card.trainingValidityBeginUtc == null ? stored.dateOfIssue : printDateUtc(card.trainingValidityBeginUtc),
    }
  }
  return { firstName: card?.name, surname: card?.surname, cardNumber: card?.cardNumber, issuingCountry: '', dateOfExpiry: undefined }
}

export type DailyCardPrintInput = {
  selectedDayUtc: number
  printedAtUtc: number
  localOffsetMs: number
  isUtc: boolean
  profile: PrintVehicleProfile
  card: CardData | null
  secondCard: CardData | null
  imported?: DddParsedCard | null
  secondImported?: DddParsedCard | null
  manual: readonly ManualEntrySegment[]
  simulated: readonly Driver1PrintCardActivity[]
  vehicleEvents: readonly EventLogEntry[]
  simulatedConditions?: readonly PrintMark[]
  simulatedPlaces?: readonly PrintMark[]
}

export function buildDriverCardPrintRows(input: DailyCardPrintInput): PrintRow[] {
  const { imported, profile, printedAtUtc } = input
  const offset = input.isUtc ? 0 : input.localOffsetMs
  const day = prepareDriver1Print24hUtc(
    input.selectedDayUtc, input.manual, [...(imported?.activities ?? []), ...input.simulated],
  )
  const from = day.dayStartMs
  const to = Math.min(day.dayEndMs, printedAtUtc)
  const inDay = (at: number) => at >= from && at < to
  const stamp = (at: number) => printTimeUtc(at + offset)
  const { rows, add, separator, addLocalTimeWarning } = createPrintRows()

  function addHolder(data: ReturnType<typeof printCardHolder>, icon: number) {
    separator(icon)
    if (data.surname) add(icon, ' ', data.surname)
    if (data.firstName) add('  ', data.firstName)
    if (data.cardNumber) add(14, ' ', data.issuingCountry ? `${data.issuingCountry} /` : '', data.cardNumber)
    if (data.dateOfExpiry) add('  ', data.dateOfExpiry)
  }

  if (!input.isUtc) {
    addLocalTimeWarning()
    const end = day.dayEndMs
    add(36, ' ', printDateUtc(from + offset), ' ', stamp(from))
    add(41, ' ', printDateUtc(end + offset), ' ', stamp(end))
    add(`UTC ${offset < 0 ? '-' : '+'}${duration(Math.abs(offset))}`)
    separator()
  }
  add(18, ' ', printDateUtc(printedAtUtc + offset), ' ', stamp(printedAtUtc), input.isUtc ? ' (UTC)' : ' (LOC)')
  separator(18)
  const generation = imported ? imported.generation : 'GEN2 v2'
  if (generation) add('         ', generation)
  add('24h', 14, 18, ...(input.isUtc ? [] : [17]))
  addHolder(printCardHolder(input.card, imported), 14)
  if (input.secondCard) addHolder(printCardHolder(input.secondCard, input.secondImported), 2)

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

  const control = imported?.printLastControl
  if (control && control.atUtc <= printedAtUtc) {
    separator(4)
    add(4, 14, ' ', control.cardNumber)
    add(4, ' ', printDateUtc(control.atUtc + offset), ' ', stamp(control.atUtc))
  }

  separator(14)
  const dailyRecord = imported?.printDays?.[new Date(from).toISOString().slice(0, 10)]
  add('   ', printDateUtc(from), dailyRecord?.presence == null ? '' : ` ${dailyRecord.presence}`)
  const uses = (imported?.vehicleUses ?? [])
    .filter((use) => use.fromUtc < to && use.toUtc > from)
    .sort((a, b) => a.fromUtc - b.fromUtc)
  const conditions = [
    ...(imported?.specificConditions ?? []),
    ...(input.simulatedConditions ?? []),
  ].sort((a, b) => a.atUtc - b.atUtc)
  const conditionKey = (condition: PrintMark) => `${condition.atUtc}:${condition.kind}`
  const distinctConditions = [...new Map(conditions.map((condition) => [conditionKey(condition), condition])).values()]
  const priorOut = distinctConditions.filter((c) => c.atUtc < from && (c.kind === 'out' || c.kind === 'out_end')).pop()
  if (priorOut?.kind === 'out') separator('OUT')

  let context: { slot?: 1 | 2; registration?: string; use?: DddVehicleUse } = {}

  function closeVehicle(at: number) {
    const use = context.use
    if (!use || use.toUtc > at || !inDay(use.toUtc)) return
    add('  ', use.odometerEndKm == null ? '' : kilometers(use.odometerEndKm), '  ',
      use.kilometers == null ? '' : kilometers(use.kilometers))
  }

  const activities: Driver1Print24hActivity[] = []
  let cursor = from
  const records = day.activities.filter((item) => item.startMs < to)
  for (const item of records) {
    if (item.startMs > cursor) activities.push({ activityId: 'UNKNOWN', startMs: cursor, endMs: item.startMs, isManualEntry: false })
    const endMs = Math.min(item.endMs, to)
    activities.push({ ...item, endMs })
    cursor = endMs
  }
  if (to > cursor) {
    activities.push({ activityId: 'UNKNOWN', startMs: cursor, endMs: to, isManualEntry: false })
  }

  function addActivity(item: Driver1Print24hActivity) {
    const slot = item.isManualEntry || item.activityId === 'UNKNOWN' ? undefined : item.slot
    const use = slot && !item.simulated ? uses.find((candidate) => candidate.fromUtc <= item.startMs &&
      candidate.toUtc > item.startMs && (!item.registration || item.registration === candidate.registration)) : undefined
    const registration = slot ? use?.registration ?? item.registration ?? (!imported || item.simulated ? profile.registration : undefined) : undefined
    if (context.slot !== slot || context.use !== use || context.registration !== registration) {
      closeVehicle(item.startMs)
      context = { slot, use, registration }
      separator(slot ? (slot === 1 ? 12 : 13) : 11)
      if (registration) add(24, ' ', use?.registrationNation ?? (!imported || item.simulated ? profile.registrationNation : ''), ' /', registration)
      if (use?.odometerBeginKm != null && use.fromUtc >= from) add('  ', kilometers(use.odometerBeginKm))
    }
    add(activitySymbols[item.activityId], ' ', stamp(item.startMs), item.open ? '' : ` ${duration(item.endMs - item.startMs)}`,
      ...(item.isCrew ? [' ', 2, 2] : []))
  }

  function addCondition(item: PrintMark) {
    if (item.kind === 'out' || item.kind === 'out_end') {
      add(item.kind === 'out' ? 'OUT ' : ' OUT', ' ', stamp(item.atUtc), item.kind === 'out' ? ' +' : ' -')
    } else if (item.kind === 'ferry' || item.kind === 'ferry_end') {
      add(49, ' ', stamp(item.atUtc), item.kind === 'ferry' ? ' +' : ' -')
    }
  }

  const timeline = [
    ...activities.map((item) => ({ at: item.startMs, render: () => addActivity(item) })),
    ...distinctConditions.filter((item) => inDay(item.atUtc)).map((item) => ({ at: item.atUtc, render: () => addCondition(item) })),
  ].sort((a, b) => a.at - b.at)
  for (const item of timeline) item.render()
  closeVehicle(to)

  separator(40)
  const places: PrintMark[] = [
    ...(imported?.locations ?? []).flatMap((location) => {
      const kind = location.recordType ?? 'gps'
      if (!(kind in locationSymbols)) return []
      const coordinates = location.latitude == null || location.longitude == null ? ''
        : `${location.latitude} ${location.longitude}`
      return [{ atUtc: location.recordedAtUtc, kind, detail: [location.countryCode, coordinates || location.label].filter(Boolean).join(' ') }]
    }),
    ...(input.simulatedPlaces ?? []),
    ...input.manual.flatMap((segment) => segment.activityId === 'START_COUNTRY' || segment.activityId === 'END_COUNTRY'
      ? [{ atUtc: segmentToMsUtc(segment), kind: segment.activityId.toLowerCase(), detail: segment.countryCode }]
      : []),
    ...(imported?.loadUnloadEntries ?? []).map((entry) => ({
      atUtc: entry.atUtc, kind: entry.kind === 'both' ? 'load_unload' : entry.kind,
      detail: entry.location ?? undefined, odometerKm: entry.odometerKm,
    })),
  ]
  const placeKeys = new Set<string>()
  for (const item of places.filter((place) => inDay(place.atUtc) && place.kind in locationSymbols).sort((a, b) => a.atUtc - b.atUtc)) {
    const key = `${item.atUtc}:${item.kind}`
    if (placeKeys.has(key)) continue
    placeKeys.add(key)
    add(locationSymbols[item.kind], ' ', stamp(item.atUtc), ' ', item.detail ?? '')
    if (item.odometerKm != null) add('  ', kilometers(item.odometerKm))
  }
  const totals = { DRIVING: 0, WORK: 0, AVAILABILITY: 0, REST: 0, UNKNOWN: 0 }
  let crew = 0
  for (const item of activities) {
    if (item.open) continue
    totals[item.activityId] += item.endMs - item.startMs
    if (item.isCrew) crew += item.endMs - item.startMs
  }
  const hasSimulatedDriving = activities.some((item) => item.simulated && item.activityId === 'DRIVING')
  const inferredDistance = uses.length > 0 && uses.every((use) =>
    use.fromUtc >= from && use.toUtc < to && use.kilometers != null)
    ? uses.reduce((km, use) => km + (use.kilometers ?? 0), 0) : null
  const distance = hasSimulatedDriving ? null : dailyRecord?.distance ?? inferredDistance
  add(2, ' ', duration(totals.DRIVING), distance == null ? '' : ` ${kilometers(distance)}`)
  add(9, ' ', duration(totals.WORK), '  ', 7, ' ', duration(totals.AVAILABILITY))
  add(8, ' ', duration(totals.REST), '  ', 11, ' ', duration(totals.UNKNOWN))
  add(2, 2, ' ', duration(crew))

  function addIncident(incident: DddCardIncident, icon: number) {
    add(icon, ' ', printDateUtc(incident.fromUtc + offset), ' ', stamp(incident.fromUtc))
    add('  ', incident.typeLabel)
    if (incident.toUtc != null) add('  ', duration(incident.toUtc - incident.fromUtc))
    if (incident.registration) add(24, ' ', incident.registration)
  }

  separator(27, 34, 14)
  const incidents = [
    ...(imported?.events ?? []).map((item) => ({ item, icon: 27 })),
    ...(imported?.faults ?? []).map((item) => ({ item, icon: 34 })),
  ].filter(({ item }) => item.fromUtc <= printedAtUtc).sort((a, b) => b.item.fromUtc - a.item.fromUtc)
  for (const { item, icon } of incidents.slice(0, 5)) addIncident(item, icon)
  separator(27, 34, 24)
  const vehicleEvents = input.vehicleEvents.filter((item) => item.startTime <= printedAtUtc)
    .sort((a, b) => b.startTime - a.startTime).slice(0, 5)
  for (const item of vehicleEvents) {
    addIncident({
      fromUtc: item.startTime, toUtc: item.endTime ?? null, registration: null,
      typeLabel: item.type === 'DRIVING_WITHOUT_CARD' ? 'Jízda bez karty' : 'Jízda bez platné karty',
    }, 27)
  }
  separator()
  add(4, 37, ' ', '.'.repeat(21))
  add(4, '  ', '.'.repeat(21))
  add(2, '  ', '.'.repeat(21))
  separator(18)
  add('24h', 14, 18)
  if (profile.companyName || profile.companyAddress || profile.companyId) {
    separator(3)
    if (profile.companyName) add(profile.companyName)
    if (profile.companyAddress) add(profile.companyAddress)
    if (profile.companyId) add('IČO ', profile.companyId)
  }
  return rows
}
