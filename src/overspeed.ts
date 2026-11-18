import type { CardData } from './TachoTypes'

export const OVERSPEED_LIMIT_KMH = 90

export type OverspeedRun = {
  startUtc: number
  elapsedMs: number
  speedTime: number
  maxKmh: number
  driver: Pick<CardData, 'name' | 'surname' | 'cardNumber'> | null
}

export function advanceOverspeed(
  previous: OverspeedRun | null,
  speed: number,
  atUtc: number,
  elapsedMs: number,
  driver: OverspeedRun['driver'],
): OverspeedRun | null {
  if (speed <= OVERSPEED_LIMIT_KMH) return null
  return {
    startUtc: previous?.startUtc ?? atUtc,
    elapsedMs: (previous?.elapsedMs ?? 0) + elapsedMs,
    speedTime: (previous?.speedTime ?? 0) + speed * elapsedMs,
    maxKmh: Math.max(previous?.maxKmh ?? 0, speed),
    driver: previous ? previous.driver : driver && {
      name: driver.name, surname: driver.surname, cardNumber: driver.cardNumber,
    },
  }
}

export function qualifiesAsOverspeed(run: OverspeedRun | null): run is OverspeedRun {
  return run !== null && run.elapsedMs > 60_000
}
