/**
 * Uložení údajů o kartách řidičů.
 * Natvrdo zapsané hodnoty pro kartu 1 a 2.
 */

import type { CardData } from '../TachoTypes'

export type CardStoredData = {
  /** Číslo karty (16 znaků: CZ + 14 hex) */
  cardNumber: string
  /** Příjmení */
  surname: string
  /** Jméno (jména) */
  firstName: string
  /** Datum narození DD.MM.RRRR */
  dateOfBirth: string
  /** Kód státu občanství */
  nationality: string
  /** Kód státu vydání */
  issuingCountry: string
  /** Název vydávajícího orgánu */
  issuingAuthority: string
  /** Datum vydání DD.MM.RRRR */
  dateOfIssue: string
  /** Datum ukončení platnosti DD.MM.RRRR */
  dateOfExpiry: string
  /** Číslo řidičského průkazu */
  drivingLicenseNumber: string
}

/** Karta 1 – Lukas Zmizik */
export const CARD1_STORED_DATA: CardStoredData = {
  cardNumber: 'CZ1234567890AB12',
  surname: 'Zmizik',
  firstName: 'Lukas',
  dateOfBirth: '15.06.1985',
  nationality: 'CZ',
  issuingCountry: 'CZ',
  issuingAuthority: 'Ministerstvo dopravy ČR',
  dateOfIssue: '12.03.2022',
  dateOfExpiry: '12.03.2027',
  drivingLicenseNumber: '456789123',
}

/** Karta 2 – Roman Milewski */
export const CARD2_STORED_DATA: CardStoredData = {
  cardNumber: 'CZ9876543210CD34',
  surname: 'Milewski',
  firstName: 'Roman',
  dateOfBirth: '22.11.1990',
  nationality: 'CZ',
  issuingCountry: 'CZ',
  issuingAuthority: 'Ministerstvo dopravy ČR',
  dateOfIssue: '08.07.2023',
  dateOfExpiry: '08.07.2028',
  drivingLicenseNumber: '789123456',
}

/** Vrátí uložená data pro kartu 1 */
export function getCard1StoredData(): CardStoredData {
  return CARD1_STORED_DATA
}

/** Vrátí uložená data pro kartu 2 */
export function getCard2StoredData(): CardStoredData {
  return CARD2_STORED_DATA
}

/** Převede CardStoredData na CardData (jméno = jméno + příjmení, příjmení pro zobrazení ve fázích načítání). */
export function toCardData(stored: CardStoredData, templateId?: 'zmizik' | 'novak'): CardData {
  return {
    name: [stored.firstName, stored.surname].filter(Boolean).join(' '),
    surname: stored.surname,
    lastWithdrawal: null,
    templateId,
    isFirstInsertion: true,
  }
}
