/**
 * Evidence skutečných vložení karet do paměti vozidlové jednotky.
 * Záznam vzniká jen při přijetí karty, výběr a tisk z něj nic nepřidávají.
 */

import type { CardData } from '../TachoTypes'
import type { DddParsedCard } from '../types/tachoViewerDddMapper'
import { printCardHolder, printDateUtc } from './driverCardPrintRows'

export const INSERTED_CARDS_PRINT_LIMIT = 88
const STORAGE_KEY = 'tcosimulator.vehicleCardInsertions'

export type VehicleCardType = 'driver' | 'company' | 'control' | 'workshop'
export type VehicleCardGeneration = 'GEN1' | 'GEN2' | 'GEN2 v2'

export type VehicleCardInsertion = {
  id: string
  insertedAtUtc: number
  slot: 1 | 2
  cardType: VehicleCardType
  cardIdentification?: string
  issuingCountry?: string
  cardSerialNumber?: string
  cardGeneration?: VehicleCardGeneration
  cardVersion?: string
  manufacturerCode?: string
  surnameOrOrganisation?: string
  firstName?: string
  expiresAtUtc?: number
  expiresLabel?: string
}

const cardTypes = new Set<VehicleCardType>(['driver', 'company', 'control', 'workshop'])
const generations = new Set<VehicleCardGeneration>(['GEN1', 'GEN2', 'GEN2 v2'])

function knownGeneration(value: string | undefined): VehicleCardGeneration | undefined {
  return value != null && generations.has(value as VehicleCardGeneration) ? value as VehicleCardGeneration : undefined
}

function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function snapshotDriverInsertion(input: {
  insertedAtUtc: number
  slot: 1 | 2
  sequence: number
  card: CardData
  imported?: DddParsedCard | null
}): VehicleCardInsertion {
  const imported = input.imported ?? null
  const holder = printCardHolder(input.card, null)
  const identification = text(imported?.cardNumber) ?? text(holder.cardNumber)
  const expiry = input.card.trainingExpiryUtc != null
    ? printDateUtc(input.card.trainingExpiryUtc)
    : text(imported?.dateOfExpiry) ?? text(holder.dateOfExpiry)
  return {
    id: `${input.insertedAtUtc}:${input.slot}:${identification ?? 'card'}:${input.sequence}`,
    insertedAtUtc: input.insertedAtUtc,
    slot: input.slot,
    cardType: 'driver',
    cardIdentification: identification,
    issuingCountry: text(imported?.issuingCountry) ?? text(holder.issuingCountry),
    surnameOrOrganisation: text(imported?.surname) ?? text(holder.surname),
    firstName: text(imported?.firstName) ?? text(holder.firstName),
    expiresLabel: expiry,
    cardGeneration: knownGeneration(imported?.generation),
  }
}

export function appendVehicleCardInsertion(
  history: readonly VehicleCardInsertion[],
  entry: VehicleCardInsertion,
): VehicleCardInsertion[] {
  if (history.some((item) => item.id === entry.id)) return history.slice()
  return [...history, entry]
}

/** Nejnovějších 88 záznamů, které už v čase tisku nastaly, v chronologickém pořadí. */
export function selectInsertedCardsForPrint(
  history: readonly VehicleCardInsertion[],
  printedAtUtc: number,
): VehicleCardInsertion[] {
  return history
    .filter((item) => item.insertedAtUtc <= printedAtUtc)
    .sort((a, b) => b.insertedAtUtc - a.insertedAtUtc || b.id.localeCompare(a.id))
    .slice(0, INSERTED_CARDS_PRINT_LIMIT)
    .sort((a, b) => a.insertedAtUtc - b.insertedAtUtc || a.id.localeCompare(b.id))
}

export function currentVehicleCardInsertion(
  history: readonly VehicleCardInsertion[],
  slot: 1 | 2,
  identification: string | undefined,
): VehicleCardInsertion | null {
  const cardId = text(identification)
  if (!cardId) return null
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index]!
    if (item.slot === slot && item.cardIdentification === cardId) return item
  }
  return null
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? text(value) : undefined
}

function isVehicleCardInsertion(value: unknown): value is VehicleCardInsertion {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<VehicleCardInsertion>
  return typeof item.id === 'string'
    && item.id.length > 0
    && typeof item.insertedAtUtc === 'number'
    && Number.isFinite(item.insertedAtUtc)
    && (item.slot === 1 || item.slot === 2)
    && cardTypes.has(item.cardType as VehicleCardType)
}

export function browserCardInsertionStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadVehicleCardInsertions(storage: Pick<Storage, 'getItem'> | null): VehicleCardInsertion[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isVehicleCardInsertion).map((item) => ({
      id: item.id,
      insertedAtUtc: item.insertedAtUtc,
      slot: item.slot,
      cardType: item.cardType,
      cardIdentification: optionalText(item.cardIdentification),
      issuingCountry: optionalText(item.issuingCountry),
      cardSerialNumber: optionalText(item.cardSerialNumber),
      cardGeneration: knownGeneration(optionalText(item.cardGeneration)),
      cardVersion: optionalText(item.cardVersion),
      manufacturerCode: optionalText(item.manufacturerCode),
      surnameOrOrganisation: optionalText(item.surnameOrOrganisation),
      firstName: optionalText(item.firstName),
      expiresAtUtc: typeof item.expiresAtUtc === 'number' && Number.isFinite(item.expiresAtUtc) ? item.expiresAtUtc : undefined,
      expiresLabel: optionalText(item.expiresLabel),
    }))
  } catch {
    return []
  }
}

export function writeVehicleCardInsertions(
  storage: Pick<Storage, 'setItem'> | null,
  entries: readonly VehicleCardInsertion[],
): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Plná paměť prohlížeče nesmí shodit vložení karty.
  }
}
