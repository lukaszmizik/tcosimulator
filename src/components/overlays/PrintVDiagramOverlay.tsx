import { useState } from 'react'
import { VEHICLE_TECHNICAL_DATA } from '../../data/vehicle_technical_data'
import type { PrintVehicleProfile } from '../../data/printVehicleProfile'
import type { SecondActivitySnapshot, SymbolMap } from '../../TachoTypes'
import type { Translations } from '../../translations/types'
import { createPrintRows, printDateUtc, printTimeUtc } from '../../print/driverCardPrintRows'
import { PrintPreview, PrintRows } from './PrintPreview'

const HOUR = 3_600_000
const HOURS_PER_BAND = 6
const WIDTH = 200
const AXIS_X = 32
const CHART_WIDTH = 160
const HOUR_HEIGHT = 70
const MAX_SPEED = 125
const speedX = (speed: number) => AXIS_X + (Math.min(MAX_SPEED, Math.max(0, speed)) / MAX_SPEED) * CHART_WIDTH

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
    const dayStart = Math.floor(dateUtc / (24 * HOUR)) * 24 * HOUR
    const paths = Array.from({ length: 24 / HOURS_PER_BAND }, () => [] as string[])
    const samples = secondHistory
      .filter(({ timestampUtc, speed }) => timestampUtc >= dayStart &&
        timestampUtc < dayStart + 24 * HOUR && Number.isFinite(speed))
      .sort((a, b) => a.timestampUtc - b.timestampUtc)
    let previous: SecondActivitySnapshot | undefined
    for (const sample of samples) {
      const elapsedHours = (sample.timestampUtc - dayStart) / HOUR
      const band = Math.floor(elapsedHours / HOURS_PER_BAND)
      const bandStart = dayStart + band * HOURS_PER_BAND * HOUR
      const path = paths[band]
      const contiguous = previous && sample.timestampUtc - previous.timestampUtc <= 1000
      const x = speedX(sample.speed).toFixed(2)
      const y = ((elapsedHours - band * HOURS_PER_BAND) * HOUR_HEIGHT).toFixed(4)
      if (previous && contiguous && previous.timestampUtc < bandStart) {
        const fraction = (bandStart - previous.timestampUtc) / (sample.timestampUtc - previous.timestampUtc)
        const boundaryX = speedX(previous.speed + fraction * (sample.speed - previous.speed)).toFixed(2)
        paths[band - 1].push(`L${boundaryX} ${HOURS_PER_BAND * HOUR_HEIGHT}`)
        path.push(`M${boundaryX} 0`)
      }
      // Krátká vodorovná stopa zviditelní i osamocený sekundový vzorek.
      path.push(contiguous ? `L${x} ${y}` : `M${x} ${y}h-0.01`)
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
    <PrintPreview title={t.ui.printVDiagramTitle} closeLabel={t.printOverlay.close} onClose={onClose} ready={!!symbolMap?.[18]}>
      <PrintRows rows={printout.rows} symbols={symbolMap} />
      {printout.paths.map((path, band) => (
        <SpeedBand key={band} path={path} band={band} title={t.ui.vDiagramTitle} />
      ))}
      <PrintRows rows={printout.footer} symbols={symbolMap} />
    </PrintPreview>
  )
}

function SpeedBand({ band, path, title }: { band: number; path: string; title: string }) {
  const top = band === 0 ? 27 : 0
  const height = HOUR_HEIGHT * HOURS_PER_BAND
  const isLast = (band + 1) * HOURS_PER_BAND === 24

  return (
    <svg
      className="vdiagram-print-band"
      viewBox={`0 ${-top} ${WIDTH} ${top + height + (isLast ? 10 : 0)}`}
      role="img"
      aria-label={`${title}, ${band * HOURS_PER_BAND}:00–${(band + 1) * HOURS_PER_BAND}:00 UTC`}
    >
      {band === 0 && <text x={AXIS_X + CHART_WIDTH / 2} y={-18} textAnchor="middle">km/h</text>}
      {[0, 30, 60, 90, 120].map((speed) => (
        <g key={speed}>
          <line x1={speedX(speed)} x2={speedX(speed)} y1={band === 0 ? -4 : 0} y2={height} stroke={speed ? '#999' : '#222'} strokeWidth=".65" />
          {band === 0 && <text x={speedX(speed)} y={-7} textAnchor="middle">{speed}</text>}
        </g>
      ))}
      {Array.from({ length: HOURS_PER_BAND * 4 + Number(isLast) }, (_, quarter) => {
        const y = quarter * HOUR_HEIGHT / 4
        const hour = band * HOURS_PER_BAND + quarter / 4
        const major = quarter % 4 === 0
        return (
          <g key={quarter}>
            <line x1={AXIS_X - (major ? 5 : 2)} x2={major ? AXIS_X + CHART_WIDTH : AXIS_X} y1={y} y2={y} stroke={major ? '#999' : '#222'} strokeWidth=".65" />
            {major && <text x={AXIS_X - 8} y={y + (isLast && quarter === HOURS_PER_BAND * 4 ? 3 : 4)} textAnchor="end">{String(hour).padStart(2, '0')}:00</text>}
          </g>
        )
      })}
      {band === 0 && <text x="2" y={-7}>UTC</text>}
      <path d={path} fill="none" stroke="#111" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
