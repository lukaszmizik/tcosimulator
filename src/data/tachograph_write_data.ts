// Paměť simulovaného tachografu je vázaná na otevřenou stránku.
import type {
  ActivityHistoryEntry,
  FaultOrEvent,
  EventLogEntry,
  VehicleLoadUnloadEvent,
  FerryTrainEvent,
  OutModeEvent,
  RecordedGpsLocation,
} from '../TachoTypes'

let activityHistory: ActivityHistoryEntry[] = []

export function loadTachographActivityHistory(): ActivityHistoryEntry[] {
  return activityHistory
}

export function saveTachographActivityHistory(entries: ActivityHistoryEntry[]): void {
  activityHistory = entries
}

let faultsAndEvents: FaultOrEvent[] = []

export function loadTachographFaultsAndEvents(): FaultOrEvent[] {
  return faultsAndEvents
}

export function saveTachographFaultsAndEvents(entries: FaultOrEvent[]): void {
  faultsAndEvents = entries
}

let eventLog: EventLogEntry[] = []

export function loadTachographEventLog(): EventLogEntry[] {
  return eventLog
}

export function saveTachographEventLog(entries: EventLogEntry[]): void {
  eventLog = entries
}

let vehicleLoadUnloadEvents: VehicleLoadUnloadEvent[] = []

export function loadTachographVehicleLoadUnloadEvents(): VehicleLoadUnloadEvent[] {
  return vehicleLoadUnloadEvents
}

export function saveTachographVehicleLoadUnloadEvents(entries: VehicleLoadUnloadEvent[]): void {
  vehicleLoadUnloadEvents = entries
}

let ferryTrainEvents: FerryTrainEvent[] = []

export function loadTachographFerryTrainEvents(): FerryTrainEvent[] {
  return ferryTrainEvents
}

export function saveTachographFerryTrainEvents(entries: FerryTrainEvent[]): void {
  ferryTrainEvents = entries
}

let outModeEvents: OutModeEvent[] = []

export function loadTachographOutModeEvents(): OutModeEvent[] {
  return outModeEvents
}

export function saveTachographOutModeEvents(entries: OutModeEvent[]): void {
  outModeEvents = entries
}

let recordedGpsLocations: RecordedGpsLocation[] = []

export function loadTachographRecordedGpsLocations(): RecordedGpsLocation[] {
  return recordedGpsLocations
}

export function saveTachographRecordedGpsLocations(entries: RecordedGpsLocation[]): void {
  recordedGpsLocations = entries
}
