/**
 * Ovládací panel simulátoru – karty, rychlost, čas, zapalování, tlačítka.
 * Extrahováno z App.tsx pro zlepšení udržovatelnosti.
 */

import type { CardData } from './TachoTypes'
import type { Translations } from './translations/types'

export type ControlPanelProps = {
  t: Translations
  card1Data: CardData | null
  card2Data: CardData | null
  ignitionOn: boolean
  onIgnitionStart: () => void
  targetSpeed: number
  onTargetSpeedChange: (value: number) => void
  currentSpeed: number
  panelHours: number
  panelMinutes: number
  canDecrementHours: boolean
  canDecrementMinutes: boolean
  onAdjustHours: (delta: number) => void
  onAdjustMinutes: (delta: number) => void
  onApplyTime: () => void
  remoteDataDownloadActive: boolean
  onRemoteDataDownloadActiveChange: (value: boolean) => void
  card1EndedByTargetCountry: boolean
  onCard1EndedByTargetCountryChange: (value: boolean) => void
  isDriving: boolean
  onStopIgnition: () => void
  onStopDisabledClick: () => void
  stopDisabledMessage: boolean
  onReset: () => void
  onSimulate4h10m: () => void
  /** true pokud je vložena alespoň jedna karta (řidič 1 nebo 2) */
  cardInserted: boolean
  isMultiManning: boolean
  onGenerateWorkWeek: () => void
  workWeekFileInputRef: React.RefObject<HTMLInputElement>
  onWorkWeekFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onOpenWorkWeekData: () => void
  onSaveCard1ToFile: () => void
  onShowCardData: () => void
  onCardDragStart: (e: React.DragEvent, cardId: 'zmizik' | 'novak') => void
}

