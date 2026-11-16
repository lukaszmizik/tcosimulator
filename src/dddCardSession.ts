/**
 * Vložení karty z DDD a její pracovní kopie.
 * Původní výpis se nemění. Cílovou šachtu určuje až přetažení.
 */

import type { ActivityHistoryEntry, CardData, ManualEntrySegment } from './TachoTypes'
import type { DddParsedCard } from './types/tachoViewerDddMapper'
import { buildDddCardPreview, type DddCardPreview } from './dddCardPreview'

export const DDD_INSERT_MISSING_WITHDRAWAL =
  'Začátek ručního doplnění nelze určit. Výpis neobsahuje čas posledního použití vozidla (vehicle_last_use).'

export const DDD_INSERT_FUTURE_WITHDRAWAL =
  'Ruční doplnění by začínalo až po simulačním čase. Nejprve upravte čas stávajícím ovládáním.'

export const DDD_INSERT_ALREADY_INSERTED = 'Tato karta už je vložená v druhé šachtě.'

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
  | { ok: false; message: string }

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
    return { ok: false, message: DDD_INSERT_ALREADY_INSERTED }
  }
  const fromVehicle = input.record.vehicleLastUseUtc
  const fromSession = input.record.workingLastWithdrawalUtc
  const startMs = fromSession ?? fromVehicle
  if (startMs == null) {
    return { ok: false, message: DDD_INSERT_MISSING_WITHDRAWAL }
  }
  if (startMs > input.simulatedNowMs) {
    return { ok: false, message: DDD_INSERT_FUTURE_WITHDRAWAL }
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
