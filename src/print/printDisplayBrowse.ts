/**
 * Displej = stejná data jako výtisk: jeden PrintRow (24 buněk) na dvou řádcích LCD.
 * Typ výstupu: symbol tiskárny (18) → symbol displeje (20).
 */

import type { PrintCell, PrintRow } from './driverCardPrintRows'

export const PRINT_OUTPUT_SYMBOL = 18
export const DISPLAY_OUTPUT_SYMBOL = 20
/** Polovina řádku výtisku (24) na L1 / L2. */
export const LCD_ROW_HALF = 12

export type DisplayBrowseState = {
  rows: PrintRow[]
  index: number
}

/** Připraví řádky výtisku pro prohlížení na LCD (18 → 20). */
export function toDisplayRows(rows: readonly PrintRow[]): PrintRow[] {
  return rows.map((row) =>
    row.map((cell) => (cell === PRINT_OUTPUT_SYMBOL ? DISPLAY_OUTPUT_SYMBOL : cell)),
  )
}

export function splitPrintRowForLcd(row: PrintRow): { line1: PrintCell[]; line2: PrintCell[] } {
  return {
    line1: row.slice(0, LCD_ROW_HALF),
    line2: row.slice(LCD_ROW_HALF),
  }
}

export function stepDisplayBrowseIndex(
  prev: DisplayBrowseState,
  direction: 'up' | 'down',
): DisplayBrowseState {
  if (prev.rows.length === 0) return prev
  const max = prev.rows.length - 1
  const index = direction === 'up'
    ? Math.max(0, prev.index - 1)
    : Math.min(max, prev.index + 1)
  return index === prev.index ? prev : { ...prev, index }
}
