/**
 * Varovné obrazovky displeje tachografu.
 * Vyčleněno z TachoDisplay.tsx bez změny vzhledu a vstupů.
 */

import { useLanguage } from './translations'
import type { SymbolMap } from './TachoTypes'
import { getWarning, type WarningDef } from './data/warnings'
import { parseSymbols } from './Symbols'

export function OverrideWarningDisplay({ symbolMap, warningDef }: { symbolMap: SymbolMap | null; warningDef: WarningDef }) {
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(warningDef.line1, symbolMap)}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {warningDef.line2 != null ? parseSymbols(warningDef.line2, symbolMap) : null}
      </div>
    </div>
  )
}

export function DrivingWithoutCardWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const { language } = useLanguage()
  const def = getWarning('28', language)!
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(def.line1, symbolMap)}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {def.line2}
      </div>
    </div>
  )
}

export function BreakWarningDisplay({ symbolMap, breakWarningActive }: { symbolMap: SymbolMap | null; breakWarningActive: '415' | '430' }) {
  const { language } = useLanguage()
  const def = getWarning(breakWarningActive, language)!
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(def.line1, symbolMap)}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {parseSymbols(def.line2!, symbolMap)}
      </div>
    </div>
  )
}

export function ExcessSpeedWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const { t } = useLanguage()
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        <span className="lcd-inline-symbols">{parseSymbols('(39)(39)\u00A0', symbolMap)}</span>
        <span>{t.tachoDisplay.excessSpeed}</span>
      </div>
      <div className="lcd-row lcd-row-warning-inline" style={{ justifyContent: 'flex-end' }}>
        <span>30</span>
      </div>
    </div>
  )
}

export function EjectionBlockedWarningDisplay({ symbolMap }: { symbolMap: SymbolMap | null }) {
  const { t } = useLanguage()
  const l1 = parseSymbols(`(35)(14)\u00A0${t.tachoDisplay.ejectionBlockedL1}`, symbolMap)
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">
        {l1}
      </div>
      <div className="lcd-row lcd-row-warning-inline">
        {t.tachoDisplay.ejectionBlockedL2}
      </div>
    </div>
  )
}

/** Vložená karta vypršela po změně dne – !(14){slot} neplatná / karta (návod str. 113). */
export function ExpiredInsertedCardWarningDisplay({
  symbolMap,
  slot,
}: {
  symbolMap: SymbolMap | null
  slot: 1 | 2
}) {
  const { t } = useLanguage()
  const l1 = parseSymbols(`!(14)${slot}\u00A0${t.cardWizard.invalidCardL1}`, symbolMap)
  return (
    <div className="lcd-two-rows lcd-card-warning-blink">
      <div className="lcd-row lcd-row-warning-inline">{l1}</div>
      <div className="lcd-row lcd-row-warning-inline">{t.cardWizard.invalidCardL2}</div>
    </div>
  )
}
