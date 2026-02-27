/**
 * Zápis dat z paměti tachografu (bez karty).
 * Slouží k ukládání historie aktivit, chyb, událostí a nakládky/vykládky.
 * Oddělené od dat karet (card1_write_data, card2_write_data).
 */

import type {
  ActivityHistoryEntry,
  FaultOrEvent,
  EventLogEntry,
  VehicleLoadUnloadEvent,
  FerryTrainEvent,
  OutModeEvent,
  RecordedGpsLocation,
} from '../TachoTypes'
import { saveCard1ActivityHistory, saveCard1ManualEntryBuffer } from './card1_write_data'
import { saveCard2ActivityHistory, saveCard2ManualEntryBuffer } from './card2_write_data'

const ACTIVITY_HISTORY_KEY = 'activityHistory'
const FAULTS_AND_EVENTS_KEY = 'faultsAndEvents'
const EVENT_LOG_KEY = 'eventLog'
const VEHICLE_LOAD_UNLOAD_EVENTS_KEY = 'vehicleLoadUnloadEvents'
const FERRY_TRAIN_EVENTS_KEY = 'ferryTrainEvents'
const OUT_MODE_EVENTS_KEY = 'outModeEvents'
const RECORDED_GPS_LOCATIONS_KEY = 'recordedGpsLocations'

/**
 * Načte historii aktivit z paměti tachografu.
 */
export function loadTachographActivityHistory(): ActivityHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ACTIVITY_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ActivityHistoryEntry[]) : []
  } catch {
    return []
  }
}

/**
 * Uloží historii aktivit do paměti tachografu.
 */
export function saveTachographActivityHistory(entries: ActivityHistoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte chyby a události tachografu.
 */
export function loadTachographFaultsAndEvents(): FaultOrEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FAULTS_AND_EVENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FaultOrEvent[]) : []
  } catch {
    return []
  }
}

/**
 * Uloží chyby a události tachografu.
 */
export function saveTachographFaultsAndEvents(entries: FaultOrEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAULTS_AND_EVENTS_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte log událostí tachografu.
 */
export function loadTachographEventLog(): EventLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(EVENT_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as EventLogEntry[]) : []
  } catch {
    return []
  }
}

/**
 * Uloží log událostí tachografu.
 */
export function saveTachographEventLog(entries: EventLogEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte události nakládky/vykládky vozidla.
 */
export function loadTachographVehicleLoadUnloadEvents(): VehicleLoadUnloadEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(VEHICLE_LOAD_UNLOAD_EVENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Uloží události nakládky/vykládky vozidla.
 */
export function saveTachographVehicleLoadUnloadEvents(entries: VehicleLoadUnloadEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VEHICLE_LOAD_UNLOAD_EVENTS_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte události režimu trajekt (aktivace/deaktivace).
 */
export function loadTachographFerryTrainEvents(): FerryTrainEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FERRY_TRAIN_EVENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Uloží události režimu trajekt (aktivace/deaktivace).
 */
export function saveTachographFerryTrainEvents(entries: FerryTrainEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FERRY_TRAIN_EVENTS_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte události režimu OUT (aktivace/deaktivace).
 */
export function loadTachographOutModeEvents(): OutModeEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(OUT_MODE_EVENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Uloží události režimu OUT (aktivace/deaktivace).
 */
export function saveTachographOutModeEvents(entries: OutModeEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(OUT_MODE_EVENTS_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Načte zaznamenané GPS lokace (každé 3 h řízení).
 */
export function loadTachographRecordedGpsLocations(): RecordedGpsLocation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECORDED_GPS_LOCATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecordedGpsLocation[]) : []
  } catch {
    return []
  }
}

/**
 * Uloží zaznamenané GPS lokace.
 */
export function saveTachographRecordedGpsLocations(entries: RecordedGpsLocation[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECORDED_GPS_LOCATIONS_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/**
 * Při načtení stránky (refresh) vymaže ze všech karet všechna data kromě tvrdé konstanty
 * „poslední vyjmutí“. Cílové a výchozí země (manuální záznamy) ovlivňují výpočty – po obnovení
 * stránky je čas simulátoru aktuální, proto je nejvýhodnější karty vyprázdnit a ponechat jen
 * čas posledního vyjmutí.
 */
function clearCardDataOnLoad(): void {
  if (typeof window === 'undefined') return
  try {
    saveCard1ActivityHistory([])
    saveCard2ActivityHistory([])
    saveCard1ManualEntryBuffer([])
    saveCard2ManualEntryBuffer([])
    // Poslední vyjmutí (lastWithdrawal) se nemění – zůstává jako jediná zachovaná konstanta
  } catch {
    // ignore
  }
}

/**
 * Načte historii aktivit po šablonách karet.
 * Při načtení stránky jsou data karet již vyprázdněna v clearCardDataOnLoad() (voláno níže při importu).
 */
export function loadTachographCardActivityHistoryByTemplateId(): Record<string, ActivityHistoryEntry[]> {
  if (typeof window === 'undefined') return {}
  return {}
}

// Při načtení stránky (refresh) ihned vymaž z karet vše kromě posledního vyjmutí,
// aby i další inicializace (driver1ManualEntryBuffer, driver2ManualEntryBuffer) načetly prázdné hodnoty.
if (typeof window !== 'undefined') {
  clearCardDataOnLoad()
}
