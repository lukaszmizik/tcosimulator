/**
 * Overlay pro tisk vozidla – 24h výtisk (Print24hVehicleSVG).
 */

import { Print24hVehicleSVG } from '../../PrintTemplates'
import type { SymbolMap } from '../../TachoTypes'
import type { SecondActivitySnapshot } from '../../TachoTypes'
import { PrintPreview } from './PrintPreview'
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
    <PrintPreview title={t.ui.printVehicle24hTitle} closeLabel={t.printOverlay.close} onClose={onClose} ready={!!symbolMap?.[18]}>
      <Print24hVehicleSVG
        dateUtc={printVehicle24hSelectedDate ?? simulatedUtcTime}
        odometerKm={odometerKm}
        secondHistory={secondHistory}
        symbolMap={symbolMap}
        isUtc={printVehicle24hIsUtc}
      />
    </PrintPreview>
  )
}
