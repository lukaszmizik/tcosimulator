import type { SupportedLanguage } from '../translations/types'

/**
 * Centralizovaný registr výstrah tachografu.
 * Výstrahy jsou označeny kódem. Pro vyvolání: zobraz výstrahu "XX"
 */

export type WarningId =
  | '28'   // jízda bez vložené karty
  | '29'   // jízda bez platné karty
  | '415'  // doba řízení 4h15m - pauza!
  | '430'  // doba řízení 4h30m - pauza!
  | '30'   // karta! (zapalování, karta nevložena)
  | '31'   // 10h prodloužená směna nedostupná
  | 'work' // nepřerušená pracovní doba, čas na L2 je dynamický

export interface WarningDef {
  id: WarningId
  /** Text řádku L1 na displeji */
  line1: string
  /** Text řádku L2 na displeji (volitelné – u jednoduchých výstrah pouze L1) */
  line2?: string
  /** Pro výstrahy s dynamickým obsahem (415/430) – šablona L2 s placeholderem pro dobu */
  line2Template?: string
}

/**
 * Definice všech výstrah s kódy.
 * Pro zobrazení výstrahy volejte: zobrazVystrahu("XX")
 */
export const WARNINGS: Record<WarningId, WarningDef> = {
  '28': {
    id: '28',
    line1: '(27)(2)(14)\u00A0jízda bez',
    line2: 'vložené karty 28',
  },
  '29': {
    id: '29',
    line1: '(27)(2)(14)\u00A0jízda bez',
    line2: 'platné karty 29',
  },
  '415': {
    id: '415',
    line1: '(35)(2)(12)\u00A0pauza!',
    line2: '(12)(2)04h15m\u00A0(10)00h15',
  },
  '430': {
    id: '430',
    line1: '(35)(2)(12)\u00A0pauza!',
    line2: '(12)(2)04h30m\u00A0(10)00h15',
  },
  '30': {
    id: '30',
    line1: '(14) karta!',
    line2: undefined,
  },
  '31': {
    id: '31',
    line1: '10h prodloužená směna',
    line2: 'nedostupná 31',
  },
  'work': {
    id: 'work',
    line1: '(35)(9){slot} doba práce',
  },
}

/** Kódy výstrah podobné „doba řízení 4h15m“ – varování pracovní doby (pauza) */
export const BREAK_WARNING_IDS: WarningId[] = ['415', '430']

/** Zda je kód platná výstraha */
export function isWarningCode(code: string): code is WarningId {
  return Object.prototype.hasOwnProperty.call(WARNINGS, code)
}

const warningTranslations: Record<Exclude<SupportedLanguage, 'cs'>, Record<WarningId, Pick<WarningDef, 'line1' | 'line2'>>> = {
  en: {
    '28': { line1: '(27)(2)(14)\u00A0driving', line2: 'without card 28' },
    '29': { line1: '(27)(2)(14)\u00A0driving', line2: 'without card 29' },
    '415': { line1: '(35)(2)(12)\u00A0break!', line2: '(12)(2)04h15\u00A0(10)00h15' },
    '430': { line1: '(35)(2)(12)\u00A0break!', line2: '(12)(2)04h30\u00A0(10)00h15' },
    '30': { line1: '(14) card!' },
    '31': { line1: '10h extension', line2: 'unavailable 31' },
    'work': { line1: '(35)(9){slot} work time' },
  },
  ru: {
    '28': { line1: '(27)(2)(14)\u00A0Движение без', line2: 'карты 28' },
    '29': { line1: '(27)(2)(14)\u00A0Движение без', line2: 'карты 29' },
    '415': { line1: '(35)(2)(12)\u00A0Перерыв!', line2: '(12)(2)04h15\u00A0(10)00h15' },
    '430': { line1: '(35)(2)(12)\u00A0Перерыв!', line2: '(12)(2)04h30\u00A0(10)00h15' },
    '30': { line1: '(14) карта!' },
    '31': { line1: 'Продление до 10h', line2: 'недоступно 31' },
    'work': { line1: '(35)(9){slot} раб. время' },
  },
}

function formatHm(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`
}

/** Hlášení nepřerušené práce. Druhý řádek je skutečný souvislý čas, ne pevných 04h15 z manuálu. */
export function formatWorkWarning(
  language: SupportedLanguage,
  slot: 1 | 2,
  continuousMs: number,
): { line1: string; line2: string } {
  const warning = getWarning('work', language)!
  return {
    line1: warning.line1.replace('{slot}', String(slot)),
    line2: `(9) ${formatHm(continuousMs)}`,
  }
}

export function getWarning(code: string, language: SupportedLanguage = 'cs'): WarningDef | null {
  if (!isWarningCode(code)) return null
  const warning = WARNINGS[code]
  return language === 'cs' ? warning : { ...warning, ...warningTranslations[language][code] }
}
