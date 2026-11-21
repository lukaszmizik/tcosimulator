import type { FaultOrEvent } from '../TachoTypes'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import { createPrintRows, duration, printDateUtc, printTimeUtc } from './driverCardPrintRows'
import type { VehiclePrintCard } from './vehicleDayPrintRows'

const DAY = 86_400_000

type EventKind = 'DRIVING_WITHOUT_CARD_WARNING' | 'EXCESS_SPEED_WARNING'

type PrintableEntry = {
  record: FaultOrEvent
  elapsed: number
  purpose: number
  pictograms: number[]
  typeCode: string | null
}

function collectTypedEvents(
  records: readonly FaultOrEvent[],
  printedAtUtc: number,
  type: EventKind,
  pictograms: number[],
  typeCode: string | null,
): PrintableEntry[] {
  const matched = records.filter(record => record.kind === 'event'
    && record.type === type && record.timestampUtc <= printedAtUtc)
  const dayOf = (record: FaultOrEvent) => Math.floor(record.timestampUtc / DAY)
  const completed = matched.flatMap(record => typeof record.endUtc === 'number'
    && record.endUtc >= record.timestampUtc && record.endUtc <= printedAtUtc
    ? [{ record, elapsed: record.endUtc - record.timestampUtc }] : [])
  completed.sort((a, b) => b.elapsed - a.elapsed || b.record.timestampUtc - a.record.timestampUtc)
  const recentDays = new Set(
    [...new Set(matched.map(dayOf))].sort((a, b) => b - a).slice(0, 10),
  )
  const printedDays = new Set<number>()
  const entries: PrintableEntry[] = []
  for (const entry of completed) {
    const day = dayOf(entry.record)
    if (recentDays.has(day) && !printedDays.has(day)) {
      printedDays.add(day)
      entries.push({ ...entry, purpose: 1, pictograms, typeCode })
    }
  }
  entries.push(...completed.filter(({ record }) => record.timestampUtc >= printedAtUtc - 365 * DAY)
    .slice(0, 5).map(entry => ({ ...entry, purpose: 2, pictograms, typeCode })))
  entries.push(...matched.filter(record => record.endUtc === null).map(record => ({
    record,
    elapsed: printedAtUtc - record.timestampUtc,
    purpose: 7,
    pictograms,
    typeCode,
  })))
  return entries
}

export function buildVehicleEventPrintRows(input: {
  records: readonly FaultOrEvent[]
  profile: PrintVehicleProfile
  card: VehiclePrintCard | null
  printedAtUtc: number
  localOffsetMs: number
  isUtc: boolean
}) {
  const { records, profile, card, printedAtUtc, isUtc } = input
  const offset = isUtc ? 0 : input.localOffsetMs
  const stamp = (utc: number) => printDateUtc(utc + offset) + ' ' + printTimeUtc(utc + offset)
  const { rows, add, separator, addLocalTimeWarning } = createPrintRows()
  if (!isUtc) {
    addLocalTimeWarning()
    add('UTC ', offset < 0 ? '-' : '+', duration(Math.abs(offset)))
  }
  add(18, ' ', stamp(printedAtUtc), isUtc ? ' (UTC)' : ' (LOC)')
  separator(18)
  add('         GEN2 v2')
  add(27, 34, 24, 18)
  separator(14)
  if (card) {
    add(14, ' ', card.surname ?? '')
    if (card.firstName) add('  ', card.firstName)
    if (card.cardNumber) add(14, ' ', card.issuingCountry ?? '', ' /', card.cardNumber)
    if (card.dateOfExpiry) add(card.dateOfExpiry)
  } else {
    add(14, '---')
  }
  separator(24)
  if (profile.vin) add(24, ' ', profile.vin)
  if (profile.registration) add('  ', profile.registrationNation, ' /', profile.registration)
  if (profile.load) add(profile.load === 'passengers' ? 50 : 51)

  // DTCO 4.1b: !04 jízda bez karty + (39)(39) příliš vysoká rychlost (dříve filtr jen !04).
  const noCard = collectTypedEvents(records, printedAtUtc, 'DRIVING_WITHOUT_CARD_WARNING', [27, 2, 14], '!04')
  const speeding = collectTypedEvents(records, printedAtUtc, 'EXCESS_SPEED_WARNING', [39, 39], null)
  const dayOf = (record: FaultOrEvent) => Math.floor(record.timestampUtc / DAY)
  const countFor = (type: EventKind, record: FaultOrEvent) =>
    records.filter(r => r.kind === 'event' && r.type === type
      && dayOf(r) === dayOf(record) && r.timestampUtc <= printedAtUtc).length

  const entries = [...noCard, ...speeding]
  if (entries.length > 0) {
    separator(27, 24)
    entries.forEach(({ record, elapsed, purpose, pictograms, typeCode }, index) => {
      if (index > 0) separator()
      add(...pictograms, '  ', String(purpose), ' ', stamp(record.timestampUtc))
      const count = `(${countFor(record.type as EventKind, record)})`
      const elapsedText = duration(elapsed)
      const left = typeCode ? `${typeCode}    ${count}` : `      ${count}`
      add(left.padEnd(24 - elapsedText.length), elapsedText)
      const driver = record.overspeed?.driver
      if (driver?.cardNumber) add(14, ' ', driver.cardNumber)
      else add(14, '---')
    })
  }
  separator()
  add(4, 37, ' .....................')
  add(4, '  .....................')
  add(17, '  .....................')
  add('   .....................')
  return rows
}
