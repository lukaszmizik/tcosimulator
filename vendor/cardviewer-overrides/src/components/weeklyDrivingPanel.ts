import { assessWeeklyDrivingTime, WEEKLY_DRIVING_LIMIT_MS, type WeeklyDrivingTime } from '../analysis/weeklyDrivingTime.ts'
import { formatClockDateTime } from '../lib/clock.ts'
import type { Activity } from '../types/tacho.ts'
import { cs, fill, formatDuration, type WeeklyDrivingText } from '../translations.ts'

export type WeeklyDrivingPanel = {
  title: string
  rangeText: string
  valueText: string
  /** Podíl známého součtu vůči 56 h, nejvýše 1. */
  fill: number
  tone: 'fill' | 'over'
  notes: string[]
  result: WeeklyDrivingTime
}

/**
 * Průběžný součet od pondělí 00:00 UTC do konce vybraného kalendářního dne.
 * Stejná funkce jako celý týden, jen s řezem na konci dne.
 */
export function buildWeeklyDrivingPanel(input: {
  activities: readonly Activity[]
  dayEndUtc: number
  text?: WeeklyDrivingText
  hourUnit?: string
  minuteUnit?: string
}): WeeklyDrivingPanel {
  const text = input.text ?? cs.workWeek.weeklyDriving
  const result = assessWeeklyDrivingTime({
    activities: input.activities,
    weekStartUtc: input.dayEndUtc - 1,
    untilUtc: input.dayEndUtc,
  })
  const notes = [text.fillNote]
  if (result.status === 'over_56h') notes.unshift(text.overNote)
  if (!result.dataComplete) notes.unshift(text.openNote)
  const duration = formatDuration(result.drivingMs, input.hourUnit ?? cs.workWeek.hourUnit, input.minuteUnit ?? cs.workWeek.minuteUnit)
  return {
    title: text.title,
    rangeText: `${formatClockDateTime(result.weekStartUtc, 'utc')}–${formatClockDateTime(result.weekEndUtc, 'utc')} UTC`,
    valueText: fill(text.limitValue, { duration }),
    fill: Math.min(1, result.drivingMs / WEEKLY_DRIVING_LIMIT_MS),
    tone: result.status === 'over_56h' ? 'over' : 'fill',
    notes,
    result,
  }
}