export function ControlPanel({
  t,
  card1Data,
  card2Data,
  ignitionOn,
  onIgnitionStart,
  targetSpeed,
  onTargetSpeedChange,
  currentSpeed,
  panelHours,
  panelMinutes,
  canDecrementHours,
  canDecrementMinutes,
  onAdjustHours,
  onAdjustMinutes,
  onApplyTime,
  remoteDataDownloadActive,
  onRemoteDataDownloadActiveChange,
  card1EndedByTargetCountry,
  onCard1EndedByTargetCountryChange,
  isDriving,
  onStopIgnition,
  onStopDisabledClick,
  stopDisabledMessage,
  onReset,
  onSimulate4h10m,
  cardInserted,
  isMultiManning,
  onGenerateWorkWeek,
  workWeekFileInputRef,
  onWorkWeekFileChange,
  onOpenWorkWeekData,
  onSaveCard1ToFile,
  onShowCardData,
  onCardDragStart,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      <div className="control-panel-row-main">
        <div className="control-panel-section">
          <div className="control-panel-label">{t.ui.driverCardsTest}</div>
          <div className="cards-row">
            <div
              className={`control-card ${card1Data?.templateId === 'zmizik' || card2Data?.templateId === 'zmizik' ? 'control-card-inserted' : ''} ${!ignitionOn ? 'control-card-dragging-disabled' : ''}`}
              draggable={!(card1Data?.templateId === 'zmizik' || card2Data?.templateId === 'zmizik') && ignitionOn}
              onDragStart={(e) => ignitionOn && !(card1Data?.templateId === 'zmizik' || card2Data?.templateId === 'zmizik') && onCardDragStart(e, 'zmizik')}
            >
              {card1Data?.templateId === 'zmizik' ? t.ui.cardZmizikSlot1 : card2Data?.templateId === 'zmizik' ? t.ui.cardZmizikSlot2 : t.ui.cardZmizik}
            </div>
            <div
              className={`control-card ${card1Data?.templateId === 'novak' || card2Data?.templateId === 'novak' ? 'control-card-inserted' : ''} ${!ignitionOn ? 'control-card-dragging-disabled' : ''}`}
              draggable={!(card1Data?.templateId === 'novak' || card2Data?.templateId === 'novak') && ignitionOn}
              onDragStart={(e) => ignitionOn && !(card1Data?.templateId === 'novak' || card2Data?.templateId === 'novak') && onCardDragStart(e, 'novak')}
            >
              {card1Data?.templateId === 'novak' ? t.ui.cardRomanSlot1 : card2Data?.templateId === 'novak' ? t.ui.cardRomanSlot2 : t.ui.cardRoman}
            </div>
          </div>
        </div>
        <div className="control-panel-section">
          <div className="control-panel-label">{t.ui.speedLabel}: {Math.round(currentSpeed)} km/h</div>
          <input
            type="range"
            min={0}
            max={125}
            value={targetSpeed}
            onChange={(e) => onTargetSpeedChange(Number(e.target.value))}
            className={`control-slider ${!ignitionOn ? 'control-slider-disabled' : ''} ${currentSpeed > 90 ? 'control-slider-over-90' : ''}`}
            disabled={!ignitionOn}
          />
        </div>
        <div className="control-panel-row-time-apply">
          <div className="control-panel-section control-panel-section-time">
            <div className="time-block">
              <div className="control-panel-label">{t.ui.hoursLabel}</div>
              <div className="time-display-box" aria-label={t.ui.hoursLabel}>
                {panelHours.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="time-buttons-col">
              <button type="button" className="control-btn control-btn-time" disabled={false} onClick={() => onAdjustHours(1)}>+</button>
              <button
                type="button"
                className={`control-btn control-btn-time ${!canDecrementHours ? 'control-btn-time-disabled' : ''}`}
                onClick={() => canDecrementHours && onAdjustHours(-1)}
                disabled={!canDecrementHours}
                title={!canDecrementHours ? t.ui.cannotDecrementTime : t.ui.decrementHours}
              >
                −
              </button>
            </div>
          </div>
          <div className="control-panel-section control-panel-section-time">
            <div className="time-block">
              <div className="control-panel-label">{t.ui.minutesLabel}</div>
              <div className="time-display-box" aria-label={t.ui.minutesLabel}>
                {panelMinutes.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="time-buttons-col">
              <button type="button" className="control-btn control-btn-time" onClick={() => onAdjustMinutes(1)}>+</button>
              <button
                type="button"
                className={`control-btn control-btn-time ${!canDecrementMinutes ? 'control-btn-time-disabled' : ''}`}
                onClick={() => canDecrementMinutes && onAdjustMinutes(-1)}
                disabled={!canDecrementMinutes}
                title={!canDecrementMinutes ? t.ui.cannotDecrementTime : t.ui.decrementMinutes}
              >
                −
              </button>
            </div>
          </div>
          <div className="control-panel-section time-apply-section">
            <button type="button" className="control-btn control-btn-apply" onClick={onApplyTime} title={t.ui.applyTimeTitle}>
              ✓
            </button>
          </div>
        </div>
      </div>

      <div className="control-panel-section">
        <label className="control-panel-checkbox-label">
          <input
            type="checkbox"
            checked={remoteDataDownloadActive}
            onChange={(e) => onRemoteDataDownloadActiveChange(e.target.checked)}
          />
          <span>{t.ui.remoteDataDownloadActive}</span>
        </label>
      </div>
      <div className="control-panel-section">
        <label className="control-panel-checkbox-label">
          <input
            type="checkbox"
            checked={card1EndedByTargetCountry}
            onChange={(e) => onCard1EndedByTargetCountryChange(e.target.checked)}
          />
          <span>{t.ui.card1EndedByTargetCountry}</span>
        </label>
      </div>
      <div className="control-panel-section ignition-section">
        <div className="control-panel-label">{t.ui.ignitionLabel}</div>
        <div className="ignition-buttons">
          <button
            type="button"
            className={`ignition-btn ignition-start ${ignitionOn ? 'ignition-active' : ''}`}
            onClick={onIgnitionStart}
          >
            START
          </button>
          <div className="ignition-stop-wrapper">
            <button
              type="button"
              className={`ignition-btn ignition-stop ${!ignitionOn ? 'ignition-active' : ''}`}
              disabled={isDriving}
              onClick={onStopIgnition}
              title={isDriving ? t.ui.drivingCannotStop : t.ui.stopIgnition}
            >
              STOP
            </button>
            {isDriving && (
              <div
                className="ignition-stop-overlay"
                onClick={onStopDisabledClick}
                onKeyDown={(e) => e.key === 'Enter' && onStopDisabledClick()}
                role="button"
                tabIndex={0}
                aria-label={t.ui.drivingCannotStop}
              />
            )}
            {stopDisabledMessage && (
              <span className="ignition-stop-toast">{t.ui.drivingCannotStop}</span>
            )}
          </div>
          <button
            type="button"
            className="control-btn control-btn-reset"
            onClick={onReset}
            title={t.ui.resetTitle}
          >
            {t.ui.reset}
          </button>
          <button
            type="button"
            className={`control-btn control-btn-simulate ${!ignitionOn || !cardInserted ? 'control-slider-disabled' : ''}`}
            onClick={onSimulate4h10m}
            disabled={!ignitionOn || !cardInserted}
            title={!cardInserted ? t.ui.simulate4h10mDisabledNoCardTitle : t.ui.simulate4h10mTitle}
          >
            {t.ui.generate4h10mDriving}
          </button>
          <button
            type="button"
            className={`control-btn control-btn-simulate ${isMultiManning || ignitionOn ? 'control-slider-disabled' : ''}`}
            onClick={onGenerateWorkWeek}
            disabled={isMultiManning || ignitionOn}
            title={ignitionOn ? t.controls.generateWorkWeekDisabledIgnitionTitle : isMultiManning ? t.controls.generateWorkWeekDisabledTitle : t.controls.generateWorkWeekTitle}
          >
            {t.controls.generateWorkWeek}
          </button>
          <input
            ref={workWeekFileInputRef}
            type="file"
            accept=".txt"
            className="work-week-file-input-hidden"
            onChange={onWorkWeekFileChange}
            aria-hidden="true"
          />
          <button
            type="button"
            className="control-btn control-btn-simulate"
            onClick={onOpenWorkWeekData}
            title={t.controls.openFromFileTitle}
          >
            {t.controls.openFromFile}
          </button>
          <button
            type="button"
            className="control-btn control-btn-simulate"
            onClick={onSaveCard1ToFile}
            title={t.controls.saveDataToFileTitle}
          >
            {t.controls.saveDataToFile}
          </button>
          <button
            type="button"
            className="control-btn control-btn-simulate"
            onClick={onShowCardData}
            title={t.controls.showCardDataTitle}
          >
            {t.controls.showCardData}
          </button>
        </div>
      </div>
    </div>
  )
}
