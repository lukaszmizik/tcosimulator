/**
 * Zápis dat na kartu 1 (Lukáš Zmizík).
 * Slouží k ukládání historie aktivit při vložené kartě do slotu 1.
 */

import type { ActivityHistoryEntry, ManualEntrySegment } from '../TachoTypes'

export const CARD1_TEMPLATE_ID = 'zmizik' as const

const STORAGE_KEY = 'card1_activity_history'
const LAST_WITHDRAWAL_KEY = 'card1_last_withdrawal'
const MANUAL_ENTRY_KEY = 'card1_manual_entry_buffer'

/**
 * Načte datum a čas posledního vyjmutí karty 1 (UTC ms).
 */
export function loadCard1LastWithdrawal(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_WITHDRAWAL_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Uloží datum a čas posledního vyjmutí karty 1 (UTC ms).
 * Volá se průvodcem vyjmutím při dokončení vytahování karty.
 */
export function saveCard1LastWithdrawal(utcMs: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_WITHDRAWAL_KEY, String(utcMs))
  } catch {
    // ignore
  }
}

/** Vymaže uložené poslední vyjmutí (např. při resetu simulátoru). */
export function clearCard1LastWithdrawal(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LAST_WITHDRAWAL_KEY)
  } catch {
    // ignore
  }
}

/**
 * Načte manuální zadání karty 1 z úložiště.
 */
export function loadCard1ManualEntryBuffer(): ManualEntrySegment[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(MANUAL_ENTRY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Uloží manuální zadání karty 1.
 */
export function saveCard1ManualEntryBuffer(entries: ManualEntrySegment[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MANUAL_ENTRY_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte historii aktivit karty 1 z úložiště.
 */
export function loadCard1ActivityHistory(): ActivityHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Uloží historii aktivit karty 1 do úložiště.
 * Volá se při každém zápisu na kartu (při vložené kartě v slotu 1).
 */
export function saveCard1ActivityHistory(entries: ActivityHistoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}
