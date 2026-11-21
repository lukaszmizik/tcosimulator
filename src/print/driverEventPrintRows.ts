/**
 * Výtisk !x(14)(18) – události a poruchy z karty řidiče.
 * DTCO 4.1: bloky [1]–[3], [12a]–[12c] (bez kódu účelu datové sady; ř.3 = SPZ vozidla).
 */

import type { EventLogEntry } from '../TachoTypes'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import type { DddCardIncident } from '../types/tachoViewerDddMapper'
import { createPrintRows, duration, printDateUtc, printTimeUtc } from './driverCardPrintRows'
import type { VehiclePrintCard } from './vehicleDayPrintRows'

export type DriverEventPrintIncident = {
  kind: 'event' | 'fault'
  fromUtc: number
  toUtc: number | null
  /** Piktogramy řádku 1 (např. !04 = 27, 2, 14). */
  pictograms: number[]
  registration: string | null
  registrationNation?: string
}

function fromDdd(item: DddCardIncident, kind: 'event' | 'fault'): DriverEventPrintIncident {
  return {
    kind,
    fromUtc: item.fromUtc,
    toUtc: item.toUtc,
    pictograms: kind === 'fault' ? [34] : [27],
    registration: item.registration,
  }
}

/** Simulované záznamy z eventLog → formát karty. */
export function driverEventsFromEventLog(
  log: readonly EventLogEntry[],
  printedAtUtc: number,
): DriverEventPrintIncident[] {
  return log
    .filter((entry) => entry.startTime <= printedAtUtc)
    .map((entry) => ({
      kind: 'event' as const,
      fromUtc: entry.startTime,
      toUtc: entry.endTime ?? null,
      // !(14)(2) vložení za jízdy; jinak !(2)(14) jízda bez karty
      pictograms: entry.type === 'CARD_INSERTION_WHILE_DRIVING' ? [27, 14, 2] : [27, 2, 14],
      registration: null,
    }))
}

export function buildDriverEventPrintRows(input: {
  importedEvents?: readonly DddCardIncident[]
  importedFaults?: readonly DddCardIncident[]
  simulatedEvents?: readonly DriverEventPrintIncident[]
  profile: PrintVehicleProfile
  card: VehiclePrintCard | null
  printedAtUtc: number
  localOffsetMs: number
  isUtc: boolean
}) {
  const { profile, card, printedAtUtc, isUtc } = input
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
  add(27, 34, 14, 18)
  separator(14)
  if (card) {
    add(14, ' ', card.surname ?? '')
    if (card.firstName) add('  ', card.firstName)
    if (card.cardNumber) add(14, ' ', card.issuingCountry ?? '', ' /', card.cardNumber)
    if (card.dateOfExpiry) add(card.dateOfExpiry)
  } else {
    add(14, '---')
  }

  const incidents: DriverEventPrintIncident[] = [
    ...(input.importedEvents ?? []).map((item) => fromDdd(item, 'event')),
    ...(input.importedFaults ?? []).map((item) => fromDdd(item, 'fault')),
    ...(input.simulatedEvents ?? []),
  ].filter((item) => item.fromUtc <= printedAtUtc)

  // [12a] události, [12b] poruchy – uvnitř podle data (novější dřív, jako u VU výtisku).
  const events = incidents.filter((item) => item.kind === 'event')
    .sort((a, b) => b.fromUtc - a.fromUtc)
  const faults = incidents.filter((item) => item.kind === 'fault')
    .sort((a, b) => b.fromUtc - a.fromUtc)
  const ordered = [...events, ...faults]

  if (ordered.length > 0) {
    separator(27, 34, 14)
    ordered.forEach((item, index) => {
      if (index > 0) separator()
      const end = item.toUtc != null && item.toUtc >= item.fromUtc ? item.toUtc : printedAtUtc
      const elapsed = duration(Math.max(0, end - item.fromUtc))
      add(...item.pictograms, ' ', stamp(item.fromUtc))
      add(elapsed.padStart(24))
      const nation = item.registrationNation ?? profile.registrationNation
      const reg = item.registration ?? profile.registration
      if (reg) add(24, ' ', nation ? `${nation} /` : '', reg)
      else add(24, ' ---')
    })
  }

  separator()
  add(4, 37, ' .....................')
  add(4, '  .....................')
  add(17, '  .....................')
  add('   .....................')
  return rows
}
