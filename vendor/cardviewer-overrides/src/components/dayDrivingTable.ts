import { assessDailyDrivingTime, type DailyDrivingPeriod } from '../analysis/dailyDrivingTime.ts'
import { buildDailyRestChain } from '../analysis/dailyRestChain.ts'
import { assessDrivingBreaks, type BreakActivity, type DrivingBreakPeriod, type QualifyingDrivingBreak } from '../analysis/drivingBreaks.ts'
import { classifyRestCandidates } from '../analysis/restCandidates.ts'
import { findRestIntervals } from '../analysis/restIntervals.ts'
import { clockParts, formatClockDateTime, formatClockTime, type ClockMode } from '../lib/clock.ts'
import type { Activity } from '../types/tacho.ts'
import { cs, fill, formatDuration, type DayDrivingText } from '../translations.ts'

export type DayDrivingActivity = BreakActivity & {
  isCrew?: boolean
}

/** Vizuální stav podle výsledku analýzy. Není to závěr o přestupku. */
export type DayDrivingTone = 'clear' | 'caution' | 'exceeded' | 'undecided'

/** Razítko doby řízení podle délky. Neznamená soulad se všemi ustanoveními nařízení. */
export type DayDrivingMark = 'check' | 'alarm' | 'alert' | 'unknown' | 'open'

export type DayDrivingRow = {
  label: string
  /** Úplný text pro stávající kontroly. */
  value: string
  /** Hlavní údaj. U přestávek jen délky, bez časového rozsahu. */
  primary: string
  /** Doplněk, který nemá přebít hlavní údaj. */
  detail: string | null
  tone: DayDrivingTone | null
  /** Text stavového indikátoru. U metriky bez indikátoru zůstává null. */
  statusText: string | null
  /** Ikona razítka doby řízení. Ostatní řádky ji nemají. */
  mark: DayDrivingMark | null
  rule: 'article_6' | 'article_7' | null
  presentation: 'metric' | 'note' | 'status'
}

const NINE_HOURS = 9 * 60 * 60 * 1000
const TEN_HOURS = 10 * 60 * 60 * 1000
/** Delší odpočinek se v tabulce nevypisuje jako přestávka. Není to denní ani týdenní kategorie. */
const CYCLE_REST_MS = 24 * 60 * 60 * 1000
const ELEVEN_HOURS = 11 * 60 * 60 * 1000

/**
 * Řádky pod denní graf. Kalendářní den jen vybírá, která už spočítaná období se ukážou.
 * Doba řízení se počítá mezi kvalifikovanými odpočinky, ne od půlnoci do půlnoci.
 */
export function buildDayDrivingRows(input: {
  activities: readonly DayDrivingActivity[]
  dayStartUtc: number
  dayEndUtc: number
  clockMode?: ClockMode
  text?: DayDrivingText
  hourUnit?: string
  minuteUnit?: string
}): DayDrivingRow[] {
  const clockMode = input.clockMode ?? 'utc'
  const text = input.text ?? cs.workWeek.dayDriving
  const duration = (ms: number) => formatDuration(ms, input.hourUnit ?? cs.workWeek.hourUnit, input.minuteUnit ?? cs.workWeek.minuteUnit)
  const periods = assessDrivingBreaks(input.activities)
  const relevant = periods.filter((period) => overlaps(period.startUtc, period.endUtc, input.dayStartUtc, input.dayEndUtc))
  const shownBreaks = breakLines(relevant, input.activities, clockMode, duration)
  const daily = dailyDrivingPeriods(input.activities)
  const rows: DayDrivingRow[] = [
    ...dailyRows(daily, input.activities, input.dayStartUtc, input.dayEndUtc, clockMode, text, duration),
    {
      label: text.safetyBreaks,
      primary: shownBreaks.lengths.length > 0 ? shownBreaks.lengths.join(', ') : '—',
      detail: shownBreaks.ranges.length > 0 ? shownBreaks.ranges.join(', ') : null,
      value: shownBreaks.breaks.length > 0 ? shownBreaks.breaks.join(', ') : '—',
      tone: null,
      statusText: null,
      mark: null,
      rule: null,
      presentation: 'metric',
    },
  ]
  const tone = resultTone(relevant)
  const result = resultText(relevant, text)
  rows.push({
    label: text.breakResult,
    primary: result,
    detail: resultDetail(relevant, tone, text),
    value: result,
    tone,
    statusText: result,
    mark: null,
    rule: 'article_7',
    presentation: 'status',
  })
  const closed = evaluated(relevant)
  if (closed.length > 0) {
    const longest = duration(closed.reduce((max, period) => Math.max(max, period.drivingMs), 0))
    rows.push({
      label: text.longestBetweenBreaks,
      primary: longest,
      detail: null,
      value: longest,
      tone: null,
      statusText: null,
      mark: null,
      rule: null,
      presentation: 'metric',
    })
  }
  return rows
}

