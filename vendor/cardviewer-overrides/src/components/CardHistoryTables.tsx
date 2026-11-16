import { Fragment, type ReactNode } from 'react'
import { fill, useLanguage } from '../translations'
import type { ClockMode } from '../lib/clock'
import { addDays, formatClockDateTime } from '../lib/clock'
import type { CardIncident, DriverCardData, LoadUnloadEntry, VehicleUse } from '../types/tacho'

type CardHistoryTablesProps = {
  card: DriverCardData
  weekStartMs: number
  clockMode: ClockMode
}

function loadLabel(kind: LoadUnloadEntry['kind'], labels: { loadNoun: string; unloadNoun: string; loadAndUnload: string }): string {
  if (kind === 'load') return labels.loadNoun
  if (kind === 'unload') return labels.unloadNoun
  return labels.loadAndUnload
}

function formatKm(value: number | null, locale: string, unit: string): string {
  if (value == null) return '—'
  return `${new Intl.NumberFormat(locale).format(value)} ${unit}`
}

function overlapsWeek(fromUtc: number, toUtc: number, weekStart: number, weekEnd: number): boolean {
  return fromUtc < weekEnd && toUtc > weekStart
}

function HistoryTable({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <section className={`card-history card-history--${accent}`}>
      <h3 className="card-history-title">{title}</h3>
      <div className="work-week-graph-table-wrapper">
        <table className="work-week-graph-table card-history-table">{children}</table>
      </div>
    </section>
  )
}

function emptyRow(columns: number, label: string) {
  return (
    <tr>
      <td colSpan={columns}>{label}</td>
    </tr>
  )
}

function formatPlate(value: string): string {
  const compact = value.replace(/\s+/g, '').toUpperCase()
  if (/^[0-9A-Z]{7}$/.test(compact)) return `${compact.slice(0, 3)} ${compact.slice(3)}`
  return value.trim()
}

function PlateMark({ plate }: { plate: string }) {
  const label = formatPlate(plate)
  return (
    <span className="cz-plate" aria-label={label}>
      <span className="cz-plate-band" aria-hidden="true" />
      <span className="cz-plate-text">{label}</span>
    </span>
  )
}

function vehicleDetail(
  use: VehicleUse,
  locale: string,
  labels: { km: string; registrationCountry: string; vinLabel: string; odometerCounter: string },
): string {
  const parts: string[] = []
  if (use.registrationNation) parts.push(fill(labels.registrationCountry, { value: use.registrationNation }))
  if (use.vin) parts.push(fill(labels.vinLabel, { value: use.vin }))
  if (use.odometerBeginKm != null || use.odometerEndKm != null) {
    parts.push(fill(labels.odometerCounter, {
      from: formatKm(use.odometerBeginKm ?? null, locale, labels.km),
      to: formatKm(use.odometerEndKm ?? null, locale, labels.km),
    }))
  }
  return parts.join(' · ')
}

function vehicleRows(
  uses: VehicleUse[],
  weekStart: number,
  weekEnd: number,
  mode: ClockMode,
  locale: string,
  labels: { km: string; registrationCountry: string; vinLabel: string; odometerCounter: string },
) {
  return uses
    .filter((use) => overlapsWeek(use.fromUtc, use.toUtc, weekStart, weekEnd))
    .sort((a, b) => b.fromUtc - a.fromUtc)
    .map((use) => {
      const detail = vehicleDetail(use, locale, labels)
      return (
        <Fragment key={`${use.registration}-${use.fromUtc}`}>
          <tr className="card-history-vehicle-main">
            <td className="card-history-plate"><PlateMark plate={use.registration} /></td>
            <td>{formatClockDateTime(use.fromUtc, mode)}</td>
            <td>{formatClockDateTime(use.toUtc, mode)}</td>
            <td>{formatKm(use.kilometers, locale, labels.km)}</td>
          </tr>
          {detail ? (
            <tr className="card-history-vehicle-extra">
              <td colSpan={4}>{detail}</td>
            </tr>
          ) : null}
        </Fragment>
      )
    })
}

function incidentRows(items: CardIncident[], weekStart: number, weekEnd: number, mode: ClockMode) {
  return items
    .filter((item) => overlapsWeek(item.fromUtc, item.toUtc ?? item.fromUtc, weekStart, weekEnd))
    .sort((a, b) => b.fromUtc - a.fromUtc)
    .map((item) => (
      <tr key={`${item.typeLabel}-${item.fromUtc}-${item.registration ?? ''}`}>
        <td>{formatClockDateTime(item.fromUtc, mode)}</td>
        <td>{item.toUtc != null ? formatClockDateTime(item.toUtc, mode) : '—'}</td>
        <td>{item.registration ?? '—'}</td>
        <td>{item.typeLabel}</td>
      </tr>
    ))
}

export function CardHistoryTables({ card, weekStartMs, clockMode }: CardHistoryTablesProps) {
  const { locale, t } = useLanguage()
  const labels = t.workWeek
  const weekEnd = addDays(weekStartMs, 7, clockMode)
  const vehicles = vehicleRows(card.vehicleUses ?? [], weekStartMs, weekEnd, clockMode, locale, labels)
  const events = incidentRows(card.events ?? [], weekStartMs, weekEnd, clockMode)
  const faults = incidentRows(card.faults ?? [], weekStartMs, weekEnd, clockMode)
  const loads = (card.loadUnloadEntries ?? [])
    .filter((entry) => entry.atUtc >= weekStartMs && entry.atUtc < weekEnd)
    .sort((a, b) => b.atUtc - a.atUtc)
    .map((entry) => (
      <tr key={`${entry.kind}-${entry.atUtc}`}>
        <td>{formatClockDateTime(entry.atUtc, clockMode)}</td>
        <td>{loadLabel(entry.kind, labels)}</td>
        <td>{formatKm(entry.odometerKm, locale, labels.km)}</td>
        <td>{entry.location ?? '—'}</td>
      </tr>
    ))

  return (
    <div className="card-history-group">
      <HistoryTable title={labels.vehicleHistory} accent="vehicles">
        <thead>
          <tr>
            <th>{labels.vehicle}</th>
            <th>{labels.from}</th>
            <th>{labels.to}</th>
            <th>{labels.traveledKm}</th>
          </tr>
        </thead>
        <tbody>{vehicles.length > 0 ? vehicles : emptyRow(4, labels.noWeekRecord)}</tbody>
      </HistoryTable>
      <HistoryTable title={labels.events} accent="events">
        <thead>
          <tr>
            <th>{labels.from}</th>
            <th>{labels.to}</th>
            <th>{labels.vehicle}</th>
            <th>{labels.kind}</th>
          </tr>
        </thead>
        <tbody>{events.length > 0 ? events : emptyRow(4, labels.noWeekRecord)}</tbody>
      </HistoryTable>
      <HistoryTable title={labels.faults} accent="faults">
        <thead>
          <tr>
            <th>{labels.from}</th>
            <th>{labels.to}</th>
            <th>{labels.vehicle}</th>
            <th>{labels.kind}</th>
          </tr>
        </thead>
        <tbody>{faults.length > 0 ? faults : emptyRow(4, labels.noWeekRecord)}</tbody>
      </HistoryTable>
      <HistoryTable title={labels.enteredLoads} accent="loads">
        <thead>
          <tr>
            <th>{labels.date}</th>
            <th>{labels.kind}</th>
            <th>{labels.odometer}</th>
            <th>{labels.location}</th>
          </tr>
        </thead>
        <tbody>{loads.length > 0 ? loads : emptyRow(4, labels.noWeekRecord)}</tbody>
      </HistoryTable>
    </div>
  )
}
