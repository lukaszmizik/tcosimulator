import type { ActivityHistoryEntry, ManualEntrySegment } from '../TachoTypes'

export const CARD1_TEMPLATE_ID = 'zmizik' as const

// Provozní data existují jen po dobu otevření stránky.
let lastWithdrawal: number | null = null
let manualEntries: ManualEntrySegment[] = []
let activityHistory: ActivityHistoryEntry[] = []

export function loadCard1LastWithdrawal(): number | null {
  return lastWithdrawal
}

export function saveCard1LastWithdrawal(utcMs: number): void {
  lastWithdrawal = utcMs
}

export function clearCard1LastWithdrawal(): void {
  lastWithdrawal = null
}

export function loadCard1ManualEntryBuffer(): ManualEntrySegment[] {
  return manualEntries
}

export function saveCard1ManualEntryBuffer(entries: ManualEntrySegment[]): void {
  manualEntries = entries
}

export function loadCard1ActivityHistory(): ActivityHistoryEntry[] {
  return activityHistory
}

export function saveCard1ActivityHistory(entries: ActivityHistoryEntry[]): void {
  activityHistory = entries
}
