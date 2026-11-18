/**
 * Sestavení dat grafu z aktuálních karet. Funkce nic nezapisuje.
 */

import { CARD1_TEMPLATE_ID } from './data/card1_write_data'
import { CARD2_TEMPLATE_ID } from './data/card2_write_data'
import type { ActivityHistoryEntry, CardData, ManualEntrySegment } from './TachoTypes'
import { simulatorToGraphData, workWeekToTxtString } from './workWeekExportTxt'
import {
  activitiesByDay,
  expandToWeeksContainingData,
  parseWorkWeekTxt,
  type CountryMarker,
  type DayData,
} from './workWeekTxtParser'

export type CardGraphData = {
  days: DayData[]
  countryMarkers: CountryMarker[]
  manualEntryBuffer?: ManualEntrySegment[]
  lastWithdrawalUtc?: number | null
  card2Data?: {
    days: DayData[]
    countryMarkers: CountryMarker[]
    manualEntryBuffer?: ManualEntrySegment[]
    lastWithdrawalUtc?: number | null
  }
}

export type ShowCardGraphInput = {
  activityHistory: ActivityHistoryEntry[]
  cardActivityHistoryByTemplateId: Record<string, ActivityHistoryEntry[]>
  driver1ManualEntryBuffer: ManualEntrySegment[]
  driver2ManualEntryBuffer: ManualEntrySegment[]
  card1Data: CardData | null
  card2Data: CardData | null
  card1StoredLastWithdrawal: number | null
  card2StoredLastWithdrawal: number | null
  refMs: number
}

export function buildShowCardGraphData(input: ShowCardGraphInput): CardGraphData {
  const {
    activityHistory,
    cardActivityHistoryByTemplateId,
    driver1ManualEntryBuffer,
    driver2ManualEntryBuffer,
    card1Data,
    card2Data,
    card1StoredLastWithdrawal,
    card2StoredLastWithdrawal,
    refMs,
  } = input

  try {
    const insertionTimeMs = refMs

    const historyFor = (id: string, slot: 1 | 2) => {
      const history = cardActivityHistoryByTemplateId[id]
      if (!history) return activityHistory
      return history.map(entry => {
        const recorded = entry.driver1CardId === id ? entry.driver1
          : entry.driver2CardId === id ? entry.driver2
          : slot === 1 ? entry.driver1 : entry.driver2
        return slot === 1 ? { ...entry, driver1: recorded } : { ...entry, driver2: recorded }
      })
    }
    const tid1 = card1Data?.templateId ?? CARD1_TEMPLATE_ID
    const tid2 = card2Data?.templateId ?? CARD2_TEMPLATE_ID
    const card1History = historyFor(tid1, 1)
    const { activities, countryMarkers: rawCountryMarkers } = simulatorToGraphData(card1History, driver1ManualEntryBuffer, 1, {
      lastWithdrawalMs: card1Data ? card1Data.lastWithdrawal : card1StoredLastWithdrawal,
      insertionTimeMs,
    })
    const lastWithdraw = card1Data ? card1Data.lastWithdrawal : card1StoredLastWithdrawal
    const days = activitiesByDay(activities)
    const refForExpand = activities.length > 0 ? Math.min(...activities.map((a) => a.startMs)) : refMs
    const daysToShow = expandToWeeksContainingData(days, refForExpand)

    let card2GraphData: CardGraphData['card2Data']
    try {
      const card2History = historyFor(tid2, 2)
      const { activities: activities2, countryMarkers: countryMarkers2 } = simulatorToGraphData(card2History, driver2ManualEntryBuffer, 2, {
        lastWithdrawalMs: card2Data ? card2Data.lastWithdrawal : card2StoredLastWithdrawal,
        insertionTimeMs,
      })
      const days2 = activitiesByDay(activities2)
      const lastWithdraw2 = card2Data ? card2Data.lastWithdrawal : card2StoredLastWithdrawal
      const ref2 = activities2.length > 0 ? Math.min(...activities2.map((a) => a.startMs)) : refMs
      const daysToShow2 = expandToWeeksContainingData(days2, ref2)
      card2GraphData = { days: daysToShow2, countryMarkers: countryMarkers2, manualEntryBuffer: driver2ManualEntryBuffer, lastWithdrawalUtc: lastWithdraw2 }
    } catch {
      card2GraphData = undefined
    }

    return { days: daysToShow, countryMarkers: rawCountryMarkers, manualEntryBuffer: driver1ManualEntryBuffer, lastWithdrawalUtc: lastWithdraw, card2Data: card2GraphData }
  } catch {
    const txt = workWeekToTxtString(activityHistory, driver1ManualEntryBuffer, 1)
    const parsed = parseWorkWeekTxt(txt)
    const days = activitiesByDay(parsed.activities)
    const lastWithdraw = card1Data ? card1Data.lastWithdrawal : card1StoredLastWithdrawal
    const refFallback = parsed.activities.length > 0 ? Math.min(...parsed.activities.map((a) => a.startMs)) : refMs
    const daysToShow = expandToWeeksContainingData(days, refFallback)

    let card2GraphData: CardGraphData['card2Data']
    try {
      const txt2 = workWeekToTxtString(activityHistory, driver2ManualEntryBuffer, 2)
      const parsed2 = parseWorkWeekTxt(txt2)
      const days2 = activitiesByDay(parsed2.activities)
      const ref2Fallback = parsed2.activities.length > 0 ? Math.min(...parsed2.activities.map((a) => a.startMs)) : refMs
      const daysToShow2 = expandToWeeksContainingData(days2, ref2Fallback)
      card2GraphData = { days: daysToShow2, countryMarkers: parsed2.countryMarkers, manualEntryBuffer: driver2ManualEntryBuffer, lastWithdrawalUtc: card2Data ? card2Data.lastWithdrawal : card2StoredLastWithdrawal }
    } catch {
      card2GraphData = undefined
    }

    return { days: daysToShow, countryMarkers: parsed.countryMarkers, manualEntryBuffer: driver1ManualEntryBuffer, lastWithdrawalUtc: lastWithdraw, card2Data: card2GraphData }
  }
}
