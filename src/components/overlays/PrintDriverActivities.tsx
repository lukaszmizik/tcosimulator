import { useState } from 'react'
import { VEHICLE_TECHNICAL_DATA } from '../../data/vehicle_technical_data'
import {
  createPrintRows, duration, printCardHolder, printDateUtc, printTimeUtc, type DailyCardPrintInput,
} from '../../print/driverCardPrintRows'
import { prepareDriver1Print24hUtc, type Driver1Print24hActivity } from '../../print/prepareDriver1Print24h'
import type { SymbolMap } from '../../TachoTypes'
import { PrintPreview, PrintRows } from './PrintPreview'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const AXIS = 25
const COLUMN = 30
const WIDTH = AXIS + 7 * COLUMN
const HOUR_HEIGHT = 62
const DATE_HEADER_HEIGHT = 104
const AXIS_END_PADDING = 30
const BAND_HOURS = [0, 6.5, 12.5, 18.5, 24]
const ACTIVITY_WIDTH = { UNKNOWN: 1, REST: 6, AVAILABILITY: 12, WORK: 19, DRIVING: 27 }
const LEGEND = [
  { label: '?', width: ACTIVITY_WIDTH.UNKNOWN },
  { symbol: 8, width: ACTIVITY_WIDTH.REST },
  { symbol: 7, width: ACTIVITY_WIDTH.AVAILABILITY },
  { symbol: 9, width: ACTIVITY_WIDTH.WORK },
  { symbol: 2, width: ACTIVITY_WIDTH.DRIVING },
] as const

type DiagramDay = { date: number; activities: Driver1Print24hActivity[] }

export function buildDriverActivitiesPrint(input: DailyCardPrintInput) {
  const endDay = Math.floor(input.selectedDayUtc / DAY) * DAY
  const offset = input.isUtc ? 0 : input.localOffsetMs
  const stamp = (utc: number) => printDateUtc(utc + offset) + ' ' + printTimeUtc(utc + offset)
  const cardActivities = [...(input.imported?.activities ?? []), ...input.simulated]
  const days: DiagramDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = endDay - index * DAY
    const end = Math.min(date + DAY, input.printedAtUtc)
    const records = cardActivities.filter(piece => piece.endUtc > date && piece.startUtc < end)
    const day = prepareDriver1Print24hUtc(date, input.manual, records)
    return {
      date,
      activities: day.activities.filter(piece => piece.startMs < end)
        .map(piece => ({ ...piece, endMs: Math.min(piece.endMs, end) })),
    }
  })

  const { rows, add, separator, addLocalTimeWarning } = createPrintRows()
  if (!input.isUtc) {
    addLocalTimeWarning()
    add(2, 59, ' ', stamp(endDay - 6 * DAY))
    add(59, 2, ' ', stamp(endDay + DAY))
    add(`UTC ${offset < 0 ? '-' : '+'}${duration(Math.abs(offset))}`)
  }
  separator()
  add(18, ' ', stamp(input.printedAtUtc), input.isUtc ? ' (UTC)' : ' (LOC)')
  separator(18)
  add('         ', input.imported?.generation ?? 'GEN2 v2')
  add(44, 14, 18, ...(input.isUtc ? [] : [17]))
  separator(2)
  const holder = printCardHolder(input.card, input.imported)
  if (holder.surname) add(2, ' ', holder.surname)
  if (holder.firstName) add('  ', holder.firstName)
  if (holder.cardNumber) add(2, 14, ' ', holder.issuingCountry ? holder.issuingCountry + ' /' : '', holder.cardNumber)
  if (holder.dateOfExpiry) add('  ', holder.dateOfExpiry, ' - ', input.imported?.generation ?? 'GEN2 v2')
  separator(6)
  add(6, ' ', VEHICLE_TECHNICAL_DATA.tachographManufacturer)
  add('  ', VEHICLE_TECHNICAL_DATA.dtcoNumber)
  add(VEHICLE_TECHNICAL_DATA.unitGeneration)
  separator(44, 14, 18)

  const footer = createPrintRows()
  footer.separator()
  footer.add(2, ' ', '.'.repeat(20))
  return { days, rows, footer: footer.rows, offset, zone: input.isUtc ? 'UTC' : 'LOC' }
}

