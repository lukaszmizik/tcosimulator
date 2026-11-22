/**
 * Internacionalizace – překlady pro simulátor tachografu.
 * Jeden soubor na jazyk: cs.ts, en.ts, ru.ts
 */

import { createContext, useContext, useState, useCallback, createElement, type ReactNode } from 'react'
import type { DeviceLanguage, SupportedLanguage, Translations } from './types'
import { cs } from './cs'
import { en } from './en'
import { ru } from './ru'
import { mn } from './mn'

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  cs,
  en,
  ru,
  mn,
}

type LanguageContextValue = {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: Translations
  /** Platí jen při vnějším jazyku mn. U CZ/EN/RU se displej řídí jazykem rozhraní. */
  deviceLanguage: DeviceLanguage
  setDeviceLanguage: (lang: DeviceLanguage) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider(props: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('cs')
  const [deviceLanguage, setDeviceLanguageState] = useState<DeviceLanguage>('en')
  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang)
    setDeviceLanguageState(lang === 'mn' ? 'en' : lang)
  }, [])
  const setDeviceLanguage = useCallback((lang: DeviceLanguage) => {
    setDeviceLanguageState(lang)
  }, [])
  const t = TRANSLATIONS[language]
  return createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage, t, deviceLanguage, setDeviceLanguage } },
    props.children
  )
}

/** Texty displeje, menu a průvodce. Při mongolském rozhraní zůstává přístroj v CS/EN/RU. */
export function useDeviceLanguage(): { language: DeviceLanguage; t: Translations } {
  const { language, deviceLanguage } = useLanguage()
  const lcd = language === 'mn' ? deviceLanguage : language
  return { language: lcd, t: TRANSLATIONS[lcd] }
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
