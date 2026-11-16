export type DddParsedActivity = {
  kind: 'driving' | 'work' | 'availability' | 'rest' | 'unknown'
  startUtc: number
  endUtc: number
  isManualEntry?: boolean
  isCrew?: boolean
  slot?: 1 | 2
}

export type DddParsedLocation = {
  recordedAtUtc: number
  recordType?: 'start_country' | 'end_country' | string
  countryCode?: string
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
  specificConditions?: Array<{ kind: string; atUtc: number }>
}

export function mapDddParserJson(parserJson: unknown): DddParsedCard
