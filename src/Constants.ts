/**
 * Konstanty pro simulátor tachografu
 */

import type { CountryEntry } from './data/countriesLoader'

export const CARD_EJECT_HOLD_MS = 2000
/** Po 30 s nečinnosti na obrazovce čekající na vstup se zobrazí výzva. */
export const IDLE_WARNING_MS = 30 * 1000
/** Po 10 min nečinnosti se průvodce přeruší a karta se vysune. */
export const IDLE_CRITICAL_MS = 10 * 60 * 1000
export const FIRST_INSERTION_OFFSET_MS = (3 * 24 + 6) * 3600 * 1000 + 8 * 60 * 1000
export const MULTI_MANNING_ONE_HOUR_MS = 60 * 60 * 1000

export const FALLBACK_COUNTRY_LIST: CountryEntry[] = [
  { code: 'CZ', name: 'Česká republika' },
  { code: 'D', name: 'Německo' },
  { code: 'A', name: 'Rakousko' },
  { code: 'SK', name: 'Slovensko' },
  { code: 'PL', name: 'Polsko' },
]

export const ODOMETER_KM = 220234
export const SIM_DT_MS = 100
/** Rychlost pod tímto prahem (km/h) = vozidlo v klidu – pro rozhodnutí isDriving v aktivitách (L1 vpravo, REST) */
export const SPEED_STOPPED_THRESHOLD_KMH = 0.5
export const ACCEL_KMH_PER_SEC = 12
export const DRIVING_LIMIT_415_MS = 4 * 3600000 + 15 * 60000
export const DRIVING_LIMIT_430_MS = 4 * 3600000 + 30 * 60000
export const REST_RESET_MS = 45 * 60000

export const INITIAL_ACTIVITY_DURATIONS = {
  driving: 0,
  rest: 0,
  otherWork: 0,
  availability: 0,
} as const

/**
 * Globální nastavení výtisků – stejný formát, typ a velikost fontu pro všechny výtisky (v-diagram, 24h řidič/vozidlo, události, aktivity atd.).
 * Měnit pouze zde; v index.css musí být --print-font-size a --print-font-family v souladu s těmito hodnotami.
 */
export const PRINT_FONT = '"Doto", "Courier New", "Lucida Console", monospace'
/** Font pro zobrazení symbolů tachografu (např. (18)) */
export const PRINT_SYMBOL_FONT = 'SymbolTacho1'
/** Jednotná velikost fontu všech výtisků – číselná hodnota pro výpočty */
export const PRINT_FONT_SIZE = 12
/** Jednotná velikost fontu všech výtisků – px pro SVG a inline styly */
export const PRINT_FONT_SIZE_PX = '12px'
/** Výška řádku ve výtiscích – odvozeno od PRINT_FONT_SIZE pro jednotný formát */
export const PRINT_LINE_HEIGHT = 18
