/**
 * Export vygenerovaného pracovního týdne do TXT souboru.
 * Formát: začátky/konce směn ----CZ---- HH:MM DD.MM.RRRR, aktivity (typ) HH:MM - HH:MM (součet)
 */

import type { ActivityHistoryEntry, ManualEntrySegment } from './TachoTypes'
import type { ParsedActivity, CountryMarker, ActivityType } from './workWeekTxtParser'
import { segmentToMsUtc } from './CardLogic'

function msToTime(ms: number): string {
  const d = new Date(ms)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function msToDate(ms: number): string {
  const d = new Date(ms)
  const day = d.getUTCDate()
  const month = d.getUTCMonth() + 1
  const year = d.getUTCFullYear()
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Značka překročení půlnoci – vloží se mezi části aktivity rozdělené na hranici dne */
const MIDNIGHT_MARKER = '----*----'

/**
 * Přidá do lines blok aktivity, při překročení půlnoci vloží značku ----*---- 00:00 DD.MM.RRRR
 */
function emitActivityBlock(
  lines: string[],
  startMs: number,
  endMs: number,
  label: string
): void {
  let cursor = startMs
  while (cursor < endMs) {
    const d = new Date(cursor)
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    const nextMidnight = dayStart + 24 * 3600 * 1000
    const segEnd = Math.min(endMs, nextMidnight)
    const mins = Math.round((segEnd - cursor) / 60000)
    if (mins > 0) {
      lines.push(`(${label}) ${msToTime(cursor)} - ${msToTime(segEnd)} (${formatDuration(mins)})`)
    }
    cursor = segEnd
    if (cursor < endMs) {
      lines.push(`${MIDNIGHT_MARKER} 00:00 ${msToDate(cursor)}`)
    }
  }
}

const KIND_TO_ACTIVITY_TYPE: Record<string, ActivityType> = {
  driving: 'řízení',
  rest: 'odpočinek',
  otherWork: 'práce',
  availability: 'pohotovost',
}

const EDITOR_ACTIVITY_TO_TYPE: Record<string, ActivityType> = {
  REST: 'odpočinek',
  WORK: 'práce',
  AVAILABILITY: 'pohotovost',
  UNKNOWN: 'neznámá',
}

/** Label pro export do TXT (v závorkách u aktivit) */
const TYPE_TO_EXPORT_LABEL: Partial<Record<ActivityType, string>> = {
  neznámá: 'neznámá činnost',
}

/** Určí displayType pro odpočinek podle délky: odpočinek | odpočinek>24h (Zkrácená TDO) | odpočinek>45h (Řádná TDO) */
function restDisplayType(durationMinutes: number): ActivityType {
  if (durationMinutes >= 45 * 60) return 'odpočinek>45h'
  if (durationMinutes > 24 * 60) return 'odpočinek>24h'
  return 'odpočinek'
}

function msToDateStr(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
}

/**
 * Převede data simulátoru na formát grafu (aktivity + značky zemí).
 * Manuálně zadané segmenty mají isManualEntry: true.
 * @param options.lastWithdrawalMs - čas posledního vytažení karty
 * @param options.insertionTimeMs - čas vložení karty (když má buffer jen 1 segment, blok se prodluží do tohoto času)
 */
export function simulatorToGraphData(
  activityHistory: ActivityHistoryEntry[],
  manualEntryBuffer: ManualEntrySegment[],
  slotIndex: 1 | 2,
  options?: { lastWithdrawalMs?: number | null; insertionTimeMs?: number }
): { activities: ParsedActivity[]; countryMarkers: CountryMarker[] } {
  const driverKey = slotIndex === 1 ? 'driver1' : 'driver2' as const
  const activities: ParsedActivity[] = []

  // První blok z manuálu: když je v bufferu jen 1 segment (začátek bloku), vytvoř blok do insertion time.
  // Jen když není activityHistory – jinak by přepsal jízdu/ostatní aktivity (modrá čára místo červené).
  const nonCountryManual = manualEntryBuffer.filter((s) => s.activityId !== 'START_COUNTRY' && s.activityId !== 'END_COUNTRY')
  if (nonCountryManual.length === 1 && options?.insertionTimeMs && activityHistory.length === 0) {
    const seg = nonCountryManual[0]!
    const startMs = segmentToMsUtc(seg)
    const endMs = options.insertionTimeMs
    if (endMs > startMs) {
      const type = EDITOR_ACTIVITY_TO_TYPE[seg.activityId] ?? 'odpočinek'
      const durationMinutes = Math.round((endMs - startMs) / 60000)
      const displayType = type === 'odpočinek' ? restDisplayType(durationMinutes) : type
      activities.push({
        type: displayType,
        startMs,
        endMs,
        durationMinutes,
        originalDurationMinutes: durationMinutes,
        isManualEntry: seg.isManualEntry ?? false,
      })
    }
  }

  // Bloky z activityHistory
  let i = 0
  while (i < activityHistory.length) {
    const e = activityHistory[i]!
    const kind = e[driverKey]
    if (kind !== 'driving' && kind !== 'rest' && kind !== 'otherWork' && kind !== 'availability') {
      i++
      continue
    }
    const type = KIND_TO_ACTIVITY_TYPE[kind] ?? 'odpočinek'
    const startMs = e.minuteStartUtc
    let endMs = startMs + 60000
    while (i + 1 < activityHistory.length && activityHistory[i + 1]![driverKey] === kind) {
      i++
      endMs = activityHistory[i]!.minuteStartUtc + 60000
    }
    const durationMinutes = Math.round((endMs - startMs) / 60000)
    const durRest = durationMinutes > 24 * 60 ? durationMinutes : undefined
    const displayType = type === 'odpočinek' ? restDisplayType(durationMinutes) : type
    activities.push({
      type: displayType,
      startMs,
      endMs,
      durationMinutes,
      originalDurationMinutes: durRest ?? durationMinutes,
      isManualEntry: false,
      gpsLocation: e.gpsLocation,
    })
    i++
  }

  // Bloky z manuálního zadání – každý pár (seg, next) definuje blok od seg do next
  // Razítka země (START_COUNTRY/END_COUNTRY) jsou jen časové body – nevytváříme z nich bloky aktivit
  for (let j = 0; j < manualEntryBuffer.length - 1; j++) {
    const seg = manualEntryBuffer[j]!
    const next = manualEntryBuffer[j + 1]!
    const startMs = segmentToMsUtc(seg)
    const endMs = segmentToMsUtc(next)
    if (endMs <= startMs) continue
    const segIsCountry = seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY'
    const nextIsCountry = next.activityId === 'START_COUNTRY' || next.activityId === 'END_COUNTRY'
    if (segIsCountry || nextIsCountry) continue // Žádný blok před/za razítkem – jen časové body
    const activityId = segIsCountry
      ? (nextIsCountry ? 'REST' : next.activityId)
      : seg.activityId
    const type = EDITOR_ACTIVITY_TO_TYPE[activityId] ?? 'odpočinek'
    const durationMinutes = Math.round((endMs - startMs) / 60000)
    const displayType = type === 'odpočinek' ? restDisplayType(durationMinutes) : type
    activities.push({
      type: displayType,
      startMs,
      endMs,
      durationMinutes,
      originalDurationMinutes: durationMinutes,
      isManualEntry: (segIsCountry ? next : seg).isManualEntry ?? false,
    })
  }

  // Sloučení – manuální má přednost při překryvu
  activities.sort((a, b) => a.startMs - b.startMs)
  const merged: ParsedActivity[] = []
  for (const block of activities) {
    if (block.isManualEntry) {
      const nextMerged: ParsedActivity[] = []
      for (const m of merged) {
        if (m.endMs <= block.startMs || m.startMs >= block.endMs) {
          nextMerged.push(m)
        } else {
          if (m.startMs < block.startMs) {
            nextMerged.push({
              ...m,
              endMs: block.startMs,
              durationMinutes: Math.round((block.startMs - m.startMs) / 60000),
              originalDurationMinutes: Math.round((block.startMs - m.startMs) / 60000),
            })
          }
          if (m.endMs > block.endMs) {
            nextMerged.push({
              ...m,
              startMs: block.endMs,
              durationMinutes: Math.round((m.endMs - block.endMs) / 60000),
              originalDurationMinutes: Math.round((m.endMs - block.endMs) / 60000),
            })
          }
        }
      }
      nextMerged.push({ ...block })
      nextMerged.sort((a, b) => a.startMs - b.startMs)
      merged.length = 0
      merged.push(...nextMerged)
    } else {
      const last = merged[merged.length - 1]
      if (last && last.endMs === block.startMs && last.type === block.type && last.isManualEntry === block.isManualEntry) {
        last.endMs = block.endMs
        last.durationMinutes = Math.round((last.endMs - last.startMs) / 60000)
        last.originalDurationMinutes = last.durationMinutes
      } else {
        merged.push({ ...block })
      }
    }
  }

  // Značky zemí
  const countrySegments = manualEntryBuffer.filter(
    (s) => s.activityId === 'START_COUNTRY' || s.activityId === 'END_COUNTRY'
  )
  const countryMarkers: CountryMarker[] = countrySegments.map((s) => {
    const d = new Date(segmentToMsUtc(s))
    const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    return {
      activityId: s.activityId as CountryMarker['activityId'],
      countryCode: s.countryCode ?? 'CZ',
      timeStr,
      dateStr: msToDateStr(segmentToMsUtc(s)),
    }
  })

  // Začátek a konec směny (šrafované pozadí v grafu) se zobrazují jen při explicitním zadání
  // výchozí/cílová země v manuálním bufferu. Při zapnutí funkce OUT se automaticky
  // nepřidávají START_COUNTRY/END_COUNTRY, aby v grafu nefigurovala směna.

  return { activities: merged, countryMarkers }
}

/**
 * Převede vygenerovaná data na textový výstup. Vrátí TXT řetězec.
 * Používá simulatorToGraphData pro sloučení activityHistory + manualEntryBuffer,
 * aby manuálně zadané bloky (1M) nebyly ztraceny při exportu/načtení.
 */
export function workWeekToTxtString(
  activityHistory: ActivityHistoryEntry[],
  manualEntryBuffer: ManualEntrySegment[],
  slotIndex: 1 | 2
): string {
  const { activities: mergedActivities, countryMarkers } = simulatorToGraphData(
    activityHistory,
    manualEntryBuffer,
    slotIndex
  )

  if (mergedActivities.length === 0) return ''

  let markers = countryMarkers
  if (markers.length === 0) {
    const firstMs = mergedActivities[0]!.startMs
    const lastMs = mergedActivities[mergedActivities.length - 1]!.endMs
    markers = [
      { activityId: 'START_COUNTRY' as const, countryCode: 'CZ', timeStr: msToTime(firstMs), dateStr: msToDateStr(firstMs) },
      { activityId: 'END_COUNTRY' as const, countryCode: 'CZ', timeStr: msToTime(lastMs), dateStr: msToDateStr(lastMs) },
    ]
  }

  const parseTimeAndDate = (timeStr: string, dateStr: string) => {
    const [hh, mm] = timeStr.split(':').map(Number)
    const [d, m, y] = dateStr.split('.').map(Number)
    return Date.UTC(y!, m! - 1, d!, hh ?? 0, mm ?? 0)
  }

  const lines: string[] = []
  for (let i = 0; i < markers.length; i += 2) {
    const startM = markers[i]
    const endM = markers[i + 1]
    if (!startM || startM.activityId !== 'START_COUNTRY' || !endM || endM.activityId !== 'END_COUNTRY') continue

    const countryCode = startM.countryCode ?? 'CZ'
    const startMs = parseTimeAndDate(startM.timeStr, startM.dateStr)
    const endMs = parseTimeAndDate(endM.timeStr, endM.dateStr)
    const nextStartM = markers[i + 2]
    const nextStartMs = nextStartM ? parseTimeAndDate(nextStartM.timeStr, nextStartM.dateStr) : Infinity

    lines.push(`----${countryCode}---- ${startM.timeStr} ${startM.dateStr}`)

    const shiftActivities = mergedActivities.filter(
      (a) => a.startMs < endMs + 60000 && a.endMs > startMs
    )
    for (const act of shiftActivities) {
      const segStart = Math.max(act.startMs, startMs)
      const segEnd = Math.min(act.endMs, endMs + 60000)
      if (segEnd > segStart) {
        emitActivityBlock(lines, segStart, segEnd, TYPE_TO_EXPORT_LABEL[act.type] ?? act.type)
      }
    }

    let shiftEndMs = endMs
    if (shiftActivities.length > 0) {
      const lastAct = shiftActivities[shiftActivities.length - 1]!
      shiftEndMs = Math.min(lastAct.endMs, endMs + 60000)
    }
    lines.push(`----${countryCode}---- ${msToTime(shiftEndMs)} ${msToDateStr(shiftEndMs)}`)

    if (nextStartM) {
      const betweenActivities = mergedActivities.filter(
        (a) => a.startMs < nextStartMs && a.endMs > shiftEndMs
      )
      if (betweenActivities.length > 0) {
        lines.push('')
        for (const act of betweenActivities) {
          const segStart = Math.max(act.startMs, shiftEndMs)
          const segEnd = Math.min(act.endMs, nextStartMs)
          if (segEnd > segStart) {
            emitActivityBlock(lines, segStart, segEnd, TYPE_TO_EXPORT_LABEL[act.type] ?? act.type)
          }
        }
      }
    } else {
      const afterShiftActivities = mergedActivities.filter((a) => a.endMs > shiftEndMs)
      if (afterShiftActivities.length > 0) {
        lines.push('')
        for (const act of afterShiftActivities) {
          const segStart = Math.max(act.startMs, shiftEndMs)
          if (act.endMs > segStart) {
            emitActivityBlock(lines, segStart, act.endMs, TYPE_TO_EXPORT_LABEL[act.type] ?? act.type)
          }
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

/**
 * Převede vygenerovaná data na textový výstup a spustí stažení TXT souboru.
 */
export function exportWorkWeekToTxt(
  activityHistory: ActivityHistoryEntry[],
  manualEntryBuffer: ManualEntrySegment[],
  slotIndex: 1 | 2
): void {
  const txt = workWeekToTxtString(activityHistory, manualEntryBuffer, slotIndex)
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  a.download = `pracovni_tyden_${ts}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
