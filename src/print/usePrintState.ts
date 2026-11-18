/**
 * Hook – stav a logika výtisků (otevírání/zavírání, toast).
 * Sdružuje všechny výtiskové stavy a handlery pro použití v App a v menu.
 */

import { useState, useCallback, useRef } from 'react'

type DriverActivitiesPrint = { dayUtc: number; isUtc: boolean; slot: 1 | 2 }

export type UsePrintStateReturn = {
  driverActivitiesPrint: DriverActivitiesPrint | null
  openPrintDriverActivities: (dayUtc: number, isUtc: boolean, slot: 1 | 2) => void
  onCloseDriverActivities: () => void
  // Stav
  printDriver1Open: boolean
  printDriver1SelectedDate: number | null
  printDriver1IsUtc: boolean
  printDriverSlot: 1 | 2
  printVDiagramOpen: boolean
  printVDiagramSelectedDate: number | null
  printVehicle24hOpen: boolean
  printVehicle24hSelectedDate: number | null
  printVehicle24hIsUtc: boolean
  printVehicleEventsUtc: boolean | null
  openPrintVehicleEvents: (isUtc: boolean) => void
  onCloseVehicleEvents: () => void
  printSpeedVehicleOpen: boolean
  printStartedToastUntil: number | null

  // Odvozené
  isPrintoutActive: boolean

  // Otevření konkrétního výtisku (volá se z menu nebo z průvodce)
  openPrintDriverCard: (dayUtc: number | null, isUtc?: boolean, slot?: 1 | 2) => void
  openPrintVDiagram: (dayUtc?: number | null) => void
  openPrintVehicle24h: (dayUtc: number, isUtc: boolean) => void
  openPrintSpeedVehicle: () => void

  // Zavření – jednotlivé (pro tlačítko × v overlayi) a všechno najednou (pro Zpět / Reset)
  onCloseDriver1: () => void
  onCloseVDiagram: () => void
  onCloseVehicle24h: () => void
  onCloseSpeedVehicle: () => void
  closeAll: () => void

  showPrintStartedToast: () => void
}

