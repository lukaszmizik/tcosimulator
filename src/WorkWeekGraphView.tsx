/**
 * Graf pracovního týdne – SVG zobrazení načtených dat z TXT.
 * Každý den = řádek, hodiny 0–24, aktivity jako barevné segmenty.
 */

import { useState, useEffect } from 'react'
import { useLanguage } from './translations'
import type { DayData, ParsedActivity, ActivityType, CountryMarker } from './workWeekTxtParser'
import { parseTimeAndDate, getWeekStartMsLocal, DAY_MS } from './workWeekTxtParser'
import type { ManualEntrySegment, VehicleLoadUnloadEvent, FerryTrainEvent, OutModeEvent, FaultOrEvent, RecordedGpsLocation } from './TachoTypes'
import type { SymbolMap } from './TachoTypes'
import { DRIVING_SYMBOL, segmentToMsUtc } from './CardLogic'

const DAYS_PER_WEEK = 7

const ROW_HEIGHT = 40
const LABEL_WIDTH = 126
const CHART_WIDTH = 540
const MARGIN_TOP = 25
const MARGIN_BOTTOM = 18
const TICK_LEN = 2
const HOUR_TICK_LEN = 4
const QUARTER_TICK_LEN = 3
const HOURS = 25
const QUARTERS_PER_DAY = 24 * 4

const LONG_REST_MIN = 24 * 60 + 1
const REGULAR_TDO_MIN = 45 * 60

const ACTIVITY_SYMBOL: Record<ActivityType, string> = {
  řízení: DRIVING_SYMBOL,
  práce: '\u005a',
  pohotovost: '\u0058',
  odpočinek: '\u0059',
  'odpočinek>24h': '\u0059',
  'odpočinek>45h': '\u0059',
  neznámá: '?',
}

const ACTIVITY_STYLE: Record<ActivityType, { color: string; strokeWidth: number }> = {
  řízení: { color: '#c41e3a', strokeWidth: 13 },
  práce: { color: '#c9a227', strokeWidth: 9 },
  pohotovost: { color: '#d4738a', strokeWidth: 5 },
  odpočinek: { color: '#2d7d3e', strokeWidth: 16 },
  'odpočinek>24h': { color: '#60a5fa', strokeWidth: 16 },
  'odpočinek>45h': { color: '#2563eb', strokeWidth: 16 },
  neznámá: { color: '#888', strokeWidth: 5 },
}

const TICK_COLOR = '#999'
const LABEL_COLOR = '#666'
const ANCHOR_COLOR = '#000'
const ANCHOR_STROKE = '#000'
function getActivityColor(act: ParsedActivity): string {
  const base = ACTIVITY_STYLE[act.type]
  if (!base) return '#888'
  const dur = act.originalDurationMinutes ?? act.durationMinutes
  if (act.type === 'odpočinek>45h') return '#2563eb'
  if (act.type === 'odpočinek>24h') return '#60a5fa'
  if (act.type === 'odpočinek' && dur >= REGULAR_TDO_MIN) return '#2563eb'
  if (act.type === 'odpočinek' && dur >= LONG_REST_MIN) return '#60a5fa'
  return base.color
}

/**
 * Převod časového bodu (ms UTC) na pozici 0–1 v rámci dne.
 * Data jsou v UTC, graf zobrazuje v místním čase – proto používáme getHours/getMinutes.
 * Půlnoc následujícího dne (konec dne) = 1.0, ne 0.
 */
function timeToX(dayStartMs: number, ms: number): number {
  const dayEndMs = dayStartMs + 24 * 3600 * 1000
  if (ms >= dayEndMs) return 1.0
  const d = new Date(ms)
  const h = d.getHours()
  const m = d.getMinutes()
  return Math.min(1, (h + m / 60) / 24)
}

