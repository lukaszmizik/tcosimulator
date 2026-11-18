import { VEHICLE_TECHNICAL_DATA } from '../data/vehicle_technical_data'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import { OVERSPEED_LIMIT_KMH } from '../overspeed'
import type { CardData, FaultOrEvent } from '../TachoTypes'
import { createPrintRows, duration, printDateUtc, printTimeUtc } from './driverCardPrintRows'

const DAY_MS = 86_400_000
const SPEED_MARK = [39, 39] as const

export function buildOverspeedPrintRows(
  printedAtUtc: number,
  profile: PrintVehicleProfile,
  card: CardData | null,
  records: readonly FaultOrEvent[],
) {
  const { rows, add, separator } = createPrintRows()
  const timestamp = (utc: number) => printDateUtc(utc) + ' ' + printTimeUtc(utc)

  add(18, ' ', timestamp(printedAtUtc), ' (UTC)')
  separator(18)
  add('         GEN2 v2')
  add(...SPEED_MARK, 18, `  ${OVERSPEED_LIMIT_KMH} km/h`)
  separator(14)
  add(14, card ? ' ' + (card.surname ?? '') : '---')
  if (card?.name) add('  ', card.name)
  if (card?.cardNumber) add(14, ' ', card.cardNumber)
  separator(24)
  if (profile.vin) add(24, ' ', profile.vin)
  if (profile.registration) add('  ', profile.registrationNation, ' /', profile.registration)
  if (profile.load) add(profile.load === 'passengers' ? 50 : 51)

  const completed = records.flatMap(record =>
    record.kind === 'event' && record.type === 'EXCESS_SPEED_WARNING'
    && record.overspeed && typeof record.endUtc === 'number' && record.endUtc <= printedAtUtc
      ? [{ ...record, overspeed: record.overspeed }] : [])
    .sort((a, b) => a.timestampUtc - b.timestampUtc)
  type Entry = typeof completed[number]
  const day = (entry: Entry) => Math.floor(entry.timestampUtc / DAY_MS)
  const severity = (a: Entry, b: Entry) =>
    b.overspeed.averageKmh - a.overspeed.averageKmh || b.timestampUtc - a.timestampUtc
  const byDay = new Map<number, { mostSevere: Entry; count: number }>()
  for (const entry of completed) {
    const key = day(entry)
    const group = byDay.get(key)
    byDay.set(key, {
      mostSevere: group && severity(group.mostSevere, entry) <= 0 ? group.mostSevere : entry,
      count: (group?.count ?? 0) + 1,
    })
  }
  const renderBlock = (entries: readonly Entry[]) => {
    if (!entries.length) add(...SPEED_MARK, '---')
    entries.forEach((entry, index) => {
      if (index) separator()
      const { maxKmh, averageKmh, durationMs, driver } = entry.overspeed
      add(...SPEED_MARK, timestamp(entry.timestampUtc), ' ', duration(durationMs))
      add(`  ${Math.round(maxKmh)} km/h ${Math.round(averageKmh)} km/h (${byDay.get(day(entry))?.count ?? 1})`)
      if (driver?.surname) add(14, ' ', driver.surname)
      if (driver?.name) add('  ', driver.name)
      add(14, driver?.cardNumber ? ' ' + driver.cardNumber : '---')
    })
  }

  // DTCO 4.1b, pp. 136 and 146. The simulator has no recorded speed inspection.
  separator(...SPEED_MARK)
  add(39, 4, '---')
  add(...SPEED_MARK, '---')

  const [calDay, month, year] = VEHICLE_TECHNICAL_DATA.lastCalibration.date.split('.').map(Number)
  const calibration = Date.UTC(year, month - 1, calDay)
  const firstSinceCalibration = completed.find(entry => entry.timestampUtc >= calibration)
  separator(...SPEED_MARK, 5)
  renderBlock(firstSinceCalibration ? [firstSinceCalibration] : [])
  separator(...SPEED_MARK, '(365)')
  renderBlock(completed.filter(entry => entry.timestampUtc >= printedAtUtc - 365 * DAY_MS)
    .sort(severity).slice(0, 5))
  separator(...SPEED_MARK, '(10)')
  renderBlock([...byDay.values()].reverse().slice(0, 10).map(group => group.mostSevere).sort(severity))
  separator()
  add(4, 37, ' .....................')
  add(4, '  .....................')
  add(17, '  .....................')
  add('   .....................')
  return rows
}
