/**
 * Načtení výpisu karty řidiče stejnou cestou jako Tacho Viewer.
 */

import { parseDddBinary } from 'tacho-viewer-ddd-parser'
import { mapDddParserJson, type DddParsedCard } from 'tacho-viewer-ddd-mapper'

type DailyRecord = {
  activity_record_date?: string | null
  activity_daily_presence_counter?: number | null
  activity_day_distance?: number | null
}
type ControlRecord = {
  control_time?: string | null
  control_card_number?: { card_number?: string }
}
type DddPrintFields = {
  driver_card_application_identification_v2?: { length_of_following_data?: number }
  driver_card_application_identification_2?: { type_of_tachograph_card_id?: number }
  driver_card_application_identification_1?: { type_of_tachograph_card_id?: number }
  card_driver_activity_1?: { decoded_activity_daily_records?: DailyRecord[] }
  card_driver_activity_2?: { decoded_activity_daily_records?: DailyRecord[] }
  card_control_activity_data_record_1?: ControlRecord
  card_control_activity_data_record_2?: ControlRecord
}

export function extractDddPrintFields(raw: DddPrintFields): Pick<DddParsedCard, 'generation' | 'printDays' | 'printLastControl'> {
  const printDays: NonNullable<DddParsedCard['printDays']> = {}
  for (const block of [raw.card_driver_activity_1, raw.card_driver_activity_2]) {
    for (const record of block?.decoded_activity_daily_records ?? []) {
      const atUtc = Date.parse(record.activity_record_date ?? '')
      if (!Number.isFinite(atUtc)) continue
      const key = new Date(atUtc).toISOString().slice(0, 10)
      const presence = record.activity_daily_presence_counter
      const distance = record.activity_day_distance
      printDays[key] = {
        ...printDays[key],
        ...(presence != null && presence >= 0 && presence <= 9999 ? { presence } : {}),
        ...(distance != null && distance >= 0 && distance < 0xffff ? { distance } : {}),
      }
    }
  }
  const controls = [raw.card_control_activity_data_record_2, raw.card_control_activity_data_record_1].flatMap((record) => {
    const atUtc = Date.parse(record?.control_time ?? '')
    const cardNumber = record?.control_card_number?.card_number?.replace(/\0/g, '').trim()
    return cardNumber && Number.isFinite(atUtc) && atUtc > 0
      ? [{ atUtc, cardNumber }] : []
  })
  controls.sort((a, b) => b.atUtc - a.atUtc)
  const generation = raw.driver_card_application_identification_v2?.length_of_following_data
    ? 'GEN2 v2' : raw.driver_card_application_identification_2?.type_of_tachograph_card_id
      ? 'GEN2' : raw.driver_card_application_identification_1?.type_of_tachograph_card_id ? 'GEN1' : undefined
  return { generation, printDays, printLastControl: controls[0] }
}

export async function loadDriverCardFromDdd(bytes: Uint8Array): Promise<DddParsedCard> {
  const parsed = await parseDddBinary(bytes)
  const mapped = mapDddParserJson(parsed)
  const root = parsed as DddPrintFields & { card?: DddPrintFields; Card?: DddPrintFields }
  const fields = extractDddPrintFields(root.card ?? root.Card ?? root)
  return {
    ...mapped,
    generation: fields.generation ?? mapped.generation,
    printDays: { ...mapped.printDays, ...fields.printDays },
    printLastControl: fields.printLastControl ?? mapped.printLastControl,
  }
}