function createEmptyDay(dayStartMs: number, dayNames: string[]): DayData {
  const d = new Date(dayStartMs)
  return {
    dayLabel: dayNames[d.getDay()] ?? '',
    dateStr: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`,
    dateUtc: dayStartMs,
    activities: [],
  }
}

function formatWeekRange(weekStartMs: number): string {
  const mon = new Date(weekStartMs)
  const sun = new Date(weekStartMs + 6 * DAY_MS)
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
  return `${fmt(mon)} – ${fmt(sun)}`
}

const ACTIVITY_LABELS: Record<string, string> = {
  REST: 'odpočinek',
  WORK: 'práce',
  AVAILABILITY: 'pohotovost',
  UNKNOWN: 'neznámá činnost',
  START_COUNTRY: 'výchozí země',
  END_COUNTRY: 'cílová země',
}

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  řízení: 'řízení',
  práce: 'práce',
  pohotovost: 'pohotovost',
  odpočinek: 'odpočinek',
  'odpočinek>24h': 'odpoč. 24h–45h',
  'odpočinek>45h': 'odpoč. ≥45h',
  neznámá: 'neznámá',
}

/** Typy aktivit zobrazené v legendě – jen řízení, jiná práce, pohotovost, odpočinek */
const LEGEND_ACTIVITY_TYPES: ActivityType[] = ['řízení', 'práce', 'pohotovost', 'odpočinek']

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Formát XXh:XXm pro legendu součtů */
function formatDurationHm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h:${String(m).padStart(2, '0')}m`
}

/**
 * Zjistí, zda probíhá odpočinek (směna ukončena END_COUNTRY), nebo vrací součty aktivit probíhající směny.
 * Pokud je poslední značka END_COUNTRY → směna ukončena, odpočinek → null (zobrazit ----).
 */
function getCurrentShiftSums(
  days: DayData[],
  countryMarkers: CountryMarker[]
): Partial<Record<ActivityType, number>> | null {
  const withMs = countryMarkers
    .map((m) => ({ ...m, ms: parseTimeAndDate(m.timeStr, m.dateStr) }))
    .sort((a, b) => a.ms - b.ms)
  if (withMs.length === 0) return null
  const last = withMs[withMs.length - 1]!
  if (last.activityId === 'END_COUNTRY') return null

  const lastStartIdx = withMs.map((m, i) => (m.activityId === 'START_COUNTRY' ? i : -1)).filter((i) => i >= 0).pop() ?? -1
  if (lastStartIdx < 0) return null
  const shiftStartMs = withMs[lastStartIdx]!.ms
  const allActivities = days.flatMap((d) => d.activities)
  const maxEndMs = allActivities.length > 0 ? Math.max(...allActivities.map((a) => a.endMs)) : shiftStartMs
  const shiftEndMs = maxEndMs

  const sums: Partial<Record<ActivityType, number>> = {}
  for (const act of allActivities) {
    if (act.endMs <= shiftStartMs || act.startMs >= shiftEndMs) continue
    const clipStart = Math.max(act.startMs, shiftStartMs)
    const clipEnd = Math.min(act.endMs, shiftEndMs)
    const minutes = Math.round((clipEnd - clipStart) / 60000)
    if (minutes <= 0) continue
    const t = act.type
    sums[t] = (sums[t] ?? 0) + minutes
  }
  return sums
}

/** Délka aktuální směny v minutách, nebo null když probíhá odpočinek (směna ukončena). */
function getCurrentShiftLengthMinutes(
  days: DayData[],
  countryMarkers: CountryMarker[]
): number | null {
  const withMs = countryMarkers
    .map((m) => ({ ...m, ms: parseTimeAndDate(m.timeStr, m.dateStr) }))
    .sort((a, b) => a.ms - b.ms)
  if (withMs.length === 0) return null
  const last = withMs[withMs.length - 1]!
  if (last.activityId === 'END_COUNTRY') return null

  const lastStartIdx = withMs.map((m, i) => (m.activityId === 'START_COUNTRY' ? i : -1)).filter((i) => i >= 0).pop() ?? -1
  if (lastStartIdx < 0) return null
  const shiftStartMs = withMs[lastStartIdx]!.ms
  const allActivities = days.flatMap((d) => d.activities)
  const maxEndMs = allActivities.length > 0 ? Math.max(...allActivities.map((a) => a.endMs)) : shiftStartMs
  return Math.round((maxEndMs - shiftStartMs) / 60000)
}

export type Card2GraphData = {
  days: DayData[]
  countryMarkers: CountryMarker[]
  manualEntryBuffer?: ManualEntrySegment[]
  lastWithdrawalUtc?: number | null
}

export type WorkWeekGraphViewProps = {
  days: DayData[]
  countryMarkers: CountryMarker[]
  manualEntryBuffer?: ManualEntrySegment[]
  lastWithdrawalUtc?: number | null
  card2Data?: Card2GraphData
  loadUnloadEvents?: VehicleLoadUnloadEvent[]
  ferryTrainEvents?: FerryTrainEvent[]
  outModeEvents?: OutModeEvent[]
  recordedGpsLocations?: RecordedGpsLocation[]
  faultsAndEvents?: FaultOrEvent[]
  symbolMap?: SymbolMap | null
  onResetLoadUnload?: () => void
  onClose: () => void
}

/**
 * Pracovní směna = od zadání výchozí země (START_COUNTRY) do zadání cílové země (END_COUNTRY).
 * Režim osádky / podkreslení šrafou platí pro tuto periodu.
 */
function getWorkShiftRanges(markers: CountryMarker[]): Array<{ startMs: number; endMs: number }> {
  const withMs = markers
    .map((m) => ({ ...m, ms: parseTimeAndDate(m.timeStr, m.dateStr) }))
    .sort((a, b) => a.ms - b.ms)
  const ranges: Array<{ startMs: number; endMs: number }> = []
  for (let i = 0; i < withMs.length; i++) {
    if (withMs[i]!.activityId !== 'START_COUNTRY') continue
    const startMs = withMs[i]!.ms
    for (let j = i + 1; j < withMs.length; j++) {
      if (withMs[j]!.activityId === 'END_COUNTRY') {
        ranges.push({ startMs, endMs: withMs[j]!.ms })
        break
      }
    }
  }
  return ranges
}

/** Průnik pracovních směn s daným dnem – vrací segmenty pro vykreslení v řádku dne. */
function getWorkShiftRangesForDay(
  workShiftRanges: Array<{ startMs: number; endMs: number }>,
  dayUtc: number
): Array<{ startMs: number; endMs: number }> {
  const dayEnd = dayUtc + 24 * 3600 * 1000
  const result: Array<{ startMs: number; endMs: number }> = []
  for (const r of workShiftRanges) {
    if (r.endMs <= dayUtc || r.startMs >= dayEnd) continue
    result.push({
      startMs: Math.max(r.startMs, dayUtc),
      endMs: Math.min(r.endMs, dayEnd),
    })
  }
  return result
}

function getMarkersOnDay(markers: CountryMarker[], dayUtcMs: number): CountryMarker[] {
  const dayEndMs = dayUtcMs + 24 * 3600 * 1000
  return markers.filter((m) => {
    const ms = parseTimeAndDate(m.timeStr, m.dateStr)
    return ms >= dayUtcMs && ms < dayEndMs
  })
}

function getLoadUnloadOnDay(events: VehicleLoadUnloadEvent[], dayUtcMs: number): VehicleLoadUnloadEvent[] {
  const dayEndMs = dayUtcMs + 24 * 3600 * 1000
  return events.filter((e) => e.minuteStartUtc >= dayUtcMs && e.minuteStartUtc < dayEndMs)
}

const FERRY_TRAIN_SYMBOL_ID = 49

function getFerryTrainOnDay(events: FerryTrainEvent[], dayUtcMs: number): FerryTrainEvent[] {
  const dayEndMs = dayUtcMs + 24 * 3600 * 1000
  return events.filter((e) => e.minuteStartUtc >= dayUtcMs && e.minuteStartUtc < dayEndMs)
}

function getOutModeOnDay(events: OutModeEvent[], dayUtcMs: number): OutModeEvent[] {
  const dayEndMs = dayUtcMs + 24 * 3600 * 1000
  return events.filter((e) => e.minuteStartUtc >= dayUtcMs && e.minuteStartUtc < dayEndMs)
}

/** Vrací období OUT (startMs, endMs) z párování activation–deactivation */
function getOutModeRanges(events: OutModeEvent[]): Array<{ startMs: number; endMs: number }> {
  const sorted = [...events].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
  const ranges: Array<{ startMs: number; endMs: number }> = []
  let pendingStart: number | null = null
  for (const e of sorted) {
    if (e.type === 'activation') {
      pendingStart = e.minuteStartUtc
    } else if (e.type === 'deactivation' && pendingStart != null) {
      ranges.push({ startMs: pendingStart, endMs: e.minuteStartUtc })
      pendingStart = null
    }
  }
  return ranges
}

/** Zda aktivita řízení (startMs, endMs) překrývá nějaké OUT období */
function drivingOverlapsOutPeriod(actStartMs: number, actEndMs: number, outRanges: Array<{ startMs: number; endMs: number }>): boolean {
  for (const r of outRanges) {
    if (actStartMs < r.endMs && actEndMs > r.startMs) return true
  }
  return false
}

const LOAD_UNLOAD_SYMBOL_ID: Record<VehicleLoadUnloadEvent['type'], number> = {
  load: 52,
  unload: 53,
  both: 54,
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatTimeRange(startMs: number, endMs: number): string {
  const d1 = new Date(startMs)
  const d2 = new Date(endMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  const sameDay = d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()
  if (sameDay) {
    return `${pad(d1.getDate())}.${pad(d1.getMonth() + 1)}.${d1.getFullYear()} ${pad(d1.getHours())}:${pad(d1.getMinutes())}–${pad(d2.getHours())}:${pad(d2.getMinutes())}`
  }
  return `${formatTimestamp(startMs)}–${formatTimestamp(endMs)}`
}

type GraphBlockProps = {
  days: DayData[]
  countryMarkers: CountryMarker[]
  manualEntryBuffer?: ManualEntrySegment[]
  lastWithdrawalUtc?: number | null
  loadUnloadEvents?: VehicleLoadUnloadEvent[]
  ferryTrainEvents?: FerryTrainEvent[]
  outModeEvents?: OutModeEvent[]
  symbolMap?: SymbolMap | null
  displayWeekStartMs: number
  blockId: string
  title?: string
  dayNames: string[]
  t: {
    workWeek: {
      activityLabels: Record<string, string>
      activityTypes: Record<string, string>
      workShiftDuration: string
      workShiftRest: string
      manualRecordsTitle: string
      tachographRecordsTitle: string
      lastWithdrawalLabel: string
      manualDataLabel: string
      shiftMarkerLabel: string
      loadUnloadSection: string
      ferryTrainSection: string
      outModeSection: string
      activation: string
      deactivation: string
      outModeStartMark: string
      outModeEndMark: string
    }
    manualEntry: { load: string; unload: string; loadUnload: string }
  }
}

function GraphBlock({ days, countryMarkers, manualEntryBuffer, lastWithdrawalUtc, loadUnloadEvents = [], ferryTrainEvents = [], outModeEvents = [], symbolMap, displayWeekStartMs, blockId, title, dayNames, t }: GraphBlockProps) {
  const dayMap = new Map<number, DayData>()
  for (const day of days) {
    dayMap.set(day.dateUtc, day)
  }

  const visibleDays: DayData[] = []
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    const dayStart = displayWeekStartMs + i * DAY_MS
    visibleDays.push(dayMap.get(dayStart) ?? createEmptyDay(dayStart, dayNames))
  }

  const visibleFirstDate = visibleDays[0]!.dateUtc
  const visibleLastDate = visibleDays[visibleDays.length - 1]!.dateUtc
  const visibleLastEnd = visibleLastDate + DAY_MS
  const visibleMarkers = countryMarkers.filter((m) => {
    const ms = parseTimeAndDate(m.timeStr, m.dateStr)
    return ms >= visibleFirstDate && ms < visibleLastEnd
  })
  const visibleLoadUnload = loadUnloadEvents.filter(
    (e) => e.minuteStartUtc >= visibleFirstDate && e.minuteStartUtc < visibleLastEnd
  )
  const visibleFerryTrain = ferryTrainEvents.filter(
    (e) => e.type === 'activation' && e.minuteStartUtc >= visibleFirstDate && e.minuteStartUtc < visibleLastEnd
  )
  const visibleOutMode = outModeEvents.filter(
    (e) => e.minuteStartUtc >= visibleFirstDate && e.minuteStartUtc < visibleLastEnd
  )
  const outModeRanges = getOutModeRanges(outModeEvents)

  const workShiftRanges = getWorkShiftRanges(countryMarkers)

  const height = MARGIN_TOP + visibleDays.length * ROW_HEIGHT + MARGIN_BOTTOM
  const width = LABEL_WIDTH + CHART_WIDTH + 36

  return (
    <div className="work-week-graph-block">
      {title != null && <h3 className="work-week-graph-block-title">{title}</h3>}
      <svg viewBox={`0 0 ${width} ${height}`} className="work-week-graph-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id={`crew-mode-hatch-${blockId}`} patternUnits="userSpaceOnUse" width="6" height="6">
            <line x1="0" y1="0" x2="6" y2="6" stroke="rgba(100, 149, 237, 0.18)" strokeWidth="1" />
          </pattern>
          <pattern id={`out-driving-hatch-${blockId}`} patternUnits="userSpaceOnUse" width="4" height="4">
            <line x1="0" y1="0" x2="4" y2="4" stroke="#c62828" strokeWidth="2.2" />
          </pattern>
        </defs>
        <g id={`day-separators-${blockId}`}>
          {visibleDays.slice(0, -1).map((_, i) => {
            const y = MARGIN_TOP + (i + 1) * ROW_HEIGHT
            return (
              <line key={i} x1={0} y1={y} x2={width} y2={y} stroke="#e0e0e0" strokeWidth={0.5} opacity={0.7} />
            )
          })}
        </g>
        <g id={`quarter-ticks-top-${blockId}`}>
          {Array.from({ length: QUARTERS_PER_DAY }, (_, q) => {
            if (q % 4 === 0) return null
            const x = LABEL_WIDTH + (q / QUARTERS_PER_DAY) * CHART_WIDTH
            return (
              <line key={`top-q-${q}`} x1={x} y1={MARGIN_TOP - QUARTER_TICK_LEN} x2={x} y2={MARGIN_TOP} stroke="#bbb" strokeWidth={0.5} opacity={0.7} />
            )
          })}
        </g>
        <g id={`hour-ticks-top-${blockId}`}>
          {Array.from({ length: HOURS }, (_, i) => {
            const x = LABEL_WIDTH + (i / 24) * CHART_WIDTH
            return (
              <g key={`top-${i}`}>
                <line x1={x} y1={MARGIN_TOP - HOUR_TICK_LEN} x2={x} y2={MARGIN_TOP} stroke="#333" strokeWidth={1} />
                <text x={x} y={11} textAnchor="middle" fill="#222" fontSize={8} fontFamily="sans-serif" fontWeight={600}>{i}</text>
              </g>
            )
          })}
        </g>
        {visibleDays.map((day, rowIndex) => {
          const yBase = MARGIN_TOP + rowIndex * ROW_HEIGHT
          const dayStart = day.dateUtc
          return (
            <g key={day.dateUtc}>
              {Array.from({ length: HOURS }, (_, i) => {
                const x = LABEL_WIDTH + (i / 24) * CHART_WIDTH
                const rowTop = yBase + 3
                return (
                  <g key={`tick-${i}`}>
                    <line x1={x} y1={rowTop} x2={x} y2={rowTop + TICK_LEN} stroke={TICK_COLOR} strokeWidth="0.5" opacity={0.4} />
                    <line x1={x} y1={yBase + ROW_HEIGHT - 3 - TICK_LEN} x2={x} y2={yBase + ROW_HEIGHT - 3} stroke={TICK_COLOR} strokeWidth="0.5" opacity={0.4} />
                  </g>
                )
              })}
              <text x={6} y={yBase + ROW_HEIGHT / 2 + 4} fill="#333" fontSize={11} fontFamily="sans-serif" fontWeight={500}>{dayNames[new Date(day.dateUtc).getDay()]}</text>
              <text x={6} y={yBase + ROW_HEIGHT / 2 + 14} fill={LABEL_COLOR} fontSize={9} fontFamily="sans-serif">{day.dateStr}</text>
              {getWorkShiftRangesForDay(workShiftRanges, day.dateUtc).map((range, ri) => {
                const x1 = LABEL_WIDTH + timeToX(dayStart, range.startMs) * CHART_WIDTH
                const x2 = LABEL_WIDTH + timeToX(dayStart, range.endMs) * CHART_WIDTH
                const rowTop = yBase + 2
                const rowH = ROW_HEIGHT - 4
                return (
                  <rect
                    key={`crew-${ri}`}
                    x={x1}
                    y={rowTop}
                    width={Math.max(1, x2 - x1)}
                    height={rowH}
                    fill={`url(#crew-mode-hatch-${blockId})`}
                    className="work-week-graph-crew-mode-bg"
                  />
                )
              })}
              {(() => {
                const maxStrokeHalf = 8
                const rowCenter = yBase + ROW_HEIGHT / 2
                const sortedActivities = [...day.activities].sort((a, b) => (a.isManualEntry ? 1 : 0) - (b.isManualEntry ? 1 : 0))
                const MANUAL_UNDERLINE_WIDTH = 3
                return sortedActivities.map((act, i) => {
                  const style = ACTIVITY_STYLE[act.type]
                  const baseColor = getActivityColor(act)
                  const dur = act.originalDurationMinutes ?? act.durationMinutes
                  const strokeW =
                    (act.type === 'odpočinek' && dur >= LONG_REST_MIN) || act.type === 'odpočinek>24h' || act.type === 'odpočinek>45h'
                      ? 16
                      : (style?.strokeWidth ?? 5)
                  const x1 = LABEL_WIDTH + timeToX(dayStart, act.startMs) * CHART_WIDTH
                  const x2 = LABEL_WIDTH + timeToX(dayStart, act.endMs) * CHART_WIDTH
                  const y = rowCenter + maxStrokeHalf - strokeW / 2
                  const bottomY = y + strokeW / 2 + MANUAL_UNDERLINE_WIDTH / 2
                  const isDrivingInOut =
                    act.type === 'řízení' && drivingOverlapsOutPeriod(act.startMs, act.endMs, outModeRanges)
                  return (
                    <g key={i}>
                      {isDrivingInOut ? (
                        <rect
                          x={x1}
                          y={y - strokeW / 2}
                          width={Math.max(1, x2 - x1)}
                          height={strokeW}
                          fill={`url(#out-driving-hatch-${blockId})`}
                        />
                      ) : (
                        <line
                          x1={x1}
                          y1={y}
                          x2={x2}
                          y2={y}
                          stroke={baseColor}
                          strokeWidth={strokeW}
                          strokeLinecap="butt"
                        />
                      )}
                      {act.isManualEntry && (
                        <line x1={x1} y1={bottomY} x2={x2} y2={bottomY} stroke="#8b5cf6" strokeWidth={MANUAL_UNDERLINE_WIDTH} strokeLinecap="butt" />
                      )}
                    </g>
                  )
                })
              })()}
              {getMarkersOnDay(visibleMarkers, day.dateUtc).map((marker, i) => {
                const ms = parseTimeAndDate(marker.timeStr, marker.dateStr)
                const x = LABEL_WIDTH + timeToX(dayStart, ms) * CHART_WIDTH
                const code = marker.countryCode ?? 'CZ'
                const isStart = marker.activityId === 'START_COUNTRY'
                const label = isStart ? `${code} ►` : `◄ ${code}`
                const dx = isStart ? 7 : -7
                const textAnchor = isStart ? 'start' : 'end'
                const anchorBottom = yBase + ROW_HEIGHT / 2 + 7
                return (
                  <g key={`anchor-${dayStart}-${i}`}>
                    <text x={x} y={yBase + 8} dx={dx} textAnchor={textAnchor} fill={ANCHOR_STROKE} fontSize={8} fontFamily="sans-serif" fontWeight={600}>{label}</text>
                    <line x1={x} y1={yBase + 3} x2={x} y2={anchorBottom} stroke={ANCHOR_STROKE} strokeWidth={1.5} strokeLinecap="round" />
                    <circle cx={x} cy={yBase + 3} r={2.5} fill={ANCHOR_COLOR} />
                  </g>
                )
              })}
              {getLoadUnloadOnDay(visibleLoadUnload, day.dateUtc).map((ev, i) => {
                const x = LABEL_WIDTH + timeToX(dayStart, ev.minuteStartUtc) * CHART_WIDTH
                const symbolId = LOAD_UNLOAD_SYMBOL_ID[ev.type]
                const symbolChar = symbolMap?.[symbolId] ?? ''
                const anchorBottom = yBase + ROW_HEIGHT / 2 + 7
                return (
                  <g key={`loadunload-${dayStart}-${ev.minuteStartUtc}-${i}`}>
                    <text x={x} y={yBase + 10} textAnchor="middle" fill={ANCHOR_STROKE} fontSize={12} fontFamily="SymbolTacho1">{symbolChar}</text>
                    <line x1={x} y1={yBase + 14} x2={x} y2={anchorBottom} stroke={ANCHOR_STROKE} strokeWidth={1.5} strokeLinecap="round" />
                  </g>
                )
              })}
              {getFerryTrainOnDay(visibleFerryTrain, day.dateUtc).map((ev, i) => {
                const x = LABEL_WIDTH + timeToX(dayStart, ev.minuteStartUtc) * CHART_WIDTH
                const symbolChar = symbolMap?.[FERRY_TRAIN_SYMBOL_ID] ?? ''
                const anchorBottom = yBase + ROW_HEIGHT / 2 + 7
                return (
                  <g key={`ferrytrain-${dayStart}-${ev.minuteStartUtc}-${i}`}>
                    <text x={x} y={yBase + 10} textAnchor="middle" fill={ANCHOR_STROKE} fontSize={12} fontFamily="SymbolTacho1">{symbolChar}</text>
                    <line x1={x} y1={yBase + 14} x2={x} y2={anchorBottom} stroke={ANCHOR_STROKE} strokeWidth={1.5} strokeLinecap="round" />
                  </g>
                )
              })}
              {getOutModeOnDay(visibleOutMode, day.dateUtc).map((ev, i) => {
                const x = LABEL_WIDTH + timeToX(dayStart, ev.minuteStartUtc) * CHART_WIDTH
                const label = ev.type === 'activation' ? `${t.workWeek.outModeStartMark}►` : `◄${t.workWeek.outModeEndMark}`
                const dx = ev.type === 'activation' ? 3 : -3
                const textAnchor = ev.type === 'activation' ? 'start' : 'end'
                const rowCenter = yBase + ROW_HEIGHT / 2
                const anchorTop = rowCenter + 4
                const anchorBottom = yBase + ROW_HEIGHT - 4
                const textY = ev.type === 'activation' ? anchorBottom + 4 : anchorBottom - 2
                return (
                  <g key={`outmode-${dayStart}-${ev.minuteStartUtc}-${ev.type}-${i}`}>
                    <line x1={x} y1={anchorTop} x2={x} y2={anchorBottom} stroke={ANCHOR_STROKE} strokeWidth={1} strokeLinecap="round" />
                    <circle cx={x} cy={anchorBottom} r={1.5} fill={ANCHOR_COLOR} />
                    <text x={x} y={textY} dx={dx} textAnchor={textAnchor} fill={ANCHOR_STROKE} fontSize={7} fontFamily="sans-serif" fontWeight={600}>{label}</text>
                  </g>
                )
              })}
            </g>
          )
        })}
        <g id={`quarter-ticks-bottom-${blockId}`} transform={`translate(0, ${height - MARGIN_BOTTOM})`}>
          {Array.from({ length: QUARTERS_PER_DAY }, (_, q) => {
            if (q % 4 === 0) return null
            const x = LABEL_WIDTH + (q / QUARTERS_PER_DAY) * CHART_WIDTH
            return <line key={`bot-q-${q}`} x1={x} y1={0} x2={x} y2={QUARTER_TICK_LEN} stroke="#bbb" strokeWidth={0.5} opacity={0.7} />
          })}
        </g>
        <g id={`hour-ticks-bottom-${blockId}`} transform={`translate(0, ${height - MARGIN_BOTTOM})`}>
          {Array.from({ length: HOURS }, (_, i) => {
            const x = LABEL_WIDTH + (i / 24) * CHART_WIDTH
            return (
              <g key={`bot-${i}`}>
                <line x1={x} y1={0} x2={x} y2={TICK_LEN} stroke="#333" strokeWidth={1} />
                <text x={x} y={12} textAnchor="middle" fill="#222" fontSize={8} fontFamily="sans-serif" fontWeight={600}>{i}</text>
              </g>
            )
          })}
        </g>
      </svg>
      <div className="work-week-graph-legend work-week-graph-legend-summary">
        {(() => {
          const ww = t.workWeek as any
          return <span className="work-week-graph-legend-summary-label">{ww.shiftSumLabel}</span>
        })()}
        {LEGEND_ACTIVITY_TYPES.map((type) => {
          const { color, strokeWidth } = ACTIVITY_STYLE[type]
          const sums = getCurrentShiftSums(days, countryMarkers)
          const ww = t.workWeek as any
          const displayValue = sums === null ? ww.shiftSumRestPlaceholder : (sums[type] != null ? formatDurationHm(sums[type]!) : '0h:00m')
          return (
            <span key={type} className="work-week-graph-legend-item">
              <svg width={38} height={18} className="work-week-graph-legend-sample" viewBox="0 0 22 11" preserveAspectRatio="xMidYMid meet">
                <line
                  x1={0}
                  y1={5.5}
                  x2={22}
                  y2={5.5}
                  stroke={color}
                  strokeWidth={Math.min(strokeWidth, 11)}
                  strokeLinecap="butt"
                />
              </svg>
              <span className="work-week-graph-legend-label">
                <span className="tacho-icon">{ACTIVITY_SYMBOL[type]}</span>
                <span className="work-week-graph-legend-sum"> {displayValue}</span>
              </span>
            </span>
          )
        })}
        {(() => {
          const shiftLen = getCurrentShiftLengthMinutes(days, countryMarkers)
          const ww = t.workWeek as any
          return (
            <span className="work-week-graph-legend-item work-week-graph-legend-shift-length">
              <span className="work-week-graph-legend-summary-label">{ww.shiftLengthLabel}</span>
              <span className="work-week-graph-legend-shift-length-value">
                {shiftLen === null ? ww.shiftSumRestPlaceholder : formatDurationHm(shiftLen)}
              </span>
            </span>
          )
        })()}
      </div>
      {(visibleDays.some((d) => d.activities.some((a) => !a.isManualEntry)) ||
        (manualEntryBuffer != null && manualEntryBuffer.length > 0) ||
        lastWithdrawalUtc != null ||
        loadUnloadEvents.length > 0 ||
        ferryTrainEvents.length > 0) && (
        <div className="work-week-graph-table-wrapper">
          <table className="work-week-graph-table">
            <thead>
              <tr>
                <th>{t.workWeek.manualRecordsTitle}</th>
                <th>{t.workWeek.tachographRecordsTitle}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="work-week-graph-table-cell">
                  {lastWithdrawalUtc != null && (
                    <div className="work-week-graph-manual-item">
                      <strong>{t.workWeek.lastWithdrawalLabel}</strong>{' '}
                      {new Date(lastWithdrawalUtc).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' (UTC: '}{new Date(lastWithdrawalUtc).toISOString().replace('T', ' ').slice(0, 16)}{' )'}
                    </div>
                  )}
                  {manualEntryBuffer != null && manualEntryBuffer.length > 0 && (
                    <>
                      <strong>{t.workWeek.manualDataLabel}</strong>
                      <div className="work-week-graph-manual-list">
                        {manualEntryBuffer.map((seg, i) => {
                          const label = t.workWeek.activityLabels[seg.activityId] ?? ACTIVITY_LABELS[seg.activityId] ?? seg.activityId
                          const next = manualEntryBuffer![i + 1]
                          if (!(seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY') && next && segmentToMsUtc(seg) === segmentToMsUtc(next)) return null
                          // Konec bloku před razítkem země – nezobrazovat jako samostatný minutový blok
                          if (!(seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY') && next && (next.activityId === 'START_COUNTRY' || next.activityId === 'END_COUNTRY')) return null
                          const pad = (n: number) => String(n).padStart(2, '0')
                          const timeStr = `${pad(seg.day)}.${pad(seg.month)}.${seg.year} ${pad(seg.hour)}:${pad(seg.minute)}`
                          const isCountryMarker = seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY'
                          return (
                            <div key={i} className="work-week-graph-manual-item">
                              {isCountryMarker ? (
                                <>{timeStr} | <em>{label}</em> {t.workWeek.shiftMarkerLabel}{seg.countryCode && ` ${seg.countryCode}`}{seg.isManualEntry && ' [M]'}</>
                              ) : (
                                <>{timeStr} → {next ? `${pad(next.day)}.${pad(next.month)}.${next.year} ${pad(next.hour)}:${pad(next.minute)}` : '—'} | {label}{seg.isManualEntry && ' [M]'}</>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {loadUnloadEvents.length > 0 && (
                    <>
                      <strong>{t.workWeek.loadUnloadSection}</strong>
                      <div className="work-week-graph-manual-list">
                        {loadUnloadEvents.map((ev, i) => {
                          const d = new Date(ev.minuteStartUtc)
                          const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
                          const dateStr = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
                          const label = ev.type === 'load' ? t.manualEntry.load : ev.type === 'unload' ? t.manualEntry.unload : t.manualEntry.loadUnload
                          return (
                            <div key={i} className="work-week-graph-manual-item">
                              {dateStr} {timeStr} | <em>{label}</em>{ev.gpsLocation ? ` (${ev.gpsLocation})` : ''}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {ferryTrainEvents.length > 0 && (
                    <>
                      <strong>{t.workWeek.ferryTrainSection}</strong>
                      <div className="work-week-graph-manual-list">
                        {ferryTrainEvents.map((ev, i) => {
                          const d = new Date(ev.minuteStartUtc)
                          const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
                          const dateStr = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
                          const label = ev.type === 'activation' ? t.workWeek.activation : t.workWeek.deactivation
                          return (
                            <div key={i} className="work-week-graph-manual-item">
                              {dateStr} {timeStr} | <em>{label}</em>{ev.gpsLocation ? ` (${ev.gpsLocation})` : ''}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {outModeEvents.length > 0 && (
                    <>
                      <strong>{t.workWeek.outModeSection}</strong>
                      <div className="work-week-graph-manual-list">
                        {outModeEvents.map((ev, i) => {
                          const d = new Date(ev.minuteStartUtc)
                          const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
                          const dateStr = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
                          const label = ev.type === 'activation' ? t.workWeek.activation : t.workWeek.deactivation
                          return (
                            <div key={i} className="work-week-graph-manual-item">
                              {dateStr} {timeStr} | <em>{label}</em>{ev.gpsLocation ? ` (${ev.gpsLocation})` : ''}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {(!manualEntryBuffer || manualEntryBuffer.length === 0) && !lastWithdrawalUtc && loadUnloadEvents.length === 0 && ferryTrainEvents.length === 0 && outModeEvents.length === 0 && (
                    <span className="work-week-graph-table-empty">—</span>
                  )}
                </td>
                <td className="work-week-graph-table-cell">
                  {(() => {
                    const tachoActivities = visibleDays.flatMap((d) =>
                      d.activities
                        .filter((a) => !a.isManualEntry)
                        .map((a) => ({ ...a }))
                    )
                    const shiftRanges = getWorkShiftRanges(countryMarkers)
                    const visibleShiftRanges = shiftRanges.filter(
                      (r) => r.endMs > visibleFirstDate && r.startMs < visibleLastEnd
                    )
                    if (tachoActivities.length === 0 && visibleShiftRanges.length === 0) {
                      return <span className="work-week-graph-table-empty">—</span>
                    }
                    const startCountryLabel = t.workWeek.activityLabels.START_COUNTRY ?? 'výchozí země'
                    const endCountryLabel = t.workWeek.activityLabels.END_COUNTRY ?? 'cílová země'
                    const rows: (JSX.Element | null)[] = []
                    const WORKING_TYPES = new Set<ActivityType>(['řízení', 'práce', 'pohotovost'])
                    const withMs = countryMarkers
                      .map((m) => ({ ...m, ms: parseTimeAndDate(m.timeStr, m.dateStr) }))
                      .sort((a, b) => a.ms - b.ms)
                    function mergeAcrossMidnight<T extends { clipStart: number; clipEnd: number; clipMinutes: number; type: ActivityType; gpsLocation?: string }>(items: T[]): T[] {
                      if (items.length === 0) return []
                      const merged: T[] = [items[0]!]
                      for (let i = 1; i < items.length; i++) {
                        const prev = merged[merged.length - 1]!
                        const curr = items[i]!
                        if (prev.clipEnd === curr.clipStart && prev.type === curr.type) {
                          merged[merged.length - 1] = { ...prev, clipEnd: curr.clipEnd, clipMinutes: prev.clipMinutes + curr.clipMinutes } as T
                        } else {
                          merged.push(curr)
                        }
                      }
                      return merged
                    }
                    for (let si = 0; si < visibleShiftRanges.length; si++) {
                      const range = visibleShiftRanges[si]!
                      const startMarker = withMs.find((m) => m.ms === range.startMs && m.activityId === 'START_COUNTRY')
                      const endMarker = withMs.find((m) => m.ms === range.endMs && m.activityId === 'END_COUNTRY')
                      const actsInRangeRaw = tachoActivities
                        .filter((a) => a.endMs > range.startMs && a.startMs < range.endMs)
                        .map((a) => ({
                          ...a,
                          clipStart: Math.max(a.startMs, range.startMs),
                          clipEnd: Math.min(a.endMs, range.endMs),
                          clipMinutes: Math.round((Math.min(a.endMs, range.endMs) - Math.max(a.startMs, range.startMs)) / 60000),
                        }))
                        .sort((a, b) => a.clipStart - b.clipStart)
                      const actsInRange = mergeAcrossMidnight(actsInRangeRaw)
                      rows.push(
                        <div key={`start-${si}`} className="work-week-graph-manual-item work-week-graph-shift-start">
                          {formatTimestamp(range.startMs)} | {startCountryLabel}: {startMarker?.countryCode ?? '—'}
                        </div>
                      )
                      for (const act of actsInRange) {
                        const label = (t.workWeek.activityTypes as Record<string, string>)[act.type] ?? ACTIVITY_TYPE_LABELS[act.type] ?? act.type
                        rows.push(
                          <div key={`act-${si}-${act.clipStart}`} className="work-week-graph-manual-item">
                            {formatTimeRange(act.clipStart, act.clipEnd)} | {label} ({formatDuration(act.clipMinutes)})
                          </div>
                        )
                      }
                      rows.push(
                        <div key={`end-${si}`} className="work-week-graph-manual-item work-week-graph-shift-end">
                          {formatTimestamp(range.endMs)} | {endCountryLabel}: {endMarker?.countryCode ?? '—'}
                        </div>
                      )
                      const workMinutes = actsInRange
                        .filter((a) => WORKING_TYPES.has(a.type))
                        .reduce((s, a) => s + a.clipMinutes, 0)
                      const prevRange = si > 0 ? visibleShiftRanges[si - 1] : null
                      const restMinutes = prevRange != null ? Math.round((range.startMs - prevRange.endMs) / 60000) : null
                      rows.push(
                        <div key={`sep-${si}`} className="work-week-graph-shift-separator">_______________________________________</div>,
                        <div key={`dur-${si}`} className="work-week-graph-manual-item work-week-graph-shift-summary">
                          {t.workWeek.workShiftDuration}: {formatDuration(workMinutes)}
                        </div>,
                        <div key={`rest-${si}`} className="work-week-graph-manual-item work-week-graph-shift-summary">
                          {t.workWeek.workShiftRest}: {restMinutes != null ? formatDuration(restMinutes) : '—'}
                        </div>,
                        <div key={`sep2-${si}`} className="work-week-graph-shift-separator">_______________________________________</div>
                      )
                    }
                    if (visibleShiftRanges.length === 0 && tachoActivities.length > 0) {
                      const sortedFallback = [...tachoActivities].sort((a, b) => a.startMs - b.startMs)
                      const mergedFallback: ParsedActivity[] = []
                      for (const act of sortedFallback) {
                        const last = mergedFallback[mergedFallback.length - 1]
                        if (last && last.endMs === act.startMs && last.type === act.type) {
                          mergedFallback[mergedFallback.length - 1] = {
                            ...last,
                            endMs: act.endMs,
                            durationMinutes: last.durationMinutes + act.durationMinutes,
                            originalDurationMinutes: (last.originalDurationMinutes ?? last.durationMinutes) + (act.originalDurationMinutes ?? act.durationMinutes),
                          }
                        } else {
                          mergedFallback.push({ ...act })
                        }
                      }
                      for (const act of mergedFallback) {
                        const label = (t.workWeek.activityTypes as Record<string, string>)[act.type] ?? ACTIVITY_TYPE_LABELS[act.type] ?? act.type
                        rows.push(
                          <div key={`fallback-${act.startMs}`} className="work-week-graph-manual-item">
                            {formatTimeRange(act.startMs, act.endMs)} | {label} ({formatDuration(act.durationMinutes)})
                          </div>
                        )
                      }
                    }
                    return <div className="work-week-graph-manual-list">{rows}</div>
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatFaultTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Vytvoří záznamy GPS z aktivit – přesně každé 3 hodiny kumulativní doby řízení. */
function deriveRecordedLocationsFromActivities(activities: ParsedActivity[]): RecordedGpsLocation[] {
  const DRIVING_TYPES = new Set<ActivityType>(['řízení'])
  const sorted = [...activities].sort((a, b) => a.startMs - b.startMs)
  const result: RecordedGpsLocation[] = []
  let drivingMinutesAccum = 0
  for (const act of sorted) {
    if (!DRIVING_TYPES.has(act.type)) continue
    const drivingBeforeBlock = drivingMinutesAccum
    drivingMinutesAccum += act.durationMinutes
    let nextThreshold = Math.floor(drivingBeforeBlock / 180) * 180 + 180
    while (nextThreshold <= drivingMinutesAccum) {
      const minutesIntoBlock = nextThreshold - drivingBeforeBlock
      const recordAtMs = act.startMs + minutesIntoBlock * 60000
      result.push({ minuteStartUtc: recordAtMs, gpsLocation: act.gpsLocation ?? '—', recordType: 'gps_3h' as const })
      nextThreshold += 180
    }
  }
  return result
}

export function WorkWeekGraphView({ days, countryMarkers, manualEntryBuffer, lastWithdrawalUtc, card2Data, loadUnloadEvents = [], ferryTrainEvents = [], outModeEvents = [], recordedGpsLocations = [], faultsAndEvents = [], symbolMap, onResetLoadUnload, onClose }: WorkWeekGraphViewProps) {
  const { t } = useLanguage()
  const dayNames = t.workWeek.dayNames
  const getInitialWeekStart = () => {
    if (days.length > 0) return getWeekStartMsLocal(days[days.length - 1]!.dateUtc)
    return getWeekStartMsLocal(Date.now())
  }
  const [displayWeekStartMs, setDisplayWeekStartMs] = useState(getInitialWeekStart)

  useEffect(() => {
    setDisplayWeekStartMs(getInitialWeekStart())
  }, [days])

  const goPrevWeek = () => setDisplayWeekStartMs((ms) => ms - 7 * DAY_MS)
  const goNextWeek = () => setDisplayWeekStartMs((ms) => ms + 7 * DAY_MS)

  if (days.length === 0) {
    return (
      <div className="work-week-graph-overlay" onClick={onClose}>
        <div className="work-week-graph-window" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="work-week-graph-close" onClick={onClose}>×</button>
          {loadUnloadEvents.length > 0 && onResetLoadUnload && (
            <button type="button" className="work-week-graph-reset" onClick={onResetLoadUnload} title={t.workWeek.resetLoadUnloadTitle}>
              {t.workWeek.resetLoadUnload}
            </button>
          )}
          <div className="work-week-graph-empty">{t.workWeek.noData}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="work-week-graph-overlay" onClick={onClose}>
      <div className="work-week-graph-window" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="work-week-graph-close" onClick={onClose} aria-label={t.workWeek.close}>×</button>
        {loadUnloadEvents.length > 0 && onResetLoadUnload && (
          <button type="button" className="work-week-graph-reset" onClick={onResetLoadUnload} title={t.workWeek.resetLoadUnloadTitle}>
            {t.workWeek.resetLoadUnload}
          </button>
        )}
        <div className="work-week-graph-header">
          <h2 className="work-week-graph-title">{t.workWeek.weekGraphTitle}</h2>
          <div className="work-week-graph-nav">
            <button
              type="button"
              className="work-week-graph-nav-btn"
              onClick={goPrevWeek}
              title={t.workWeek.prevWeek}
            >
              ‹
            </button>
            <span className="work-week-graph-nav-calendar">
              {formatWeekRange(displayWeekStartMs)}
            </span>
            <button
              type="button"
              className="work-week-graph-nav-btn"
              onClick={goNextWeek}
              title={t.workWeek.nextWeek}
            >
              ›
            </button>
          </div>
          <div className="work-week-graph-legend">
            {(Object.entries(ACTIVITY_STYLE) as [ActivityType, { color: string; strokeWidth: number }][]).map(
              ([type, { color, strokeWidth }]) => {
                const legendStroke =
                  type === 'odpočinek>45h' ? '#2563eb' : type === 'odpočinek>24h' ? '#60a5fa' : color
                const legendLabel =
                  type === 'odpočinek>45h'
                    ? t.workWeek.legendRest45h
                    : type === 'odpočinek>24h'
                      ? t.workWeek.legendRest24h
                      : null
                return (
                  <span key={type} className="work-week-graph-legend-item">
                    <svg width={38} height={18} className="work-week-graph-legend-sample" viewBox="0 0 22 11" preserveAspectRatio="xMidYMid meet">
                      <line
                        x1={0}
                        y1={5.5}
                        x2={22}
                        y2={5.5}
                        stroke={legendStroke}
                        strokeWidth={Math.min(strokeWidth, 11)}
                        strokeLinecap="butt"
                      />
                    </svg>
                    <span className="work-week-graph-legend-label">
                      <span className={`tacho-icon${type === 'neznámá' ? ' tacho-icon-smaller' : ''}`}>{ACTIVITY_SYMBOL[type]}</span>
                      {legendLabel && <span> {legendLabel}</span>}
                    </span>
                  </span>
                )
              }
            )}
            <span className="work-week-graph-legend-item">
              <svg width={38} height={18} className="work-week-graph-legend-sample" viewBox="0 0 22 11" preserveAspectRatio="xMidYMid meet">
                <line x1={0} y1={5.5} x2={22} y2={5.5} stroke="#8b5cf6" strokeWidth={8} strokeLinecap="butt" />
              </svg>
              <span className="work-week-graph-legend-label">{t.workWeek.manualEntryLabel}</span>
            </span>
          </div>
        </div>

        <GraphBlock
          days={days}
          countryMarkers={countryMarkers}
          manualEntryBuffer={manualEntryBuffer}
          lastWithdrawalUtc={lastWithdrawalUtc}
          loadUnloadEvents={loadUnloadEvents}
          ferryTrainEvents={ferryTrainEvents}
          outModeEvents={outModeEvents ?? []}
          symbolMap={symbolMap}
          displayWeekStartMs={displayWeekStartMs}
          blockId="card1"
          title={card2Data != null ? t.workWeek.card1 : undefined}
          dayNames={dayNames}
          t={t}
        />

        {(() => {
          const visibleFirstDate = displayWeekStartMs
          const visibleLastEnd = displayWeekStartMs + 7 * DAY_MS
          const fromRecorded = (recordedGpsLocations ?? []).filter(
            (r) => r.minuteStartUtc >= visibleFirstDate && r.minuteStartUtc < visibleLastEnd
          )
          const allActivities = days.flatMap((d) => d.activities.filter((a) => !a.isManualEntry))
          const fromDerived = deriveRecordedLocationsFromActivities(allActivities).filter(
            (r) => r.minuteStartUtc >= visibleFirstDate && r.minuteStartUtc < visibleLastEnd
          )
          const seen = new Set<number>()
          const merged: RecordedGpsLocation[] = []
          for (const r of fromRecorded) {
            if (!seen.has(r.minuteStartUtc)) {
              seen.add(r.minuteStartUtc)
              merged.push(r)
            }
          }
          for (const r of fromDerived) {
            if (!seen.has(r.minuteStartUtc)) {
              seen.add(r.minuteStartUtc)
              merged.push(r)
            }
          }
          merged.sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
          return merged.length > 0 ? (
            <div className="work-week-graph-table-wrapper">
              <table className="work-week-graph-table">
                <thead>
                  <tr>
                    <th colSpan={2}>{t.workWeek.recordedLocationsTitle}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className="work-week-graph-table-cell">
                      <div className="work-week-graph-manual-list">
                        {merged.map((r, i) => (
                          <div key={i} className="work-week-graph-manual-item">
                            {formatTimestamp(r.minuteStartUtc)} | {r.gpsLocation} | {r.recordType ? (t.workWeek.recordedLocationTypes[r.recordType] ?? r.recordType) : '—'}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null
        })()}

        {card2Data != null && (
          <GraphBlock
            days={card2Data.days}
            countryMarkers={card2Data.countryMarkers}
            manualEntryBuffer={card2Data.manualEntryBuffer}
            lastWithdrawalUtc={card2Data.lastWithdrawalUtc}
            loadUnloadEvents={[]}
            ferryTrainEvents={[]}
            outModeEvents={[]}
            symbolMap={symbolMap}
            displayWeekStartMs={displayWeekStartMs}
            blockId="card2"
            title={t.workWeek.card2}
            dayNames={dayNames}
            t={t}
          />
        )}

        {faultsAndEvents.length > 0 && (
          <div className="work-week-graph-table-wrapper work-week-graph-warnings-wrapper">
            <div className="work-week-warnings-panel">
              <h3 className="work-week-warnings-title">{t.workWeek.warningsPanelTitle}</h3>
              <ul className="work-week-warnings-list">
              {faultsAndEvents.map((f) => (
                <li key={f.id} className="work-week-warnings-item">
                  <span className="work-week-warnings-time">{formatFaultTime(f.timestampUtc)}</span>
                  <span className="work-week-warnings-label">
                    {(f.type === 'DRIVING_WITHOUT_CARD_WARNING' ? t.workWeek.faultDrivingWithoutCard : f.type === 'DRIVING_WITHOUT_VALID_CARD_WARNING' ? t.workWeek.faultDrivingWithoutValidCard : f.type === 'EXCESS_SPEED_WARNING' ? t.workWeek.faultExcessSpeed : null) ?? f.type}
                  </span>
                </li>
              ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
