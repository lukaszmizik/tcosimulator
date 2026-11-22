import { useState } from 'react'
import { VEHICLE_TECHNICAL_DATA } from '../../data/vehicle_technical_data'
import type { PrintVehicleProfile } from '../../data/printVehicleProfile'
import type { SecondActivitySnapshot, SymbolMap } from '../../TachoTypes'
import type { Translations } from '../../translations/types'
import { createPrintRows, printDateUtc, printTimeUtc } from '../../print/driverCardPrintRows'
import { PrintPreview, PrintRows } from './PrintPreview'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WIDTH = 235
const AXIS_X = 25
const TIME_LABEL_X = 9
const MAX_SPEED = 125
const HOUR_HEIGHT = 62
const AXIS_END_PADDING = 30
const BAND_HOURS = [0, 6.5, 12.5, 18.5, 24]
const speedX = (speed: number) =>
  AXIS_X + Math.min(MAX_SPEED, Math.max(0, speed)) * (WIDTH - AXIS_X - 2) / MAX_SPEED

export function PrintVDiagramOverlay(props: {
  onClose: () => void
  t: Translations
  dateUtc: number
  simulatedUtcTime: number
  secondHistory: readonly SecondActivitySnapshot[]
  symbolMap: SymbolMap | null
  profile: PrintVehicleProfile
}) {
  const { t, onClose, symbolMap, profile, simulatedUtcTime, dateUtc, secondHistory } = props
  const [printout] = useState(() => {
    const dayStart = Math.floor(dateUtc / DAY) * DAY
    const samples = secondHistory
      .filter(({ timestampUtc, speed }) => timestampUtc >= dayStart &&
        timestampUtc < dayStart + DAY && Number.isFinite(speed))
      .sort((a, b) => a.timestampUtc - b.timestampUtc)
    const paths = BAND_HOURS.slice(1).map(() => [] as string[])
    let band = 0
    let previous: SecondActivitySnapshot | undefined
    for (const sample of samples) {
      const elapsedHours = (sample.timestampUtc - dayStart) / HOUR
      const contiguous = previous && sample.timestampUtc - previous.timestampUtc <= 1000
      while (elapsedHours >= BAND_HOURS[band + 1]) {
        const boundary = dayStart + BAND_HOURS[band + 1] * HOUR
        if (previous && contiguous) {
          const fraction = (boundary - previous.timestampUtc) / (sample.timestampUtc - previous.timestampUtc)
          const x = speedX(previous.speed + fraction * (sample.speed - previous.speed)).toFixed(2)
          paths[band].push(`L${x} ${(BAND_HOURS[band + 1] - BAND_HOURS[band]) * HOUR_HEIGHT}`)
          paths[band + 1].push(`M${x} 0`)
        }
        band++
      }
      const x = speedX(sample.speed).toFixed(2)
      const y = ((elapsedHours - BAND_HOURS[band]) * HOUR_HEIGHT).toFixed(4)
      // Zobrazíme také osamocené vzorky, bez spojování přes mezery.
      paths[band].push(contiguous ? `L${x} ${y}` : `M${x} ${y}h0.01`)
      previous = sample
    }

    const { rows, add, separator } = createPrintRows()
    separator()
    add(18, ' ', printDateUtc(simulatedUtcTime), ' ', printTimeUtc(simulatedUtcTime), ' (UTC)')
    separator(18)
    add('         GEN2 v2')
    add(44, 'v', 18)
    separator(24)
    if (profile.vin) add(24, ' ', profile.vin)
    if (profile.registration) add('  ', profile.registrationNation, ' /', profile.registration)
    if (profile.load) add(profile.load === 'passengers' ? 50 : 51)
    separator(6)
    add(6, ' ', VEHICLE_TECHNICAL_DATA.tachographManufacturer)
    add('  ', VEHICLE_TECHNICAL_DATA.dtcoNumber)
    add(VEHICLE_TECHNICAL_DATA.unitGeneration)
    separator(17)
    add('       ', printDateUtc(dayStart))
    separator()

    const footer = createPrintRows()
    footer.separator()
    footer.add(2, ' ', '.'.repeat(20))
    return { rows, footer: footer.rows, paths: paths.map((path) => path.join(' ')) }
  })

  return (
    <PrintPreview title={t.ui.printVDiagramTitle} closeLabel={t.printOverlay.close} onClose={onClose} ready={!!symbolMap?.[18]} symbols={symbolMap}>
      <PrintRows rows={printout.rows} symbols={symbolMap} />
      {printout.paths.map((path, band) => (
        <SpeedBand key={band} path={path} band={band} title={t.ui.vDiagramTitle} />
      ))}
      <PrintRows rows={printout.footer} symbols={symbolMap} />
    </PrintPreview>
  )
}

function SpeedBand({ band, path, title }: { band: number; path: string; title: string }) {
  const start = BAND_HOURS[band]
  const end = BAND_HOURS[band + 1]
  const height = (end - start) * HOUR_HEIGHT
  const first = start === 0
  const last = end === 24
  const top = first ? 73 : 0
  const bottom = last ? AXIS_END_PADDING : 0
  const quarterCount = (end - start) * 4 + Number(last)

  return (
    <svg
      className="vdiagram-print-band"
      viewBox={`0 ${-top} ${WIDTH} ${top + height + bottom}`}
      role="img"
      aria-label={`${title}, ${Math.floor(start)}:${start % 1 ? '30' : '00'}–${Math.floor(end)}:${end % 1 ? '30' : '00'} UTC`}
    >
      {first && (
        <>
          <text x={TIME_LABEL_X} y="-70" transform={`rotate(90 ${TIME_LABEL_X} -70)`} dominantBaseline="central">UTC</text>
          <text x={(AXIS_X + WIDTH) / 2} y="-51" textAnchor="middle">km/h</text>
          <line x1={AXIS_X - 5} x2={WIDTH - 1} y1="0" y2="0" className="vdiagram-axis" />
        </>
      )}
      {Array.from({ length: 13 }, (_, index) => {
        const speed = index * 10
        const x = speedX(speed)
        const major = index % 3 === 0
        return (
          <g key={speed}>
            {(first || major) && (
              <line
                x1={x} x2={x} y1={first ? -8 : 0} y2={major ? height : 0}
                className={speed === 0 ? 'vdiagram-axis' : 'vdiagram-gridline'}
              />
            )}
            {first && major && (
              <text x={x} y="-11" transform={`rotate(90 ${x} -11)`} textAnchor="end" dominantBaseline="central">
                {speed}
              </text>
            )}
          </g>
        )
      })}
      {Array.from({ length: quarterCount }, (_, quarter) => {
        const y = quarter * HOUR_HEIGHT / 4
        const hour = start + quarter / 4
        const major = Number.isInteger(hour)
        return (
          <g key={quarter}>
            <line x1={AXIS_X - (major ? 6 : 4)} x2={AXIS_X} y1={y} y2={y} className="vdiagram-axis" />
            {major && (
              <text
                x={TIME_LABEL_X}
                y={y}
                transform={`rotate(90 ${TIME_LABEL_X} ${y})`}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {String(hour).padStart(2, '0')}:00
              </text>
            )}
          </g>
        )
      })}
      <path d={path} className="vdiagram-speed-line" />
    </svg>
  )
}
