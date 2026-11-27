/**
 * Virtuální karta: stávající převod dat, vykreslení stejnou komponentou jako Cardviewer.
 * Časy značek jsou v UTC. Graf je dostane jako časový okamžik, aby místní i UTC pohled seděly.
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { segmentToMsUtc } from './CardLogic'
import type { CountryMarker, DayData, ParsedActivity } from './workWeekTxtParser'
import type {
  FaultOrEvent,
  FerryTrainEvent,
  ManualEntrySegment,
  OutModeEvent,
  RecordedGpsLocation,
  SymbolMap,
  VehicleLoadUnloadEvent,
} from './TachoTypes'
import { useLanguage } from './translations'
import { LanguageProvider as ViewerLanguageProvider } from 'tacho-viewer-language'
import { WorkWeekGraphView } from 'tacho-viewer-graph'
import { activitiesByDay, type GraphActivity, type GraphDay } from 'tacho-viewer-graph-days'
import '../vendor/cardviewer/src/index.css'

export type CardGraphSlot = {
  days: DayData[]
  countryMarkers: CountryMarker[]
  manualEntryBuffer?: ManualEntrySegment[]
  lastWithdrawalUtc?: number | null
}

type ClockMode = 'local' | 'utc'

function markerAtUtc(marker: CountryMarker & { recordedAtUtc?: number }): number {
  if (marker.recordedAtUtc != null) return marker.recordedAtUtc
  const [hour, minute] = marker.timeStr.split(':').map(Number)
  const [day, month, year] = marker.dateStr.split('.').map(Number)
  return Date.UTC(year, (month ?? 1) - 1, day, hour || 0, minute || 0)
}

function stampMarkers(markers: CountryMarker[]) {
  return markers.map((marker) => ({ ...marker, recordedAtUtc: markerAtUtc(marker) }))
}

function stampManual(segments: ManualEntrySegment[] | undefined) {
  return (segments ?? []).map((segment) => ({
    ...segment,
    recordedAtUtc: segmentToMsUtc(segment),
  }))
}

function hasActivity(slot: CardGraphSlot | undefined): boolean {
  return !!slot?.days.some((day) => day.activities.length > 0)
}

function mergedActivities(days: DayData[]): GraphActivity[] {
  const pieces = days
    .flatMap((day) => day.activities)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const merged: GraphActivity[] = []
  for (const act of pieces) {
    const last = merged[merged.length - 1]
    if (
      last &&
      last.endMs === act.startMs &&
      last.type === act.type &&
      last.isManualEntry === act.isManualEntry
    ) {
      last.endMs = act.endMs
      last.durationMinutes = Math.round((act.endMs - last.startMs) / 60000)
    } else {
      merged.push(toGraphActivity(act))
    }
  }
  return merged
}

function toGraphActivity(act: ParsedActivity): GraphActivity {
  return {
    startMs: act.startMs,
    endMs: act.endMs,
    type: act.type,
    durationMinutes: act.durationMinutes,
    originalDurationMinutes: act.originalDurationMinutes,
    isManualEntry: act.isManualEntry,
    gpsLocation: act.gpsLocation,
  }
}

function daysForClock(slot: CardGraphSlot, clockMode: ClockMode): GraphDay[] | DayData[] {
  if (clockMode === 'local') return slot.days
  return activitiesByDay(mergedActivities(slot.days), { useLocalTime: false })
}

function presentSlot(slot: CardGraphSlot, clockMode: ClockMode) {
  return {
    days: daysForClock(slot, clockMode),
    countryMarkers: stampMarkers(slot.countryMarkers),
    manualEntryBuffer: stampManual(slot.manualEntryBuffer),
    lastWithdrawalUtc: slot.lastWithdrawalUtc,
  }
}

export function SimulatorCardGraph({
  data,
  loadUnloadEvents = [],
  ferryTrainEvents = [],
  outModeEvents = [],
  recordedGpsLocations = [],
  faultsAndEvents = [],
  symbolMap,
  onResetLoadUnload,
  onClose,
  initialFocusedDayUtc = null,
  headingNote,
}: {
  data: CardGraphSlot & { card2Data?: CardGraphSlot }
  loadUnloadEvents?: VehicleLoadUnloadEvent[]
  ferryTrainEvents?: FerryTrainEvent[]
  outModeEvents?: OutModeEvent[]
  recordedGpsLocations?: RecordedGpsLocation[]
  faultsAndEvents?: FaultOrEvent[]
  symbolMap?: SymbolMap | null
  onResetLoadUnload?: () => void
  onClose: () => void
  initialFocusedDayUtc?: number | null
  headingNote?: string
}) {
  const { language, t } = useLanguage()
  const [clockMode, setClockMode] = useState<ClockMode>('local')
  const graphLanguage = language === 'ru' ? 'ru' : 'cs'
  const view = useMemo(() => {
    const secondary = data.card2Data
    const primaryHas = hasActivity(data)
    const secondaryHas = hasActivity(secondary)
    if (!primaryHas && secondary && secondaryHas) {
      return {
        primary: presentSlot(secondary, clockMode),
        secondary: undefined,
        heading: headingNote ?? t.cardPanel.slot.replace('{slot}', '2'),
      }
    }
    return {
      primary: presentSlot(data, clockMode),
      secondary: secondary && secondaryHas ? presentSlot(secondary, clockMode) : undefined,
      heading: headingNote,
    }
  }, [clockMode, data, headingNote, t.cardPanel.slot])

  return createPortal(
    <ViewerLanguageProvider language={graphLanguage}>
      <WorkWeekGraphView
        days={view.primary.days}
        countryMarkers={view.primary.countryMarkers}
        manualEntryBuffer={view.primary.manualEntryBuffer}
        lastWithdrawalUtc={view.primary.lastWithdrawalUtc}
        card2Data={view.secondary}
        loadUnloadEvents={loadUnloadEvents}
        ferryTrainEvents={ferryTrainEvents}
        outModeEvents={outModeEvents}
        recordedGpsLocations={recordedGpsLocations}
        faultsAndEvents={faultsAndEvents}
        symbolMap={symbolMap}
        onResetLoadUnload={onResetLoadUnload}
        onClose={onClose}
        clockMode={clockMode}
        onClockModeChange={setClockMode}
        initialFocusedDayUtc={initialFocusedDayUtc}
        headingNote={view.heading}
      />
    </ViewerLanguageProvider>,
    document.body,
  )
}
