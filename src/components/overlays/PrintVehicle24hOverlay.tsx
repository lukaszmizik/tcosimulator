/**
 * Overlay pro tisk vozidla – 24h výtisk (Print24hVehicleSVG).
 */

import { Print24hVehicleSVG } from '../../PrintTemplates'
import type { SymbolMap } from '../../TachoTypes'
import type { SecondActivitySnapshot } from '../../TachoTypes'
import type { Translations } from '../../translations/types'

export type PrintVehicle24hOverlayProps = {
  open: boolean
  onClose: () => void
  t: Translations
  printVehicle24hSelectedDate: number | null
  simulatedUtcTime: number
  odometerKm: number
  secondHistory: SecondActivitySnapshot[]
  symbolMap: SymbolMap | null
  printVehicle24hIsUtc: boolean
}

export function PrintVehicle24hOverlay({
  open,
  onClose,
  t,
  printVehicle24hSelectedDate,
  simulatedUtcTime,
  odometerKm,
  secondHistory,
  symbolMap,
  printVehicle24hIsUtc,
}: PrintVehicle24hOverlayProps) {
  if (!open) return null

  return (
    <div className="print-driver1-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t.ui.printVehicle24hTitle}>
      <button type="button" className="print-overlay-close" onClick={onClose} aria-label={t.printOverlay.close}>×</button>
      <div className="print-driver1-paper" onClick={(e) => e.stopPropagation()}>
        <Print24hVehicleSVG
          dateUtc={printVehicle24hSelectedDate ?? simulatedUtcTime}
          odometerKm={odometerKm}
          secondHistory={secondHistory}
          symbolMap={symbolMap}
          isUtc={printVehicle24hIsUtc}
        />
      </div>
    </div>
  )
}
