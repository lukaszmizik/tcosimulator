/**
 * Převod parsovaných dat z TXT do formátu simulátoru (karta 1).
 */

import type { ActivityHistoryEntry, ManualEntrySegment, SecondActivitySnapshot } from './TachoTypes'
import { NO_CARD } from './TachoTypes'
import { CARD1_TEMPLATE_ID } from './data/card1_write_data'
import type { ParseWorkWeekResult, ActivityType } from './workWeekTxtParser'
import { parseTimeAndDate } from './workWeekTxtParser'

const TYPE_TO_KIND: Record<ActivityType, ActivityHistoryEntry['driver1']> = {
  řízení: 'driving',
  práce: 'otherWork',
  pohotovost: 'availability',
  odpočinek: 'rest',
  'odpočinek>24h': 'rest',
  'odpočinek>45h': 'rest',
  neznámá: 'rest',
}

function markerToSegment(m: { activityId: 'START_COUNTRY' | 'END_COUNTRY'; countryCode: string; timeStr: string; dateStr: string }): ManualEntrySegment {
  const ms = parseTimeAndDate(m.timeStr, m.dateStr)
  const d = new Date(ms)
  return {
    activityId: m.activityId,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    countryCode: m.countryCode,
  }
}

function floorToMinute(ms: number): number {
  return Math.floor(ms / 60000) * 60000
}

export type SimulatorUploadResult = {
  activityHistory: ActivityHistoryEntry[]
  manualEntryBuffer: ManualEntrySegment[]
  secondHistory: SecondActivitySnapshot[]
  lastMs: number
}

/**
 * Převede parsovaná data z TXT na formát simulátoru pro kartu 1.
 */
export function parsedToSimulatorData(parsed: ParseWorkWeekResult): SimulatorUploadResult {
  const { activities, countryMarkers } = parsed
  const activityHistory: ActivityHistoryEntry[] = []
  const secondHistory: SecondActivitySnapshot[] = []
  let baseSpeed = 65

  for (const act of activities) {
    const kind = TYPE_TO_KIND[act.type]
    const minutes = Math.floor((act.endMs - act.startMs) / 60000)
    const isDriving = kind === 'driving'

    for (let m = 0; m < minutes; m++) {
      const minuteStartUtc = floorToMinute(act.startMs + m * 60000)
      activityHistory.push({
        minuteStartUtc,
        driver1: kind,
        driver2: 'none',
        driver1CardId: CARD1_TEMPLATE_ID,
        driver2CardId: NO_CARD,
      })

      for (let sec = 0; sec < 60; sec++) {
        const timestampUtc = minuteStartUtc + sec * 1000
        const speed = isDriving ? Math.max(0, Math.min(125, baseSpeed + Math.floor(Math.random() * 17) - 8)) : 0
        if (isDriving && sec % 10 === 0) baseSpeed = Math.max(40, Math.min(95, baseSpeed + Math.floor(Math.random() * 11) - 5))
        secondHistory.push({
          timestampUtc,
          driver1: kind,
          driver2: 'none',
          speed,
        })
      }
    }
  }

  activityHistory.sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)

  const manualEntryBuffer: ManualEntrySegment[] = countryMarkers.map(markerToSegment)
  const lastMs = activityHistory.length > 0 ? activityHistory[activityHistory.length - 1]!.minuteStartUtc + 60000 : 0

  return { activityHistory, manualEntryBuffer, secondHistory, lastMs }
}
