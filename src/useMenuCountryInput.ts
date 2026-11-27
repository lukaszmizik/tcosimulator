/**
 * Průvodce zadáním výchozí a cílové země z menu.
 * Pořadí kláves v App, větev STOP a nakládka zůstávají mimo tento hook.
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { segmentToMsUtc, utcMsToSegment } from './CardLogic'
import type { CountryEntry } from './data/countriesLoader'
import type { ManualEntrySegment, MenuCountryInputState, RecordedGpsLocation, VirtualRoutePoint } from './TachoTypes'
import { tachographCountryCode } from './tachographCountryCode'
import * as WorkShift from './WorkShift'

const CONFIRM_DURATION_MS = 3000

type UseMenuCountryInputParams = {
  countries: CountryEntry[]
  simulatedUtcTimeRef: MutableRefObject<number>
  virtualLocationRef: MutableRefObject<VirtualRoutePoint | null>
  detectedBorderCountryCodeRef: MutableRefObject<string | null>
  setCurrentMenuPath: Dispatch<SetStateAction<string[]>>
  setSelectedIndex: Dispatch<SetStateAction<number>>
  setDriver1ManualEntryBuffer: Dispatch<SetStateAction<ManualEntrySegment[]>>
  setDriver2ManualEntryBuffer: Dispatch<SetStateAction<ManualEntrySegment[]>>
  setRecordedGpsLocations: Dispatch<SetStateAction<RecordedGpsLocation[]>>
}

export function useMenuCountryInput(params: UseMenuCountryInputParams) {
  const {
    countries,
    simulatedUtcTimeRef,
    virtualLocationRef,
    detectedBorderCountryCodeRef,
    setCurrentMenuPath,
    setSelectedIndex,
    setDriver1ManualEntryBuffer,
    setDriver2ManualEntryBuffer,
    setRecordedGpsLocations,
  } = params

  const [menuCountryInputState, setMenuCountryInputState] = useState<MenuCountryInputState | null>(null)
  const menuCountryInputStateRef = useRef(menuCountryInputState)
  menuCountryInputStateRef.current = menuCountryInputState

  // Po 3 s v confirmSaved vrátit o úroveň výš v menu
  useEffect(() => {
    const mc = menuCountryInputState
    if (!mc || mc.phase !== 'confirmSaved') return
    const returnPath = mc.returnMenuPath.slice(0, -1)
    const elapsed = Date.now() - mc.phaseStartTime
    if (elapsed >= CONFIRM_DURATION_MS) {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuCountryInputState(null)
      return
    }
    const t = setTimeout(() => {
      setCurrentMenuPath(returnPath)
      setSelectedIndex(0)
      setMenuCountryInputState(null)
    }, CONFIRM_DURATION_MS - elapsed)
    return () => clearTimeout(t)
  }, [menuCountryInputState?.phase, menuCountryInputState?.phaseStartTime, menuCountryInputState?.returnMenuPath, setCurrentMenuPath, setSelectedIndex])

  const returnToParentMenu = useCallback(() => {
    const current = menuCountryInputStateRef.current
    if (!current) return
    setCurrentMenuPath(current.returnMenuPath.slice(0, -1))
    setSelectedIndex(0)
    menuCountryInputStateRef.current = null
    setMenuCountryInputState(null)
  }, [setCurrentMenuPath, setSelectedIndex])

  const cancelMenuCountryInput = useCallback(() => {
    menuCountryInputStateRef.current = null
    setMenuCountryInputState(null)
  }, [])

  const openMenuCountryInput = useCallback((
    action: 'INPUT_START_COUNTRY' | 'INPUT_END_COUNTRY',
    menuPath: string[],
  ) => {
    const gpsCountry = virtualLocationRef.current?.country ?? null
    const defaultCode = gpsCountry
      ? tachographCountryCode(gpsCountry)
      : (action === 'INPUT_START_COUNTRY' && detectedBorderCountryCodeRef.current
        ? tachographCountryCode(detectedBorderCountryCodeRef.current)
        : 'CZ')
    const defaultIndex = Math.max(0, countries.findIndex((c) => c.code === defaultCode))
    const next = {
      type: action === 'INPUT_START_COUNTRY' ? 'start' as const : 'end' as const,
      phase: 'selecting' as const,
      phaseStartTime: Date.now(),
      countryIndex: defaultIndex,
      returnMenuPath: [...menuPath],
    }
    menuCountryInputStateRef.current = next
    setMenuCountryInputState(next)
  }, [countries, virtualLocationRef, detectedBorderCountryCodeRef])

  const handleMenuCountryInputKey = useCallback((action: 'ok' | 'up' | 'down' | 'back') => {
    if (action === 'up' || action === 'down') {
      setMenuCountryInputState((prev) => {
        if (!prev || prev.phase !== 'selecting') return prev
        const delta = action === 'up' ? 1 : -1
        const len = countries.length || 1
        const i = (prev.countryIndex + delta + len) % len
        const next = { ...prev, countryIndex: i }
        menuCountryInputStateRef.current = next
        return next
      })
      return
    }
    const prev = menuCountryInputStateRef.current
    if (!prev) return
    if (prev.phase === 'confirmSaved') {
      if (action === 'back') {
        setCurrentMenuPath(prev.returnMenuPath.slice(0, -1))
        setSelectedIndex(0)
        menuCountryInputStateRef.current = null
        setMenuCountryInputState(null)
      }
      return
    }
    if (prev.phase !== 'selecting') return
    if (action === 'ok') {
      const countryCode = countries[prev.countryIndex]?.code ?? 'CZ'
      const minuteStartUtc = Math.floor(simulatedUtcTimeRef.current / 60000) * 60000
      const gpsName = virtualLocationRef.current?.name
      const gpsStr = gpsName ? `${countryCode}: ${gpsName}` : countryCode
      const isDriver1 = prev.returnMenuPath[prev.returnMenuPath.length - 1] === 'SUB_INPUT_D1'
      const driver = isDriver1 ? (1 as const) : (2 as const)
      const shouldAdd = prev.type === 'start'
        ? WorkShift.onStartCountry(driver, minuteStartUtc).shouldAddToHistory
        : WorkShift.onEndCountry(driver, minuteStartUtc).shouldAddToHistory
      if (shouldAdd) {
        // Pouze jedno časové razítko (jako v CardWizardu) – jen segment do manuálního bufferu, ne do activityHistory.
        // Ochrana proti dvojímu zápisu (např. dvojí volání handleru): nepřidat, pokud buffer už končí stejným razítkem.
        const countrySegment: ManualEntrySegment = {
          ...utcMsToSegment(minuteStartUtc),
          activityId: prev.type === 'start' ? 'START_COUNTRY' : 'END_COUNTRY',
          countryCode,
        }
        const isDuplicateStamp = (buf: ManualEntrySegment[]) => {
          const last = buf[buf.length - 1]
          return last?.activityId === countrySegment.activityId && last?.countryCode === countrySegment.countryCode && segmentToMsUtc(last) === minuteStartUtc
        }
        if (isDriver1) {
          setDriver1ManualEntryBuffer((buf) => (isDuplicateStamp(buf) ? buf : [...buf, countrySegment]))
        } else {
          setDriver2ManualEntryBuffer((buf) => (isDuplicateStamp(buf) ? buf : [...buf, countrySegment]))
        }
        const recordType = prev.type === 'start' ? 'start_country' : 'end_country'
        setRecordedGpsLocations((r) => {
          const last = r[r.length - 1]
          if (last?.minuteStartUtc === minuteStartUtc && last?.recordType === recordType) return r
          return [...r, { minuteStartUtc, gpsLocation: gpsStr ?? countryCode, recordType }]
        })
      }
      const next = { ...prev, phase: 'confirmSaved' as const, phaseStartTime: Date.now() }
      menuCountryInputStateRef.current = next
      setMenuCountryInputState(next)
      return
    }
    if (action === 'back') {
      setCurrentMenuPath(prev.returnMenuPath.slice(0, -1))
      setSelectedIndex(0)
      menuCountryInputStateRef.current = null
      setMenuCountryInputState(null)
    }
  }, [
    countries,
    simulatedUtcTimeRef,
    virtualLocationRef,
    setCurrentMenuPath,
    setSelectedIndex,
    setDriver1ManualEntryBuffer,
    setDriver2ManualEntryBuffer,
    setRecordedGpsLocations,
  ])

  return {
    menuCountryInputState,
    openMenuCountryInput,
    cancelMenuCountryInput,
    returnToParentMenu,
    handleMenuCountryInputKey,
  }
}
