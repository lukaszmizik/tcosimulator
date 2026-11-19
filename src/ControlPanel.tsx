import type { ReactNode } from 'react'
import type { SupportedLanguage, Translations } from './translations/types'
import { Speedometer } from './Speedometer'
import { KnowledgeBase } from './KnowledgeBase'
import type { SymbolMap } from './TachoTypes'
export type ControlPanelProps = {
  t: Translations
  language: SupportedLanguage
  symbolMap: SymbolMap | null
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
  onShowCardData: () => void
  virtualCardSettings?: ReactNode
  printVehicleSettings?: ReactNode
  infoPanels?: ReactNode
}


export function ControlPanel(p: ControlPanelProps) {
  const { t } = p
  return <section className="dashboard" data-running={p.ignitionOn} aria-label={t.controls.simulationControlsTitle}>
    <div className="dashboard-grid">
      <section className="dash-module mode-module">
        <h2>{t.controls.simulationMode}</h2>
        <p className="mode-status"><i />{p.ignitionOn ? t.controls.ignitionOn : t.controls.ignitionOff}</p>
        <div className="mode-keys">
          <button className="start-key" aria-pressed={p.ignitionOn} onClick={p.onIgnitionStart}>▶︎ START</button>
          <button className="stop-key" aria-pressed={!p.ignitionOn} aria-disabled={p.isDriving} title={p.isDriving ? t.ui.drivingCannotStop : t.ui.stopIgnition} onClick={p.isDriving ? p.onStopDisabledClick : p.onStopIgnition}>■ STOP</button>
        </div>
        {p.stopDisabledMessage && <p role="status" className="dash-warning">{t.ui.drivingCannotStop}</p>}
      </section>
      <section className="dash-module clock-module">
        <h2>{t.controls.simulationTime}</h2>
        <div className="dash-clock"><b>{p.panelDateTime.toLocaleTimeString(p.language, {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</b><time>{p.panelDateTime.toLocaleDateString(p.language)}</time></div>
        <div className="clock-adjust"><button disabled={!p.canDecrementHours} onClick={()=>p.onAdjustHours(-1)}>−1 h</button><button onClick={()=>p.onAdjustHours(1)}>+1 h</button><button disabled={!p.canDecrementMinutes} onClick={()=>p.onAdjustMinutes(-1)}>−1 min</button><button onClick={()=>p.onAdjustMinutes(1)}>+1 min</button></div>
        <div className="clock-presets">{[15,30,45].map(m=><button key={m} onClick={()=>p.onAdjustMinutes(m)}>+{m}m</button>)}</div>
        <button className="apply-time" onClick={p.onApplyTime} title={t.ui.applyTimeTitle}>✓ {t.controls.applyTime}</button>
      </section>
      <section className="dash-module speed-module">
        <h2>{t.ui.speedLabel}</h2>
        <Speedometer speed={p.currentSpeed}/>
        <div className="speed-keys"><button aria-label={t.controls.decreaseSpeed} disabled={!p.ignitionOn || p.targetSpeed <= 0} onClick={()=>p.onTargetSpeedChange(Math.max(0,p.targetSpeed-5))}>−</button><span>{t.controls.speedTargetShort} {p.targetSpeed} km/h</span><button aria-label={t.controls.increaseSpeed} disabled={!p.ignitionOn || p.targetSpeed >= 125} onClick={()=>p.onTargetSpeedChange(Math.min(125,p.targetSpeed+5))}>+</button></div>
        <input aria-label={t.controls.speedTarget} type="range" min="0" max="125" value={p.targetSpeed} disabled={!p.ignitionOn} onChange={e=>p.onTargetSpeedChange(Number(e.target.value))}/>
      </section>
      <section className="dash-module reset-module"><button className="reset-key" onClick={p.onReset} title={t.ui.resetTitle}><span>⟲</span>{t.ui.reset}</button></section>
    </div>
    <KnowledgeBase language={p.language} symbolMap={p.symbolMap} />
    {p.infoPanels}
    <details className="dash-extras" onKeyDown={(event) => event.stopPropagation()}><summary>{t.controls.dataScenariosSettings}</summary>
      <label className="dash-check"><input type="checkbox" checked={p.remoteDataDownloadActive} onChange={e=>p.onRemoteDataDownloadActiveChange(e.target.checked)}/>{t.ui.remoteDataDownloadActive}</label>
      <div className="dash-tool-buttons">
        <button onClick={p.onSimulate4h10m} disabled={!p.ignitionOn || !p.cardInserted}>{t.ui.generate4h10mDriving}</button>
        <button onClick={p.onGenerateWorkWeek} disabled={p.isMultiManning || p.ignitionOn}>{t.controls.generateWorkWeek}</button>
        <button onClick={p.onShowCardData}>{t.controls.showCardData}</button>
      </div>
      {p.virtualCardSettings}
      {p.printVehicleSettings}
    </details>
  </section>
}
