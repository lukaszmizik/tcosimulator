/**
 * Zobrazení průvodce vložením karty.
 * Vyčleněno z CardWizard2.tsx bez změny obrazovek, textů a pořadí fází.
 */

import { useLanguage } from './translations'
import type { CardInsertionState } from './TachoTypes'
import type { CountryEntry } from './data/countriesLoader'
import type { SymbolMap, TachoState } from './TachoTypes'
import { ACTIVITY_SYMBOLS, SPECIAL_SYMBOLS } from './TachoTypes'
import { parseSymbols, TachoIcon } from './Symbols'
import { formatLcdOdometer, getActivityCode, utcMsToSegment } from './CardLogic'

export type CardInsertionDisplay2Props = {
  lcdPreview?: boolean
  symbolMap: SymbolMap | null
  cardInsertionState: CardInsertionState
  isMultiManning: boolean
  countries: CountryEntry[]
  spanishRegions: CountryEntry[]
  lastEjectionTimeBySlot: { 1: number | null; 2: number | null }
  localTime: Date
  timeOffsetMs?: number
  timeStr: string
  currentSpeed: number
  odometerKm: number
  card1Inserted: boolean
  card2Inserted: boolean
  leftActivityId: TachoState['leftActivityId']
  rightActivityId: TachoState['rightActivityId']
}

