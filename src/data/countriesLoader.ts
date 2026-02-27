/**
 * Načtení a parsování countries.txt.
 * Soubor musí být v public/countries.txt (fetch z kořene).
 */

export type CountryEntry = { code: string; name: string }

const FALLBACK_COUNTRIES: CountryEntry[] = [
  { code: 'CZ', name: 'Česká republika' },
  { code: 'D', name: 'Německo' },
  { code: 'A', name: 'Rakousko' },
  { code: 'SK', name: 'Slovensko' },
  { code: 'PL', name: 'Polsko' },
]

export type CountriesData = {
  countries: CountryEntry[]
  spanishRegions: CountryEntry[]
}

function parseCountriesFile(text: string): CountriesData {
  const lines = text.split(/\r?\n/)
  const countries: CountryEntry[] = []
  const spanishRegions: CountryEntry[] = []
  let section: 'countries' | 'regions' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue
    if (line === 'countries:') {
      section = 'countries'
      continue
    }
    if (line === 'regions:') {
      section = 'regions'
      continue
    }
    const spaceIdx = line.indexOf(' ')
    if (spaceIdx === -1) continue
    const code = line.slice(0, spaceIdx).trim()
    const name = line.slice(spaceIdx + 1).trim()
    if (!code) continue
    if (section === 'countries') {
      countries.push({ code, name })
    } else if (section === 'regions') {
      spanishRegions.push({ code, name })
    }
  }

  return { countries: countries.length ? countries : FALLBACK_COUNTRIES, spanishRegions }
}

/**
 * Asynchronně načte countries.txt (fetch).
 * Při chybě vrátí fallback: CZ, D, A, SK, PL.
 */
export async function loadCountries(): Promise<CountriesData> {
  try {
    const res = await fetch('/countries.txt')
    if (!res.ok) return { countries: FALLBACK_COUNTRIES, spanishRegions: [] }
    const text = await res.text()
    return parseCountriesFile(text)
  } catch {
    return { countries: FALLBACK_COUNTRIES, spanishRegions: [] }
  }
}
