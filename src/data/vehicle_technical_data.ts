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
  /** Poslední kontrola. Číslo karty má 16 znaků: 14 znaků těla, index náhrady a index obnovy. */
  lastControl: {
    atUtc: number
    controlCardId: string
    operation: 'vuDownload'
  }
  /** Adresa výrobce pro blok [14]. */
  manufacturerAddress: readonly string[]
  /** Číslo schválení typu. */
  typeApprovalNumber: string
  /** Výrobní číslo tachografu. */
  serialNumber: string
  /** Rok výroby. */
  yearOfManufacture: string
  /** Verze uživatelského softwaru. */
  softwareVersion: string
  /** Datum instalace uživatelského softwaru, DD.MM.RRRR. */
  softwareInstalledOn: string
  /** Verze uložené digitální mapy. */
  digitalMapVersion: string
  /** Snímač pohybu, blok [15]. */
  sensor: {
    serialNumber: string
    typeApprovalNumber: string
    coupledAtUtc: number
  }
  /** Modul GNSS, blok [16]. 6 = součást DTCO. */
  gnss: {
    serialNumber: string
    deviceType: string
    productionPeriod: string
    manufacturerCode: string
  }
  /** Modul DSRC, blok [16a]. 6 = součást DTCO. */
  dsrc: {
    serialNumber: string
    deviceType: string
    productionPeriod: string
    manufacturerCode: string
  }
  /** Výchozí druh nákladu, když ho profil vozidla neurčí. */
  standardLoad: 'passengers' | 'goods'
  /** Dvě fiktivní kalibrace, blok [17]. Novější je první. */
  calibrations: readonly TechnicalCalibration[]
}

export type TechnicalCalibration = {
  /** 02 = první montáž, 04 = pravidelná kontrola. */
  purpose: '02' | '04'
  atUtc: number
  serviceName: string
  address: string
  workshopCardId: string
  workshopCardExpiry: string
  wImpulsesPerKm: number
  kImpulsesPerKm: number
  tyreCircumferenceMm: number
  tyreSize: string
  maxSpeedKmh: number
  odometerOldKm: number
  odometerNewKm: number
  country: string
  gnssAtUtc: number
  seals: readonly string[]
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
  lastControl: {
    atUtc: Date.UTC(2026, 9, 15, 10, 30),
    controlCardId: 'CZ00000000CTRL01',
    operation: 'vuDownload',
  },
  manufacturerAddress: ['Heinrich-Hertz-Str. 45', '78052 Villingen-Schwenningen'],
  typeApprovalNumber: 'e1*1381/2021*0001',
  serialNumber: 'A3F92C14821',
  yearOfManufacture: '2022',
  softwareVersion: '04.01.32 R024',
  softwareInstalledOn: '15.03.2024',
  digitalMapVersion: '2024.03',
  sensor: {
    serialNumber: '2185-4412907',
    typeApprovalNumber: 'e1*217/2014*2185',
    coupledAtUtc: Date.UTC(2024, 2, 15, 8, 20),
  },
  gnss: {
    serialNumber: 'GNS-4.1-88421',
    deviceType: '6',
    productionPeriod: '0322',
    manufacturerCode: 'A1',
  },
  dsrc: {
    serialNumber: 'DSRC-4.1-55210',
    deviceType: '6',
    productionPeriod: '0322',
    manufacturerCode: 'A1',
  },
  standardLoad: 'goods',
  calibrations: [
    {
      purpose: '04',
      atUtc: Date.UTC(2024, 2, 15, 8, 40),
      serviceName: 'Servis tachografů Praha s.r.o.',
      address: 'Plzeňská 210, Praha 5',
      workshopCardId: 'CZE99887766554433',
      workshopCardExpiry: '14.03.2029',
      wImpulsesPerKm: 8120,
      kImpulsesPerKm: 8120,
      tyreCircumferenceMm: 3180,
      tyreSize: '315/70 R 22.5',
      maxSpeedKmh: 90,
      odometerOldKm: 186420,
      odometerNewKm: 186420,
      country: 'CZ',
      gnssAtUtc: Date.UTC(2024, 2, 15, 8, 41),
      seals: ['A1 7 5521908'],
    },
    {
      purpose: '02',
      atUtc: Date.UTC(2022, 5, 18, 9, 15),
      serviceName: 'Dílna tachografů Ostrava s.r.o.',
      address: 'Nádražní 12, Ostrava',
      workshopCardId: 'CZE11223344556677',
      workshopCardExpiry: '17.06.2027',
      wImpulsesPerKm: 8000,
      kImpulsesPerKm: 8000,
      tyreCircumferenceMm: 3150,
      tyreSize: '315/80 R 22.5',
      maxSpeedKmh: 90,
      odometerOldKm: 5,
      odometerNewKm: 5,
      country: 'CZ',
      gnssAtUtc: Date.UTC(2022, 5, 18, 9, 16),
      seals: ['A1 7 3301844'],
    },
  ],
}
