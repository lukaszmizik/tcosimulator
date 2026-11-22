import { useState } from 'react'
import type { SymbolMap } from '../../TachoTypes'
import type { Translations } from '../../translations/types'
import { buildVehicleDayPrintRows, type VehicleDayPrintData } from '../../print/vehicleDayPrintRows'
import { PrintPreview, PrintRows } from './PrintPreview'

export function PrintVehicle24hOverlay({ onClose, t, input, symbols }: {
  onClose: () => void
  t: Translations
  input: () => VehicleDayPrintData & { selectedDayUtc: number; printedAtUtc: number; isUtc: boolean }
  symbols: SymbolMap | null
}) {
  const [rows] = useState(() => buildVehicleDayPrintRows(input()))
  return (
    <PrintPreview title={t.ui.printVehicle24hTitle} closeLabel={t.printOverlay.close} onClose={onClose} ready={!!symbols?.[18]} symbols={symbols}>
      <PrintRows rows={rows} symbols={symbols} />
    </PrintPreview>
  )
}
