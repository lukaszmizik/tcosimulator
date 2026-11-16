import { useEffect, useMemo, useState } from 'react'
import { segmentToMsUtc } from './CardLogic'
import type { ActivityKind, OutModeEvent } from './TachoTypes'
import type { DddCardRecord } from './dddCardSession'
import { LanguageProvider as ViewerLanguageProvider } from 'tacho-viewer-language'
import { useLanguage } from './translations'
import { WorkWeekGraphView } from 'tacho-viewer-graph'
import { activitiesByDay } from 'tacho-viewer-graph-days'
import {
  buildSimulatorSlotGraph,
  utcWeekStart,
  type SimulatorGraphKind,
  type SimulatorSlotGraphInput,
} from 'tacho-viewer-slot-graph'
import '../vendor/cardviewer/src/index.css'
import './insertedCardGraphs.css'

const WEEK_MS = 7 * 24 * 3600 * 1000
const NO_OUT_EVENTS: OutModeEvent[] = []

function displayedWeekStart(utcMonday: number, mode: 'local' | 'utc'): number {
  if (mode === 'utc') return utcMonday
  const day = new Date(utcMonday)
  return new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()).getTime()
}

function simulatedKind(kind: ActivityKind): SimulatorGraphKind | null {
  if (kind === 'none') return null
  if (kind === 'otherWork') return 'work'
  return kind
}

function graphInput(record: DddCardRecord, currentSlot: 1 | 2): SimulatorSlotGraphInput {
  const simulated: SimulatorSlotGraphInput['activities'] = []
  for (const entry of [...record.workingActivities].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)) {
    const slot = entry.driver1CardId === record.cardNumber
      ? 1
      : entry.driver2CardId === record.cardNumber ? 2 : currentSlot
    const kind = simulatedKind(slot === 1 ? entry.driver1 : entry.driver2)
    if (!kind) continue
    const last = simulated[simulated.length - 1]
    if (last?.kind === kind && last.slot === slot && last.isCrew === entry.isCrew && last.endUtc === entry.minuteStartUtc) {
      last.endUtc += 60000
    } else {
      simulated.push({ kind, startUtc: entry.minuteStartUtc, endUtc: entry.minuteStartUtc + 60000, slot, isCrew: entry.isCrew })
    }
  }
  return {
    currentSlot,
    activities: [...record.original.activities, ...simulated],
    manualSegments: record.workingManual.map((segment) => ({
      activityId: segment.activityId,
      day: segment.day,
      month: segment.month,
      year: segment.year,
      hour: segment.hour,
      minute: segment.minute,
      countryCode: segment.countryCode,
      isManualEntry: segment.isManualEntry,
    })),
    simulatedMinutes: [],
    locations: record.original.locations.map((location) => ({
      recordedAtUtc: location.recordedAtUtc,
      recordType: location.recordType,
      countryCode: location.countryCode,
    })),
  }
}

function latestManualActivityUtc(record: DddCardRecord | null): number | null {
  let latest: number | null = null
  for (let i = 0; record && i + 1 < record.workingManual.length; i++) {
    const start = record.workingManual[i]!
    const end = record.workingManual[i + 1]!
    if (start.activityId === 'START_COUNTRY' || start.activityId === 'END_COUNTRY' ||
        end.activityId === 'START_COUNTRY' || end.activityId === 'END_COUNTRY') continue
    const startMs = segmentToMsUtc(start)
    const endMs = segmentToMsUtc(end)
    if (startMs < endMs) latest = Math.max(latest ?? startMs, endMs - 1)
  }
  return latest
}

function buildCardGraph(record: DddCardRecord, slot: 1 | 2) {
  const input = graphInput(record, slot)
  const graph = buildSimulatorSlotGraph(input)
  const crewBlocks = new Set<string>()
  const key = (start: number, end: number, historicalSlot?: 1 | 2) => `${start}:${end}:${historicalSlot ?? ''}`
  for (const activity of input.activities) {
    if (!activity.isCrew) continue
    let start = activity.startUtc
    while (start < activity.endUtc) {
      const end = Math.min(activity.endUtc, (Math.floor(start / 86400000) + 1) * 86400000)
      crewBlocks.add(key(start, end, activity.slot))
      start = end
    }
  }
  for (const day of graph.days) {
    for (const activity of day.activities) {
      if (!activity.isManualEntry && crewBlocks.has(key(activity.startMs, activity.endMs, activity.slot))) {
        activity.isCrew = true
      }
    }
  }
  const outEvents: OutModeEvent[] = []
  for (const condition of record.original.specificConditions ?? []) {
    if (condition.kind !== 'out' && condition.kind !== 'out_end') continue
    outEvents.push({
      minuteStartUtc: condition.atUtc,
      type: condition.kind === 'out' ? 'activation' : 'deactivation',
    })
  }
  return { ...graph, outEvents }
}

