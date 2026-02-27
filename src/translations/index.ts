/**
 * Internacionalizace – překlady pro simulátor tachografu.
 * Jeden soubor na jazyk: cs.ts, en.ts, ru.ts
 */

import { createContext, useContext, useState, useCallback, createElement, type ReactNode } from 'react'
import type { SupportedLanguage, Translations } from './types'
import { cs } from './cs'
import { en } from './en'
import { ru } from './ru'

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  cs,
  en,
  ru,
}

type LanguageContextValue = {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider(props: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('cs')
  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang)
  }, [])
  const t = TRANSLATIONS[language]
  return createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage, t } },
    props.children
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

/** Pro použití mimo React (např. v getCardInsertionOkDetail) – vrací aktuální překlady */
export function getTranslations(lang: SupportedLanguage = 'cs'): Translations {
  return TRANSLATIONS[lang]
}
