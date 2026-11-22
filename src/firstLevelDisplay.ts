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

const storageKey = 'dtco.cardLanguages'
type Preference = { card: string; language: DeviceLanguage }
function preferences(): Preference[] {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(data) ? data.filter(p => p && typeof p.card === 'string' && languages.includes(p.language)) : []
  } catch { return [] }
}
export function recalledLanguage(card: string) {
  return preferences().find(p => p.card === card)?.language
}
export function rememberLanguage(card: string, language: DeviceLanguage) {
  const entries = preferences().filter(p => p.card !== card)
  try { localStorage.setItem(storageKey, JSON.stringify([...entries, { card, language }].slice(-5))) } catch { /* Storage unavailable. */ }
}
