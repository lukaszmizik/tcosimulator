/**
 * Overlay pro tisk vozidla – překročení rychlosti (vys. rychlost, PRINT_SPEED_V).
 * Výtisk obsahuje UTC čas, typ karty a blok „vlož údaje o řidiči“ (když je zadán).
 */

import { PrintSpeedVehicleSVG, PRINT_MARK_EXCESS_SPEED, type PrintDriverDataBlockData, type PrintVehicleDataBlockData } from '../../PrintTemplates'
import type { SymbolMap } from '../../TachoTypes'
import { PrintPreview } from './PrintPreview'
import type { Translations } from '../../translations/types'

export type PrintSpeedVehicleOverlayProps = {
  open: boolean
  onClose: () => void
  t: Translations
  simulatedUtcTime: number
  symbolMap: SymbolMap | null
  /** Blok údajů řidiče (příjmení, jméno, číslo karty, platnost) – zobrazí se na výtisku pod typem karty. */
  driverDataBlock?: PrintDriverDataBlockData | null
  /** Blok dat vozidla (VIN, RZ) – zobrazí se na výtisku pod blokem řidiče. */
  vehicleDataBlock?: PrintVehicleDataBlockData | null
}

export function PrintSpeedVehicleOverlay({
  open,
  onClose,
  t,
  simulatedUtcTime,
  symbolMap,
  driverDataBlock,
  vehicleDataBlock,
}: PrintSpeedVehicleOverlayProps) {
  if (!open) return null

  return (
    <PrintPreview title={t.ui.printSpeedVehicleTitle} closeLabel={t.printOverlay.close} onClose={onClose} ready={!!symbolMap?.[18]}>
      <PrintSpeedVehicleSVG
        dateUtc={simulatedUtcTime}
        symbolMap={symbolMap}
        printMarkSymbolIds={PRINT_MARK_EXCESS_SPEED}
        printMarkSuffix="90 km/h"
        driverDataBlock={driverDataBlock ?? undefined}
        vehicleDataBlock={vehicleDataBlock ?? undefined}
      />
    </PrintPreview>
  )
}
