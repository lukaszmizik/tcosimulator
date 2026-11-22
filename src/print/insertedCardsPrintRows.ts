/**
 * Výtisk vložených karet PRT_014. Časy přebírá ze vstupu, historii sám nevytváří.
 */

import { knownCardGeneration } from '../data/card_stored_data'
import { createPrintRows, duration, printDateUtc, printTimeUtc, type PrintCell, type PrintRow } from './driverCardPrintRows'
import {
  selectInsertedCardsForPrint,
  type VehicleCardInsertion,
  type VehicleCardType,
} from './vehicleCardInsertions'

export type InsertedCardsPrintInput = {
  printedAtUtc: number
  isUtc: boolean
  localOffsetMs: number
  insertedNow: readonly VehicleCardInsertion[]
  insertionHistory: readonly VehicleCardInsertion[]
}

const holderSymbols: Record<VehicleCardType, number> = {
  driver: 2, company: 3, control: 4, workshop: 5,
}

function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function expiryText(entry: VehicleCardInsertion): string | undefined {
  return filled(entry.expiresLabel) ?? (entry.expiresAtUtc != null ? printDateUtc(entry.expiresAtUtc) : undefined)
}

export function buildInsertedCardsPrintRows(input: InsertedCardsPrintInput): PrintRow[] {
  const offset = input.isUtc ? 0 : input.localOffsetMs
  const stamp = (utc: number) => `${printDateUtc(utc + offset)} ${printTimeUtc(utc + offset)}`
  const { rows, add, separator, addLocalTimeWarning } = createPrintRows()

  if (!input.isUtc) {
    addLocalTimeWarning()
    add('UTC ', offset < 0 ? '-' : '+', duration(Math.abs(offset)))
  }
  add(18, ' ', stamp(input.printedAtUtc), input.isUtc ? ' (UTC)' : ' (LOC)')
  separator(18)
  add('         GEN2 v2')
  add(6, 14, 17, 18, ...(input.isUtc ? [] : [17]))

  const holders = [...input.insertedNow].sort((a, b) => a.slot - b.slot || a.insertedAtUtc - b.insertedAtUtc)
  for (const holder of holders) addHolder(holder)
  for (const entry of selectInsertedCardsForPrint(input.insertionHistory, input.printedAtUtc)) addHistory(entry)

  separator()
  add(4, 37, ' ', '.'.repeat(21))
  add(4, '  ', '.'.repeat(21))
  add(17, '  ', '.'.repeat(21))
  return rows

  function addHolder(entry: VehicleCardInsertion) {
    const role = holderSymbols[entry.cardType]
    separator(role)
    const surname = filled(entry.surnameOrOrganisation)
    const firstName = filled(entry.firstName)
    if (surname) add(role, ' ', surname)
    if (firstName) add('  ', firstName)
    addIdentification(entry)
    const expiry = expiryText(entry)
    const generation = cardGeneration(entry)
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

  function addHistory(entry: VehicleCardInsertion) {
    separator()
    const identification = filled(entry.cardIdentification)
    if (identification) addIdentification(entry)
    const extra = [cardGeneration(entry), entry.cardVersion, entry.manufacturerCode].map(filled).filter(Boolean).join(' ')
    if (!identification) {
      if (extra) add(holderSymbols[entry.cardType], ' ', extra)
      else add(holderSymbols[entry.cardType])
    } else if (extra) add('  ', extra)
    const serial = filled(entry.cardSerialNumber)
    if (serial) add('  ', serial)
    add(stamp(entry.insertedAtUtc))
  }

  function cardGeneration(entry: VehicleCardInsertion): string | undefined {
    return filled(entry.cardGeneration) ?? knownCardGeneration(entry.cardIdentification)
  }

  function addIdentification(entry: VehicleCardInsertion) {
    const identification = filled(entry.cardIdentification)
    if (!identification) return
    const country = filled(entry.issuingCountry)
    const parts: PrintCell[] = [holderSymbols[entry.cardType], 14, ' ']
    if (country) parts.push(`${country} /`)
    parts.push(identification)
    add(...parts)
  }
}
