/**
 * Jedna komponenta, která rendruje všechny výtiskové overlaye podle stavu z usePrintState.
 */

import type { UsePrintStateReturn } from './usePrintState'
import type { SymbolMap } from '../TachoTypes'
import type { CardData, EventLogEntry, ManualEntrySegment } from '../TachoTypes'
import type { SecondActivitySnapshot } from '../TachoTypes'
import type { Translations } from '../translations/types'
import { getCard1StoredData } from '../data/card_stored_data'
import { VEHICLE_TECHNICAL_DATA } from '../data/vehicle_technical_data'
import { PrintDriver1Overlay } from '../components/overlays/PrintDriver1Overlay'
import { PrintVehicle24hOverlay } from '../components/overlays/PrintVehicle24hOverlay'
import { PrintVDiagramOverlay } from '../components/overlays/PrintVDiagramOverlay'
import { PrintSpeedVehicleOverlay } from '../components/overlays/PrintSpeedVehicleOverlay'

export type PrintOverlaysProps = {
  printState: UsePrintStateReturn
  t: Translations
  simulatedUtcTime: number
  secondHistory: SecondActivitySnapshot[]
  symbolMap: SymbolMap | null
  card1Inserted: boolean
  card1Data: CardData | null
  driver1ManualEntryBuffer: ManualEntrySegment[]
  eventLog: EventLogEntry[]
  odometerKm: number
}

export function PrintOverlays({
  printState,
  t,
  simulatedUtcTime,
  secondHistory,
  symbolMap,
  card1Inserted,
  card1Data,
  driver1ManualEntryBuffer,
  eventLog,
  odometerKm,
}: PrintOverlaysProps) {
  const {
    printDriver1Open,
    printDriver1SelectedDate,
    printVDiagramOpen,
    printVDiagramSelectedDate,
    printVehicle24hOpen,
    printVehicle24hSelectedDate,
    printVehicle24hIsUtc,
    printSpeedVehicleOpen,
    onCloseDriver1,
    onCloseVDiagram,
    onCloseVehicle24h,
    onCloseSpeedVehicle,
  } = printState

  const speedVehicleDriverData =
    card1Inserted && card1Data
      ? (() => {
          const s = getCard1StoredData()
          return { surname: s.surname, firstName: s.firstName, cardNumber: s.cardNumber, dateOfExpiry: s.dateOfExpiry }
        })()
      : null
  const speedVehicleDataBlock = {
    vin: VEHICLE_TECHNICAL_DATA.vehicleIdentificationNumber,
    registrationNumber: VEHICLE_TECHNICAL_DATA.vehicleRegistration,
  }

  return (
    <>
      <PrintDriver1Overlay
        open={printDriver1Open}
        onClose={onCloseDriver1}
        t={t}
        printDriver1SelectedDate={printDriver1SelectedDate}
        simulatedUtcTime={simulatedUtcTime}
        card1Data={card1Data}
        driver1ManualEntryBuffer={driver1ManualEntryBuffer}
        eventLog={eventLog}
      />

      <PrintVehicle24hOverlay
        open={printVehicle24hOpen}
        onClose={onCloseVehicle24h}
        t={t}
        printVehicle24hSelectedDate={printVehicle24hSelectedDate}
        simulatedUtcTime={simulatedUtcTime}
        odometerKm={odometerKm}
        secondHistory={secondHistory}
        symbolMap={symbolMap}
        printVehicle24hIsUtc={printVehicle24hIsUtc}
      />

      <PrintVDiagramOverlay
        open={printVDiagramOpen}
        onClose={onCloseVDiagram}
        t={t}
        printVDiagramSelectedDate={printVDiagramSelectedDate}
        simulatedUtcTime={simulatedUtcTime}
        secondHistory={secondHistory}
        symbolMap={symbolMap}
      />

      <PrintSpeedVehicleOverlay
        open={printSpeedVehicleOpen}
        onClose={onCloseSpeedVehicle}
        t={t}
        simulatedUtcTime={simulatedUtcTime}
        symbolMap={symbolMap}
        driverDataBlock={speedVehicleDriverData}
        vehicleDataBlock={speedVehicleDataBlock}
      />
    </>
  )
}
