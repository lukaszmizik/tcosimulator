import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { SymbolMap } from '../../TachoTypes'
import { buildDriverCardPrintRows, type DailyCardPrintInput } from '../../print/driverCardPrintRows'

export function DailyDriverCardPrint({ input, symbols, onClose, closeLabel, title }: {
  input: () => DailyCardPrintInput
  symbols: SymbolMap | null
  onClose: () => void
  closeLabel: string
  title: string
}) {
  const [rows] = useState(() => buildDriverCardPrintRows(input()))

  async function print() {
    await document.fonts.ready
    window.print()
  }

  return createPortal(
    <div className="daily-card-print print-driver1-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <button type="button" className="print-overlay-close" onClick={onClose} aria-label={closeLabel}>×</button>
      <div className="daily-card-print-panel" onClick={(event) => event.stopPropagation()}>
        <div className="daily-card-print-toolbar">
          <span>{symbols?.[18] ? 'Výukový výtisk' : 'Načítám symboly'}</span>
          <button type="button" disabled={!symbols?.[18]} onClick={() => void print()}>Tisk / PDF</button>
        </div>
        <div className="daily-card-print-scroll">
          <article className="daily-card-print-paper" aria-label={title}>
            {rows.map((row, rowIndex) => (
              <div className="daily-card-print-row" key={rowIndex}>
                {row.map((cell, index) => typeof cell === 'number'
                  ? <span className="daily-card-print-symbol" key={index}>{symbols?.[cell] ?? ''}</span>
                  : <span key={index}>{cell}</span>)}
              </div>
            ))}
            <div className="daily-card-print-note">VÝUKOVÝ VÝTISK</div>
          </article>
        </div>
      </div>
    </div>,
    document.body,
  )
}
