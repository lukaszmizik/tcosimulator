import { assessFortnightDrivingTime, type FortnightDrivingTime } from '../analysis/fortnightDrivingTime.ts'
import { utcWeekStart } from '../analysis/dailyDrivingTime.ts'
import { formatClockDateTime } from '../lib/clock.ts'
import type { Activity } from '../types/tacho.ts'
import { cs, fill, formatDuration, type FortnightDrivingText } from '../translations.ts'

export type FortnightDrivingRow = {
  title: string
  rangeText: string
  valueText: string
  statusText: string
  tone: 'clear' | 'over' | 'open'
  notes: string[]
  result: FortnightDrivingTime
}

/**
 * Průběžný součet předchozího týdne a aktuálního týdne do konce vybraného dne.
 * `within_90h` nastane jen u uzavřeného a úplného dvoutýdenního období.
 */
export function buildFortnightDrivingRow(input: {
  activities: readonly Activity[]
  dayEndUtc: number
  text?: FortnightDrivingText
  hourUnit?: string
  minuteUnit?: string
}): FortnightDrivingRow {
  const text = input.text ?? cs.workWeek.fortnightDriving
  const hourUnit = input.hourUnit ?? cs.workWeek.hourUnit
  const minuteUnit = input.minuteUnit ?? cs.workWeek.minuteUnit
  const result = assessFortnightDrivingTime({
    activities: input.activities,
    laterWeekStartUtc: utcWeekStart(input.dayEndUtc - 1),
    untilUtc: input.dayEndUtc,
  })
  const notes: string[] = []
  if (!result.fortnightClosed && result.status !== 'over_90h') notes.push(text.progressNote)
  if (!result.dataComplete) notes.push(text.openNote)
  const duration = formatDuration(result.drivingMs, hourUnit, minuteUnit)
  return {
    title: text.title,
    rangeText: `${weekText(result.earlierWeekStartUtc, result.laterWeekStartUtc)} ${text.weeksJoiner} ${weekText(result.laterWeekStartUtc, result.periodEndUtc)} UTC`,
    valueText: fill(text.limitValue, { duration }),
    statusText: statusLabel(result, text),
    tone: result.status === 'over_90h' ? 'over' : result.status === 'within_90h' ? 'clear' : 'open',
    notes,
    result,
  }
}

function weekText(startUtc: number, endUtc: number): string {
  return `${formatClockDateTime(startUtc, 'utc')}–${formatClockDateTime(endUtc, 'utc')}`
}

function statusLabel(result: FortnightDrivingTime, text: FortnightDrivingText): string {
  if (result.status === 'over_90h') return text.over90
  if (result.status === 'insufficient_data') return text.cannotConfirm
  if (result.status === 'within_90h') return text.within90
  if (result.dataComplete) return text.runningTotal
  return text.incomplete
}
