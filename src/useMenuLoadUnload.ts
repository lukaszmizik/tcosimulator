/**
 * Potvrzení nakládky a vykládky z menu.
 * App dál rozhoduje, kdy se obsluha zavolá z kláves a ze zapalování.
 */

import { useCallback, useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { Translations } from './translations/types'
import type { MenuLoadUnloadConfirmState, RecordedGpsLocation, VehicleLoadUnloadEvent, VirtualRoutePoint } from './TachoTypes'

const CONFIRM_DURATION_MS = 3000

type LoadUnloadAction = 'ACTION_LOAD' | 'ACTION_UNLOAD' | 'ACTION_LOAD_UNLOAD_BOTH'

type UseMenuLoadUnloadParams = {
  t: Translations
  addEntry: (action: string, savedDetail?: string) => void
  simulatedUtcTimeRef: MutableRefObject<number>
  virtualLocationRef: MutableRefObject<VirtualRoutePoint | null>
  setCurrentMenuPath: Dispatch<SetStateAction<string[]>>
  setSelectedIndex: Dispatch<SetStateAction<number>>
  setVehicleLoadUnloadEvents: Dispatch<SetStateAction<VehicleLoadUnloadEvent[]>>
  setRecordedGpsLocations: Dispatch<SetStateAction<RecordedGpsLocation[]>>
}

export function useMenuLoadUnload(params: UseMenuLoadUnloadParams) {
  const {
    t,
    addEntry,
    simulatedUtcTimeRef,
    virtualLocationRef,
    setCurrentMenuPath,
    setSelectedIndex,
    setVehicleLoadUnloadEvents,
    setRecordedGpsLocations,
  } = params

  const [menuLoadUnloadConfirmState, setMenuLoadUnloadConfirmState] = useState<MenuLoadUnloadConfirmState | null>(null)

  // Po 3 s vrátit o úroveň výš v menu
  useEffect(() => {
    const lu = menuLoadUnloadConfirmState
    if (!lu) return
    const returnPath = lu.returnMenuPath.slice(0, -1)
    const elapsed = Date.now() - lu.phaseStartTime
    if (elapsed >= CONFIRM_DURATION_MS) {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuLoadUnloadConfirmState(null)
      return
    }
    const timeoutId = setTimeout(() => {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuLoadUnloadConfirmState(null)
    }, CONFIRM_DURATION_MS - elapsed)
    return () => clearTimeout(timeoutId)
  }, [menuLoadUnloadConfirmState?.phaseStartTime, menuLoadUnloadConfirmState?.returnMenuPath, setCurrentMenuPath, setSelectedIndex])

  const confirmMenuLoadUnload = useCallback((action: LoadUnloadAction, menuPath: string[]) => {
    const type: VehicleLoadUnloadEvent['type'] =
      action === 'ACTION_LOAD' ? 'load'
      : action === 'ACTION_UNLOAD' ? 'unload'
      : 'both'
    const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
    const gpsName = virtualLocationRef.current?.name
    const gpsStr = gpsName ?? undefined
    const label = type === 'load' ? t.manualEntry.load : type === 'unload' ? t.manualEntry.unload : t.manualEntry.loadUnload
    addEntry(t.actions.stiskOk, `${t.ui.saved} ${label}${gpsStr ? ` (${gpsStr})` : ''}`)
    setVehicleLoadUnloadEvents((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr, type }])
    setRecordedGpsLocations((prev) => [...prev, { minuteStartUtc, gpsLocation: gpsStr ?? '—', recordType: type === 'load' ? 'load' : type === 'unload' ? 'unload' : 'load_unload' }])
    setMenuLoadUnloadConfirmState({ phaseStartTime: Date.now(), returnMenuPath: [...menuPath] })
  }, [t, addEntry, simulatedUtcTimeRef, virtualLocationRef, setVehicleLoadUnloadEvents, setRecordedGpsLocations])

  const leaveMenuLoadUnloadByBack = useCallback(() => {
    setCurrentMenuPath((path) => path.slice(0, -1))
    setSelectedIndex(0)
    setMenuLoadUnloadConfirmState(null)
  }, [setCurrentMenuPath, setSelectedIndex])

  const leaveMenuLoadUnloadByStop = useCallback(() => {
    if (!menuLoadUnloadConfirmState) return
    setCurrentMenuPath(menuLoadUnloadConfirmState.returnMenuPath.slice(0, -1))
    setSelectedIndex(0)
    setMenuLoadUnloadConfirmState(null)
  }, [menuLoadUnloadConfirmState, setCurrentMenuPath, setSelectedIndex])

  const cancelMenuLoadUnload = useCallback(() => {
    setMenuLoadUnloadConfirmState(null)
  }, [])

  return {
    menuLoadUnloadConfirmState,
    confirmMenuLoadUnload,
    leaveMenuLoadUnloadByBack,
    leaveMenuLoadUnloadByStop,
    cancelMenuLoadUnload,
  }
}