export function usePrintState(): UsePrintStateReturn {
  const [driverActivitiesPrint, setDriverActivitiesPrint] = useState<DriverActivitiesPrint | null>(null)
  const [printDriver1Open, setPrintDriver1Open] = useState(false)
  const [printDriver1SelectedDate, setPrintDriver1SelectedDate] = useState<number | null>(null)
  const [printDriver1IsUtc, setPrintDriver1IsUtc] = useState(true)
  const [printDriverSlot, setPrintDriverSlot] = useState<1 | 2>(1)
  const [printVDiagramOpen, setPrintVDiagramOpen] = useState(false)
  const [printVDiagramSelectedDate, setPrintVDiagramSelectedDate] = useState<number | null>(null)
  const [printVehicle24hSelectedDate, setPrintVehicle24hSelectedDate] = useState<number | null>(null)
  const [printVehicle24hIsUtc, setPrintVehicle24hIsUtc] = useState(true)
  const [printVehicle24hOpen, setPrintVehicle24hOpen] = useState(false)
  const [printVehicleEventsUtc, setPrintVehicleEventsUtc] = useState<boolean | null>(null)
  const [printSpeedVehicleOpen, setPrintSpeedVehicleOpen] = useState(false)
  const [printStartedToastUntil, setPrintStartedToastUntil] = useState<number | null>(null)
  const printStartedToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showPrintStartedToast = useCallback(() => {
    if (printStartedToastTimeoutRef.current) clearTimeout(printStartedToastTimeoutRef.current)
    const until = Date.now() + 1000
    setPrintStartedToastUntil(until)
    printStartedToastTimeoutRef.current = setTimeout(() => {
      setPrintStartedToastUntil(null)
      printStartedToastTimeoutRef.current = null
    }, 1000)
  }, [])

  const openPrintDriverCard = useCallback(
    (dayUtc: number | null, isUtc = true, slot: 1 | 2 = 1) => {
      setPrintDriver1SelectedDate(dayUtc)
      setPrintDriver1IsUtc(isUtc)
      setPrintDriverSlot(slot)
      setPrintDriver1Open(true)
      showPrintStartedToast()
    },
    [showPrintStartedToast],
  )
  const openPrintVDiagram = useCallback(
    (dayUtc?: number | null) => {
      setPrintVDiagramSelectedDate(dayUtc ?? null)
      setPrintVDiagramOpen(true)
      showPrintStartedToast()
    },
    [showPrintStartedToast],
  )
  const openPrintVehicle24h = useCallback(
    (dayUtc: number, isUtc: boolean) => {
      setPrintVehicle24hSelectedDate(dayUtc)
      setPrintVehicle24hIsUtc(isUtc)
      setPrintVehicle24hOpen(true)
      showPrintStartedToast()
    },
    [showPrintStartedToast],
  )
  const openPrintSpeedVehicle = useCallback(() => {
    setPrintSpeedVehicleOpen(true)
    showPrintStartedToast()
  }, [showPrintStartedToast])

  const openPrintVehicleEvents = useCallback((isUtc: boolean) => {
    setPrintVehicleEventsUtc(isUtc)
    showPrintStartedToast()
  }, [showPrintStartedToast])
  const onCloseVehicleEvents = useCallback(() => setPrintVehicleEventsUtc(null), [])

  const onCloseDriver1 = useCallback(() => {
    setPrintDriver1Open(false)
    setPrintDriver1SelectedDate(null)
  }, [])
  const onCloseVDiagram = useCallback(() => {
    setPrintVDiagramOpen(false)
    setPrintVDiagramSelectedDate(null)
  }, [])
  const onCloseVehicle24h = useCallback(() => {
    setPrintVehicle24hOpen(false)
    setPrintVehicle24hSelectedDate(null)
  }, [])
  const onCloseSpeedVehicle = useCallback(() => setPrintSpeedVehicleOpen(false), [])

  const openPrintDriverActivities = useCallback((dayUtc: number, isUtc: boolean, slot: 1 | 2) => {
    setDriverActivitiesPrint({ dayUtc, isUtc, slot })
    showPrintStartedToast()
  }, [showPrintStartedToast])
  const onCloseDriverActivities = useCallback(() => setDriverActivitiesPrint(null), [])

  const closeAll = useCallback(() => {
    setDriverActivitiesPrint(null)
    setPrintDriver1Open(false)
    setPrintDriver1SelectedDate(null)
    setPrintVDiagramOpen(false)
    setPrintVDiagramSelectedDate(null)
    setPrintVehicle24hOpen(false)
    setPrintVehicle24hSelectedDate(null)
    setPrintSpeedVehicleOpen(false)
    setPrintVehicleEventsUtc(null)
  }, [])

  const isPrintoutActive =
    driverActivitiesPrint !== null || printVehicleEventsUtc !== null || printDriver1Open || printVDiagramOpen || printVehicle24hOpen || printSpeedVehicleOpen

  return {
    driverActivitiesPrint,
    openPrintDriverActivities,
    onCloseDriverActivities,
    printVehicleEventsUtc,
    openPrintVehicleEvents,
    onCloseVehicleEvents,
    printDriver1Open,
    printDriver1SelectedDate,
    printDriver1IsUtc,
    printDriverSlot,
    printVDiagramOpen,
    printVDiagramSelectedDate,
    printVehicle24hOpen,
    printVehicle24hSelectedDate,
    printVehicle24hIsUtc,
    printSpeedVehicleOpen,
    printStartedToastUntil,
    isPrintoutActive,
    openPrintDriverCard,
    openPrintVDiagram,
    openPrintVehicle24h,
    openPrintSpeedVehicle,
    onCloseDriver1,
    onCloseVDiagram,
    onCloseVehicle24h,
    onCloseSpeedVehicle,
    closeAll,
    showPrintStartedToast,
  }
}
