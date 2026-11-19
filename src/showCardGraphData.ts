/**
 * Sestavení dat grafu z aktuálních karet. Funkce nic nezapisuje.
 */

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

function buildSlot(input: ShowCardGraphInput, card: CardData, slot: 1 | 2) {
  const ids = new Set([card.templateId, card.cardNumber].filter((id): id is string => Boolean(id)))
  const minutes = new Map<number, ActivityHistoryEntry>()
  const currentDriver = slot === 1 ? 'driver1' : 'driver2'

  function collect(entries: ActivityHistoryEntry[], owned: boolean) {
    for (const entry of entries) {
      const { driver1CardId, driver2CardId } = entry
      let kind = entry[currentDriver]
      if (driver1CardId && ids.has(driver1CardId)) kind = entry.driver1
      else if (driver2CardId && ids.has(driver2CardId)) kind = entry.driver2
      else if (!owned || driver1CardId != null || driver2CardId != null) continue
      // Starší záznam bez identifikátorů lze převzít jen z vlastní historie karty.
      minutes.set(entry.minuteStartUtc, { ...entry, [currentDriver]: kind })
    }
  }

  collect(input.activityHistory, false)
  if (card.templateId) collect(input.cardActivityHistoryByTemplateId[card.templateId] ?? [], true)
  const history = [...minutes.values()].sort((a, b) => a.minuteStartUtc - b.minuteStartUtc)
  const manual = slot === 1 ? input.driver1ManualEntryBuffer : input.driver2ManualEntryBuffer
  const lastWithdrawalUtc = card.lastWithdrawal

  let data: ReturnType<typeof simulatorToGraphData>
  try {
    data = simulatorToGraphData(history, manual, slot, {
      lastWithdrawalMs: lastWithdrawalUtc,
      insertionTimeMs: input.refMs,
    })
  } catch {
    data = parseWorkWeekTxt(workWeekToTxtString(history, manual, slot))
  }
  return {
    days: expandToWeeksContainingData(activitiesByDay(data.activities), input.refMs),
    countryMarkers: data.countryMarkers,
    manualEntryBuffer: manual,
    lastWithdrawalUtc,
  }
}

export function buildShowCardGraphData(input: ShowCardGraphInput): CardGraphData {
  const first = input.card1Data ? buildSlot(input, input.card1Data, 1) : { days: [], countryMarkers: [] }
  return {
    ...first,
    card2Data: input.card2Data ? buildSlot(input, input.card2Data, 2) : undefined,
  }
}
