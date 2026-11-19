import type { ActivityHistoryEntry, ManualEntrySegment } from '../TachoTypes'

export const CARD2_TEMPLATE_ID = 'novak' as const

// Provozní data existují jen po dobu otevření stránky.
let lastWithdrawal: number | null = null
let manualEntries: ManualEntrySegment[] = []
let activityHistory: ActivityHistoryEntry[] = []

export function loadCard2LastWithdrawal(): number | null {
  return lastWithdrawal
}

export function saveCard2LastWithdrawal(utcMs: number): void {
  lastWithdrawal = utcMs
}

export function clearCard2LastWithdrawal(): void {
  lastWithdrawal = null
}

export function loadCard2ManualEntryBuffer(): ManualEntrySegment[] {
  return manualEntries
}

export function saveCard2ManualEntryBuffer(entries: ManualEntrySegment[]): void {
  manualEntries = entries
}

export function loadCard2ActivityHistory(): ActivityHistoryEntry[] {
  return activityHistory
}

export function saveCard2ActivityHistory(entries: ActivityHistoryEntry[]): void {
  activityHistory = entries
}
