import type { FaultOrEvent } from '../TachoTypes'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import { createPrintRows, duration, printDateUtc, printTimeUtc } from './driverCardPrintRows'
import type { VehiclePrintCard } from './vehicleDayPrintRows'

const DAY = 86_400_000

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

  // DTCO 4.1b manual, pp. 135, 149–150. Only !04 currently has the required lifecycle data.
  const noCard = records.filter(record => record.kind === 'event'
    && record.type === 'DRIVING_WITHOUT_CARD_WARNING' && record.timestampUtc <= printedAtUtc)
  const eventsByDay = new Map<number, number>()
  const dayOf = (record: FaultOrEvent) => Math.floor(record.timestampUtc / DAY)
  for (const record of noCard) {
    const day = dayOf(record)
    eventsByDay.set(day, (eventsByDay.get(day) ?? 0) + 1)
  }
  const completed = noCard.flatMap(record => typeof record.endUtc === 'number'
    && record.endUtc >= record.timestampUtc && record.endUtc <= printedAtUtc
    ? [{ record, elapsed: record.endUtc - record.timestampUtc }] : [])
  completed.sort((a, b) => b.elapsed - a.elapsed || b.record.timestampUtc - a.record.timestampUtc)
  const recentDays = new Set([...eventsByDay.keys()].sort((a, b) => b - a).slice(0, 10))
  const printedDays = new Set<number>()
  const entries: { record: FaultOrEvent; elapsed: number; purpose: number }[] = []
  for (const entry of completed) {
    const day = dayOf(entry.record)
    if (recentDays.has(day) && !printedDays.has(day)) {
      printedDays.add(day)
      entries.push({ ...entry, purpose: 1 })
    }
  }
  entries.push(...completed.filter(({ record }) => record.timestampUtc >= printedAtUtc - 365 * DAY)
    .slice(0, 5).map(entry => ({ ...entry, purpose: 2 })))
  entries.push(...noCard.filter(record => record.endUtc === null).map(record => ({
    record, elapsed: printedAtUtc - record.timestampUtc, purpose: 7,
  })))

  if (entries.length > 0) {
    separator(27, 24)
    entries.forEach(({ record, elapsed, purpose }, index) => {
      if (index > 0) separator()
      add(27, 2, 14, '  ', String(purpose), ' ', stamp(record.timestampUtc))
      const count = `(${eventsByDay.get(dayOf(record))})`
      const elapsedText = duration(elapsed)
      add(`!04    ${count}`.padEnd(24 - elapsedText.length), elapsedText)
      add(14, '---')
    })
  }
  separator()
  add(4, 37, ' .....................')
  add(4, '  .....................')
  add(17, '  .....................')
  add('   .....................')
  return rows
}
