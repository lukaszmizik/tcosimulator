import { useState } from 'react'
import type { PrintVehicleProfile } from '../../data/printVehicleProfile'
import { buildOverspeedPrintRows } from '../../print/overspeedPrintRows'
import type { CardData, FaultOrEvent, SymbolMap } from '../../TachoTypes'
import type { Translations } from '../../translations/types'
import { PrintPreview, PrintRows } from './PrintPreview'

export function PrintSpeedVehicleOverlay({
  onClose, t, simulatedUtcTime, symbolMap, profile, records, card,
}: {
  onClose: () => void
  t: Translations
  simulatedUtcTime: number
  symbolMap: SymbolMap | null
  profile: PrintVehicleProfile
  records: readonly FaultOrEvent[]
  card: CardData | null
}) {
  const [rows] = useState(() => buildOverspeedPrintRows(simulatedUtcTime, profile, card, records))
  return (
    <PrintPreview title={t.ui.printSpeedVehicleTitle} closeLabel={t.printOverlay.close} onClose={onClose} ready={!!symbolMap?.[18]} symbols={symbolMap}>
      <PrintRows rows={rows} symbols={symbolMap} />
    </PrintPreview>
  )
}
