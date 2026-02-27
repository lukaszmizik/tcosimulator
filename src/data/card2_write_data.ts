/**
 * Zápis dat na kartu 2 (Roman).
 * Slouží k ukládání historie aktivit při vložené kartě do slotu 2.
 */

import type { ActivityHistoryEntry, ManualEntrySegment } from '../TachoTypes'

export const CARD2_TEMPLATE_ID = 'novak' as const

const STORAGE_KEY = 'card2_activity_history'
const LAST_WITHDRAWAL_KEY = 'card2_last_withdrawal'
const MANUAL_ENTRY_KEY = 'card2_manual_entry_buffer'

/**
 * Načte datum a čas posledního vyjmutí karty 2 (UTC ms).
 */
export function loadCard2LastWithdrawal(): number | null {
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
 * Uloží datum a čas posledního vyjmutí karty 2 (UTC ms).
 * Volá se průvodcem vyjmutím při dokončení vytahování karty.
 */
export function saveCard2LastWithdrawal(utcMs: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_WITHDRAWAL_KEY, String(utcMs))
  } catch {
    // ignore
  }
}

/** Vymaže uložené poslední vyjmutí (např. při resetu simulátoru). */
export function clearCard2LastWithdrawal(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LAST_WITHDRAWAL_KEY)
  } catch {
    // ignore
  }
}

/**
 * Načte manuální zadání karty 2 z úložiště.
 */
export function loadCard2ManualEntryBuffer(): ManualEntrySegment[] {
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
 * Uloží manuální zadání karty 2.
 */
export function saveCard2ManualEntryBuffer(entries: ManualEntrySegment[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MANUAL_ENTRY_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte historii aktivit karty 2 z úložiště.
 */
export function loadCard2ActivityHistory(): ActivityHistoryEntry[] {
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
 * Uloží historii aktivit karty 2 do úložiště.
 * Volá se při každém zápisu na kartu (při vložené kartě v slotu 2).
 */
export function saveCard2ActivityHistory(entries: ActivityHistoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}
