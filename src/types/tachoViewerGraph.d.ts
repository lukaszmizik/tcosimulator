declare module 'tacho-viewer-graph' {
  import type { ReactNode } from 'react'

  export function WorkWeekGraphView(props: {
    days: unknown[]
    countryMarkers: unknown[]
    manualEntryBuffer?: unknown[]
    lastWithdrawalUtc?: number | null
    card2Data?: {
      days: unknown[]
      countryMarkers: unknown[]
      manualEntryBuffer?: unknown[]
      lastWithdrawalUtc?: number | null
    }
    loadUnloadEvents?: unknown[]
    ferryTrainEvents?: unknown[]
    outModeEvents?: Array<{ minuteStartUtc: number; type: 'activation' | 'deactivation'; gpsLocation?: string }>
    recordedGpsLocations?: unknown[]
    faultsAndEvents?: unknown[]
    symbolMap?: Record<number, string> | null
    onResetLoadUnload?: () => void
    embedded?: boolean
    onClose: () => void
    clockMode?: 'local' | 'utc'
    onClockModeChange?: (mode: 'local' | 'utc') => void
    card?: object | null
    initialFocusedDayUtc?: number | null
    initialWeekStartMs?: number | null
    onDisplayedWeekChange?: (weekStartMs: number) => void
    showWeeklyRestPanel?: boolean
    showDailyDistance?: boolean
    showShiftToggle?: boolean
    headingNote?: string
  }): ReactNode
}

declare module 'tacho-viewer-card-graph' {
  export function cardToGraph(card: object, clockMode?: 'local' | 'utc'): {
    days: unknown[]
    countryMarkers: unknown[]
    manualEntryBuffer: unknown[]
    lastWithdrawalUtc: number | null
    loadUnloadEvents: unknown[]
    ferryTrainEvents: unknown[]
    outModeEvents: Array<{ minuteStartUtc: number; type: 'activation' | 'deactivation'; gpsLocation?: string }>
    recordedGpsLocations: unknown[]
    faultsAndEvents: unknown[]
  }
}

declare module 'tacho-viewer-graph-days' {
  export type GraphActivity = {
    startMs: number
    endMs: number
    type?: string
    durationMinutes?: number
    originalDurationMinutes?: number
    slot?: 1 | 2
    isManualEntry?: boolean
    isCrew?: boolean
    registration?: string
    gpsLocation?: string
  }

  export type GraphDay = { dateUtc: number; activities: GraphActivity[] }

  export function activitiesByDay(activities: GraphActivity[], options?: { useLocalTime?: boolean }): GraphDay[]
}

declare module 'tacho-viewer-language' {
  import type { ReactNode } from 'react'

  export function LanguageProvider(props: { children: ReactNode; language?: 'cs' | 'ru' }): ReactNode
}

declare module 'tacho-viewer-slot-graph' {
  import type { GraphDay } from 'tacho-viewer-graph-days'
  export type SimulatorGraphKind = 'driving' | 'work' | 'availability' | 'rest' | 'unknown'

  export type SimulatorSlotGraphInput = {
    activities: Array<{
      kind: SimulatorGraphKind
      startUtc: number
      endUtc: number
      isManualEntry?: boolean
      isCrew?: boolean
      slot?: 1 | 2
    }>
    manualSegments: Array<{
      activityId: 'REST' | 'WORK' | 'AVAILABILITY' | 'DRIVING' | 'UNKNOWN' | 'START_COUNTRY' | 'END_COUNTRY'
      day: number
      month: number
      year: number
      hour: number
      minute: number
      countryCode?: string
      isManualEntry?: boolean
    }>
    simulatedMinutes: Array<{ minuteStartUtc: number; kind: SimulatorGraphKind }>
    locations: Array<{ recordedAtUtc: number; recordType?: string; countryCode?: string }>
    currentSlot: 1 | 2
  }

  export function buildSimulatorSlotGraph(input: SimulatorSlotGraphInput): {
    days: GraphDay[]
    countryMarkers: unknown[]
    manualEntryBuffer: unknown[]
  }

  export function utcWeekStart(ms: number): number
}