/** Zobrazení – shodné s CardWizard (L1, L2, symboly, kurzor) */
export function CardInsertionDisplay2(props: CardInsertionDisplay2Props) {
  const { symbolMap, cardInsertionState: cs, isMultiManning, countries, spanishRegions, lastEjectionTimeBySlot, localTime, timeOffsetMs = 0, timeStr, currentSpeed, odometerKm, card1Inserted, card2Inserted, leftActivityId, rightActivityId } = props
  const { t, language } = useLanguage()
  const countryQuestion = language === 'en' ? '' : '?'
  /** Ve fázích načítání (welcome, loading) se zobrazuje pouze příjmení. */
  const displayName = cs.phase === 'welcome' || cs.phase === 'loading' ? (cs.cardSurname ?? cs.cardName) : cs.cardName

  if (cs.phase === 'welcome') {
    const now = new Date()
    const localTimeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const utcTimeStrWelcome = now.toISOString().substring(11, 16)
    const multi = isMultiManning
    const slotLabel = String(cs.slot)
    const symbolPart = multi ? '(2)(2)' : '(2)'
    const rawL1 = `${slotLabel}${symbolPart} ${displayName}`
    const line1 = parseSymbols(rawL1, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion lcd-welcome">
        <div className="lcd-row lcd-welcome-l1">
          <span className="lcd-welcome-l1-name">{line1}</span>
        </div>
        <div className="lcd-row lcd-welcome-l2">
          <span className="lcd-welcome-l2-left">
            {localTimeStr}
            {parseSymbols('(37)', symbolMap)}
          </span>
          <span className="lcd-welcome-l2-right">
            {utcTimeStrWelcome}
            {' UTC'}
          </span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'loading') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWait}</div>
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWaitLine2}</div>
        </div>
      )
    }
    const barSegments: Array<{ sym?: number; char?: string }> = [
      { sym: 15 },
      { sym: 15 },
      { sym: 16 },
      { sym: 16 },
      { char: '\u00a6' },
      { char: '\u00a6' },
      { char: '\u00a6' },
    ]
    const count = cs.loadingProgress >= 1 ? 7 : Math.floor(cs.loadingProgress * 7)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{displayName}</div>
        <div className="lcd-row lcd-row-left lcd-loading-row lcd-loading-bargraf">
          {barSegments.map((seg, i) => {
            const ch = seg.sym !== undefined ? (symbolMap?.[seg.sym!] ?? `(${seg.sym})`) : seg.char
            return (
              <span key={i} className={`tacho-icon ${i < count ? '' : 'lcd-bargraf-empty'}`}>
                {ch}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  if (cs.phase === 'lastRemoval') {
    const last = cs.lastWithdrawal ?? cs.firstManualEntryStartUtc ?? (cs.slot === 1 ? lastEjectionTimeBySlot[1] : lastEjectionTimeBySlot[2])
    const shown = utcMsToSegment(last != null ? last + timeOffsetMs : localTime.getTime())
    const dateStr = `${String(shown.day).padStart(2, '0')}.${String(shown.month).padStart(2, '0')}.${shown.year}`
    const timeStrLast = `${String(shown.hour).padStart(2, '0')}:${String(shown.minute).padStart(2, '0')}`
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{t.cardWizard.lastRemoval}</div>
        <div className="lcd-row lcd-row-left">{dateStr} {timeStrLast}</div>
      </div>
    )
  }

  if (cs.phase === 'decision1M') {
    const decision1mRaw = t.cardWizard.decision1m.replace('{slot}', String(cs.slot))
    const decision1mL1 = parseSymbols(decision1mRaw, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{decision1mL1}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.supplement}</span>
          <span className="lcd-decision-1m-blink">{cs.decisionSupplement ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'manualEditor') {
    if (cs.selectingCountryForStamp) {
      const code = cs.selectingSpanishRegion
        ? (spanishRegions[cs.spanishRegionIndex]?.code ?? '')
        : (countries[cs.countryIndex]?.code ?? 'CZ')
      const l1 = cs.stampActivityId === 'START_COUNTRY'
        ? parseSymbols(`(37)(36)${countryQuestion}\u00A0${t.cardWizard.startCountry}`, symbolMap)
        : parseSymbols(`(41)(37)${countryQuestion} ${t.cardWizard.endCountry}`, symbolMap)
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{l1}</div>
          <div className="lcd-row lcd-row-left lcd-country-code-blink">:{code}</div>
        </div>
      )
    }
    const seg = cs.currentSegment
    const start = cs.segmentStart
    const actSym = ACTIVITY_SYMBOLS.find((a) => a.id === seg.activityId)
    const blinkField = (field: typeof cs.editorBlinkField) => field === cs.editorBlinkField ? ' lcd-field-blink' : ''
    const isStandardActivity = ['REST', 'WORK', 'AVAILABILITY', 'UNKNOWN'].includes(seg.activityId)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">
          <span className="lcd-l2-editor-content">
            <span className="lcd-l2-symbol">M</span>
            <span className="lcd-l2-space" />
            <span className="lcd-l2-num">{String(start.day).padStart(2, '0')}</span>
            <span className="lcd-l2-sep">.</span>
            <span className="lcd-l2-num">{String(start.month).padStart(2, '0')}</span>
            <span className="lcd-l2-sep">.</span>
            <span className="lcd-l2-num lcd-l2-year">{props.lcdPreview ? String(start.year).slice(-2) : start.year}</span>
            <span className="lcd-l2-space lcd-l2-space-big" />
            <span className="lcd-l2-num">{String(start.hour).padStart(2, '0')}</span>
            <span className="lcd-l2-sep">:</span>
            <span className="lcd-l2-num">{String(start.minute).padStart(2, '0')}</span>
          </span>
        </div>
        <div className="lcd-row lcd-row-left">
          {isStandardActivity ? (
            <span className="lcd-l2-editor-content">
              <span className={`lcd-l2-symbol${blinkField('activity')}`}>
                {seg.activityId === 'UNKNOWN' ? (
                  <span className="lcd-display-font">?</span>
                ) : (
                  <TachoIcon code={actSym?.code ?? ''} />
                )}
              </span>
              <span className="lcd-l2-space" />
              <span className={`lcd-l2-num${blinkField('day')}`}>{String(seg.day).padStart(2, '0')}</span>
              <span className="lcd-l2-sep">.</span>
              <span className={`lcd-l2-num${blinkField('month')}`}>{String(seg.month).padStart(2, '0')}</span>
              <span className="lcd-l2-sep">.</span>
              <span className={`lcd-l2-num lcd-l2-year${blinkField('year')}`}>{props.lcdPreview ? String(seg.year).slice(-2) : seg.year}</span>
              <span className="lcd-l2-space lcd-l2-space-big" />
              <span className={`lcd-l2-num${blinkField('hour')}`}>{String(seg.hour).padStart(2, '0')}</span>
              <span className="lcd-l2-sep">:</span>
              <span className={`lcd-l2-num${blinkField('minute')}`}>{String(seg.minute).padStart(2, '0')}</span>
            </span>
          ) : seg.activityId === 'START_COUNTRY' ? (
            <span className={`lcd-l2-country-text${blinkField('activity')}`}>
              {parseSymbols(`(37)(36)${countryQuestion}\u00A0${t.cardWizard.startCountry}`, symbolMap)}
            </span>
          ) : seg.activityId === 'END_COUNTRY' ? (
            <span className={`lcd-l2-country-text${blinkField('activity')}`}>
              {parseSymbols(`(41)(37)${countryQuestion} ${t.cardWizard.endCountry}`, symbolMap)}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  if (cs.phase === 'country') {
    const code = cs.selectingSpanishRegion
      ? (spanishRegions[cs.spanishRegionIndex]?.code ?? '')
      : (countries[cs.countryIndex]?.code ?? 'CZ')
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{cs.selectingSpanishRegion ? t.cardWizard.regionSpain : parseSymbols(`(37)(36)\u00A0${t.cardWizard.startCountry}`, symbolMap)}</div>
        <div className="lcd-row lcd-row-left lcd-country-code-blink">:{code}</div>
      </div>
    )
  }

  if (cs.phase === 'invalidCard') {
    // Návod str. 113: !(14){slot} neplatná / karta (událost se do VU neukládá)
    const l1 = parseSymbols(`!(14)${cs.slot}\u00A0${t.cardWizard.invalidCardL1}`, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-warning-blink lcd-card-insertion">
        <div className="lcd-row lcd-row-warning-inline">{l1}</div>
        <div className="lcd-row lcd-row-warning-inline">{t.cardWizard.invalidCardL2}</div>
      </div>
    )
  }

  if (cs.phase === 'idleWarning') {
    const l1 = parseSymbols(`(35) (19)\u00A0${t.cardWizard.idlePlease}`, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{l1}</div>
        <div className="lcd-row lcd-row-left">{t.cardWizard.input}</div>
      </div>
    )
  }

  if (cs.phase === 'itsQuestion') {
    const slotNum = cs.slot
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{slotNum} {t.cardWizard.publish}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.itsQuestion}</span>
          <span className="lcd-decision-1m-blink">{cs.itsYes ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'vdoQuestion') {
    const slotNum = cs.slot
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{slotNum} {t.cardWizard.publish}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.vdoQuestion}</span>
          <span className="lcd-decision-1m-blink">{cs.vdoYes ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'itsVdoConfirmSaved') {
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{t.cardWizard.input}</div>
        <div className="lcd-row lcd-row-left">{t.cardWizard.inputSaved}</div>
      </div>
    )
  }

  if (cs.phase === 'finalConfirm') {
    const slotSymbol = cs.slot === 1 ? 12 : 13
    const l1 = parseSymbols(`(${slotSymbol}) (42)\u00A0${t.cardWizard.confirmData}`, symbolMap)
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{l1}</div>
        <div className="lcd-row lcd-decision-1m-row">
          <span>{t.cardWizard.confirm}</span>
          <span className="lcd-decision-1m-blink">{cs.finalConfirmYes ? t.cardWizard.yes : t.cardWizard.no}</span>
        </div>
      </div>
    )
  }

  if (cs.phase === 'finalizeStep2' || cs.phase === 'readyToDrive') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWait}</div>
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWaitLine2}</div>
        </div>
      )
    }
    return (
      <div className="lcd-two-rows lcd-card-insertion">
        <div className="lcd-row lcd-row-left">{parseSymbols(`${isMultiManning ? '(2)(2)' : '(2)'}\u00A0${t.cardWizard.publishReady}`, symbolMap)}</div>
        <div className="lcd-row lcd-row-left">{t.cardWizard.readyToDrive}</div>
      </div>
    )
  }

  if (cs.phase === 'finalizeStep1' || cs.phase === 'finalizeStep3' || cs.phase === 'finalizeStep4') {
    if (cs.showPleaseWait) {
      return (
        <div className="lcd-two-rows lcd-card-insertion">
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWait}</div>
          <div className="lcd-row lcd-row-left">{t.cardWizard.pleaseWaitLine2}</div>
        </div>
      )
    }
    const cardSymbolId = cs.phase === 'finalizeStep1' ? 15 : cs.phase === 'finalizeStep3' ? 16 : 14
    const cardSymbolEl = symbolMap?.[cardSymbolId] ? <span className="tacho-icon">{symbolMap[cardSymbolId]}</span> : <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} className="lcd-icon" />
    const leftEdgeChar = getActivityCode(leftActivityId)
    const rightEdgeChar = getActivityCode(rightActivityId)
    const showSlot1Card = cs.slot === 1 || card1Inserted
    const showSlot2Card = cs.slot === 2 || card2Inserted
    return (
      <div className={`lcd-two-rows lcd-card-insertion ${isMultiManning ? 'lcd-multi-manning' : ''}`} data-multi-manning={isMultiManning || undefined}>
        <div className="lcd-row">
          <div className="lcd-row-sides">{timeStr}{parseSymbols('(37)', symbolMap)}</div>
          <div className="lcd-row-center">
            {'   '}{parseSymbols(isMultiManning ? '(2)(2)' : '(2)', symbolMap)}
          </div>
          <div className="lcd-row-sides">{Math.round(currentSpeed)} km/h</div>
        </div>
        <div className="lcd-row">
          <div className="lcd-row-sides">
            <TachoIcon code={leftEdgeChar} />
            {showSlot1Card && (cs.slot === 1 ? cardSymbolEl : <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />)}
          </div>
          <div className="lcd-row-center">
            {formatLcdOdometer(odometerKm)}
          </div>
          <div className="lcd-row-sides">
            {showSlot2Card && (cs.slot === 2 ? cardSymbolEl : <TachoIcon code={SPECIAL_SYMBOLS.CARD_SYMBOL} />)}
            <TachoIcon code={rightEdgeChar} />
          </div>
        </div>
      </div>
    )
  }

  return null
}

