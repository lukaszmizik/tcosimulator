/**
 * Skok při potvrzení „Nastavit čas“.
 * Identita karty je stejná jako při uzávěrce minuty: číslo DDD karty, jinak id šablony.
 * Vygenerované klíče jsou minuty od aktuální simulační minuty až po minutu před cílem.
 * Cílová minuta zůstává běžnému sekundovému kroku. Vzorky rychlosti se tu nevytvářejí.
 */

import { DRIVING_SYMBOL, activityFromChar, getActivityCode } from './CardLogic'
import { NO_CARD, type ActivityHistoryEntry, type ActivityId, type ActivityKind } from './TachoTypes'

export function insertedCardId(
  inserted: boolean,
  cardNumber: string | undefined,
  templateId: string | undefined,
): string {
  return inserted && (cardNumber || templateId) ? (cardNumber ?? templateId)! : NO_CARD
}

export function activitiesForApplyTime(
  speed: number,
  leftActivityId: ActivityId,
  rightActivityId: ActivityId,
): { driver1: ActivityKind; driver2: ActivityKind } {
  const isDriving = speed > 0
  const leftChar = isDriving ? DRIVING_SYMBOL : getActivityCode(leftActivityId)
  const rightChar = isDriving ? getActivityCode('AVAILABILITY') : getActivityCode(rightActivityId)
  return {
    driver1: activityFromChar(leftChar),
    driver2: activityFromChar(rightChar),
  }
}

export function clockAfterApplyTime(
  simulatedUtcMs: number,
  timeOffsetMs: number,
  targetUtcMs: number,
): { deltaMs: number; nextSimulatedUtcMs: number; nextTimeOffsetMs: number } {
  const deltaMs = targetUtcMs - (simulatedUtcMs + timeOffsetMs)
  if (deltaMs <= 0) {
    return {
      deltaMs,
      nextSimulatedUtcMs: simulatedUtcMs,
      nextTimeOffsetMs: targetUtcMs - simulatedUtcMs,
    }
  }
  return {
    deltaMs,
    nextSimulatedUtcMs: simulatedUtcMs + deltaMs,
    nextTimeOffsetMs: targetUtcMs - simulatedUtcMs - deltaMs,
  }
}

export type ApplyTimeSlot = {
  inserted: boolean
  cardNumber?: string
  templateId?: string
}

export type ApplyTimeJumpPlan = {
  entries: ActivityHistoryEntry[]
  templateIds: string[]
  dddCardNumbers: string[]
}

/** Minuta, kterou po skoku uzavře až běžný sekundový krok. */
export function minuteLeftForSecondClock(nextSimulatedUtcMs: number): number {
  return Math.floor(nextSimulatedUtcMs / 60000) * 60000
}

export function planApplyTimeJump(input: {
  simulatedUtcMs: number
  deltaMs: number
  existingMinuteStarts: Iterable<number>
  driver1: ActivityKind
  driver2: ActivityKind
  slot1: ApplyTimeSlot
  slot2: ApplyTimeSlot
  isCrew?: boolean
  gpsLocation?: string
}): ApplyTimeJumpPlan {
  const existing = new Set(input.existingMinuteStarts)
  const firstMinuteUtc = Math.floor(input.simulatedUtcMs / 60000) * 60000
  const destinationMinuteUtc = Math.floor((input.simulatedUtcMs + input.deltaMs) / 60000) * 60000
  const entries: ActivityHistoryEntry[] = []
  if (input.deltaMs > 0) {
    for (let minuteUtc = firstMinuteUtc; minuteUtc < destinationMinuteUtc; minuteUtc += 60000) {
      if (existing.has(minuteUtc)) continue
      entries.push({
        minuteStartUtc: minuteUtc,
        isCrew: input.isCrew,
        driver1: input.driver1,
        driver2: input.driver2,
        gpsLocation: input.gpsLocation,
        driver1CardId: insertedCardId(input.slot1.inserted, input.slot1.cardNumber, input.slot1.templateId),
        driver2CardId: insertedCardId(input.slot2.inserted, input.slot2.cardNumber, input.slot2.templateId),
      })
    }
  }
  const templateIds = [input.slot1, input.slot2]
    .filter((slot) => slot.inserted && slot.templateId)
    .map((slot) => slot.templateId!)
  const dddCardNumbers = [input.slot1, input.slot2]
    .filter((slot) => slot.inserted && slot.cardNumber)
    .map((slot) => slot.cardNumber!)
  return { entries, templateIds, dddCardNumbers }
}
