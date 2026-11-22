import type { FerryTrainEvent, FerryTrainEventType } from './TachoTypes'

/** Ukončení až po souvislé jízdě delší než jednu minutu. */
export const FERRY_CONTINUOUS_DRIVING_LIMIT_MS = 60_000

export function ferryMinuteUtc(atUtc: number): number {
  return Math.floor(atUtc / 60_000) * 60_000
}

/** Jedna událost na skutečnou změnu. Stejný typ ve stejné minutě se nezdvojuje. */
export function appendFerryEvent(
  events: readonly FerryTrainEvent[],
  type: FerryTrainEventType,
  atUtc: number,
  gpsLocation?: string,
): FerryTrainEvent[] {
  const minuteStartUtc = ferryMinuteUtc(atUtc)
  const last = events[events.length - 1]
  if (last?.type === type && last.minuteStartUtc === minuteStartUtc) return [...events]
  return [...events, { minuteStartUtc, gpsLocation, type }]
}

/**
 * Souvislá jízda. Zastavení vynuluje čítač, takže kratší a přerušované úseky režim neukončí.
 * Kladné deltaMs je jen krok jízdního intervalu, ne skok simulačního času.
 */
export function accumulateFerryDriving(
  drivingMs: number,
  moving: boolean,
  deltaMs: number,
): { drivingMs: number; ended: boolean } {
  if (!moving || deltaMs <= 0) return { drivingMs: 0, ended: false }
  const next = drivingMs + deltaMs
  if (next > FERRY_CONTINUOUS_DRIVING_LIMIT_MS) return { drivingMs: 0, ended: true }
  return { drivingMs: next, ended: false }
}

/** Vyjmutí karty ve slotu 1 nebo 2. Prázdné šachty a pouhé vložení režim neukončí. */
export function ferryCardWithdrawn(
  prev: { slot1: boolean; slot2: boolean },
  next: { slot1: boolean; slot2: boolean },
): boolean {
  return (prev.slot1 && !next.slot1) || (prev.slot2 && !next.slot2)
}
