import { useId, useState, type CSSProperties } from 'react'
import type { SupportedLanguage, Translations } from './translations/types'
import './ControlPanel.css'

const MAX_SPEED = 125
const DIAL_TICKS = Array.from({ length: 13 }, (_, index) => -120 + index * 20)

export type ControlPanelProps = {
  t: Translations
  language: SupportedLanguage
  ignitionOn: boolean
  onIgnitionStart: () => void
  targetSpeed: number
  onTargetSpeedChange: (value: number) => void
  currentSpeed: number
  /** Datum a čas, které se nastaví po stisknutí potvrzovacího tlačítka */
  panelDateTime: Date
  canDecrementHours: boolean
  canDecrementMinutes: boolean
  onAdjustHours: (delta: number) => void
  onAdjustMinutes: (delta: number) => void
  onApplyTime: () => void
  remoteDataDownloadActive: boolean
  onRemoteDataDownloadActiveChange: (value: boolean) => void
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
}

export function ControlPanel({
  t,
  language,
  ignitionOn,
  onIgnitionStart,
  targetSpeed,
  onTargetSpeedChange,
  currentSpeed,
  panelDateTime,
  canDecrementHours,
  canDecrementMinutes,
  onAdjustHours,
  onAdjustMinutes,
  onApplyTime,
  remoteDataDownloadActive,
  onRemoteDataDownloadActiveChange,
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
}: ControlPanelProps) {
  const speedId = useId()
  const displayedSpeed = Math.round(currentSpeed)
  const speedZone = displayedSpeed > 90 ? 'red' : displayedSpeed > 80 ? 'orange' : 'normal'
  const needleAngle = -120 + (240 * displayedSpeed) / MAX_SPEED
  const [generateWorkWeekFlash, setGenerateWorkWeekFlash] = useState(false)
  const handleGenerateWorkWeekClick = () => {
    if (isMultiManning || ignitionOn) return
    onGenerateWorkWeek()
    setGenerateWorkWeekFlash(true)
    setTimeout(() => setGenerateWorkWeekFlash(false), 400)
  }

  return (
    <section className="dash" data-running={ignitionOn} aria-label={t.controls.simulationControlsTitle}>
      <div className="dash-grid">
        <section className="dash-module speed-group">
          <h2 className="dash-label"><label htmlFor={speedId}>{t.ui.speedLabel}</label></h2>
          <div className="dial" data-speed-zone={speedZone} style={{ '--needle': `${needleAngle}deg` } as CSSProperties}>
            <div aria-hidden="true">
              {DIAL_TICKS.map((angle, index) => (
                <i
                  key={angle}
                  className={index % 3 === 0 ? 'tick major' : 'tick'}
                  style={{ '--a': `${angle}deg` } as CSSProperties}
                />
              ))}
              <i className="needle" />
            </div>
            <div className="dial-readout">
              <b>{displayedSpeed}</b>
              <small>km/h</small>
            </div>
          </div>
          <input
            id={speedId}
            className="dash-speed-input"
            type="range"
            min={0}
            max={MAX_SPEED}
            value={targetSpeed}
            data-overspeed={currentSpeed > 90}
            disabled={!ignitionOn}
            onChange={(e) => onTargetSpeedChange(Number(e.target.value))}
          />
          <div className="speed-scale" aria-hidden="true"><span>0</span><span>{MAX_SPEED} km/h</span></div>
        </section>

        <section className="dash-module ignition-group">
          <h2 className="dash-label">{t.ui.ignitionLabel}</h2>
          <div className="ignition-status" role="status">
            {ignitionOn ? t.controls.ignitionOn : t.controls.ignitionOff}
          </div>
          <div className="dash-buttons">
            <button
              type="button"
              className="start-key"
              aria-pressed={ignitionOn}
              onClick={onIgnitionStart}
            >
              START
            </button>
            <button
              type="button"
              className="stop-key"
              aria-pressed={!ignitionOn}
              aria-disabled={isDriving}
              onClick={isDriving ? onStopDisabledClick : onStopIgnition}
              title={isDriving ? t.ui.drivingCannotStop : t.ui.stopIgnition}
            >
              STOP
            </button>
          </div>
          <p className="dash-stop-message" role="status">{stopDisabledMessage ? t.ui.drivingCannotStop : null}</p>
          <button type="button" className="reset-key" onClick={onReset} title={t.ui.resetTitle}>
            {t.ui.reset}
          </button>
          <label className="dash-check">
            <input
              type="checkbox"
              checked={remoteDataDownloadActive}
              onChange={(e) => onRemoteDataDownloadActiveChange(e.target.checked)}
            />
            <span>{t.ui.remoteDataDownloadActive}</span>
          </label>
        </section>

        <section className="dash-module">
          <h2 className="dash-label">{t.controls.simulationTime}</h2>
          <time className="clock-face" dateTime={panelDateTime.toISOString()}>
            <b>{panelDateTime.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</b>
            <span>{panelDateTime.toLocaleDateString(language, { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
          </time>
          <div className="clock-adjust">
            <button
              type="button"
              aria-label={t.ui.decrementHours}
              disabled={!canDecrementHours}
              onClick={() => onAdjustHours(-1)}
              title={!canDecrementHours ? t.ui.cannotDecrementTime : t.ui.decrementHours}
            >
              −1 {t.controls.hourUnit}
            </button>
            <button type="button" aria-label={t.controls.incrementHours} onClick={() => onAdjustHours(1)}>
              +1 {t.controls.hourUnit}
            </button>
            <button
              type="button"
              aria-label={t.ui.decrementMinutes}
              disabled={!canDecrementMinutes}
              onClick={() => onAdjustMinutes(-1)}
              title={!canDecrementMinutes ? t.ui.cannotDecrementTime : t.ui.decrementMinutes}
            >
              −1 {t.controls.minuteUnit}
            </button>
            <button type="button" aria-label={t.controls.incrementMinutes} onClick={() => onAdjustMinutes(1)}>
              +1 {t.controls.minuteUnit}
            </button>
          </div>
          <button type="button" className="apply-key" onClick={onApplyTime} title={t.ui.applyTimeTitle}>
            {t.controls.applyTime}
          </button>
        </section>
      </div>

      <div className="dash-tools">
        <section className="dash-module">
          <h2 className="dash-label">{t.controls.practiceScenarios}</h2>
          <div className="dash-buttons">
            <button
              type="button"
              onClick={onSimulate4h10m}
              disabled={!ignitionOn || !cardInserted}
              title={!cardInserted ? t.ui.simulate4h10mDisabledNoCardTitle : t.ui.simulate4h10mTitle}
            >
              {t.ui.generate4h10mDriving}
            </button>
            <button
              type="button"
              className={generateWorkWeekFlash ? 'dash-work-week-flash' : undefined}
              onClick={handleGenerateWorkWeekClick}
              disabled={isMultiManning || ignitionOn}
              title={ignitionOn ? t.controls.generateWorkWeekDisabledIgnitionTitle : isMultiManning ? t.controls.generateWorkWeekDisabledTitle : t.controls.generateWorkWeekTitle}
            >
              {t.controls.generateWorkWeek}
            </button>
          </div>
        </section>

        <section className="dash-module">
          <h2 className="dash-label">{t.controls.dataAndRecords}</h2>
          <div className="dash-buttons">
            <input
              ref={workWeekFileInputRef}
              type="file"
              accept=".txt"
              className="work-week-file-input-hidden"
              onChange={onWorkWeekFileChange}
              aria-hidden="true"
            />
            <button type="button" onClick={onOpenWorkWeekData} title={t.controls.openFromFileTitle}>
              {t.controls.openFromFile}
            </button>
            <button type="button" onClick={onSaveCard1ToFile} title={t.controls.saveDataToFileTitle}>
              {t.controls.saveDataToFile}
            </button>
            <button type="button" onClick={onShowCardData} title={t.controls.showCardDataTitle}>
              {t.controls.showCardData}
            </button>
          </div>
        </section>
      </div>
    </section>
  )
}
