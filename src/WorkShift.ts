/**
 * Pracovní směna – logika pro výchozí a cílovou zemi.
 * Směna začíná zadáním výchozí země a končí zadáním cílové země.
 * Při 2× výchozí země za sebou: čas se vždy počítá od prvního zadání, druhé jen zapamatuje čas.
 */

export type WorkShiftDriver = 1 | 2

type LastCountryInputType = 'start' | 'end' | null

type WorkShiftState = {
  lastCountryInputType: LastCountryInputType
  /** Čas prvního zadání výchozí země – od něj se počítá směna */
  firstStartMinuteUtc: number | null
  /** Čas druhého zadání výchozí země (pouze zapamatován) */
  secondStartMinuteUtc: number | null
}

const stateByDriver: Record<WorkShiftDriver, WorkShiftState> = {
  1: { lastCountryInputType: null, firstStartMinuteUtc: null, secondStartMinuteUtc: null },
  2: { lastCountryInputType: null, firstStartMinuteUtc: null, secondStartMinuteUtc: null },
}

export type OnStartCountryResult = {
  /** Má se přidat záznam do activityHistory */
  shouldAddToHistory: boolean
}

export type OnEndCountryResult = {
  shouldAddToHistory: true
}

/**
 * Zadání výchozí země.
 * Při 2× za sebou: neřidí se do historie, jen zapamatuje čas. Počítání od prvního zadání.
 */
export function onStartCountry(driver: WorkShiftDriver, minuteStartUtc: number): OnStartCountryResult {
  const s = stateByDriver[driver]
  if (s.lastCountryInputType === 'start') {
    s.secondStartMinuteUtc = minuteStartUtc
    return { shouldAddToHistory: false }
  }
  s.lastCountryInputType = 'start'
  s.firstStartMinuteUtc = minuteStartUtc
  s.secondStartMinuteUtc = null
  return { shouldAddToHistory: true }
}

/**
 * Zadání cílové země – ukončení pracovní směny.
 */
export function onEndCountry(driver: WorkShiftDriver, _minuteStartUtc: number): OnEndCountryResult {
  const s = stateByDriver[driver]
  s.lastCountryInputType = 'end'
  s.firstStartMinuteUtc = null
  s.secondStartMinuteUtc = null
  return { shouldAddToHistory: true }
}

/** Vrátí čas prvního zadání výchozí země (začátek probíhající směny) */
export function getFirstStartMinuteUtc(driver: WorkShiftDriver): number | null {
  return stateByDriver[driver].firstStartMinuteUtc
}

/** Vrátí uložený čas druhého zadání výchozí země (pokud byl 2× za sebou) */
export function getSecondStartMinuteUtc(driver: WorkShiftDriver): number | null {
  return stateByDriver[driver].secondStartMinuteUtc
}

/** Reset stavu (např. při vypnutí zapalování) */
export function resetWorkShift(driver?: WorkShiftDriver): void {
  if (driver != null) {
    stateByDriver[driver] = { lastCountryInputType: null, firstStartMinuteUtc: null, secondStartMinuteUtc: null }
  } else {
    stateByDriver[1] = { lastCountryInputType: null, firstStartMinuteUtc: null, secondStartMinuteUtc: null }
    stateByDriver[2] = { lastCountryInputType: null, firstStartMinuteUtc: null, secondStartMinuteUtc: null }
  }
}
