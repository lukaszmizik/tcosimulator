/**
 * Značky zemí na tachografu a výtisku (countries.txt).
 * Soubor karty a trasa simulátoru nesou kódy ISO. Graf je má kreslit jako tachograf.
 * Kódy, které se shodují (CZ, SK, PL, …), tu nejsou a zůstanou beze změny.
 */
const ISO_TO_TACHOGRAPH: Record<string, string> = {
  AD: 'AND',
  AM: 'ARM',
  AT: 'A',
  BA: 'BIH',
  BE: 'B',
  DE: 'D',
  EE: 'EST',
  ES: 'E',
  FI: 'FIN',
  FO: 'FR/FO',
  FR: 'F',
  GB: 'UK',
  HU: 'H',
  IE: 'IRL',
  IT: 'I',
  LI: 'FL',
  LU: 'L',
  ME: 'MNE',
  MT: 'M',
  NO: 'N',
  PT: 'P',
  RS: 'SRB',
  RU: 'RUS',
  SE: 'S',
  SI: 'SLO',
  SM: 'RSM',
  VA: 'V',
}

export function tachographCountryCode(code: string): string {
  const key = code.trim().toUpperCase()
  return ISO_TO_TACHOGRAPH[key] ?? code.trim()
}

/** Popisek místa: „AT · souřadnice“ nebo přechod „DE → FR“. Ostatní text nemění. */
export function tachographCountryLabel(text: string): string {
  const trimmed = text.trim()
  if (/^[A-Za-z]{2}$/.test(trimmed)) return tachographCountryCode(trimmed)
  if (!trimmed.includes('→') && !trimmed.includes('·')) return text
  return text.replace(/\b[A-Z]{2}\b/g, (token) => ISO_TO_TACHOGRAPH[token] ?? token)
}

type CountryFields = {
  countryCode?: string
  gpsLocation?: string
  label?: string
  registrationNation?: string
  issuingCountry?: string
  nationality?: string
  licenceIssuingCountry?: string
  activities?: CountryFields[]
  locations?: CountryFields[]
  vehicleUses?: CountryFields[]
  days?: Array<{ activities?: CountryFields[] }>
  countryMarkers?: CountryFields[]
  manualEntryBuffer?: CountryFields[]
  recordedGpsLocations?: CountryFields[]
}

function mapCode(code: string): string {
  return tachographCountryCode(code)
}

function mapEntry<T extends CountryFields>(entry: T): T {
  const next: T = { ...entry }
  if (entry.countryCode != null && entry.countryCode !== '') next.countryCode = mapCode(entry.countryCode)
  if (entry.registrationNation != null && entry.registrationNation !== '') next.registrationNation = mapCode(entry.registrationNation)
  if (entry.issuingCountry != null && entry.issuingCountry !== '') next.issuingCountry = mapCode(entry.issuingCountry)
  if (entry.nationality != null && entry.nationality !== '') next.nationality = mapCode(entry.nationality)
  if (entry.licenceIssuingCountry != null && entry.licenceIssuingCountry !== '') next.licenceIssuingCountry = mapCode(entry.licenceIssuingCountry)
  if (entry.gpsLocation != null) next.gpsLocation = tachographCountryLabel(entry.gpsLocation)
  if (entry.label != null) next.label = tachographCountryLabel(entry.label)
  return next
}

/** Značky, tabulka míst a údaje karty v okně grafu. */
export function withTachographCountryCodes<T>(value: T): T {
  const source = value as T & CountryFields
  const mapped = mapEntry(source)
  return {
    ...mapped,
    activities: source.activities?.map((entry) => mapEntry(entry)),
    locations: source.locations?.map((entry) => mapEntry(entry)),
    vehicleUses: source.vehicleUses?.map((entry) => mapEntry(entry)),
    days: source.days?.map((day) => ({
      ...day,
      activities: day.activities?.map((entry) => mapEntry(entry)),
    })),
    countryMarkers: source.countryMarkers?.map((entry) => mapEntry(entry)),
    manualEntryBuffer: source.manualEntryBuffer?.map((entry) => mapEntry(entry)),
    recordedGpsLocations: source.recordedGpsLocations?.map((entry) => mapEntry(entry)),
  } as T
}