function SlotGraph({
  record,
  slot,
  weekStart,
  clockMode,
  vehicleOutEvents,
  onWeekStartChange,
  onClockModeChange,
  headingNote,
}: {
  record: DddCardRecord | null
  slot: 1 | 2
  weekStart: number
  clockMode: 'local' | 'utc'
  vehicleOutEvents: OutModeEvent[]
  onWeekStartChange: (weekStartMs: number) => void
  onClockModeChange: (mode: 'local' | 'utc') => void
  headingNote: string
}) {
  const graph = useMemo(
    () => (record ? buildCardGraph(record, slot) : null),
    [record, slot],
  )
  const outModeEvents = useMemo(
    () => graph ? [...graph.outEvents, ...vehicleOutEvents] : NO_OUT_EVENTS,
    [graph, vehicleOutEvents],
  )
  const days = useMemo(() => {
    if (!graph) return []
    return clockMode === 'utc'
      ? graph.days
      : activitiesByDay(graph.days.flatMap((day) => day.activities), { useLocalTime: true })
  }, [graph, clockMode])
  return (
    <div data-slot-graph={slot} data-card-number={record?.cardNumber ?? ''}>
      <WorkWeekGraphView
        days={days}
        countryMarkers={graph?.countryMarkers ?? []}
        manualEntryBuffer={graph?.manualEntryBuffer ?? []}
        outModeEvents={outModeEvents}
        embedded
        clockMode={clockMode}
        onClockModeChange={onClockModeChange}
        initialWeekStartMs={weekStart}
        onDisplayedWeekChange={onWeekStartChange}
        showWeeklyRestPanel={false}
        showDailyDistance={false}
        showShiftToggle={false}
        headingNote={headingNote}
        onClose={() => {}}
      />
    </div>
  )
}

export function InsertedCardsHistory({
  slot1,
  slot2,
  vehicleOutEvents,
}: {
  slot1: DddCardRecord | null
  slot2: DddCardRecord | null
  vehicleOutEvents: OutModeEvent[]
}) {
  const { language } = useLanguage()
  const graphLanguage = language === 'ru' ? 'ru' : 'cs'
  const slotNote = graphLanguage === 'ru' ? 'слот' : 'šachta'
  const manual1 = latestManualActivityUtc(slot1)
  const manual2 = latestManualActivityUtc(slot2)
  const latestManual = manual1 == null ? manual2 : manual2 == null ? manual1 : Math.max(manual1, manual2)
  const weeks = useMemo(() => {
    const marks: Array<{ id: string; label: string; ms: number }> = []
    const add = (id: string, label: string, ms: number | null | undefined) => {
      if (ms == null) return
      marks.push({ id, label, ms: utcWeekStart(ms) })
    }
    add('slot1-driving', 'Týden řízení šachty 1', slot1?.originalPreview.firstDriving?.startMs)
    add('slot2-driving', 'Týden řízení šachty 2', slot2?.originalPreview.firstDriving?.startMs)
    add('slot1-manual', 'Týden ručního doplnění', manual1)
    add('slot2-manual', 'Týden ručního doplnění šachty 2', manual2)
    const slot2Activity = [...(slot1?.original.activities ?? []), ...(slot2?.original.activities ?? [])].find(
      (activity) => activity.slot === 2,
    )
    add('historical-slot2', 'Týden historické šachty 2', slot2Activity?.startUtc)
    const earliest = marks.reduce((min, mark) => Math.min(min, mark.ms), Number.POSITIVE_INFINITY)
    if (Number.isFinite(earliest)) {
      marks.push({ id: 'empty-week', label: 'Prázdný týden', ms: earliest - WEEK_MS })
    }
    return marks
  }, [slot1, slot2, manual1, manual2])

  const [chosenWeek, setChosenWeek] = useState<number | null>(null)
  const [clockMode, setClockMode] = useState<'local' | 'utc'>('utc')
  const manualWeek = latestManual == null ? null : utcWeekStart(latestManual)
  const selectedMonday = chosenWeek ?? manualWeek ?? weeks[0]?.ms ?? utcWeekStart(Date.now())
  const weekStart = displayedWeekStart(selectedMonday, clockMode)
  const onWeekStartChange = (ms: number) => {
    const day = new Date(ms)
    setChosenWeek(clockMode === 'utc' ? ms : Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()))
  }
  useEffect(() => {
    if (manualWeek != null) setChosenWeek(manualWeek)
  }, [slot1?.cardNumber, slot2?.cardNumber, latestManual, manualWeek])

  return (
    <ViewerLanguageProvider language={graphLanguage}>
      <section className="inserted-card-graphs" data-shared-week={weekStart} data-shared-clock={clockMode}>
        <div className="inserted-card-graphs-toolbar">
          <span>Společný týden</span>
          {weeks.map((week) => (
            <button
              key={week.id}
              type="button"
              className={week.ms === selectedMonday ? 'is-active' : undefined}
              data-show-week={week.id}
              data-week-ms={week.ms}
              onClick={() => setChosenWeek(week.ms)}
            >
              {week.label}
            </button>
          ))}
        </div>
        <SlotGraph
          key={`1:${slot1?.cardNumber ?? ''}:${manualWeek ?? ''}`}
          record={slot1}
          slot={1}
          weekStart={weekStart}
          clockMode={clockMode}
          vehicleOutEvents={vehicleOutEvents}
          onWeekStartChange={onWeekStartChange}
          onClockModeChange={setClockMode}
          headingNote={`${slotNote} 1`}
        />
        <SlotGraph
          key={`2:${slot2?.cardNumber ?? ''}:${manualWeek ?? ''}`}
          record={slot2}
          slot={2}
          weekStart={weekStart}
          clockMode={clockMode}
          vehicleOutEvents={vehicleOutEvents}
          onWeekStartChange={onWeekStartChange}
          onClockModeChange={setClockMode}
          headingNote={`${slotNote} 2`}
        />
      </section>
    </ViewerLanguageProvider>
  )
}
