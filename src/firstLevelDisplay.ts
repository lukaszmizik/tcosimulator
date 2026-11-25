import { CARD1_STORED_DATA, CARD2_STORED_DATA } from './data/card_stored_data'
import { discardPersistedVehicleCardInsertions } from './print/vehicleCardInsertions'
import type { DeviceLanguage } from './translations/types'

export const UTC_PAGE = 2
export const LANGUAGE_PAGE = 3
export const MAIN_MENU_PAGE = 4
export const languages: DeviceLanguage[] = ['cs', 'en', 'ru']

export function utcRows(utcMs: number, local: Date) {
  const iso = new Date(utcMs).toISOString()
  const date = iso.slice(0, 10).split('-').reverse().join('.')
  const minutes = Math.round((local.getTime() - utcMs) / 60000) - local.getTimezoneOffset()
  const pad = (value: number) => String(value).padStart(2, '0')
  const offset = pad(Math.floor(Math.abs(minutes) / 60)) + 'h' + pad(Math.abs(minutes) % 60)
  return ['UTC(17) ' + date, iso.slice(11, 16) + '    ' + (minutes < 0 ? '-' : '+') + offset]
}

export const CARD_LANGUAGE_STORAGE_KEY = 'dtco.cardLanguages'

const virtualTemplateByKey = new Map<string, 'zmizik' | 'novak'>([
  ['zmizik', 'zmizik'],
  ['novak', 'novak'],
  [CARD1_STORED_DATA.cardNumber, 'zmizik'],
  [CARD2_STORED_DATA.cardNumber, 'novak'],
])

type Preference = { card: 'zmizik' | 'novak'; language: DeviceLanguage }

/** Jazyk skutečné karty platí jen v otevřené lekci, i po vysunutí a novém vložení. */
const sessionLanguages = new Map<string, DeviceLanguage>()

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isLanguage(value: unknown): value is DeviceLanguage {
  return languages.includes(value as DeviceLanguage)
}

function readPreferences(storage: Pick<Storage, 'getItem'> | null): Preference[] {
  if (!storage) return []
  try {
    const data = JSON.parse(storage.getItem(CARD_LANGUAGE_STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(data)) return []
    const direct = new Map<'zmizik' | 'novak', DeviceLanguage>()
    const remapped = new Map<'zmizik' | 'novak', DeviceLanguage>()
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const card = (item as { card?: unknown }).card
      const language = (item as { language?: unknown }).language
      if (typeof card !== 'string' || !isLanguage(language)) continue
      if (card === 'zmizik' || card === 'novak') {
        if (!direct.has(card)) direct.set(card, language)
        continue
      }
      const template = virtualTemplateByKey.get(card)
      if (!template || remapped.has(template)) continue
      remapped.set(template, language)
    }
    for (const [card, language] of remapped) {
      if (!direct.has(card)) direct.set(card, language)
    }
    return [...direct].map(([card, language]) => ({ card, language }))
  } catch {
    return []
  }
}

function writePreferences(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, entries: readonly Preference[]) {
  if (!storage) return
  try {
    if (entries.length === 0) storage.removeItem(CARD_LANGUAGE_STORAGE_KEY)
    else storage.setItem(CARD_LANGUAGE_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* Storage unavailable. */
  }
}

/** Ponechá jen jazyk virtuálních šablon. Číslo ani jméno karty v trvalém úložišti nezůstane. */
export function migratePersistedCardLanguages(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
  if (!storage) return
  const raw = storage.getItem(CARD_LANGUAGE_STORAGE_KEY)
  if (raw == null) return
  writePreferences(storage, readPreferences(storage))
}

/** Smaže trvalou evidenci vložení a identifikační jazyky. Ostatní klíče nechá. */
export function discardPersistedLessonIdentity(storage: Storage | null) {
  discardPersistedVehicleCardInsertions(storage)
  migratePersistedCardLanguages(storage)
}

export function clearSessionCardLanguages() {
  sessionLanguages.clear()
}

export function recalledLanguage(card: string, storage: Storage | null = browserStorage()) {
  const session = sessionLanguages.get(card)
  if (session) return session
  const template = virtualTemplateByKey.get(card)
  if (!template) return undefined
  return readPreferences(storage).find((entry) => entry.card === template)?.language
}

export function rememberLanguage(
  card: string,
  language: DeviceLanguage,
  storage: Storage | null = browserStorage(),
) {
  sessionLanguages.set(card, language)
  const template = virtualTemplateByKey.get(card)
  if (!template) return
  const entries = readPreferences(storage).filter((entry) => entry.card !== template)
  writePreferences(storage, [...entries, { card: template, language }])
}
