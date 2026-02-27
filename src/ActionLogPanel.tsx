/**
 * Panel logování akcí v přímém přenosu – bílé okno s černým textem vpravo vedle simulátoru.
 * Každý řádek: akce + checkbox (zaškrtnutí = správné chování).
 * Tlačítko „Uložit log“ vyexportuje do TXT jen nezaškrtnuté (problematické) zápisy.
 */

import { useRef } from 'react'
import { useActionLog } from './ActionLogContext'
import { useLanguage } from './translations'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function ActionLogPanel() {
  const { entries, setEntryConfirmed } = useActionLog()
  const { t } = useLanguage()
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSaveLog = () => {
    const unchecked = entries.filter((e) => !e.confirmed)
    if (unchecked.length === 0) {
      const blob = new Blob(
        [`${t.actionLog.noUnconfirmed}\n`],
        { type: 'text/plain;charset=utf-8' }
      )
      downloadBlob(blob)
      return
    }

    const lines = [
      t.actionLog.logTitle,
      `Vygenerováno: ${new Date().toLocaleString('cs-CZ')}`,
      '',
      ...unchecked.map((e) => `[${formatTime(e.timestamp)}] ${e.action}`),
      '',
      `${t.actionLog.totalUnconfirmed} ${unchecked.length}`,
    ]
    const blob = new Blob([lines.join('\n')], {
      type: 'text/plain;charset=utf-8',
    })
    downloadBlob(blob)
  }

  return (
    <div className="action-log-panel">
      <div className="action-log-header">{t.actionLog.header}</div>
      <div className="action-log-list" ref={scrollRef}>
        {entries.length === 0 ? (
          <div className="action-log-empty">
            {t.actionLog.empty}
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="action-log-row">
              <label className="action-log-row-inner">
                <span className="action-log-action">
                  [{formatTime(entry.timestamp)}] {entry.action}
                </span>
                <input
                  type="checkbox"
                  className="action-log-checkbox"
                  checked={entry.confirmed}
                  onChange={(e) =>
                    setEntryConfirmed(entry.id, e.target.checked)
                  }
                  title={
                    entry.confirmed
                      ? t.actionLog.actionCorrect
                      : t.actionLog.actionConfirmTitle
                  }
                />
              </label>
            </div>
          ))
        )}
      </div>
      <div className="action-log-footer">
        <button
          type="button"
          className="action-log-save-btn"
          onClick={handleSaveLog}
          title={t.actionLog.saveLogTitle}
        >
          {t.actionLog.saveLog}
        </button>
      </div>
    </div>
  )
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `log-akci-${new Date().toISOString().slice(0, 10)}-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
