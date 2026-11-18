/**
 * Obsluha průvodce výtiskem a spuštění položek PRINT_*.
 * Přesunuto z App.tsx bez změny mapování, data, UTC a nedokončených akcí.
 */

import type { PrintWizardState } from '../TachoTypes'
import { utcDaysIntersectingCardActivities } from './prepareDriver1Print24h'

export type PrintWizardKeyAction = 'up' | 'down' | 'ok' | 'back'

export type PrintWizardKeyEffects = {
  setCurrentMenuPath: (path: string[]) => void
  openPrintVDiagram: (dayUtc: number) => void
  openPrintDriverCard: (dayUtc: number, isUtc: boolean, slot: 1 | 2) => void
  openPrintVehicle24h: (dayUtc: number, isUtc: boolean) => void
}

export function applyPrintWizardKey(
  prev: PrintWizardState | null,
  action: PrintWizardKeyAction,
  effects: PrintWizardKeyEffects,
): PrintWizardState | null {
  if (!prev) return null
  const driverSlot = prev.action === 'PRINT_24H_D1' ? 1 : prev.action === 'PRINT_24H_D2' ? 2 : null
  if (action === 'back') {
    if (prev.step === 'utc') return { ...prev, step: 'date' }
    return null
  }
  if (action === 'up') {
    if (prev.step === 'date') {
      const next = Math.max(prev.dateIndex - 1, 0)
      return { ...prev, dateIndex: next }
    }
    return { ...prev, utcYes: true }
  }
  if (action === 'down') {
    if (prev.step === 'date') {
      const next = Math.min(prev.dateIndex + 1, prev.availableDatesUtc.length - 1)
      return { ...prev, dateIndex: next }
    }
    return { ...prev, utcYes: false }
  }
  if (action === 'ok') {
    if (prev.step === 'date') {
      const dayUtc = prev.availableDatesUtc[prev.dateIndex]
      if (dayUtc == null) return prev
      if (prev.requiresUtcConfirm) return { ...prev, step: 'utc' }
      effects.setCurrentMenuPath(prev.returnMenuPath)
      if (prev.action === 'PRINT_V_DIAGRAM') {
        effects.openPrintVDiagram(dayUtc)
      } else if (driverSlot) {
        effects.openPrintDriverCard(dayUtc, true, driverSlot)
      } else if (prev.action === 'PRINT_24H_V') {
        effects.openPrintVehicle24h(dayUtc, true)
      }
      return null
    }
    const dayUtc = prev.availableDatesUtc[prev.dateIndex]
    if (dayUtc == null) return prev
    effects.setCurrentMenuPath(prev.returnMenuPath)
    if (driverSlot) {
      effects.openPrintDriverCard(dayUtc, prev.utcYes, driverSlot)
    } else if (prev.action === 'PRINT_24H_V') {
      effects.openPrintVehicle24h(dayUtc, prev.utcYes)
    }
    return null
  }
  return prev
}

export type PrintMenuActionInput = {
  action: string
  line2: string
  requiresDate: boolean
  requiresUtcConfirm: boolean
  secondHistory: Array<{ timestampUtc: number }>
  simulatedUtcTime: number
  currentMenuPath: string[]
  /** Doložené činnosti karty ve šachtě 1. Den přidají jen u výtisku 24h řidiče 1. */
  cardActivities?: readonly { startUtc: number; endUtc: number; isManualEntry?: boolean }[]
}

export type PrintMenuActionResult =
  | { type: 'dateWizard'; state: PrintWizardState }
  | { type: 'openDriver1' }
  | { type: 'openVDiagram' }
  | { type: 'openSpeed' }

/** Vrátí obsluhu známé tiskové akce. Neznámá nebo nedokončená akce vrací null. */
export function resolvePrintMenuAction(input: PrintMenuActionInput): PrintMenuActionResult | null {
  const { action, line2, requiresDate, requiresUtcConfirm, secondHistory, simulatedUtcTime, currentMenuPath } = input
  if (requiresDate && ['PRINT_24H_D1', 'PRINT_24H_D2', 'PRINT_V_DIAGRAM', 'PRINT_24H_V'].includes(action)) {
    const dayStarts = new Set<number>()
    for (const s of secondHistory) {
      const d = new Date(s.timestampUtc)
      dayStarts.add(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    }
    if (action === 'PRINT_24H_D1' || action === 'PRINT_24H_D2') {
      for (const day of utcDaysIntersectingCardActivities(input.cardActivities ?? [])) {
        dayStarts.add(day)
      }
    }
    let availableDatesUtc = Array.from(dayStarts).sort((a, b) => b - a)
    if (availableDatesUtc.length === 0) {
      const d = new Date(simulatedUtcTime)
      availableDatesUtc = [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())]
    }
    return {
      type: 'dateWizard',
      state: {
        action,
        step: 'date',
        menuItemLine2: line2,
        dateIndex: 0,
        availableDatesUtc,
        utcYes: true,
        returnMenuPath: [...currentMenuPath],
        requiresUtcConfirm,
      },
    }
  }
  if (['PRINT_24H_D1', 'PRINT_EVENT_D1', 'PRINT_ACT_D1'].includes(action)) {
    return { type: 'openDriver1' }
  }
  if (action === 'PRINT_V_DIAGRAM') {
    return { type: 'openVDiagram' }
  }
  if (action === 'PRINT_SPEED_V') {
    return { type: 'openSpeed' }
  }
  return null
}