export function PrintDriverActivities({ input, symbols, onClose, closeLabel, title }: {
  input: () => DailyCardPrintInput
  symbols: SymbolMap | null
  onClose: () => void
  closeLabel: string
  title: string
}) {
  const [printout] = useState(() => buildDriverActivitiesPrint(input()))
  return (
    <PrintPreview title={title} onClose={onClose} closeLabel={closeLabel} ready={!!symbols?.[18]}>
      <PrintRows rows={printout.rows} symbols={symbols} />
      {BAND_HOURS.slice(1).map((end, index) => (
        <ActivityBand key={end} start={BAND_HOURS[index]} end={end} days={printout.days}
          symbols={symbols} offset={printout.offset} zone={printout.zone} />
      ))}
      <PrintRows rows={printout.footer} symbols={symbols} />
    </PrintPreview>
  )
}

function ActivityBand({ start, end, days, symbols, offset, zone }: {
  start: number
  end: number
  days: readonly DiagramDay[]
  symbols: SymbolMap | null
  offset: number
  zone: string
}) {
  const first = start === 0
  const last = end === 24
  const top = first ? DATE_HEADER_HEIGHT + 52 : 0
  const bottom = last ? AXIS_END_PADDING : 0
  const height = (end - start) * HOUR_HEIGHT
  return (
    <svg className="vdiagram-print-band" role="img" aria-label={`Aktivity řidiče, ${start}–${end} h ${zone}`}
      viewBox={`0 ${-top} ${WIDTH} ${top + height + bottom}`}>
      {first && (
        <>
          {LEGEND.map((item, index) => {
            const x = AXIS + 6 + index * 36
            return (
              <g key={index}>
                <text x={x + 17} y={-DATE_HEADER_HEIGHT - 40} textAnchor="middle"
                  fontFamily={'symbol' in item ? 'SymbolTacho1' : 'inherit'}>
                  {'symbol' in item ? symbols?.[item.symbol] : item.label}
                </text>
                <rect x={x} y={-DATE_HEADER_HEIGHT - 4 - item.width} width="36" height={item.width} fill="#666" />
              </g>
            )
          })}
          <line x1={AXIS} x2={WIDTH} y1={-DATE_HEADER_HEIGHT} y2={-DATE_HEADER_HEIGHT} className="vdiagram-gridline" />
          <text x="9" y={-DATE_HEADER_HEIGHT + 7} transform={`rotate(90 9 ${-DATE_HEADER_HEIGHT + 7})`} dominantBaseline="central">{zone}</text>
        </>
      )}
      {days.map(({ date, activities }, index) => {
        const x = AXIS + index * COLUMN
        const from = date + start * HOUR
        const to = date + end * HOUR
        return (
          <g key={date}>
            <line x1={x} x2={x} y1={first ? -DATE_HEADER_HEIGHT : 0} y2={height} className="vdiagram-gridline" />
            {first && <text x={x + 12} y={-DATE_HEADER_HEIGHT + 4} transform={`rotate(90 ${x + 12} ${-DATE_HEADER_HEIGHT + 4})`}
              dominantBaseline="central">{printDateUtc(date + offset)}</text>}
            {activities.filter(piece => piece.endMs > from && piece.startMs < to).map(piece => (
              <rect key={piece.startMs} x={x + 1} y={(Math.max(from, piece.startMs) - from) / HOUR * HOUR_HEIGHT}
                width={ACTIVITY_WIDTH[piece.activityId]}
                height={(Math.min(to, piece.endMs) - Math.max(from, piece.startMs)) / HOUR * HOUR_HEIGHT}
                fill="#666" />
            ))}
          </g>
        )
      })}
      <line x1={WIDTH - 0.5} x2={WIDTH - 0.5} y1={first ? -DATE_HEADER_HEIGHT : 0} y2={height} className="vdiagram-gridline" />
      {Array.from({ length: Math.ceil(end) - Math.ceil(start) + Number(last) }, (_, index) => {
        const hour = Math.ceil(start) + index
        const y = (hour - start) * HOUR_HEIGHT
        const label = offset ? printTimeUtc(hour * HOUR + offset) : `${String(hour).padStart(2, '0')}:00`
        return (
          <g key={hour}>
            <line x1={AXIS - 4} x2={WIDTH} y1={y} y2={y} className="vdiagram-gridline" />
            <text x="9" y={y} transform={`rotate(90 9 ${y})`}
              dominantBaseline="central" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}