function resultTone(periods: readonly DrivingBreakPeriod[]): DayDrivingTone {
  if (periods.some((period) => period.status === 'insufficient_data')) return 'undecided'
  if (periods.some((period) => period.status === 'exceeded')) return 'exceeded'
  if (periods.some((period) => period.status === 'crew_break_conditional')) return 'caution'
  const decided = evaluated(periods)
  if (decided.length === 0) return 'undecided'
  if (decided.some((period) => period.qualifyingBreak == null)) return 'caution'
  return 'clear'
}

function resultText(periods: readonly DrivingBreakPeriod[], text: DayDrivingText): string {
  if (periods.some((period) => period.status === 'insufficient_data')) return text.unreliable
  if (periods.some((period) => period.status === 'exceeded')) return text.limit430Exceeded
  if (periods.some((period) => period.status === 'crew_break_conditional')) return text.crewBreak
  return text.within430
}

function resultDetail(periods: readonly DrivingBreakPeriod[], tone: DayDrivingTone, text: DayDrivingText): string | null {
  if (periods.some((period) => period.status === 'crew_break_conditional')) return text.crewDetail
  if (tone === 'caution') return text.cycleOpen
  return null
}

function breakLines(
  periods: readonly DrivingBreakPeriod[],
  activities: readonly DayDrivingActivity[],
  clockMode: ClockMode,
  duration: (ms: number) => string,
): { breaks: string[]; lengths: string[]; ranges: string[] } {
  const breaks: string[] = []
  const lengths: string[] = []
  const ranges: string[] = []
  for (const period of periods) {
    if (period.qualifyingBreak == null) continue
    for (const [startUtc, endUtc] of breakWindows(period.qualifyingBreak, activities)) {
      const length = duration(endUtc - startUtc)
      const range = rangeText(startUtc, endUtc, clockMode)
      lengths.push(length)
      ranges.push(range)
      breaks.push(`${length} (${range})`)
    }
  }
  return { breaks, lengths, ranges }
}

function breakSpans(item: QualifyingDrivingBreak, activities: readonly DayDrivingActivity[]): Array<[number, number]> {
  const ids = new Set(item.sourceActivityIds)
  const rests = activities
    .filter((activity) => ids.has(activity.id) && activity.kind === 'rest' && activity.endUtc > activity.startUtc)
    .map((activity) => [activity.startUtc, activity.endUtc] as [number, number])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1])
  const merged: Array<[number, number]> = []
  for (const [startUtc, endUtc] of rests) {
    const last = merged[merged.length - 1]
    if (last != null && startUtc <= last[1]) last[1] = Math.max(last[1], endUtc)
    else merged.push([startUtc, endUtc])
  }
  return merged.length > 0 ? merged : [[item.startUtc, item.completedAtUtc]]
}

/** U odpočinku delšího než 24 hodin zobrazí jen úsek, kterým se přestávka dokončila. */
function breakWindows(item: QualifyingDrivingBreak, activities: readonly DayDrivingActivity[]): Array<[number, number]> {
  const windows: Array<[number, number]> = []
  for (const [startUtc, endUtc] of breakSpans(item, activities)) {
    if (endUtc - startUtc <= CYCLE_REST_MS) {
      pushWindow(windows, startUtc, endUtc)
      continue
    }
    const clipStart = Math.max(startUtc, item.startUtc)
    const clipEnd = Math.min(endUtc, item.completedAtUtc)
    if (clipEnd > clipStart && clipEnd - clipStart <= CYCLE_REST_MS) pushWindow(windows, clipStart, clipEnd)
  }
  return windows
}

