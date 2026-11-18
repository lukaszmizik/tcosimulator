/**
 * Obsluha průvodce výtiskem a spuštění položek PRINT_*.
 * Přesunuto z App.tsx bez změny mapování, data, UTC a nedokončených akcí.
 */

import type { PrintWizardState } from '../TachoTypes'
import { utcDaysIntersectingCardActivities } from './prepareDriver1Print24h'

export function driverPrintSlot(action: string): 1 | 2 | null {
  if (action === 'PRINT_24H_D1' || action === 'PRINT_ACT_D1') return 1
  if (action === 'PRINT_24H_D2' || action === 'PRINT_ACT_D2') return 2
  return null
}

export type PrintWizardKeyAction = 'up' | 'down' | 'ok' | 'back'

export type PrintWizardKeyEffects = {
  setCurrentMenuPath: (path: string[]) => void
  openPrintDriverActivities?: (dayUtc: number, isUtc: boolean, slot: 1 | 2) => void
  openPrintVehicleEvents?: (isUtc: boolean) => void
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
  const driverSlot = driverPrintSlot(prev.action)
  const openDriver = prev.action.startsWith('PRINT_ACT_')
    ? effects.openPrintDriverActivities : effects.openPrintDriverCard
  if (action === 'back') {
    if (prev.action === 'PRINT_EVENT_V') return null
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
    if (prev.action === 'PRINT_EVENT_V') {
      effects.setCurrentMenuPath(prev.returnMenuPath)
      effects.openPrintVehicleEvents?.(prev.utcYes)
      return null
    }
    if (prev.step === 'date') {
      const dayUtc = prev.availableDatesUtc[prev.dateIndex]
      if (dayUtc == null) return prev
      if (prev.requiresUtcConfirm) return { ...prev, step: 'utc' }
      effects.setCurrentMenuPath(prev.returnMenuPath)
      if (prev.action === 'PRINT_V_DIAGRAM') {
        effects.openPrintVDiagram(dayUtc)
      } else if (driverSlot) {
        openDriver?.(dayUtc, true, driverSlot)
      } else if (prev.action === 'PRINT_24H_V') {
        effects.openPrintVehicle24h(dayUtc, true)
      }
      return null
    }
    const dayUtc = prev.availableDatesUtc[prev.dateIndex]
    if (dayUtc == null) return prev
    effects.setCurrentMenuPath(prev.returnMenuPath)
    if (driverSlot) {
      openDriver?.(dayUtc, prev.utcYes, driverSlot)
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
  vehicleActivities?: readonly { minuteStartUtc: number }[]
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
  if (action === 'PRINT_EVENT_V') {
    return {
      type: 'dateWizard',
      state: {
        action, step: 'utc', menuItemLine2: line2, utcYes: true,
        availableDatesUtc: [], dateIndex: 0, returnMenuPath: [...currentMenuPath],
        requiresUtcConfirm: true,
      },
    }
  }
  const slot = driverPrintSlot(action)
  const activityDiagram = action.startsWith('PRINT_ACT_')
  if (requiresDate && (slot || action === 'PRINT_V_DIAGRAM' || action === 'PRINT_24H_V')) {
    const dayStarts = new Set<number>()
    for (const s of activityDiagram ? [] : secondHistory) {
      const d = new Date(s.timestampUtc)
      dayStarts.add(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    }
    if (slot) {
      const activities = input.cardActivities ?? []
      for (const day of utcDaysIntersectingCardActivities(activityDiagram
        ? activities.map(({ startUtc, endUtc }) => ({ startUtc, endUtc })) : activities)) {
        dayStarts.add(day)
      }
    }
    if (action === 'PRINT_24H_V') {
      for (const entry of input.vehicleActivities ?? []) {
        const d = new Date(entry.minuteStartUtc)
        dayStarts.add(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
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
  if (['PRINT_24H_D1', 'PRINT_EVENT_D1'].includes(action)) {
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
