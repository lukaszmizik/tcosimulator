/**
 * Kontext pro logování akcí při stisknutí tlačítek – pro testování a ověření chování simulátoru.
 */

import { createContext, useContext, useCallback, useState } from 'react'

export type LogEntry = {
  id: string
  timestamp: number
  action: string
  confirmed: boolean // true = uživatel zaškrtl jako správné chování
}

type ActionLogContextValue = {
  entries: LogEntry[]
  addEntry: (action: string, savedDetail?: string) => void
  setEntryConfirmed: (id: string, confirmed: boolean) => void
  clearEntries: () => void
}

const ActionLogContext = createContext<ActionLogContextValue | null>(null)

export function ActionLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<LogEntry[]>([])

  const addEntry = useCallback((action: string, savedDetail?: string) => {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const fullAction = savedDetail ? `${action} | uloženo: ${savedDetail}` : action
    setEntries((prev) => [
      ...prev,
      {
        id,
        timestamp: Date.now(),
        action: fullAction,
        confirmed: false,
      },
    ])
  }, [])

  const setEntryConfirmed = useCallback((id: string, confirmed: boolean) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, confirmed } : e))
    )
  }, [])

  const clearEntries = useCallback(() => {
    setEntries([])
  }, [])

  return (
    <ActionLogContext.Provider
      value={{ entries, addEntry, setEntryConfirmed, clearEntries }}
    >
      {children}
    </ActionLogContext.Provider>
  )
}

export function useActionLog() {
  const ctx = useContext(ActionLogContext)
  if (!ctx) {
    return {
      addEntry: (_action: string, _savedDetail?: string) => {},
      setEntryConfirmed: () => {},
      clearEntries: () => {},
      entries: [] as LogEntry[],
    }
  }
  return ctx
}