function pushWindow(windows: Array<[number, number]>, startUtc: number, endUtc: number) {
  if (windows.some((window) => window[0] === startUtc && window[1] === endUtc)) return
  windows.push([startUtc, endUtc])
}

function rangeText(startUtc: number, endUtc: number, clockMode: ClockMode): string {
  const start = clockParts(startUtc, clockMode)
  const end = clockParts(endUtc, clockMode)
  const sameDay = start.day === end.day && start.month === end.month && start.year === end.year
  if (sameDay) return `${formatClockTime(startUtc, clockMode)}–${formatClockTime(endUtc, clockMode)}`
  return `${formatClockDateTime(startUtc, clockMode)}–${formatClockDateTime(endUtc, clockMode)}`
}

function evaluated(periods: readonly DrivingBreakPeriod[]): DrivingBreakPeriod[] {
  return periods.filter((period) => period.status !== 'insufficient_data')
}

function dailyRows(
  periods: readonly DailyDrivingPeriod[],
  activities: readonly DayDrivingActivity[],
  dayStartUtc: number,
  dayEndUtc: number,
  clockMode: ClockMode,
  text: DayDrivingText,
  duration: (ms: number) => string,
): DayDrivingRow[] {
  const overlapping = periods.filter((period) => overlaps(period.startUtc, period.endUtc ?? Number.POSITIVE_INFINITY, dayStartUtc, dayEndUtc))
  const dayHasDriving = activities.some(
    (activity) => activity.kind === 'driving' && overlaps(activity.startUtc, activity.endUtc, dayStartUtc, dayEndUtc),
  )
  if (overlapping.length === 0) {
    if (!dayHasDriving) return []
    return [undecidedDailyRow(text.periodLabel, text)]
  }
  return overlapping.map((period, index) => {
    const label = overlapping.length === 1 ? text.periodLabel : `${text.periodLabel} ${index + 1}`
    const shown = drivingDisplay(period, clockMode, text, duration)
    return {
      label,
      primary: shown.primary,
      detail: shown.detail,
      value: `${shown.primary}. ${shown.status.text}`,
      tone: shown.status.tone,
      statusText: shown.status.text,
      mark: shown.status.mark,
      rule: 'article_6' as const,
      presentation: 'status' as const,
    }
  })
}

type LengthBand = 'up_to_9h' | 'over_9h_up_to_10h' | 'over_10h'
type DrivingStamp = { text: string; tone: DayDrivingTone; mark: DayDrivingMark }

function drivingDisplay(
  period: DailyDrivingPeriod,
  clockMode: ClockMode,
  text: DayDrivingText,
  duration: (ms: number) => string,
): { primary: string; detail: string | null; status: DrivingStamp } {
  const alternatives = [...period.boundaryAlternatives].sort((left, right) => left.closingStartUtc - right.closingStartUtc)
  const span = period.drivingSpanMs
  if (alternatives.length > 1 && span != null) {
    const primary = span.lowMs === span.highMs ? duration(span.lowMs) : `${duration(span.lowMs)} – ${duration(span.highMs)}`
    const bands = alternatives.map((alternative) => lengthBand(alternative.drivingMs))
    const shared = bands[0] != null && bands.every((band) => band === bands[0])
    if (shared && bands[0] != null) {
      const lines = alternatives.map((alternative) => `${rangeText(period.startUtc, alternative.closingStartUtc, clockMode)}: ${duration(alternative.drivingMs)}`)
      return { primary, detail: lines.join('; '), status: lengthStamp(bands[0], false, text) }
    }
    const lines = alternatives.map((alternative) => {
      const band = lengthBand(alternative.drivingMs)
      return `${rangeText(period.startUtc, alternative.closingStartUtc, clockMode)}: ${duration(alternative.drivingMs)}, ${bandPhrase(band, text)}`
    })
    return {
      primary,
      detail: fill(text.variantsDiffer, { lines: lines.join('; ') }),
      status: unknownStamp(text),
    }
  }
  if (alternatives.length > 1 && period.uncertainties.includes('unknown_interval')) {
    return {
      primary: '—',
      detail: text.unknownSpan,
      status: unknownStamp(text),
    }
  }
  const status = singleStamp(period, text)
  const primary = period.drivingMs == null ? '—' : duration(period.drivingMs)
  const endUtc = period.endUtc
  const range = endUtc == null ? fill(text.fromTime, { time: formatClockDateTime(period.startUtc, clockMode) }) : rangeText(period.startUtc, endUtc, clockMode)
  const open = !period.closed && period.uncertainties.includes('closing_rest_missing') && status.text !== text.unknownPeriod
  return {
    primary,
    detail: open ? fill(text.soFarOpen, { range }) : range,
    status,
  }
}

