/**
 * Importovaný soubor .DDD. Stejný převod i graf jako čtečka Cardviewer.
 * Návrat zavře graf a vrátí obrazovku simulátoru.
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SymbolMap } from './TachoTypes'
import type { DddCardRecord } from './dddCardSession'
import { useLanguage } from './translations'
import { LanguageProvider as ViewerLanguageProvider } from 'tacho-viewer-language'
import { WorkWeekGraphView } from 'tacho-viewer-graph'
import { cardToGraph } from 'tacho-viewer-card-graph'
import { withTachographCountryCodes } from './tachographCountryCode'
import '../vendor/cardviewer/src/index.css'
import './insertedCardGraphs.css'

type ClockMode = 'local' | 'utc'

function CardFileGraph({
  record,
  slot,
  clockMode,
  onClockModeChange,
  embedded,
  onClose,
  symbolMap,
  headingNote,
}: {
  record: DddCardRecord
  slot: 1 | 2
  clockMode: ClockMode
  onClockModeChange: (mode: ClockMode) => void
  embedded: boolean
  onClose: () => void
  symbolMap?: SymbolMap | null
  headingNote?: string
}) {
  const source = record.original
  const graph = useMemo(
    () => withTachographCountryCodes(cardToGraph(source, clockMode)),
    [source, clockMode],
  )
  const card = useMemo(() => withTachographCountryCodes(source), [source])
  return (
    <div data-card-slot={slot} data-card-number={record.cardNumber}>
      <WorkWeekGraphView
        days={graph.days}
        countryMarkers={graph.countryMarkers}
        manualEntryBuffer={graph.manualEntryBuffer}
        lastWithdrawalUtc={graph.lastWithdrawalUtc}
        loadUnloadEvents={graph.loadUnloadEvents}
        ferryTrainEvents={graph.ferryTrainEvents}
        outModeEvents={graph.outModeEvents}
        recordedGpsLocations={graph.recordedGpsLocations}
        faultsAndEvents={graph.faultsAndEvents}
        symbolMap={symbolMap}
        card={card}
        embedded={embedded}
        onClose={onClose}
        clockMode={clockMode}
        onClockModeChange={onClockModeChange}
        headingNote={headingNote}
      />
    </div>
  )
}

export function InsertedCardsHistory({
  slot1,
  slot2,
  symbolMap,
  onClose,
}: {
  slot1: DddCardRecord | null
  slot2: DddCardRecord | null
  symbolMap?: SymbolMap | null
  onClose: () => void
}) {
  const { language, t } = useLanguage()
  const graphLanguage = language === 'ru' ? 'ru' : 'cs'
  const [clockMode, setClockMode] = useState<ClockMode>('local')
  const cards = [
    slot1 ? { slot: 1 as const, record: slot1 } : null,
    slot2 ? { slot: 2 as const, record: slot2 } : null,
  ].filter((item): item is { slot: 1 | 2; record: DddCardRecord } => item != null)
  if (cards.length === 0) return null

  const single = cards.length === 1
  return createPortal(
    <ViewerLanguageProvider language={graphLanguage}>
      {single ? (
        <CardFileGraph
          record={cards[0]!.record}
          slot={cards[0]!.slot}
          clockMode={clockMode}
          onClockModeChange={setClockMode}
          embedded={false}
          onClose={onClose}
          symbolMap={symbolMap}
        />
      ) : (
        <div className="card-graphs-window-overlay" role="dialog" aria-modal="true" aria-label={t.cardPanel.dataTitle}>
          <button
            type="button"
            className="card-graphs-window-close work-week-graph-close"
            data-card-graphs-close=""
            aria-label={t.ui.close}
            onClick={onClose}
          >
            ×
          </button>
          <div className="card-graphs-stack">
            {cards.map((item) => (
              <CardFileGraph
                key={item.slot}
                record={item.record}
                slot={item.slot}
                clockMode={clockMode}
                onClockModeChange={setClockMode}
                embedded
                onClose={onClose}
                symbolMap={symbolMap}
                headingNote={t.cardPanel.slot.replace('{slot}', String(item.slot))}
              />
            ))}
          </div>
        </div>
      )}
    </ViewerLanguageProvider>,
    document.body,
  )
}
