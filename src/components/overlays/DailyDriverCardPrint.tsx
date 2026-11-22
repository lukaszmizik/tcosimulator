import { useState } from 'react'
import type { SymbolMap } from '../../TachoTypes'
import { buildDriverCardPrintRows, type DailyCardPrintInput } from '../../print/driverCardPrintRows'
import { PrintPreview, PrintRows } from './PrintPreview'

export function DailyDriverCardPrint({ input, symbols, onClose, closeLabel, title }: {
  input: () => DailyCardPrintInput
  symbols: SymbolMap | null
  onClose: () => void
  closeLabel: string
  title: string
}) {
  const [rows] = useState(() => buildDriverCardPrintRows(input()))

  return (
    <PrintPreview title={title} closeLabel={closeLabel} onClose={onClose} ready={!!symbols?.[18]} symbols={symbols}>
      <PrintRows rows={rows} symbols={symbols} />
    </PrintPreview>
  )
}
