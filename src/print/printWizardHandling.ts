/**
 * Obsluha průvodce výtiskem/displejem a spuštění položek PRINT_* / DISP_*.
 * Displej sdílí stejný průvodce (datum + UTC); po OK otevře browse na LCD místo papíru.
 */

import type { PrintWizardState } from '../TachoTypes'
import { utcDaysIntersectingCardActivities } from './prepareDriver1Print24h'

export function driverPrintSlot(action: string): 1 | 2 | null {
  if (action === 'PRINT_24H_D1' || action === 'PRINT_ACT_D1' || action === 'DISP_24H_D1') return 1
  if (action === 'PRINT_24H_D2' || action === 'PRINT_ACT_D2' || action === 'DISP_24H_D2') return 2
  return null
}

function isEventOnlyAction(action: string): boolean {
  return action === 'PRINT_EVENT_V'
    || action === 'PRINT_EVENT_D1'
    || action === 'PRINT_EVENT_D2'
    || action === 'DISP_EVENT_V'
    || action === 'DISP_EVENT_D1'
    || action === 'DISP_EVENT_D2'
}

export type PrintWizardKeyAction = 'up' | 'down' | 'ok' | 'back'

export type PrintWizardKeyEffects = {
  setCurrentMenuPath: (path: string[]) => void
  openPrintDriverActivities?: (dayUtc: number, isUtc: boolean, slot: 1 | 2) => void
  openPrintVehicleEvents?: (isUtc: boolean) => void
  openPrintDriverEvents?: (slot: 1 | 2, isUtc: boolean) => void
  openPrintVDiagram: (dayUtc: number) => void
  openPrintDriverCard: (dayUtc: number, isUtc: boolean, slot: 1 | 2) => void
  openPrintVehicle24h: (dayUtc: number, isUtc: boolean) => void
  openDisplayDriverCard?: (dayUtc: number, isUtc: boolean, slot: 1 | 2) => void
  openDisplayDriverEvents?: (slot: 1 | 2, isUtc: boolean) => void
  openDisplayVehicleEvents?: (isUtc: boolean) => void
  openDisplayVehicle24h?: (dayUtc: number, isUtc: boolean) => void
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
    if (isEventOnlyAction(prev.action)) return null
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
    if (prev.action === 'DISP_EVENT_V') {
      effects.setCurrentMenuPath(prev.returnMenuPath)
      effects.openDisplayVehicleEvents?.(prev.utcYes)
      return null
    }
    if (prev.action === 'PRINT_EVENT_D1' || prev.action === 'PRINT_EVENT_D2') {
      effects.setCurrentMenuPath(prev.returnMenuPath)
      effects.openPrintDriverEvents?.(prev.action === 'PRINT_EVENT_D1' ? 1 : 2, prev.utcYes)
      return null
    }
    if (prev.action === 'DISP_EVENT_D1' || prev.action === 'DISP_EVENT_D2') {
      effects.setCurrentMenuPath(prev.returnMenuPath)
      effects.openDisplayDriverEvents?.(prev.action === 'DISP_EVENT_D1' ? 1 : 2, prev.utcYes)
      return null
    }
    if (prev.step === 'date') {
      const dayUtc = prev.availableDatesUtc[prev.dateIndex]
      if (dayUtc == null) return prev
      if (prev.requiresUtcConfirm) return { ...prev, step: 'utc' }
      effects.setCurrentMenuPath(prev.returnMenuPath)
      finishDatedWizard(prev.action, dayUtc, true, driverSlot, openDriver, effects)
      return null
    }
    const dayUtc = prev.availableDatesUtc[prev.dateIndex]
    if (dayUtc == null) return prev
    effects.setCurrentMenuPath(prev.returnMenuPath)
    finishDatedWizard(prev.action, dayUtc, prev.utcYes, driverSlot, openDriver, effects)
    return null
  }
  return prev
}

function finishDatedWizard(
  action: string,
  dayUtc: number,
  isUtc: boolean,
  driverSlot: 1 | 2 | null,
  openDriver: PrintWizardKeyEffects['openPrintDriverCard'] | PrintWizardKeyEffects['openPrintDriverActivities'],
  effects: PrintWizardKeyEffects,
) {
  if (action === 'PRINT_V_DIAGRAM') {
    effects.openPrintVDiagram(dayUtc)
    return
  }
  if (action === 'DISP_24H_D1' || action === 'DISP_24H_D2') {
    if (driverSlot) effects.openDisplayDriverCard?.(dayUtc, isUtc, driverSlot)
    return
  }
  if (action === 'DISP_24H_V') {
    effects.openDisplayVehicle24h?.(dayUtc, isUtc)
    return
  }
  if (driverSlot) {
    openDriver?.(dayUtc, isUtc, driverSlot)
    return
  }
  if (action === 'PRINT_24H_V') {
    effects.openPrintVehicle24h(dayUtc, isUtc)
  }
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
  /** Doložené činnosti karty ve šachtě. Den přidají u 24h řidiče. */
  cardActivities?: readonly { startUtc: number; endUtc: number; isManualEntry?: boolean }[]
}

export type PrintMenuActionResult =
  | { type: 'dateWizard'; state: PrintWizardState }
  | { type: 'openDriver1' }
  | { type: 'openVDiagram' }
  | { type: 'openSpeed' }
  | { type: 'openTechnical' }
  | { type: 'openTechnicalDisplay' }

/** Vrátí obsluhu známé tiskové/displejové akce. Neznámá akce vrací null. */
export function resolvePrintMenuAction(input: PrintMenuActionInput): PrintMenuActionResult | null {
  const { action, line2, requiresDate, requiresUtcConfirm, secondHistory, simulatedUtcTime, currentMenuPath } = input
  if (isEventOnlyAction(action)) {
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
  const datedVehicle = action === 'PRINT_V_DIAGRAM' || action === 'PRINT_24H_V' || action === 'DISP_24H_V'
  if (requiresDate && (slot || datedVehicle)) {
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
    if (action === 'PRINT_24H_V' || action === 'DISP_24H_V') {
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
  if (action === 'PRINT_24H_D1') {
    return { type: 'openDriver1' }
  }
  if (action === 'PRINT_V_DIAGRAM') {
    return { type: 'openVDiagram' }
  }
  if (action === 'PRINT_SPEED_V') {
    return { type: 'openSpeed' }
  }
  if (action === 'PRINT_TECH_V') {
    return { type: 'openTechnical' }
  }
  if (action === 'DISP_TECH_V') {
    return { type: 'openTechnicalDisplay' }
  }
  return null
}
