import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { SymbolMap } from '../../TachoTypes'
import type { PrintRow } from '../../print/driverCardPrintRows'

export function PrintPreview({ title, closeLabel, onClose, ready = true, children }: {
  title: string
  closeLabel: string
  onClose: () => void
  ready?: boolean
  children: ReactNode
}) {
  async function print() {
    await document.fonts.ready
    window.print()
  }

  return createPortal(
    <div className="daily-card-print print-driver1-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <button type="button" className="print-overlay-close" onClick={onClose} aria-label={closeLabel}>×</button>
      <div className="daily-card-print-panel" onClick={(event) => event.stopPropagation()}>
        <div className="daily-card-print-toolbar">
          <h2>{title}</h2>
          <button type="button" disabled={!ready} onClick={() => void print()}>Tisk / PDF</button>
        </div>
        <div className="daily-card-print-scroll">
          <article className="daily-card-print-paper" aria-label={title}>{children}</article>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function PrintRows({ rows, symbols }: { rows: readonly PrintRow[]; symbols: SymbolMap | null }) {
  return rows.map((row, rowIndex) => (
    <div className="daily-card-print-row" key={rowIndex}>
      {row.map((cell, index) => typeof cell === 'number'
        ? <span className="daily-card-print-symbol" key={index}>{symbols?.[cell] ?? ''}</span>
        : <span key={index}>{cell}</span>
      )}
    </div>
  ))
}