function singleStamp(period: DailyDrivingPeriod, text: DayDrivingText): DrivingStamp {
  if (period.result !== 'up_to_9h' && period.result !== 'over_9h_up_to_10h' && period.result !== 'over_10h') return unknownStamp(text)
  return lengthStamp(period.result, !period.closed && period.result === 'up_to_9h', text)
}

function lengthStamp(band: LengthBand, openUnderNine: boolean, text: DayDrivingText): DrivingStamp {
  if (band === 'up_to_9h') {
    return openUnderNine
      ? { text: text.regular, tone: 'clear', mark: 'open' }
      : { text: text.regular, tone: 'clear', mark: 'check' }
  }
  if (band === 'over_9h_up_to_10h') return { text: text.extended, tone: 'caution', mark: 'alarm' }
  return { text: text.exceeded, tone: 'exceeded', mark: 'alert' }
}

function unknownStamp(text: DayDrivingText): DrivingStamp {
  return { text: text.unknownPeriod, tone: 'undecided', mark: 'unknown' }
}

function bandPhrase(band: LengthBand, text: DayDrivingText): string {
  if (band === 'up_to_9h') return text.upTo9h
  if (band === 'over_9h_up_to_10h') return text.over9to10
  return text.over10h
}

function lengthBand(durationMs: number): 'up_to_9h' | 'over_9h_up_to_10h' | 'over_10h' {
  if (durationMs <= NINE_HOURS) return 'up_to_9h'
  if (durationMs <= TEN_HOURS) return 'over_9h_up_to_10h'
  return 'over_10h'
}

function undecidedDailyRow(label: string, text: DayDrivingText): DayDrivingRow {
  return {
    label,
    primary: '—',
    detail: null,
    value: `—. ${text.unknownPeriod}`,
    tone: 'undecided',
    statusText: text.unknownPeriod,
    mark: 'unknown',
    rule: 'article_6',
    presentation: 'status',
  }
}

function dailyDrivingPeriods(activities: readonly DayDrivingActivity[]): DailyDrivingPeriod[] {
  const mapped = activities.map(toActivity)
  const unknownIntervals = mapped
    .filter((activity) => activity.kind === 'unknown')
    .map((activity) => ({ startUtc: activity.startUtc, endUtc: activity.endUtc }))
  const candidates = classifyRestCandidates(findRestIntervals(mapped))
  const anchorUtc = candidates
    .filter((candidate) => candidate.established && candidate.durationMs >= ELEVEN_HOURS)
    .filter((candidate) => !unknownIntervals.some((interval) => overlaps(candidate.startUtc, candidate.endUtc, interval.startUtc, interval.endUtc)))
    .sort((left, right) => left.startUtc - right.startUtc || left.endUtc - right.endUtc)[0]?.endUtc
  if (anchorUtc == null) return []
  const recordEndUtc = recordSpan(activities)?.endUtc ?? null
  const chain = buildDailyRestChain(anchorUtc, candidates, unknownIntervals, recordEndUtc, mapped)
  return assessDailyDrivingTime({ activities: mapped, candidates, chains: [chain] })
}

function toActivity(activity: DayDrivingActivity): Activity {
  return {
    id: activity.id,
    kind: activity.kind,
    startUtc: activity.startUtc,
    endUtc: activity.endUtc,
    durationMinutes: Math.round((activity.endUtc - activity.startUtc) / 60_000),
    isCrew: activity.isCrew === true,
    slot: 1,
  }
}

function recordSpan(activities: readonly DayDrivingActivity[]): { startUtc: number; endUtc: number } | null {
  if (activities.length === 0) return null
  return {
    startUtc: Math.min(...activities.map((activity) => activity.startUtc)),
    endUtc: Math.max(...activities.map((activity) => activity.endUtc)),
  }
}

function overlaps(startUtc: number, endUtc: number, otherStartUtc: number, otherEndUtc: number): boolean {
  return startUtc < otherEndUtc && otherStartUtc < endUtc
}
