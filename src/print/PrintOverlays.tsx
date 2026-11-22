import { PrintDriverActivities } from '../components/overlays/PrintDriverActivities'
/**
 * Jedna komponenta, která rendruje všechny výtiskové overlaye podle stavu z usePrintState.
 */

import { useState } from 'react'
import { PrintPreview, PrintRows } from '../components/overlays/PrintPreview'
import { buildVehicleEventPrintRows } from './vehicleEventPrintRows'
import { buildDriverEventPrintRows, driverEventsFromEventLog } from './driverEventPrintRows'
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
import { buildTechnicalDataPrintRows } from './technicalDataPrintRows'
import { buildInsertedCardsPrintRows } from './insertedCardsPrintRows'
import type { VehicleCardInsertion } from './vehicleCardInsertions'
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
  insertedCardsNow: readonly VehicleCardInsertion[]
  vehicleCardInsertions: readonly VehicleCardInsertion[]
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
  insertedCardsNow,
  vehicleCardInsertions,
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
    printTechnicalOpen,
    onCloseDriver1,
    onCloseVDiagram,
    onCloseVehicle24h,
    onCloseSpeedVehicle,
    onCloseTechnical,
    printStartedToastUntil,
  } = printState
  const showPreview = printStartedToastUntil == null

  const activitiesPrint = printState.driverActivitiesPrint

  return (
    <>
      {activitiesPrint && showPreview && (
        <PrintDriverActivities
          input={() => ({ ...dailyDriverCard(activitiesPrint.slot), selectedDayUtc: activitiesPrint.dayUtc, isUtc: activitiesPrint.isUtc })}
          symbols={symbolMap}
          onClose={printState.onCloseDriverActivities}
          closeLabel={t.printOverlay.close}
          title={`${t.printOverlay.driverActivitiesTitle} ${activitiesPrint.slot}`}
        />
      )}
      {printDriver1Open && printDriver1SelectedDate != null && showPreview && (
        <DailyDriverCardPrint
          input={() => ({ ...dailyDriverCard(printDriverSlot), selectedDayUtc: printDriver1SelectedDate, isUtc: printDriver1IsUtc })}
          symbols={symbolMap}
          onClose={onCloseDriver1}
          closeLabel={t.printOverlay.close}
          title={`${t.printOverlay.driverCard24hTitle} ${printDriverSlot}`}
        />
      )}

      <PrintDriver1Overlay
        open={printDriver1Open && printDriver1SelectedDate == null && showPreview}
        onClose={onCloseDriver1}
        t={t}
        printDriver1SelectedDate={printDriver1SelectedDate}
        simulatedUtcTime={simulatedUtcTime}
        card1Data={card1Data}
        driver1ManualEntryBuffer={driver1ManualEntryBuffer}
        slot1CardActivities={slot1CardActivities}
        eventLog={eventLog}
      />

      {printVehicle24hOpen && showPreview && (
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

      {printVDiagramOpen && showPreview && (
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

      {printState.printVehicleEventsUtc !== null && showPreview && (
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
          title={t.printOverlay.vehicleEventsTitle}
          onClose={printState.onCloseVehicleEvents}
        />
      )}

      {printState.printDriverEvents && showPreview && (
        <DriverEventsPreview
          input={() => {
            const slot = printState.printDriverEvents!.slot
            const day = dailyDriverCard(slot)
            return {
              importedEvents: day.imported?.events,
              importedFaults: day.imported?.faults,
              // Simulované VU záznamy jízdy bez karty; 4:15/4:30 sem nepatří.
              simulatedEvents: slot === 1 ? driverEventsFromEventLog(eventLog, simulatedUtcTime) : [],
              profile: vehicleProfile,
              card: day.card ? printCardHolder(day.card, day.imported) : null,
              printedAtUtc: simulatedUtcTime,
              localOffsetMs: day.localOffsetMs,
              isUtc: printState.printDriverEvents!.isUtc,
            }
          }}
          symbols={symbolMap}
          closeLabel={t.printOverlay.close}
          title={`${t.printOverlay.driverEventsTitle} ${printState.printDriverEvents.slot}`}
          onClose={printState.onCloseDriverEvents}
        />
      )}

      {printState.printInsertedCardsUtc !== null && showPreview && (
        <InsertedCardsPreview
          input={() => ({
            printedAtUtc: simulatedUtcTime,
            isUtc: printState.printInsertedCardsUtc ?? true,
            localOffsetMs: vehicleDay().localOffsetMs,
            insertedNow: insertedCardsNow,
            insertionHistory: vehicleCardInsertions,
          })}
          symbols={symbolMap}
          title={t.menu.items.PV_CARDS?.line2 ?? ''}
          closeLabel={t.printOverlay.close}
          onClose={printState.onCloseInsertedCards}
        />
      )}

      {printTechnicalOpen && showPreview && (
        <TechnicalPreview
          input={() => ({
            printedAtUtc: simulatedUtcTime,
            isUtc: true,
            localOffsetMs: vehicleDay().localOffsetMs,
            profile: vehicleProfile,
          })}
          symbols={symbolMap}
          title={t.ui.printTechnicalTitle}
          closeLabel={t.printOverlay.close}
          onClose={onCloseTechnical}
        />
      )}

      {printSpeedVehicleOpen && showPreview && <PrintSpeedVehicleOverlay
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

function InsertedCardsPreview({ input, symbols, title, closeLabel, onClose }: {
  input: () => Parameters<typeof buildInsertedCardsPrintRows>[0]
  symbols: SymbolMap | null
  title: string
  closeLabel: string
  onClose: () => void
}) {
  const [rows] = useState(() => buildInsertedCardsPrintRows(input()))
  return (
    <PrintPreview title={title} closeLabel={closeLabel} onClose={onClose} ready={!!symbols?.[18]}>
      <PrintRows rows={rows} symbols={symbols} />
    </PrintPreview>
  )
}

function TechnicalPreview({ input, symbols, title, closeLabel, onClose }: {
  input: () => Parameters<typeof buildTechnicalDataPrintRows>[0]
  symbols: SymbolMap | null
  title: string
  closeLabel: string
  onClose: () => void
}) {
  const [rows] = useState(() => buildTechnicalDataPrintRows(input()))
  return (
    <PrintPreview title={title} closeLabel={closeLabel} onClose={onClose} ready={!!symbols?.[18]}>
      <PrintRows rows={rows} symbols={symbols} />
    </PrintPreview>
  )
}

function VehicleEventsPreview({ input, symbols, title, closeLabel, onClose }: {
  input: () => Parameters<typeof buildVehicleEventPrintRows>[0]
  symbols: SymbolMap | null
  title: string
  closeLabel: string
  onClose: () => void
}) {
  const [rows] = useState(() => buildVehicleEventPrintRows(input()))
  return (
    <PrintPreview title={title} closeLabel={closeLabel} onClose={onClose} ready={!!symbols?.[18]}>
      <PrintRows rows={rows} symbols={symbols} />
    </PrintPreview>
  )
}

function DriverEventsPreview({ input, symbols, title, closeLabel, onClose }: {
  input: () => Parameters<typeof buildDriverEventPrintRows>[0]
  symbols: SymbolMap | null
  title: string
  closeLabel: string
  onClose: () => void
}) {
  const [rows] = useState(() => buildDriverEventPrintRows(input()))
  return (
    <PrintPreview title={title} closeLabel={closeLabel} onClose={onClose} ready={!!symbols?.[18]}>
      <PrintRows rows={rows} symbols={symbols} />
    </PrintPreview>
  )
}
