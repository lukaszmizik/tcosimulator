import { PrintDriverActivities } from '../components/overlays/PrintDriverActivities'
/**
 * Jedna komponenta, která rendruje všechny výtiskové overlaye podle stavu z usePrintState.
 */

import { useState } from 'react'
import { PrintPreview, PrintRows } from '../components/overlays/PrintPreview'
import { buildVehicleEventPrintRows } from './vehicleEventPrintRows'
import type { FaultOrEvent } from '../TachoTypes'
import './dailyDriverCardPrint.css'
import { DailyDriverCardPrint } from '../components/overlays/DailyDriverCardPrint'
import type { PrintVehicleProfile } from '../data/printVehicleProfile'
import type { DailyCardPrintInput } from './driverCardPrintRows'
import type { VehicleDayPrintData } from './vehicleDayPrintRows'
import type { UsePrintStateReturn } from './usePrintState'
import type { SymbolMap } from '../TachoTypes'
import type { CardData, EventLogEntry, ManualEntrySegment } from '../TachoTypes'
import type { SecondActivitySnapshot } from '../TachoTypes'
import type { Translations } from '../translations/types'
import { printCardHolder } from './driverCardPrintRows'
import { PrintDriver1Overlay } from '../components/overlays/PrintDriver1Overlay'
import { PrintVehicle24hOverlay } from '../components/overlays/PrintVehicle24hOverlay'
import { PrintVDiagramOverlay } from '../components/overlays/PrintVDiagramOverlay'
import { PrintSpeedVehicleOverlay } from '../components/overlays/PrintSpeedVehicleOverlay'
import type { Driver1PrintCardActivity } from './prepareDriver1Print24h'

export type PrintOverlaysProps = {
  printState: UsePrintStateReturn
  t: Translations
  simulatedUtcTime: number
  secondHistory: SecondActivitySnapshot[]
  symbolMap: SymbolMap | null
  card1Inserted: boolean
  card1Data: CardData | null
  driver1ManualEntryBuffer: ManualEntrySegment[]
  slot1CardActivities?: readonly Driver1PrintCardActivity[]
  eventLog: EventLogEntry[]
  vehicleEvents: readonly FaultOrEvent[]
  vehicleDay: () => VehicleDayPrintData
  vehicleProfile: PrintVehicleProfile
  dailyDriverCard: (slot: 1 | 2) => Omit<DailyCardPrintInput, 'selectedDayUtc' | 'isUtc'>
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
  slot1CardActivities = [],
  eventLog,
  vehicleEvents,
  vehicleDay,
  vehicleProfile,
  dailyDriverCard,
}: PrintOverlaysProps) {
  const {
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
    onCloseDriver1,
    onCloseVDiagram,
    onCloseVehicle24h,
    onCloseSpeedVehicle,
  } = printState

  const activitiesPrint = printState.driverActivitiesPrint

  return (
    <>
      {activitiesPrint && (
        <PrintDriverActivities
          input={() => ({ ...dailyDriverCard(activitiesPrint.slot), selectedDayUtc: activitiesPrint.dayUtc, isUtc: activitiesPrint.isUtc })}
          symbols={symbolMap}
          onClose={printState.onCloseDriverActivities}
          closeLabel={t.printOverlay.close}
          title={`Aktivity řidiče ${activitiesPrint.slot}`}
        />
      )}
      {printDriver1Open && printDriver1SelectedDate != null && (
        <DailyDriverCardPrint
          input={() => ({ ...dailyDriverCard(printDriverSlot), selectedDayUtc: printDriver1SelectedDate, isUtc: printDriver1IsUtc })}
          symbols={symbolMap}
          onClose={onCloseDriver1}
          closeLabel={t.printOverlay.close}
          title={`${t.printOverlay.driverCard24hTitle} ${printDriverSlot}`}
        />
      )}

      <PrintDriver1Overlay
        open={printDriver1Open && printDriver1SelectedDate == null}
        onClose={onCloseDriver1}
        t={t}
        printDriver1SelectedDate={printDriver1SelectedDate}
        simulatedUtcTime={simulatedUtcTime}
        card1Data={card1Data}
        driver1ManualEntryBuffer={driver1ManualEntryBuffer}
        slot1CardActivities={slot1CardActivities}
        eventLog={eventLog}
      />

      {printVehicle24hOpen && (
        <PrintVehicle24hOverlay
          onClose={onCloseVehicle24h}
          t={t}
          input={() => ({
            ...vehicleDay(),
            selectedDayUtc: printVehicle24hSelectedDate ?? simulatedUtcTime,
            printedAtUtc: simulatedUtcTime,
            isUtc: printVehicle24hIsUtc,
          })}
          symbols={symbolMap}
        />
      )}

      {printVDiagramOpen && (
        <PrintVDiagramOverlay
          onClose={onCloseVDiagram}
          t={t}
          dateUtc={printVDiagramSelectedDate ?? simulatedUtcTime}
          simulatedUtcTime={simulatedUtcTime}
          secondHistory={secondHistory}
          symbolMap={symbolMap}
          profile={vehicleProfile}
        />
      )}

      {printState.printVehicleEventsUtc !== null && (
        <VehicleEventsPreview
          input={() => ({
            records: vehicleEvents,
            profile: vehicleProfile,
            card: card1Inserted && card1Data
              ? printCardHolder(card1Data, dailyDriverCard(1).imported)
              : null,
            printedAtUtc: simulatedUtcTime,
            localOffsetMs: vehicleDay().localOffsetMs,
            isUtc: printState.printVehicleEventsUtc ?? true,
          })}
          symbols={symbolMap}
          closeLabel={t.printOverlay.close}
          onClose={printState.onCloseVehicleEvents}
        />
      )}

      {printSpeedVehicleOpen && <PrintSpeedVehicleOverlay
        onClose={onCloseSpeedVehicle}
        t={t}
        simulatedUtcTime={simulatedUtcTime}
        symbolMap={symbolMap}
        profile={vehicleProfile}
        records={vehicleEvents}
        card={card1Inserted ? card1Data : null}
      />}
    </>
  )
}

function VehicleEventsPreview({ input, symbols, closeLabel, onClose }: {
  input: () => Parameters<typeof buildVehicleEventPrintRows>[0]
  symbols: SymbolMap | null
  closeLabel: string
  onClose: () => void
}) {
  const [rows] = useState(() => buildVehicleEventPrintRows(input()))
  return (
    <PrintPreview title="Události a poruchy vozidla" closeLabel={closeLabel} onClose={onClose} ready={!!symbols?.[18]}>
      <PrintRows rows={rows} symbols={symbols} />
    </PrintPreview>
  )
}
