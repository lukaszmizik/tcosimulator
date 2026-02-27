/**
 * Technická data vozidla a tachografu.
 * Natvrdo zapsané hodnoty – součást každého výtisku.
 */

export type TachographGeneration = 'GEN1' | 'GEN2'

export type VehicleTechnicalData = {
  /** VIN vozidla (17 znaků) */
  vehicleIdentificationNumber: string
  /** Registrační značka vozidla */
  vehicleRegistration: string
  /** Schvalující členský stát (ISO 2) */
  approvingMemberState: string
  /** Generace tachografu */
  tachographGeneration: TachographGeneration
  /** Verze generace (např. v2) */
  generationVersion: string
  /** Standardní náklad vozidla [kg] */
  standardVehicleLoadKg: number
  /** Výrobce tachografu */
  tachographManufacturer: string
  /** Číslo DTCO 4.1x */
  dtcoNumber: string
  /** Generace jednotky ve vozidle (GEN1, GEN2) */
  unitGeneration: TachographGeneration
  /** Poslední kalibrace 4.1x */
  lastCalibration: {
    /** Název servisu */
    serviceName: string
    /** Identifikace dílenské karty */
    workshopCardId: string
    /** Datum kalibrace */
    date: string
  }
}

/** Technická data vozidla a tachografu – natvrdo */
export const VEHICLE_TECHNICAL_DATA: VehicleTechnicalData = {
  vehicleIdentificationNumber: 'WBADT43452G123456',
  vehicleRegistration: '1TL0280',
  approvingMemberState: 'CZ',
  tachographGeneration: 'GEN2',
  generationVersion: 'v2',
  standardVehicleLoadKg: 18500,
  tachographManufacturer: 'Continental Automotive Technologies GmbH',
  dtcoNumber: 'DTCO1381B-A3F92C',
  unitGeneration: 'GEN2',
  lastCalibration: {
    serviceName: 'Servis tachografů Praha s.r.o.',
    workshopCardId: 'CZE99887766554433',
    date: '15.03.2024',
  },
}
