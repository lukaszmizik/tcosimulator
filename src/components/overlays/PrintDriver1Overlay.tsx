/**
 * Overlay pro tisk údajů řidiče 1 – 24h den (základní údaje, manuální záznamy, místa, události).
 */

import type { CardData, EventLogEntry, ManualEntrySegment } from '../../TachoTypes'
import type { Translations } from '../../translations/types'
import { ACTIVITY_SYMBOLS } from '../../TachoTypes'
import { segmentToMsUtc } from '../../CardLogic'
import { prepareDriver1Print24hUtc, type Driver1PrintCardActivity } from '../../print/prepareDriver1Print24h'

export type PrintDriver1OverlayProps = {
  open: boolean
  onClose: () => void
  t: Translations
  printDriver1SelectedDate: number | null
  simulatedUtcTime: number
  card1Data: CardData | null
  driver1ManualEntryBuffer: ManualEntrySegment[]
  slot1CardActivities?: readonly Driver1PrintCardActivity[]
  eventLog: EventLogEntry[]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatPrintSum(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${pad2(h)}:${pad2(m)}`
}

function formatUtcPoint(ms: number, dayEndMs: number): string {
  if (ms === dayEndMs) {
    const day = new Date(dayEndMs - 24 * 60 * 60 * 1000)
    return `${pad2(day.getUTCDate())}.${pad2(day.getUTCMonth() + 1)}. 24:00`
  }
  const d = new Date(ms)
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}. ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}

export function PrintDriver1Overlay({
  open,
  onClose,
  t,
  printDriver1SelectedDate,
  simulatedUtcTime,
  card1Data,
  driver1ManualEntryBuffer,
  slot1CardActivities = [],
  eventLog,
}: PrintDriver1OverlayProps) {
  if (!open) return null

  const utcDay = printDriver1SelectedDate != null
    ? prepareDriver1Print24hUtc(printDriver1SelectedDate, driver1ManualEntryBuffer, slot1CardActivities)
    : null

  return (
    <div className="print-driver1-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t.printOverlay.driver1Title}>
      <button type="button" className="print-overlay-close" onClick={onClose} aria-label={t.printOverlay.close}>×</button>
      <div className="print-driver1-paper" onClick={(e) => e.stopPropagation()}>
        <div className="print-driver1-content">
          {printDriver1SelectedDate != null && (
            <div className="print-driver1-date-header">
              {t.printOverlay.driver1Title} - 24h den - {new Date(printDriver1SelectedDate).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          )}
          <div className="print-driver1-section">
            <strong>{t.printOverlay.basicInfo}</strong>
            <div>{t.printOverlay.name} {card1Data?.name ?? '—'}</div>
            <div>{t.printOverlay.cardNumber} {card1Data?.templateId ?? '—'}</div>
            <div>UTC: {new Date(printDriver1SelectedDate ?? simulatedUtcTime).toISOString().replace('T', ' ').slice(0, 19)}</div>
          </div>

          <div className="print-driver1-section">
            <strong>{t.printOverlay.manualEntries}</strong>
            {utcDay ? (
              <>
                {utcDay.activities.map((item, i) => {
                  const driving = item.activityId === 'DRIVING'
                  const a = driving ? undefined : ACTIVITY_SYMBOLS.find((x) => x.id === item.activityId)
                  const label = driving
                    ? t.workWeek.activityTypes['řízení']
                    : t.workWeek.activityLabels[item.activityId] ?? a?.label ?? item.activityId
                  const code = driving ? '\u0053' : a?.code ?? '?'
                  return (
                    <div key={i}>
                      {formatUtcPoint(item.startMs, utcDay.dayEndMs)} - {formatUtcPoint(item.endMs, utcDay.dayEndMs)} | {label} ({code})
                    </div>
                  )
                })}
                {utcDay.activities.length === 0 && (
                  <div className="print-driver1-empty">{t.printOverlay.none}</div>
                )}
                <div>{t.workWeek.activityTypes['řízení']}: {formatPrintSum(utcDay.sums.drivingMs)}</div>
                <div>{t.workWeek.activityTypes['práce']}: {formatPrintSum(utcDay.sums.workMs)}</div>
                <div>{t.workWeek.activityTypes['pohotovost']}: {formatPrintSum(utcDay.sums.availabilityMs)}</div>
                <div>{t.workWeek.activityTypes['odpočinek']}: {formatPrintSum(utcDay.sums.restMs)}</div>
              </>
            ) : (
              <>
                {driver1ManualEntryBuffer
                  .map((seg, i) => {
                    if (seg.activityId === 'START_COUNTRY' || seg.activityId === 'END_COUNTRY') return null
                    const next = driver1ManualEntryBuffer[i + 1]
                    if (next && segmentToMsUtc(seg) === segmentToMsUtc(next)) return null
                    if (next && (next.activityId === 'START_COUNTRY' || next.activityId === 'END_COUNTRY')) return null
                    const a = ACTIVITY_SYMBOLS.find((x) => x.id === seg.activityId)
                    const label = t.workWeek.activityLabels[seg.activityId] ?? a?.label ?? seg.activityId
                    const code = a?.code ?? '?'
                    const fmt = (s: ManualEntrySegment) => `${pad2(s.day)}.${pad2(s.month)}. ${pad2(s.hour)}:${pad2(s.minute)}`
                    const od = fmt(seg)
                    const dob = next ? fmt(next) : '—'
                    return (
                      <div key={i}>
                        {od} - {dob} | {label} ({code})
                      </div>
                    )
                  })
                  .filter(Boolean)}
                {driver1ManualEntryBuffer.filter((s) => s.activityId !== 'START_COUNTRY' && s.activityId !== 'END_COUNTRY').length === 0 && (
                  <div className="print-driver1-empty">{t.printOverlay.none}</div>
                )}
              </>
            )}
          </div>

          <div className="print-driver1-section">
            <strong>{t.printOverlay.places}</strong>
            {driver1ManualEntryBuffer
              .filter((s) => s.activityId === 'START_COUNTRY' || s.activityId === 'END_COUNTRY')
              .map((seg, i) => {
                const a = ACTIVITY_SYMBOLS.find((x) => x.id === seg.activityId)
                const label = t.workWeek.activityLabels[seg.activityId] ?? a?.label ?? seg.activityId
                const pad = (n: number) => String(n).padStart(2, '0')
                const ts = `${pad(seg.day)}.${pad(seg.month)}. ${pad(seg.hour)}:${pad(seg.minute)}`
                return (
                  <div key={i}>
                    {ts} | {label}: {seg.countryCode ?? '—'}
                  </div>
                )
              })}
            {driver1ManualEntryBuffer.filter((s) => s.activityId === 'START_COUNTRY' || s.activityId === 'END_COUNTRY').length === 0 && (
              <div className="print-driver1-empty">{t.printOverlay.none}</div>
            )}
          </div>

          <div className="print-driver1-section">
            <strong>Události</strong>
            {eventLog
              .filter((e) => e.type === 'DRIVING_WITHOUT_CARD' || e.type === 'DRIVING_WITHOUT_VALID_CARD')
              .map((e) => {
                const d = new Date(e.startTime)
                const pad = (n: number) => String(n).padStart(2, '0')
                const ts = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`
                const end = e.endTime ? ` - ${pad(new Date(e.endTime).getDate())}.${pad(new Date(e.endTime).getMonth() + 1)}. ${pad(new Date(e.endTime).getHours())}:${pad(new Date(e.endTime).getMinutes())}` : ''
                const label = e.type === 'DRIVING_WITHOUT_VALID_CARD'
                  ? `Jízda bez platné karty${e.duringIncompleteManualEntry ? ' (nedokončené manuální zadání)' : ''}`
                  : 'Jízda bez karty'
                return (
                  <div key={e.id}>
                    {label}: {ts}{end}
                  </div>
                )
              })}
            {eventLog.filter((e) => e.type === 'DRIVING_WITHOUT_CARD' || e.type === 'DRIVING_WITHOUT_VALID_CARD').length === 0 && (
              <div className="print-driver1-empty">{t.printOverlay.none}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
