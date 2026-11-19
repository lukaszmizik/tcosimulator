/**
 * Vložení karty z DDD a její pracovní kopie.
 * Původní výpis se nemění. Cílovou šachtu určuje až přetažení.
 */

import type { ActivityHistoryEntry, CardData, ManualEntrySegment } from './TachoTypes'
import type { DddParsedCard } from './types/tachoViewerDddMapper'
import { buildDddCardPreview, type DddCardPreview } from './dddCardPreview'

export type DddInsertError = 'missingWithdrawal' | 'futureWithdrawal' | 'alreadyInserted'

export type DddCardRecord = {
  cardNumber: string
  firstName: string
  surname: string
  original: DddParsedCard
  originalPreview: DddCardPreview
  workingActivities: ActivityHistoryEntry[]
  workingManual: ManualEntrySegment[]
  /** Původní čas z vehicle_last_use. Pracovní vyjmutí ho nepřepisuje. */
  vehicleLastUseUtc: number | null
  vehicleLastUseSource: 'vehicle_last_use' | null
  workingLastWithdrawalUtc: number | null
}

export type DddInsertDecision =
  | { ok: true; cardData: CardData; manualBuffer: ManualEntrySegment[] }
  | { ok: false; reason: DddInsertError }

export function createDddCardRecord(card: DddParsedCard): DddCardRecord {
  return {
    cardNumber: card.cardNumber,
    firstName: card.firstName,
    surname: card.surname,
    original: card,
    originalPreview: buildDddCardPreview(card),
    workingActivities: [],
    workingManual: [],
    vehicleLastUseUtc: card.lastWithdrawalUtc,
    vehicleLastUseSource: card.lastWithdrawalUtc != null ? 'vehicle_last_use' : null,
    workingLastWithdrawalUtc: null,
  }
}

export function assessDddInsertion(input: {
  record: DddCardRecord
  simulatedNowMs: number
  otherSlotCardNumber: string | null
}): DddInsertDecision {
  if (input.otherSlotCardNumber === input.record.cardNumber) {
    return { ok: false, reason: 'alreadyInserted' }
  }
  const fromVehicle = input.record.vehicleLastUseUtc
  const fromSession = input.record.workingLastWithdrawalUtc
  const startMs = fromSession ?? fromVehicle
  if (startMs == null) {
    return { ok: false, reason: 'missingWithdrawal' }
  }
  if (startMs > input.simulatedNowMs) {
    return { ok: false, reason: 'futureWithdrawal' }
  }
  const usesVehicleTime = fromSession == null
  return {
    ok: true,
    manualBuffer: input.record.workingManual,
    cardData: {
      name: input.record.firstName,
      surname: input.record.surname,
      lastWithdrawal: startMs,
      lastWithdrawalSource: usesVehicleTime ? 'vehicle_last_use' : undefined,
      cardNumber: input.record.cardNumber,
      isFirstInsertion: false,
    },
  }
}

export function appendWorkingMinutes(
  cards: Record<string, DddCardRecord>,
  cardNumber: string,
  entries: ActivityHistoryEntry[],
): Record<string, DddCardRecord> {
  const card = cards[cardNumber]
  if (!card || entries.length === 0) return cards
  const seen = new Set(card.workingActivities.map((entry) => entry.minuteStartUtc))
  const added = entries.filter((entry) => !seen.has(entry.minuteStartUtc))
  if (added.length === 0) return cards
  return {
    ...cards,
    [cardNumber]: { ...card, workingActivities: [...card.workingActivities, ...added] },
  }
}

export function replaceWorkingManual(
  cards: Record<string, DddCardRecord>,
  cardNumber: string,
  manual: ManualEntrySegment[],
): Record<string, DddCardRecord> {
  const card = cards[cardNumber]
  if (!card) return cards
  return { ...cards, [cardNumber]: { ...card, workingManual: manual } }
}

export function setWorkingWithdrawal(
  cards: Record<string, DddCardRecord>,
  cardNumber: string,
  withdrawalUtc: number,
): Record<string, DddCardRecord> {
  const card = cards[cardNumber]
  if (!card) return cards
  return { ...cards, [cardNumber]: { ...card, workingLastWithdrawalUtc: withdrawalUtc } }
}
