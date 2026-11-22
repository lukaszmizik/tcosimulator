/** Pravidla šachet 1 a 2. Šachta 2 není řidič, který vozidlo vede. */

export const IGNITION_CARD_WARNING_MS = 20_000

/** „Připraven k jízdě“ patří jen řidiči ve slotu 1. Dokončení načtení slotu 2 je jiná obrazovka. */
export function showsReadyToDrive(slot: 1 | 2): boolean {
  return slot === 1
}

/**
 * Upozornění po zapnutí zapalování, když ve slotu 1 není karta.
 * Karta ve slotu 2 ho neruší. Po potvrzení nebo po dvaceti sekundách zhasne.
 */
export function ignitionCardWarningVisible(input: {
  ignitionOn: boolean
  card1Inserted: boolean
  dismissed: boolean
  elapsedMs: number
}): boolean {
  if (!input.ignitionOn || input.card1Inserted || input.dismissed) return false
  return input.elapsedMs < IGNITION_CARD_WARNING_MS
}

/** Jízda bez karty řidiče ve slotu 1. Karta ve slotu 2 událost neruší. */
export function drivingWithoutDriverCard(card1Inserted: boolean): boolean {
  return !card1Inserted
}

/** Vysunutí jedné šachty ponechá odložené razítko té druhé. */
export function keptDeferredAfterEject<T>(
  deferred: Partial<Record<1 | 2, T>>,
  ejected: 1 | 2,
): Partial<Record<1 | 2, T>> {
  const other: 1 | 2 = ejected === 1 ? 2 : 1
  const kept = deferred[other]
  return kept === undefined ? {} : { [other]: kept }
}
