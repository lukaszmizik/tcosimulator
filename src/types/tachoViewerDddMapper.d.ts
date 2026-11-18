export type DddParsedActivity = {
  kind: 'driving' | 'work' | 'availability' | 'rest' | 'unknown'
  startUtc: number
  endUtc: number
  isManualEntry?: boolean
  isCrew?: boolean
  slot?: 1 | 2
  registration?: string
}

export type DddParsedLocation = {
  recordedAtUtc: number
  recordType?: 'start_country' | 'end_country' | string
  countryCode?: string
  label?: string
  latitude?: number
  longitude?: number
}

export type DddVehicleUse = {
  fromUtc: number
  toUtc: number
  registration: string
  registrationNation?: string
  vin?: string
  kilometers: number | null
  odometerBeginKm?: number | null
  odometerEndKm?: number | null
}

export type DddCardIncident = {
  fromUtc: number
  toUtc: number | null
  registration: string | null
  typeLabel: string
}

export type DddParsedCard = {
  cardNumber: string
  firstName: string
  surname: string
  dateOfBirth?: string
  issuingCountry?: string
  issuingAuthority?: string
  validityBegin?: string
  dateOfExpiry?: string
  drivingLicenseNumber?: string
  /** Nejpozdější vehicle_last_use. Není to záznam fyzického vyjmutí. */
  lastWithdrawalUtc: number | null
  activities: DddParsedActivity[]
  locations: DddParsedLocation[]
  generation?: 'GEN1' | 'GEN2' | 'GEN2 v2'
  printDays?: Record<string, { presence?: number; distance?: number }>
  printLastControl?: { atUtc: number; cardNumber: string }
  vehicleUses?: DddVehicleUse[]
  events?: DddCardIncident[]
  faults?: DddCardIncident[]
  loadUnloadEntries?: Array<{ atUtc: number; kind: 'load' | 'unload' | 'both'; odometerKm: number | null; location: string | null }>
  specificConditions?: Array<{ kind: string; atUtc: number }>
}

export function mapDddParserJson(parserJson: unknown): DddParsedCard
