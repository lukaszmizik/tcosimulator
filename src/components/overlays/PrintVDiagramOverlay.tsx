/**
 * Overlay pro tisk V-diagramu (PrintVDiagramSVG).
 */

import { PrintVDiagramSVG } from '../../PrintTemplates'
import type { SymbolMap } from '../../TachoTypes'
import type { SecondActivitySnapshot } from '../../TachoTypes'
import type { Translations } from '../../translations/types'

export type PrintVDiagramOverlayProps = {
  open: boolean
  onClose: () => void
  t: Translations
  printVDiagramSelectedDate: number | null
  simulatedUtcTime: number
  secondHistory: SecondActivitySnapshot[]
  symbolMap: SymbolMap | null
}

export function PrintVDiagramOverlay({
  open,
  onClose,
  t,
  printVDiagramSelectedDate,
  simulatedUtcTime,
  secondHistory,
  symbolMap,
}: PrintVDiagramOverlayProps) {
  if (!open) return null

  return (
    <div className="print-driver1-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t.ui.printVDiagramTitle}>
      <button type="button" className="print-overlay-close" onClick={onClose} aria-label={t.printOverlay.close}>×</button>
      <div className="print-vdiagram-paper" onClick={(e) => e.stopPropagation()}>
        <PrintVDiagramSVG
          secondHistory={secondHistory}
          dateUtc={printVDiagramSelectedDate ?? simulatedUtcTime}
          isUtc={true}
          symbolMap={symbolMap}
        />
      </div>
    </div>
  )
}
