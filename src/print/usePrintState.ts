/**
 * Hook – stav a logika výtisků (otevírání/zavírání, toast).
 * Sdružuje všechny výtiskové stavy a handlery pro použití v App a v menu.
 */

import { useState, useCallback, useRef, useEffect } from 'react'

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
  printDriverEvents: { slot: 1 | 2; isUtc: boolean } | null
  openPrintDriverEvents: (slot: 1 | 2, isUtc: boolean) => void
  onCloseDriverEvents: () => void
  printSpeedVehicleOpen: boolean
  printTechnicalOpen: boolean
  printInsertedCardsUtc: boolean | null
  openPrintInsertedCards: (isUtc: boolean) => void
  onCloseInsertedCards: () => void
  printStartedToastUntil: number | null

  // Odvozené
  isPrintoutActive: boolean

  // Otevření konkrétního výtisku (volá se z menu nebo z průvodce)
  openPrintDriverCard: (dayUtc: number | null, isUtc?: boolean, slot?: 1 | 2) => void
  openPrintVDiagram: (dayUtc?: number | null) => void
  openPrintVehicle24h: (dayUtc: number, isUtc: boolean) => void
  openPrintSpeedVehicle: () => void
  openPrintTechnical: () => void

  // Zavření – jednotlivé (pro tlačítko × v overlayi) a všechno najednou (pro Zpět / Reset)
  onCloseDriver1: () => void
  onCloseVDiagram: () => void
  onCloseVehicle24h: () => void
  onCloseSpeedVehicle: () => void
  onCloseTechnical: () => void
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
  const [printDriverEvents, setPrintDriverEvents] = useState<{ slot: 1 | 2; isUtc: boolean } | null>(null)
  const [printSpeedVehicleOpen, setPrintSpeedVehicleOpen] = useState(false)
  const [printTechnicalOpen, setPrintTechnicalOpen] = useState(false)
  const [printInsertedCardsUtc, setPrintInsertedCardsUtc] = useState<boolean | null>(null)
  const [printStartedToastUntil, setPrintStartedToastUntil] = useState<number | null>(null)
  const printStartedToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPrintRef = useRef<(() => void) | null>(null)

  const cancelPendingPrint = useCallback(() => {
    if (printStartedToastTimeoutRef.current) {
      clearTimeout(printStartedToastTimeoutRef.current)
      printStartedToastTimeoutRef.current = null
    }
    pendingPrintRef.current = null
    setPrintStartedToastUntil(null)
  }, [])

  const armPrint = useCallback((open: () => void) => {
    if (printStartedToastTimeoutRef.current) clearTimeout(printStartedToastTimeoutRef.current)
    pendingPrintRef.current = open
    setPrintStartedToastUntil(Date.now() + 2000)
    printStartedToastTimeoutRef.current = setTimeout(() => {
      printStartedToastTimeoutRef.current = null
      const openPending = pendingPrintRef.current
      pendingPrintRef.current = null
      setPrintStartedToastUntil(null)
      openPending?.()
    }, 2000)
  }, [])

  useEffect(() => () => {
    if (printStartedToastTimeoutRef.current) clearTimeout(printStartedToastTimeoutRef.current)
  }, [])

  const showPrintStartedToast = useCallback(() => {
    armPrint(() => {})
  }, [armPrint])

  const openPrintDriverCard = useCallback(
    (dayUtc: number | null, isUtc = true, slot: 1 | 2 = 1) => {
      armPrint(() => {
        setPrintDriver1SelectedDate(dayUtc)
        setPrintDriver1IsUtc(isUtc)
        setPrintDriverSlot(slot)
        setPrintDriver1Open(true)
      })
    },
    [armPrint],
  )
  const openPrintVDiagram = useCallback(
    (dayUtc?: number | null) => {
      armPrint(() => {
        setPrintVDiagramSelectedDate(dayUtc ?? null)
        setPrintVDiagramOpen(true)
      })
    },
    [armPrint],
  )
  const openPrintVehicle24h = useCallback(
    (dayUtc: number, isUtc: boolean) => {
      armPrint(() => {
        setPrintVehicle24hSelectedDate(dayUtc)
        setPrintVehicle24hIsUtc(isUtc)
        setPrintVehicle24hOpen(true)
      })
    },
    [armPrint],
  )
  const openPrintSpeedVehicle = useCallback(() => {
    armPrint(() => setPrintSpeedVehicleOpen(true))
  }, [armPrint])
  const openPrintTechnical = useCallback(() => {
    armPrint(() => setPrintTechnicalOpen(true))
  }, [armPrint])
  const openPrintInsertedCards = useCallback((isUtc: boolean) => {
    armPrint(() => setPrintInsertedCardsUtc(isUtc))
  }, [armPrint])
  const onCloseInsertedCards = useCallback(() => setPrintInsertedCardsUtc(null), [])

  const openPrintVehicleEvents = useCallback((isUtc: boolean) => {
    armPrint(() => setPrintVehicleEventsUtc(isUtc))
  }, [armPrint])
  const onCloseVehicleEvents = useCallback(() => setPrintVehicleEventsUtc(null), [])

  const openPrintDriverEvents = useCallback((slot: 1 | 2, isUtc: boolean) => {
    armPrint(() => setPrintDriverEvents({ slot, isUtc }))
  }, [armPrint])
  const onCloseDriverEvents = useCallback(() => setPrintDriverEvents(null), [])

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
  const onCloseTechnical = useCallback(() => setPrintTechnicalOpen(false), [])

  const openPrintDriverActivities = useCallback((dayUtc: number, isUtc: boolean, slot: 1 | 2) => {
    armPrint(() => setDriverActivitiesPrint({ dayUtc, isUtc, slot }))
  }, [armPrint])
  const onCloseDriverActivities = useCallback(() => setDriverActivitiesPrint(null), [])

  const closeAll = useCallback(() => {
    cancelPendingPrint()
    setDriverActivitiesPrint(null)
    setPrintDriver1Open(false)
    setPrintDriver1SelectedDate(null)
    setPrintVDiagramOpen(false)
    setPrintVDiagramSelectedDate(null)
    setPrintVehicle24hOpen(false)
    setPrintVehicle24hSelectedDate(null)
    setPrintSpeedVehicleOpen(false)
    setPrintTechnicalOpen(false)
    setPrintInsertedCardsUtc(null)
    setPrintVehicleEventsUtc(null)
    setPrintDriverEvents(null)
  }, [cancelPendingPrint])

  const isPrintoutActive =
    driverActivitiesPrint !== null
    || printVehicleEventsUtc !== null
    || printDriverEvents !== null
    || printDriver1Open
    || printVDiagramOpen
    || printVehicle24hOpen
    || printSpeedVehicleOpen
    || printTechnicalOpen
    || printInsertedCardsUtc !== null
    || printStartedToastUntil !== null

  return {
    driverActivitiesPrint,
    openPrintDriverActivities,
    onCloseDriverActivities,
    printVehicleEventsUtc,
    openPrintVehicleEvents,
    onCloseVehicleEvents,
    printDriverEvents,
    openPrintDriverEvents,
    onCloseDriverEvents,
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
    printTechnicalOpen,
    printInsertedCardsUtc,
    openPrintInsertedCards,
    onCloseInsertedCards,
    printStartedToastUntil,
    isPrintoutActive,
    openPrintDriverCard,
    openPrintVDiagram,
    openPrintVehicle24h,
    openPrintSpeedVehicle,
    openPrintTechnical,
    onCloseDriver1,
    onCloseVDiagram,
    onCloseVehicle24h,
    onCloseSpeedVehicle,
    onCloseTechnical,
    closeAll,
    showPrintStartedToast,
  }
}
