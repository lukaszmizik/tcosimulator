/**
 * Načtení výpisu karty řidiče stejnou cestou jako Tacho Viewer.
 */

import { parseDddBinary } from 'tacho-viewer-ddd-parser'
import { mapDddParserJson, type DddParsedCard } from 'tacho-viewer-ddd-mapper'

export async function loadDriverCardFromDdd(bytes: Uint8Array): Promise<DddParsedCard> {
  const parsed = await parseDddBinary(bytes)
  return mapDddParserJson(parsed)
}
