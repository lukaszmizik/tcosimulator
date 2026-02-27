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
}

/** Kódy výstrah podobné „doba řízení 4h15m“ – varování pracovní doby (pauza) */
export const BREAK_WARNING_IDS: WarningId[] = ['415', '430']

/** Zda je kód platná výstraha */
export function isWarningCode(code: string): code is WarningId {
  return code in WARNINGS
}

/** Vrátí definici výstrahy podle kódu */
export function getWarning(code: string): WarningDef | null {
  if (!isWarningCode(code)) return null
  return WARNINGS[code]
}
